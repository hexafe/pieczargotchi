# Repository Guidelines

## Project Structure & Module Organization

Pieczargotchi is a Polish pixel-art mushroom care game with two supported delivery paths: the original Google Apps Script web app and a Cloudflare static preview build for friend testing. The repository now has the full Apps Script/client scaffold, Cloudflare build glue, runtime PNG assets, and local QA tooling.

- `Code.gs` wires `doGet()` and HTML partial inclusion.
- `Config.gs`, `GameRules.gs`, `StateModel.gs`, `Actions.gs`, `AnimationConfig.gs`, `MinigamesConfig.gs`, `DecorationStore.gs`, and service files hold deterministic config, state templates, rules, and server-side helpers.
- `Client.html` is the client aggregator. Core logic is split across `ClientCore*.html`; UI, interaction, animation, scene, battle, minigame, debug, and backup code live in dedicated `Client*.html` partials. `ClientCore.html` is an include shell; keep public core helpers under `window.PieczargotchiCore`.
- `ClientScene*.html` files own canvas rendering. Weather, celestial effects, ambient life, ground/grass, phenomena, palette, and sprite drawing are intentionally separated; do not re-centralize them into one renderer.
- `assets/` stores runtime PNG sheets and generated environment assets; source/reference material stays under `assets/source/` or `assets/reference/`.
- `scripts/` contains Cloudflare build scripts, local validation, render capture, asset audits, and deterministic Node tests.
- `docs/` contains product rules, implementation plans, project-state notes, Cloudflare deployment notes, sprite/weather documentation, and handoff material.
- `wrangler.jsonc` and `scripts/build-cloudflare-static.mjs` define the Cloudflare Workers static deploy path. `dist/` is generated output and must stay out of Git.

## Build, Test, And Development Commands

Run checks from the repository root. Prefer these gates before committing:

- `git status --short --branch`: inspect the worktree before and after edits.
- `npm run build`: build the Cloudflare static bundle into `dist/`.
- `node scripts/check-client-syntax.mjs`: validate included client partial syntax.
- `node scripts/test-client-core.mjs`: run deterministic core rules tests.
- `node scripts/test-celestial-position.mjs`: verify sun/moon position contracts.
- `node scripts/test-scene-palette.mjs`: verify scene palette transitions.
- `node scripts/test-asset-service.mjs`: verify Drive folder asset lookup and manual ID overrides.
- `env TZ=UTC node scripts/test-client-core.mjs`: catch timezone-sensitive care rhythm regressions.
- `node scripts/test-weather-precip-motion.mjs`: verify rain/snow motion and render-pass ordering.
- `node scripts/check-deployment-readiness.mjs`: validate Apps Script packaging assumptions.
- `node scripts/validate-assets.mjs`: audit PNG sheet dimensions and manifest coverage.
- `python3 scripts/audit-sprite-consistency.py` and `python3 scripts/audit-spore-sprites.py`: verify sprite alignment.
- `python3 scripts/audit-activity-sprite-motion.py`: verify activity sheets have visible frame-to-frame motion.
- `python3 scripts/audit-glint-sprites.py`: verify excellent/sun/stargaze glints animate and avoid plus-shaped static sprites.
- `bash scripts/run-local-linux.sh --check-only --validate-assets`: local Linux smoke gate.

For browser smoke, start `node dev-server.mjs <port>` and run `node scripts/capture-app-render.mjs http://127.0.0.1:<port>/`. Local server binding and Chromium DevTools may require sandbox escalation. Use `PIECZARGOTCHI_CAPTURE_LIFE_PROFILE=1` for scene-life/grass diagnostics, and use `scripts/capture-life-motion.mjs` or `scripts/capture-weather-matrix.mjs` for broader visual regressions.

For Cloudflare deployment, use `npm run build` before `npx wrangler deploy`; `npm run deploy` wraps both. See `docs/CLOUDFLARE_DEPLOYMENT.md` for the exact Cloudflare Workers/Pages settings.

## Agent Workflow

Use subagents for broad audits, parallel research, or clearly separable implementation slices. Pick the task-appropriate/optimal model for each subtask: use stronger models for architecture, cross-file reasoning, risky migrations, and visual/debug investigations; use smaller or faster models for narrow searches, inventory work, simple validation, and isolated mechanical edits.

Keep delegated tasks concrete, bounded, and non-overlapping. Prefer read-only explorer subagents for codebase discovery and worker subagents only when the write scope is explicit. The main agent owns sequencing, integration, final review, and validation. Do not spawn subagents for simple single-file edits or for immediate blocking work that is faster and safer to do locally.

Every repository change must include a visible build-number bump. Update `PIECZARGOTCHI_APP_VERSION` in `Config.gs` and `version` in `package.json` together so Apps Script, Cloudflare config, and the in-app build badge show the same new version. Do not rely only on automatic content hashes; after the bump, rebuild or run the Cloudflare static test when the change is intended for deployment.

## Coding Style & Naming Conventions

Use two-space indentation for JavaScript, Apps Script, HTML, and CSS. Prefer small named functions over large inline handlers. Use `camelCase` for functions, variables, state fields, and action IDs; use `UPPER_SNAKE_CASE` for constants.

Keep game rules deterministic and testable. Rule logic belongs in `GameRules.gs`, `StateModel.gs`, or `ClientCore*.html`, not directly in renderers. UI controls and keyboard shortcuts should call the same action path, usually `handleAction(actionId)`.

Visible UI strings, logs, confirmations, and messages are Polish. Function and variable names may stay English. Main mushroom states, activities, and large immersion reactions must come from PNG sheets; JavaScript draws only temporary effects, weather, grass, overlays, pointer ripples, particles, ambient life, and celestial/phenomena visuals.

When adding stage animations, update `AnimationConfig.gs`, generate or add the corresponding `assets/stages/<stage>/<state>_sheet.png` files for every stage, extend focused tests for selection behavior, and refresh `docs/SPRITE_BIBLE.md` plus `docs/IMAGEGEN_ASSET_PIPELINE.md`.

When adding activity animations, update the relevant generated sheets under `assets/activities/`, preserve per-stage body placement and grass occlusion, run `scripts/audit-activity-sprite-motion.py`, and keep `docs/SPRITE_BIBLE.md` in sync.

When changing ambient life, weather, celestial effects, or grass rendering, keep deterministic profile logic in `ClientCoreLife.html`, `ClientCoreSky.html`, or `ClientCoreWeather.html` and drawing logic in the matching `ClientScene*.html` file. Add deterministic tests for new intensity/eligibility rules and use browser capture to verify motion, layering, and visual balance.

## Gameplay Contracts

Care balance targets a normal human day, not overnight babysitting. Quiet hours and morning grace protect attention deadlines and slow decay. Do not add mechanics that require the user to wake up at night.

Health `0` starts moss-bed recovery as the last chance, not immediate death. During recovery the mushroom rests in moss, but the user must still hydrate, feed, and clean it. Play, music, spores, minigames, arena, and sleep/wake are blocked. If recovery is missed too many times, `gameOver.active` becomes terminal and all actions stay blocked until the user starts over.

State migrations must preserve existing saves. When adding state fields, update `PIECZARGOTCHI_STATE_VERSION`, `StateModel.gs`, client normalization/migration, deployment readiness checks, and focused tests.

## Testing Guidelines

Add behavior tests with deterministic dates, seeds, and state fixtures. Useful coverage targets include stat decay, attention deadlines, recovery/game-over transitions, cooldowns, action availability, evolution variants, minigame rewards, battle resolution, weather balance, and animation intent.

Do not add superficial tests that only assert implementation details. Prefer tests that describe user-visible behavior, for example: recovery starts at zero health, neglected recovery reaches game over, and care actions are blocked after game over.

Manual smoke checks should cover: app loads, 512x512 canvas renders crisply, sleep/wake/idle animations select correctly, pointer/tap and weather/celestial immersion reactions do not override care needs, rain/snow fall downward in foreground/background passes, grass covers the mushroom base without growing from the mushroom, mobile layout stays readable, keyboard shortcuts work, and reset starts a fresh save.

For visual polish work, screenshot/capture evidence matters. Check that grass blends into the scene edges, ambient creatures have varied routes and foreground/background layering, fireflies illuminate subtly without plus-shaped sprites, sunbeams align with cloud cover and sun position, and night effects remain discoverable without overwhelming the mushroom.

## Commit & Pull Request Guidelines

Use short imperative commit messages, for example `Add moss-bed recovery state` or `Tune care game over rules`.

Stage intentionally in dirty worktrees. Do not use broad `git add -A` when local-only files or generated artifacts are present. Pull requests should include a concise summary, test/QA notes, screenshots or render captures for visual changes, and any Apps Script deployment notes. Call out state version, localStorage shape, Drive asset IDs, Cloudflare static build changes, and migration changes.

For Cloudflare changes, call out whether `dist/` was rebuilt locally, whether `wrangler.jsonc` changed, and whether public debug/runtime exposure flags were used. Do not commit generated `dist/`.

## Security & Configuration Tips

Do not commit private Drive URLs, secrets, deployment credentials, or local `.clasp.json` files. Prefer `PIECZARGOTCHI_ASSET_DRIVE_FOLDER_ID` for deployment asset loading and store only the folder ID, not a URL. Use `PIECZARGOTCHI_ASSET_FILE_IDS` only for intentional per-asset overrides; manual entries win over folder lookup. Browser persistence stays under `pieczargotchi_state_v2` unless a migration explicitly changes it.
