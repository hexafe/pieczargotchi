#!/usr/bin/env python3
"""Generuje robocze, spójne stylistycznie sprite sheety Pieczargotchi."""

from __future__ import annotations

import runpy
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageChops, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
FRAME = 512
BASE_FACE = {
    "left": (214, 263),
    "right": (298, 263),
    "mouth": (255, 310),
    "skin": (248, 211, 155),
}


STAGES = {
    "spore": {
        "kind": "spore",
        "tint": (198, 231, 154, 34),
        "faceScale": 0.58,
    },
    "baby": {
        "kind": "mushroom",
        "mushroomScale": 0.58,
        "mushroomBottom": 410,
        "tint": None,
        "faceScale": 0.62,
    },
    "young": {
        "kind": "mushroom",
        "mushroomScale": 0.80,
        "mushroomBottom": 432,
        "tint": (242, 252, 183, 24),
        "faceScale": 0.82,
    },
    "adult": {
        "kind": "mushroom",
        "mushroomScale": 1.00,
        "mushroomBottom": None,
        "tint": None,
        "faceScale": 1.00,
    },
    "legendary": {
        "kind": "mushroom",
        "mushroomScale": 1.00,
        "mushroomBottom": None,
        "cape": True,
        "tint": (255, 244, 159, 44),
        "faceScale": 1.00,
    },
}


def main() -> None:
    imagegen_builder = ROOT / "scripts" / "build-imagegen-sprites.py"
    imagegen_source = ASSETS / "source" / "imagegen" / "raw" / "idle_atlas.png"
    if imagegen_builder.exists() and imagegen_source.exists():
        runpy.run_path(str(imagegen_builder), run_name="__main__")
        return

    awake = Image.open(ASSETS / "awake.png").convert("RGBA")
    layers = przygotuj_warstwy(awake)
    dopasuj_twarze_do_warstw(layers)

    for stage in STAGES:
        zrob_animacje_etapu(stage, layers)

    zrob_animacje_aktywnosci(layers)
    zrob_animacje_efektow()
    print("Wygenerowano assety etapów i aktywności.")


def przygotuj_warstwy(reference: Image.Image) -> dict[str, Image.Image | tuple[int, int, int, int]]:
    grass_mask = zrob_maske_trawy(reference)
    mushroom_mask = ImageChops.subtract(reference.getchannel("A"), grass_mask)
    mushroom_mask = wyczysc_maske_pieczarki(reference, mushroom_mask)
    mushroom_layer = Image.new("RGBA", reference.size, (0, 0, 0, 0))
    grass_layer = Image.new("RGBA", reference.size, (0, 0, 0, 0))
    mushroom_layer.alpha_composite(Image.composite(reference, Image.new("RGBA", reference.size, (0, 0, 0, 0)), mushroom_mask))
    grass_layer.alpha_composite(Image.composite(reference, Image.new("RGBA", reference.size, (0, 0, 0, 0)), grass_mask))

    mushroom_bbox = mushroom_layer.getchannel("A").getbbox()
    if mushroom_bbox is None:
        raise RuntimeError("Nie udało się wydzielić warstwy pieczarki z assets/awake.png.")

    return {
        "mushroom": mushroom_layer,
        "grass": grass_layer,
        "mushroom_bbox": mushroom_bbox,
    }


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


def wyczysc_maske_pieczarki(reference: Image.Image, mask: Image.Image) -> Image.Image:
    cleaned = mask.copy()
    pixels = reference.load()
    out = cleaned.load()

    for y in range(reference.height):
        for x in range(reference.width):
            if out[x, y] <= 0:
                continue

            r, g, b, _ = pixels[x, y]
            greenish = g > 45 and g > r + 8 and g > b + 8
            side_grass_zone = y > 340 and (x < 150 or x > 362)
            lower_grass_zone = y > 430

            if greenish or side_grass_zone or lower_grass_zone:
                out[x, y] = 0

    return cleaned


def dopasuj_twarze_do_warstw(layers: dict[str, Image.Image | tuple[int, int, int, int]]) -> None:
    bbox = layers["mushroom_bbox"]
    assert isinstance(bbox, tuple)

    for profil in STAGES.values():
        if profil["kind"] == "spore":
            profil["face"] = {
                "left": (238, 263),
                "right": (268, 263),
                "mouth": (253, 294),
                "skin": (225, 167, 107),
            }
            continue

        paste_x, paste_y, scale = policz_pozycje_pieczarki(profil, bbox)
        profil["face"] = {
            "left": przelicz_punkt_twarzy(BASE_FACE["left"], bbox, paste_x, paste_y, scale),
            "right": przelicz_punkt_twarzy(BASE_FACE["right"], bbox, paste_x, paste_y, scale),
            "mouth": przelicz_punkt_twarzy(BASE_FACE["mouth"], bbox, paste_x, paste_y, scale),
            "skin": BASE_FACE["skin"],
        }


def przelicz_punkt_twarzy(point: tuple[int, int], bbox: tuple[int, int, int, int], paste_x: int, paste_y: int, scale: float) -> tuple[int, int]:
    return (
        round(paste_x + (point[0] - bbox[0]) * scale),
        round(paste_y + (point[1] - bbox[1]) * scale),
    )


def podziel_sheet(sheet: Image.Image) -> list[Image.Image]:
    return [sheet.crop((x, 0, x + FRAME, FRAME)).copy() for x in range(0, sheet.width, FRAME)]


def zrob_animacje_etapu(stage: str, layers: dict[str, Image.Image | tuple[int, int, int, int]]) -> None:
    katalog = ASSETS / "stages" / stage
    katalog.mkdir(parents=True, exist_ok=True)

    def baza(offset_x: int = 0, offset_y: int = 0) -> Image.Image:
        return zrob_baze_etapu(stage, layers, offset_x, offset_y)

    zapisz_sheet(katalog / "idle_sheet.png", [
        twarz(baza(0, 0), stage, "normal"),
        twarz(baza(0, -1), stage, "normal"),
        twarz(baza(0, 0), stage, "normal"),
        twarz(baza(0, 1), stage, "blink"),
    ])

    zapisz_sheet(katalog / "sleep_sheet.png", [
        dodaj_sen(twarz(baza(0, 0), stage, "sleep"), stage, 0),
        dodaj_sen(twarz(baza(0, -1), stage, "sleep"), stage, 1),
        dodaj_sen(twarz(baza(0, 0), stage, "sleep"), stage, 2),
        dodaj_sen(twarz(baza(0, 1), stage, "sleep"), stage, 3),
    ])

    zapisz_sheet(katalog / "wake_sheet.png", [
        twarz(baza(-1, 1), stage, "wake"),
        twarz(baza(1, -1), stage, "wake"),
        twarz(baza(0, 0), stage, "surprised"),
        twarz(baza(0, 0), stage, "normal"),
    ])

    zapisz_sheet(katalog / "happy_sheet.png", [
        dodaj_radosc(twarz(baza(0, 0), stage, "happy"), stage, 0),
        dodaj_radosc(twarz(baza(0, -2), stage, "happy"), stage, 1),
        dodaj_radosc(twarz(baza(0, -1), stage, "happy"), stage, 2),
        dodaj_radosc(twarz(baza(0, 0), stage, "normal"), stage, 3),
    ])

    zapisz_sheet(katalog / "excellent_sheet.png", [
        dodaj_doskonalosc(twarz(baza(0, -1), stage, "happy"), stage, 0),
        dodaj_doskonalosc(twarz(baza(0, -2), stage, "happy"), stage, 1),
        dodaj_doskonalosc(twarz(baza(0, -1), stage, "happy"), stage, 2),
        dodaj_doskonalosc(twarz(baza(0, 0), stage, "happy"), stage, 3),
    ])

    zapisz_sheet(katalog / "tired_sheet.png", [
        dodaj_sennosc(twarz(baza(0, 2), stage, "tired"), stage, 0),
        dodaj_sennosc(twarz(baza(0, 3), stage, "tired"), stage, 1),
        dodaj_sennosc(twarz(baza(0, 2), stage, "blink"), stage, 2),
        dodaj_sennosc(twarz(baza(0, 3), stage, "tired"), stage, 3),
    ])

    zapisz_sheet(katalog / "dry_sheet.png", [
        dodaj_suchosc(twarz(baza(0, 1), stage, "dry"), stage, 0),
        dodaj_suchosc(twarz(baza(0, 2), stage, "dry"), stage, 1),
        dodaj_suchosc(twarz(baza(0, 1), stage, "dry"), stage, 2),
        dodaj_suchosc(twarz(baza(0, 2), stage, "blink"), stage, 3),
    ])

    zapisz_sheet(katalog / "hungry_sheet.png", [
        dodaj_glod(twarz(baza(0, 0), stage, "worried"), stage, 0),
        dodaj_glod(twarz(baza(-1, 0), stage, "worried"), stage, 1),
        dodaj_glod(twarz(baza(0, 1), stage, "worried"), stage, 2),
        dodaj_glod(twarz(baza(1, 0), stage, "normal"), stage, 3),
    ])

    zapisz_sheet(katalog / "dirty_sheet.png", [
        dodaj_brud(twarz(baza(0, 0), stage, "worried"), stage, 0),
        dodaj_brud(twarz(baza(0, 1), stage, "worried"), stage, 1),
        dodaj_brud(twarz(baza(0, 0), stage, "blink"), stage, 2),
        dodaj_brud(twarz(baza(0, 1), stage, "worried"), stage, 3),
    ])

    zapisz_sheet(katalog / "sick_sheet.png", [
        dodaj_chorobe(twarz(baza(-1, 0), stage, "sick"), stage, 0),
        dodaj_chorobe(twarz(baza(1, 1), stage, "sick"), stage, 1),
        dodaj_chorobe(twarz(baza(-1, 0), stage, "blink"), stage, 2),
        dodaj_chorobe(twarz(baza(1, 1), stage, "sick"), stage, 3),
    ])

    zapisz_sheet(katalog / "critical_sheet.png", [
        dodaj_alarm(twarz(baza(-3, 0), stage, "critical"), stage, 0),
        dodaj_alarm(twarz(baza(3, 0), stage, "critical"), stage, 1),
        dodaj_alarm(twarz(baza(-2, 1), stage, "critical"), stage, 2),
        dodaj_alarm(twarz(baza(2, -1), stage, "critical"), stage, 3),
    ])


def zrob_animacje_aktywnosci(layers: dict[str, Image.Image | tuple[int, int, int, int]]) -> None:
    katalog = ASSETS / "activities"
    katalog.mkdir(parents=True, exist_ok=True)

    def baza(stage: str = "baby", offset_x: int = 0, offset_y: int = 0) -> Image.Image:
        return zrob_baze_etapu(stage, layers, offset_x, offset_y)

    zapisz_sheet(katalog / "hydrate_sheet.png", [
        dodaj_krople(twarz(baza("baby", 0, 0), "baby", "normal"), 0),
        dodaj_krople(twarz(baza("baby", 0, -2), "baby", "happy"), 1),
        dodaj_krople(twarz(baza("baby", 0, -1), "baby", "happy"), 2),
        dodaj_krople(twarz(baza("baby", 0, 0), "baby", "normal"), 3),
    ])

    zapisz_sheet(katalog / "feed_sheet.png", [
        dodaj_kompost(twarz(baza("baby", 0, 0), "baby", "normal"), 0),
        dodaj_kompost(twarz(baza("baby", -1, 0), "baby", "happy"), 1),
        dodaj_kompost(twarz(baza("baby", 1, -1), "baby", "happy"), 2),
        dodaj_kompost(twarz(baza("baby", 0, 0), "baby", "normal"), 3),
    ])

    zapisz_sheet(katalog / "clean_sheet.png", [
        dodaj_czyszczenie(twarz(baza("baby", 0, 0), "baby", "normal"), 0),
        dodaj_czyszczenie(twarz(baza("baby", 0, -1), "baby", "happy"), 1),
        dodaj_czyszczenie(twarz(baza("baby", 0, 0), "baby", "happy"), 2),
        dodaj_czyszczenie(twarz(baza("baby", 0, 0), "baby", "normal"), 3),
    ])

    zapisz_sheet(katalog / "play_sheet.png", [
        dodaj_zabawe(twarz(baza("young", -2, 0), "young", "happy"), 0),
        dodaj_zabawe(twarz(baza("young", 2, -3), "young", "happy"), 1),
        dodaj_zabawe(twarz(baza("young", -1, -1), "young", "happy"), 2),
        dodaj_zabawe(twarz(baza("young", 0, 0), "young", "normal"), 3),
    ])

    zapisz_sheet(katalog / "instrument_sheet.png", [
        dodaj_instrument(twarz(baza("young", 0, 0), "young", "normal"), 0),
        dodaj_instrument(twarz(baza("young", -1, 0), "young", "happy"), 1),
        dodaj_instrument(twarz(baza("young", 1, -1), "young", "happy"), 2),
        dodaj_instrument(twarz(baza("young", 0, 0), "young", "normal"), 3),
    ])

    zapisz_sheet(katalog / "sing_sheet.png", [
        dodaj_spiew(twarz(baza("young", 0, 0), "young", "sing"), 0),
        dodaj_spiew(twarz(baza("young", 0, -1), "young", "sing"), 1),
        dodaj_spiew(twarz(baza("young", 0, 0), "young", "happy"), 2),
        dodaj_spiew(twarz(baza("young", 0, 0), "young", "normal"), 3),
    ])

    zapisz_sheet(katalog / "spores_sheet.png", [
        dodaj_zarodniki(twarz(baza("adult", 0, 0), "adult", "normal"), 0),
        dodaj_zarodniki(twarz(baza("adult", 0, -1), "adult", "happy"), 1),
        dodaj_zarodniki(twarz(baza("adult", 0, 0), "adult", "happy"), 2),
        dodaj_zarodniki(twarz(baza("adult", 0, 0), "adult", "normal"), 3),
    ])

    zapisz_sheet(katalog / "harvest_sheet.png", [
        dodaj_plon(twarz(baza("adult", 0, 0), "adult", "normal"), 0),
        dodaj_plon(twarz(baza("adult", 0, -1), "adult", "happy"), 1),
        dodaj_plon(twarz(baza("legendary", 0, 0), "legendary", "happy"), 2),
        dodaj_plon(twarz(baza("adult", 0, 0), "adult", "normal"), 3),
    ])


def zrob_animacje_efektow() -> None:
    katalog = ASSETS / "effects"
    katalog.mkdir(parents=True, exist_ok=True)

    zapisz_sheet(katalog / "drops_sheet.png", [
        efekt_krople(0),
        efekt_krople(1),
        efekt_krople(2),
        efekt_krople(3),
    ])

    zapisz_sheet(katalog / "sparkle_sheet.png", [
        efekt_blyski(0),
        efekt_blyski(1),
        efekt_blyski(2),
        efekt_blyski(3),
    ])

    zapisz_sheet(katalog / "dust_sheet.png", [
        efekt_pyl(0),
        efekt_pyl(1),
        efekt_pyl(2),
        efekt_pyl(3),
    ])

    zapisz_sheet(katalog / "notes_sheet.png", [
        efekt_nutki(0),
        efekt_nutki(1),
        efekt_nutki(2),
        efekt_nutki(3),
    ])

    zapisz_sheet(katalog / "spore_cloud_sheet.png", [
        efekt_zarodniki(0),
        efekt_zarodniki(1),
        efekt_zarodniki(2),
        efekt_zarodniki(3),
    ])


def zrob_baze_etapu(stage: str, layers: dict[str, Image.Image | tuple[int, int, int, int]], offset_x: int = 0, offset_y: int = 0) -> Image.Image:
    profil = STAGES[stage]
    frame = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))

    if profil["kind"] == "spore":
        rysuj_zarodnik(frame, offset_x, offset_y)
    else:
        if profil.get("cape"):
            rysuj_peleryne(frame, stage, layers, offset_x, offset_y)
        mushroom_layer = zrob_warstwe_pieczarki(profil, layers, offset_x, offset_y)
        tint = profil.get("tint")
        if tint:
            mushroom_layer = naloz_tint(mushroom_layer, tint)
        frame.alpha_composite(mushroom_layer)

    grass = layers["grass"]
    assert isinstance(grass, Image.Image)
    frame.alpha_composite(grass)
    dodaj_dekoracje_etapu(frame, stage)
    return frame


def zrob_warstwe_pieczarki(profil: dict, layers: dict[str, Image.Image | tuple[int, int, int, int]], offset_x: int, offset_y: int) -> Image.Image:
    mushroom = layers["mushroom"]
    bbox = layers["mushroom_bbox"]
    assert isinstance(mushroom, Image.Image)
    assert isinstance(bbox, tuple)

    crop = mushroom.crop(bbox)
    paste_x, paste_y, scale = policz_pozycje_pieczarki(profil, bbox)
    width = max(1, round(crop.width * scale))
    height = max(1, round(crop.height * scale))
    resized = crop.resize((width, height), Image.Resampling.NEAREST)
    layer = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    layer.alpha_composite(resized, (paste_x + offset_x, paste_y + offset_y))
    return layer


def policz_pozycje_pieczarki(profil: dict, bbox: tuple[int, int, int, int]) -> tuple[int, int, float]:
    scale = profil["mushroomScale"]
    width = round((bbox[2] - bbox[0]) * scale)
    height = round((bbox[3] - bbox[1]) * scale)
    bottom = profil["mushroomBottom"] if profil["mushroomBottom"] is not None else bbox[3]
    paste_x = round((FRAME - width) / 2)
    paste_y = round(bottom - height)
    return paste_x, paste_y, scale


def rysuj_zarodnik(frame: Image.Image, offset_x: int, offset_y: int) -> None:
    draw = ImageDraw.Draw(frame)
    ox = offset_x
    oy = offset_y

    draw.rectangle((184 + ox, 326 + oy, 328 + ox, 350 + oy), fill=(161, 96, 61, 255))
    draw.polygon(
        [(198 + ox, 350 + oy), (314 + ox, 350 + oy), (296 + ox, 430 + oy), (216 + ox, 430 + oy)],
        fill=(193, 116, 70, 255),
    )
    draw.rectangle((208 + ox, 360 + oy, 304 + ox, 374 + oy), fill=(221, 142, 83, 255))
    draw.rectangle((214 + ox, 388 + oy, 298 + ox, 402 + oy), fill=(142, 79, 54, 190))

    draw.rectangle((232 + ox, 270 + oy, 280 + ox, 334 + oy), fill=(225, 167, 107, 255))
    draw.rectangle((222 + ox, 288 + oy, 290 + ox, 326 + oy), fill=(225, 167, 107, 255))
    draw.rectangle((238 + ox, 256 + oy, 274 + ox, 276 + oy), fill=(246, 205, 146, 255))
    draw.rectangle((252 + ox, 230 + oy, 260 + ox, 260 + oy), fill=(91, 151, 70, 245))
    draw.rectangle((242 + ox, 232 + oy, 252 + ox, 242 + oy), fill=(117, 184, 78, 230))
    draw.rectangle((260 + ox, 222 + oy, 274 + ox, 232 + oy), fill=(117, 184, 78, 230))


def rysuj_peleryne(frame: Image.Image, stage: str, layers: dict[str, Image.Image | tuple[int, int, int, int]], offset_x: int, offset_y: int) -> None:
    profil = STAGES[stage]
    bbox = layers["mushroom_bbox"]
    assert isinstance(bbox, tuple)
    paste_x, paste_y, scale = policz_pozycje_pieczarki(profil, bbox)
    left = paste_x + scaled(126, scale) + offset_x
    right = paste_x + scaled(374, scale) + offset_x
    top = paste_y + scaled(252, scale) + offset_y
    bottom = min(466, paste_y + scaled(462, scale) + offset_y)
    center = (left + right) // 2
    draw = ImageDraw.Draw(frame)

    draw.polygon(
        [(left, top), (center - 18, top + 52), (center - 64, bottom), (left - 44, bottom - 18)],
        fill=(181, 45, 62, 235),
    )
    draw.polygon(
        [(right, top), (center + 18, top + 52), (center + 64, bottom), (right + 44, bottom - 18)],
        fill=(181, 45, 62, 235),
    )
    draw.line((left, top, center, top + 50, right, top), fill=(116, 32, 48, 245), width=6)
    draw.rectangle((center - 12, top + 38, center + 12, top + 58), fill=(255, 230, 111, 245))


def przeskaluj_postac(source: Image.Image, scale: float, bottom: int, offset_x: int = 0, offset_y: int = 0) -> Image.Image:
    bbox = source.getchannel("A").getbbox()
    if bbox is None:
        return Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))

    cropped = source.crop(bbox)
    width = max(1, round(cropped.width * scale))
    height = max(1, round(cropped.height * scale))
    resized = cropped.resize((width, height), Image.Resampling.NEAREST)
    frame = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    x = round((FRAME - width) / 2) + offset_x
    y = round(bottom - height) + offset_y
    frame.alpha_composite(resized, (x, y))
    return frame


def naloz_tint(frame: Image.Image, kolor: tuple[int, int, int, int]) -> Image.Image:
    overlay = Image.new("RGBA", frame.size, kolor)
    mask = frame.getchannel("A").point(lambda value: round(value * kolor[3] / 255))
    result = frame.copy()
    result.alpha_composite(Image.composite(overlay, Image.new("RGBA", frame.size, (0, 0, 0, 0)), mask))
    return result


def twarz(frame: Image.Image, stage: str, mina: str) -> Image.Image:
    profil = STAGES[stage]["face"]
    left = profil["left"]
    right = profil["right"]
    mouth = profil["mouth"]
    skin = profil["skin"]
    face_scale = STAGES[stage].get("faceScale", 1.0)
    draw = ImageDraw.Draw(frame)

    if mina == "normal" and stage != "spore":
        return frame

    zakryj_twarz(draw, left, right, mouth, skin, face_scale)

    if mina == "blink":
        oczy_kreski(draw, left, right, scale=face_scale)
        usta(draw, mouth, "neutral", face_scale)
    elif mina == "wake":
        duze_oczy(draw, left, right, face_scale)
        usta(draw, mouth, "o", face_scale)
    elif mina == "sleep":
        oczy_kreski(draw, left, right, dy=5, scale=face_scale)
        usta(draw, mouth, "smile", face_scale)
    elif mina == "surprised":
        oczy(draw, left, right, scale=face_scale)
        usta(draw, mouth, "o", face_scale)
    elif mina == "happy":
        oczy_kreski(draw, left, right, scale=face_scale)
        rumience(draw, left, right, face_scale)
        usta(draw, mouth, "smile", face_scale)
    elif mina == "tired":
        oczy_kreski(draw, left, right, dy=5, scale=face_scale)
        usta(draw, mouth, "flat", face_scale)
    elif mina == "dry":
        oczy_kreski(draw, left, right, dy=3, scale=face_scale)
        usta(draw, mouth, "sad", face_scale)
    elif mina == "worried":
        oczy(draw, left, right, h=24, scale=face_scale)
        usta(draw, mouth, "sad", face_scale)
    elif mina == "sick":
        oczy_kreski(draw, left, right, dy=2, scale=face_scale)
        usta(draw, mouth, "wobble", face_scale)
    elif mina == "critical":
        duze_oczy(draw, left, right, face_scale)
        usta(draw, mouth, "sad", face_scale)
    elif mina == "sing":
        oczy_kreski(draw, left, right, scale=face_scale)
        usta(draw, mouth, "sing", face_scale)
    else:
        oczy(draw, left, right, scale=face_scale)
        usta(draw, mouth, "neutral", face_scale)

    return frame


def scaled(value: int | float, scale: float) -> int:
    return max(1, round(value * scale))


def zakryj_twarz(draw: ImageDraw.ImageDraw, left: tuple[int, int], right: tuple[int, int], mouth: tuple[int, int], skin: tuple[int, int, int], scale: float) -> None:
    for x, y in [left, right]:
        draw.rounded_rectangle((
            x - scaled(18, scale),
            y - scaled(16, scale),
            x + scaled(34, scale),
            y + scaled(44, scale)
        ), radius=scaled(8, scale), fill=skin + (235,))
    draw.rounded_rectangle((
        mouth[0] - scaled(28, scale),
        mouth[1] - scaled(15, scale),
        mouth[0] + scaled(40, scale),
        mouth[1] + scaled(24, scale)
    ), radius=scaled(8, scale), fill=skin + (225,))


def oczy(draw: ImageDraw.ImageDraw, left: tuple[int, int], right: tuple[int, int], h: int = 32, scale: float = 1.0) -> None:
    for x, y in [left, right]:
        draw.rectangle((x, y, x + scaled(20, scale), y + scaled(h, scale)), fill=(42, 31, 24, 255))


def oczy_kreski(draw: ImageDraw.ImageDraw, left: tuple[int, int], right: tuple[int, int], dy: int = 0, scale: float = 1.0) -> None:
    for x, y in [left, right]:
        draw.rectangle((
            x - scaled(2, scale),
            y + scaled(14 + dy, scale),
            x + scaled(24, scale),
            y + scaled(19 + dy, scale)
        ), fill=(42, 31, 24, 255))


def duze_oczy(draw: ImageDraw.ImageDraw, left: tuple[int, int], right: tuple[int, int], scale: float = 1.0) -> None:
    for x, y in [left, right]:
        draw.rectangle((
            x - scaled(8, scale),
            y - scaled(8, scale),
            x + scaled(34, scale),
            y + scaled(44, scale)
        ), fill=(255, 250, 240, 255))
        draw.rectangle((
            x + scaled(8, scale),
            y + scaled(12, scale),
            x + scaled(18, scale),
            y + scaled(28, scale)
        ), fill=(42, 31, 24, 255))


def usta(draw: ImageDraw.ImageDraw, mouth: tuple[int, int], wariant: str, scale: float = 1.0) -> None:
    x, y = mouth
    kolor = (42, 31, 24, 255)
    if wariant == "smile":
        draw.rectangle((x - scaled(18, scale), y, x + scaled(28, scale), y + scaled(6, scale)), fill=kolor)
        draw.rectangle((x - scaled(10, scale), y + scaled(7, scale), x + scaled(20, scale), y + scaled(12, scale)), fill=kolor)
    elif wariant == "sad":
        draw.rectangle((x - scaled(16, scale), y + scaled(8, scale), x + scaled(26, scale), y + scaled(13, scale)), fill=kolor)
        draw.rectangle((x - scaled(10, scale), y + scaled(3, scale), x + scaled(20, scale), y + scaled(8, scale)), fill=kolor)
    elif wariant == "o":
        draw.rectangle((x, y - scaled(2, scale), x + scaled(14, scale), y + scaled(18, scale)), fill=kolor)
        draw.rectangle((x + scaled(4, scale), y - scaled(6, scale), x + scaled(10, scale), y + scaled(22, scale)), fill=kolor)
    elif wariant == "sing":
        draw.rectangle((x - scaled(10, scale), y - scaled(2, scale), x + scaled(28, scale), y + scaled(16, scale)), fill=kolor)
        draw.rectangle((x - scaled(2, scale), y - scaled(10, scale), x + scaled(20, scale), y + scaled(24, scale)), fill=kolor)
    elif wariant == "wobble":
        draw.line((
            x - scaled(18, scale), y + scaled(6, scale),
            x - scaled(6, scale), y,
            x + scaled(8, scale), y + scaled(10, scale),
            x + scaled(24, scale), y + scaled(4, scale)
        ), fill=kolor, width=scaled(5, scale))
    else:
        draw.rectangle((x - scaled(16, scale), y + scaled(4, scale), x + scaled(26, scale), y + scaled(10, scale)), fill=kolor)


def rumience(draw: ImageDraw.ImageDraw, left: tuple[int, int], right: tuple[int, int], scale: float = 1.0) -> None:
    draw.rectangle((
        left[0] - scaled(34, scale),
        left[1] + scaled(36, scale),
        left[0] - scaled(10, scale),
        left[1] + scaled(44, scale)
    ), fill=(232, 120, 110, 180))
    draw.rectangle((
        right[0] + scaled(28, scale),
        right[1] + scaled(36, scale),
        right[0] + scaled(52, scale),
        right[1] + scaled(44, scale)
    ), fill=(232, 120, 110, 180))


def dodaj_dekoracje_etapu(frame: Image.Image, stage: str) -> None:
    draw = ImageDraw.Draw(frame)
    if stage == "spore":
        draw.rectangle((238, 224, 274, 230), fill=(117, 184, 78, 190))
    elif stage == "young":
        draw.rectangle((118, 346, 126, 377), fill=(88, 154, 64, 210))
        draw.rectangle((388, 352, 396, 382), fill=(88, 154, 64, 210))
    elif stage == "adult":
        draw.rectangle((116, 356, 130, 370), fill=(246, 209, 95, 230))
        draw.rectangle((390, 362, 404, 376), fill=(246, 209, 95, 230))
        draw.rectangle((254, 398, 262, 430), fill=(82, 136, 69, 220))
    elif stage == "legendary":
        for x, y in [(120, 140), (394, 164), (358, 328), (154, 334)]:
            draw.rectangle((x, y, x + 16, y + 4), fill=(255, 238, 127, 230))
            draw.rectangle((x + 6, y - 6, x + 10, y + 10), fill=(255, 238, 127, 230))


def dodaj_sen(frame: Image.Image, stage: str, index: int) -> Image.Image:
    draw = ImageDraw.Draw(frame)
    x = 358 + index * 6
    y = 110 - index * 8
    draw.rectangle((x, y, x + 28, y + 20), fill=(255, 253, 247, 220))
    draw.text((x + 7, y - 2), "Z", fill=(47, 79, 53, 255))
    if stage == "legendary":
        dodaj_blyski(draw, [(138, 156), (380, 136)], (255, 238, 127, 220))
    return frame


def dodaj_radosc(frame: Image.Image, stage: str, index: int) -> Image.Image:
    draw = ImageDraw.Draw(frame)
    dodaj_blyski(draw, [(120 + index * 8, 160), (382 - index * 6, 142), (360, 326)], (255, 246, 184, 230))
    return frame


def dodaj_doskonalosc(frame: Image.Image, stage: str, index: int) -> Image.Image:
    draw = ImageDraw.Draw(frame)
    dodaj_blyski(
        draw,
        [(106, 148), (166 + index * 5, 116), (376 - index * 5, 126), (404, 254), (132, 330), (362, 338)],
        (255, 238, 127, 235),
    )
    draw.rectangle((178, 420, 334, 430), fill=(255, 238, 127, 120))
    return frame


def dodaj_sennosc(frame: Image.Image, stage: str, index: int) -> Image.Image:
    draw = ImageDraw.Draw(frame)
    draw.text((344 + index * 4, 182 - index * 4), "z", fill=(47, 79, 53, 230))
    return frame


def dodaj_suchosc(frame: Image.Image, stage: str, index: int) -> Image.Image:
    frame = naloz_tint(frame, (150, 98, 50, 42))
    draw = ImageDraw.Draw(frame)
    draw.line((96, 426, 132, 440, 168, 423), fill=(146, 89, 45, 230), width=4)
    draw.line((336, 432, 374, 446, 418, 426), fill=(146, 89, 45, 230), width=4)
    return frame


def dodaj_glod(frame: Image.Image, stage: str, index: int) -> Image.Image:
    draw = ImageDraw.Draw(frame)
    draw.rectangle((342, 130, 418, 174), fill=(255, 253, 247, 230))
    draw.text((354, 142), "NPK", fill=(67, 91, 52, 255))
    for x in [154, 182, 344, 372]:
        draw.rectangle((x + index, 398, x + 12 + index, 410), fill=(112, 75, 43, 230))
    return frame


def dodaj_brud(frame: Image.Image, stage: str, index: int) -> Image.Image:
    draw = ImageDraw.Draw(frame)
    for x, y in [(130, 380), (184, 408), (340, 392), (390, 416), (234, 382)]:
        draw.rectangle((x + index % 2, y, x + 14, y + 8), fill=(92, 70, 51, 230))
    draw.rectangle((362 + index * 4, 188, 372 + index * 4, 194), fill=(42, 31, 24, 220))
    return frame


def dodaj_chorobe(frame: Image.Image, stage: str, index: int) -> Image.Image:
    frame = naloz_tint(frame, (104, 196, 135, 54))
    draw = ImageDraw.Draw(frame)
    draw.arc((156, 158, 196, 198), 20, 300, fill=(67, 120, 78, 230), width=4)
    draw.arc((340, 176, 370, 206), 30, 310, fill=(67, 120, 78, 230), width=4)
    return frame


def dodaj_alarm(frame: Image.Image, stage: str, index: int) -> Image.Image:
    draw = ImageDraw.Draw(frame)
    draw.rectangle((388, 88, 416, 164), fill=(216, 88, 104, 230))
    draw.rectangle((388, 176, 416, 204), fill=(216, 88, 104, 230))
    draw.rectangle((398, 98, 406, 154), fill=(255, 253, 247, 240))
    draw.rectangle((398, 184, 406, 194), fill=(255, 253, 247, 240))
    return frame


def dodaj_krople(frame: Image.Image, index: int) -> Image.Image:
    draw = ImageDraw.Draw(frame)
    for x, y in [(168, 128), (236, 108), (318, 126), (380, 160), (126, 190)]:
        draw.rectangle((x, y + index * 8, x + 10, y + 24 + index * 8), fill=(63, 137, 186, 230))
        draw.rectangle((x - 4, y + 16 + index * 8, x + 14, y + 28 + index * 8), fill=(63, 137, 186, 230))
    return frame


def dodaj_kompost(frame: Image.Image, index: int) -> Image.Image:
    draw = ImageDraw.Draw(frame)
    for x, y in [(148, 392), (178, 410), (332, 400), (362, 418)]:
        draw.rectangle((x, y - index * 2, x + 18, y + 14 - index * 2), fill=(111, 74, 42, 240))
        draw.rectangle((x + 5, y - 6 - index * 2, x + 12, y - index * 2), fill=(71, 128, 54, 230))
    return frame


def dodaj_czyszczenie(frame: Image.Image, index: int) -> Image.Image:
    draw = ImageDraw.Draw(frame)
    dodaj_blyski(draw, [(126, 360), (190, 410), (344, 380), (402, 420)], (255, 253, 247, 240))
    return frame


def dodaj_zabawe(frame: Image.Image, index: int) -> Image.Image:
    draw = ImageDraw.Draw(frame)
    for x, y in [(140, 180), (372, 170), (342, 318)]:
        draw.rectangle((x, y - index * 4, x + 14, y + 14 - index * 4), fill=(216, 88, 104, 230))
        draw.rectangle((x - 8, y - index * 4, x + 6, y + 14 - index * 4), fill=(216, 88, 104, 230))
        draw.rectangle((x - 2, y + 10 - index * 4, x + 12, y + 24 - index * 4), fill=(216, 88, 104, 230))
    return frame


def dodaj_instrument(frame: Image.Image, index: int) -> Image.Image:
    draw = ImageDraw.Draw(frame)
    draw.rectangle((346, 334, 422, 376), fill=(119, 78, 48, 240))
    draw.rectangle((358, 324, 410, 338), fill=(183, 132, 66, 240))
    draw.line((362, 346, 408, 346), fill=(255, 237, 172, 240), width=3)
    dodaj_nutki(draw, index)
    return frame


def dodaj_spiew(frame: Image.Image, index: int) -> Image.Image:
    draw = ImageDraw.Draw(frame)
    dodaj_nutki(draw, index)
    return frame


def dodaj_zarodniki(frame: Image.Image, index: int) -> Image.Image:
    draw = ImageDraw.Draw(frame)
    for x, y in [(146, 174), (198, 142), (328, 138), (382, 180), (260, 118), (406, 246)]:
        size = 9 + index
        draw.rectangle((x + index * 4, y - index * 6, x + size + index * 4, y + size - index * 6), fill=(245, 229, 139, 210))
    return frame


def dodaj_plon(frame: Image.Image, index: int) -> Image.Image:
    draw = ImageDraw.Draw(frame)
    for x in [132, 170, 346, 386]:
        draw.rectangle((x, 392 - index * 3, x + 20, 426 - index * 3), fill=(248, 211, 155, 240))
        draw.rectangle((x - 10, 376 - index * 3, x + 30, 396 - index * 3), fill=(255, 240, 196, 240))
    dodaj_zarodniki(frame, index)
    return frame


def dodaj_nutki(draw: ImageDraw.ImageDraw, index: int) -> None:
    for x, y in [(126, 156), (388, 132), (358, 210)]:
        yy = y - index * 8
        draw.rectangle((x, yy, x + 5, yy + 34), fill=(103, 78, 167, 230))
        draw.rectangle((x + 5, yy, x + 24, yy + 5), fill=(103, 78, 167, 230))
        draw.rectangle((x - 8, yy + 28, x + 8, yy + 42), fill=(103, 78, 167, 230))


def dodaj_blyski(draw: ImageDraw.ImageDraw, punkty: Iterable[tuple[int, int]], kolor: tuple[int, int, int, int]) -> None:
    for x, y in punkty:
        draw.rectangle((x, y, x + 16, y + 4), fill=kolor)
        draw.rectangle((x + 6, y - 6, x + 10, y + 10), fill=kolor)


def efekt_krople(index: int) -> Image.Image:
    frame = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    draw = ImageDraw.Draw(frame)
    for x, y in [(196, 178), (250, 144), (306, 184), (224, 252), (286, 264)]:
        yy = y + index * 14
        draw.rectangle((x, yy, x + 10, yy + 24), fill=(63, 137, 186, 230))
        draw.rectangle((x - 4, yy + 16, x + 14, yy + 30), fill=(63, 137, 186, 230))
    return frame


def efekt_blyski(index: int) -> Image.Image:
    frame = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    draw = ImageDraw.Draw(frame)
    dodaj_blyski(draw, [(184, 190), (318, 166), (256, 286), (344, 326), (164, 330)], (255, 246, 184, 230))
    if index % 2:
        dodaj_blyski(draw, [(230, 132), (286, 354)], (255, 238, 127, 210))
    return frame


def efekt_pyl(index: int) -> Image.Image:
    frame = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    draw = ImageDraw.Draw(frame)
    for x, y in [(184, 312), (228, 340), (286, 322), (330, 350), (260, 374)]:
        draw.rectangle((x + index * 3, y - index * 4, x + 14 + index * 3, y + 8 - index * 4), fill=(124, 98, 68, 190))
    return frame


def efekt_nutki(index: int) -> Image.Image:
    frame = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    draw = ImageDraw.Draw(frame)
    dodaj_nutki(draw, index)
    return frame


def efekt_zarodniki(index: int) -> Image.Image:
    frame = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    draw = ImageDraw.Draw(frame)
    for x, y in [(178, 230), (222, 180), (278, 170), (326, 218), (252, 258), (306, 294)]:
        size = 9 + index
        draw.rectangle((x + index * 5, y - index * 8, x + size + index * 5, y + size - index * 8), fill=(245, 229, 139, 210))
    return frame


def zapisz_sheet(path: Path, frames: list[Image.Image]) -> None:
    sheet = Image.new("RGBA", (FRAME * len(frames), FRAME), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        sheet.alpha_composite(frame, (index * FRAME, 0))
    sheet.save(path, optimize=True)


if __name__ == "__main__":
    main()
