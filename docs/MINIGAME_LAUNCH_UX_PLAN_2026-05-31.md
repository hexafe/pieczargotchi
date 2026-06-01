# Minigame Launch UX Plan - 2026-05-31

Plan checkpoint app version: `0.1.37`
State version: `16`
Primary preview target: Cloudflare static build

## Problem

The current minigame start flow is too abrupt. A player clicks `Start`, the
session begins immediately, and the playfield appears below the minigame menu.
The player must find the canvas while the timer, input windows, and scoring are
already active. This is especially punishing for timed games and for
`Rytmiczne nucenie`, where the first correct input window must be visually
obvious before it matters.

## Research Basis

- Nielsen Norman Group's visibility-of-system-status heuristic says UI should
  keep users informed about what is happening with timely feedback. For this
  flow, the start click needs an immediate, visible state change: launching,
  countdown, then play.
  Source: https://media.nngroup.com/media/articles/attachments/Heuristic_1_compressed.pdf
- MDN documents `Element.scrollIntoView()` as the standard way to bring an
  element into the visible scroll area, with behavior and alignment options.
  Source: https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView
- WCAG focus-order guidance and focus-management practice both point to the
  same interaction rule: after a user-triggered context change, move focus to
  the newly relevant content so keyboard and screen-reader users are not left
  behind.
  Sources:
  https://www.w3.org/TR/UNDERSTANDING-WCAG20/navigation-mechanisms-focus-order.html
  https://dev-design.va.gov/about/accessibility/focus-management
- W3C timing guidance and Xbox Accessibility Guideline 116 emphasize that
  users need enough time to read, understand, and react before time limits
  matter. Core gameplay can stay timed, but the UI should not consume gameplay
  time while the player is still orienting.
  Sources:
  https://www.w3.org/WAI/WCAG20/Understanding/timing-adjustable
  https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/116
- Game Accessibility Guidelines reinforce practical game UI constraints:
  interactive elements should be large and well spaced, controls should be
  simple, important instructions should be available during gameplay, and
  sudden unexpected movement/events should be avoided.
  Source: https://gameaccessibilityguidelines.com/full-list/

## Recommended Solution

Implement a guided launch sequence for all minigames:

1. `Start` validates the minigame and creates the pending active session.
2. The UI reveals the correct playfield immediately.
3. The page scrolls the playfield into a comfortable viewport position.
4. Focus moves to the playfield or game canvas.
5. A pixel overlay shows a short countdown: `3`, `2`, `1`, `Start`.
6. The overlay includes one compact control hint for the selected minigame.
7. Gameplay input, timer loss, and scoring are locked until the countdown ends.
8. The actual gameplay starts only after the countdown, or the session timing is
   shifted so no seconds are lost during orientation.

This should replace the current immediate-start behavior in
`handleMinigameStart()`.

## PiP Decision

Do not make picture-in-picture the primary play surface. A mini canvas would
reduce touch accuracy, shrink timing cues, and create extra responsive-layout
risk. Use PiP only as an emergency affordance: a small sticky "aktywny trening"
return chip if the player scrolls away from an already running game.

The primary solution should stay inline and full-size:

- auto-scroll to the real playfield;
- focus the real playfield;
- countdown on the real canvas area;
- clear active-game state if the user scrolls away later.

## Implementation Plan

### 1. Session Launch State

Add in-memory launch state, without changing persisted save schema:

```js
runtime.minigameLaunch = {
  minigameId,
  session,
  phase: 'countdown',
  countdownUntil: 0,
  startedByButton: null
};
```

No `PIECZARGOTCHI_STATE_VERSION` bump should be needed unless the
implementation stores new save fields.

### 2. Start Flow

In `ClientActions.html`, change `handleMinigameStart(minigameId)` so it no
longer calls `startMinigameRuntime(result.session)` immediately.

Instead:

- create the session;
- shift `session.startedAt` and `session.until` forward by the countdown
  duration before saving, so reloads during the launch do not steal time;
- set `runtime.state.minigames.active = session`;
- save and render;
- call a new `prepareMinigameLaunch(session, triggerButton)` helper;
- only call `startMinigameRuntime(session)` when the countdown reaches `Start`.

For persisted active sessions on reload, `resumeMinigameIfActive()` should:

- if `active.startedAt > now`, restore the launch overlay and countdown;
- otherwise resume gameplay normally.

### 3. Scroll And Focus

Add a shared helper:

```js
function focusMinigamePlayfield(session) {
  const target = getMinigameLaunchTarget(session);
  target.scrollIntoView({
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    block: 'center',
    inline: 'nearest'
  });
  requestAnimationFrame(() => {
    const focusTarget = getMinigameFocusTarget(session);
    focusTarget?.focus?.({ preventScroll: true });
  });
}
```

Targets:

- standard minigames: `dom.minigamePlayfield` and the selected minigame canvas;
- legendary minigames: `dom.legendaryGamePlayfield` and legendary canvas.

### 4. Countdown Overlay

Add launch overlay markup inside each playfield container:

- standard playfield: `data-minigame-launch-overlay`;
- legendary playfield: `data-legendary-game-launch-overlay`;
- content nodes for count, minigame title, and control hint.

The overlay should be absolute over the canvas, high contrast, pixel-styled,
and non-interactive except for optional cancel/close controls if a later pass
needs them.

Control hints should be short Polish strings:

- `Rytmiczne nucenie`: `Strzalki trafiaja w swietlisty pasek.`
- `Lapanie rosy`: `Przesuwaj koszyk pod kropelki.`
- `Pekanie zarodnikow`: `Klikaj zarodniki, omijaj pyl.`
- `Sortowanie kompostu`: `Przeciagnij do kompostu albo odrzutu.`
- legendary games: one short verb phrase per game.

If accented Polish is already used in the touched file, keep the same style as
that file. Otherwise prefer existing project copy conventions.

### 5. Rhythm-Specific Readability

`Rytmiczne nucenie` needs an extra launch preview:

- show the receptor line and the first incoming beat during countdown;
- label the active hit band visually with `TERAZ` only when it is truly
  hittable;
- do not accept early key presses during countdown;
- after `Start`, ensure the first note is not immediately inside the miss
  window.

This prevents the current "when should I press?" ambiguity.

### 6. Sticky Return Chip

After gameplay starts, if the active playfield leaves the viewport, show a
small sticky chip near the minigame section:

- text: `Aktywna minigra`;
- click returns to the playfield with the same scroll/focus helper;
- no shrunken gameplay canvas in the chip.

This gives the useful part of PiP without harming gameplay precision.

## Subagent Split For Next Session

### UX Implementation Agent

Scope:

- `ClientActions.html`
- `ClientBoot.html`
- `ClientUi.html`
- `Index.html`
- `Styles.html`

Tasks:

- add launch state and helpers;
- add scroll/focus behavior;
- add overlay DOM refs;
- add standard and legendary playfield overlay styles;
- keep layout stable across desktop and mobile.

### Minigame Session Agent

Scope:

- `ClientMinigameDewCatch.html`
- `ClientMinigameSporePop.html`
- `ClientMinigameCompostSort.html`
- `ClientMinigameRhythmHum.html`
- `ClientLegendaryGames.html`

Tasks:

- verify no game session accepts input before launch completion;
- ensure timers do not tick down during countdown;
- tune first-spawn/first-beat timing after launch;
- add rhythm receptor preview and first-note grace.

### Capture QA Agent

Scope:

- `scripts/capture-app-render.mjs`
- `scripts/test-cloudflare-static-build.mjs` if needed

Tasks:

- add a minigame launch capture mode;
- click a start button and assert the playfield is visible in viewport;
- assert the countdown overlay is visible;
- assert score/time does not change before countdown completion;
- run mobile and desktop captures.

## Acceptance Criteria

- Clicking `Start` never begins playable time while the playfield is off-screen.
- The selected playfield becomes visible and focused before gameplay starts.
- A player can understand the selected game controls during the countdown
  without reading a long modal.
- Countdown overlay appears for standard and legendary minigames.
- Countdown respects reduced-motion preferences.
- `Rytmiczne nucenie` clearly shows the hit line and first-beat expectation
  before the first scoring input.
- Keyboard and pointer input during countdown cannot score, miss, or consume a
  combo.
- Reload during a countdown does not steal the minigame's timed duration.
- Mobile `390x844` and desktop captures show no overlay clipping, horizontal
  overflow, or hidden HUD.

## Validation

Run at minimum:

```sh
node scripts/check-client-syntax.mjs
node scripts/test-client-core.mjs
env TZ=UTC node scripts/test-client-core.mjs
npm run build
npm run test:cloudflare-static
```

For browser QA:

```sh
node dev-server.mjs 8787
PIECZARGOTCHI_CAPTURE_MINIGAME_LAUNCH=1 node scripts/capture-app-render.mjs http://127.0.0.1:8787/
```

Local server binding and Chromium DevTools can require sandbox escalation.

## Next-Session First Steps

1. Re-check `git status --short --branch` and current version files.
2. Inspect `handleMinigameStart()`, `resumeMinigameIfActive()`, and current
   playfield markup before editing.
3. Implement the standard minigame launch path first.
4. Extend the same path to legendary games.
5. Add capture assertions.
6. Bump app/package version again for the implementation slice.
7. Run the validation gates and record results in the final response.
