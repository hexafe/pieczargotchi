# Imagegenowy Pipeline zasobów

Data: 2026-05-10

Ten pipeline jest teraz kanoniczna ścieżka budowania PNG używane podczas działania. Źródla postaci, stanów, akcji, efektow i środowiska pochodza z wbudowanego generatora obrazow. Lokalne skrypty wykonuja tylko techniczne kroki: usuniecie tla, ciecie atlasow, normalizacje skali, dolozenie stabilnej frontowej trawy do arkuszy animacji postaci oraz przygotowanie osobnego zasobu trawnika sceny.

## Źródla

Raw atlasy generator obrazów są zapisane w:

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
- easter eggi: `neutral_atlas.png` dla miny `:|`, `neutral_rain_atlas.png` dla Iwoniastej Pieczarki z parasolką
- środowisko: `grass_patch_atlas.png` dla trawnika wypełniającego dół sceny
- efekty: `effects`
- reakcje immersyjne: `curious`, `idle_fidget`, `idle_fidget_sway`, `idle_fidget_shift`, `idle_look_left`, `idle_look_right`, `ponder`, `ponder_up`, `ponder_side`, `ponder_breath`, `watch_cursor_left`, `watch_cursor_right`, `watch_cursor_up_left`, `watch_cursor_up_right`, `follow_cursor_fast`, `follow_cursor_after`, `sun`, `rain`, `stargaze`, `snow`, `watch_butterfly`, `watch_firefly`, `watch_crawler`

Każdy atlas stanu lub akcji ma jeden rząd pięciu postaci: `spore`, `baby`, `young`, `adult`, `legendary`. Tło atlasu jest płaskim chroma-key `#ff00ff`.

Dla etapu `spore` builder używa `spore_full_generated_atlas.png`: 19 kompletnych, wygenerowanych wariantów zarodka w kolejności stanów i akcji. Builder nie dokleja kapelusza ani nie składa twarzy z osobnych warstw; tylko usuwa chroma-key, skaluje, centruje po ciele i dokłada stabilną trawę czasu działania.

Dopracowane aktywności są sprite-first i mają docelowo `8` klatek per arkusz animacji (`4096x512`). Generator powinien traktować gest, mimikę i rekwizyt jako część PNG dla danego etapu. Canvas/czas działania nie dokłada dodatkowego body-motion do tych arkuszy animacji; zostają tylko stanowe overlaye i efekty pomocnicze z `assets/effects/`.

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

Builder nie rysuje ani nie dokleja miny `:|` do `idle_sheet.png` i nie rysuje parasolki pixel po pixelu. Czas działania `assets/easter-eggs/<stage>/neutral_sheet.png` oraz `assets/easter-eggs/<stage>/neutral_rain_sheet.png` są składane z wyrenderowanych wycinków i wspólnej frontowej trawy. Reakcje immersyjne, które zmieniają mimikę albo rekwizyt postaci, również powinny docelowo powstawać jako pełne PNG arkusze animacji, a nie jako canvasowy retusz twarzy.

Trawnik sceny też ma osobne wyrenderowane źródła:

```text
assets/source/imagegen/raw/grass_patch_atlas.png
assets/source/imagegen/cutouts/environment/grass_patch.png
assets/environment/grass_patch.png
```

`ClientSceneGround.html` rysuje ten zasób jako wypełnienie podłoża pod Pieczarką. Pojedyncze wyższe źdźbła są rysowane proceduralnie na canvasie, bo muszą reagować na aktualny kierunek, siłę i porywy wiatru.

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

```sh
python3 scripts/build-imagegen-sprites.py
```

Skrypt tworzy:

- `assets/stages/<stage>/<state>_sheet.png`
- `assets/activities/<stage>/<activity>_sheet.png`, dla dopracowanych aktywności w kontrakcie `8` klatek
- `assets/activities/<stage>/instrument_bell_sheet.png`, `instrument_flute_sheet.png`, `instrument_drum_sheet.png`, `instrument_rare_sheet.png` dla wariantów instrumentu wybieranych przez czas działania
- kompatybilne mechanizmy zastępcze `assets/activities/<activity>_sheet.png` z wariantu `adult`
- `assets/easter-eggs/<stage>/neutral_sheet.png`
- `assets/easter-eggs/<stage>/neutral_rain_sheet.png`
- `assets/effects/<effect>_sheet.png`
- `assets/environment/grass_patch.png`
- pomocnicze wycinki w `assets/source/imagegen/cutouts/`

Stan `excellent` jest czyszczony z odklejonych, statycznych gwiazdek z atlasu źródłowego. Builder zachowuje samą postać, a potem dokłada deterministyczne, klatkowane mikro-błyski w gotowym arkuszu. Dzięki temu promienienie Pieczarki jest animowane w PNG, bez canvasowych plusów skaczących wokół postaci.

Reakcje immersyjne (`curious`, warianty bezczynności i zamyślenia, reakcje kursora, `sun`, `rain`, `stargaze`, `snow`, `watch_butterfly`, `watch_firefly`, `watch_crawler`) są generowane z istniejących arkuszy animacji przez:

```sh
python3 scripts/generate-immersion-assets.py
```

Stary `scripts/generate-pixel-assets.py` deleguje do tego buildera, jeżeli wykryje `assets/source/imagegen/raw/idle_atlas.png`, a potem odświeża reakcje immersyjne.

## Walidacja

```sh
python3 -m py_compile scripts/build-imagegen-sprites.py scripts/generate-pixel-assets.py scripts/generate-immersion-assets.py
python3 scripts/build-imagegen-sprites.py
node scripts/validate-assets.mjs
python3 scripts/audit-activity-sprite-motion.py
python3 scripts/generate-instrument-variant-assets.py
python3 scripts/audit-glint-sprites.py
python3 scripts/audit-sprite-consistency.py
PIECZARGOTCHI_CAPTURE_STAGES=1 PIECZARGOTCHI_CAPTURE_ACTIVITIES=1 node scripts/capture-app-render.mjs http://127.0.0.1:8092/ /tmp/pieczargotchi-imagegen-final
PIECZARGOTCHI_CAPTURE_VIEWPORT=1 PIECZARGOTCHI_CAPTURE_STAGES=1 PIECZARGOTCHI_CAPTURE_ACTIVITIES=1 PIECZARGOTCHI_CAPTURE_IMMERSION=1 node scripts/capture-app-render.mjs http://127.0.0.1:8092/ /tmp/pieczargotchi-ui-final
```

Ostatnia walidacja:

- `233` arkusze animacji PNG i `1` asset środowiska przechodza `validate-assets`,
- manifest czas działania laduje `226` zasobów: stage, activity, easter egg, effect i environment; poza manifestem zostaja swiadomie walidowane tylko mechanizmy zastępcze `assets/activities/*.png`,
- stany bazowe, aktywności, neutralne easter eggi i nowe reakcje kursora trzymaja rozmiar/baseline w każdym etapie,
- dopracowane aktywności są sprawdzane jako `8`-klatkowe, osobne dla etapu arkusze animacji z gęstem w PNG, nie jako 4-klatkowy idle z canvasowym efektem,
- `spore` activity timing jest one-shot/hold w zakresie ludzkiego okna aktywności, a audyt lapie zbyt duzy drift i cienkie jasne poziome pasy typu "laser",
- `clean` zachowuje split: activity arkusz animacji czysci, a brud niskiej `cleanliness` pozostaje overlayem/stanem renderera,
- `spore/sleep` zachowuje split: PNG pokazuje spiace cialo, a `zZz` i zarodniki nie są wklejone w arkusz animacji snu,
- lokalny capture potwierdza osobne animacje akcji i reakcje immersyjne, w tym `watch_cursor_*`, `follow_cursor_*`, warianty `idle_fidget` oraz warianty `ponder`,
- viewport/canvas capture potwierdza czytelny render bez checkerboardu w obszarze canvasu.
