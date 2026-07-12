"""Shared reconstruction helpers for tight runtime sprite atlases."""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
LAYOUT_FILE = ROOT / "SpriteLayout.gs"
FRAME_SIZE = 512
LAYOUT_PATTERN = re.compile(
    r"// BEGIN GENERATED SPRITE LAYOUTS\nconst PIECZARGOTCHI_SPRITE_LAYOUTS = Object\.freeze\((\{.*\})\);\n// END GENERATED SPRITE LAYOUTS",
    re.DOTALL,
)


@lru_cache(maxsize=1)
def load_sprite_layouts() -> dict[str, dict[str, int | bool]]:
    if not LAYOUT_FILE.exists():
        return {}
    match = LAYOUT_PATTERN.search(LAYOUT_FILE.read_text(encoding="utf-8"))
    return json.loads(match.group(1)) if match else {}


def asset_key(path: Path) -> str | None:
    try:
        return path.resolve().relative_to(ASSETS.resolve()).as_posix()
    except ValueError:
        return None


def load_canvas_frames(path: Path) -> list[Image.Image]:
    image = Image.open(path).convert("RGBA")
    layout = load_sprite_layouts().get(asset_key(path))
    if layout:
        frame_width = int(layout["frameWidth"])
        frame_height = int(layout["frameHeight"])
        frame_count = int(layout["frameCount"])
        stored_frame_count = int(layout.get("storedFrameCount", frame_count))
        frame_sequence = [int(index) for index in layout.get("frameSequence", range(frame_count))]
        draw_x = int(layout["drawX"])
        draw_y = int(layout["drawY"])
        expected = (frame_width * stored_frame_count, frame_height)
        if image.size != expected:
            raise ValueError(f"{path}: tight atlas {image.size} does not match metadata {expected}")
    else:
        if image.height != FRAME_SIZE or image.width % FRAME_SIZE:
            raise ValueError(f"{path}: missing tight-atlas metadata for {image.size}")
        frame_width = FRAME_SIZE
        frame_height = FRAME_SIZE
        frame_count = image.width // FRAME_SIZE
        stored_frame_count = frame_count
        frame_sequence = list(range(frame_count))
        draw_x = 0
        draw_y = 0

    frames: list[Image.Image] = []
    for index in range(frame_count):
        stored_index = frame_sequence[index]
        stored = image.crop((stored_index * frame_width, 0, (stored_index + 1) * frame_width, frame_height))
        canvas = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
        canvas.alpha_composite(stored, (draw_x, draw_y))
        frames.append(canvas)
    return frames


def load_canvas_sheet(path: Path) -> Image.Image:
    frames = load_canvas_frames(path)
    sheet = Image.new("RGBA", (FRAME_SIZE * len(frames), FRAME_SIZE), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        sheet.alpha_composite(frame, (index * FRAME_SIZE, 0))
    return sheet
