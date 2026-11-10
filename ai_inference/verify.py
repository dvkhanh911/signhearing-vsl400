"""Offline real-video diagnostic using the one authorized SiFormer on CPU."""

import argparse
import json
import os
import subprocess
import tempfile
import time
from pathlib import Path

from ai_inference.app.config import Settings
from ai_inference.app.preprocessing import to_siformer
from ai_inference.app.siformer_loader import SiformerRuntime


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--video", required=True, type=Path)
    parser.add_argument(
        "--cpu", action="store_true", help="Explicit offline CPU diagnostic only"
    )
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    settings = Settings()
    started = time.perf_counter()
    runtime = SiformerRuntime(settings.siformer_model_root)
    python = settings.mp_python or os.environ.get("MP_PYTHON")
    if not python:
        raise RuntimeError(
            "Set MP_PYTHON to the isolated MediaPipe 0.10.14 environment"
        )
    process = subprocess.Popen(
        [python, "-B", "-m", "ai_inference.landmark_worker"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        text=True,
        encoding="utf-8",
    )
    try:
        ready = json.loads(process.stdout.readline())
        if not ready.get("ready"):
            raise RuntimeError(ready["error"])
        with tempfile.TemporaryDirectory(prefix="siformer-verify-") as directory:
            output = Path(directory) / "landmarks.npz"
            tick = time.perf_counter()
            process.stdin.write(
                json.dumps({"input": str(args.video.resolve()), "output": str(output)})
                + "\n"
            )
            process.stdin.flush()
            result = json.loads(process.stdout.readline())
            if not result.get("success"):
                raise RuntimeError(result["error"])
            import numpy as np

            with np.load(output, allow_pickle=False) as data:
                coords = to_siformer(
                    data["features"], data["detection"], data["valid"], runtime
                )
            preprocess_ms = (time.perf_counter() - tick) * 1000
            prediction = runtime.predict(coords)
            prediction.update(
                model_loading_time_ms=round(runtime.load_ms, 2),
                preprocessing_time_ms=round(preprocess_ms, 2),
                diagnostic_total_time_ms=round(
                    (time.perf_counter() - started) * 1000, 2
                ),
                gpu_verified=False,
                loaded_recognition_modules=[
                    name
                    for name in __import__("sys").modules
                    if name.startswith("vsl_tf")
                ],
            )
            text = json.dumps(prediction, ensure_ascii=True, indent=2)
            print(text)
            if args.output:
                args.output.parent.mkdir(parents=True, exist_ok=True)
                args.output.write_text(text + "\n", encoding="utf-8")
    finally:
        process.terminate()
        try:
            process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()


if __name__ == "__main__":
    main()
