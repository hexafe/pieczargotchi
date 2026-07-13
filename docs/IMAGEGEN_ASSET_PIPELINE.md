# Imagegenowy Pipeline zasobów

Data: 2026-07-12

Ten pipeline jest kanoniczną ścieżką budowania PNG runtime. Źródła postaci, stanów, akcji, efektów i środowiska pochodzą z wbudowanego generatora obrazów. Lokalne skrypty wykonują deterministyczne kroki: usunięcie tła, despill, cięcie atlasów, normalizację skali i baseline, zbudowanie body-only klatek logicznych, tight crop, deduplikację klatek fizycznych oraz przygotowanie osobnego, wspólnego zasobu trawy sceny.

## Źródla

Raw atlasy generator obrazów są zapisane w:

```text
assets/source/imagegen/raw/
```

Pochodzenie całych kolekcji zapisuje:

```text
assets/source/imagegen/PROVENANCE.json
```

Plik rozróżnia legacy atlasy imagegenowe, deterministyczne runtime sprite v2 i body-only battle v1. Nie należy zgadywać brakującego modelu lub daty dla starych źródeł; nieznane pola pozostają jawnie opisane jako legacy.

Imagegenowa baza zarodka, oczyszczona z tla i przycieta do uzycia przez builder:

```text
assets/source/imagegen/generated/spore_full_generated_atlas.png
```

Wymagane atlasy:

- stany: `idle`, `sleep`, `wake`, `happy`, `excellent`, `tired`, `dry`, `hungry`, `dirty`, `sick`, `critical`
- akcje: `hydrate`, `feed`, `clean`, `play`, `instrument`, `sing`, `spores`, `harvest`
- easter eggi: `neutral_atlas.png` dla miny `:|`, `neutral_rain_atlas.png` dla Iwoniastej Pieczarki z parasolką
- środowisko: `grass_patch_atlas.png` dla trawnika wypełniającego dół sceny
- efekty: `effects`
- reakcje immersyjne: `curious`, `idle_fidget`, `idle_fidget_sway`, `idle_fidget_shift`, `idle_look_left`, `idle_look_right`, `ponder`, `ponder_up`, `ponder_side`, `ponder_breath`, `watch_cursor_left`, `watch_cursor_right`, `watch_cursor_up_left`, `watch_cursor_up_right`, `follow_cursor_fast`, `follow_cursor_after`, `sun`, `rain`, `stargaze`, `snow`, `watch_butterfly`, `watch_firefly`, `watch_crawler`

Każdy atlas stanu lub akcji ma jeden rząd pięciu postaci: `spore`, `baby`, `young`, `adult`, `legendary`. Tło atlasu jest płaskim chroma-key `#ff00ff`.

Dla etapu `spore` builder używa `spore_full_generated_atlas.png`: 19 kompletnych, wygenerowanych wariantów zarodka w kolejności stanów i akcji. Builder nie dokleja kapelusza ani nie składa twarzy z osobnych warstw; usuwa chroma-key, skaluje, centruje po ciele i zapisuje body-only klatkę. Trawa służy wyłącznie jako pomocnicza maska do wyznaczenia poprawnego baseline i nie trafia do sprite'a.

Dopracowane aktywności są sprite-first i mają `8` klatek logicznych na arkusz animacji. Pełny etap budowania używa więc układu `4096x512`, ale runtime PNG jest później ciasno przycinany i może przechowywać mniej klatek fizycznych. Generator traktuje gest, mimikę i rekwizyt jako część PNG dla danego etapu. Canvas/runtime nie dokłada dodatkowego body-motion poza kontraktem animacji i efektami pomocniczymi z `assets/effects/`.

Etap `spore` ma łagodniejszy plan ruchu niż starsze etapy: mikroprzesunięcia, mniejszy squash/stretch i one-shot timing z holdem ostatniej klatki w czasie działania. Zarodnik nie może wykonywać szybkiego naprzemiennego ruchu lewo/prawo tylko dlatego, że dorosła Pieczarka znosi większą amplitudę.

`clean` zostawia brud jako decyzję renderera: niska `cleanliness` ma nadal używać dirt cue / stanu `dirty`, a arkusz animacji aktywności pokazuje czyszczenie, gest i błysk bez trwałego przybrudzania bazowego wycinka.

`spore/sleep` walidujemy jako split: sam śpiący zarodek pochodzi z PNG bez wklejonych `zZz`, a glyphy snu i chmura zarodników pozostają oddzielnymi warstwami czasu działania/efektów.

Neutralny easter egg `:|` też ma osobne wyrenderowane źródła:

```text
assets/source/imagegen/raw/neutral_atlas.png
assets/source/imagegen/cutouts/easter-eggs/neutral/<stage>.png
assets/source/imagegen/raw/neutral_rain_atlas.png
assets/source/imagegen/cutouts/easter-eggs/neutral_rain/<stage>.png
```

Builder nie rysuje ani nie dokleja miny `:|` do `idle_sheet.png` i nie rysuje parasolki pixel po pixelu. Runtime `assets/easter-eggs/<stage>/neutral_sheet.png` oraz `assets/easter-eggs/<stage>/neutral_rain_sheet.png` są body-only i składane z wyrenderowanych wycinków; wspólna trawa dochodzi dopiero w scenie. Reakcje immersyjne, które zmieniają mimikę albo rekwizyt postaci, również powinny powstawać jako pełne logiczne PNG arkusze animacji, a nie jako canvasowy retusz twarzy.

Trawnik sceny też ma osobne wyrenderowane źródła:

```text
assets/source/imagegen/raw/grass_patch_atlas.png
assets/source/imagegen/cutouts/environment/grass_patch.png
assets/environment/grass_patch.png
```

`ClientSceneGround.html` rysuje ten zasób jako wspólne wypełnienie podłoża pod Pieczarką, z stage-aware centralną polaną i lekkim foreground occluderem. Pojedyncze wyższe źdźbła są rysowane proceduralnie na canvasie, bo muszą reagować na aktualny kierunek, siłę, śnieg i porywy wiatru. Sprite postaci nie może ponownie zawierać baked grass.

## Opis Bazowy

Tryb: wbudowany image generator.

Wspólny schemat opisu wejściowego:

```text
Create a clean pixel-art character atlas containing five separate mushroom growth-stage characters for Pieczargotchi.
One horizontal row of exactly five centered characters, evenly spaced, no text, no labels, no grid lines.
Flat solid #ff00ff chroma-key background for background removal.
Characters from left to right: tiny cream button mushroom primordium with a short stem and small cap, no leaves, no sprout, no hair, baby mushroom, young mushroom, adult mushroom, legendary mushroom with small red superhero cape.
Match the cute cream mushroom cap, warm brown gills, peach face, blush, soft pixel-art shading.
No square pot, no blocky rectangle body, no grass, no scenery, no floor, no UI, no watermark.
```

Do tego dopisywany jest konkretny stan albo akcja, na przykład `state: WAKE`, `activity: HYDRATE`, `state: CRITICAL`.

## Budowanie Czasu Działania

Pełna kolejność przebudowy jest istotna: builder zapisuje pełne klatki logiczne, a optimizer zastępuje je tight/dedup atlasami i regeneruje metadata.

```sh
python3 scripts/build-imagegen-sprites.py
python3 scripts/generate-immersion-assets.py
python3 scripts/generate-immersion-assets.py --ui-art-pass
python3 scripts/optimize-runtime-sprite-atlases.py
python3 scripts/generate-battle-assets.py
```

Skrypt tworzy:

- `assets/stages/<stage>/<state>_sheet.png`
- `assets/activities/<stage>/<activity>_sheet.png`, dla dopracowanych aktywności w kontrakcie `8` klatek logicznych
- klucze `instrument_bell`, `instrument_flute`, `instrument_drum` i `instrument_rare` aliasowane w manifeście do etapowego `instrument_sheet.png`; osobne PNG wolno podłączyć dopiero po stworzeniu rzeczywiście odmiennego artu
- `assets/easter-eggs/<stage>/neutral_sheet.png`
- `assets/easter-eggs/<stage>/neutral_rain_sheet.png`
- `assets/effects/<effect>_sheet.png`
- `assets/environment/grass_patch.png`
- pomocnicze wycinki w `assets/source/imagegen/cutouts/`

`scripts/optimize-runtime-sprite-atlases.py` następnie:

- wyznacza wspólny alpha-union dla wszystkich klatek logicznych danego sheetu;
- przycina przezroczyste marginesy bez zmiany logicznego położenia;
- deduplikuje identyczne klatki fizyczne;
- zapisuje `frameWidth`, `frameHeight`, `drawX`, `drawY`, `storedFrameCount`, `frameSequence` i `bakedGrass: false` w generowanym `SpriteLayout.gs`.

`scripts/generate-battle-assets.py` niezależnie tworzy `assets/battle/arena_background.png` oraz cztery body-only sheety wojowników. Generator jest deterministyczny i korzysta z kuratorowanych wycinków `young`, `adult` i `legendary`; nie wywołuje modelu graficznego podczas lokalnego buildu.

Stan `excellent` jest czyszczony z odklejonych, statycznych gwiazdek z atlasu źródłowego. Builder zachowuje samą postać, a potem dokłada deterministyczne, klatkowane mikro-błyski w gotowym arkuszu. Dzięki temu promienienie Pieczarki jest animowane w PNG, bez canvasowych plusów skaczących wokół postaci.

Reakcje immersyjne (`curious`, warianty bezczynności i zamyślenia, reakcje kursora, `sun`, `rain`, `stargaze`, `snow`, `watch_butterfly`, `watch_firefly`, `watch_crawler`) są generowane z istniejących arkuszy animacji przez:

```sh
python3 scripts/generate-immersion-assets.py
```

Polish 0.1.50 nie wymagał nowego modelowego bitmapowego źródła. Dla spójności sylwetki i pełnej odtwarzalności `generate-immersion-assets.py --ui-art-pass` przebudowuje 35 sheetów fidget/cursor z kuratorowanych wycinków etapów oraz dokłada finalny, deterministyczny polish `spore/feed` i `spore/instrument` do bazowych klatek odtworzonych przez `build-imagegen-sprites.py`. Generatory są idempotentne: ponowne uruchomienie na tych samych źródłach musi dać te same PNG, po czym optimizer odświeża tight crop, deduplikację i `SpriteLayout.gs`.

Nowy obraz z generatora jest uzasadniony dopiero wtedy, gdy istniejące źródło nie może wyrazić nowej sylwetki, rekwizytu albo czytelnej pozy. Mikroprzesunięcie, kierunek spojrzenia, timing oraz korekta baseline pozostają zadaniem deterministycznego buildera; nie tworzymy dla nich kolejnego nieudokumentowanego raw atlasu.

Stary `scripts/generate-pixel-assets.py` deleguje do tego buildera, jeżeli wykryje `assets/source/imagegen/raw/idle_atlas.png`, a potem odświeża reakcje immersyjne. Po użyciu legacy entrypointu nadal trzeba uruchomić `python3 scripts/generate-immersion-assets.py --ui-art-pass`, a następnie optimizer, ponieważ runtime nie powinien stracić polishu 0.1.50 ani zostać z pełnymi, niededuplicowanymi atlasami.

## Provenance i zmiany źródeł

- Nowy art imagegenowy najpierw trafia do `assets/source/imagegen/raw/` lub kuratorowanego katalogu źródłowego, nigdy bezpośrednio do tight PNG runtime.
- `assets/source/imagegen/PROVENANCE.json` musi wskazać kolekcję, origin, model lub jawne `unknown`, datę, builder, postprocess i ręczne korekty.
- Deterministyczne pochodne nie deklarują modelu: wskazują builder i konkretne source paths.
- Nie edytujemy ręcznie `SpriteLayout.gs`; metadata musi dać się odtworzyć z PNG przez optimizer.
- Nie podmieniamy istniejącego wydanego katalogu assetów. Aktualna paczka docelowa należy do wersji `0.1.51`.

## Walidacja

```sh
python3 -m py_compile scripts/build-imagegen-sprites.py scripts/generate-pixel-assets.py scripts/generate-immersion-assets.py scripts/generate-battle-assets.py scripts/optimize-runtime-sprite-atlases.py scripts/sprite_layout.py
python3 scripts/build-imagegen-sprites.py
python3 scripts/generate-immersion-assets.py
python3 scripts/generate-immersion-assets.py --ui-art-pass
python3 scripts/optimize-runtime-sprite-atlases.py
python3 scripts/generate-battle-assets.py
python3 scripts/optimize-runtime-sprite-atlases.py --check
python3 scripts/generate-battle-assets.py --check
node scripts/test-animation-render-contracts.mjs
node scripts/test-battle-visual-contracts.mjs
node scripts/test-grass-wind-motion.mjs
node scripts/validate-assets.mjs
python3 scripts/audit-activity-sprite-motion.py
python3 scripts/audit-glint-sprites.py
python3 scripts/audit-sprite-consistency.py
python3 scripts/audit-sprite-frame-quality.py
python3 scripts/audit-sprite-chroma.py --strict
```

To jest gate kontraktowy, nie dowód kompozycji sceny. Po nim uruchom pełne `npm run qa` i browser capture dla wszystkich etapów, aktywności, immersji, pogody oraz areny na desktopie i mobile. Nie opisuj wydania jako zielonego, jeżeli `--check`, `validate-assets`, strict chroma albo capture nie zakończyły się sukcesem.
