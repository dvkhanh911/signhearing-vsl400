"""Load exactly the authorized TensorFlow SiFormer and integrity-check its export."""

import hashlib
import importlib
import json
import sys
import time
from pathlib import Path

BEST_METADATA_SHA256 = (
    "b9e5d5531025f3fd91367c4c76d9ac6ef70db3e10ceb754ee23effca5b43e3bb"
)


class RuntimeFailure(RuntimeError):
    pass


def sha256(path, text=False):
    data = Path(path).read_bytes()
    return hashlib.sha256(data.replace(b"\r\n", b"\n") if text else data).hexdigest()


def inspect_export(root):
    root = Path(root).resolve()
    run = root / "run"
    pointer = json.loads((run / "best.json").read_text(encoding="utf-8"))
    if pointer != {"checkpoint": "epoch_0047.json", "sha256": BEST_METADATA_SHA256}:
        raise RuntimeFailure("checkpoint_invalid")
    metadata = run / pointer["checkpoint"]
    # The Windows export changed CRLF text bytes; all LF source hashes match
    # the training receipt. Binary checkpoint hashes are never normalized.
    if sha256(metadata, text=True) != pointer["sha256"]:
        raise RuntimeFailure("checkpoint_invalid")
    state = json.loads(metadata.read_text(encoding="utf-8"))
    cfg = json.loads((run / "config.json").read_text(encoding="utf-8"))
    labels = json.loads((run / "labels.json").read_text(encoding="utf-8"))
    if (
        state["smoke"]
        or state["config"] != cfg
        or state["labels"] != labels
        or sorted(labels.values()) != list(range(100))
        or cfg["frames"] != 16
        or cfg["num_classes"] != 100
        or cfg["model"]["inference"] != "static"
        or cfg["model"]["patience"] != 0
        or cfg["rectification"]["enabled"]
    ):
        raise RuntimeFailure("checkpoint_invalid")
    for name, expected in state["files"].items():
        candidate = (run / name).resolve()
        if candidate.parent != run or sha256(candidate) != expected:
            raise RuntimeFailure("checkpoint_invalid")
    for name, expected in state["code_identity"].items():
        candidate = (root / "project" / name).resolve()
        if (
            not candidate.is_relative_to(root / "project")
            or sha256(candidate, text=True) != expected
        ):
            raise RuntimeFailure("source_integrity_failed")
    return cfg, labels, state


def import_authorized(root, module):
    project = Path(root).resolve() / "project"
    sys.dont_write_bytecode = True
    if str(project) not in sys.path:
        sys.path.insert(0, str(project))
    loaded = importlib.import_module(module)
    if not Path(loaded.__file__).resolve().is_relative_to(project):
        raise RuntimeFailure("source_integrity_failed")
    return loaded


class SiformerRuntime:
    def __init__(self, root):
        started = time.perf_counter()
        self.cfg, self.labels, state = inspect_export(root)
        import tensorflow as tf

        self.tf = tf
        if tf.__version__ != state["tensorflow_version"]:
            raise RuntimeFailure("tensorflow_version_mismatch")
        tf.config.set_visible_devices([], "GPU")
        self.device = "/CPU:0"
        model_module = import_authorized(root, "vsl_tf.model")
        self.adapter = import_authorized(root, "vsl.adapter")
        self.sampling = import_authorized(root, "vsl.augmentation")
        with tf.device(self.device):
            self.model = model_module.SiformerVSL(self.cfg)
            self.model(tf.zeros((1, 16, 54, 2)), training=False)
            self.model.build_exit_heads()
            status = tf.train.Checkpoint(
                model=self.model, attention_rng=self.model.attention_rng
            ).restore(str(Path(root) / "run" / state["checkpoint"]))
            status.assert_existing_objects_matched()
            status.expect_partial()  # Only optimizer and training counters are omitted.
            dropout = [
                v
                for v in self.model.non_trainable_variables
                if "seed_generator" in v.path
            ]
            if len(dropout) != len(state["keras_dropout_rng"]):
                raise RuntimeFailure("checkpoint_invalid")
            for variable, value in zip(dropout, state["keras_dropout_rng"]):
                variable.assign(value)
            probe = self.model(tf.zeros((1, 16, 54, 2)), training=False)
            if probe.shape != (1, 100) or "CPU:0" not in probe.device:
                raise RuntimeFailure("cpu_placement_failed")
            probe.numpy()  # Synchronize actual placement/execution.
        self.load_ms = (time.perf_counter() - started) * 1000

    def predict(self, coords):
        tf = self.tf
        with tf.device(self.device):
            self.model.attention_rng.reset_from_seed(self.cfg["seed"] + 17)
            started = time.perf_counter()
            logits = self.model(
                tf.convert_to_tensor(coords[None], tf.float32), training=False
            )
            probs = tf.nn.softmax(logits, axis=-1).numpy()[0]
            elapsed = (time.perf_counter() - started) * 1000
        index = int(probs.argmax())
        names = {value: key for key, value in self.labels.items()}
        return {
            "success": True,
            "predicted_gloss": names[index],
            "confidence": float(probs[index]),
            "inference_time_ms": round(elapsed, 2),
            "model_name": "SiFormer",
            "device": "CPU",
        }
