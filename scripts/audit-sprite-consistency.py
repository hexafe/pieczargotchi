#!/usr/bin/env python3
"""Audytuje spójność rozmiaru i położenia sheetów etapów Pieczargotchi."""

from __future__ import annotations

import importlib.util
from pathlib import Path

from PIL import Image
from PIL import ImageDraw


ROOT = Path(__file__).resolve().parents[1]
BUILDER_PATH = ROOT / "scripts" / "build-imagegen-sprites.py"
STAGES_DIR = ROOT / "assets" / "stages"
ACTIVITIES_DIR = ROOT / "assets" / "activities"
EASTER_EGGS_DIR = ROOT / "assets" / "easter-eggs"
NEUTRAL_EASTER_CUTOUT_DIR = ROOT / "assets" / "source" / "imagegen" / "cutouts" / "easter-eggs" / "neutral"
NEUTRAL_RAIN_EASTER_CUTOUT_DIR = ROOT / "assets" / "source" / "imagegen" / "cutouts" / "easter-eggs" / "neutral_rain"
STAGES = ["spore", "baby", "young", "adult", "legendary"]
BASE_STATES = ["sleep", "wake", "idle"]
ALL_STATES = [
    "sleep",
    "wake",
    "idle",
    "happy",
    "excellent",
    "tired",
    "dry",
    "hungry",
    "dirty",
    "sick",
    "critical",
]
ACTIVITIES = ["hydrate", "feed", "clean", "play", "instrument", "sing", "spores", "harvest"]
FRAME = 512
MAX_ACTIVITY_BODY_HEIGHT_DELTA = 32
MAX_ACTIVITY_BODY_CENTER_DELTA = 36
MAX_ACTIVITY_FRAME_DRIFT = 30
MAX_BODY_BASELINE_DELTA = 3
MAX_NEUTRAL_BODY_HEIGHT_DELTA = 90
MAX_NEUTRAL_BODY_CENTER_DELTA = 55
MAX_NEUTRAL_FRAME_DRIFT = 8
MAX_NEUTRAL_RAIN_BODY_HEIGHT_DELTA = 115
MAX_NEUTRAL_RAIN_BODY_CENTER_DELTA = 90
MAX_NEUTRAL_RAIN_BASELINE_DELTA = 70
SPORE_DETACHED_STRIP_STATES = ["tired", "dry", "hungry", "dirty", "sick"]

EASTER_EGG_VARIANTS = [
    {
        "state": "neutral",
        "label": "neutral",
        "source_dir": NEUTRAL_EASTER_CUTOUT_DIR,
        "max_baseline_delta": MAX_BODY_BASELINE_DELTA,
        "max_height_delta": MAX_NEUTRAL_BODY_HEIGHT_DELTA,
        "max_center_delta": MAX_NEUTRAL_BODY_CENTER_DELTA,
    },
    {
        "state": "neutral_rain",
        "label": "neutral_rain",
        "source_dir": NEUTRAL_RAIN_EASTER_CUTOUT_DIR,
        "max_baseline_delta": MAX_NEUTRAL_RAIN_BASELINE_DELTA,
        "max_height_delta": MAX_NEUTRAL_RAIN_BODY_HEIGHT_DELTA,
        "max_center_delta": MAX_NEUTRAL_RAIN_BODY_CENTER_DELTA,
    },
]


def main() -> None:
    builder = load_builder()
    failures: list[str] = []

    for stage in STAGES:
        print(f"\n[{stage}]")
        metrics = {state: measure_sheet(STAGES_DIR / stage / f"{state}_sheet.png") for state in ALL_STATES}

        for state in ALL_STATES:
            item = metrics[state]
            print(
                f"{state:9s} "
                f"{item['width']:6.1f}x{item['height']:6.1f} "
                f"center={item['center_x']:6.1f},{item['center_y']:6.1f} "
                f"drift={item['drift']:4.1f}px"
            )

        reference = metrics["idle"]
        for state in BASE_STATES:
            item = metrics[state]
            height_delta = abs(item["height"] - reference["height"])
            center_delta = ((item["center_x"] - reference["center_x"]) ** 2 + (item["center_y"] - reference["center_y"]) ** 2) ** 0.5
            if height_delta > 8:
                failures.append(f"{stage}.{state}: wysokość różni się od idle o {height_delta:.1f}px")
            if center_delta > 14:
                failures.append(f"{stage}.{state}: środek różni się od idle o {center_delta:.1f}px")

        print("  [activity body]")
        body_reference = measure_body_sheet(STAGES_DIR / stage / "idle_sheet.png", builder)
        for state in BASE_STATES:
            item = measure_body_sheet(STAGES_DIR / stage / f"{state}_sheet.png", builder)
            bottom_delta = abs(item["bottom"] - body_reference["bottom"])
            if bottom_delta > MAX_BODY_BASELINE_DELTA:
                failures.append(f"{stage}.{state}: baseline korpusu różni się od idle o {bottom_delta:.1f}px")

        for activity in ACTIVITIES:
            item = measure_body_sheet(ACTIVITIES_DIR / stage / f"{activity}_sheet.png", builder)
            height_delta = abs(item["height"] - body_reference["height"])
            bottom_delta = abs(item["bottom"] - body_reference["bottom"])
            center_delta = (
                (item["center_x"] - body_reference["center_x"]) ** 2
                + (item["center_y"] - body_reference["center_y"]) ** 2
            ) ** 0.5
            print(
                f"  {activity:9s} "
                f"{item['width']:6.1f}x{item['height']:6.1f} "
                f"center={item['center_x']:6.1f},{item['center_y']:6.1f} "
                f"bottom={item['bottom']:6.1f} "
                f"drift={item['drift']:4.1f}px"
            )

            if height_delta > MAX_ACTIVITY_BODY_HEIGHT_DELTA:
                failures.append(f"{stage}.activity.{activity}: wysokość Pieczarki różni się od idle o {height_delta:.1f}px")
            if bottom_delta > MAX_BODY_BASELINE_DELTA:
                failures.append(f"{stage}.activity.{activity}: baseline korpusu różni się od idle o {bottom_delta:.1f}px")
            if center_delta > MAX_ACTIVITY_BODY_CENTER_DELTA:
                failures.append(f"{stage}.activity.{activity}: środek Pieczarki różni się od idle o {center_delta:.1f}px")
            if item["drift"] > MAX_ACTIVITY_FRAME_DRIFT:
                failures.append(f"{stage}.activity.{activity}: klatki Pieczarki dryfują o {item['drift']:.1f}px")

        audit_neutral_easter_eggs(stage, builder, failures)
        if stage == "spore":
            audit_spore_detached_strips(builder, failures)

    if failures:
        print("\nAudyt spójności wykrył problemy:")
        for failure in failures:
            print(f"- {failure}")
        raise SystemExit(1)

    print("\nAudyt spójności OK: stany bazowe i korpus Pieczarki w aktywnościach trzymają rozmiar w każdym etapie.")


def load_builder():
    spec = importlib.util.spec_from_file_location("pieczargotchi_sprite_builder", BUILDER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Nie mozna wczytac buildera: {BUILDER_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def measure_sheet(path: Path) -> dict[str, float]:
    image = Image.open(path).convert("RGBA")
    frame_count = image.width // 512
    boxes = []

    for index in range(frame_count):
        frame = image.crop((index * 512, 0, (index + 1) * 512, 512))
        wytnij_efekty_pomocnicze(frame)
        bbox = frame.getchannel("A").getbbox()
        if bbox is None:
            raise ValueError(f"{path}: pusta klatka {index + 1}")
        boxes.append(bbox)

    widths = [box[2] - box[0] for box in boxes]
    heights = [box[3] - box[1] for box in boxes]
    centers_x = [(box[0] + box[2]) / 2 for box in boxes]
    centers_y = [(box[1] + box[3]) / 2 for box in boxes]
    first_x = centers_x[0]
    first_y = centers_y[0]
    drift = max(((x - first_x) ** 2 + (y - first_y) ** 2) ** 0.5 for x, y in zip(centers_x, centers_y))

    return {
        "width": sum(widths) / len(widths),
        "height": sum(heights) / len(heights),
        "center_x": sum(centers_x) / len(centers_x),
        "center_y": sum(centers_y) / len(centers_y),
        "drift": drift,
    }


def wytnij_efekty_pomocnicze(frame: Image.Image) -> None:
    alpha = frame.getchannel("A")
    draw = ImageDraw.Draw(alpha)
    draw.rectangle((330, 0, 512, 235), fill=0)
    frame.putalpha(alpha)


def measure_body_sheet(path: Path, builder) -> dict[str, float]:
    image = Image.open(path).convert("RGBA")
    frame_count = image.width // FRAME
    boxes = []

    for index in range(frame_count):
        frame = image.crop((index * FRAME, 0, (index + 1) * FRAME, FRAME))
        bbox = find_character_body_bbox(frame, builder)
        if bbox is None:
            raise ValueError(f"{path}: nie znaleziono korpusu Pieczarki w klatce {index + 1}")
        boxes.append(bbox)

    widths = [box[2] - box[0] for box in boxes]
    heights = [box[3] - box[1] for box in boxes]
    centers_x = [(box[0] + box[2]) / 2 for box in boxes]
    centers_y = [(box[1] + box[3]) / 2 for box in boxes]
    bottoms = [box[3] for box in boxes]
    first_x = centers_x[0]
    first_y = centers_y[0]

    return {
        "width": sum(widths) / len(widths),
        "height": sum(heights) / len(heights),
        "center_x": sum(centers_x) / len(centers_x),
        "center_y": sum(centers_y) / len(centers_y),
        "bottom": sum(bottoms) / len(bottoms),
        "drift": max(((x - first_x) ** 2 + (y - first_y) ** 2) ** 0.5 for x, y in zip(centers_x, centers_y)),
    }


def audit_neutral_easter_eggs(stage: str, builder, failures: list[str]) -> None:
    print("  [easter :|]")
    for variant in EASTER_EGG_VARIANTS:
        audit_neutral_easter_egg_variant(stage, builder, failures, variant)


def audit_neutral_easter_egg_variant(stage: str, builder, failures: list[str], variant: dict[str, object]) -> None:
    state_name = str(variant["state"])
    label = str(variant["label"])
    source_dir = Path(variant["source_dir"])
    max_baseline_delta = float(variant["max_baseline_delta"])
    max_height_delta = float(variant["max_height_delta"])
    max_center_delta = float(variant["max_center_delta"])

    base_path = STAGES_DIR / stage / "idle_sheet.png"
    neutral_path = EASTER_EGGS_DIR / stage / f"{state_name}_sheet.png"
    source_path = source_dir / f"{stage}.png"
    if not source_path.exists():
        failures.append(f"{stage}.easter.{state_name}: brakuje wyrenderowanego source cutoutu {source_path.relative_to(ROOT)}")
        return

    if not neutral_path.exists():
        failures.append(f"{stage}.easter.{state_name}: brakuje {neutral_path.relative_to(ROOT)}")
        return

    base = Image.open(base_path).convert("RGBA")
    neutral = Image.open(neutral_path).convert("RGBA")

    if neutral.size != base.size:
        failures.append(f"{stage}.easter.{state_name}: rozmiar arkusza {neutral.size} różni się od idle {base.size}")
        return

    base_frames = base.width // FRAME
    neutral_frames = neutral.width // FRAME
    if base_frames != neutral_frames or base.height != FRAME or neutral.height != FRAME:
        failures.append(f"{stage}.easter.{state_name}: liczba klatek lub wysokość arkusza różni się od idle")
        return

    bbox_changed_frames = 0
    base_body_boxes = []
    neutral_body_boxes = []

    for index in range(base_frames):
        left = index * FRAME
        base_frame = base.crop((left, 0, left + FRAME, FRAME))
        neutral_frame = neutral.crop((left, 0, left + FRAME, FRAME))
        full_bbox = neutral_frame.getchannel("A").point(lambda value: 255 if value > 8 else 0).getbbox()
        if full_bbox is None:
            failures.append(f"{stage}.easter.{state_name}: klatka {index + 1} jest pusta")
            continue
        if full_bbox[0] <= 0 or full_bbox[1] <= 0 or full_bbox[2] >= FRAME:
            failures.append(f"{stage}.easter.{state_name}: klatka {index + 1} dotyka krawędzi kadru {full_bbox}")

        base_body_box = find_character_body_bbox(base_frame, builder)
        neutral_body_box = find_easter_egg_body_bbox(neutral_frame, builder, state_name)
        if base_body_box is None or neutral_body_box is None:
            failures.append(f"{stage}.easter.{state_name}: klatka {index + 1} nie ma wykrywalnego korpusu Pieczarki")
            continue

        base_body_boxes.append(base_body_box)
        neutral_body_boxes.append(neutral_body_box)
        bbox_changed_frames += int(base_body_box != neutral_body_box)

        bottom_delta = abs(neutral_body_box[3] - base_body_box[3])
        if bottom_delta > max_baseline_delta:
            failures.append(f"{stage}.easter.{state_name}: klatka {index + 1} baseline różni się od idle o {bottom_delta:.1f}px")

    if base_body_boxes and neutral_body_boxes:
        base_metrics = metrics_from_boxes(base_body_boxes)
        neutral_metrics = metrics_from_boxes(neutral_body_boxes)
        print(
            f"  {label:12s} "
            f"{neutral_metrics['width']:6.1f}x{neutral_metrics['height']:6.1f} "
            f"center={neutral_metrics['center_x']:6.1f},{neutral_metrics['center_y']:6.1f} "
            f"bbox_changed_frames={bbox_changed_frames}/{base_frames}"
        )
        height_delta = abs(neutral_metrics["height"] - base_metrics["height"])
        center_delta = (
            (neutral_metrics["center_x"] - base_metrics["center_x"]) ** 2
            + (neutral_metrics["center_y"] - base_metrics["center_y"]) ** 2
        ) ** 0.5
        if height_delta > max_height_delta:
            failures.append(f"{stage}.easter.{state_name}: wysokość wyrenderowanego assetu różni się od idle o {height_delta:.1f}px")
        if center_delta > max_center_delta:
            failures.append(f"{stage}.easter.{state_name}: środek wyrenderowanego assetu różni się od idle o {center_delta:.1f}px")
        if neutral_metrics["drift"] > MAX_NEUTRAL_FRAME_DRIFT:
            failures.append(f"{stage}.easter.{state_name}: klatki neutralnego assetu dryfują o {neutral_metrics['drift']:.1f}px")


def find_easter_egg_body_bbox(frame: Image.Image, builder, state_name: str) -> tuple[int, int, int, int] | None:
    if state_name == "neutral_rain" and hasattr(builder, "znajdz_bbox_widocznego_korpusu_w_kadrze_bez_parasolki"):
        return builder.znajdz_bbox_widocznego_korpusu_w_kadrze_bez_parasolki(frame)

    return find_character_body_bbox(frame, builder)


def audit_spore_detached_strips(builder, failures: list[str]) -> None:
    for state in SPORE_DETACHED_STRIP_STATES:
        image = Image.open(STAGES_DIR / "spore" / f"{state}_sheet.png").convert("RGBA")
        frame_count = image.width // FRAME
        for index in range(frame_count):
            left = index * FRAME
            frame = image.crop((left, 0, left + FRAME, FRAME))
            body_box = find_character_body_bbox(frame, builder)
            if body_box is None:
                continue

            alpha = frame.getchannel("A")
            points: set[tuple[int, int]] = set()
            for y in range(0, max(0, body_box[1] - 14)):
                for x in range(38, 474):
                    if alpha.getpixel((x, y)) > 8:
                        points.add((x, y))

            for component in builder.znajdz_skladowe(points, FRAME, FRAME):
                if len(component) < 24:
                    continue

                xs = [point[0] for point in component]
                ys = [point[1] for point in component]
                bbox = (min(xs), min(ys), max(xs) + 1, max(ys) + 1)
                width = bbox[2] - bbox[0]
                height = bbox[3] - bbox[1]
                if width >= 18 and height <= 20:
                    failures.append(f"spore.{state}: klatka {index + 1} ma odklejony pasek nad sprite {bbox}")


def metrics_from_boxes(boxes: list[tuple[int, int, int, int]]) -> dict[str, float]:
    widths = [box[2] - box[0] for box in boxes]
    heights = [box[3] - box[1] for box in boxes]
    centers_x = [(box[0] + box[2]) / 2 for box in boxes]
    centers_y = [(box[1] + box[3]) / 2 for box in boxes]
    first_x = centers_x[0]
    first_y = centers_y[0]

    return {
        "width": sum(widths) / len(widths),
        "height": sum(heights) / len(heights),
        "center_x": sum(centers_x) / len(centers_x),
        "center_y": sum(centers_y) / len(centers_y),
        "drift": max(((x - first_x) ** 2 + (y - first_y) ** 2) ** 0.5 for x, y in zip(centers_x, centers_y)),
    }


def find_character_body_bbox(frame: Image.Image, builder) -> tuple[int, int, int, int] | None:
    if hasattr(builder, "znajdz_bbox_widocznego_korpusu_w_kadrze"):
        return builder.znajdz_bbox_widocznego_korpusu_w_kadrze(frame)

    pixels = frame.load()
    points: set[tuple[int, int]] = set()

    for y in range(0, 455):
        for x in range(38, 474):
            r, g, b, a = pixels[x, y]
            if a <= 8:
                continue
            if builder.czy_piksel_wody(r, g, b, a) or builder.czy_piksel_liscia(r, g, b, a):
                continue
            if czy_piksel_kwiatka_lub_mchu(r, g, b, a, y):
                continue

            points.add((x, y))

    return largest_centered_bbox(points)


def czy_piksel_kwiatka_lub_mchu(r: int, g: int, b: int, a: int, y: int) -> bool:
    if a <= 8 or y < 300:
        return False

    white_flower = r > 220 and g > 220 and b > 205 and max(r, g, b) - min(r, g, b) < 42
    yellow_center = r > 150 and g > 115 and b < 120
    return white_flower or yellow_center


def largest_centered_bbox(points: set[tuple[int, int]]) -> tuple[int, int, int, int] | None:
    remaining = set(points)
    best: list[tuple[int, int]] = []

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

        if len(component) < 24:
            continue

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
    width = max(xs) - min(xs) + 1
    height = max(ys) - min(ys) + 1
    center_x = (min(xs) + max(xs) + 1) / 2
    return len(component) + width * height * 0.04 + height * 6 - abs(center_x - 256) * 12


if __name__ == "__main__":
    main()
