"""Own both workers so a timeout can terminate decoding and GPU work, not just await."""

import json
import os
import subprocess
import sys
import threading
import time
from pathlib import Path

from .siformer_loader import RuntimeFailure

REPOSITORY = Path(__file__).resolve().parents[2]


class InferencePool:
    def __init__(self, settings):
        self.settings = settings
        self.processes = []
        self.ready = False
        self.error = "initializing"
        self.closed = threading.Event()

    def _spawn(self, python, module):
        if self.closed.is_set():
            raise RuntimeFailure("worker_unavailable")
        env = dict(
            os.environ,
            PYTHONDONTWRITEBYTECODE="1",
            PYTHONUTF8="1",
            TF_CPP_MIN_LOG_LEVEL="2",
        )
        # Parent environment is inherited locally; never inject Supabase credentials.
        process = subprocess.Popen(
            [str(python), "-B", "-m", module],
            cwd=REPOSITORY,
            env=env,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            encoding="utf-8",
        )
        self.processes.append(process)
        if self.closed.is_set():
            process.terminate()
            process.wait(timeout=3)
            raise RuntimeFailure("worker_unavailable")
        response = self._receive(process)
        if not response.get("ready"):
            raise RuntimeFailure(response.get("error", "model_initialization_failed"))
        return process, response

    @staticmethod
    def _receive(process):
        line = process.stdout.readline()
        if not line:
            raise RuntimeFailure("worker_unavailable")
        try:
            return json.loads(line)
        except ValueError as error:
            raise RuntimeFailure("worker_unavailable") from error

    def start(self):
        self.model, info = self._spawn(sys.executable, "ai_inference.model_worker")
        default_mp = (
            REPOSITORY
            / "ai_inference/.venv-mp"
            / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
        )
        mp_python = self.settings.mp_python or os.environ.get(
            "MP_PYTHON", str(default_mp)
        )
        if not Path(mp_python).is_file():
            raise RuntimeFailure("landmark_python_missing")
        self.landmarks, _ = self._spawn(mp_python, "ai_inference.landmark_worker")
        self.loading_ms = info["model_loading_time_ms"]
        self.device = info["device"]
        self.error, self.ready = "", True

    def available(self):
        return self.ready and all(p.poll() is None for p in self.processes)

    def run(self, video, directory):
        started = time.perf_counter()
        output = Path(directory) / "landmarks.npz"
        self.landmarks.stdin.write(
            json.dumps({"input": str(video), "output": str(output)}) + "\n"
        )
        self.landmarks.stdin.flush()
        reply = self._receive(self.landmarks)
        if not reply.get("success"):
            raise RuntimeFailure(reply.get("error", "invalid_video"))
        preprocessing_ms = (time.perf_counter() - started) * 1000
        self.model.stdin.write(json.dumps({"input": str(output)}) + "\n")
        self.model.stdin.flush()
        result = self._receive(self.model)
        if not result.get("success"):
            raise RuntimeFailure(result.get("error", "inference_failed"))
        result.update(
            preprocessing_time_ms=round(preprocessing_ms, 2),
            total_processing_time_ms=round((time.perf_counter() - started) * 1000, 2),
        )
        return result

    def stop(self, error="worker_unavailable"):
        self.closed.set()
        self.ready, self.error = False, error
        for process in self.processes:
            if process.poll() is None:
                process.terminate()
        for process in self.processes:
            try:
                process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=3)
