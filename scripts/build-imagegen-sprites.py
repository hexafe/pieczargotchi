#!/usr/bin/env python3
"""Buduje runtime sprite sheety z atlasow wygenerowanych przez image generator."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageChops, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
RAW_DIR = ASSETS / "source" / "imagegen" / "raw"
CUTOUT_DIR = ASSETS / "source" / "imagegen" / "cutouts"
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
    "spore": {"target_h": 176, "max_w": 300, "bottom": 424, "grass_behind": True},
    "baby": {"target_h": 246, "max_w": 310, "bottom": 415, "grass_behind": True},
    "young": {"target_h": 342, "max_w": 380, "bottom": 438, "grass_behind": True},
    "adult": {"target_h": 430, "max_w": 456, "bottom": 454},
    "legendary": {"target_h": 430, "max_w": 470, "bottom": 454},
}

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
    "spores": [(0, 0), (0, -1), (0, -1), (0, 0)],
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
    return ImageChops.multiply(dilated, alpha.point(lambda value: 255 if value > 8 else 0))


def zbuduj_stany(grass: Image.Image) -> None:
    for state in STATES:
        atlas = wczytaj_atlas(state)
        cutouts = wytnij_etapy(atlas)
        for stage, cutout in zip(STAGES, cutouts):
            zapisz_cutout("states", state, stage, cutout)
            frames = [
                zloz_klatke_z_trawa(cutout, grass, stage, offset)
                for offset in STATE_OFFSETS[state]
            ]
            zapisz_sheet(ASSETS / "stages" / stage / f"{state}_sheet.png", frames)


def zbuduj_aktywnosci(grass: Image.Image) -> None:
    for activity in ACTIVITIES:
        atlas = wczytaj_atlas(activity)
        cutouts = wytnij_etapy(atlas)
        for stage, cutout in zip(STAGES, cutouts):
            zapisz_cutout("activities", activity, stage, cutout)
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
    x = round((FRAME - character.width) / 2 + offset[0])
    y = round(STAGE_LAYOUT[stage]["bottom"] - character.height + offset[1])
    if STAGE_LAYOUT[stage].get("grass_behind"):
        frame.alpha_composite(grass, (0, 0))
        frame.alpha_composite(character, (x, y))
    else:
        frame.alpha_composite(character, (x, y))
        frame.alpha_composite(grass, (0, 0))
    return frame


def dopasuj_do_etapu(cutout: Image.Image, stage: str) -> Image.Image:
    layout = STAGE_LAYOUT[stage]
    scale = layout["target_h"] / cutout.height
    width = round(cutout.width * scale)
    if width > layout["max_w"]:
        scale = layout["max_w"] / cutout.width
    width = max(1, round(cutout.width * scale))
    height = max(1, round(cutout.height * scale))
    return cutout.resize((width, height), Image.Resampling.NEAREST)


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
