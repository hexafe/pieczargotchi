# Pieczargotchi Implementation Plan

## Repo Baseline

- GitHub repository: `hexafe/pieczargotchi`
- Default branch: `main`
- Local path: `/home/hexaf/Projects/pieczargotchi`
- Current repo contents: Apps Script source scaffold, modular client czas działania, `LICENSE`, contributor guide, implementation plan, and prepared MVP PNG assets.
- Real-app roadmap: `docs/REAL_APP_NEXT_STEPS.md`
- Target platform: Google Apps Script Web App
- MVP persistence: browser `localStorage`
- Asset policy: mushroom faces and main states come from PNG assets loaded through Apps Script as data URLs; JavaScript only draws temporary effects.
- Client policy: keep the browser czas działania split into Apps Script partials by responsibility. `Client.html` should remain an include aggregator, not a monolithic implementation file.

## Product Direction

Pieczargotchi is a small pixel-art Tamagotchi-style mushroom care game. The first release should feel like a playable toy, not a form demo: a large animated mushroom canvas on the left, a compact care/status panel on the right, keyboard shortcuts, visible cooldowns, event log, and a clear sleep/wake loop.

The MVP should focus on:

- Large 512x512 logical canvas with pixelated rendering.
- Desktop two-column layout and mobile stacked layout.
- Sleeping sprite arkusz animacji animation at 3 FPS.
- Awake sprite rendering.
- Local game state, stat decay, cooldowns, log, and messages.
- Care actions: hydrate, feed, clean, play, sleep/wake, spores.
- Music actions: random instrument and singing.
- Keyboard shortcuts: `N`, `A`, `W`, `P`, `I`, `S`, `U`, `Z`.

## Target File Structure

```text
Code.gs
Config.gs
AssetService.gs
StateModel.gs
GameRules.gs
Actions.gs
Index.html
Styles.html
Client.html
assets/
  awake.png
  sleeping_sheet.png
  reference/
docs/
  IMPLEMENTATION_PLAN.md
```

## Architecture Decisions

1. Google Apps Script serves the page through `doGet()` and HTML partial includes.
2. Apps Script converts Drive-hosted PNG files to base64 data URLs for the client.
3. Client state lives in `localStorage` for MVP under `pieczargotchi_state_v2`.
4. Game rules are deterministic and testable as plain JavaScript functions where possible.
5. The canvas uses `imageSmoothingEnabled = false` and no per-frame sprite offsets.
6. Main mushroom faces are not drawn in JS. JS draws only effects: sleep Zs, bubble, pop, music notes, hearts, drops, spores, and cleaning particles.
7. UI controls and keyboard shortcuts call the same `handleAction(actionId)` path.

## Required MVP Assets

```text
assets/sleeping_sheet.png  2048x512, 4 frames, 512x512 each
assets/awake.png           512x512
```

Later optional mood assets:

```text
happy.png
sad.png
sick.png
dirty.png
dry.png
hungry.png
music.png
singing.png
```

Acceptance rules for assets:

- Every sleeping frame is exactly 512x512.
- arkusz animacji width is exactly 2048 px.
- Frames are centered inside the asset.
- Code must not compensate with per-frame offsets.

## State Model

The MVP state should follow this shape:

```javascript
const defaultState = {
  version: 2,
  playerId: null,
  mushroomName: "Pieczarka",
  createdAt: null,
  lastUpdatedAt: null,
  mode: "sleeping",
  stage: "spore",
  currentActivity: null,
  lastRandomInstrument: null,
  stats: {
    hydration: 70,
    nutrients: 70,
    energy: 80,
    happiness: 60,
    cleanliness: 80,
    health: 100,
    growth: 0
  },
  inventory: {
    water: 3,
    compost: 2,
    toys: 1
  },
  coins: 0,
  cooldowns: {
    hydrate: 0,
    feed: 0,
    clean: 0,
    play: 0,
    instrument: 0,
    sing: 0,
    sleepWake: 0,
    spores: 0
  },
  flags: {
    tutorialDone: false,
    firstWakeDone: false,
    firstFeedDone: false,
    firstInstrumentDone: false,
    firstSingDone: false
  },
  log: []
};
```

## Implementation Phases

## Active MVP Implementation Task Split - 2026-05-09

Status legend: `[ ]` not started, `[~]` in progress, `[x]` complete.

- [x] Task 1 - Plan and asset constraints
  - Scope: confirm repo baseline, asset dimensions, task split, and the transient wake-face requirement.
- [x] Task 2 - Apps Script scaffold and asset service
  - Scope: add `Code.gs`, `Config.gs`, `AssetService.gs`, `appsscript.json`, and server config helpers.
- [x] Task 3 - Responsive shell and visual system
  - Scope: add `Index.html` and `Styles.html` for the two-column desktop layout, stacked mobile layout, canvas frame, status panel, actions, and log.
- [x] Task 4 - Client state, renderer, rules, actions, and shortcuts
  - Scope: add `Client.html`, deterministic state helpers, localStorage persistence, decay/growth, cooldowns, action handling, effects, rendering, and keyboard shortcuts.
- [x] Task 5 - Wake expression transition
  - Scope: when the player wakes Pieczarka, show the reference-style `O_O` face briefly, then return to the default `awake.png` state.
- [x] Task 6 - Documentation and validation pass
  - Scope: update README/setup notes and run static/manual validation checks available without Apps Script deployment.

Wake-face requirement: the post-wake expression is a temporary wake activity. It must trigger only immediately after `sleepWake` changes mode from `sleeping` to `awake`, then expire automatically into the default awake sprite state. Current czas działania routes this through the stage `wake_sheet.png` animation path via `wake_surprise`; do not reintroduce a canvas-drawn face overlay.

## Local Preview Follow-Up - 2026-05-09

- [x] Add local preview server
  - Scope: render `Index.html` locally with the same `Styles.html` and `Client.html` partials, inject a Node-built client config, and serve files from `assets/`.
- [x] Document and validate local preview
  - Scope: update README with the command and verify the local response without requiring Apps Script deployment.

## Sleeping Asset Centering Fix - 2026-05-09

- [x] Verify sleeping frame drift
  - Finding: original frame content bounding boxes drifted horizontally across the four `512x512` frames, from `468x463+0+19` to `471x464+41+29`.
- [x] Normalize `assets/sleeping_sheet.png`
  - Scope: trim each `512x512` frame independently, re-center it on a transparent `512x512` canvas, and append the four frames back into a `2048x512` arkusz animacji.
- [x] Match awake sprite style to sleeping arkusz animacji
  - Finding: the original `awake.png` had a narrower bounding box and a glossier, larger-eyed expression that did not match the sleeping frames.
  - Scope: rebuild `awake.png` from the centered sleeping frame and redraw only the default awake eyes, preserving cap, grass, palette, placement, and overall pixel-art style.

### Phase 0 - Repo Setup

Tasks:

- Add Apps Script file scaffold.
- Add `appsscript.json` if clasp or Apps Script deployment will be used.
- Add a short `README.md` with local/project setup notes.
- Add a placeholder asset manifest in `Config.gs`.

Acceptance criteria:

- Repo has the planned source structure.
- No implementation logic is mixed into docs.
- Next contributor can see how the Apps Script files map to the web app.

### Phase 1 - Apps Script Shell

Tasks:

- Implement `Code.gs` with `doGet()` and `include(filename)`.
- Create `Index.html` with the app shell:
  - header,
  - left stage/canvas section,
  - right side panel.
- Include `Styles.html` and `Client.html`.

Acceptance criteria:

- Web app opens without server-side errors.
- Desktop layout is two-column.
- Mobile layout stacks canvas above the panel.
- Canvas has logical size `512x512`.

### Phase 2 - Visual Layout

Tasks:

- Build the CSS layout and visual system:
  - app shell,
  - stage panel,
  - canvas frame,
  - side panel,
  - stat rows,
  - action buttons,
  - log panel.
- Use simple, minimal pixel-game styling.
- Keep canvas as the primary visual focus.

Acceptance criteria:

- Desktop: large canvas left, compact side panel right.
- Mobile: canvas first, panel second, actions in two columns.
- Text does not overflow buttons or stat rows.
- `image-rendering: pixelated` is applied to the canvas.

### Phase 3 - Asset Loading

Tasks:

- Add Drive file ID constants in `Config.gs`.
- Implement `fileToDataUrl(fileId)` in `AssetService.gs`.
- Expose `getClientConfig()` or equivalent to pass asset data URLs to the page.
- Add graceful tryb zapasowy when asset IDs are missing during early development.

Acceptance criteria:

- `sleeping_sheet.png` and `awake.png` can be loaded as data URLs.
- Missing assets show a clear tryb zapasowy state, not a blank app.
- Client does not hard-code Drive URLs.

### Phase 4 - Canvas Sprite Renderer

Tasks:

- Initialize canvas context with smoothing disabled.
- Load image assets.
- Render sleeping arkusz animacji frames at 3 FPS.
- Render awake sprite when mode is `awake`.
- Draw allowed temporary effects only.

Acceptance criteria:

- Sleeping mushroom animates through 4 frames.
- No per-frame offsets exist in code.
- Awake mode draws `awake.png`.
- Canvas stays crisp at scaled display sizes.

### Phase 5 - State and Persistence

Tasks:

- Implement `createDefaultState()`, `loadState()`, `saveState()`, and `migrateState()`.
- Add `clampAllStats()`.
- Render identity, day/stage metadata, stats, log, and message.
- Persist every state-changing action to `localStorage`.

Acceptance criteria:

- Refresh preserves current state.
- Stats stay in the `0..100` range.
- Bad/corrupt local storage falls back to a valid default state.

### Phase 6 - Time Decay and Growth

Tasks:

- Implement hourly decay for hydration, nutrients, happiness, cleanliness, and energy.
- Implement health update from poor/good conditions.
- Implement growth and stage advancement.
- Apply decay on load and on periodic ticks.

Acceptance criteria:

- Sleeping restores energy.
- Awake mode drains energy.
- Bad conditions reduce health.
- Good conditions allow growth.
- Stage order is `spore`, `baby`, `young`, `adult`, `legendary`.

### Phase 7 - Care Actions

Tasks:

- Define actions:
  - `hydrate`,
  - `feed`,
  - `clean`,
  - `play`,
  - `sleepWake`,
  - `spores`.
- Implement `canRunAction()`, `applyAction()`, `applyEffects()`, and `toggleSleepWake()`.
- Add cooldown rendering.
- Add log messages.

Acceptance criteria:

- Actions mutate stats correctly.
- Cooldowns prevent spam.
- Awake-only actions fail while sleeping.
- Spores require adult stage.
- Log shows recent events.

### Phase 8 - Instrument and Singing

Tasks:

- Add `INSTRUMENTS`.
- Add `instrument` action.
- Add `sing` action.
- Store `lastRandomInstrument` and `currentActivity`.
- Draw temporary music note effects.

Acceptance criteria:

- `I` selects a random instrument.
- `S` starts singing.
- Both require awake mode.
- Both increase happiness, reduce energy, and increase growth slightly.
- Message/log reflect the selected instrument or singing.
- Canvas shows visible notes.

### Phase 9 - Keyboard Shortcuts

Tasks:

- Add `KEYBOARD_SHORTCUTS`.
- Implement `bindKeyboardShortcuts()`.
- Route shortcuts through `handleAction(actionId)`.
- Implement `flashActionButton(actionId)`.
- Render shortcut badges on buttons.

Acceptance criteria:

- `N`, `A`, `W`, `P`, `I`, `S`, `U`, `Z` work.
- Shortcuts do nothing while focus is in `input`, `textarea`, or `select`.
- Disabled/cooldown actions do not execute.
- Shortcut behavior matches button clicks.
- Triggered button visibly flashes.

### Phase 10 - Mood and Messages

Tasks:

- Implement `getMood(state)`.
- Implement `getMushroomMessage(state)`.
- Connect mood to the message panel.
- Optionally map mood to PNG assets when available.

Acceptance criteria:

- Low hydration says it is dry.
- Low nutrients says substrate is depleted.
- Low cleanliness says cleanup is needed.
- Low health says mushroom is sick.
- Instrument and singing override normal mood messages while active.

### Phase 11 - Polish and Reset

Tasks:

- Add pixel-art UI framing and button states.
- Add visual effects:
  - water drops,
  - cleaning particles,
  - hearts,
  - music notes,
  - spores,
  - sleep Zs and bubble.
- Add reset with confirmation.
- Add optional first-run name screen.

Acceptance criteria:

- App feels like a small game, not a form.
- Canvas remains the main focal point.
- Side panel is readable and compact.
- Mobile layout is usable without horizontal scrolling.

## Initial Implementation Slice

The first coding pass should stop after a working localStorage MVP:

1. Create scaffold files.
2. Render the two-column layout.
3. Add placeholder canvas tryb zapasowy so the UI is inspectable before Drive assets are configured.
4. Add state creation/load/save.
5. Render stats/actions/log.
6. Implement `sleepWake`, `hydrate`, `feed`, and `clean`.
7. Add keyboard shortcut binding for those implemented actions.

This gives a playable shell early and avoids blocking all progress on final PNG assets.

## Suggested Codex Work Split

If using subagents later, split work by file ownership to avoid conflicts:

- Agent A, Apps Script scaffold and asset service:
  - `Code.gs`, `Config.gs`, `AssetService.gs`, `Index.html`
- Agent B, client state and game rules:
  - `StateModel.gs`, `GameRules.gs`, state functions inside `Client.html`
- Agent C, actions and keyboard handling:
  - `Actions.gs`, action functions inside `Client.html`
- Agent D, layout and visual polish:
  - `Styles.html`, HTML structure in `Index.html`
- Main agent:
  - integration, final pass, README, deployment notes, and conflict resolution

## Open Decisions Before Implementation

- Confirm whether this repo should use clasp for Apps Script deployment.
- Confirm final Drive file IDs for `sleeping_sheet.png` and `awake.png`.
- Decide whether generated placeholder PNG assets should be committed for local development or only loaded from Drive in deployed Apps Script.
- Decide whether the first release should include only `localStorage` or also a Google arkusz animacji backup/export path.
