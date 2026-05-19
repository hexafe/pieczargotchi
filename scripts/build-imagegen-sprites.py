#!/usr/bin/env python3
"""Buduje runtime sprite sheety z atlasow wygenerowanych przez image generator."""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
RAW_DIR = ASSETS / "source" / "imagegen" / "raw"
CUTOUT_DIR = ASSETS / "source" / "imagegen" / "cutouts"
NEUTRAL_EASTER_CUTOUT_DIR = CUTOUT_DIR / "easter-eggs" / "neutral"
NEUTRAL_RAIN_EASTER_CUTOUT_DIR = CUTOUT_DIR / "easter-eggs" / "neutral_rain"
ENVIRONMENT_CUTOUT_DIR = CUTOUT_DIR / "environment"
GENERATED_DIR = ASSETS / "source" / "imagegen" / "generated"
FRAME = 512

STAGES = ["spore", "baby", "young", "adult", "legendary"]
STATES = [
    "idle",
    "sleep",
    "wake",
    "happy",
    "excellent",
    "tired",
    "dry",
    "hungry",
    "dirty",
    "sick",
    "critical",
]
ACTIVITIES = [
    "hydrate",
    "feed",
    "clean",
    "play",
    "instrument",
    "sing",
    "spores",
    "harvest",
]
EFFECTS = ["drops", "sparkle", "dust", "notes", "spore_cloud"]

STAGE_LAYOUT = {
    "spore": {"target_h": 132, "max_w": 240, "bottom": 424},
    "baby": {"target_h": 246, "max_w": 310, "bottom": 415},
    "young": {"target_h": 342, "max_w": 380, "bottom": 438},
    "adult": {"target_h": 430, "max_w": 456, "bottom": 454},
    "legendary": {"target_h": 430, "max_w": 470, "bottom": 454},
}
GRASS_VISIBLE_HEIGHT = 104
GRASS_EDGE_VARIATION = 24
GRASS_BOTTOM_Y = 512
ENVIRONMENT_GRASS_HEIGHT = 158

SPORE_BODY_TARGET_H = 96
SPORE_FULL_MAX_W = 430
SPORE_DETACHED_STRIP_STATES = {"tired", "dry", "hungry", "dirty", "sick"}
SPORE_GENERATED_ATLAS = GENERATED_DIR / "spore_full_generated_atlas.png"
SPORE_GENERATED_VARIANTS = [
    "idle",
    "sleep",
    "wake",
    "happy",
    "excellent",
    "tired",
    "dry",
    "hungry",
    "dirty",
    "sick",
    "critical",
    "hydrate",
    "feed",
    "clean",
    "play",
    "instrument",
    "sing",
    "spores",
    "harvest",
]
_SPORE_GENERATED_CACHE: dict[str, Image.Image] | None = None

STATE_OFFSETS = {
    "idle": [(0, 0), (0, -1), (0, 0), (0, 1)],
    "sleep": [(0, 1), (0, 2), (0, 1), (0, 2)],
    "wake": [(-1, 1), (1, -1), (0, 0), (0, 0)],
    "happy": [(0, 0), (0, -2), (0, -1), (0, 0)],
    "excellent": [(0, -1), (0, -2), (0, -1), (0, 0)],
    "tired": [(0, 2), (0, 3), (0, 2), (0, 3)],
    "dry": [(0, 1), (0, 2), (0, 1), (0, 2)],
    "hungry": [(0, 0), (-1, 0), (0, 1), (1, 0)],
    "dirty": [(0, 0), (0, 1), (0, 0), (0, 1)],
    "sick": [(-1, 0), (1, 1), (-1, 0), (1, 1)],
    "critical": [(-2, 0), (2, 0), (-1, 1), (1, -1)],
}

ACTIVITY_OFFSETS = {
    "hydrate": [(0, 0), (0, -2), (0, -1), (0, 0)],
    "feed": [(0, 0), (0, -1), (0, -1), (0, 0)],
    "clean": [(0, 0), (0, -2), (0, -1), (0, 0)],
    "play": [(-2, 0), (1, -2), (2, -1), (0, 0)],
    "instrument": [(0, 0), (0, -1), (0, 0), (0, 1)],
    "sing": [(0, 0), (0, -1), (0, -1), (0, 0)],
    "spores": [(0, -8), (0, -9), (0, -9), (0, -8)],
    "harvest": [(0, 0), (0, -1), (0, -1), (0, 0)],
}

ACTIVITY_LAYOUT_OVERRIDES = {
    ("legendary", "spores"): {"max_w": FRAME},
}

EFFECT_OFFSETS = {
    "drops": [(0, 0), (0, 6), (0, 12), (0, 18)],
    "sparkle": [(0, 0), (2, -2), (-2, 2), (0, 0)],
    "dust": [(0, 0), (4, 0), (8, -2), (12, -4)],
    "notes": [(0, 0), (4, -6), (8, -12), (12, -18)],
    "spore_cloud": [(0, 0), (6, -2), (12, -4), (18, -6)],
}


def main() -> None:
    sprawdz_zrodla()
    grass = przygotuj_warstwe_trawy()
    body_bottom_targets = policz_docelowe_doly_korpusu(grass)
    zbuduj_stany(grass, body_bottom_targets)
    zbuduj_aktywnosci(grass, body_bottom_targets)
    zbuduj_easter_eggi(grass, body_bottom_targets)
    zbuduj_efekty()
    zbuduj_srodowisko()
    print("Zbudowano imagegenowe sprite sheety.")


def sprawdz_zrodla() -> None:
    wymagane = [f"{name}_atlas.png" for name in [*STATES, *ACTIVITIES, "effects", "grass_patch"]]
    brakujace = [name for name in wymagane if not (RAW_DIR / name).exists()]
    if brakujace:
        raise FileNotFoundError("Brak atlasow imagegen: " + ", ".join(brakujace))

    brakujace_neutralne = [stage for stage in STAGES if not (NEUTRAL_EASTER_CUTOUT_DIR / f"{stage}.png").exists()]
    if brakujace_neutralne:
        raise FileNotFoundError("Brak wyrenderowanych neutralnych cutoutow: " + ", ".join(brakujace_neutralne))

    brakujace_deszczowe = [stage for stage in STAGES if not (NEUTRAL_RAIN_EASTER_CUTOUT_DIR / f"{stage}.png").exists()]
    if brakujace_deszczowe:
        raise FileNotFoundError("Brak wyrenderowanych deszczowych neutralnych cutoutow: " + ", ".join(brakujace_deszczowe))


def przygotuj_warstwe_trawy() -> Image.Image:
    reference = Image.open(ASSETS / "awake.png").convert("RGBA")
    mask = zrob_maske_trawy(reference)
    transparent = Image.new("RGBA", reference.size, (0, 0, 0, 0))
    return Image.composite(reference, transparent, mask)


def zrob_maske_trawy(reference: Image.Image) -> Image.Image:
    pixels = reference.load()
    mask = Image.new("L", reference.size, 0)
    out = mask.load()

    for y in range(reference.height):
        for x in range(reference.width):
            r, g, b, a = pixels[x, y]
            if a <= 8 or y < 300:
                continue

            greenish = g > 45 and g > r + 8 and g > b + 8
            white_flower = y > 335 and r > 220 and g > 220 and b > 205 and max(r, g, b) - min(r, g, b) < 42
            yellow_center = y > 335 and r > 150 and g > 115 and b < 120
            if greenish or white_flower or yellow_center:
                out[x, y] = a

    dilated = mask.filter(ImageFilter.MaxFilter(3))
    alpha = reference.getchannel("A")
    grass_mask = ImageChops.multiply(dilated, alpha.point(lambda value: 255 if value > 8 else 0))
    return poszarp_gorna_krawedz_trawy(grass_mask)


def poszarp_gorna_krawedz_trawy(mask: Image.Image) -> Image.Image:
    result = mask.copy()
    pixels = result.load()

    for x in range(result.width):
        top = None
        for y in range(280, result.height):
            if pixels[x, y] > 8:
                top = y
                break

        if top is None:
            continue

        chip = 8 + ((x * 17 + (x // 11) * 7) % 18)
        if (x // 19) % 3 == 0:
            chip += 7

        for y in range(top, min(result.height, top + chip)):
            pixels[x, y] = 0

    return result


def policz_docelowe_doly_korpusu(grass: Image.Image) -> dict[str, int]:
    atlas = wczytaj_atlas("idle")
    cutouts = przygotuj_cutouty_etapow(atlas, "idle")
    targets: dict[str, int] = {}
    grass_bbox = dopasuj_trawe_do_etapu(grass, "baby").getchannel("A").getbbox()

    for stage, cutout in zip(STAGES, cutouts):
        planted_min_bottom = policz_minimum_posadzenia(stage, grass_bbox)
        character = dopasuj_do_etapu(cutout, stage)
        x, y = policz_pozycje_postaci(character, stage, (0, 0))
        grass_layer = dopasuj_trawe_do_etapu(grass, stage)
        frame = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
        frame.alpha_composite(grass_layer, (0, 0))
        frame.alpha_composite(character, (x, y))
        final_bbox = znajdz_bbox_widocznego_korpusu_w_kadrze(frame)
        if final_bbox is not None:
            targets[stage] = podnies_do_minimum_posadzenia(final_bbox[3], planted_min_bottom)
            continue

        visible_bbox = znajdz_widoczny_bbox_korpusu(character, grass_layer, x, y, stage)
        if visible_bbox is not None:
            targets[stage] = podnies_do_minimum_posadzenia(visible_bbox[3], planted_min_bottom)
            continue

        body_bbox = znajdz_bbox_korpusu_postaci(character, stage)
        if body_bbox is None:
            targets[stage] = podnies_do_minimum_posadzenia(STAGE_LAYOUT[stage]["bottom"], planted_min_bottom)
        else:
            targets[stage] = podnies_do_minimum_posadzenia(y + body_bbox[3], planted_min_bottom)

    return targets


def policz_minimum_posadzenia(stage: str, grass_bbox: tuple[int, int, int, int] | None) -> int | None:
    if grass_bbox is None:
        return None

    grass_top = grass_bbox[1]
    if stage == "spore":
        return grass_top - 5
    if stage in {"baby", "young"}:
        return grass_top + 2
    return None


def podnies_do_minimum_posadzenia(value: int, planted_min_bottom: int | None) -> int:
    if planted_min_bottom is None:
        return value

    return max(value, planted_min_bottom)


def zbuduj_stany(grass: Image.Image, body_bottom_targets: dict[str, int]) -> None:
    for state in STATES:
        atlas = wczytaj_atlas(state)
        cutouts = przygotuj_cutouty_etapow(atlas, state)
        for stage, cutout in zip(STAGES, cutouts):
            if stage == "spore" and state in SPORE_DETACHED_STRIP_STATES:
                cutout = usun_odklejone_paski_zarodnika(cutout)
            if state == "excellent":
                cutout = usun_odklejone_blyski(cutout)
            zapisz_cutout("states", state, stage, cutout)
            offsets = STATE_OFFSETS[state]
            if stage == "spore" and state == "wake":
                offsets = [(x, y - 7) for x, y in offsets]
            frames = [
                zloz_klatke_z_trawa(
                    cutout,
                    grass,
                    stage,
                    offset,
                    None,
                    body_bottom_targets,
                    state,
                    frame_index,
                )
                for frame_index, offset in enumerate(offsets)
            ]
            zapisz_sheet(ASSETS / "stages" / stage / f"{state}_sheet.png", frames)


def zbuduj_aktywnosci(grass: Image.Image, body_bottom_targets: dict[str, int]) -> None:
    for activity in ACTIVITIES:
        atlas = wczytaj_atlas(activity)
        cutouts = przygotuj_cutouty_etapow(atlas, activity)
        for stage, cutout in zip(STAGES, cutouts):
            zapisz_cutout("activities", activity, stage, cutout)
            if activity == "hydrate":
                frames = [
                    zloz_klatke_podlania(cutout, grass, stage, offset, frame_index, body_bottom_targets)
                    for frame_index, offset in enumerate(ACTIVITY_OFFSETS[activity])
                ]
            else:
                frames = [
                    zloz_klatke_z_trawa(cutout, grass, stage, offset, activity, body_bottom_targets)
                    for offset in ACTIVITY_OFFSETS[activity]
                ]
            sciezka = ASSETS / "activities" / stage / f"{activity}_sheet.png"
            zapisz_sheet(sciezka, frames)

            if stage == "adult":
                zapisz_sheet(ASSETS / "activities" / f"{activity}_sheet.png", frames)


def zbuduj_efekty() -> None:
    atlas = wczytaj_atlas("effects")
    cutouts = wytnij_komorki(atlas, len(EFFECTS))

    for effect, cutout in zip(EFFECTS, cutouts):
        zapisz_cutout("effects", effect, "effect", cutout)
        frames = [zloz_efekt(cutout, offset) for offset in EFFECT_OFFSETS[effect]]
        zapisz_sheet(ASSETS / "effects" / f"{effect}_sheet.png", frames)


def zbuduj_srodowisko() -> None:
    grass_patch = przygotuj_trawnik_srodowiska()
    zapisz_obraz(ENVIRONMENT_CUTOUT_DIR / "grass_patch.png", grass_patch)
    zapisz_obraz(ASSETS / "environment" / "grass_patch.png", grass_patch)


def przygotuj_trawnik_srodowiska() -> Image.Image:
    atlas = wczytaj_atlas("grass_patch")
    bbox = atlas.getchannel("A").point(lambda value: 255 if value > 8 else 0).getbbox()
    if bbox is None:
        raise RuntimeError("Pusty atlas trawnika srodowiska.")

    pad = 8
    cutout = atlas.crop(
        (
            max(0, bbox[0] - pad),
            max(0, bbox[1] - pad),
            min(atlas.width, bbox[2] + pad),
            min(atlas.height, bbox[3] + pad),
        )
    )
    return cutout.resize((FRAME, ENVIRONMENT_GRASS_HEIGHT), Image.Resampling.NEAREST)


def wczytaj_atlas(name: str) -> Image.Image:
    return usun_chroma_key(Image.open(RAW_DIR / f"{name}_atlas.png").convert("RGBA"))


def przygotuj_cutouty_etapow(atlas: Image.Image, variant_id: str) -> list[Image.Image]:
    cutouts = wytnij_etapy(atlas)
    return [
        przygotuj_zarodnik_grzybni(cutout, variant_id) if stage == "spore" else cutout
        for stage, cutout in zip(STAGES, cutouts)
    ]


def usun_chroma_key(image: Image.Image) -> Image.Image:
    pixels = image.load()

    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            if a <= 0:
                continue

            magenta_distance = ((r - 255) ** 2 + g**2 + (b - 255) ** 2) ** 0.5
            magenta_background = r > 170 and b > 170 and g < 150 and abs(r - b) < 95
            if magenta_background and magenta_distance < 120:
                pixels[x, y] = (r, g, b, 0)
                continue

            if magenta_background:
                alpha = min(a, round(a * min(1.0, (magenta_distance - 120) / 95)))
                r, g, b = zdejmij_magentowy_zafarb(r, g, b)
                pixels[x, y] = (r, g, b, alpha)
            elif a < 255:
                pixels[x, y] = (*zdejmij_magentowy_zafarb(r, g, b), a)

    alpha = image.getchannel("A")
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    image.putalpha(alpha)
    return image


def zdejmij_magentowy_zafarb(r: int, g: int, b: int) -> tuple[int, int, int]:
    spill = min(r, b) - max(g + 24, 0)
    if spill <= 0:
        return r, g, b

    reduction = round(spill * 0.82)
    return (max(0, r - reduction), g, max(0, b - reduction))


def wytnij_etapy(atlas: Image.Image) -> list[Image.Image]:
    return wytnij_postacie_z_atlasu(atlas, len(STAGES))


def wytnij_komorki(atlas: Image.Image, count: int) -> list[Image.Image]:
    cutouts: list[Image.Image] = []
    for index in range(count):
        left = round(index * atlas.width / count)
        right = round((index + 1) * atlas.width / count)
        cell = atlas.crop((left, 0, right, atlas.height))
        bbox = cell.getchannel("A").point(lambda value: 255 if value > 8 else 0).getbbox()
        if bbox is None:
            raise RuntimeError(f"Pusta komorka {index + 1} w atlasie {atlas.size}.")

        pad = 12
        bbox = (
            max(0, bbox[0] - pad),
            max(0, bbox[1] - pad),
            min(cell.width, bbox[2] + pad),
            min(cell.height, bbox[3] + pad),
        )
        cutouts.append(cell.crop(bbox))

    return cutouts


def wytnij_postacie_z_atlasu(atlas: Image.Image, count: int) -> list[Image.Image]:
    alpha = atlas.getchannel("A")
    pixels = alpha.load()
    column_counts = []

    for x in range(atlas.width):
        column_counts.append(sum(1 for y in range(atlas.height) if pixels[x, y] > 8))

    runs = []
    start = None
    last = None
    gap_limit = 24
    solid_threshold = 12

    for x, value in enumerate(column_counts):
        if value > solid_threshold:
            if start is None:
                start = x
            last = x
        elif start is not None and last is not None and x - last > gap_limit:
            runs.append((start, last))
            start = None
            last = None

    if start is not None and last is not None:
        runs.append((start, last))

    candidates = []
    for left, right in runs:
        area = sum(column_counts[left : right + 1])
        width = right - left + 1
        if area > 900 and width > 16:
            candidates.append({"left": left, "right": right, "area": area, "center": (left + right) / 2})

    if len(candidates) < count:
        return wytnij_komorki(atlas, count)

    main_runs = sorted(sorted(candidates, key=lambda item: item["area"], reverse=True)[:count], key=lambda item: item["center"])
    centers = [item["center"] for item in main_runs]
    boundaries = [0]
    for left_center, right_center in zip(centers, centers[1:]):
        boundaries.append(round((left_center + right_center) / 2))
    boundaries.append(atlas.width)

    cutouts = []
    for index in range(count):
        cell = atlas.crop((boundaries[index], 0, boundaries[index + 1], atlas.height))
        bbox = cell.getchannel("A").point(lambda value: 255 if value > 8 else 0).getbbox()
        if bbox is None:
            raise RuntimeError(f"Pusta postac {index + 1} w atlasie {atlas.size}.")

        pad = 12
        bbox = (
            max(0, bbox[0] - pad),
            max(0, bbox[1] - pad),
            min(cell.width, bbox[2] + pad),
            min(cell.height, bbox[3] + pad),
        )
        cutouts.append(cell.crop(bbox))

    return cutouts


def zloz_klatke_z_trawa(
    cutout: Image.Image,
    grass: Image.Image,
    stage: str,
    offset: tuple[int, int],
    activity: str | None = None,
    body_bottom_targets: dict[str, int] | None = None,
    state: str | None = None,
    frame_index: int = 0,
) -> Image.Image:
    frame = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    character = dopasuj_do_etapu(cutout, stage, get_activity_layout_override(stage, activity))
    x, y = policz_pozycje_postaci(character, stage, offset, get_body_bottom_target(stage, body_bottom_targets))
    frame, x, y = zloz_postac_i_trawe(character, grass, stage, x, y, get_body_bottom_target(stage, body_bottom_targets))
    if state == "excellent":
        narysuj_animowane_blyski_excellent(frame, stage, character, x, y, frame_index)
    return frame


def usun_odklejone_blyski(cutout: Image.Image) -> Image.Image:
    alpha = cutout.getchannel("A")
    pixels = alpha.load()
    points: set[tuple[int, int]] = set()
    for y in range(cutout.height):
        for x in range(cutout.width):
            if pixels[x, y] > 8:
                points.add((x, y))

    components = [component for component in znajdz_skladowe(points, cutout.width, cutout.height) if len(component) >= 24]
    if not components:
        return cutout

    center_x = cutout.width / 2
    center_y = cutout.height / 2

    def component_score(component: list[tuple[int, int]]) -> float:
        xs = [point[0] for point in component]
        ys = [point[1] for point in component]
        width = max(xs) - min(xs) + 1
        height = max(ys) - min(ys) + 1
        component_center_x = (min(xs) + max(xs) + 1) / 2
        component_center_y = (min(ys) + max(ys) + 1) / 2
        distance_penalty = abs(component_center_x - center_x) * 12 + abs(component_center_y - center_y) * 3
        return len(component) + width * height * 0.08 + height * 10 - distance_penalty

    body = max(components, key=component_score)
    mask = Image.new("L", cutout.size, 0)
    mask_pixels = mask.load()
    for x, y in body:
        mask_pixels[x, y] = alpha.getpixel((x, y))

    transparent = Image.new("RGBA", cutout.size, (0, 0, 0, 0))
    return Image.composite(cutout, transparent, mask)


def narysuj_animowane_blyski_excellent(
    frame: Image.Image,
    stage: str,
    character: Image.Image,
    character_x: int,
    character_y: int,
    frame_index: int,
) -> None:
    body_bbox = znajdz_bbox_korpusu_postaci(character, stage) or character.getchannel("A").getbbox()
    if body_bbox is None:
        return

    left = character_x + body_bbox[0]
    top = character_y + body_bbox[1]
    right = character_x + body_bbox[2]
    bottom = character_y + body_bbox[3]
    width = right - left
    height = bottom - top
    anchors = [
        (left - width * 0.10, top + height * 0.20, 7),
        (right + width * 0.07, top + height * 0.27, 6),
        (left - width * 0.08, top + height * 0.58, 5),
        (right + width * 0.05, top + height * 0.64, 5),
        (left + width * 0.16, top + height * 0.08, 4),
        (right - width * 0.12, top + height * 0.12, 4),
        (left + width * 0.08, bottom - height * 0.12, 3),
        (right - width * 0.05, bottom - height * 0.18, 3),
    ]

    overlay = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for index, (raw_x, raw_y, base_size) in enumerate(anchors):
        phase = (frame_index / 4 + index * 0.19) % 1
        alpha = math.sin(phase * math.pi)
        if alpha <= 0.22:
            continue

        wobble_x = math.sin((frame_index + index * 0.73) * 1.4) * (1.3 + index % 2)
        wobble_y = math.cos((frame_index + index * 0.61) * 1.2) * 1.4
        size = max(2, round(base_size * (0.55 + alpha * 0.45)))
        x = int(round(clamp(raw_x + wobble_x, 16, FRAME - 18, raw_x)))
        y = int(round(clamp(raw_y + wobble_y, 20, 418, raw_y)))
        narysuj_pixelowy_blysk(draw, x, y, size, alpha)

    frame.alpha_composite(overlay)


def narysuj_pixelowy_blysk(draw: ImageDraw.ImageDraw, x: int, y: int, size: int, alpha: float) -> None:
    alpha_byte = int(clamp(alpha, 0, 1, 0) * 255)
    warm_alpha = int(alpha_byte * 0.78)
    dim_alpha = int(alpha_byte * 0.42)
    far_alpha = int(alpha_byte * 0.24)
    core = (255, 252, 214, alpha_byte)
    warm = (255, 211, 92, warm_alpha)
    amber = (255, 163, 65, dim_alpha)
    halo = (255, 237, 150, far_alpha)
    draw.rectangle((x, y, x + 1, y + 1), fill=core)
    draw.point((x - 2, y - 2), fill=warm)
    draw.point((x + 3, y - 2), fill=warm)
    draw.point((x - 2, y + 3), fill=warm)
    draw.point((x + 3, y + 3), fill=warm)
    if size >= 4:
        draw.rectangle((x - 4, y - 4, x - 3, y - 3), fill=amber)
        draw.rectangle((x + 4, y - 4, x + 5, y - 3), fill=amber)
        draw.rectangle((x - 4, y + 4, x - 3, y + 5), fill=amber)
        draw.rectangle((x + 4, y + 4, x + 5, y + 5), fill=amber)
    if size >= 6:
        draw.point((x - 7, y - 6), fill=halo)
        draw.point((x + 8, y - 5), fill=halo)
        draw.point((x - 6, y + 8), fill=halo)
        draw.point((x + 7, y + 7), fill=halo)


def clamp(value: float, minimum: float, maximum: float, fallback: float) -> float:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        numeric = fallback
    if not math.isfinite(numeric):
        numeric = fallback
    return min(maximum, max(minimum, numeric))


def zloz_klatke_podlania(
    cutout: Image.Image,
    grass: Image.Image,
    stage: str,
    offset: tuple[int, int],
    frame_index: int,
    body_bottom_targets: dict[str, int] | None = None,
) -> Image.Image:
    character_layer, character_bbox = usun_wode_z_podlania(cutout)
    if character_bbox is None:
        return zloz_klatke_z_trawa(cutout, grass, stage, offset, "hydrate", body_bottom_targets)

    character_source = character_layer.crop(character_bbox)
    character, scale = dopasuj_do_etapu_ze_skala(character_source, stage, get_activity_layout_override(stage, "hydrate"))
    character_x, character_y = policz_pozycje_postaci(
        character,
        stage,
        offset,
        get_body_bottom_target(stage, body_bottom_targets),
    )

    frame, character_x, character_y = zloz_postac_i_trawe(
        character,
        grass,
        stage,
        character_x,
        character_y,
        get_body_bottom_target(stage, body_bottom_targets),
    )
    visible_top_y = character_y + znajdz_gorna_krawedz_postaci(character)

    narysuj_zraszanie(frame, character_x, visible_top_y, character.width, character.height, frame_index, scale)
    return frame


def zloz_postac_i_trawe(
    character: Image.Image,
    grass: Image.Image,
    stage: str,
    character_x: int,
    character_y: int,
    body_bottom_target: int | None,
) -> tuple[Image.Image, int, int]:
    grass_layer = dopasuj_trawe_do_etapu(grass, stage)

    def compose(y: int) -> Image.Image:
        result = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
        result.alpha_composite(grass_layer, (0, 0))
        result.alpha_composite(character, (character_x, y))
        return result

    frame = compose(character_y)
    if body_bottom_target is None:
        return frame, character_x, character_y

    for _attempt in range(3):
        search_box = (
            max(38, character_x),
            max(0, character_y),
            min(474, character_x + character.width),
            min(455, character_y + character.height),
        )
        final_body = znajdz_bbox_widocznego_korpusu_w_kadrze(frame, search_box)
        if final_body is None:
            final_body = znajdz_widoczny_bbox_korpusu(character, grass_layer, character_x, character_y, stage)
        if final_body is None:
            return frame, character_x, character_y

        delta_y = body_bottom_target - final_body[3]
        if abs(delta_y) <= 1:
            return frame, character_x, character_y

        character_y += delta_y
        frame = compose(character_y)

    return frame, character_x, character_y


def znajdz_bbox_widocznego_korpusu_w_kadrze(
    frame: Image.Image,
    search_box: tuple[int, int, int, int] | None = None,
) -> tuple[int, int, int, int] | None:
    return znajdz_bbox_widocznego_korpusu_w_kadrze_z_filtrem(frame, search_box, False)


def znajdz_bbox_widocznego_korpusu_w_kadrze_bez_parasolki(
    frame: Image.Image,
    search_box: tuple[int, int, int, int] | None = None,
) -> tuple[int, int, int, int] | None:
    return znajdz_bbox_widocznego_korpusu_w_kadrze_z_filtrem(frame, search_box, True)


def znajdz_bbox_widocznego_korpusu_w_kadrze_z_filtrem(
    frame: Image.Image,
    search_box: tuple[int, int, int, int] | None,
    ignore_umbrella: bool,
) -> tuple[int, int, int, int] | None:
    pixels = frame.load()
    points: set[tuple[int, int]] = set()
    left, top, right, bottom = search_box or (38, 0, 474, 455)
    left = max(38, min(FRAME, left))
    top = max(0, min(455, top))
    right = max(left, min(474, right))
    bottom = max(top, min(455, bottom))

    for y in range(top, bottom):
        for x in range(left, right):
            r, g, b, a = pixels[x, y]
            if a <= 8:
                continue
            if czy_piksel_wody(r, g, b, a) or czy_piksel_liscia(r, g, b, a):
                continue
            if ignore_umbrella and czy_piksel_parasolki(r, g, b, a):
                continue
            if czy_piksel_kwiatka_lub_mchu(r, g, b, a, y):
                continue

            points.add((x, y))

    return znajdz_bbox_najlepszej_srodkowej_skladowej(points)


def czy_piksel_kwiatka_lub_mchu(r: int, g: int, b: int, a: int, y: int) -> bool:
    if a <= 8 or y < 300:
        return False

    white_flower = r > 220 and g > 220 and b > 205 and max(r, g, b) - min(r, g, b) < 42
    yellow_center = r > 150 and g > 115 and b < 120
    return white_flower or yellow_center


def znajdz_bbox_najlepszej_srodkowej_skladowej(points: set[tuple[int, int]]) -> tuple[int, int, int, int] | None:
    best: list[tuple[int, int]] = []

    for component in znajdz_skladowe(points, FRAME, FRAME):
        if len(component) < 24:
            continue

        if not best or policz_wynik_skladowej_kadru(component) > policz_wynik_skladowej_kadru(best):
            best = component

    if not best:
        return None

    xs = [point[0] for point in best]
    ys = [point[1] for point in best]
    return min(xs), min(ys), max(xs) + 1, max(ys) + 1


def policz_wynik_skladowej_kadru(component: list[tuple[int, int]]) -> float:
    if not component:
        return -1

    xs = [point[0] for point in component]
    ys = [point[1] for point in component]
    width = max(xs) - min(xs) + 1
    height = max(ys) - min(ys) + 1
    center_x = (min(xs) + max(xs) + 1) / 2
    return len(component) + width * height * 0.04 + height * 6 - abs(center_x - 256) * 12


def znajdz_widoczny_bbox_korpusu(
    character: Image.Image,
    grass_layer: Image.Image,
    character_x: int,
    character_y: int,
    stage: str,
) -> tuple[int, int, int, int] | None:
    pixels = character.load()
    grass_alpha = grass_layer.getchannel("A").load()
    points: set[tuple[int, int]] = set()

    for local_y in range(character.height):
        screen_y = character_y + local_y
        if screen_y < 0 or screen_y >= FRAME:
            continue

        for local_x in range(character.width):
            screen_x = character_x + local_x
            if screen_x < 0 or screen_x >= FRAME or grass_alpha[screen_x, screen_y] > 8:
                continue

            r, g, b, a = pixels[local_x, local_y]
            if a <= 8 or czy_piksel_wody(r, g, b, a) or czy_piksel_liscia(r, g, b, a):
                continue

            points.add((screen_x, screen_y))

    best: list[tuple[int, int]] = []
    for component in znajdz_skladowe(points, FRAME, FRAME):
        if len(component) < 24:
            continue

        score = (
            policz_wynik_skladowej_zarodnika(component, FRAME / 2)
            if stage == "spore"
            else policz_wynik_skladowej_postaci(component, FRAME / 2)
        )
        if not best:
            best = component
            continue

        best_score = (
            policz_wynik_skladowej_zarodnika(best, FRAME / 2)
            if stage == "spore"
            else policz_wynik_skladowej_postaci(best, FRAME / 2)
        )
        if score > best_score:
            best = component

    if not best:
        return None

    xs = [point[0] for point in best]
    ys = [point[1] for point in best]
    return min(xs), min(ys), max(xs) + 1, max(ys) + 1


def dopasuj_trawe_do_etapu(grass: Image.Image, stage: str) -> Image.Image:
    bbox = grass.getchannel("A").getbbox()
    if bbox is None:
        return grass

    result = grass.copy()
    alpha = result.getchannel("A")
    pixels = alpha.load()
    base_top = max(bbox[1], GRASS_BOTTOM_Y - GRASS_VISIBLE_HEIGHT)

    for x in range(bbox[0], bbox[2]):
        chip = (x * 17 + (x // 11) * 9) % GRASS_EDGE_VARIATION
        if (x // 31) % 4 == 0:
            chip -= 12
        if (x // 47) % 5 == 0:
            chip -= 8

        local_top = max(bbox[1], min(bbox[3], base_top + chip))
        for y in range(0, local_top):
            pixels[x, y] = 0

    result.putalpha(alpha)
    visible_bbox = result.getchannel("A").getbbox()
    if visible_bbox is None:
        return result

    visible_grass = result.crop(visible_bbox)
    lowered = Image.new("RGBA", grass.size, (0, 0, 0, 0))
    target_y = min(grass.height - visible_grass.height, max(0, GRASS_BOTTOM_Y - visible_grass.height))
    lowered.alpha_composite(visible_grass, (visible_bbox[0], target_y))
    return lowered


def zbuduj_easter_eggi(grass: Image.Image, body_bottom_targets: dict[str, int]) -> None:
    for stage in STAGES:
        cutout = Image.open(NEUTRAL_EASTER_CUTOUT_DIR / f"{stage}.png").convert("RGBA")
        frames = [
            zloz_klatke_z_trawa(cutout, grass, stage, offset, None, body_bottom_targets)
            for offset in STATE_OFFSETS["idle"]
        ]

        zapisz_sheet(ASSETS / "easter-eggs" / stage / "neutral_sheet.png", frames)

        rain_cutout = Image.open(NEUTRAL_RAIN_EASTER_CUTOUT_DIR / f"{stage}.png").convert("RGBA")
        rain_frames = [
            zloz_klatke_z_parasolka(rain_cutout, grass, stage, offset, body_bottom_targets)
            for offset in STATE_OFFSETS["idle"]
        ]
        zapisz_sheet(ASSETS / "easter-eggs" / stage / "neutral_rain_sheet.png", rain_frames)


def zloz_klatke_z_parasolka(
    cutout: Image.Image,
    grass: Image.Image,
    stage: str,
    offset: tuple[int, int],
    body_bottom_targets: dict[str, int],
) -> Image.Image:
    frame = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    character = dopasuj_parasolke_do_etapu(cutout, stage)
    body_bbox = znajdz_bbox_korpusu_postaci_bez_parasolki(character, stage)
    if body_bbox is None:
        return zloz_klatke_z_trawa(cutout, grass, stage, offset, None, body_bottom_targets)

    target_bottom = get_body_bottom_target(stage, body_bottom_targets) or STAGE_LAYOUT[stage]["bottom"]
    body_center_x = (body_bbox[0] + body_bbox[2]) / 2
    x = round(FRAME / 2 - body_center_x + offset[0])
    y = round(target_bottom - body_bbox[3] + offset[1])

    x = min(FRAME - character.width, max(0, x))
    y = min(FRAME - character.height, max(0, y))

    frame.alpha_composite(dopasuj_trawe_do_etapu(grass, stage), (0, 0))
    frame.alpha_composite(character, (x, y))
    return frame


def dopasuj_parasolke_do_etapu(cutout: Image.Image, stage: str) -> Image.Image:
    body_bbox = znajdz_bbox_korpusu_postaci_bez_parasolki(cutout, stage)
    if body_bbox is None:
        return dopasuj_do_etapu(cutout, stage)

    target_body_height = policz_docelowa_wysokosc_neutralnego_korpusu(stage)
    body_height = max(1, body_bbox[3] - body_bbox[1])
    scale = target_body_height / body_height
    scale = min(scale, (FRAME - 16) / cutout.width, (FRAME - 12) / cutout.height)
    return zmien_rozmiar_pixel_art(cutout, scale)


def policz_docelowa_wysokosc_neutralnego_korpusu(stage: str) -> int:
    neutral = Image.open(NEUTRAL_EASTER_CUTOUT_DIR / f"{stage}.png").convert("RGBA")
    fitted = dopasuj_do_etapu(neutral, stage)
    body_bbox = znajdz_bbox_korpusu_postaci(fitted, stage)
    if body_bbox is None:
        return STAGE_LAYOUT[stage]["target_h"]

    return max(1, body_bbox[3] - body_bbox[1])


def get_body_bottom_target(stage: str, body_bottom_targets: dict[str, int] | None) -> int | None:
    if not body_bottom_targets:
        return None

    return body_bottom_targets.get(stage)


def znajdz_bbox_korpusu_postaci(image: Image.Image, stage: str) -> tuple[int, int, int, int] | None:
    if stage == "spore":
        body_info = znajdz_cialo_zarodnika(image)
        return body_info[0] if body_info is not None else None

    pixels = image.load()
    points: set[tuple[int, int]] = set()

    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            if a <= 8 or czy_piksel_wody(r, g, b, a) or czy_piksel_liscia(r, g, b, a):
                continue
            points.add((x, y))

    best: list[tuple[int, int]] = []
    center_x = image.width / 2
    for component in znajdz_skladowe(points, image.width, image.height):
        if len(component) < 24:
            continue

        if not best or policz_wynik_skladowej_postaci(component, center_x) > policz_wynik_skladowej_postaci(best, center_x):
            best = component

    if not best:
        return None

    xs = [point[0] for point in best]
    ys = [point[1] for point in best]
    return min(xs), min(ys), max(xs) + 1, max(ys) + 1


def znajdz_bbox_korpusu_postaci_bez_parasolki(image: Image.Image, stage: str) -> tuple[int, int, int, int] | None:
    pixels = image.load()
    points: set[tuple[int, int]] = set()

    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            if a <= 8 or czy_piksel_wody(r, g, b, a) or czy_piksel_liscia(r, g, b, a) or czy_piksel_parasolki(r, g, b, a):
                continue
            if stage == "spore" and not czy_piksel_ciala_zarodnika(r, g, b, a):
                continue
            points.add((x, y))

    best: list[tuple[int, int]] = []
    center_x = image.width / 2
    for component in znajdz_skladowe(points, image.width, image.height):
        if len(component) < 24:
            continue

        score = (
            policz_wynik_skladowej_zarodnika(component, center_x)
            if stage == "spore"
            else policz_wynik_skladowej_postaci(component, center_x)
        )
        if not best:
            best = component
            continue

        best_score = (
            policz_wynik_skladowej_zarodnika(best, center_x)
            if stage == "spore"
            else policz_wynik_skladowej_postaci(best, center_x)
        )
        if score > best_score:
            best = component

    if not best:
        return None

    xs = [point[0] for point in best]
    ys = [point[1] for point in best]
    return min(xs), min(ys), max(xs) + 1, max(ys) + 1


def policz_pozycje_postaci(
    character: Image.Image,
    stage: str,
    offset: tuple[int, int],
    body_bottom_target: int | None = None,
) -> tuple[int, int]:
    body_bbox = znajdz_bbox_korpusu_postaci(character, stage)
    if body_bbox is not None:
        if stage == "spore":
            body_center_x = (body_bbox[0] + body_bbox[2]) / 2
            x = round(FRAME / 2 - body_center_x + offset[0])
        else:
            x = round((FRAME - character.width) / 2 + offset[0])

        if body_bottom_target is not None:
            return x, round(body_bottom_target - body_bbox[3])

        if stage == "spore":
            return x, round(STAGE_LAYOUT[stage]["bottom"] - body_bbox[3] + offset[1])

    return (
        round((FRAME - character.width) / 2 + offset[0]),
        round(STAGE_LAYOUT[stage]["bottom"] - character.height + offset[1]),
    )


def get_activity_layout_override(stage: str, activity: str | None) -> dict[str, float]:
    if not activity:
        return {}

    return ACTIVITY_LAYOUT_OVERRIDES.get((stage, activity), {})


def dopasuj_do_etapu(cutout: Image.Image, stage: str, layout_override: dict[str, float] | None = None) -> Image.Image:
    image, _scale = dopasuj_do_etapu_ze_skala(cutout, stage, layout_override)
    return image


def dopasuj_do_etapu_ze_skala(
    cutout: Image.Image,
    stage: str,
    layout_override: dict[str, float] | None = None,
) -> tuple[Image.Image, float]:
    if stage == "spore":
        return dopasuj_zarodnik_do_etapu(cutout)

    layout = STAGE_LAYOUT[stage]
    override = layout_override or {}
    scale = layout["target_h"] / cutout.height * float(override.get("scale", 1.0))
    max_width = int(override.get("max_w", layout["max_w"]))
    width = round(cutout.width * scale)
    if width > max_width:
        scale = max_width / cutout.width
    width = max(1, round(cutout.width * scale))
    height = max(1, round(cutout.height * scale))
    return cutout.resize((width, height), Image.Resampling.NEAREST), scale


def dopasuj_zarodnik_do_etapu(cutout: Image.Image) -> tuple[Image.Image, float]:
    body_info = znajdz_cialo_zarodnika(cutout)
    if body_info is None:
        scale = STAGE_LAYOUT["spore"]["target_h"] / cutout.height
    else:
        body_bbox, _body_top = body_info
        body_height = max(1, body_bbox[3] - body_bbox[1])
        scale = SPORE_BODY_TARGET_H / body_height

    preview = zmien_rozmiar_pixel_art(cutout, scale)
    preview_body = znajdz_cialo_zarodnika(preview)
    if preview_body is not None:
        preview_bbox, _preview_top = preview_body
        preview_body_height = max(1, preview_bbox[3] - preview_bbox[1])
        scale *= SPORE_BODY_TARGET_H / preview_body_height

    if round(cutout.width * scale) > SPORE_FULL_MAX_W:
        scale = SPORE_FULL_MAX_W / cutout.width

    width = max(1, round(cutout.width * scale))
    height = max(1, round(cutout.height * scale))
    return cutout.resize((width, height), Image.Resampling.NEAREST), scale


def zmien_rozmiar_pixel_art(image: Image.Image, scale: float) -> Image.Image:
    width = max(1, round(image.width * scale))
    height = max(1, round(image.height * scale))
    return image.resize((width, height), Image.Resampling.NEAREST)


def usun_wode_z_podlania(cutout: Image.Image) -> tuple[Image.Image, tuple[int, int, int, int] | None]:
    water_mask = zrob_maske_wody(cutout).filter(ImageFilter.MaxFilter(3))
    character = cutout.copy()
    pixels = character.load()
    mask_pixels = water_mask.load()

    for y in range(character.height):
        for x in range(character.width):
            if mask_pixels[x, y] > 0:
                pixels[x, y] = (0, 0, 0, 0)

    component = znajdz_glowna_skladowa_alpha(character)
    if component is None:
        bbox = character.getchannel("A").point(lambda value: 255 if value > 8 else 0).getbbox()
        return character, bbox

    zachowaj_skladowa_alpha(character, component)
    xs = [point[0] for point in component]
    ys = [point[1] for point in component]
    return character, (min(xs), min(ys), max(xs) + 1, max(ys) + 1)


def znajdz_glowna_skladowa_alpha(image: Image.Image) -> list[tuple[int, int]] | None:
    alpha = image.getchannel("A")
    pixels = alpha.load()
    points: set[tuple[int, int]] = set()

    for y in range(image.height):
        for x in range(image.width):
            if pixels[x, y] > 8:
                points.add((x, y))

    if not points:
        return None

    best: list[tuple[int, int]] = []
    center_x = image.width / 2

    while points:
        start = points.pop()
        stack = [start]
        component = [start]

        while stack:
            x, y = stack.pop()
            for next_x in range(max(0, x - 1), min(image.width, x + 2)):
                for next_y in range(max(0, y - 1), min(image.height, y + 2)):
                    point = (next_x, next_y)
                    if point not in points:
                        continue

                    points.remove(point)
                    stack.append(point)
                    component.append(point)

        if len(component) < 24:
            continue

        if not best or policz_wynik_skladowej_postaci(component, center_x) > policz_wynik_skladowej_postaci(best, center_x):
            best = component

    return best or None


def policz_wynik_skladowej_postaci(component: list[tuple[int, int]], center_x: float) -> float:
    xs = [point[0] for point in component]
    ys = [point[1] for point in component]
    width = max(xs) - min(xs) + 1
    height = max(ys) - min(ys) + 1
    component_center_x = (min(xs) + max(xs) + 1) / 2
    return len(component) + width * height * 0.08 + height * 12 - abs(component_center_x - center_x) * 16


def zachowaj_skladowa_alpha(image: Image.Image, component: list[tuple[int, int]]) -> None:
    old_alpha = image.getchannel("A")
    old_pixels = old_alpha.load()
    new_alpha = Image.new("L", image.size, 0)
    new_pixels = new_alpha.load()

    for x, y in component:
        new_pixels[x, y] = old_pixels[x, y]

    image.putalpha(new_alpha)


def znajdz_gorna_krawedz_postaci(character: Image.Image) -> int:
    alpha = character.getchannel("A")
    threshold = max(6, round(character.width * 0.08))

    for y in range(character.height):
        count = 0
        for x in range(character.width):
            if alpha.getpixel((x, y)) > 8:
                count += 1

        if count >= threshold:
            return y

    return 0


def narysuj_zraszanie(
    frame: Image.Image,
    character_x: int,
    visible_top_y: int,
    character_width: int,
    character_height: int,
    frame_index: int,
    scale: float,
) -> None:
    draw = ImageDraw.Draw(frame, "RGBA")
    center_x = character_x + character_width // 2
    mist_width = max(42, round(character_width * 0.38))
    top_y = max(8, visible_top_y - max(22, round(character_height * 0.12)))
    bottom_y = max(top_y + 18, visible_top_y - 6)
    phase = frame_index % 4
    size_scale = max(1.0, min(2.0, scale * 0.42))
    droplets = [
        (-0.42, 0.10, 1),
        (-0.28, 0.34, 1),
        (-0.12, 0.18, 2),
        (0.06, 0.47, 1),
        (0.20, 0.26, 1),
        (0.34, 0.58, 2),
        (-0.02, 0.72, 1),
    ]

    for index, (x_factor, y_factor, weight) in enumerate(droplets):
        drift = ((phase + index) % 3 - 1) * max(1, round(2 * size_scale))
        progress = (y_factor + phase * 0.14 + index * 0.03) % 1
        x = center_x + round(mist_width * x_factor) + drift
        y = top_y + round((bottom_y - top_y) * progress)
        if y >= visible_top_y - 2:
            continue

        size = max(2, round((weight + 1) * size_scale))
        narysuj_pixelowa_krople(draw, x, y, size)


def narysuj_pixelowa_krople(draw: ImageDraw.ImageDraw, x: int, y: int, size: int) -> None:
    body = (84, 151, 214, 185)
    light = (221, 244, 255, 210)
    shadow = (47, 96, 170, 126)
    draw.rectangle([x, y, x + size, y + size * 2], fill=body)
    draw.rectangle([x + 1, y + 1, x + max(1, size - 1), y + size], fill=light)
    if size > 2:
        draw.rectangle([x, y + size * 2 - 1, x + size, y + size * 2], fill=shadow)


def zrob_maske_wody(image: Image.Image) -> Image.Image:
    mask = Image.new("L", image.size, 0)
    pixels = image.load()
    out = mask.load()

    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            if czy_piksel_wody(r, g, b, a):
                out[x, y] = 255

    grown = mask.filter(ImageFilter.MaxFilter(5))
    final = Image.new("L", image.size, 0)
    grown_pixels = grown.load()
    final_pixels = final.load()

    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            if a <= 8 or grown_pixels[x, y] == 0:
                continue

            blue_leaning = b > 112 and b > r - 36 and g > 30
            pale_highlight = b > 170 and g > 140 and r > 175
            if blue_leaning or pale_highlight:
                final_pixels[x, y] = 255

    return final


def czy_piksel_wody(r: int, g: int, b: int, a: int) -> bool:
    if a <= 8:
        return False

    return b >= 130 and g >= 70 and b > r + 22


def czy_piksel_parasolki(r: int, g: int, b: int, a: int) -> bool:
    if a <= 8:
        return False

    bright_violet = b > 105 and r > 75 and g < 150 and b >= g + 30 and r >= g + 18
    dark_violet = b > 44 and r > 35 and g < 80 and b >= g + 14 and r >= g + 4
    return bright_violet or dark_violet


def przygotuj_zarodnik_grzybni(cutout: Image.Image, variant_id: str) -> Image.Image:
    return stworz_zalazek_pieczarki(cutout, variant_id)


def stworz_zalazek_pieczarki(cutout: Image.Image, _variant_id: str) -> Image.Image:
    generated = wczytaj_wygenerowany_zalazek(_variant_id)
    if generated is not None:
        return generated

    image = cutout.copy()
    usun_roslinny_listek_z_zalazka(image)
    return przytnij_do_alpha(image, 14)


def usun_roslinny_listek_z_zalazka(image: Image.Image) -> None:
    body_info = znajdz_cialo_zarodnika(image)
    if body_info is None:
        return

    body_bbox, _body_top = body_info
    body_center_x = (body_bbox[0] + body_bbox[2]) / 2
    body_width = max(1, body_bbox[2] - body_bbox[0])
    pixels = image.load()
    green_points: set[tuple[int, int]] = set()

    for y in range(image.height):
        for x in range(image.width):
            if czy_piksel_liscia(*pixels[x, y]):
                green_points.add((x, y))

    for component in znajdz_skladowe(green_points, image.width, image.height):
        xs = [point[0] for point in component]
        ys = [point[1] for point in component]
        bbox = (min(xs), min(ys), max(xs) + 1, max(ys) + 1)
        component_center_x = (bbox[0] + bbox[2]) / 2
        touches_head = bbox[3] >= body_bbox[1] - 10 and bbox[1] <= body_bbox[1] + 30
        centered = abs(component_center_x - body_center_x) <= max(45, body_width * 0.65)

        if len(component) > 8 and touches_head and centered:
            for x, y in component:
                pixels[x, y] = (0, 0, 0, 0)


def usun_odklejone_paski_zarodnika(image: Image.Image) -> Image.Image:
    result = image.copy()
    body_info = znajdz_cialo_zarodnika(result)
    if body_info is None:
        return result

    body_bbox, _body_top = body_info
    body_width = max(1, body_bbox[2] - body_bbox[0])
    alpha = result.getchannel("A")
    pixels = result.load()
    points: set[tuple[int, int]] = set()

    for y in range(result.height):
        for x in range(result.width):
            if alpha.getpixel((x, y)) > 8:
                points.add((x, y))

    for component in znajdz_skladowe(points, result.width, result.height):
        xs = [point[0] for point in component]
        ys = [point[1] for point in component]
        bbox = (min(xs), min(ys), max(xs) + 1, max(ys) + 1)
        width = bbox[2] - bbox[0]
        height = bbox[3] - bbox[1]
        separated_above_body = bbox[3] <= body_bbox[1] - 18
        strip_like = height <= 20 and width >= max(18, round(body_width * 0.35))

        if separated_above_body and strip_like:
            for x, y in component:
                pixels[x, y] = (0, 0, 0, 0)

    return przytnij_do_alpha(result, 14)


def znajdz_skladowe(points: set[tuple[int, int]], width: int, height: int) -> list[list[tuple[int, int]]]:
    remaining = set(points)
    components: list[list[tuple[int, int]]] = []

    while remaining:
        start = remaining.pop()
        stack = [start]
        component = [start]

        while stack:
            x, y = stack.pop()
            for next_x in range(max(0, x - 1), min(width, x + 2)):
                for next_y in range(max(0, y - 1), min(height, y + 2)):
                    point = (next_x, next_y)
                    if point not in remaining:
                        continue

                    remaining.remove(point)
                    stack.append(point)
                    component.append(point)

        components.append(component)

    return components


def wczytaj_wygenerowany_zalazek(variant_id: str) -> Image.Image | None:
    global _SPORE_GENERATED_CACHE

    if _SPORE_GENERATED_CACHE is None:
        _SPORE_GENERATED_CACHE = {}
        if SPORE_GENERATED_ATLAS.exists():
            _SPORE_GENERATED_CACHE = wytnij_wygenerowane_zalazki(SPORE_GENERATED_ATLAS)

    cached = _SPORE_GENERATED_CACHE.get(variant_id)
    return cached.copy() if cached is not None else None


def wytnij_wygenerowane_zalazki(path: Path) -> dict[str, Image.Image]:
    atlas = Image.open(path).convert("RGBA")
    atlas = usun_chroma_key(atlas)
    cols = 5
    rows = 4
    cutouts: dict[str, Image.Image] = {}

    for index, variant_id in enumerate(SPORE_GENERATED_VARIANTS):
        col = index % cols
        row = index // cols
        left = round(col * atlas.width / cols)
        right = round((col + 1) * atlas.width / cols)
        top = round(row * atlas.height / rows)
        bottom = round((row + 1) * atlas.height / rows)
        cell = atlas.crop((left, top, right, bottom))
        bbox = cell.getchannel("A").point(lambda value: 255 if value > 8 else 0).getbbox()
        if bbox is None:
            raise RuntimeError(f"Pusta komorka wygenerowanego zarodka: {variant_id}.")
        pad = 14
        cutouts[variant_id] = cell.crop(
            (
                max(0, bbox[0] - pad),
                max(0, bbox[1] - pad),
                min(cell.width, bbox[2] + pad),
                min(cell.height, bbox[3] + pad),
            )
        )

    return cutouts


def narysuj_fletnie_zalazka(draw: ImageDraw.ImageDraw) -> None:
    outline = (75, 45, 32, 238)
    wood = (166, 103, 50, 250)
    light = (226, 166, 82, 236)
    shadow = (99, 58, 35, 230)

    draw.rectangle((76, 102, 113, 126), fill=outline)
    for index, x in enumerate(range(80, 108, 6)):
        height = 15 + index * 2
        draw.rectangle((x, 106, x + 4, 106 + height), fill=wood)
        draw.rectangle((x + 1, 107, x + 2, 106 + height - 2), fill=light)
        draw.rectangle((x + 3, 109, x + 4, 106 + height), fill=shadow)
    draw.rectangle((78, 101, 111, 106), fill=(207, 137, 65, 242))


def narysuj_trabke_zalazka(draw: ImageDraw.ImageDraw) -> None:
    outline = (82, 55, 35, 234)
    brass = (224, 156, 56, 245)
    bright = (255, 213, 96, 230)
    dark = (142, 88, 42, 225)

    draw.rectangle((91, 104, 118, 111), fill=outline)
    draw.rectangle((94, 105, 117, 109), fill=brass)
    draw.rectangle((117, 100, 135, 115), fill=outline)
    draw.rectangle((120, 102, 137, 113), fill=brass)
    draw.rectangle((127, 99, 140, 116), fill=bright)
    draw.rectangle((116, 112, 122, 121), fill=outline)
    draw.rectangle((118, 113, 123, 119), fill=dark)


def narysuj_bebenek_zalazka(draw: ImageDraw.ImageDraw) -> None:
    outline = (76, 47, 36, 236)
    rim = (222, 172, 98, 238)
    skin = (247, 219, 156, 236)
    body = (149, 92, 56, 236)
    blue = (92, 137, 177, 225)

    draw.rectangle((51, 104, 80, 127), fill=outline)
    draw.rectangle((55, 106, 78, 124), fill=body)
    draw.rectangle((55, 102, 78, 110), fill=rim)
    draw.rectangle((58, 104, 75, 108), fill=skin)
    draw.rectangle((58, 114, 62, 119), fill=blue)
    draw.rectangle((70, 114, 74, 119), fill=blue)
    draw.rectangle((80, 96, 93, 100), fill=outline)
    draw.rectangle((83, 94, 95, 97), fill=(237, 204, 130, 224))


def narysuj_flet_zalazka(draw: ImageDraw.ImageDraw) -> None:
    outline = (63, 48, 39, 230)
    reed = (201, 137, 66, 238)
    light = (251, 205, 112, 224)
    hole = (76, 50, 42, 238)

    draw.rectangle((59, 98, 127, 108), fill=outline)
    draw.rectangle((62, 100, 124, 105), fill=reed)
    draw.rectangle((64, 100, 121, 102), fill=light)
    for x in (77, 89, 101, 113):
        draw.rectangle((x, 103, x + 3, 106), fill=hole)


def narysuj_pixelowa_nutke(draw: ImageDraw.ImageDraw, x: int, y: int) -> None:
    color = (99, 72, 49, 225)
    draw.rectangle((x + 8, y, x + 11, y + 22), fill=color)
    draw.rectangle((x + 11, y, x + 20, y + 4), fill=color)
    draw.rectangle((x, y + 18, x + 9, y + 27), fill=color)


def czy_piksel_liscia(r: int, g: int, b: int, a: int) -> bool:
    if a <= 8:
        return False

    green = g > 60 and g > r + 8 and g > b + 8
    yellow_green = g > 75 and r > 70 and b < 120 and g >= r - 8 and g > b + 16
    return green or yellow_green


def znajdz_cialo_zarodnika(image: Image.Image) -> tuple[tuple[int, int, int, int], int] | None:
    pixels = image.load()
    points: set[tuple[int, int]] = set()

    for y in range(image.height):
        for x in range(image.width):
            if czy_piksel_ciala_zarodnika(*pixels[x, y]):
                points.add((x, y))

    if not points:
        return None

    best: list[tuple[int, int]] = []
    center_x = image.width / 2

    while points:
        start = points.pop()
        stack = [start]
        component = [start]

        while stack:
            x, y = stack.pop()
            for next_x in range(max(0, x - 1), min(image.width, x + 2)):
                for next_y in range(max(0, y - 1), min(image.height, y + 2)):
                    point = (next_x, next_y)
                    if point not in points:
                        continue

                    points.remove(point)
                    stack.append(point)
                    component.append(point)

        if not best:
            best = component
            continue

        component_score = policz_wynik_skladowej_zarodnika(component, center_x)
        best_score = policz_wynik_skladowej_zarodnika(best, center_x)
        if component_score > best_score:
            best = component

    if not best:
        return None

    xs = [point[0] for point in best]
    ys = [point[1] for point in best]
    body_bbox = (min(xs), min(ys), max(xs) + 1, max(ys) + 1)
    return body_bbox, body_bbox[1]


def czy_piksel_ciala_zarodnika(r: int, g: int, b: int, a: int) -> bool:
    if a <= 8 or czy_piksel_wody(r, g, b, a) or czy_piksel_liscia(r, g, b, a):
        return False

    if r > 225 and g > 225 and b > 218 and max(r, g, b) - min(r, g, b) < 28:
        return False

    warm = r > 125 and g > 60 and b < 220 and r >= g - 40
    brown = r > 55 and g > 25 and b < 100 and r >= g - 15
    blush = r > 160 and g > 60 and b > 75 and r > g + 35
    dark = r < 105 and g < 85 and b < 85
    return warm or brown or blush or dark


def policz_wynik_skladowej_zarodnika(component: list[tuple[int, int]], center_x: float) -> float:
    xs = [point[0] for point in component]
    ys = [point[1] for point in component]
    width = max(xs) - min(xs) + 1
    height = max(ys) - min(ys) + 1
    component_center_x = (min(xs) + max(xs) + 1) / 2
    return len(component) + width * height * 0.08 - abs(component_center_x - center_x) * 4


def przytnij_do_alpha(image: Image.Image, pad: int = 0) -> Image.Image:
    bbox = image.getchannel("A").point(lambda value: 255 if value > 8 else 0).getbbox()
    if bbox is None:
        return image

    return image.crop(
        (
            max(0, bbox[0] - pad),
            max(0, bbox[1] - pad),
            min(image.width, bbox[2] + pad),
            min(image.height, bbox[3] + pad),
        )
    )


def zloz_efekt(cutout: Image.Image, offset: tuple[int, int]) -> Image.Image:
    frame = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    effect = dopasuj_efekt(cutout)
    x = round((FRAME - effect.width) / 2 + offset[0])
    y = round((FRAME - effect.height) / 2 + offset[1])
    frame.alpha_composite(effect, (x, y))
    return frame


def dopasuj_efekt(cutout: Image.Image) -> Image.Image:
    max_size = 210
    scale = min(max_size / cutout.width, max_size / cutout.height)
    width = max(1, round(cutout.width * scale))
    height = max(1, round(cutout.height * scale))
    return cutout.resize((width, height), Image.Resampling.NEAREST)


def zapisz_sheet(path: Path, frames: list[Image.Image]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    sheet = Image.new("RGBA", (FRAME * len(frames), FRAME), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        sheet.alpha_composite(frame, (index * FRAME, 0))
    sheet.save(path)


def zapisz_cutout(kind: str, name: str, stage: str, cutout: Image.Image) -> None:
    path = CUTOUT_DIR / kind / name / f"{stage}.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    cutout.save(path)


def zapisz_obraz(path: Path, image: Image.Image) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path)


if __name__ == "__main__":
    main()
