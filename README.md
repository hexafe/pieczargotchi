# Pieczargotchi

Pieczargotchi is a small Google Apps Script web app for a pixel-art mushroom care game.

The local v1 targets a 512x512 canvas, local browser persistence, a sleep/wake loop, care actions, visible cooldowns, keyboard shortcuts, weather-driven scene life, minigames, long-term progression, JSON backup, patch decorations, and a local Legendary Arena. See `docs/IMPLEMENTATION_PLAN.md` for the original implementation roadmap and `docs/PROJECT_STATE_2026-05-16.md` for the current checkpoint.

## Current Layout

- `Code.gs` - Apps Script `doGet()` entrypoint and HTML partial include helper.
- `Config.gs` - app constants, state version, canvas size, runtime flags, and Drive asset IDs.
- `AnimationConfig.gs` - runtime animation manifest for stage and activity sprite sheets.
- `AssetService.gs` - Drive PNG to data URL loading for the client.
- `StateModel.gs` - default state shape and state metadata exposed to the client.
- `GameRules.gs` - decay, growth, stage, animation, and instrument configuration.
- `MinigamesConfig.gs`, `EvolutionRules.gs`, `DecorationStore.gs`, and `SyncService.gs` - focused configs/services for minigames, evolution variants, patch decorations, and JSON backup.
- `Actions.gs` - care action definitions, cooldowns, shortcuts, and stat deltas.
- `Index.html` - web app shell.
- `Styles.html` - responsive pixel-game CSS.
- `Client.html` - thin Apps Script include aggregator for client partials.
- `ClientCore.html` - Apps Script include shell for the testable browser-global core.
- `ClientCoreWeather.html`, `ClientCoreLife.html`, `ClientCoreCare.html`, `ClientCoreBattle.html`, `ClientCoreProgression.html`, `ClientCoreMinigames.html`, `ClientCoreShared.html`, and `ClientCoreExports.html` - pure core helpers exported as `window.PieczargotchiCore`, including weather balance, ambient life, state migrations, attention, animation intent, progression, minigame rewards, backup import/export, and battle reducer primitives.
- `ClientBoot.html`, `ClientDebug.html`, `ClientRuntime.html`, `ClientWeather.html`, `ClientState.html`, `ClientActions.html`, `ClientMinigameDewCatch.html`, `ClientMinigameSporePop.html`, `ClientBackup.html`, `ClientUi.html`, `ClientBattleScene.html`, `ClientAnimation.html`, `ClientScene*.html`, and `ClientSprites.html` - client runtime split by responsibility. `ClientBattleScene.html` renders the local arena; `ClientScene.html` is the care-scene orchestrator; palette, celestial, rainbow, weather, seasonal ambient life, and ground rendering live in focused scene partials.
- `ClientSceneWeather.html` - weather-renderer include shell; cloud flow, precipitation, surface overlays, and shared wind/noise helpers live in `ClientSceneWeather*.html` partials.
- `assets/awake.png` - prepared awake mushroom sprite.
- `assets/sleeping_sheet.png` - prepared four-frame sleeping sprite sheet.
- `assets/stages/` - growth-stage sprite sheets.
- `assets/activities/` - stage-specific one-shot activity animation sheets plus adult fallback sheets.
- `assets/effects/` - optional small effect sheets.
- `assets/reference/` - source style references, not runtime assets.
- `assets/source/imagegen/` - raw imagegen atlases and extracted cutouts used by the asset builder.
- `docs/IMPLEMENTATION_PLAN.md` - phase plan and architecture notes.
- `docs/REAL_APP_NEXT_STEPS.md` - researched roadmap for turning the MVP into a deeper virtual-pet app.
- `docs/ASSET_ANIMATION_IMPLEMENTATION_PLAN.md` - next implementation plan for growth-stage sprites and activity animations.
- `docs/SPRITE_BIBLE.md` - practical sprite style and validation contract.
- `docs/STAGE_SPRITE_REQUIREMENTS.md` - required growth-stage sprite list and validation contract.
- `docs/IMAGEGEN_ASSET_PIPELINE.md` - imagegen atlas prompts, source paths, build steps, and validation commands.
- `docs/UI_RENDER_AUDIT_2026-05-10.md` - screenshot-driven UI/rendering fixes and viewport validation.
- `docs/SPRITE_AUDIT_2026-05-10.md` - focused audit for sprite size and wake-face alignment.
- `docs/APPS_SCRIPT_DEPLOYMENT_DRY_RUN.md` - test deployment checklist that keeps `.clasp.json`, script IDs, and private Drive IDs local.
- `docs/PROJECT_STATE_2026-05-16.md` - current architecture and maintenance checkpoint.
- `docs/PRODUCT_RULES.md` - gameplay and balance rules for future development.
- `docs/WEATHER_SYSTEM.md` - current weather simulation rules, gameplay/environment interactions, and realism notes.
- `.github/workflows/ci.yml` - GitHub Actions checks for client syntax, core rules, assets, sprite consistency, and local preview scripts.
- `scripts/build-imagegen-sprites.py` - builds runtime sheets from imagegen atlases.
- `scripts/generate-pixel-assets.py` - compatibility entrypoint; delegates to the imagegen builder when imagegen sources exist.
- `scripts/validate-assets.mjs` - local PNG dimension, frame, and centering validation.
- `scripts/audit-sprite-consistency.py` - local size/center consistency audit for stage animations.
- `scripts/audit-spore-sprites.py` - local spore-stage sprite audit.
- `scripts/check-deployment-readiness.mjs` - credential-free Apps Script deployment preflight.
- `scripts/test-weather-precip-motion.mjs` - regression tests for monotonic rain/snow motion and precipitation layer split.
- `scripts/capture-life-motion.mjs` - local browser capture gate for butterflies, crawling bugs, fireflies, and mobile scene-life layout.
- `scripts/capture-weather-matrix.mjs` - local weather and sky capture matrix for debug QA scenarios.

The interface is Polish-first. The current build includes manifest-driven growth-stage animations, a short `O_O` wake expression, imagegen-based `spore`, `baby`, `young`, `adult`, and `legendary` silhouettes with a shared grass base, denser wind/weather-reactive procedural grass that grows in front of the mushroom, moving seasonal butterflies, small insects, crawling bugs, fireflies, stage-specific activity reactions, need-driven sprite states, attention calls, care mistakes, patch quality, mycelium progress, spore harvest rewards, `Łapanie rosy`, `Pękanie zarodników`, evolution variants with small trait behavior, visible patch decorations on a small mushroom dresser, care-history summary, JSON backup, foreground/background rain and snow layers, and a local Legendary Arena with deterministic battle state under `state.battle`.

## Development

`appsscript.json` is committed for a Google Apps Script V8 web app. To deploy with `clasp`, bind the repository to an Apps Script project, then push:

```sh
node scripts/check-deployment-readiness.mjs
npx @google/clasp push
```

Do not commit `.clasp.json`, private Apps Script script IDs, private Drive URLs, or deployment credentials. The repo `.gitignore` keeps `.clasp.json` local.
Use `docs/APPS_SCRIPT_DEPLOYMENT_DRY_RUN.md` for the full test-project dry-run checklist.

Set the Drive file IDs for runtime assets in `Config.gs`:

- keys matching the animation manifest, for example `spore.idle`, `baby.sleep`, and `baby.activity.hydrate`

If the IDs are blank or unavailable, the local preview loads PNG files from `assets/`. In a deployed Apps Script environment, missing Drive IDs fall back to canvas placeholders instead of showing a blank app. Reference files under `assets/reference/` are not loaded at runtime.

Production runtime flags live in `Config.gs`. By default the deployed config keeps the debug panel and `window.__pieczargotchiRuntime` private; `dev-server.mjs` enables both for local preview and capture tooling.

## Local Preview

Pieczargotchi's local preview only needs Node.js 18 or newer. It does not need `clasp`, Google Apps Script deployment, Drive asset IDs, or npm dependencies.

Use the OS bootstrap scripts if you want the script to check/install Node.js, check the required app files, open the browser, and start the preview server.

Linux:

```sh
bash scripts/run-local-linux.sh
```

Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\run-local-windows.ps1
```

Useful options:

```sh
bash scripts/run-local-linux.sh --install --port 8090 --validate-assets
powershell -ExecutionPolicy Bypass -File scripts\run-local-windows.ps1 -Install -Port 8090 -ValidateAssets
```

Run checks without starting the server:

```sh
bash scripts/run-local-linux.sh --check-only
powershell -ExecutionPolicy Bypass -File scripts\run-local-windows.ps1 -CheckOnly
```

Manual server command from the repo root:

```sh
node dev-server.mjs
```

Then open:

```text
http://127.0.0.1:8080/
```

Use another port if needed:

```sh
node dev-server.mjs 8090
```

The preview server renders the Apps Script partials locally, injects a client config from the `.gs` files, and serves `assets/` directly. It does not require Drive file IDs.

Quick local syntax checks:

```sh
node scripts/check-client-syntax.mjs
node scripts/check-deployment-readiness.mjs
node scripts/test-client-core.mjs
env TZ=UTC node scripts/test-client-core.mjs
node scripts/test-weather-precip-motion.mjs
node -e "const fs=require('fs'); for (const f of ['Code.gs','Config.gs','AnimationConfig.gs','AssetService.gs','StateModel.gs','GameRules.gs','MinigamesConfig.gs','EvolutionRules.gs','DecorationStore.gs','SyncService.gs','Actions.gs']) { new Function(fs.readFileSync(f,'utf8')); console.log(f + ' syntax ok'); }"
node scripts/validate-assets.mjs
python3 scripts/audit-sprite-consistency.py
python3 scripts/audit-spore-sprites.py
bash scripts/run-local-linux.sh --check-only
```

For repeatable scene-life screenshots, `scripts/capture-app-render.mjs` accepts the existing debug weather/date variables plus capture-only `PIECZARGOTCHI_DEBUG_TEMPERATURE`, `PIECZARGOTCHI_DEBUG_HUMIDITY`, `PIECZARGOTCHI_CAPTURE_DELAY_MS`, and `PIECZARGOTCHI_CAPTURE_LIFE_PROFILE=1`.

Focused browser capture gates:

```sh
node scripts/capture-life-motion.mjs
node dev-server.mjs 8092
```

With that preview server running:

```sh
PIECZARGOTCHI_CAPTURE_ARENA=1 node scripts/capture-app-render.mjs http://127.0.0.1:8092/ /tmp/pieczargotchi-arena
PIECZARGOTCHI_CAPTURE_ARENA=1 PIECZARGOTCHI_VIEWPORT_WIDTH=390 PIECZARGOTCHI_VIEWPORT_HEIGHT=844 PIECZARGOTCHI_EMULATE_MOBILE=1 node scripts/capture-app-render.mjs http://127.0.0.1:8092/ /tmp/pieczargotchi-arena-mobile
```
