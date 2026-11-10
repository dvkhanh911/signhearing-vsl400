"""Isolated MediaPipe 0.10.14/protobuf 4 worker; no recognition model imports."""

import json
import base64
import io
import sys
from pathlib import Path

import numpy as np

from ai_inference.landmarks.landmark_encoder import (
    build_landmark_detector,
    extract_raw_landmarks,
    preprocess_landmarks,
)
from ai_inference.landmarks import video

ROOT = Path(__file__).resolve().parent


def prepare(path):
    # Resource limits wrap decoding only; the original QC, sampling and resize
    # functions remain unchanged. One worker processes one clip at a time.
    original = video.cv2

    class Capture:
        def __init__(self, filename):
            import math

            self.cap = original.VideoCapture(filename)
            self.frames = self.bytes = 0
            self.first_timestamp_ms = None
            self.fps = self.cap.get(original.CAP_PROP_FPS)
            count = self.cap.get(original.CAP_PROP_FRAME_COUNT)
            width = self.cap.get(original.CAP_PROP_FRAME_WIDTH)
            height = self.cap.get(original.CAP_PROP_FRAME_HEIGHT)
            if (
                not math.isfinite(self.fps)
                or self.fps <= 0
                or count > 360
                or count > self.fps * 12
                or width * height > 1920 * 1080
            ):
                self.cap.release()
                raise ValueError("video_limits")

        def __getattr__(self, name):
            return getattr(self.cap, name)

        def read(self):
            ok, frame = self.cap.read()
            if ok:
                timestamp = self.cap.get(original.CAP_PROP_POS_MSEC)
                if self.first_timestamp_ms is None:
                    self.first_timestamp_ms = timestamp
                if timestamp - self.first_timestamp_ms > 12000:
                    raise ValueError("video_limits")
                self.frames += 1
                self.bytes += frame.nbytes
                if (
                    frame.shape[0] * frame.shape[1] > 1920 * 1080
                    or self.frames > 360
                    or self.frames / self.fps > 12
                    or self.bytes > 256 * 1024**2
                ):
                    raise ValueError("video_limits")
            return ok, frame

    class BudgetedCV:
        VideoCapture = Capture

        def __getattr__(self, name):
            return getattr(original, name)

    cfg = json.loads(
        (ROOT / "landmarks/preprocessing.json").read_text(encoding="utf-8")
    )
    if Path(path).suffix == ".json":
        from PIL import Image

        body = json.loads(Path(path).read_text(encoding="utf-8"))
        frames = body.get("frames") if isinstance(body, dict) else None
        if not isinstance(frames, list) or len(frames) != 30:
            raise ValueError("invalid_frames")
        images = []
        for entry in frames:
            if not isinstance(entry, str) or not entry.startswith("data:image/jpeg;base64,") or len(entry) > 1024 * 1024:
                raise ValueError("invalid_frame")
            raw = base64.b64decode(entry.split(",", 1)[1], validate=True)
            with Image.open(io.BytesIO(raw)) as image:
                if image.format != "JPEG" or image.width < 1 or image.width != image.height or image.width > 480:
                    raise ValueError("invalid_frame_dimensions")
                image.verify()
            frame = original.imdecode(np.frombuffer(raw, np.uint8), original.IMREAD_COLOR)
            if frame is None or frame.shape[0] != frame.shape[1] or frame.shape[0] > 480:
                raise ValueError("invalid_frame")
            images.append(original.cvtColor(frame, original.COLOR_BGR2RGB))
        rgb = np.stack(images)
        meta = {"decoded_frames": 30, "reported_frames": 30, "fps": None,
                "original_frame_indices": list(range(30)), "original_shape": list(rgb[0].shape),
                "color_order": "RGB", "dtype": "uint8", "opencv_version": original.__version__,
                "strict_frame_count": True, "warnings": ["webcam frames"], "decode_seconds": 0.0}
        old_decode = video.decode_video
        video.decode_video = lambda path, **kwargs: (rgb, meta)
        try:
            return video.prepare_clip("webcam", cfg, video_id="webcam")
        finally:
            video.decode_video = old_decode
    video.cv2 = BudgetedCV()
    try:
        return video.prepare_clip(path, cfg, video_id="submitted-clip")
    finally:
        video.cv2 = original


def main():
    output = sys.stdout
    sys.stdout = sys.stderr

    def reply(data):
        output.write(json.dumps(data, ensure_ascii=True) + "\n")
        output.flush()

    try:
        cfg = json.loads(
            (ROOT / "landmarks/preprocessing.json").read_text(encoding="utf-8")
        )
        recipe = json.loads(
            (ROOT / "landmarks/landmark_recipe.json").read_text(encoding="utf-8")
        )
        detector = build_landmark_detector(cfg["landmark_extraction"])
        for field in (
            "mediapipe_version",
            "source_graph_sha256",
            "derived_graph_sha256",
            "model_sha256",
        ):
            if detector.provenance[field] != recipe["expected_provenance"][field]:
                raise ValueError("landmark_recipe_mismatch")
    except Exception:
        reply({"ready": False, "error": "landmark_initialization_failed"})
        return
    reply({"ready": True})
    with detector:
        for line in sys.stdin:
            try:
                job = json.loads(line)
                clip = prepare(job["input"])
                raw = extract_raw_landmarks(clip, detector)
                features, detection = preprocess_landmarks(raw)
                np.savez(
                    job["output"],
                    features=features,
                    detection=detection,
                    valid=clip["valid_mask"] & ~clip["padding_mask"],
                )
                reply({"success": True})
            except (ValueError, OSError):
                reply({"success": False, "error": "invalid_video"})
            except Exception:
                reply({"success": False, "error": "landmark_failed"})


if __name__ == "__main__":
    main()
