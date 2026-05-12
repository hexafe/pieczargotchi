# Pieczargotchi

Pieczargotchi is a small Google Apps Script web app for a pixel-art mushroom care game.

The MVP targets a 512x512 canvas, local browser persistence, a sleep/wake loop, care actions, visible cooldowns, and keyboard shortcuts. See `docs/IMPLEMENTATION_PLAN.md` for the implementation roadmap.

## Current Layout

- `Code.gs` - Apps Script `doGet()` entrypoint and HTML partial include helper.
- `Config.gs` - app constants, state version, canvas size, and Drive asset IDs.
- `AnimationConfig.gs` - runtime animation manifest for stage and activity sprite sheets.
- `AssetService.gs` - Drive PNG to data URL loading for the client.
- `StateModel.gs` - default state shape and state metadata exposed to the client.
- `GameRules.gs` - decay, growth, stage, animation, and instrument configuration.
- `Actions.gs` - care action definitions, cooldowns, shortcuts, and stat deltas.
- `Index.html` - web app shell.
- `Styles.html` - responsive pixel-game CSS.
- `Client.html` - thin Apps Script include aggregator for client partials.
- `ClientCore.html` - small browser-global core helpers that are testable from Node.
- `ClientBoot.html`, `ClientDebug.html`, `ClientRuntime.html`, `ClientWeather.html`, `ClientState.html`, `ClientActions.html`, `ClientUi.html`, `ClientAnimation.html`, `ClientScene.html`, and `ClientSprites.html` - client runtime split by responsibility.
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
- `docs/PROJECT_STATE_2026-05-11.md` - current architecture and maintenance checkpoint.
- `docs/PRODUCT_RULES.md` - gameplay and balance rules for future development.
- `scripts/build-imagegen-sprites.py` - builds runtime sheets from imagegen atlases.
- `scripts/generate-pixel-assets.py` - compatibility entrypoint; delegates to the imagegen builder when imagegen sources exist.
- `scripts/validate-assets.mjs` - local PNG dimension, frame, and centering validation.
- `scripts/audit-sprite-consistency.py` - local size/center consistency audit for stage animations.
- `AGENTS.md` - contributor and agent guidance.

The interface is Polish-first. The current build includes manifest-driven growth-stage animations, a short `O_O` wake expression, imagegen-based `spore`, `baby`, `young`, `adult`, and `legendary` silhouettes with a shared grass base, stage-specific activity reactions, need-driven sprite states, attention calls, care mistakes, patch quality, mycelium progress, and spore harvest rewards.

## Development

`appsscript.json` is committed for a Google Apps Script V8 web app. To deploy with `clasp`, bind the repository to an Apps Script project, then push:

```sh
npx @google/clasp push
```

Set the Drive file IDs for runtime assets in `Config.gs`:

- keys matching the animation manifest, for example `spore.idle`, `baby.sleep`, and `baby.activity.hydrate`

If the IDs are blank or unavailable, the local preview loads PNG files from `assets/`. In a deployed Apps Script environment, missing Drive IDs fall back to canvas placeholders instead of showing a blank app. Reference files under `assets/reference/` are not loaded at runtime.

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
node scripts/test-client-core.mjs
node -e "const fs=require('fs'); for (const f of ['Code.gs','Config.gs','AnimationConfig.gs','AssetService.gs','StateModel.gs','GameRules.gs','Actions.gs']) { new Function(fs.readFileSync(f,'utf8')); console.log(f + ' syntax ok'); }"
python3 scripts/build-imagegen-sprites.py
node scripts/validate-assets.mjs
python3 scripts/audit-sprite-consistency.py
```
