"""The exact 75x4 -> 54x2 conversion from the authorized import_landmark_cache.py."""

import numpy as np


def to_siformer(features, detected, valid, runtime):
    hand_order, pose_order = runtime.adapter.HAND_ORDER, runtime.adapter.POSE_ORDER
    features = features.reshape(-1, 75, 4)
    if (
        features.shape != (16, 75, 4)
        or detected.shape != (16, 75)
        or valid.shape != (16,)
        or not np.isfinite(features).all()
    ):
        raise ValueError("Invalid landmark features")
    xy = features[:, :, :2]
    coords = np.zeros((len(xy), 54, 2), np.float32)
    mask = np.zeros((len(xy), 54), bool)
    for start, offset in ((0, 33), (21, 54)):
        indices = np.asarray(hand_order) + offset
        coords[:, start : start + 21] = xy[:, indices]
        mask[:, start : start + 21] = detected[:, indices]
    for j, pose in enumerate(pose_order):
        if pose is not None:
            coords[:, 42 + j] = xy[:, pose]
            mask[:, 42 + j] = detected[:, pose] & (features[:, pose, 3] >= 0.5)
    mask[:, 43] = mask[:, 48] & mask[:, 49]
    coords[:, 43] = (coords[:, 48] + coords[:, 49]) / 2
    coords[:, :, 1] = 1 - coords[:, :, 1]
    mask &= valid[:, None] & np.isfinite(coords).all(axis=-1)
    coords[~mask] = 0
    if not mask.any():
        raise ValueError("No landmarks detected")
    coords, mask, _ = runtime.sampling.temporal_sample(
        coords, mask, runtime.cfg["frames"]
    )
    return runtime.adapter.normalize(coords, mask)
