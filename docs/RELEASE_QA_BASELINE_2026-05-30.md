# Release QA Baseline - 2026-05-30

App version: `0.1.24`
State version: `13`
Source checkpoint: `main...origin/main`
Preview target: Cloudflare static build

## Summary

Release QA did not find a blocking issue in the current local baseline. Static
builds, deterministic core checks, asset audits, sprite audits, Polish copy
audit, and one browser smoke capture completed successfully.

The next implementation slice can proceed with Journal, Polaroids, And Calendar
Polish unless a broader manual playtest finds a new visual regression.

## Gates Run

Static and deterministic gates:

- `npm run build` - passed; wrote generated output to ignored `dist/`.
- `npm run test:cloudflare-static` - passed.
- `node scripts/check-client-syntax.mjs` - passed.
- `node scripts/check-deployment-readiness.mjs` - passed with environment
  warnings listed below.
- `node scripts/test-client-core.mjs` - passed.
- `env TZ=UTC node scripts/test-client-core.mjs` - passed.
- `node scripts/test-celestial-position.mjs` - passed.
- `node scripts/test-scene-palette.mjs` - passed.
- `node scripts/test-weather-precip-motion.mjs` - passed.
- `node scripts/test-grass-wind-motion.mjs` - passed.
- `node scripts/test-asset-service.mjs` - passed.
- `npm run audit:polish-copy` - passed.

Asset and sprite gates:

- `node scripts/validate-assets.mjs` - passed with non-blocking warnings listed
  below.
- `python3 scripts/audit-sprite-consistency.py` - passed.
- `python3 scripts/audit-spore-sprites.py` - passed.
- `python3 scripts/audit-activity-sprite-motion.py` - passed.
- `python3 scripts/audit-glint-sprites.py` - passed.

Browser smoke:

- `node dev-server.mjs 8092` - required sandbox escalation for local binding.
- `PIECZARGOTCHI_CAPTURE_VIEWPORT=1 node scripts/capture-app-render.mjs http://127.0.0.1:8092/ /tmp/pieczargotchi-release-smoke`
  required sandbox escalation for Chromium DevTools and passed.

Captured files:

- `/tmp/pieczargotchi-release-smoke-viewport-1194x891.png`
- `/tmp/pieczargotchi-release-smoke-sleeping.png`
- `/tmp/pieczargotchi-release-smoke-wake.png`
- `/tmp/pieczargotchi-release-smoke-awake.png`

Manual smoke inspection:

- desktop viewport render is nonblank;
- the mushroom sprite, grass, status panel, care buttons, minigame list, and
  build badge are visible;
- no obvious desktop layout overlap appeared in the captured viewport.

## Non-Blocking Warnings

`node scripts/check-deployment-readiness.mjs` reported:

- no Drive asset IDs or Drive asset folder are configured, so Apps Script deploy
  smoke should verify replacement rendering;
- `git ls-files` inspection was blocked by the sandbox with `spawnSync git
  EPERM`;
- local `.clasp.json` is present and ignored, so it should still point at a test
  Apps Script project before any Apps Script push.

`node scripts/validate-assets.mjs` reported:

- soft drift warnings in several animated sheets;
- the eight top-level compatibility files under `assets/activities/*.png` are
  validated but not loaded by the czas działania manifest. This matches the current
  backup-only understanding in `docs/NEXT_STEPS.md`.

## Next Slice

Proceed with Slice 2: Journal, Polaroids, And Calendar Polish.

Focus first on:

- journal popover and polaroid mobile behavior;
- pending/missing asset states during journal capture;
- explicit event category labels in copy/data;
- cosmetic calendar checklist rewards rather than stat power.
