# Repository Guidelines

## Project Structure & Module Organization

Pieczargotchi is a Google Apps Script web app for a Polish pixel-art mushroom care game. The repository now has the full Apps Script/client scaffold, not just the initial plan.

- `Code.gs` wires `doGet()` and HTML partial inclusion.
- `Config.gs`, `GameRules.gs`, `StateModel.gs`, `Actions.gs`, `AnimationConfig.gs`, `MinigamesConfig.gs`, `DecorationStore.gs`, and service files hold deterministic config, state templates, rules, and server-side helpers.
- `Client.html` is the client aggregator. Core logic is split across `ClientCore*.html`; UI, interaction, animation, scene, battle, minigame, debug, and backup code live in dedicated `Client*.html` partials.
- `assets/` stores runtime PNG sheets and generated environment assets; source/reference material stays under `assets/source/` or `assets/reference/`.
- `scripts/` contains local validation, render capture, asset audits, and deterministic Node tests.
- `docs/` contains product rules, implementation plans, project-state notes, sprite/weather documentation, and handoff material.

## Build, Test, And Development Commands

Run checks from the repository root. Prefer these gates before committing:

- `git status --short --branch`: inspect the worktree before and after edits.
- `node scripts/check-client-syntax.mjs`: validate included client partial syntax.
- `node scripts/test-client-core.mjs`: run deterministic core rules tests.
- `env TZ=UTC node scripts/test-client-core.mjs`: catch timezone-sensitive care rhythm regressions.
- `node scripts/test-weather-precip-motion.mjs`: verify rain/snow motion and render-pass ordering.
- `node scripts/check-deployment-readiness.mjs`: validate Apps Script packaging assumptions.
- `node scripts/validate-assets.mjs`: audit PNG sheet dimensions and manifest coverage.
- `python3 scripts/audit-sprite-consistency.py` and `python3 scripts/audit-spore-sprites.py`: verify sprite alignment.
- `bash scripts/run-local-linux.sh --check-only --validate-assets`: local Linux smoke gate.

For browser smoke, start `node dev-server.mjs <port>` and run `node scripts/capture-app-render.mjs http://127.0.0.1:<port>/`. Local server binding may require sandbox escalation.

## Coding Style & Naming Conventions

Use two-space indentation for JavaScript, Apps Script, HTML, and CSS. Prefer small named functions over large inline handlers. Use `camelCase` for functions, variables, state fields, and action IDs; use `UPPER_SNAKE_CASE` for constants.

Keep game rules deterministic and testable. Rule logic belongs in `GameRules.gs`, `StateModel.gs`, or `ClientCore*.html`, not directly in renderers. UI controls and keyboard shortcuts should call the same action path, usually `handleAction(actionId)`.

Visible UI strings, logs, confirmations, and messages are Polish. Function and variable names may stay English. Main mushroom states, activities, and large immersion reactions must come from PNG sheets; JavaScript draws only temporary effects, weather, grass, overlays, pointer ripples, and particles.

## Gameplay Contracts

Care balance targets a normal human day, not overnight babysitting. Quiet hours and morning grace protect attention deadlines and slow decay. Do not add mechanics that require the user to wake up at night.

Health `0` starts moss-bed recovery as the last chance, not immediate death. During recovery the mushroom rests in moss, but the user must still hydrate, feed, and clean it. Play, music, spores, minigames, arena, and sleep/wake are blocked. If recovery is missed too many times, `gameOver.active` becomes terminal and all actions stay blocked until the user starts over.

State migrations must preserve existing saves. When adding state fields, update `PIECZARGOTCHI_STATE_VERSION`, `StateModel.gs`, client normalization/migration, deployment readiness checks, and focused tests.

## Testing Guidelines

Add behavior tests with deterministic dates, seeds, and state fixtures. Useful coverage targets include stat decay, attention deadlines, recovery/game-over transitions, cooldowns, action availability, evolution variants, minigame rewards, battle resolution, weather balance, and animation intent.

Do not add superficial tests that only assert implementation details. Prefer tests that describe user-visible behavior, for example: recovery starts at zero health, neglected recovery reaches game over, and care actions are blocked after game over.

Manual smoke checks should cover: app loads, 512x512 canvas renders crisply, sleep/wake/idle animations select correctly, pointer/tap and weather/celestial immersion reactions do not override care needs, rain/snow fall downward in foreground/background passes, grass covers the mushroom base without growing from the mushroom, mobile layout stays readable, keyboard shortcuts work, and reset starts a fresh save.

## Commit & Pull Request Guidelines

Use short imperative commit messages, for example `Add moss-bed recovery state` or `Tune care game over rules`.

Stage intentionally in dirty worktrees. Do not use broad `git add -A` when local-only files or generated artifacts are present. Pull requests should include a concise summary, test/QA notes, screenshots or render captures for visual changes, and any Apps Script deployment notes. Call out state version, localStorage shape, Drive asset IDs, and migration changes.

## Security & Configuration Tips

Do not commit private Drive URLs, secrets, deployment credentials, or local `.clasp.json` files. Store only required Drive file IDs in config. Browser persistence stays under `pieczargotchi_state_v2` unless a migration explicitly changes it.
