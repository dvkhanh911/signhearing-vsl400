"""Persistent single-model TensorFlow worker, CPU only."""

import json
import sys

from ai_inference.app.config import Settings
from ai_inference.app.preprocessing import to_siformer
from ai_inference.app.siformer_loader import RuntimeFailure, SiformerRuntime


def main():
    output = sys.stdout
    sys.stdout = sys.stderr

    def reply(data):
        output.write(json.dumps(data, ensure_ascii=True) + "\n")
        output.flush()

    try:
        settings = Settings()
        runtime = SiformerRuntime(settings.siformer_model_root)
    except RuntimeFailure as error:
        reply({"ready": False, "error": str(error)})
        return
    except Exception:
        reply({"ready": False, "error": "model_initialization_failed"})
        return
    reply(
        {
            "ready": True,
            "model_loading_time_ms": round(runtime.load_ms, 2),
            "device": settings.ai_device.upper(),
        }
    )
    import numpy as np

    for line in sys.stdin:
        try:
            job = json.loads(line)
            with np.load(job["input"], allow_pickle=False) as data:
                coords = to_siformer(
                    data["features"], data["detection"], data["valid"], runtime
                )
            reply(runtime.predict(coords))
        except ValueError:
            reply({"success": False, "error": "no_landmarks"})
        except Exception:
            reply({"success": False, "error": "inference_failed"})


if __name__ == "__main__":
    main()
