#!/usr/bin/env python3
"""Generuje stage-specific sheety reakcji immersyjnych z istniejących assetów."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
FRAME = 512
STAGES = ["spore", "baby", "young", "adult", "legendary"]
REACTIONS = ["curious", "sun", "rain", "stargaze", "snow"]


def main() -> None:
    for stage in STAGES:
        for reaction in REACTIONS:
            frames = load_reaction_frames(stage, reaction)
            output = ASSETS / "stages" / stage / f"{reaction}_sheet.png"
            save_sheet(output, [decorate_frame(frame, stage, reaction, index) for index, frame in enumerate(frames)])
    print("Wygenerowano sheety reakcji immersyjnych.")


def load_reaction_frames(stage: str, reaction: str) -> list[Image.Image]:
    source = {
        "curious": ASSETS / "stages" / stage / "wake_sheet.png",
        "sun": ASSETS / "stages" / stage / "excellent_sheet.png",
        "rain": ASSETS / ("stages/spore/idle_sheet.png" if stage == "spore" else f"easter-eggs/{stage}/neutral_rain_sheet.png"),
        "stargaze": ASSETS / "stages" / stage / "idle_sheet.png",
        "snow": ASSETS / "stages" / stage / "tired_sheet.png",
    }[reaction]
    if not source.exists() and reaction == "rain":
        source = ASSETS / "stages" / stage / "idle_sheet.png"
    if not source.exists():
        raise FileNotFoundError(source)
    sheet = Image.open(source).convert("RGBA")
    if sheet.size != (FRAME * 4, FRAME):
        raise ValueError(f"{source} ma rozmiar {sheet.size}, oczekiwano 2048x512")
    return [sheet.crop((index * FRAME, 0, (index + 1) * FRAME, FRAME)).copy() for index in range(4)]


def decorate_frame(frame: Image.Image, stage: str, reaction: str, index: int) -> Image.Image:
    if reaction == "curious":
        return add_curiosity(frame, stage, index)
    if reaction == "sun":
        return add_sun(frame, stage, index)
    if reaction == "rain":
        return add_rain(frame, stage, index)
    if reaction == "stargaze":
        return add_stargaze(frame, stage, index)
    if reaction == "snow":
        return add_snow(frame, stage, index)
    return frame


def add_curiosity(frame: Image.Image, stage: str, index: int) -> Image.Image:
    draw = ImageDraw.Draw(frame)
    anchor = bubble_anchor(stage)
    x = anchor[0] + index * 3
    y = anchor[1] - (index % 2) * 4
    draw.rectangle((x, y + 12, x + 58, y + 40), fill=(255, 253, 247, 210))
    draw.rectangle((x + 12, y, x + 46, y + 18), fill=(255, 253, 247, 210))
    draw.rectangle((x - 12, y + 38, x + 4, y + 50), fill=(255, 253, 247, 190))
    draw.rectangle((x + 27, y + 17, x + 34, y + 28), fill=(47, 79, 53, 245))
    draw.rectangle((x + 27, y + 33, x + 34, y + 39), fill=(47, 79, 53, 245))
    add_pixel_sparkle(draw, x + 70, y + 4, (216, 233, 210, 230))
    return frame


def add_sun(frame: Image.Image, stage: str, index: int) -> Image.Image:
    tinted = apply_alpha_tint(frame, (255, 229, 150, 32))
    draw = ImageDraw.Draw(tinted)
    for x, y in [(118, 142), (382, 136), (342, 314), (162, 338)]:
        add_pixel_sparkle(draw, x + index * 2, y - (index % 2) * 3, (255, 246, 184, 225))
    draw.rectangle((178, 420, 334, 427), fill=(255, 229, 150, 78))
    return tinted


def add_rain(frame: Image.Image, stage: str, index: int) -> Image.Image:
    draw = ImageDraw.Draw(frame)
    offset = index * 8
    for x, y in [(166, 132), (236, 106), (318, 122), (388, 168), (126, 212)]:
        add_drop(draw, x, y + offset, (113, 195, 245, 225))
    return frame


def add_stargaze(frame: Image.Image, stage: str, index: int) -> Image.Image:
    tinted = apply_alpha_tint(frame, (48, 64, 110, 28))
    draw = ImageDraw.Draw(tinted)
    for x, y in [(128, 122), (206, 86), (296, 104), (382, 142), (344, 214)]:
        add_pixel_sparkle(draw, x + (index % 2) * 3, y - index * 2, (255, 246, 212, 225))
    return tinted


def add_snow(frame: Image.Image, stage: str, index: int) -> Image.Image:
    tinted = apply_alpha_tint(frame, (210, 234, 246, 38))
    draw = ImageDraw.Draw(tinted)
    for x, y in [(142, 154), (212, 112), (316, 136), (386, 196), (178, 352), (340, 372)]:
        size = 4 + (index % 2)
        draw.rectangle((x, y + index * 3, x + size, y + size + index * 3), fill=(238, 238, 250, 225))
    anchor = bubble_anchor(stage)
    if stage != "spore":
        for puff in range(3):
            draw.rectangle(
                (
                    anchor[0] - 24 + puff * 18 + index * 2,
                    anchor[1] + 82 - puff * 7,
                    anchor[0] - 8 + puff * 18 + index * 2,
                    anchor[1] + 88 - puff * 7,
                ),
                fill=(238, 238, 250, 110),
            )
    return tinted


def bubble_anchor(stage: str) -> tuple[int, int]:
    return {
        "spore": (306, 244),
        "baby": (322, 148),
        "young": (326, 110),
        "adult": (334, 80),
        "legendary": (336, 76),
    }.get(stage, (334, 80))


def add_pixel_sparkle(draw: ImageDraw.ImageDraw, x: int, y: int, color: tuple[int, int, int, int]) -> None:
    draw.rectangle((x, y, x + 16, y + 4), fill=color)
    draw.rectangle((x + 6, y - 6, x + 10, y + 10), fill=color)


def add_drop(draw: ImageDraw.ImageDraw, x: int, y: int, color: tuple[int, int, int, int]) -> None:
    draw.rectangle((x, y, x + 8, y + 20), fill=color)
    draw.rectangle((x - 3, y + 13, x + 11, y + 25), fill=color)


def apply_alpha_tint(frame: Image.Image, color: tuple[int, int, int, int]) -> Image.Image:
    overlay = Image.new("RGBA", frame.size, color)
    mask = frame.getchannel("A").point(lambda value: round(value * color[3] / 255))
    result = frame.copy()
    result.alpha_composite(Image.composite(overlay, Image.new("RGBA", frame.size, (0, 0, 0, 0)), mask))
    return result


def save_sheet(path: Path, frames: list[Image.Image]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    sheet = Image.new("RGBA", (FRAME * len(frames), FRAME), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        sheet.alpha_composite(frame, (index * FRAME, 0))
    sheet.save(path, optimize=True)


if __name__ == "__main__":
    main()
