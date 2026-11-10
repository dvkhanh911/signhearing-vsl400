"""Pin the trained export and the exact preprocessing used by the existing demo."""

import hashlib
import json
from pathlib import Path

import pytest

from ai_inference.app.config import Settings
from ai_inference.app.siformer_loader import inspect_export

ROOT = Path(__file__).resolve().parents[2]


def test_preprocessing_matches_receipt_without_rgb_or_fusion_models():
    folder = ROOT / "ai_inference/landmarks"
    recipe = json.loads((folder / "landmark_recipe.json").read_text(encoding="utf-8"))
    for name in ("video.py", "sampling.py", "landmark_encoder.py"):
        source = (folder / name).read_text(encoding="utf-8")
        if name == "landmark_encoder.py":
            source = source.replace(
                "from .validation import _validate_clip as _validate_shared_clip",
                "from .rgb_encoder import _validate_clip as _validate_shared_clip",
            )
        assert (
            hashlib.sha256(source.encode()).hexdigest() == recipe["code_hashes"][name]
        )
    assert not (folder / "rgb_encoder.py").exists()
    assert not (folder / "fusion_models.py").exists()


def test_authorized_checkpoint_source_and_label_snapshot_match():
    root = Settings(_env_file=None).siformer_model_root
    if not root.is_dir():
        pytest.skip("Authorized local model export is absent on this machine")
    cfg, labels, state = inspect_export(root)
    assert cfg["model"]["encoder_layers"] == 3
    assert cfg["model"]["decoder_layers"] == 2
    assert cfg["frames"] == 16 and cfg["num_classes"] == 100
    assert state["epoch"] == 47 and not state["smoke"]
    assert labels == json.loads(
        (ROOT / "data/siformer-labels.json").read_text(encoding="utf-8")
    )


def test_other_model_directory_is_rejected(tmp_path):
    with pytest.raises(ValueError):
        Settings(siformer_model_root=tmp_path, _env_file=None)


def test_gpu_mode_is_rejected():
    with pytest.raises(ValueError):
        Settings(ai_device="gpu", _env_file=None)
