#!/usr/bin/env python3
"""Buduje runtime sprite sheety z atlasow wygenerowanych przez image generator."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
RAW_DIR = ASSETS / "source" / "imagegen" / "raw"
CUTOUT_DIR = ASSETS / "source" / "imagegen" / "cutouts"
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
    "spore": {"target_h": 132, "max_w": 240, "bottom": 424, "grass_behind": True},
    "baby": {"target_h": 246, "max_w": 310, "bottom": 415, "grass_behind": True},
    "young": {"target_h": 342, "max_w": 380, "bottom": 438, "grass_behind": True},
    "adult": {"target_h": 430, "max_w": 456, "bottom": 454},
    "legendary": {"target_h": 430, "max_w": 470, "bottom": 454},
}

SPORE_BODY_TARGET_H = 96
SPORE_FULL_MAX_W = 430
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
    zbuduj_stany(grass)
    zbuduj_aktywnosci(grass)
    zbuduj_efekty()
    print("Zbudowano imagegenowe sprite sheety.")


def sprawdz_zrodla() -> None:
    wymagane = [f"{name}_atlas.png" for name in [*STATES, *ACTIVITIES, "effects"]]
    brakujace = [name for name in wymagane if not (RAW_DIR / name).exists()]
    if brakujace:
        raise FileNotFoundError("Brak atlasow imagegen: " + ", ".join(brakujace))


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


def zbuduj_stany(grass: Image.Image) -> None:
    for state in STATES:
        atlas = wczytaj_atlas(state)
        cutouts = przygotuj_cutouty_etapow(atlas, state)
        for stage, cutout in zip(STAGES, cutouts):
            zapisz_cutout("states", state, stage, cutout)
            offsets = STATE_OFFSETS[state]
            if stage == "spore" and state == "wake":
                offsets = [(x, y - 7) for x, y in offsets]
            frames = [
                zloz_klatke_z_trawa(cutout, grass, stage, offset)
                for offset in offsets
            ]
            zapisz_sheet(ASSETS / "stages" / stage / f"{state}_sheet.png", frames)


def zbuduj_aktywnosci(grass: Image.Image) -> None:
    for activity in ACTIVITIES:
        atlas = wczytaj_atlas(activity)
        cutouts = przygotuj_cutouty_etapow(atlas, activity)
        for stage, cutout in zip(STAGES, cutouts):
            zapisz_cutout("activities", activity, stage, cutout)
            if activity == "hydrate":
                frames = [
                    zloz_klatke_podlania(cutout, grass, stage, offset, frame_index)
                    for frame_index, offset in enumerate(ACTIVITY_OFFSETS[activity])
                ]
            else:
                frames = [
                    zloz_klatke_z_trawa(cutout, grass, stage, offset)
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


def zloz_klatke_z_trawa(cutout: Image.Image, grass: Image.Image, stage: str, offset: tuple[int, int]) -> Image.Image:
    frame = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    character = dopasuj_do_etapu(cutout, stage)
    x, y = policz_pozycje_postaci(character, stage, offset)
    if STAGE_LAYOUT[stage].get("grass_behind"):
        frame.alpha_composite(grass, (0, 0))
        frame.alpha_composite(character, (x, y))
    else:
        frame.alpha_composite(character, (x, y))
        frame.alpha_composite(grass, (0, 0))
    return frame


def zloz_klatke_podlania(
    cutout: Image.Image,
    grass: Image.Image,
    stage: str,
    offset: tuple[int, int],
    frame_index: int,
) -> Image.Image:
    character_layer, character_bbox = usun_wode_z_podlania(cutout)
    if character_bbox is None:
        return zloz_klatke_z_trawa(cutout, grass, stage, offset)

    character_source = character_layer.crop(character_bbox)
    character, scale = dopasuj_do_etapu_ze_skala(character_source, stage)
    character_x, character_y = policz_pozycje_postaci(character, stage, offset)
    visible_top_y = character_y + znajdz_gorna_krawedz_postaci(character)

    frame = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    if STAGE_LAYOUT[stage].get("grass_behind"):
        frame.alpha_composite(grass, (0, 0))
        frame.alpha_composite(character, (character_x, character_y))
    else:
        frame.alpha_composite(character, (character_x, character_y))
        frame.alpha_composite(grass, (0, 0))

    narysuj_zraszanie(frame, character_x, visible_top_y, character.width, character.height, frame_index, scale)
    return frame


def policz_pozycje_postaci(character: Image.Image, stage: str, offset: tuple[int, int]) -> tuple[int, int]:
    if stage == "spore":
        body_info = znajdz_cialo_zarodnika(character)
        if body_info is not None:
            body_bbox, _body_top = body_info
            body_center_x = (body_bbox[0] + body_bbox[2]) / 2
            return (
                round(FRAME / 2 - body_center_x + offset[0]),
                round(STAGE_LAYOUT[stage]["bottom"] - body_bbox[3] + offset[1]),
            )

    return (
        round((FRAME - character.width) / 2 + offset[0]),
        round(STAGE_LAYOUT[stage]["bottom"] - character.height + offset[1]),
    )


def dopasuj_do_etapu(cutout: Image.Image, stage: str) -> Image.Image:
    image, _scale = dopasuj_do_etapu_ze_skala(cutout, stage)
    return image


def dopasuj_do_etapu_ze_skala(cutout: Image.Image, stage: str) -> tuple[Image.Image, float]:
    if stage == "spore":
        return dopasuj_zarodnik_do_etapu(cutout)

    layout = STAGE_LAYOUT[stage]
    scale = layout["target_h"] / cutout.height
    width = round(cutout.width * scale)
    if width > layout["max_w"]:
        scale = layout["max_w"] / cutout.width
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

    bbox = character.getchannel("A").point(lambda value: 255 if value > 8 else 0).getbbox()
    return character, bbox


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


if __name__ == "__main__":
    main()
