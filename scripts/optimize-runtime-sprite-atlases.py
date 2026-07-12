#!/usr/bin/env python3
"""Crop transparent margins from runtime sprite atlases and emit draw metadata.

Run after ``build-imagegen-sprites.py``.  Every logical frame keeps its original
512x512 coordinate system through ``drawX``/``drawY`` metadata, while the PNG
stores only the shared alpha union needed by all frames in that sheet.
"""

from __future__ import annotations

import argparse
import json
import math
import re
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
LAYOUT_FILE = ROOT / "SpriteLayout.gs"
FRAME_SIZE = 512
DIRECTORIES = ("stages", "activities", "easter-eggs", "effects")
LAYOUT_PATTERN = re.compile(
    r"// BEGIN GENERATED SPRITE LAYOUTS\nconst PIECZARGOTCHI_SPRITE_LAYOUTS = Object\.freeze\((\{.*\})\);\n// END GENERATED SPRITE LAYOUTS",
    re.DOTALL,
)


def runtime_sheets() -> list[Path]:
    return sorted(
        path
        for directory in DIRECTORIES
        for path in (ASSETS / directory).rglob("*.png")
    )


def normalize_asset_path(path: Path) -> str:
    return path.relative_to(ASSETS).as_posix()


def snap_down(value: int, step: int = 2) -> int:
    return max(0, value // step * step)


def snap_up(value: int, step: int = 2) -> int:
    return min(FRAME_SIZE, math.ceil(value / step) * step)


def frame_union_bbox(sheet: Image.Image, frame_count: int) -> tuple[int, int, int, int]:
    boxes: list[tuple[int, int, int, int]] = []
    for index in range(frame_count):
        frame = sheet.crop((index * FRAME_SIZE, 0, (index + 1) * FRAME_SIZE, FRAME_SIZE))
        bbox = frame.getchannel("A").getbbox()
        if bbox:
            boxes.append(bbox)
    if not boxes:
        raise ValueError("sprite sheet has no visible frame")

    left = snap_down(max(0, min(box[0] for box in boxes) - 2))
    top = snap_down(max(0, min(box[1] for box in boxes) - 2))
    right = snap_up(min(FRAME_SIZE, max(box[2] for box in boxes) + 2))
    bottom = snap_up(min(FRAME_SIZE, max(box[3] for box in boxes) + 2))
    if right <= left or bottom <= top:
        raise ValueError("sprite crop is empty")
    return left, top, right, bottom


def deduplicate_frames(frames: list[Image.Image]) -> tuple[list[Image.Image], list[int]]:
    unique: list[Image.Image] = []
    indexes: dict[bytes, int] = {}
    sequence: list[int] = []
    for frame in frames:
        signature = frame.tobytes()
        stored_index = indexes.get(signature)
        if stored_index is None:
            stored_index = len(unique)
            indexes[signature] = stored_index
            unique.append(frame)
        sequence.append(stored_index)
    return unique, sequence


def sanitize_bright_edge_chroma(image: Image.Image) -> Image.Image:
    """Remove only bright chroma-core pixels touching transparent alpha."""
    result = image.convert("RGBA").copy()
    red, green, blue, alpha = result.split()
    alpha_edge = alpha.point(lambda value: 255 if value <= 8 else 0).filter(ImageFilter.MaxFilter(7))
    mask = ImageChops.darker(alpha_edge, red.point(lambda value: 255 if value >= 230 else 0))
    for constraint in (
        blue.point(lambda value: 255 if value >= 230 else 0),
        green.point(lambda value: 255 if value <= 90 else 0),
        ImageChops.difference(red, blue).point(lambda value: 255 if value <= 60 else 0),
        alpha.point(lambda value: 255 if value > 8 else 0),
    ):
        mask = ImageChops.darker(mask, constraint)

    bbox = mask.getbbox()
    if bbox:
        pixels = result.load()
        mask_pixels = mask.load()
        for y in range(bbox[1], bbox[3]):
            for x in range(bbox[0], bbox[2]):
                if not mask_pixels[x, y]:
                    continue
                r, g, b, a = pixels[x, y]
                spill = min(r, b) - max(g + 24, 0)
                reduction = round(max(0, spill) * 0.82)
                pixels[x, y] = (max(0, r - reduction), g, max(0, b - reduction), a)

    transparent = alpha.point(lambda value: 255 if value == 0 else 0)
    if transparent.getbbox():
        result.paste((0, 0, 0, 0), mask=transparent)
    return result


def optimize_sheet(path: Path) -> dict[str, int | bool | list[int]]:
    source = Image.open(path).convert("RGBA")
    if source.height != FRAME_SIZE or source.width % FRAME_SIZE:
        raise ValueError(f"{normalize_asset_path(path)} must be rebuilt as 512px frames before optimization")
    frame_count = source.width // FRAME_SIZE
    left, top, right, bottom = frame_union_bbox(source, frame_count)
    frame_width = right - left
    frame_height = bottom - top
    cropped_frames: list[Image.Image] = []
    for index in range(frame_count):
        frame = source.crop((index * FRAME_SIZE + left, top, index * FRAME_SIZE + right, bottom))
        frame = sanitize_bright_edge_chroma(frame)
        cropped_frames.append(frame)
    stored_frames, frame_sequence = deduplicate_frames(cropped_frames)
    optimized = Image.new("RGBA", (frame_width * len(stored_frames), frame_height), (0, 0, 0, 0))
    for index, frame in enumerate(stored_frames):
        optimized.alpha_composite(frame, (index * frame_width, 0))
    optimized.save(path, optimize=True)
    return {
        "frameWidth": frame_width,
        "frameHeight": frame_height,
        "drawX": left,
        "drawY": top,
        "frameCount": frame_count,
        "storedFrameCount": len(stored_frames),
        "frameSequence": frame_sequence,
        "bakedGrass": False,
    }


def render_layout_file(layouts: dict[str, dict[str, int | bool | list[int]]]) -> str:
    encoded = json.dumps(layouts, ensure_ascii=False, sort_keys=True, indent=2)
    return "\n".join(
        [
            "// Wygenerowano przez scripts/optimize-runtime-sprite-atlases.py.",
            "// Nie edytuj ręcznie: metadata zachowuje oryginalny układ współrzędnych 512x512.",
            "// BEGIN GENERATED SPRITE LAYOUTS",
            f"const PIECZARGOTCHI_SPRITE_LAYOUTS = Object.freeze({encoded});",
            "// END GENERATED SPRITE LAYOUTS",
            "",
        ]
    )


def read_layouts() -> dict[str, dict[str, int | bool | list[int]]]:
    if not LAYOUT_FILE.exists():
        raise FileNotFoundError(LAYOUT_FILE)
    match = LAYOUT_PATTERN.search(LAYOUT_FILE.read_text(encoding="utf-8"))
    if not match:
        raise ValueError("SpriteLayout.gs does not contain a generated layout block")
    return json.loads(match.group(1))


def check_outputs() -> None:
    layouts = read_layouts()
    paths = runtime_sheets()
    expected_paths = {normalize_asset_path(path) for path in paths}
    if set(layouts) != expected_paths:
        missing = sorted(expected_paths - set(layouts))
        stale = sorted(set(layouts) - expected_paths)
        raise SystemExit(f"Sprite layout coverage mismatch; missing={missing[:5]}, stale={stale[:5]}")

    decoded_bytes = 0
    logical_frames = 0
    stored_frames = 0
    for path in paths:
        key = normalize_asset_path(path)
        layout = layouts[key]
        image = Image.open(path).convert("RGBA")
        logical_count = int(layout["frameCount"])
        stored_count = int(layout.get("storedFrameCount", logical_count))
        expected_size = (
            int(layout["frameWidth"]) * stored_count,
            int(layout["frameHeight"]),
        )
        if image.size != expected_size:
            raise SystemExit(f"Stale sprite layout for {key}: PNG={image.size}, metadata={expected_size}")
        if image.getchannel("A").getbbox() is None:
            raise SystemExit(f"Empty optimized sprite: {key}")
        sequence = [int(index) for index in layout.get("frameSequence", range(logical_count))]
        if len(sequence) != logical_count or any(index < 0 or index >= stored_count for index in sequence):
            raise SystemExit(f"Invalid frameSequence for {key}")
        logical_frames += logical_count
        stored_frames += stored_count
        decoded_bytes += image.width * image.height * 4
    saved_ratio = 1 - stored_frames / logical_frames if logical_frames else 0
    print(
        f"Tight sprite atlases OK: {len(paths)} PNG, decoded={decoded_bytes / (1024 * 1024):.1f} MiB, "
        f"stored={stored_frames}/{logical_frames} frames ({saved_ratio:.1%} deduplicated)."
    )


def dedupe_current_atlases() -> None:
    layouts = read_layouts()
    before_bytes = 0
    after_bytes = 0
    for path in runtime_sheets():
        key = normalize_asset_path(path)
        layout = layouts.get(key)
        if not layout:
            raise SystemExit(f"Missing layout for {key}; run the normal optimizer first")
        image = Image.open(path).convert("RGBA")
        frame_width = int(layout["frameWidth"])
        frame_height = int(layout["frameHeight"])
        logical_count = int(layout["frameCount"])
        old_stored_count = int(layout.get("storedFrameCount", logical_count))
        old_sequence = [int(index) for index in layout.get("frameSequence", range(logical_count))]
        if image.size != (frame_width * old_stored_count, frame_height):
            raise SystemExit(f"Stale current atlas for {key}: {image.size}")
        physical_frames = [
            sanitize_bright_edge_chroma(
                image.crop((index * frame_width, 0, (index + 1) * frame_width, frame_height))
            )
            for index in range(old_stored_count)
        ]
        unique_frames, physical_sequence = deduplicate_frames(physical_frames)
        logical_sequence = [physical_sequence[index] for index in old_sequence]
        optimized = Image.new("RGBA", (frame_width * len(unique_frames), frame_height), (0, 0, 0, 0))
        for index, frame in enumerate(unique_frames):
            optimized.alpha_composite(frame, (index * frame_width, 0))
        optimized.save(path, optimize=True)
        layout["storedFrameCount"] = len(unique_frames)
        layout["frameSequence"] = logical_sequence
        before_bytes += image.width * image.height * 4
        after_bytes += optimized.width * optimized.height * 4
    LAYOUT_FILE.write_text(render_layout_file(layouts), encoding="utf-8")
    print(
        f"Deduplicated current tight atlases: decoded "
        f"{before_bytes / (1024 * 1024):.1f} -> {after_bytes / (1024 * 1024):.1f} MiB."
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="verify current PNG dimensions against SpriteLayout.gs")
    parser.add_argument("--dedupe-current", action="store_true", help="deduplicate already cropped atlases")
    parser.add_argument("--asset", help="optimize one rebuilt sheet path relative to assets/")
    args = parser.parse_args()
    if args.check:
        check_outputs()
        return 0
    if args.dedupe_current:
        dedupe_current_atlases()
        return 0
    if args.asset:
        path = (ASSETS / args.asset).resolve()
        if ASSETS.resolve() not in path.parents or path not in runtime_sheets():
            raise SystemExit(f"Unsupported runtime sheet: {args.asset}")
        layouts = read_layouts()
        layouts[normalize_asset_path(path)] = optimize_sheet(path)
        LAYOUT_FILE.write_text(render_layout_file(layouts), encoding="utf-8")
        print(f"Optimized one sprite atlas: {normalize_asset_path(path)}.")
        return 0

    layouts: dict[str, dict[str, int | bool | list[int]]] = {}
    before_bytes = 0
    after_bytes = 0
    paths = runtime_sheets()
    for path in paths:
        source = Image.open(path)
        before_bytes += source.width * source.height * 4
        layout = optimize_sheet(path)
        layouts[normalize_asset_path(path)] = layout
        after_bytes += int(layout["frameWidth"]) * int(layout["frameHeight"]) * int(layout["storedFrameCount"]) * 4
    LAYOUT_FILE.write_text(render_layout_file(layouts), encoding="utf-8")
    print(
        f"Optimized {len(paths)} sprite atlases: "
        f"decoded {before_bytes / (1024 * 1024):.1f} -> {after_bytes / (1024 * 1024):.1f} MiB."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
