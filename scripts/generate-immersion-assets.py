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
RAIN_FRAME_COUNT = 16


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
        "rain": ASSETS / "stages" / stage / "idle_sheet.png",
        "stargaze": ASSETS / "stages" / stage / "idle_sheet.png",
        "snow": ASSETS / "stages" / stage / "tired_sheet.png",
    }[reaction]
    if not source.exists() and reaction == "rain":
        source = ASSETS / "stages" / stage / "idle_sheet.png"
    if not source.exists():
        raise FileNotFoundError(source)
    sheet = Image.open(source).convert("RGBA")
    if sheet.height != FRAME or sheet.width % FRAME != 0:
        raise ValueError(f"{source} ma rozmiar {sheet.size}, oczekiwano klatek 512x512")

    frame_count = sheet.width // FRAME
    if frame_count != 4:
        raise ValueError(f"{source} ma {frame_count} klatek, oczekiwano 4 klatek bazowych")

    frames = [sheet.crop((index * FRAME, 0, (index + 1) * FRAME, FRAME)).copy() for index in range(frame_count)]
    if reaction == "rain":
        return [frames[index % frame_count].copy() for index in range(RAIN_FRAME_COUNT)]

    return frames


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
    overlay = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    draw_rain_cap_beads(draw, stage, index)
    for spec in rain_drop_specs(stage):
        draw_rain_drop_timeline(draw, spec, index)
    frame.alpha_composite(overlay)
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


def rain_drop_specs(stage: str) -> list[dict[str, object]]:
    plans = {
        "spore": [
            {
                "path": [(250, 322), (240, 330), (230, 342), (218, 358)],
                "ground": (210, 407),
                "size": 6,
                "start": 0,
                "form": 3,
                "slide": 5,
                "fall": 3,
                "splash": 2,
            },
            {
                "path": [(286, 322), (296, 334), (308, 352), (320, 374)],
                "ground": (322, 408),
                "size": 5,
                "start": 6,
                "form": 2,
                "slide": 4,
                "fall": 3,
                "splash": 2,
            },
        ],
        "baby": [
            {
                "path": [(224, 206), (208, 226), (192, 252), (176, 286)],
                "ground": (158, 418),
                "size": 7,
                "start": 0,
                "form": 3,
                "slide": 6,
                "fall": 3,
                "splash": 2,
            },
            {
                "path": [(294, 202), (314, 228), (334, 264), (352, 300)],
                "ground": (374, 418),
                "size": 6,
                "start": 6,
                "form": 2,
                "slide": 5,
                "fall": 2,
                "splash": 2,
            },
        ],
        "young": [
            {
                "path": [(226, 112), (206, 136), (184, 168), (164, 204)],
                "ground": (142, 422),
                "size": 8,
                "start": 0,
                "form": 3,
                "slide": 6,
                "fall": 3,
                "splash": 2,
            },
            {
                "path": [(306, 108), (330, 132), (354, 168), (376, 210)],
                "ground": (402, 422),
                "size": 7,
                "start": 6,
                "form": 2,
                "slide": 5,
                "fall": 2,
                "splash": 2,
            },
        ],
        "adult": [
            {
                "path": [(230, 104), (208, 128), (184, 160), (158, 200)],
                "ground": (132, 422),
                "size": 9,
                "start": 0,
                "form": 3,
                "slide": 6,
                "fall": 3,
                "splash": 2,
            },
            {
                "path": [(314, 110), (338, 136), (364, 174), (392, 220)],
                "ground": (420, 422),
                "size": 8,
                "start": 6,
                "form": 2,
                "slide": 5,
                "fall": 2,
                "splash": 2,
            },
        ],
        "legendary": [
            {
                "path": [(224, 94), (202, 120), (180, 154), (156, 198)],
                "ground": (130, 422),
                "size": 9,
                "start": 0,
                "form": 3,
                "slide": 6,
                "fall": 3,
                "splash": 2,
            },
            {
                "path": [(320, 100), (344, 130), (372, 172), (400, 218)],
                "ground": (426, 422),
                "size": 8,
                "start": 6,
                "form": 2,
                "slide": 5,
                "fall": 2,
                "splash": 2,
            },
        ],
    }
    return plans.get(stage, plans["adult"])


def draw_rain_cap_beads(draw: ImageDraw.ImageDraw, stage: str, index: int) -> None:
    beads = {
        "spore": [(260, 320, 3), (296, 336, 3), (224, 350, 2)],
        "baby": [(250, 196, 3), (312, 226, 4), (190, 260, 3)],
        "young": [(250, 104, 4), (330, 130, 4), (190, 174, 3)],
        "adult": [(252, 100, 4), (326, 126, 4), (198, 164, 3), (374, 172, 3)],
        "legendary": [(248, 92, 4), (334, 122, 4), (194, 160, 3), (382, 170, 3)],
    }.get(stage, [(252, 100, 4), (326, 126, 4), (198, 164, 3)])

    for bead_index, (x, y, size) in enumerate(beads):
        phase = (index + bead_index * 4) % RAIN_FRAME_COUNT
        pulse = phase if phase <= RAIN_FRAME_COUNT // 2 else RAIN_FRAME_COUNT - phase
        alpha = 42 + pulse * 7
        draw_cap_bead(draw, x, y, size, alpha)


def draw_rain_drop_timeline(draw: ImageDraw.ImageDraw, spec: dict[str, object], index: int) -> None:
    local = index - int(spec["start"])
    if local < 0:
        return

    form_frames = int(spec["form"])
    slide_frames = int(spec["slide"])
    fall_frames = int(spec["fall"])
    splash_frames = int(spec["splash"])
    size = int(spec["size"])
    path_points = spec["path"]
    ground = spec["ground"]
    assert isinstance(path_points, list)
    assert isinstance(ground, tuple)

    if local < form_frames:
        progress = phase_progress(local, form_frames)
        x, y = path_points[0]
        draw_sliding_drop(draw, x, y, round(size * (0.55 + progress * 0.45)), round(84 + progress * 128))
        return

    local -= form_frames
    if local < slide_frames:
        progress = phase_progress(local, slide_frames)
        x, y = interpolate_path(path_points, progress)
        if progress > 0.18:
            trail_x, trail_y = interpolate_path(path_points, max(0, progress - 0.18))
            draw_cap_bead(draw, trail_x, trail_y, max(3, size - 4), 62)
        if progress > 0.36:
            trail_x, trail_y = interpolate_path(path_points, max(0, progress - 0.34))
            draw_cap_bead(draw, trail_x, trail_y, max(2, size - 5), 42)
        draw_sliding_drop(draw, x, y, round(size * (0.95 + progress * 0.25)), 224)
        return

    local -= slide_frames
    if local < fall_frames:
        progress = phase_progress(local, fall_frames)
        start_x, start_y = path_points[-1]
        x = lerp(start_x, ground[0], progress)
        y = lerp(start_y + 12, ground[1] - 28, progress)
        draw_falling_drop(draw, x, y, round(size * 0.82), round(16 + progress * 10), 218)
        return

    local -= fall_frames
    if local < splash_frames:
        draw_ground_splash(draw, ground[0], ground[1], phase_progress(local, splash_frames), size)


def phase_progress(local: int, frames: int) -> float:
    if frames <= 1:
        return 1.0
    return max(0.0, min(1.0, local / (frames - 1)))


def lerp(start: float, end: float, progress: float) -> float:
    return start + (end - start) * progress


def interpolate_path(points: list[tuple[int, int]], progress: float) -> tuple[int, int]:
    progress = max(0.0, min(1.0, progress))
    scaled = progress * (len(points) - 1)
    left = int(scaled)
    right = min(len(points) - 1, left + 1)
    local = scaled - left
    return (round(lerp(points[left][0], points[right][0], local)), round(lerp(points[left][1], points[right][1], local)))


def draw_cap_bead(draw: ImageDraw.ImageDraw, x: float, y: float, size: int, alpha: int) -> None:
    x = round(x)
    y = round(y)
    size = max(2, int(size))
    main = (97, 172, 213, max(0, min(255, alpha)))
    highlight = (222, 248, 255, max(0, min(255, alpha + 42)))
    draw.rectangle((x, y + 1, x + size + 1, y + size + 2), fill=main)
    draw.rectangle((x + 1, y, x + size - 1, y + 1), fill=highlight)


def draw_sliding_drop(draw: ImageDraw.ImageDraw, x: float, y: float, size: int, alpha: int) -> None:
    x = round(x)
    y = round(y)
    size = max(5, int(size))
    alpha = max(0, min(255, alpha))
    main = (91, 169, 211, alpha)
    shadow = (47, 112, 151, round(alpha * 0.68))
    highlight = (228, 251, 255, round(alpha * 0.88))
    draw.rectangle((x - 1, y + 1, x + size - 4, y + size - 1), fill=main)
    draw.rectangle((x - 4, y + size - 2, x + size + 1, y + size + 6), fill=main)
    draw.rectangle((x - 2, y + size + 5, x + size - 2, y + size + 8), fill=shadow)
    draw.rectangle((x + 1, y + 2, x + 3, y + 4), fill=highlight)
    if size >= 8:
        draw.rectangle((x + size - 2, y + size, x + size + 1, y + size + 5), fill=shadow)


def draw_falling_drop(draw: ImageDraw.ImageDraw, x: float, y: float, size: int, length: int, alpha: int) -> None:
    x = round(x)
    y = round(y)
    size = max(4, int(size))
    length = max(14, int(length))
    alpha = max(0, min(255, alpha))
    main = (86, 160, 203, alpha)
    shadow = (45, 110, 151, round(alpha * 0.62))
    highlight = (228, 251, 255, round(alpha * 0.78))
    draw.rectangle((x - 2, y, x + size - 3, y + length), fill=main)
    draw.rectangle((x - 4, y + length - 5, x + size, y + length + 3), fill=main)
    draw.rectangle((x + size - 4, y + 7, x + size - 2, y + length + 2), fill=shadow)
    draw.rectangle((x, y + 3, x + 1, y + 12), fill=highlight)


def draw_ground_splash(draw: ImageDraw.ImageDraw, x: float, y: float, progress: float, size: int) -> None:
    x = round(x)
    y = round(y)
    spread = round((12 + size * 2) * (0.65 + progress * 0.45))
    alpha = round(186 * (1 - progress * 0.35))
    main = (93, 176, 217, alpha)
    highlight = (224, 249, 255, round(alpha * 0.7))
    draw.rectangle((x - spread, y, x + spread, y + 3), fill=main)
    draw.rectangle((x - spread // 2, y + 5, x + spread // 2, y + 7), fill=(63, 132, 171, round(alpha * 0.45)))
    draw.rectangle((x - round(spread * 0.7), y - 9, x - round(spread * 0.7) + 3, y - 4), fill=highlight)
    draw.rectangle((x + round(spread * 0.55), y - 12, x + round(spread * 0.55) + 3, y - 6), fill=highlight)
    if progress < 0.65:
        draw.rectangle((x - 3, y - 18, x + 4, y - 9), fill=main)


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
