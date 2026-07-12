#!/usr/bin/env python3
"""Audit sparkle sprites so excellent/sun glints stay animated and non-plus-shaped."""

from __future__ import annotations

import hashlib
import importlib.util
from pathlib import Path

from PIL import Image
from PIL import ImageChops
from PIL import ImageDraw

from sprite_layout import load_canvas_frames


ROOT = Path(__file__).resolve().parents[1]
BUILDER_PATH = ROOT / "scripts" / "build-imagegen-sprites.py"
STAGES_DIR = ROOT / "assets" / "stages"
EXCELLENT_CUTOUT_DIR = ROOT / "assets" / "source" / "imagegen" / "cutouts" / "states" / "excellent"
STAGES = ["spore", "baby", "young", "adult", "legendary"]
FRAME = 512
EXPECTED_SHEET_SIZE = (FRAME * 4, FRAME)
MAX_EXCELLENT_OVERLAY_PIXELS = 420
MIN_EXCELLENT_OVERLAY_PIXELS = 10


def main() -> None:
    builder = load_builder()
    grass = builder.przygotuj_warstwe_trawy()
    body_bottom_targets = builder.policz_docelowe_doly_korpusu(grass)
    failures: list[str] = []

    for stage in STAGES:
        audit_clean_excellent_cutout(stage, failures)
        audit_excellent_sheet(stage, builder, grass, body_bottom_targets, failures)
        audit_immersion_sheet(stage, "sun", failures)
        audit_immersion_sheet(stage, "stargaze", failures)

    if failures:
        print("\nGlint audit found problems:")
        for failure in failures:
            print(f"- {failure}")
        raise SystemExit(1)

    print("\nGlint audit OK: excellent twinkles animate and sun/stargaze glints avoid plus-shaped sprites.")


def load_builder():
    spec = importlib.util.spec_from_file_location("pieczargotchi_sprite_builder", BUILDER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load builder: {BUILDER_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def audit_clean_excellent_cutout(stage: str, failures: list[str]) -> None:
    path = EXCELLENT_CUTOUT_DIR / f"{stage}.png"
    image = Image.open(path).convert("RGBA")
    components = count_alpha_components(image)
    if components != 1:
        failures.append(f"{path}: expected one alpha component after static sparkle cleanup, got {components}")


def audit_excellent_sheet(stage: str, builder, grass: Image.Image, body_bottom_targets: dict[str, int], failures: list[str]) -> None:
    sheet_path = STAGES_DIR / stage / "excellent_sheet.png"
    frames = load_sheet(sheet_path, failures)
    cutout = Image.open(EXCELLENT_CUTOUT_DIR / f"{stage}.png").convert("RGBA")
    hashes: set[str] = set()

    for index, frame in enumerate(frames):
        baseline = builder.zloz_klatke_z_trawa(
            cutout,
            grass,
            stage,
            builder.STATE_OFFSETS["excellent"][index],
            None,
            body_bottom_targets,
        )
        overlay = ImageChops.difference(frame, baseline).convert("RGBA")
        overlay_pixels = count_nonempty_pixels(overlay)
        hashes.add(hashlib.sha1(overlay.tobytes()).hexdigest())

        if overlay_pixels < MIN_EXCELLENT_OVERLAY_PIXELS:
            failures.append(f"{sheet_path}: frame {index + 1} has too few animated twinkle pixels ({overlay_pixels})")
        if overlay_pixels > MAX_EXCELLENT_OVERLAY_PIXELS:
            failures.append(f"{sheet_path}: frame {index + 1} has too many animated twinkle pixels ({overlay_pixels})")

        pluses = count_cardinal_plus_glints(overlay)
        if pluses:
            failures.append(f"{sheet_path}: frame {index + 1} has {pluses} plus-shaped twinkle components")

    if len(hashes) < 3:
        failures.append(f"{sheet_path}: twinkle overlay is not varied enough across frames")


def audit_immersion_sheet(stage: str, state: str, failures: list[str]) -> None:
    sheet_path = STAGES_DIR / stage / f"{state}_sheet.png"
    frames = load_sheet(sheet_path, failures)
    source_state = "excellent" if state == "sun" else "idle"
    source_frames = load_sheet(STAGES_DIR / stage / f"{source_state}_sheet.png", failures)

    for index, frame in enumerate(frames):
        baseline = build_immersion_baseline(source_frames[index], state)
        overlay = ImageChops.difference(frame, baseline).convert("RGBA")
        pluses = count_cardinal_plus_glints(overlay)
        if pluses:
            failures.append(f"{sheet_path}: frame {index + 1} has {pluses} plus-shaped glint components")


def build_immersion_baseline(source_frame: Image.Image, state: str) -> Image.Image:
    if state == "sun":
        baseline = apply_alpha_tint(source_frame, (255, 229, 150, 32))
        draw = ImageDraw.Draw(baseline)
        draw.rectangle((178, 420, 334, 427), fill=(255, 229, 150, 78))
        return baseline

    if state == "stargaze":
        return apply_alpha_tint(source_frame, (48, 64, 110, 28))

    return source_frame.copy()


def apply_alpha_tint(frame: Image.Image, color: tuple[int, int, int, int]) -> Image.Image:
    overlay = Image.new("RGBA", frame.size, color)
    mask = frame.getchannel("A").point(lambda value: round(value * color[3] / 255))
    result = frame.copy()
    result.alpha_composite(Image.composite(overlay, Image.new("RGBA", frame.size, (0, 0, 0, 0)), mask))
    return result


def load_sheet(path: Path, failures: list[str]) -> list[Image.Image]:
    try:
        frames = load_canvas_frames(path)
    except ValueError as error:
        failures.append(str(error))
        return []
    if len(frames) != 4:
        failures.append(f"{path}: expected 4 frames, got {len(frames)}")
        return []
    return frames


def count_alpha_components(image: Image.Image) -> int:
    alpha = image.getchannel("A")
    pixels = alpha.load()
    points = {
        (x, y)
        for y in range(image.height)
        for x in range(image.width)
        if pixels[x, y] > 8
    }
    return sum(1 for component in connected_components(points) if len(component) >= 24)


def count_nonempty_pixels(image: Image.Image) -> int:
    pixels = image.load()
    total = 0
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            if a > 8 or r > 8 or g > 8 or b > 8:
                total += 1
    return total


def count_cardinal_plus_glints(image: Image.Image) -> int:
    pixels = image.load()
    points: set[tuple[int, int]] = set()

    for y in range(image.height):
        for x in range(image.width):
            if is_glint_pixel(pixels[x, y]):
                points.add((x, y))

    pluses = 0
    for component in connected_components(points):
        if is_cardinal_plus_component(component):
            pluses += 1
    return pluses


def is_glint_pixel(pixel: tuple[int, int, int, int]) -> bool:
    r, g, b, a = pixel
    return a >= 28 and r >= 232 and g >= 145 and b <= 232 and r - b >= 12


def is_cardinal_plus_component(component: list[tuple[int, int]]) -> bool:
    if len(component) < 18 or len(component) > 260:
        return False

    xs = [point[0] for point in component]
    ys = [point[1] for point in component]
    width = max(xs) - min(xs) + 1
    height = max(ys) - min(ys) + 1
    if width < 10 or height < 10 or width > 34 or height > 34:
        return False

    points = set(component)
    center_x = round((min(xs) + max(xs)) / 2)
    center_y = round((min(ys) + max(ys)) / 2)
    horizontal = has_axis_arm(points, center_x, center_y, "x", -1) and has_axis_arm(points, center_x, center_y, "x", 1)
    vertical = has_axis_arm(points, center_x, center_y, "y", -1) and has_axis_arm(points, center_x, center_y, "y", 1)
    return horizontal and vertical


def has_axis_arm(points: set[tuple[int, int]], center_x: int, center_y: int, axis: str, direction: int) -> bool:
    for distance in range(4, 11):
        for drift in (-1, 0, 1):
            point = (
                center_x + direction * distance,
                center_y + drift,
            ) if axis == "x" else (
                center_x + drift,
                center_y + direction * distance,
            )
            if point in points:
                return True
    return False


def connected_components(points: set[tuple[int, int]]) -> list[list[tuple[int, int]]]:
    remaining = set(points)
    components: list[list[tuple[int, int]]] = []

    while remaining:
        start = remaining.pop()
        stack = [start]
        component = [start]

        while stack:
            x, y = stack.pop()
            for next_x, next_y in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                point = (next_x, next_y)
                if point not in remaining:
                    continue
                remaining.remove(point)
                stack.append(point)
                component.append(point)

        components.append(component)

    return components


if __name__ == "__main__":
    main()
