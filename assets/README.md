# Assets

Runtime assets live in this directory.

## Aktualny Kontrakt

- Każda klatka runtime ma `512x512`.
- Każdy sheet jest poziomy i składa się z czterech klatek, czyli zwykle ma `2048x512`.
- Pliki runtime muszą być RGBA PNG.
- Treść klatek musi pozostać wycentrowana. Walidacja jest w `scripts/validate-assets.mjs`.
- Manifest runtime jest budowany w `AnimationConfig.gs`.
- Etapy wzrostu nie mogą powstawać przez skalowanie całej sceny. Trawa zostaje wspólna, a zmienia się sama Pieczarka.
- Runtime assety sa budowane z atlasow imagegen przez `scripts/build-imagegen-sprites.py`.

## Struktura

- `stages/` - animacje etapów wzrostu: `spore`, `baby`, `young`, `adult`, `legendary`.
- `activities/<stage>/` - jednorazowe reakcje na akcje opieki, muzykę, zarodniki i plon dla konkretnego etapu.
- `activities/*.png` - fallbacki kompatybilnosci z wariantu `adult`.
- `effects/` - małe opcjonalne efekty pomocnicze z atlasu imagegen.
- `reference/` - źródłowe referencje stylu, nie ładować ich w aplikacji.
- `source/imagegen/raw/` - surowe atlasy z wbudowanego generatora obrazow.
- `source/imagegen/cutouts/` - wycinki pomocnicze z atlasow.
- `awake.png` i `sleeping_sheet.png` - starsze assety zachowane jako punkt odniesienia i kompatybilny materiał źródłowy.

Nowe lub zmienione pliki utrzymuj w zgodzie z `docs/SPRITE_BIBLE.md`,
`docs/STAGE_SPRITE_REQUIREMENTS.md`,
`docs/IMAGEGEN_ASSET_PIPELINE.md`,
`docs/ASSET_ANIMATION_IMPLEMENTATION_PLAN.md` i `AnimationConfig.gs`.
