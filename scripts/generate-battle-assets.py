#!/usr/bin/env python3
"""Build compact, body-only battle sheets from the curated mushroom cutouts.

The arena deliberately uses its own 256 px frames instead of scaling the 512 px
stage sheets (which include foreground grass).  This keeps both combatants on the
same ground plane and gives every opponent a stable visual identity.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "assets/source/imagegen/cutouts/states/idle"
OUTPUT_ROOT = ROOT / "assets/battle"
FRAME_SIZE = 256
POSES = ("idle", "attack", "guard", "hurt")


@dataclass(frozen=True)
class FighterSpec:
    key: str
    source_stage: str
    cap_dark: tuple[int, int, int]
    cap_light: tuple[int, int, int]
    accessory: str
    body_scale: float = 0.84


FIGHTERS = (
    FighterSpec(
        key="player_legendary",
        source_stage="legendary",
        cap_dark=(160, 102, 58),
        cap_light=(255, 236, 174),
        accessory="player",
        body_scale=0.86,
    ),
    FighterSpec(
        key="sproutling",
        source_stage="young",
        cap_dark=(54, 104, 50),
        cap_light=(187, 220, 105),
        accessory="sprout",
        body_scale=0.76,
    ),
    FighterSpec(
        key="windcap",
        source_stage="adult",
        cap_dark=(55, 75, 119),
        cap_light=(155, 202, 205),
        accessory="wind",
        body_scale=0.82,
    ),
    FighterSpec(
        key="eldercap",
        source_stage="legendary",
        cap_dark=(83, 73, 47),
        cap_light=(195, 171, 103),
        accessory="elder",
        body_scale=0.86,
    ),
)


def remove_connected_magenta(image: Image.Image) -> Image.Image:
    """Remove the flat imagegen matte without eating intentional interior color."""
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    pending = []
    seen: set[tuple[int, int]] = set()

    def is_key(x: int, y: int) -> bool:
        red, green, blue, alpha = pixels[x, y]
        return alpha > 0 and red >= 205 and blue >= 190 and green <= 85

    for x in range(width):
        pending.extend(((x, 0), (x, height - 1)))
    for y in range(height):
        pending.extend(((0, y), (width - 1, y)))

    while pending:
        x, y = pending.pop()
        if x < 0 or y < 0 or x >= width or y >= height or (x, y) in seen:
            continue
        seen.add((x, y))
        if not is_key(x, y):
            continue
        pixels[x, y] = (0, 0, 0, 0)
        pending.extend(((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)))

    # Despill the one-pixel antialiased fringe adjacent to transparency.
    original = rgba.copy()
    original_pixels = original.load()
    for y in range(height):
        for x in range(width):
            red, green, blue, alpha = original_pixels[x, y]
            if alpha == 0:
                pixels[x, y] = (0, 0, 0, 0)
                continue
            touches_alpha = any(
                0 <= nx < width
                and 0 <= ny < height
                and original_pixels[nx, ny][3] == 0
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))
            )
            if touches_alpha and red > green * 1.45 and blue > green * 1.35:
                neutral = max(green, min(red, blue) // 2)
                pixels[x, y] = (neutral, green, neutral, alpha)

    return rgba


def recolor_cap(image: Image.Image, spec: FighterSpec) -> Image.Image:
    if spec.accessory == "player":
        return image
    result = image.copy()
    pixels = result.load()
    width, height = result.size
    cap_bottom = int(height * 0.47)
    dark = spec.cap_dark
    light = spec.cap_light

    for y in range(cap_bottom):
        for x in range(width):
            red, green, blue, alpha = pixels[x, y]
            if alpha == 0:
                continue
            luminance = (red * 54 + green * 183 + blue * 19) / 65280
            amount = max(0.0, min(1.0, luminance))
            # Preserve near-black outline pixels for a shared sprite language.
            if red + green + blue < 125:
                continue
            pixels[x, y] = (
                round(dark[0] + (light[0] - dark[0]) * amount),
                round(dark[1] + (light[1] - dark[1]) * amount),
                round(dark[2] + (light[2] - dark[2]) * amount),
                alpha,
            )
    return result


def fit_character(image: Image.Image, scale: float) -> Image.Image:
    bbox = image.getbbox()
    if not bbox:
        raise ValueError("Empty fighter cutout")
    cropped = image.crop(bbox)
    target = round(FRAME_SIZE * scale)
    ratio = min(target / cropped.width, target / cropped.height)
    size = (max(1, round(cropped.width * ratio)), max(1, round(cropped.height * ratio)))
    return cropped.resize(size, Image.Resampling.NEAREST)


def pose_character(base: Image.Image, pose: str) -> Image.Image:
    if pose == "attack":
        posed = base.rotate(-2.0, resample=Image.Resampling.NEAREST, expand=True)
        posed = posed.resize((round(posed.width * 1.03), round(posed.height * 0.99)), Image.Resampling.NEAREST)
    elif pose == "guard":
        posed = base.resize((round(base.width * 1.04), round(base.height * 0.94)), Image.Resampling.NEAREST)
    elif pose == "hurt":
        posed = base.rotate(3.0, resample=Image.Resampling.NEAREST, expand=True)
        posed = ImageEnhance.Color(posed).enhance(0.78)
    else:
        posed = base.copy()
    return posed


def draw_accessory(canvas: Image.Image, spec: FighterSpec, pose: str, anchor_x: int, anchor_y: int) -> None:
    draw = ImageDraw.Draw(canvas)
    if spec.accessory == "sprout":
        top = anchor_y + 10
        center = FRAME_SIZE // 2
        draw.rectangle((center - 2, top, center + 2, top + 18), fill=(42, 91, 47, 255))
        draw.rectangle((center - 12, top + 2, center - 2, top + 7), fill=(102, 165, 69, 255))
        draw.rectangle((center + 2, top - 1, center + 13, top + 5), fill=(143, 192, 75, 255))
    elif spec.accessory == "wind":
        y = anchor_y + round(FRAME_SIZE * 0.58)
        tail = 24 if pose == "attack" else 18
        draw.polygon(
            ((anchor_x + 12, y), (anchor_x + 12 + tail, y - 5), (anchor_x + 8 + tail, y + 4), (anchor_x + 12, y + 7)),
            fill=(68, 91, 143, 255),
        )
        draw.rectangle((anchor_x + 12, y, anchor_x + 18, y + 6), fill=(40, 55, 96, 255))
    elif spec.accessory == "elder":
        x = anchor_x + 5
        y = anchor_y + 33
        draw.rectangle((x, y, x + 5, y + 91), fill=(76, 54, 37, 255))
        draw.rectangle((x - 3, y, x + 8, y + 7), fill=(111, 79, 46, 255))
        draw.rectangle((x + 2, y + 18, x + 7, y + 24), fill=(84, 125, 61, 255))


def add_pose_feedback(canvas: Image.Image, pose: str, facing_right: bool) -> None:
    draw = ImageDraw.Draw(canvas)
    if pose == "guard":
        center_x = 186 if facing_right else 70
        draw.rectangle((center_x - 8, 156, center_x + 8, 184), fill=(98, 137, 77, 220))
        draw.rectangle((center_x - 12, 162, center_x + 12, 178), fill=(132, 169, 92, 220))
        draw.rectangle((center_x - 5, 160, center_x + 5, 180), fill=(190, 208, 132, 210))
    elif pose == "hurt":
        center_x = 194 if facing_right else 62
        draw.rectangle((center_x - 2, 72, center_x + 2, 94), fill=(218, 91, 82, 230))
        draw.rectangle((center_x - 8, 78, center_x + 8, 84), fill=(218, 91, 82, 230))


def build_frame(base: Image.Image, spec: FighterSpec, pose: str) -> Image.Image:
    canvas = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    posed = pose_character(base, pose)
    x_shift = 7 if pose == "attack" else -4 if pose == "hurt" else 0
    bottom = 242 if pose != "guard" else 244
    x = (FRAME_SIZE - posed.width) // 2 + x_shift
    y = bottom - posed.height
    canvas.alpha_composite(posed, (x, y))
    draw_accessory(canvas, spec, pose, x, y)
    add_pose_feedback(canvas, pose, facing_right=True)
    return canvas


def build_sheet(spec: FighterSpec) -> Image.Image:
    source = SOURCE_ROOT / f"{spec.source_stage}.png"
    if not source.exists():
        raise FileNotFoundError(source)
    cutout = remove_connected_magenta(Image.open(source))
    cutout = recolor_cap(cutout, spec)
    fitted = fit_character(cutout, spec.body_scale)
    sheet = Image.new("RGBA", (FRAME_SIZE * len(POSES), FRAME_SIZE), (0, 0, 0, 0))
    for index, pose in enumerate(POSES):
        sheet.alpha_composite(build_frame(fitted, spec, pose), (index * FRAME_SIZE, 0))
    return sheet


def assert_clean_alpha(image: Image.Image) -> None:
    raw = image.tobytes()
    for index in range(0, len(raw), 4):
        red, green, blue, alpha = raw[index:index + 4]
        if alpha == 0 and (red or green or blue):
            raise AssertionError("Transparent battle pixels must have RGB=0")


def build_arena_background() -> Image.Image:
    image = Image.new("RGBA", (512, 512), (202, 226, 174, 255))
    draw = ImageDraw.Draw(image)

    # Blocky distant forest and stands; all coordinates sit on a 4 px grid.
    draw.rectangle((0, 0, 511, 180), fill=(190, 220, 189, 255))
    draw.rectangle((0, 180, 511, 292), fill=(151, 184, 126, 255))
    for index, x in enumerate(range(-24, 544, 52)):
        height = 38 + (index % 3) * 12
        draw.rectangle((x + 20, 174 - height, x + 28, 190), fill=(76, 104, 69, 255))
        draw.rectangle((x, 172 - height, x + 48, 180 - height), fill=(96, 132, 77, 255))
        draw.rectangle((x + 8, 160 - height, x + 40, 176 - height), fill=(116, 154, 85, 255))
    draw.rectangle((28, 194, 484, 286), fill=(221, 207, 151, 255))
    draw.rectangle((40, 206, 472, 274), fill=(183, 154, 105, 255))
    for y in (214, 238, 262):
        draw.rectangle((48, y, 464, y + 8), fill=(238, 223, 169, 255))
        for x in range(56, 456, 24):
            color = (103, 82, 61, 255) if (x // 24 + y // 8) % 2 else (126, 99, 70, 255)
            draw.rectangle((x, y - 4, x + 8, y + 4), fill=color)

    # Single shared fighting plane, with no baked character grass islands.
    draw.rectangle((0, 286, 511, 511), fill=(103, 137, 72, 255))
    draw.rectangle((20, 306, 491, 475), fill=(72, 96, 58, 255))
    draw.rectangle((28, 314, 483, 467), fill=(155, 166, 94, 255))
    draw.rectangle((40, 326, 471, 455), fill=(190, 184, 116, 255))
    draw.rectangle((48, 334, 463, 447), fill=(181, 175, 109, 255))
    draw.rectangle((252, 334, 259, 447), fill=(137, 130, 84, 255))
    draw.rectangle((48, 386, 463, 393), fill=(137, 130, 84, 255))

    # Mossy edge pixels root the arena in the same forest palette as care mode.
    for x in range(20, 492, 16):
        blade = 8 + ((x * 13) % 16)
        draw.rectangle((x, 306 - blade, x + 3, 306), fill=(70, 118, 61, 255))
        if x % 32 == 4:
            draw.rectangle((x + 4, 300 - blade // 2, x + 8, 306), fill=(103, 148, 70, 255))
    draw.rectangle((0, 484, 511, 511), fill=(64, 91, 56, 255))
    return image


def output_path(spec: FighterSpec) -> Path:
    if spec.key == "player_legendary":
        return OUTPUT_ROOT / "player_legendary_sheet.png"
    return OUTPUT_ROOT / "opponents" / f"{spec.key}_sheet.png"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify generated outputs without rewriting them")
    args = parser.parse_args()

    for spec in FIGHTERS:
        generated = build_sheet(spec)
        assert_clean_alpha(generated)
        destination = output_path(spec)
        if args.check:
            if not destination.exists():
                raise SystemExit(f"Missing battle asset: {destination.relative_to(ROOT)}")
            existing = Image.open(destination).convert("RGBA")
            if existing.size != generated.size or existing.tobytes() != generated.tobytes():
                raise SystemExit(f"Stale battle asset: {destination.relative_to(ROOT)}")
            continue
        destination.parent.mkdir(parents=True, exist_ok=True)
        generated.save(destination, optimize=True)
        print(f"Wrote {destination.relative_to(ROOT)} ({generated.width}x{generated.height})")

    arena = build_arena_background()
    arena_destination = OUTPUT_ROOT / "arena_background.png"
    if args.check:
        if not arena_destination.exists():
            raise SystemExit(f"Missing battle asset: {arena_destination.relative_to(ROOT)}")
        existing_arena = Image.open(arena_destination).convert("RGBA")
        if existing_arena.size != arena.size or existing_arena.tobytes() != arena.tobytes():
            raise SystemExit(f"Stale battle asset: {arena_destination.relative_to(ROOT)}")
    else:
        arena_destination.parent.mkdir(parents=True, exist_ok=True)
        arena.save(arena_destination, optimize=True)
        print(f"Wrote {arena_destination.relative_to(ROOT)} ({arena.width}x{arena.height})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
