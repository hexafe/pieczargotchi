# Journal And Calendar Polish - 2026-05-30

App version: `0.1.26`
State version: `13`

## Summary

This Slice 2 pass makes calendar discoveries clearer without changing care
balance, save shape, minigame rewards, or stat power. The calendar now exposes
source categories in data and UI, and checklist progress maps to cosmetic
polaroid frame tiers instead of gameplay bonuses.

## Implemented

- Calendar events expose explicit source category fields:
  - `official` -> `oficjalne`;
  - `sourceBacked` -> `źródłowe`;
  - `seasonalNatural` -> `sezon natury`;
  - `informal` -> `zabawa`.
- The world journal, discovery cards, tooltips, polaroid metadata, and calendar
  checklist include source labels where relevant.
- `Kalendarz grzybni` now derives cosmetic frame tiers from checked events:
  `Ramka mchu`, `Ramka rosy`, `Ramka pyłku`, `Ramka gwiazd`, and
  `Ramka grzybni`.
- Calendar checklist copy explicitly keeps rewards cosmetic: no stat bonus, no
  care pressure.
- Journal polaroid layout has a narrow-screen one-column mode with viewport
  height clamping and internal scroll.
- Missing sprite assets in journal polaroids use a neutral marker over the
  grass placeholder instead of procedural mushroom replacement art.
- Browser capture can force a specific journal discovery with
  `PIECZARGOTCHI_CAPTURE_JOURNAL_DISCOVERY=<id>` and asserts that the opened
  polaroid stays inside the viewport.
- Tea Day, Bee Day, Biodiversity Day, Soil Day, and Space Week now have more
  distinct code-native polaroid props instead of relying only on generic scene
  family accents.

## QA Notes

Pre-edit captures:

- `/tmp/pieczargotchi-slice2-journal-journal-polaroid-1194x891.png`
- `/tmp/pieczargotchi-slice2-calendar-mobile-viewport-390x844.png`

Focused checks run after implementation:

- `node scripts/check-client-syntax.mjs`
- `node scripts/test-client-core.mjs`
- `env TZ=UTC node scripts/test-client-core.mjs`
- `npm run build`
- `npm run test:cloudflare-static`
- `node scripts/check-deployment-readiness.mjs`
- `npm run audit:polish-copy`

Post-edit captures:

- `/tmp/pieczargotchi-slice2-after-journal-journal-polaroid-1194x891.png`
- `/tmp/pieczargotchi-slice2-final-journal-blocked-journal-polaroid-1194x891.png`
- `/tmp/pieczargotchi-slice2-final-calendar-mobile-viewport-390x844.png`

Additional post-edit event-polaroid captures:

- `/tmp/pieczargotchi-slice2-polaroid-teaDay-journal-polaroid-390x844.png`
- `/tmp/pieczargotchi-slice2-polaroid-worldBeeDay-journal-polaroid-390x844.png`
- `/tmp/pieczargotchi-slice2-polaroid-biodiversityDay-journal-polaroid-390x844.png`
- `/tmp/pieczargotchi-slice2-polaroid-soilDay-journal-polaroid-390x844.png`
- `/tmp/pieczargotchi-slice2-polaroid-spaceWeek-journal-polaroid-390x844.png`

## Remaining Slice 2 Work

- Add visual frame styling that uses the unlocked calendar frame tier on
  journal polaroids.
- Broaden mobile journal capture to cover every discovery group, not only the
  calendar event sample set.
- Plan or generate optional sprite-backed stage reactions for the strongest
  event families.
