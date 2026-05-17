# Imagegenowy Pipeline Assetow

Data: 2026-05-10

Ten pipeline jest teraz kanoniczna sciezka budowania runtime PNG. Zrodla postaci, stanow, akcji, efektow i srodowiska pochodza z wbudowanego generatora obrazow. Lokalne skrypty wykonuja tylko techniczne kroki: usuniecie tla, ciecie atlasow, normalizacje skali, dolozenie stabilnej frontowej trawy do sheetow postaci oraz przygotowanie osobnego assetu trawnika sceny.

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
- easter eggi: `neutral_atlas.png` dla miny `:|`, `neutral_rain_atlas.png` dla Iwoniastej Pieczarki z parasolka
- srodowisko: `grass_patch_atlas.png` dla trawnika wypelniajacego dol sceny
- efekty: `effects`
- reakcje immersyjne: `curious`, `sun`, `rain`, `stargaze`, `snow`

Kazdy atlas stanu lub akcji ma jeden rzad pieciu postaci: `spore`, `baby`, `young`, `adult`, `legendary`. Tlo atlasu jest plaskim chroma-key `#ff00ff`.

Dla etapu `spore` builder uzywa `spore_full_generated_atlas.png`: 19 kompletnych, wygenerowanych wariantow zarodka w kolejnosci stanow i akcji. Builder nie dokleja kapelusza ani nie sklada twarzy z osobnych warstw; tylko usuwa chroma-key, skaluje, centruje po ciele i doklada stabilna trawe runtime.

Neutralny easter egg `:|` tez ma osobne wyrenderowane zrodla:

```text
assets/source/imagegen/raw/neutral_atlas.png
assets/source/imagegen/cutouts/easter-eggs/neutral/<stage>.png
assets/source/imagegen/raw/neutral_rain_atlas.png
assets/source/imagegen/cutouts/easter-eggs/neutral_rain/<stage>.png
```

Builder nie rysuje ani nie dokleja miny `:|` do `idle_sheet.png` i nie rysuje parasolki pixel po pixelu. Runtime `assets/easter-eggs/<stage>/neutral_sheet.png` oraz `assets/easter-eggs/<stage>/neutral_rain_sheet.png` sa skladane z wyrenderowanych cutoutow i wspolnej frontowej trawy. Reakcje immersyjne, ktore zmieniaja mimike albo rekwizyt postaci, rowniez powinny docelowo powstawac jako pelne PNG sheety, a nie jako canvasowy retusz twarzy.

Trawnik sceny tez ma osobne wyrenderowane zrodla:

```text
assets/source/imagegen/raw/grass_patch_atlas.png
assets/source/imagegen/cutouts/environment/grass_patch.png
assets/environment/grass_patch.png
```

`ClientSceneGround.html` rysuje ten asset jako wypelnienie podloza pod Pieczarka. Pojedyncze wyzsze zdzbla sa rysowane proceduralnie na canvasie, bo musza reagowac na aktualny kierunek, sile i porywy wiatru.

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
- `assets/easter-eggs/<stage>/neutral_sheet.png`
- `assets/easter-eggs/<stage>/neutral_rain_sheet.png`
- `assets/effects/<effect>_sheet.png`
- `assets/environment/grass_patch.png`
- pomocnicze wycinki w `assets/source/imagegen/cutouts/`

Reakcje immersyjne (`curious`, `sun`, `rain`, `stargaze`, `snow`) sa generowane z istniejacych sheetow przez:

```sh
python3 scripts/generate-immersion-assets.py
```

Stary `scripts/generate-pixel-assets.py` deleguje do tego buildera, jezeli wykryje `assets/source/imagegen/raw/idle_atlas.png`, a potem odswieza reakcje immersyjne.

## Walidacja

```sh
python3 -m py_compile scripts/build-imagegen-sprites.py scripts/generate-pixel-assets.py scripts/generate-immersion-assets.py
python3 scripts/build-imagegen-sprites.py
node scripts/validate-assets.mjs
python3 scripts/audit-sprite-consistency.py
PIECZARGOTCHI_CAPTURE_STAGES=1 PIECZARGOTCHI_CAPTURE_ACTIVITIES=1 node scripts/capture-app-render.mjs http://127.0.0.1:8092/ /tmp/pieczargotchi-imagegen-final
PIECZARGOTCHI_CAPTURE_VIEWPORT=1 PIECZARGOTCHI_CAPTURE_STAGES=1 PIECZARGOTCHI_CAPTURE_ACTIVITIES=1 PIECZARGOTCHI_CAPTURE_IMMERSION=1 node scripts/capture-app-render.mjs http://127.0.0.1:8092/ /tmp/pieczargotchi-ui-final
```

Ostatnia walidacja:

- `143` sheety PNG i `1` asset srodowiska przechodza `validate-assets`,
- manifest runtime laduje stage, activity, easter egg, effect i environment assety; poza manifestem zostaja swiadomie walidowane tylko fallbacki `assets/activities/*.png`,
- stany bazowe, aktywnosci i neutralne easter eggi trzymaja rozmiar/baseline w kazdym etapie,
- lokalny capture potwierdza osobne animacje akcji dla `spore`, `baby`, `young`, `adult` i `legendary`,
- viewport capture `1194x891` potwierdza czytelny prawy panel i brak checkerboardu w obszarze canvasu.
