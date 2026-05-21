#!/usr/bin/env python3
"""Build stage-specific instrument activity variants from the restored base sheets."""

from __future__ import annotations

from pathlib import Path
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ACTIVITY_DIR = ROOT / "assets" / "activities"
STAGES = ["spore", "baby", "young", "adult", "legendary"]
VARIANTS = ["instrument_bell", "instrument_flute", "instrument_drum", "instrument_rare"]
FRAME_SIZE = 512
FRAME_COUNT = 8


def main() -> None:
    for stage in STAGES:
        source = ACTIVITY_DIR / stage / "instrument_sheet.png"
        image = Image.open(source).convert("RGBA")
        if image.size != (FRAME_SIZE * FRAME_COUNT, FRAME_SIZE):
            raise SystemExit(f"{source} has unexpected size {image.size}")

        for variant in VARIANTS:
            frames = []
            for frame_index in range(FRAME_COUNT):
                frame = image.crop((frame_index * FRAME_SIZE, 0, (frame_index + 1) * FRAME_SIZE, FRAME_SIZE))
                draw_variant(frame, stage, variant, frame_index)
                frames.append(frame)
            save_sheet(ACTIVITY_DIR / stage / f"{variant}_sheet.png", frames)


def save_sheet(path: Path, frames: list[Image.Image]) -> None:
    sheet = Image.new("RGBA", (FRAME_SIZE * len(frames), FRAME_SIZE), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        sheet.alpha_composite(frame, (index * FRAME_SIZE, 0))
    sheet.save(path)


def draw_variant(frame: Image.Image, stage: str, variant: str, frame_index: int) -> None:
    # The source instrument sheet already owns the instrument, notes, and facial
    # expression. These variant files keep runtime selection/log contracts
    # without stacking an extra generated prop over the face.
    return


if __name__ == "__main__":
    main()
