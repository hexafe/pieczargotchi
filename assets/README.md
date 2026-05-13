# Assets

Runtime assets live in this directory.

## Aktualny Kontrakt

- Każda klatka runtime ma `512x512`.
- Każdy sheet jest poziomy i składa się z czterech klatek, czyli zwykle ma `2048x512`.
- Pliki runtime muszą być RGBA PNG.
- Treść klatek musi pozostać wycentrowana. Walidacja jest w `scripts/validate-assets.mjs`.
- Manifest runtime jest budowany w `AnimationConfig.gs`.
- Etapy wzrostu nie mogą powstawać przez skalowanie całej sceny. Pieczarka jest skalowana osobno, a wspólna frontowa trawa ma ten sam niższy, niespłaszczany wycinek dla każdego etapu.
- Trawa sceny ma dwa poziomy: osobny wygenerowany asset środowiska wypełnia podłoże pod Pieczarką, a pojedyncze wyższe źdźbła są rysowane w canvasie i reagują na wiatr.
- Runtime assety sa budowane z atlasow imagegen przez `scripts/build-imagegen-sprites.py`.

## Struktura

- `stages/` - animacje etapów wzrostu: `spore`, `baby`, `young`, `adult`, `legendary`.
- `activities/<stage>/` - jednorazowe reakcje na akcje opieki, muzykę, zarodniki i plon dla konkretnego etapu.
- `activities/*.png` - fallbacki kompatybilnosci z wariantu `adult`.
- `easter-eggs/<stage>/` - rzadkie warianty specjalne budowane z osobnych wyrenderowanych source cutoutow, np. neutralna mina `:|` i deszczowa wersja Iwoniastej Pieczarki z parasolka.
- `effects/` - małe opcjonalne efekty pomocnicze z atlasu imagegen.
- `environment/` - runtime assety sceny, np. wygenerowany trawnik `grass_patch.png`.
- `reference/` - źródłowe referencje stylu, nie ładować ich w aplikacji.
- `source/imagegen/raw/` - surowe atlasy z wbudowanego generatora obrazow, w tym `neutral_atlas.png`, `neutral_rain_atlas.png` i `grass_patch_atlas.png`.
- `source/imagegen/cutouts/` - wycinki pomocnicze z atlasow.
- `source/imagegen/cutouts/easter-eggs/neutral/` - wyrenderowane cutouty neutralnej miny; nie doklejaj miny skryptem do gotowego runtime sprite.
- `source/imagegen/cutouts/easter-eggs/neutral_rain/` - wyrenderowane cutouty neutralnej Iwoniastej Pieczarki z fioletowa parasolka; nie rysuj parasolki w canvasie ani skryptem pixel po pixelu.
- `source/imagegen/cutouts/environment/` - przetworzone source cutouty środowiska, np. `grass_patch.png`.
- `source/imagegen/generated/*_midgen_*.png` - lokalne eksperymenty/scratch output, ignorowane przez Git.
- `awake.png` i `sleeping_sheet.png` - starsze assety zachowane jako punkt odniesienia i kompatybilny materiał źródłowy.

Nowe lub zmienione pliki utrzymuj w zgodzie z `docs/SPRITE_BIBLE.md`,
`docs/STAGE_SPRITE_REQUIREMENTS.md`,
`docs/IMAGEGEN_ASSET_PIPELINE.md`,
`docs/ASSET_ANIMATION_IMPLEMENTATION_PLAN.md` i `AnimationConfig.gs`.
