#!/usr/bin/env python3
"""Generuje stage-specific sheety reakcji immersyjnych z istniejących assetów."""

from __future__ import annotations

import argparse
import importlib.util
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

from sprite_layout import load_canvas_frames


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
RAW_STATES_DIR = ASSETS / "source" / "imagegen" / "raw" / "states"
BUILDER_PATH = ROOT / "scripts" / "build-imagegen-sprites.py"
FRAME = 512
STAGES = ["spore", "baby", "young", "adult", "legendary"]
REACTIONS = [
    "curious",
    "idle_fidget",
    "idle_fidget_sway",
    "idle_fidget_shift",
    "idle_look_left",
    "idle_look_right",
    "ponder",
    "ponder_up",
    "ponder_side",
    "ponder_breath",
    "watch_cursor_left",
    "watch_cursor_right",
    "watch_cursor_up_left",
    "watch_cursor_up_right",
    "follow_cursor_fast",
    "follow_cursor_after",
    "watch_butterfly",
    "watch_firefly",
    "watch_crawler",
    "sun",
    "rain",
    "stargaze",
    "snow",
]
RAIN_FRAME_COUNT = 16
REACTION_FRAME_COUNTS = {
    "idle_fidget": 8,
    "idle_fidget_sway": 8,
    "idle_fidget_shift": 8,
    "idle_look_left": 8,
    "idle_look_right": 8,
    "ponder": 10,
    "ponder_up": 10,
    "ponder_side": 10,
    "ponder_breath": 10,
    "watch_cursor_left": 8,
    "watch_cursor_right": 8,
    "watch_cursor_up_left": 8,
    "watch_cursor_up_right": 8,
    "follow_cursor_fast": 8,
    "follow_cursor_after": 8,
    "watch_butterfly": 10,
    "watch_firefly": 12,
    "watch_crawler": 10,
    "rain": RAIN_FRAME_COUNT,
}
UI_ART_PASS_REACTIONS = [
    "idle_fidget",
    "idle_fidget_sway",
    "idle_fidget_shift",
    "watch_cursor_left",
    "watch_cursor_right",
    "watch_cursor_up_left",
    "watch_cursor_up_right",
]
UI_ART_PASS_SPORE_ACTIVITIES = ["feed", "instrument"]
_ACTIVITY_BUILDER_CONTEXT = None


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--ui-art-pass",
        action="store_true",
        help="regenerate only the reviewed fidget/cursor sheets and spore feed/instrument activities",
    )
    parser.add_argument("--reaction", action="append", choices=UI_ART_PASS_REACTIONS, help="regenerate only this reviewed reaction")
    parser.add_argument(
        "--spore-activity",
        action="append",
        choices=UI_ART_PASS_SPORE_ACTIVITIES,
        help="regenerate only this reviewed spore activity",
    )
    args = parser.parse_args()
    reactions = args.reaction or (UI_ART_PASS_REACTIONS if args.ui_art_pass else [] if args.spore_activity else REACTIONS)
    authored_context = prepare_authored_state_context() if RAW_STATES_DIR.exists() else None
    for stage in STAGES:
        for reaction in reactions:
            authored_frames = load_authored_reaction_frames(authored_context, stage, reaction)
            frames = authored_frames if authored_frames is not None else load_reaction_frames(stage, reaction)
            output = ASSETS / "stages" / stage / f"{reaction}_sheet.png"
            output_frames = frames if authored_frames is not None else [
                decorate_frame(frame, stage, reaction, index) for index, frame in enumerate(frames)
            ]
            save_sheet(output, output_frames)
    focused_run = args.ui_art_pass or bool(args.reaction) or bool(args.spore_activity)
    activities = args.spore_activity or (UI_ART_PASS_SPORE_ACTIVITIES if args.ui_art_pass else [])
    if focused_run:
        for activity in activities:
            generate_spore_activity_art_pass(activity)
        print("Wygenerowano fokusowy UI art pass: fidget, watch_cursor oraz spore feed/instrument.")
        return
    print("Wygenerowano sheety reakcji immersyjnych.")


def prepare_authored_state_context():
    spec = importlib.util.spec_from_file_location("pieczargotchi_sprite_builder", BUILDER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Nie mozna wczytac buildera: {BUILDER_PATH}")
    builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
    grass = builder.przygotuj_warstwe_trawy()
    return {
        "builder": builder,
        "grass": grass,
        "body_bottom_targets": builder.policz_docelowe_doly_korpusu(grass),
        "cache": {},
    }


def load_authored_reaction_frames(context, stage: str, reaction: str) -> list[Image.Image] | None:
    if context is None:
        return None

    cache = context["cache"]
    if reaction not in cache:
        builder = context["builder"]
        frame_count = REACTION_FRAME_COUNTS.get(reaction, 4)
        cutouts_by_stage = builder.wczytaj_klatkowe_cutouty_stanu(reaction, frame_count)
        if not cutouts_by_stage:
            cache[reaction] = None
        else:
            frames_by_stage: dict[str, list[Image.Image]] = {}
            for authored_stage, cutouts in cutouts_by_stage.items():
                frames_by_stage[authored_stage] = [
                    builder.zloz_klatke_z_trawa(
                        cutout,
                        context["grass"],
                        authored_stage,
                        (0, 0),
                        None,
                        context["body_bottom_targets"],
                        reaction,
                        frame_index,
                    )
                    for frame_index, cutout in enumerate(cutouts)
                ]
            cache[reaction] = frames_by_stage

    frames_by_stage = cache[reaction]
    return frames_by_stage.get(stage) if frames_by_stage is not None else None


def load_reaction_frames(stage: str, reaction: str) -> list[Image.Image]:
    source = {
        "curious": ASSETS / "stages" / stage / "wake_sheet.png",
        "sun": ASSETS / "stages" / stage / "excellent_sheet.png",
        "rain": ASSETS / "stages" / stage / "idle_sheet.png",
        "stargaze": ASSETS / "stages" / stage / "idle_sheet.png",
        "snow": ASSETS / "stages" / stage / "tired_sheet.png",
    }.get(reaction, ASSETS / "stages" / stage / "idle_sheet.png")
    if not source.exists() and reaction == "rain":
        source = ASSETS / "stages" / stage / "idle_sheet.png"
    if not source.exists():
        raise FileNotFoundError(source)
    frames = load_canvas_frames(source)
    frame_count = len(frames)
    if frame_count != 4:
        raise ValueError(f"{source} ma {frame_count} klatek, oczekiwano 4 klatek bazowych")
    target_frame_count = REACTION_FRAME_COUNTS.get(reaction, frame_count)
    if target_frame_count != frame_count:
        if reaction.startswith("watch_cursor_"):
            return [frames[0].copy() for _index in range(target_frame_count)]
        source_sequence = [0, 1, 2, 3, 2, 1, 0, 3, 2, 1, 0, 3, 1, 2, 3, 0]
        return [frames[source_sequence[index] % frame_count].copy() for index in range(target_frame_count)]

    return frames


def decorate_frame(frame: Image.Image, stage: str, reaction: str, index: int) -> Image.Image:
    if reaction == "curious":
        return add_curiosity(frame, stage, index)
    if reaction in {"idle_fidget_sway", "idle_fidget_shift", "idle_look_left", "idle_look_right"}:
        return add_idle_variant(frame, stage, reaction, index)
    if reaction == "idle_fidget":
        return add_idle_fidget(frame, stage, index)
    if reaction in {"ponder_up", "ponder_side", "ponder_breath"}:
        return add_ponder_variant(frame, stage, reaction, index)
    if reaction == "ponder":
        return add_ponder(frame, stage, index)
    if reaction.startswith("watch_cursor_") or reaction.startswith("follow_cursor_"):
        return add_cursor_watch(frame, stage, reaction, index)
    if reaction == "watch_butterfly":
        return add_watch_butterfly(frame, stage, index)
    if reaction == "watch_firefly":
        return add_watch_firefly(frame, stage, index)
    if reaction == "watch_crawler":
        return add_watch_crawler(frame, stage, index)
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


def add_idle_fidget(frame: Image.Image, stage: str, index: int) -> Image.Image:
    offsets = [(0, 2), (-2, 0), (-4, -2), (0, -7), (4, -3), (5, 0), (2, 2), (-1, 0)]
    dx, dy = offsets[index % len(offsets)]
    return move_character_layer(frame, stage, dx, dy)


def add_idle_variant(frame: Image.Image, stage: str, reaction: str, index: int) -> Image.Image:
    offsets = {
        "idle_fidget_sway": [(-2, 0), (-5, -1), (-7, -3), (-4, -5), (2, -3), (7, -1), (5, 1), (2, 2)],
        "idle_fidget_shift": [(0, 2), (-3, 0), (-5, -3), (-2, -7), (4, -4), (6, -1), (2, 1), (1, 0)],
        "idle_look_left": [(-1, 0), (-1, 0), (-2, 0), (-2, 0), (-1, 0), (-1, 0), (-1, 0), (-1, 0)],
        "idle_look_right": [(1, 0), (1, 0), (2, 0), (2, 0), (1, 0), (1, 0), (1, 0), (1, 0)],
    }[reaction]
    dx, dy = offsets[index % len(offsets)]
    return move_character_layer(frame, stage, dx, dy)


def add_ponder(frame: Image.Image, stage: str, index: int) -> Image.Image:
    offsets = [(0, 0), (0, -1), (-1, -2), (-1, -2), (0, -1), (1, 0), (1, 1), (0, 0), (0, 0), (0, 0)]
    dx, dy = offsets[index % len(offsets)]
    result = move_character_layer(frame, stage, dx, dy)
    draw = ImageDraw.Draw(result)
    anchor = bubble_anchor(stage)
    pulse = 1 + (index % 3)
    for dot_index in range(3):
        x = anchor[0] + 12 + dot_index * 14 + (index % 2)
        y = anchor[1] + 6 - dot_index * 12
        color = (255, 253, 247, 120 + dot_index * 32)
        draw.rectangle((x, y, x + 5 + pulse, y + 5 + pulse), fill=color)
    return result


def add_ponder_variant(frame: Image.Image, stage: str, reaction: str, index: int) -> Image.Image:
    offsets = {
        "ponder_up": [(0, 0), (0, -1), (0, -2), (0, -2), (0, -1), (0, 0), (0, 0), (0, 0), (0, 0), (0, 0)],
        "ponder_side": [(0, 0), (-1, 0), (-2, -1), (-2, -1), (-1, 0), (0, 0), (1, 0), (1, 0), (0, 0), (0, 0)],
        "ponder_breath": [(0, 0), (0, 0), (0, -1), (0, -1), (0, 0), (0, 1), (0, 1), (0, 0), (0, 0), (0, 0)],
    }[reaction]
    dx, dy = offsets[index % len(offsets)]
    result = move_character_layer(frame, stage, dx, dy)
    draw = ImageDraw.Draw(result)
    anchor = bubble_anchor(stage)
    if reaction == "ponder_up":
        for dot_index in range(3):
            size = 4 + ((index + dot_index) % 2)
            x = anchor[0] + 2 + dot_index * 12
            y = anchor[1] - 2 - dot_index * 14 - (index % 3)
            draw.rectangle((x, y, x + size, y + size), fill=(255, 253, 247, 150 + dot_index * 28))
    elif reaction == "ponder_side":
        draw.rectangle((anchor[0] + 18, anchor[1] + 14, anchor[0] + 52, anchor[1] + 20), fill=(255, 253, 247, 130))
        draw.rectangle((anchor[0] + 40, anchor[1] + 4, anchor[0] + 48, anchor[1] + 14), fill=(255, 253, 247, 120))
    else:
        puff_alpha = 105 + (index % 4) * 20
        for puff in range(3):
            x = anchor[0] - 16 + puff * 17 + (index % 2)
            y = anchor[1] + 76 - puff * 6 - (index % 3)
            draw.rectangle((x, y, x + 12 - puff * 2, y + 5), fill=(255, 253, 247, puff_alpha))
    return result


def add_cursor_watch(frame: Image.Image, stage: str, reaction: str, index: int) -> Image.Image:
    plans = {
        "watch_cursor_left": {
            "offsets": [(-1, 0), (-2, 0), (-4, -1), (-5, -2), (-4, -1), (-3, 0), (-2, 1), (-1, 1)],
        },
        "watch_cursor_right": {
            "offsets": [(1, 0), (2, 0), (4, -1), (5, -2), (4, -1), (3, 0), (2, 1), (1, 1)],
        },
        "watch_cursor_up_left": {
            "offsets": [(-1, -1), (-2, -2), (-4, -4), (-5, -5), (-4, -4), (-3, -2), (-2, -1), (-1, 0)],
        },
        "watch_cursor_up_right": {
            "offsets": [(1, -1), (2, -2), (4, -4), (5, -5), (4, -4), (3, -2), (2, -1), (1, 0)],
        },
        "follow_cursor_fast": {
            "offsets": [(0, 0), (1, 0), (2, 0), (1, 0), (-1, 0), (-1, 0), (0, 0), (0, 0)],
        },
        "follow_cursor_after": {
            "offsets": [(0, 0), (-1, 0), (-1, 0), (0, 0), (1, 0), (1, 0), (0, 0), (0, 0)],
        },
    }[reaction]
    dx, dy = plans["offsets"][index % len(plans["offsets"])]
    result = move_character_layer(frame, stage, dx, dy)
    draw = ImageDraw.Draw(result)
    if reaction.startswith("watch_cursor_"):
        shift_cursor_eyes(result, stage, reaction, dx, dy)
    if reaction == "follow_cursor_fast":
        anchor = bubble_anchor(stage)
        sweep_y = anchor[1] + 86 + (index % 2) * 3
        sweep_x = anchor[0] - 82 + index * 18
        draw.rectangle((sweep_x, sweep_y, sweep_x + 24, sweep_y + 3), fill=(242, 246, 255, 96))
    return result


def shift_cursor_eyes(
    image: Image.Image,
    stage: str,
    reaction: str,
    dx: int,
    dy: int,
) -> None:
    eye_specs = {
        "spore": [(234, 386, 245, 400), (269, 386, 280, 400)],
        "baby": [(214, 341, 235, 364), (278, 341, 300, 364)],
        "young": [(204, 318, 227, 344), (283, 318, 307, 344)],
        "adult": [(197, 298, 225, 324), (286, 298, 314, 324)],
        "legendary": [(202, 282, 228, 308), (287, 282, 313, 308)],
    }
    gaze_dx = 2 if "right" in reaction else -2
    gaze_dy = -2 if "up" in reaction else 0
    pixels = image.load()
    for raw_left, raw_top, raw_right, raw_bottom in eye_specs[stage]:
        left = raw_left + dx
        top = raw_top + dy
        right = raw_right + dx
        bottom = raw_bottom + dy
        face_sample_x = max(0, min(FRAME - 1, left + (right - left) // 2))
        face_sample_y = max(0, min(FRAME - 1, bottom + 3))
        face_color = pixels[face_sample_x, face_sample_y]
        eye_pixels: list[tuple[int, int, tuple[int, int, int, int]]] = []
        for y in range(top, bottom):
            for x in range(left, right):
                red, green, blue, alpha = pixels[x, y]
                is_dark_eye = alpha > 80 and red < 135 and green < 120 and blue < 115
                is_white_glint = alpha > 160 and red > 220 and green > 220 and blue > 210
                if is_dark_eye or is_white_glint:
                    eye_pixels.append((x, y, pixels[x, y]))

        for x, y, _color in eye_pixels:
            pixels[x, y] = face_color
        for x, y, color in eye_pixels:
            target_x = max(0, min(FRAME - 1, x + gaze_dx))
            target_y = max(0, min(FRAME - 1, y + gaze_dy))
            pixels[target_x, target_y] = color


def generate_spore_activity_art_pass(activity: str) -> None:
    path = ASSETS / "activities" / "spore" / f"{activity}_sheet.png"
    frames = load_clean_spore_activity_frames(activity)
    if len(frames) != 8:
        raise ValueError(f"{path} ma {len(frames)} klatek, oczekiwano 8")

    offsets = {
        "feed": [(0, 1), (-1, 0), (-2, -2), (0, -4), (2, -2), (3, 0), (1, 1), (0, 0)],
        "instrument": [(0, 1), (-2, 0), (-3, -2), (0, -4), (3, -2), (2, 0), (0, 1), (-1, 0)],
    }[activity]
    output_frames: list[Image.Image] = []
    for index, frame in enumerate(frames):
        dx, dy = offsets[index]
        result = move_character_layer(frame.copy(), "spore", dx, dy)
        draw = ImageDraw.Draw(result)
        if activity == "feed":
            draw_spore_feed_story(draw, index)
        else:
            draw_spore_instrument_story(draw, index)
        output_frames.append(result)
    save_sheet(path, output_frames)


def load_clean_spore_activity_frames(activity: str) -> list[Image.Image]:
    global _ACTIVITY_BUILDER_CONTEXT
    if _ACTIVITY_BUILDER_CONTEXT is None:
        spec = importlib.util.spec_from_file_location("pieczargotchi_activity_builder", BUILDER_PATH)
        if spec is None or spec.loader is None:
            raise RuntimeError(f"Nie mozna wczytac buildera: {BUILDER_PATH}")
        builder = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(builder)
        grass = builder.przygotuj_warstwe_trawy()
        _ACTIVITY_BUILDER_CONTEXT = {
            "builder": builder,
            "grass": grass,
            "body_bottom_targets": builder.policz_docelowe_doly_korpusu(grass),
        }

    builder = _ACTIVITY_BUILDER_CONTEXT["builder"]
    grass = _ACTIVITY_BUILDER_CONTEXT["grass"]
    body_bottom_targets = _ACTIVITY_BUILDER_CONTEXT["body_bottom_targets"]
    atlas = builder.wczytaj_atlas(activity)
    cutout = builder.przygotuj_cutouty_etapow(atlas, activity)[0]
    authored = builder.wczytaj_klatkowe_cutouty_aktywnosci(activity).get("spore")
    return [
        builder.zloz_klatke_aktywnosci(
            authored[index] if authored else cutout,
            grass,
            "spore",
            activity,
            index,
            body_bottom_targets,
        )
        for index in range(8)
    ]


def draw_spore_feed_story(draw: ImageDraw.ImageDraw, index: int) -> None:
    paths = [
        [(319, 378, 4)],
        [(312, 374, 5), (324, 366, 2)],
        [(305, 370, 5), (316, 360, 3)],
        [(298, 369, 4), (310, 358, 3), (320, 370, 2)],
        [(304, 363, 3), (314, 356, 2), (322, 365, 2)],
        [(312, 361, 3), (322, 370, 2)],
        [(319, 370, 2)],
        [(323, 380, 2)],
    ]
    colors = [(154, 86, 42, 235), (234, 177, 76, 230), (109, 62, 38, 210)]
    for crumb_index, (x, y, size) in enumerate(paths[index]):
        color = colors[(index + crumb_index) % len(colors)]
        draw.rectangle((x, y, x + size, y + size), fill=color)
        if size >= 4:
            draw.rectangle((x + 1, y, x + size - 1, y + 1), fill=(255, 220, 126, 220))


def draw_spore_instrument_story(draw: ImageDraw.ImageDraw, index: int) -> None:
    note_paths = [
        [(301, 374, 0)],
        [(307, 365, 0)],
        [(314, 354, 1), (302, 370, 0)],
        [(322, 340, 1), (309, 357, 0)],
        [(329, 329, 2), (317, 348, 1), (304, 366, 0)],
        [(324, 337, 1), (312, 354, 0)],
        [(316, 349, 0)],
        [(307, 364, 0)],
    ]
    colors = [(91, 73, 135, 235), (70, 125, 126, 230), (201, 113, 89, 225)]
    for note_index, (x, y, variant) in enumerate(note_paths[index]):
        color = colors[(index + note_index) % len(colors)]
        draw.rectangle((x, y + 7, x + 4, y + 11), fill=color)
        draw.rectangle((x + 4, y, x + 6, y + 9), fill=color)
        flag_width = 5 + variant * 2
        draw.rectangle((x + 6, y, x + 6 + flag_width, y + 2), fill=color)
        if variant >= 1:
            draw.rectangle((x + 8, y + 3, x + 11, y + 4), fill=(255, 224, 153, 190))
    pulse_color = colors[index % len(colors)]
    draw.rectangle((330, 329, 333, 331), fill=pulse_color)
    draw.rectangle((335, 333, 336, 334), fill=(255, 224, 153, 150 + index * 10))


def add_watch_butterfly(frame: Image.Image, stage: str, index: int) -> Image.Image:
    offsets = [(0, 0), (-1, 0), (-2, -1), (-2, -1), (-1, 0), (0, 0), (1, 0), (1, 0), (0, 0), (0, 0)]
    dx, dy = offsets[index % len(offsets)]
    result = move_character_layer(frame, stage, dx, dy)
    draw = ImageDraw.Draw(result)
    anchor = bubble_anchor(stage)
    x = anchor[0] - 42 + index * 5
    y = anchor[1] + 46 + round(math.sin(index / 2) * 5)
    draw.rectangle((x - 6, y - 3, x - 1, y + 4), fill=(140, 103, 49, 190))
    draw.rectangle((x + 3, y - 2, x + 9, y + 3), fill=(244, 196, 95, 205))
    draw.rectangle((x + 1, y, x + 3, y + 6), fill=(61, 44, 34, 210))
    return result


def add_watch_firefly(frame: Image.Image, stage: str, index: int) -> Image.Image:
    offsets = [(0, 0), (0, -1), (1, -2), (1, -2), (0, -1), (-1, 0), (-1, 0), (0, 0), (0, 0), (0, 0), (1, 0), (0, 0)]
    if stage == "spore":
        offsets = [(0, 0), (0, 0), (1, -1), (1, -1), (0, 0), (-1, 0), (-1, 0), (0, 0), (0, 0), (0, 0), (1, 0), (0, 0)]
    dx, dy = offsets[index % len(offsets)]
    result = move_character_layer(frame, stage, dx, dy)
    if stage == "spore":
        return result

    draw = ImageDraw.Draw(result)
    anchor = bubble_anchor(stage)
    for spark in range(4):
        phase = (index + spark * 3) % 12
        alpha = 70 + max(0, 6 - abs(phase - 6)) * 24
        x = anchor[0] - 62 + spark * 34 + (phase % 3)
        y = anchor[1] + 62 + ((phase + spark) % 4) * 5
        draw.rectangle((x - 3, y - 3, x + 5, y + 5), fill=(255, 230, 130, round(alpha * 0.24)))
        draw.rectangle((x, y, x + 2, y + 2), fill=(255, 248, 206, alpha))
    return result


def add_watch_crawler(frame: Image.Image, stage: str, index: int) -> Image.Image:
    offsets = [(0, 0), (0, 1), (1, 2), (1, 2), (0, 1), (-1, 1), (-1, 0), (0, 0), (0, 0), (0, 0)]
    dx, dy = offsets[index % len(offsets)]
    result = move_character_layer(frame, stage, dx, dy)
    draw = ImageDraw.Draw(result)
    anchor = bubble_anchor(stage)
    base_y = {
        "spore": 408,
        "baby": 418,
        "young": 428,
        "adult": 440,
        "legendary": 440,
    }.get(stage, 440)
    x = anchor[0] - 84 + index * 10
    draw.rectangle((x, base_y - 4, x + 13, base_y + 3), fill=(31, 25, 21, 190))
    draw.rectangle((x + 2, base_y - 3, x + 11, base_y + 2), fill=(106, 59, 32, 205))
    for blade in range(4):
        draw.rectangle((x - 8 + blade * 7, base_y - 20 - blade % 2 * 4, x - 6 + blade * 7, base_y + 2), fill=(95, 163, 66, 150))
    return result


def move_character_layer(frame: Image.Image, stage: str, dx: int, dy: int) -> Image.Image:
    if dx == 0 and dy == 0:
        return frame

    mask = build_character_mask(frame, stage)
    character = Image.composite(frame, Image.new("RGBA", frame.size, (0, 0, 0, 0)), mask)
    base = Image.composite(Image.new("RGBA", frame.size, (0, 0, 0, 0)), frame, mask)
    shifted = shift_image(character, dx, dy)
    base.alpha_composite(shifted)
    return base


def build_character_mask(frame: Image.Image, stage: str) -> Image.Image:
    cutoff = {
        "spore": 425,
        "baby": 420,
        "young": 436,
        "adult": 452,
        "legendary": 458,
    }.get(stage, 452)
    mask = Image.new("L", frame.size, 0)
    pixels = frame.load()
    mask_pixels = mask.load()

    for y in range(cutoff):
        for x in range(FRAME):
            r, g, b, a = pixels[x, y]
            if a <= 8 or is_grass_pixel(r, g, b):
                continue
            mask_pixels[x, y] = a

    return mask.filter(ImageFilter.MaxFilter(3))


def is_grass_pixel(r: int, g: int, b: int) -> bool:
    return g > r * 1.08 and g > b * 1.08 and g > 76


def shift_image(image: Image.Image, dx: int, dy: int) -> Image.Image:
    result = Image.new("RGBA", image.size, (0, 0, 0, 0))
    src_left = max(0, -dx)
    src_top = max(0, -dy)
    src_right = image.width - max(0, dx)
    src_bottom = image.height - max(0, dy)
    if src_right <= src_left or src_bottom <= src_top:
        return result

    crop = image.crop((src_left, src_top, src_right, src_bottom))
    result.alpha_composite(crop, (max(0, dx), max(0, dy)))
    return result


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
    r, g, b, a = color
    soft = (r, g, b, round(a * 0.58))
    dim = (255, 184, 74, round(a * 0.38))
    draw.rectangle((x + 7, y + 1, x + 9, y + 3), fill=color)
    draw.rectangle((x + 4, y - 2, x + 5, y - 1), fill=soft)
    draw.rectangle((x + 11, y + 5, x + 12, y + 6), fill=soft)
    draw.rectangle((x + 11, y - 2, x + 12, y - 1), fill=dim)
    draw.rectangle((x + 4, y + 5, x + 5, y + 6), fill=dim)


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
