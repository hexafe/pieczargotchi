# Short Viewport UI Polish Plan

Last updated: 2026-05-25
Target app version: `0.1.23`

## Summary

This slice fixes the screenshot-driven care UI regression where the scene was
too tall for a short viewport, the canvas visually collided with the lower
left-panel sections, `Gry` was clipped by the right panel, and the sleep state
was hard to read.

The work is intentionally UI-focused. It must not change care balance, state
shape, save migration, minigame rewards, weather rules, or the Apps Script /
Cloudflare delivery split.

## Workstreams

- Layout worker: keep `Status`, `Opieka`, and `Gry` readable in short desktop
  and tablet viewports; compact the scene, action grid, status rows, scrollbars,
  and build badge behavior.
- Interaction worker: keep action IDs stable while making visible controls
  friendlier, especially dynamic `Połóż spać` / `Obudź` copy for `sleepWake`
  and visual icons instead of technical codes.
- Scene worker: reduce foreground grass coverage over the mushroom and make
  sleep `Zzz` larger and closer to the character.
- Main agent: own version bump, docs, capture assertions, final review, and
  validation.

## Acceptance Criteria

- In `641px+` short viewports, the canvas never overlaps the message, rhythm,
  or day-plan strips.
- Short-layout hiding is explicit by breakpoint, not accidental clipping from
  `overflow: hidden`.
- The right panel shows `Status`, compact `Opieka`, and the `Gry` heading in
  the first viewport without sticky overlap.
- Disabled actions are clearly unavailable while labels remain readable.
- `sleepWake` reads as `Obudź` while the mushroom is sleeping.
- The mushroom remains the visual focus; grass still grounds the scene but no
  longer covers too much of the body.
- The build badge is not visually competing with normal preview controls.

## Validation

Run static gates:

```sh
npm run build
npm run test:cloudflare-static
node scripts/check-client-syntax.mjs
node scripts/test-client-core.mjs
env TZ=UTC node scripts/test-client-core.mjs
node scripts/test-grass-wind-motion.mjs
npm run audit:polish-copy
```

Run browser captures sequentially:

```sh
PIECZARGOTCHI_CAPTURE_VIEWPORT=1 PIECZARGOTCHI_VIEWPORT_WIDTH=844 PIECZARGOTCHI_VIEWPORT_HEIGHT=390 node scripts/capture-app-render.mjs http://127.0.0.1:<port>/ /tmp/pieczargotchi-short-844x390
PIECZARGOTCHI_CAPTURE_VIEWPORT=1 PIECZARGOTCHI_VIEWPORT_WIDTH=740 PIECZARGOTCHI_VIEWPORT_HEIGHT=360 node scripts/capture-app-render.mjs http://127.0.0.1:<port>/ /tmp/pieczargotchi-short-740x360
PIECZARGOTCHI_CAPTURE_VIEWPORT=1 PIECZARGOTCHI_VIEWPORT_WIDTH=900 PIECZARGOTCHI_VIEWPORT_HEIGHT=600 node scripts/capture-app-render.mjs http://127.0.0.1:<port>/ /tmp/pieczargotchi-short-900x600
PIECZARGOTCHI_CAPTURE_VIEWPORT=1 PIECZARGOTCHI_VIEWPORT_WIDTH=1024 PIECZARGOTCHI_VIEWPORT_HEIGHT=600 node scripts/capture-app-render.mjs http://127.0.0.1:<port>/ /tmp/pieczargotchi-short-1024x600
PIECZARGOTCHI_CAPTURE_VIEWPORT=1 PIECZARGOTCHI_VIEWPORT_WIDTH=390 PIECZARGOTCHI_VIEWPORT_HEIGHT=844 PIECZARGOTCHI_EMULATE_MOBILE=1 node scripts/capture-app-render.mjs http://127.0.0.1:<port>/ /tmp/pieczargotchi-mobile-390x844
PIECZARGOTCHI_CAPTURE_VIEWPORT=1 PIECZARGOTCHI_VIEWPORT_WIDTH=768 PIECZARGOTCHI_VIEWPORT_HEIGHT=1024 PIECZARGOTCHI_EMULATE_MOBILE=1 node scripts/capture-app-render.mjs http://127.0.0.1:<port>/ /tmp/pieczargotchi-tablet-768x1024
PIECZARGOTCHI_CAPTURE_LIFE_PROFILE=1 node scripts/capture-app-render.mjs http://127.0.0.1:<port>/ /tmp/pieczargotchi-life-profile
```
