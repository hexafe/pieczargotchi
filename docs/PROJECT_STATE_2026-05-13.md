# Stan Projektu - 2026-05-13

## Status

Pieczargotchi ma działające lokalne v1: modularny Apps Script web app, lokalny preview, PNG runtime, pogodę z lokalizacji, scenę reagującą na pogodę, ruchome życie w tle, attention/care mistakes, spore loop oraz lokalną Arenę dla Legendarnej Pieczarki.

Najważniejsza decyzja nadal obowiązuje: nowe funkcje mają trafiać do osobnych partiali albo testowalnego core. Renderer może czytać stan, ale zasady gry i balans pozostają w `GameRules.gs` albo czystych helperach `ClientCore.html`.

## Aktualna Architektura

- `Client.html` jest cienkim agregatorem partiali.
- `ClientCore.html` zawiera testowalne helpery dla migracji, cooldownów, attention, pogody, ambient life, animacji i battle reducera.
- `ClientBattleScene.html` renderuje osobną scenę Areny i nie miesza walki z care-scene rendererem.
- `ClientScene.html` orkiestruje scenę opieki; `ClientScenePalette.html`, `ClientSceneCelestial.html`, `ClientSceneWeather.html`, `ClientSceneLife.html` i `ClientSceneGround.html` trzymają wyspecjalizowane warstwy canvasu.
- `ClientSceneLife.html` rysuje motyle po płynnych nieregularnych trasach, świetliki po spokojnym dryfie góra-dół i na boki, oraz naziemne owady wychodzące zza krawędzi albo z wysokiej trawy.
- State ma wersję `3`; zapis nadal używa klucza `pieczargotchi_state_v2`, a `state.battle` jest osobnym subtree dla Areny.
- Produkcyjny runtime trzyma debug i `window.__pieczargotchiRuntime` prywatnie; lokalny `dev-server.mjs` włącza je dla preview, debug menu i capture tooling.

## Arena

- Arena odblokowuje się tylko na `state.stage === 'legendary'`.
- Przełącznik `Opieka / Arena` pojawia się dopiero po odblokowaniu.
- Arena ma osobny canvas renderer, HP/stamina, cztery ruchy, trening, log walki i wynik.
- Trening kosztuje `1` zarodnik za punkt i respektuje cap `20`.
- Walka zapisuje seed i snapshot care stats na starcie; późniejsza opieka nie mutuje aktywnego snapshotu.
- Wygrana daje `+1 trophy`, `+1 win`, `+2` zarodniki; przegrana daje tylko `+1 loss`.

## Walidacja

Podstawowe lokalne checki:

```sh
node scripts/check-client-syntax.mjs
node scripts/test-client-core.mjs
env TZ=UTC node scripts/test-client-core.mjs
node scripts/validate-assets.mjs
python3 scripts/audit-sprite-consistency.py
python3 scripts/audit-spore-sprites.py
bash scripts/run-local-linux.sh --check-only
```

Browser/capture QA:

```sh
node scripts/capture-life-motion.mjs
node dev-server.mjs 8092
```

Z uruchomionym preview na porcie 8092:

```sh
PIECZARGOTCHI_CAPTURE_ARENA=1 node scripts/capture-app-render.mjs http://127.0.0.1:8092/ /tmp/pieczargotchi-arena
PIECZARGOTCHI_CAPTURE_ARENA=1 PIECZARGOTCHI_VIEWPORT_WIDTH=390 PIECZARGOTCHI_VIEWPORT_HEIGHT=844 PIECZARGOTCHI_EMULATE_MOBILE=1 node scripts/capture-app-render.mjs http://127.0.0.1:8092/ /tmp/pieczargotchi-arena-mobile
node scripts/capture-weather-matrix.mjs http://127.0.0.1:8092/ /tmp/pieczargotchi-weather-matrix
```

## Następne Sensowne Slice'y

- Apps Script deployment dry run: bind local clone with private `.clasp.json`, push to a test script, and verify missing Drive IDs fall back gracefully.
- Backup/export/import JSON for `localStorage`, still without online sync.
- First short minigame, preferably dew catch, because it reinforces moisture care without expanding Arena complexity.
- Long-term evolution branches that consume care mistakes, sleep rhythm, patch quality, music/play history and moisture stability.
