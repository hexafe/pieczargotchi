# Imagegenowy Pipeline Assetow

Data: 2026-05-10

Ten pipeline jest teraz kanoniczna sciezka budowania runtime PNG. Zrodla postaci, stanow, akcji i efektow pochodza z wbudowanego generatora obrazow, a lokalny skrypt wykonuje tylko techniczne kroki: usuniecie tla, ciecie atlasow, normalizacje skali, dolozenie stalej trawy i zlozenie sheetow.

## Zrodla

Raw atlasy imagegen sa zapisane w:

```text
assets/source/imagegen/raw/
```

Imagegenowa baza zarodka, oczyszczona z tla i przycieta do uzycia przez builder:

```text
assets/source/imagegen/generated/spore_full_generated_atlas.png
```

Wymagane atlasy:

- stany: `idle`, `sleep`, `wake`, `happy`, `excellent`, `tired`, `dry`, `hungry`, `dirty`, `sick`, `critical`
- akcje: `hydrate`, `feed`, `clean`, `play`, `instrument`, `sing`, `spores`, `harvest`
- efekty: `effects`

Kazdy atlas stanu lub akcji ma jeden rzad pieciu postaci: `spore`, `baby`, `young`, `adult`, `legendary`. Tlo atlasu jest plaskim chroma-key `#ff00ff`.

Dla etapu `spore` builder uzywa `spore_full_generated_atlas.png`: 19 kompletnych, wygenerowanych wariantow zarodka w kolejnosci stanow i akcji. Builder nie dokleja kapelusza ani nie sklada twarzy z osobnych warstw; tylko usuwa chroma-key, skaluje, centruje po ciele i doklada stabilna trawe runtime.

## Prompt Bazowy

Tryb: wbudowany image generator.

Wspolny schemat promptow:

```text
Create a clean pixel-art character atlas containing five separate mushroom growth-stage characters for Pieczargotchi.
One horizontal row of exactly five centered characters, evenly spaced, no text, no labels, no grid lines.
Flat solid #ff00ff chroma-key background for background removal.
Characters from left to right: tiny cream button mushroom primordium with a short stem and small cap, no leaves, no sprout, no hair, baby mushroom, young mushroom, adult mushroom, legendary mushroom with small red superhero cape.
Match the cute cream mushroom cap, warm brown gills, peach face, blush, soft pixel-art shading.
No square pot, no blocky rectangle body, no grass, no scenery, no floor, no UI, no watermark.
```

Do tego dopisywany jest konkretny stan albo akcja, na przyklad `state: WAKE`, `activity: HYDRATE`, `state: CRITICAL`.

## Budowanie Runtime

```sh
python3 scripts/build-imagegen-sprites.py
```

Skrypt tworzy:

- `assets/stages/<stage>/<state>_sheet.png`
- `assets/activities/<stage>/<activity>_sheet.png`
- kompatybilne fallbacki `assets/activities/<activity>_sheet.png` z wariantu `adult`
- `assets/effects/<effect>_sheet.png`
- pomocnicze wycinki w `assets/source/imagegen/cutouts/`

Stary `scripts/generate-pixel-assets.py` deleguje do tego buildera, jezeli wykryje `assets/source/imagegen/raw/idle_atlas.png`.

## Walidacja

```sh
python3 -m py_compile scripts/build-imagegen-sprites.py scripts/generate-pixel-assets.py
python3 scripts/build-imagegen-sprites.py
node scripts/validate-assets.mjs
python3 scripts/audit-sprite-consistency.py
PIECZARGOTCHI_CAPTURE_STAGES=1 PIECZARGOTCHI_CAPTURE_ACTIVITIES=1 node scripts/capture-app-render.mjs http://127.0.0.1:8092/ /tmp/pieczargotchi-imagegen-final
PIECZARGOTCHI_CAPTURE_VIEWPORT=1 PIECZARGOTCHI_CAPTURE_STAGES=1 PIECZARGOTCHI_CAPTURE_ACTIVITIES=1 node scripts/capture-app-render.mjs http://127.0.0.1:8092/ /tmp/pieczargotchi-ui-final
```

Ostatnia walidacja:

- `108` runtime PNG przechodzi `validate-assets`,
- `sleep`, `wake` i `idle` trzymaja rozmiar w kazdym etapie,
- lokalny capture potwierdza osobne animacje akcji dla `spore`, `baby`, `young`, `adult` i `legendary`,
- viewport capture `1194x891` potwierdza czytelny prawy panel i brak checkerboardu w obszarze canvasu.
