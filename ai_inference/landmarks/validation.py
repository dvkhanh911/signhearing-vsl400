"""Only shared clip validation, extracted without importing an RGB model."""
import numpy as np
from .video import PREPROCESS_VERSION as M02_VERSION

def _validate_clip(clip):
    if not isinstance(clip, dict) or not isinstance(clip.get("video_id"), str) or not clip["video_id"]:
        raise ValueError("M03 requires a prepared clip with nonempty string video_id")
    indices = clip.get("frame_indices")
    if not isinstance(indices, np.ndarray) or indices.shape != (16,) or indices.dtype != np.int64:
        raise ValueError("M03 frame_indices must be int64 (16,)")
    for name in ("valid_mask", "padding_mask"):
        value = clip.get(name)
        if not isinstance(value, np.ndarray) or value.shape != (16,) or value.dtype != np.bool_:
            raise ValueError(f"M03 {name} must be bool (16,)")
    valid, padding = clip["valid_mask"], clip["padding_mask"]
    n = int(valid.sum())
    if n == 0 or not np.array_equal(padding, ~valid) or not np.array_equal(valid, np.arange(16) < n):
        raise ValueError("M03 masks must be complementary, real prefix then repeat-last padding")
    if np.any(indices < 0) or np.any(np.diff(indices[:n]) <= 0) or np.any(indices[n:] != indices[n-1]):
        raise ValueError("M03 indices violate M02 temporal order/repeat-last padding")
    quality = clip.get("quality_metadata", {})
    if not isinstance(quality, dict) or not isinstance(quality.get("preprocessing"), dict):
        raise ValueError("M03 requires M02 quality/preprocessing metadata")
    if quality["preprocessing"].get("preprocess_version") != M02_VERSION:
        raise ValueError("M03 missing/unsupported M02 preprocessing version")
    digest = quality.get("preprocessing_sha256")
    if not isinstance(digest, str) or len(digest) != 64 or any(c not in "0123456789abcdef" for c in digest):
        raise ValueError("M03 missing M02 preprocessing checksum")
    if quality.get("padding_count") != 16-n or quality.get("sampled_original_indices") != indices.tolist():
        raise ValueError("M03 QC metadata disagrees with indices/masks")
    if type(quality.get("valid_frames")) is not int or min(16, quality["valid_frames"]) != n:
        raise ValueError("M03 QC real frame count disagrees with masks")
    return quality
