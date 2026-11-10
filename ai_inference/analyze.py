"""CPU-only sensitivity diagnostics; does not tune preprocessing, weights or labels."""

import argparse
import json
import subprocess
import tempfile
import time
from pathlib import Path

from ai_inference.app.config import Settings
from ai_inference.app.preprocessing import to_siformer
from ai_inference.app.siformer_loader import SiformerRuntime

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output", type=Path, default=ROOT / "ai_inference/reports/quality.json"
    )
    args = parser.parse_args()
    settings = Settings()
    data = json.loads((ROOT / "data/curriculum.json").read_text(encoding="utf-8"))
    labels = json.loads(
        (ROOT / "data/siformer-labels.json").read_text(encoding="utf-8")
    )
    lessons = {lesson["id"]: lesson for lesson in data["lessons"]}
    supported = [
        {
            "slug": s["slug"],
            "gloss": s.get("source_gloss") or s["word"]["vi"],
            "class_id": labels[s.get("source_gloss") or s["word"]["vi"]],
            "lesson": s["lesson"],
            "lesson_title": lessons[s["lesson"]]["title"]["vi"],
        }
        for s in data["signs"]
        if s["lesson"] is not None
        and (s.get("source_gloss") or s["word"]["vi"]) in labels
    ]
    assert len(supported) == 27
    runtime = SiformerRuntime(settings.siformer_model_root)
    import cv2
    import numpy as np

    process = subprocess.Popen(
        [settings.mp_python, "-B", "-m", "ai_inference.landmark_worker"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
        encoding="utf-8",
        cwd=ROOT,
    )
    results = []
    try:
        if not json.loads(process.stdout.readline()).get("ready"):
            raise RuntimeError("landmark_initialization_failed")
        with tempfile.TemporaryDirectory(prefix="siformer-analysis-") as directory:
            folder = Path(directory)
            for slug in ("an", "uong", "khoc"):
                sign = next(s for s in data["signs"] if s["slug"] == slug)
                source = ROOT / sign["video"].lstrip("/")
                cap = cv2.VideoCapture(str(source))
                fps = cap.get(cv2.CAP_PROP_FPS)
                frames = []
                while True:
                    ok, frame = cap.read()
                    if not ok:
                        break
                    frames.append(frame)
                cap.release()
                for variant in (
                    "original",
                    "reencoded_control",
                    "mirror",
                    "scale_075",
                    "zoom_125",
                    "roll_10",
                    "dark_065",
                ):
                    clip = source
                    if variant != "original":
                        clip = folder / (slug + "-" + variant + ".mp4")
                        height, width = frames[0].shape[:2]
                        writer = cv2.VideoWriter(
                            str(clip),
                            cv2.VideoWriter_fourcc(*"mp4v"),
                            fps,
                            (width, height),
                        )
                        for original in frames:
                            frame = original.copy()
                            if variant == "mirror":
                                frame = cv2.flip(frame, 1)
                            elif variant == "scale_075":
                                resized = cv2.resize(
                                    frame, (round(width * 0.75), round(height * 0.75))
                                )
                                frame[:] = 0
                                y, x = (
                                    (height - resized.shape[0]) // 2,
                                    (width - resized.shape[1]) // 2,
                                )
                                frame[
                                    y : y + resized.shape[0], x : x + resized.shape[1]
                                ] = resized
                            elif variant == "zoom_125":
                                y, x = round(height * 0.1), round(width * 0.1)
                                frame = cv2.resize(
                                    frame[y : height - y, x : width - x],
                                    (width, height),
                                )
                            elif variant == "roll_10":
                                matrix = cv2.getRotationMatrix2D(
                                    (width / 2, height / 2), 10, 1
                                )
                                frame = cv2.warpAffine(frame, matrix, (width, height))
                            elif variant == "dark_065":
                                frame = (frame.astype(np.float32) * 0.65).astype(
                                    np.uint8
                                )
                            writer.write(frame)
                        writer.release()
                    output = folder / "landmarks.npz"
                    started = time.perf_counter()
                    process.stdin.write(
                        json.dumps({"input": str(clip), "output": str(output)}) + "\n"
                    )
                    process.stdin.flush()
                    answer = json.loads(process.stdout.readline())
                    row = {
                        "slug": slug,
                        "expected": sign["word"]["vi"],
                        "variant": variant,
                        "success": answer.get("success", False),
                    }
                    if row["success"]:
                        with np.load(output, allow_pickle=False) as z:
                            features, detected, valid = (
                                z["features"],
                                z["detection"],
                                z["valid"],
                            )
                            coords = to_siformer(features, detected, valid, runtime)
                            row.update(
                                real_frames=int(valid.sum()),
                                left_hand_frames=int(
                                    detected[valid, 33:54].any(axis=1).sum()
                                ),
                                right_hand_frames=int(
                                    detected[valid, 54:75].any(axis=1).sum()
                                ),
                                pose_frames=int(detected[valid, :33].any(axis=1).sum()),
                            )
                        prediction = runtime.predict(coords)
                        row.update(
                            predicted=prediction["predicted_gloss"],
                            confidence=prediction["confidence"],
                            matches_expected=prediction["predicted_gloss"]
                            == row["expected"],
                            model_ms=prediction["inference_time_ms"],
                            processing_ms=round(
                                (time.perf_counter() - started) * 1000, 2
                            ),
                        )
                    else:
                        row["error"] = answer.get("error")
                    results.append(row)
                    print(json.dumps(row, ensure_ascii=True), flush=True)
    finally:
        process.terminate()
        try:
            process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
    report = {
        "model_source": str(settings.siformer_model_root),
        "device": "CPU",
        "classes": labels,
        "compatible_words": supported,
        "results": results,
        "limitations": [
            "Three supplied clips are not an accuracy benchmark.",
            "Transforms are diagnostic input variants, not changes to the runtime pipeline.",
            "Compare transforms with reencoded_control; codec artifacts may affect results.",
            "2D roll is not a measurement of 3D camera angle; physical webcam and real signer remain untested.",
        ],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
