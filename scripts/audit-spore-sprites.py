#!/usr/bin/env python3
"""Audytuje rozmiar, drift i artefakty sprite'ow zarodka."""

from __future__ import annotations

import importlib.util
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
BUILDER_PATH = ROOT / "scripts" / "build-imagegen-sprites.py"
STAGES_DIR = ROOT / "assets" / "stages" / "spore"
ACTIVITIES_DIR = ROOT / "assets" / "activities" / "spore"
FRAME = 512
MAX_BODY_HEIGHT_DELTA = 28
MAX_BODY_CENTER_DELTA = 24
MAX_FRAME_DRIFT = 18
MAX_MAGENTA_EDGE_PIXELS = 220
MAX_CENTER_LEAF_PIXELS = 90


def main() -> None:
    builder = load_builder()
    sheets = [
        *[(f"state.{path.stem.removesuffix('_sheet')}", path) for path in sorted(STAGES_DIR.glob("*_sheet.png"))],
        *[(f"activity.{path.stem.removesuffix('_sheet')}", path) for path in sorted(ACTIVITIES_DIR.glob("*_sheet.png"))],
    ]
    failures: list[str] = []
    reports: list[dict[str, float | str]] = []
    reference = measure_sheet(STAGES_DIR / "idle_sheet.png", builder)

    for label, path in sheets:
        item = measure_sheet(path, builder)
        reports.append({"label": label, **item})
        height_delta = abs(float(item["height"]) - float(reference["height"]))
        center_delta = distance(item, reference)
        frame_multiplier = max(1.0, float(item["frame_count"]) / 4)

        if height_delta > MAX_BODY_HEIGHT_DELTA:
            failures.append(f"{label}: wysokosc ciala rozni sie od idle o {height_delta:.1f}px")
        if center_delta > MAX_BODY_CENTER_DELTA:
            failures.append(f"{label}: srodek ciala rozni sie od idle o {center_delta:.1f}px")
        if float(item["drift"]) > MAX_FRAME_DRIFT:
            failures.append(f"{label}: klatki dryfuja o {float(item['drift']):.1f}px")
        if int(item["magenta_edge"]) > MAX_MAGENTA_EDGE_PIXELS * frame_multiplier:
            failures.append(f"{label}: podejrzane magentowe piksele krawedziowe {int(item['magenta_edge'])}")
        if int(item["center_leaf"]) > MAX_CENTER_LEAF_PIXELS * frame_multiplier:
            failures.append(f"{label}: podejrzane zielone piksele liscia przy glowie {int(item['center_leaf'])}")

    print("[spore body audit]")
    for item in reports:
        print(
            f"{str(item['label']):22s} "
            f"{float(item['width']):6.1f}x{float(item['height']):6.1f} "
            f"frames={int(item['frame_count']):2d} "
            f"center={float(item['center_x']):6.1f},{float(item['center_y']):6.1f} "
            f"drift={float(item['drift']):4.1f}px "
            f"magenta={int(item['magenta_edge']):3d} "
            f"leaf={int(item['center_leaf']):3d}"
        )

    if failures:
        print("\nAudyt zarodka wykryl problemy:")
        for failure in failures:
            print(f"- {failure}")
        raise SystemExit(1)

    print("\nAudyt zarodka OK: rozmiar, drift i podstawowe artefakty mieszcza sie w tolerancji.")


def load_builder():
    spec = importlib.util.spec_from_file_location("pieczargotchi_sprite_builder", BUILDER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Nie mozna wczytac buildera: {BUILDER_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def measure_sheet(path: Path, builder) -> dict[str, float | int]:
    image = Image.open(path).convert("RGBA")
    frame_count = image.width // FRAME
    boxes: list[tuple[int, int, int, int]] = []
    magenta_edge = 0
    center_leaf = 0

    for index in range(frame_count):
        frame = image.crop((index * FRAME, 0, (index + 1) * FRAME, FRAME))
        bbox = find_body_bbox(frame, builder)
        if bbox is None:
            raise RuntimeError(f"{path}: nie znaleziono ciala zarodka w klatce {index + 1}")
        boxes.append(bbox)
        magenta_edge += count_magenta_edge_pixels(frame)
        center_leaf += count_center_leaf_pixels(frame, bbox, builder)

    widths = [box[2] - box[0] for box in boxes]
    heights = [box[3] - box[1] for box in boxes]
    centers_x = [(box[0] + box[2]) / 2 for box in boxes]
    centers_y = [(box[1] + box[3]) / 2 for box in boxes]
    first_x = centers_x[0]
    first_y = centers_y[0]

    return {
        "frame_count": frame_count,
        "width": sum(widths) / len(widths),
        "height": sum(heights) / len(heights),
        "center_x": sum(centers_x) / len(centers_x),
        "center_y": sum(centers_y) / len(centers_y),
        "drift": max(((x - first_x) ** 2 + (y - first_y) ** 2) ** 0.5 for x, y in zip(centers_x, centers_y)),
        "magenta_edge": magenta_edge,
        "center_leaf": center_leaf,
    }


def find_body_bbox(frame: Image.Image, builder) -> tuple[int, int, int, int] | None:
    pixels = frame.load()
    points: set[tuple[int, int]] = set()

    for y in range(230, 475):
        for x in range(100, 412):
            if builder.czy_piksel_ciala_zarodnika(*pixels[x, y]):
                points.add((x, y))

    return largest_centered_bbox(points)


def largest_centered_bbox(points: set[tuple[int, int]]) -> tuple[int, int, int, int] | None:
    remaining = set(points)
    best: list[tuple[int, int]] = []

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

        if score_component(component) > score_component(best):
            best = component

    if not best:
        return None

    xs = [point[0] for point in best]
    ys = [point[1] for point in best]
    return min(xs), min(ys), max(xs) + 1, max(ys) + 1


def score_component(component: list[tuple[int, int]]) -> float:
    if not component:
        return -1
    xs = [point[0] for point in component]
    ys = [point[1] for point in component]
    center_x = (min(xs) + max(xs) + 1) / 2
    return len(component) - abs(center_x - 256) * 10 + (max(ys) - min(ys)) * 2


def count_magenta_edge_pixels(frame: Image.Image) -> int:
    pixels = frame.load()
    total = 0

    for y in range(FRAME):
        for x in range(FRAME):
            r, g, b, a = pixels[x, y]
            if a <= 8 or not is_magenta_artifact(r, g, b):
                continue
            if has_transparent_neighbor(frame, x, y):
                total += 1

    return total


def count_center_leaf_pixels(frame: Image.Image, body_bbox: tuple[int, int, int, int], builder) -> int:
    pixels = frame.load()
    center_x = (body_bbox[0] + body_bbox[2]) / 2
    body_width = max(1, body_bbox[2] - body_bbox[0])
    top = body_bbox[1]
    points: set[tuple[int, int]] = set()

    for y in range(max(0, top - 52), min(FRAME, top + 26)):
        for x in range(max(0, round(center_x - 70)), min(FRAME, round(center_x + 70))):
            if builder.czy_piksel_liscia(*pixels[x, y]):
                points.add((x, y))

    total = 0
    for component in connected_components(points):
        xs = [point[0] for point in component]
        ys = [point[1] for point in component]
        bbox = (min(xs), min(ys), max(xs) + 1, max(ys) + 1)
        component_center_x = (bbox[0] + bbox[2]) / 2
        touches_head = bbox[3] >= top - 10 and bbox[1] <= top + 30
        centered = abs(component_center_x - center_x) <= max(38, body_width * 0.55)

        if len(component) > 8 and touches_head and centered:
            total += len(component)

    return total


def connected_components(points: set[tuple[int, int]]) -> list[list[tuple[int, int]]]:
    remaining = set(points)
    components: list[list[tuple[int, int]]] = []

    while remaining:
        start = remaining.pop()
        stack = [start]
        component = [start]

        while stack:
            x, y = stack.pop()
            for next_x in range(max(0, x - 1), min(FRAME, x + 2)):
                for next_y in range(max(0, y - 1), min(FRAME, y + 2)):
                    point = (next_x, next_y)
                    if point not in remaining:
                        continue
                    remaining.remove(point)
                    stack.append(point)
                    component.append(point)

        components.append(component)

    return components


def is_magenta_artifact(r: int, g: int, b: int) -> bool:
    return r > 150 and b > 145 and g < 105 and abs(r - b) < 70 and r > g + 45 and b > g + 45


def has_transparent_neighbor(frame: Image.Image, x: int, y: int) -> bool:
    pixels = frame.load()
    for next_x in range(max(0, x - 1), min(FRAME, x + 2)):
        for next_y in range(max(0, y - 1), min(FRAME, y + 2)):
            if pixels[next_x, next_y][3] <= 8:
                return True
    return False


def distance(left: dict[str, float | int], right: dict[str, float | int]) -> float:
    return (
        (float(left["center_x"]) - float(right["center_x"])) ** 2
        + (float(left["center_y"]) - float(right["center_y"])) ** 2
    ) ** 0.5


if __name__ == "__main__":
    main()
