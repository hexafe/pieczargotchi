#!/usr/bin/env python3
"""Audytuje spójność rozmiaru i położenia sheetów etapów Pieczargotchi."""

from __future__ import annotations

from pathlib import Path

from PIL import Image
from PIL import ImageDraw


ROOT = Path(__file__).resolve().parents[1]
STAGES_DIR = ROOT / "assets" / "stages"
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


def main() -> None:
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

    if failures:
        print("\nAudyt spójności wykrył problemy:")
        for failure in failures:
            print(f"- {failure}")
        raise SystemExit(1)

    print("\nAudyt spójności OK: sleep, wake i idle trzymają rozmiar w każdym etapie.")


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


if __name__ == "__main__":
    main()
