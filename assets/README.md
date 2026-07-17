# Assets

Zasoby używane podczas działania aplikacji live in this directory.

## Aktualny Kontrakt

- Każda klatka używana podczas działania aplikacji ma `512x512`.
- Każdy arkusz animacji jest poziomy i składa się z czterech klatek, czyli zwykle ma `2048x512`.
- Pliki używane podczas działania aplikacji muszą być RGBA PNG.
- Treść klatek musi pozostać wycentrowana. Walidacja jest w `scripts/validate-assets.mjs`.
- Manifest uruchomieniowy jest budowany w `AnimationConfig.gs`.
- Etapy wzrostu nie mogą powstawać przez skalowanie całej sceny. Pieczarka jest skalowana osobno, a wspólna frontowa trawa ma ten sam niższy, niespłaszczany wycinek dla każdego etapu.
- Trawa sceny ma dwa poziomy: osobny wygenerowany asset środowiska wypełnia podłoże pod Pieczarką, a pojedyncze wyższe źdźbła są rysowane w canvasie i reagują na wiatr.
- Zasoby używane podczas działania są budowane z atlasów generatora obrazów przez `scripts/build-imagegen-sprites.py`.

## Struktura

- `stages/` - animacje etapów wzrostu: `spore`, `baby`, `young`, `adult`, `legendary`, w tym reakcje immersyjne `curious`, `sun`, `rain`, `stargaze` i `snow`.
- `activities/<stage>/` - jednorazowe reakcje na akcje opieki, muzykę, zarodniki i plon dla konkretnego etapu.
- `activities/*.png` - mechanizmy zastępcze kompatybilności z wariantu `adult`.
- `easter-eggs/<stage>/` - rzadkie warianty specjalne budowane z osobnych wyrenderowanych wycinków źródłowych, np. neutralna mina `:|` i deszczowa wersja Iwoniastej Pieczarki z fioletową parasolką.
- `effects/` - małe efekty pomocnicze z atlasu generatora obrazów ładowane przez manifest jako warstwy `effect.*`.
- `environment/` - zasoby używane podczas działania sceny, np. wygenerowany trawnik `grass_patch.png`.
- `journal/` - atlas rasterowych rekwizytów używanych wyłącznie w zdjęciach dziennika.
- `reference/` - źródłowe referencje stylu, nie ładować ich w aplikacji.
- `source/imagegen/raw/` - surowe atlasy z wbudowanego generatora obrazów, w tym `neutral_atlas.png`, `neutral_rain_atlas.png` i `grass_patch_atlas.png`.
- `source/imagegen/cutouts/` - wycinki pomocnicze z atlasów.
- `source/imagegen/cutouts/easter-eggs/neutral/` - wyrenderowane wycinki neutralnej miny; nie doklejaj miny skryptem do gotowego sprite'a.
- `source/imagegen/cutouts/easter-eggs/neutral_rain/` - wyrenderowane wycinki neutralnej Iwoniastej Pieczarki z fioletową parasolką; nie rysuj parasolki w canvasie ani skryptem pixel po pixelu.
- `source/imagegen/cutouts/environment/` - przetworzone wycinki źródłowe środowiska, np. `grass_patch.png`.
- `source/imagegen/generated/*_midgen_*.png` - lokalne eksperymenty/scratch output, ignorowane przez Git.
- `awake.png` i `sleeping_sheet.png` - starsze zasoby zachowane jako punkt odniesienia i kompatybilny materiał źródłowy.

Nowe lub zmienione pliki utrzymuj w zgodzie z `docs/SPRITE_BIBLE.md`,
`docs/STAGE_SPRITE_REQUIREMENTS.md`,
`docs/IMAGEGEN_ASSET_PIPELINE.md`,
`docs/ASSET_ANIMATION_IMPLEMENTATION_PLAN.md` i `AnimationConfig.gs`.
