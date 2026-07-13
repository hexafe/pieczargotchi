# Pieczargotchi

Pieczargotchi is a small Google Apps Script and Cloudflare static web app for a pixel-art mushroom care game.

The local v1 targets a 512x512 canvas, local browser persistence, a sleep/wake loop, care actions, visible cooldowns, keyboard shortcuts, weather-driven scene life, minigames, long-term progression, JSON backup, podłoże decorations, and a local Legendary Arena. See `docs/IMPLEMENTATION_PLAN.md` for the original roadmap, `docs/NEXT_STEPS.md` for the current planning hub, `docs/VISUAL_ASSET_IMPLEMENTATION_2026-07-11.md` for the `0.1.49` visual-pipeline checkpoint, and `docs/UI_SCENE_FIRST_IMPLEMENTATION_2026-07-12.md` for the `0.1.50` scene-first UI checkpoint plus the current `0.1.51` GUI-hardening addendum.

## Current Layout

- `Code.gs` - Apps Script `doGet()` entrypoint and HTML partial include helper.
- `Config.gs` - app constants, state version, canvas size, deployment flags, public asset-base configuration, and optional private Drive backup settings.
- `AnimationConfig.gs` - runtime manifest for stage, activity, easter-egg, effect, environment, and battle assets.
- `SpriteLayout.gs` - generated tight-atlas metadata that maps logical 512x512 frames to cropped, deduplicated PNG frames; rebuild it with `scripts/optimize-runtime-sprite-atlases.py` instead of editing it by hand.
- `AssetService.gs` - whitelisted asset-key loading for the optional Drive backup path; arbitrary Drive IDs are never a public RPC.
- `StateModel.gs` - default state shape and state metadata exposed to the client.
- `GameRules.gs` - decay, growth, stage, animation, and instrument configuration.
- `MinigamesConfig.gs`, `EvolutionRules.gs`, `DecorationStore.gs`, and `SyncService.gs` - focused configs/services for minigames, evolution variants, podłoże decorations, and JSON backup.
- `Actions.gs` - care action definitions, cooldowns, shortcuts, and stat deltas.
- `Index.html` - web app shell.
- `Styles.html` - responsive pixel-game CSS.
- `Client.html` - thin Apps Script include aggregator for client partials.
- `ClientCore.html` - Apps Script include shell for the testable browser-global core.
- `ClientCoreWeather.html`, `ClientCoreLife.html`, `ClientCoreCare.html`, `ClientCoreBattle.html`, `ClientCoreImmersion.html`, `ClientCoreProgression.html`, `ClientCoreMinigames.html`, `ClientCoreShared.html`, and `ClientCoreExports.html` - pure core helpers exported as `window.PieczargotchiCore`, including weather balance, ambient life, state migrations, attention, animation intent, immersion reaction selection, progression, minigame rewards, backup import/export, and battle reducer primitives.
- `ClientBoot.html`, `ClientDebug.html`, `ClientRuntime.html`, `ClientWeather.html`, `ClientState.html`, `ClientActions.html`, `ClientMinigame*.html`, `ClientBackup.html`, `ClientUi.html`, `ClientBattleScene.html`, `ClientInteraction.html`, `ClientAnimation.html`, `ClientScene*.html`, and `ClientSprites.html` - client code split by responsibility. `ClientInteraction.html` tracks pointer input and draws visual immersion overlays; `ClientBattleScene.html` renders the local arena; minigame partials render the short canvas games; `ClientScene.html` is the care-scene orchestrator; palette, celestial, rainbow, weather, seasonal ambient life, and ground rendering live in focused scene partials.
- `ClientSceneWeather.html` - weather-renderer include shell; cloud flow, precipitation, surface overlays, and shared wind/noise helpers live in `ClientSceneWeather*.html` partials.
- `assets/awake.png` - prepared awake mushroom sprite.
- `assets/sleeping_sheet.png` - prepared four-frame sleeping sprite sheet.
- `assets/stages/` - growth-stage sprite sheets.
- `assets/activities/` - one-shot activity animation sheets separated by growth stage; runtime instrument variants intentionally alias the real per-stage `instrument_sheet.png` until distinct art exists.
- `assets/battle/` - a 512x512 arena background and body-only 256x256 four-pose sheets for the legendary player and three opponents.
- `assets/effects/` - optional small effect sheets.
- `assets/reference/` - source style references, not loaded by the app.
- `assets/source/imagegen/` - raw generated-image atlases and extracted cutouts used by the asset builder.
- `assets/source/imagegen/PROVENANCE.json` - source and deterministic-derivative provenance for the runtime-v2 and battle collections.
- `docs/IMPLEMENTATION_PLAN.md` - phase plan and architecture notes.
- `docs/REAL_APP_NEXT_STEPS.md` - researched roadmap for turning the MVP into a deeper virtual-pet app.
- `docs/ASSET_ANIMATION_IMPLEMENTATION_PLAN.md` - next implementation plan for growth-stage sprites and activity animations.
- `docs/SPRITE_BIBLE.md` - practical sprite style and validation contract.
- `docs/STAGE_SPRITE_REQUIREMENTS.md` - required growth-stage sprite list and validation contract.
- `docs/IMAGEGEN_ASSET_PIPELINE.md` - source atlas descriptions, source paths, build steps, and validation commands.
- `docs/ASSET_INVENTORY.md` - generated manifest entry, unique application file, and compressed-size inventory.
- `docs/VISUAL_ASSET_IMPLEMENTATION_2026-07-11.md` - implementation and verification checkpoint for tight atlases, shared grass, battle art, provenance, and the `0.1.49` / state-v18 target.
- `docs/UI_SCENE_FIRST_IMPLEMENTATION_2026-07-12.md` - scene-first UI architecture, responsive matrix, accessible minigame flow, modal backup safety, the `0.1.50` release contract, and the `0.1.51` GUI-hardening addendum.
- `docs/UI_RENDER_AUDIT_2026-05-10.md` - screenshot-driven UI/rendering fixes and viewport validation.
- `docs/SPRITE_AUDIT_2026-05-10.md` - focused audit for sprite size and wake-face alignment.
- `docs/APPS_SCRIPT_DEPLOYMENT_DRY_RUN.md` - test deployment checklist that keeps `.clasp.json`, script IDs, and private Drive IDs local.
- `docs/PROJECT_STATE_2026-05-17.md` - current architecture, balance, and maintenance checkpoint.
- `docs/PROJECT_STATE_2026-05-16.md` - previous progression, rendering, and weather checkpoint.
- `docs/PRODUCT_RULES.md` - gameplay and balance rules for future development.
- `docs/WEATHER_SYSTEM.md` - current weather simulation rules, gameplay/environment interactions, and realism notes.
- `.github/workflows/ci.yml` - GitHub Actions checks for client syntax, core rules, assets, sprite consistency, and local preview scripts.
- `scripts/build-imagegen-sprites.py` - builds animation sheets from generated-image atlases.
- `scripts/optimize-runtime-sprite-atlases.py` - crops transparent margins, deduplicates physical frames, and regenerates `SpriteLayout.gs` while preserving logical canvas coordinates.
- `scripts/generate-battle-assets.py` - deterministically builds the body-only arena combatants and shared arena background.
- `scripts/generate-pixel-assets.py` - compatibility entrypoint; delegates to the generated-image builder when generated-image sources exist.
- `scripts/validate-assets.mjs` - local PNG dimension, frame, and centering validation.
- `scripts/audit-sprite-consistency.py` - local size/center consistency audit for stage animations.
- `scripts/audit-spore-sprites.py` - local spore-stage sprite audit.
- `scripts/check-deployment-readiness.mjs` - credential-free Apps Script deployment preflight.
- `scripts/run-qa.mjs` - verified-build and full release QA orchestrator.
- `scripts/test-weather-precip-motion.mjs` - regression tests for monotonic rain/snow motion and precipitation layer split.
- `scripts/capture-life-motion.mjs` - local browser capture gate for butterflies, crawling bugs, fireflies, and mobile scene-life layout.
- `scripts/capture-weather-matrix.mjs` - local weather and sky capture matrix for debug QA scenarios.

The interface is Polish-first. The current worktree includes manifest-driven growth-stage animations, sprite-backed wake reactions, body-only generated-image `spore`, `baby`, `young`, `adult`, and `legendary` silhouettes, one shared wind/weather-reactive grass system with a stage-aware foreground clearing, moving seasonal butterflies, small insects, crawling bugs, fireflies, activity reactions for each growth stage, need-driven sprite states, attention calls, błędy opieki, jakość podłoża, grzybnia progress, spore harvest rewards, `Łapanie rosy`, `Pękanie zarodników`, `Sortowanie kompostu`, `Rytmiczne nucenie`, evolution variants with trait behavior and visual accents, visible podłoże decorations with siedlisko bonuses, care-history summary, JSON backup, foreground/background rain and snow layers, and a local Legendary Arena whose persisted combatants use stable `visualId` values.

## Development

`appsscript.json` is committed for a Google Apps Script V8 web app. To deploy with `clasp`, bind the repository to an Apps Script project, then push:

```sh
node scripts/check-deployment-readiness.mjs
npm run apps-script:status
npx --no-install clasp push
```

Do not commit `.clasp.json`, private Apps Script script IDs, private Drive URLs, or deployment credentials. The repo `.gitignore` keeps `.clasp.json` local, while `.claspignore` allows only root `.gs`, `.html`, and `appsscript.json` files into an Apps Script push.
Use `docs/APPS_SCRIPT_DEPLOYMENT_DRY_RUN.md` for the full test-project dry-run checklist.

For Apps Script deployment, the preferred asset setup is the versioned public Cloudflare asset directory. For the current release, first verify that `Config.gs` and `package.json` both identify `0.1.51` and the state contract is v18, then set this Apps Script Script Property without editing tracked source:

```text
PIECZARGOTCHI_ASSET_BASE_URL_0_1_51=https://YOUR-PUBLIC-HOST.example/releases/0.1.51/assets/
```

The property key and URL are release-specific: this prevents a later Script Property update from retargeting an older Apps Script deployment. The URL must use HTTPS and contain the exact visible release as its own path segment. The host must retain every published release directory; overwriting or removing an older directory can break an older deployment. Application requests append the manifest path and visible version query without embedding tens of MiB as data URLs.

After deploying the web app, set `DEPLOYED_APPS_SCRIPT_URL` to its public `/exec` URL and run the fail-closed external gate:

```sh
PIECZARGOTCHI_APPS_SCRIPT_WEB_APP_URL="$DEPLOYED_APPS_SCRIPT_URL" npm run qa:apps-script-release
```

It verifies the deployed version and production flags, the immutable asset root, and four real critical PNG responses.

Drive remains an opt-in backup path for controlled deployments. Enabling it requires deliberate OAuth scopes plus `PIECZARGOTCHI_DRIVE_ASSETS_ENABLED`; the only browser RPC accepts a manifest asset key. Folder IDs and per-file IDs never appear in the public config. If neither public hosting nor Drive is configured, Apps Script renders canvas placeholders instead of a blank app.

Production flags live in `Config.gs`. By default the deployed config keeps the debug panel and `window.__pieczargotchiRuntime` private, and boots in critical asset mode. `dev-server.mjs` exposes local diagnostics but also defaults to critical/lazy asset loading; use `PIECZARGOTCHI_ASSET_MODE=full` only for an intentional asset sweep.

## Local Preview

Pieczargotchi uses Node.js 22 or newer. The preview itself does not need Google credentials or Drive IDs. Run `npm ci` once to install the pinned Wrangler toolchain used by QA and deployment.

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

The preview server renders the Apps Script partials locally, injects a client config from the `.gs` files (including generated `SpriteLayout.gs`), and serves `assets/` directly. It does not require Drive file IDs. Browser capture rejects a screenshot when the active tight-atlas metadata does not match the PNG's physical dimensions.

The local release/deploy gate is one command after installing the pinned Node
and Python QA dependencies:

```sh
npm ci
python3 -m pip install -r requirements-qa.txt
npm run qa
```

It includes syntax checks for every repository QA script, deterministic UTC
and Europe/Warsaw rules tests, manifest-driven sprite audits, the static build,
balance thresholds, and a real headless Chrome smoke.

For repeatable scene-life screenshots, `scripts/capture-app-render.mjs` accepts the existing debug weather/date variables plus capture-only `PIECZARGOTCHI_DEBUG_TEMPERATURE`, `PIECZARGOTCHI_DEBUG_HUMIDITY`, `PIECZARGOTCHI_CAPTURE_DELAY_MS`, and `PIECZARGOTCHI_CAPTURE_LIFE_PROFILE=1`. Calendar event QA can force a single event with `PIECZARGOTCHI_DEBUG_CALENDAR_EVENT=<id>`, run the event matrix with `PIECZARGOTCHI_CAPTURE_CALENDAR_MATRIX=1`, and include the checklist in viewport checks with `PIECZARGOTCHI_CAPTURE_CALENDAR_CHECKLIST=1`.

Focused browser capture gates:

```sh
node scripts/capture-life-motion.mjs
node dev-server.mjs 8092
```

With that preview server running:

```sh
PIECZARGOTCHI_CAPTURE_ARENA=1 node scripts/capture-app-render.mjs http://127.0.0.1:8092/ /tmp/pieczargotchi-arena
PIECZARGOTCHI_CAPTURE_ARENA=1 PIECZARGOTCHI_VIEWPORT_WIDTH=390 PIECZARGOTCHI_VIEWPORT_HEIGHT=844 PIECZARGOTCHI_EMULATE_MOBILE=1 node scripts/capture-app-render.mjs http://127.0.0.1:8092/ /tmp/pieczargotchi-arena-mobile
PIECZARGOTCHI_CAPTURE_CALENDAR_MATRIX=1 node scripts/capture-app-render.mjs http://127.0.0.1:8092/ /tmp/pieczargotchi-calendar
PIECZARGOTCHI_CAPTURE_VIEWPORT=1 PIECZARGOTCHI_CAPTURE_CALENDAR_CHECKLIST=1 PIECZARGOTCHI_VIEWPORT_WIDTH=390 PIECZARGOTCHI_VIEWPORT_HEIGHT=844 PIECZARGOTCHI_EMULATE_MOBILE=1 node scripts/capture-app-render.mjs http://127.0.0.1:8092/ /tmp/pieczargotchi-calendar-mobile
```
