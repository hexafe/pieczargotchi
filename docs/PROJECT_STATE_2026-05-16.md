# Stan Projektu - 2026-05-16

## Status

Gałąź `codex-weather-sprite-audit` ma teraz slice progresji po v1: stan zapisu `4`, historię opieki, rozszerzony attention, dwie minigry, gałęzie ewolucji z prostymi cechami, dekoracje patcha, eksport/import JSON, Arenę 2.0 z prostszym AI i statusami oraz poprawione warstwy trawy i opadów.

Najważniejsza zasada architektury nadal obowiązuje: reguły i balans są w `.gs` albo testowalnych helperach `ClientCore*.html`; renderery czytają gotowy stan i rysują scenę.

## Nowe Systemy

- `StateModel.gs` rozszerza zapis o `history`, `evolution`, `minigames` i `decorations`.
- `ClientCoreProgression.html` normalizuje historię, zapisuje akcje, wybiera wariant ewolucji, obsługuje dekoracje oraz import/eksport.
- `ClientCoreMinigames.html` tworzy i rozlicza sesje minigier.
- `MinigamesConfig.gs`, `EvolutionRules.gs`, `DecorationStore.gs` i `SyncService.gs` rozdzielają konfigurację nowych systemów.
- `ClientMinigameDewCatch.html` i `ClientMinigameSporePop.html` dodają minigry `Łapanie rosy` oraz `Pękanie zarodników`; wyniki zwiększają odpowiednie statystyki, zarodniki i historię minigier.
- `ClientBackup.html` dodaje lokalny eksport/import JSON bez usług online.
- `ClientUi.html` pokazuje chip aktywnej potrzeby, etykietę ewolucji, panel gier, dekoracje, historię opieki i backup.
- `ClientCoreBattle.html` ma ważone ruchy przeciwnika, spowolnienie oraz samowzmocnienie staminy.

## Warstwy Renderowania

Aktualna kolejność sceny opieki:

1. Niebo, ciała niebieskie, tęcza, chmury.
2. Wiatr oraz tylna warstwa deszczu/śniegu.
3. Grunt, patch, życie tła.
4. Pieczarka.
5. Trawa pierwszego planu częściowo przykrywająca dół Pieczarki, komódka z dekoracjami, życie pierwszego planu.
6. Przednia warstwa deszczu/śniegu.
7. Efekty opieki, senne `Zz`, nuty, serca, krople i zarodniki.
8. Mgła, śnieg powierzchniowy i inne pogodowe nakładki pierwszego planu.

Deszcz i śnieg mają stabilny jednokierunkowy zegar ruchu (`getPrecipitationMotionNow`) i test regresji w `scripts/test-weather-precip-motion.mjs`, żeby klatki nie mogły spowodować cofnięcia albo oscylacji pionowej.

## Walidacja

Nowy minimalny zestaw lokalnych bramek:

```sh
node scripts/check-client-syntax.mjs
node scripts/check-deployment-readiness.mjs
node scripts/test-client-core.mjs
env TZ=UTC node scripts/test-client-core.mjs
node scripts/test-weather-precip-motion.mjs
node scripts/validate-assets.mjs
python3 scripts/audit-sprite-consistency.py
python3 scripts/audit-spore-sprites.py
bash scripts/run-local-linux.sh --check-only --validate-assets
```

Browser QA powinien dalej używać lokalnego preview i capture scripts dla areny, pogody, trawy i układu mobilnego.

## Następne Sensowne Slice'y

- Dodać kolejne minigry (`compost sort`, `rhythm hum`) na tym samym kontrakcie sesji i nagród.
- Rozwinąć unikalne zachowania wariantów ewolucji o osobne animacje i drobne pasywne bonusy.
- Rozbudować panel historii opieki o wykres trendów statystyk, gdy historia próbek będzie dłuższa.
- Po lokalnym dry run z prywatnym `.clasp.json` zrobić Apps Script smoke na testowym projekcie.
