# Pieczargotchi Next Steps

Last updated: 2026-05-25
Local app version for this checkpoint: `0.1.23`
State version: `13`
Primary preview target: Cloudflare static build

This is the current start-here document for the next Pieczargotchi work. Older
roadmaps are still useful as history and subsystem notes, but new planning
should start here first.

Current active UI slice: `docs/SHORT_VIEWPORT_UI_POLISH_PLAN.md`.

## 1. Current Baseline

Pieczargotchi is now a Polish pixel-art mushroom care game with a real local
game loop, Cloudflare preview build, Apps Script compatibility path, sprite
asset pipeline, deterministic Node tests, and browser capture tooling.

Current major systems:

- first-run mushroom naming gate and visible build badge;
- care loop with attention calls, quiet hours, morning grace, recovery, game
  over, cooldowns, daily rhythm, daily plan, care history, relationship history,
  spores, decorations, minigames, evolution variants, journal, and calendar;
- Cloudflare static bundle generated from the Apps Script partial app;
- five growth stages: `spore`, `baby`, `young`, `adult`, `legendary`;
- 34 state animation sheets per growth stage, documented in
  `docs/SPRITE_BIBLE.md`;
- eight activity sheets per growth stage, plus top-level compatibility backup
  sheets under `assets/activities/`;
- canvas-rendered scene systems for palette, celestial bodies, phenomena,
  weather, clouds, precipitation, ambient life, grass/ground, sprites, calendar
  accents, minigames, and journal polaroids.

Important product direction:

- Cloudflare remains the practical public preview path for friend testing.
- Apps Script remains supported, but should not block Cloudflare preview polish.
- The game should feel like a small living world, not a stat dashboard.
- Core care balance should fit a normal human day and must not create night
  babysitting pressure.
- Most character expression should come from PNG sprite sheets. Canvas should
  draw weather, temporary effects, grass, ambient life, overlays, particles,
  celestial/phenomena visuals, and journal/minigame scene work.

## 2. Authoritative And Historical Docs

Use these as current subsystem references:

- `docs/SPRITE_BIBLE.md` - current sprite and activity asset contract.
- `docs/WEATHER_SYSTEM.md` - weather, sky, and scene architecture notes.
- `docs/CLOUDFLARE_DEPLOYMENT.md` - Cloudflare build/deploy settings.
- `docs/CALENDAR_EVENTS_POLISH_PLAN.md` - calendar event baseline and source
  anchors.
- `docs/IMAGEGEN_ASSET_PIPELINE.md` - asset generation workflow.
- `AGENTS.md` - repository workflow, build-number rule, and QA gates.

Treat these as historical unless they are explicitly refreshed:

- `docs/PROJECT_STATE_2026-05-11.md`
- `docs/PROJECT_STATE_2026-05-13.md`
- `docs/PROJECT_STATE_2026-05-16.md`
- `docs/PROJECT_STATE_2026-05-17.md`
- older phase sections in `docs/IMPLEMENTATION_PLAN.md`
- older phase sections in `docs/REAL_APP_NEXT_STEPS.md`

Known doc conflicts to resolve later:

- `docs/SPRITE_BIBLE.md` says the current stage contract is 5 stages x 34
  state sheets.
- `docs/STAGE_SPRITE_REQUIREMENTS.md` still describes an older 5 x 11 surface.
- `docs/CALENDAR_EVENTS_POLISH_PLAN.md` still labels the original calendar
  build slice as `0.1.5`; the feature has since moved forward with the app.
- Some `PROJECT_STATE_*` notes reference older state versions, while current
  live state version is `13`.

## 3. Subagent Workstreams For The Next Audit

The next broad audit should be split into bounded workstreams. The main agent
owns sequencing, integration, edits, final review, and validation.

### Docs And Roadmap Agent

Purpose: keep the roadmap coherent and prevent stale instructions from steering
implementation.

Audit:

- compare this file against `REAL_APP_NEXT_STEPS.md`, `IMPLEMENTATION_PLAN.md`,
  `CALENDAR_EVENTS_POLISH_PLAN.md`, `SPRITE_BIBLE.md`, `WEATHER_SYSTEM.md`, and
  `PROJECT_STATE_*`;
- list outdated claims, especially state version, sprite counts, implemented
  minigames, and Cloudflare status;
- recommend which docs should be archived, linked, or refreshed.

Output:

- short markdown report with stale sections and exact replacement guidance;
- no file edits from the subagent unless explicitly assigned in a later slice.

### Architecture And Gameplay Agent

Purpose: protect gameplay contracts while the app gets more life and polish.

Audit:

- `StateModel.gs`, `GameRules.gs`, `Actions.gs`, `MinigamesConfig.gs`,
  `EvolutionRules.gs`, `DecorationStore.gs`;
- `ClientCore*.html`, especially care, gameplay, progression, calendar,
  minigames, weather/life/sky, and exports;
- `ClientActions.html`, `ClientUi.html`, `ClientBoot.html`, and reset/import
  flows.

Focus risks:

- duplicated evolution logic between server/config and client progression;
- animation intent split between care logic and animation selection during play;
- `renderUi()` side effects such as calendar discovery syncing;
- state migration safety for existing saves;
- minigame frequency, reward balance, cooldowns, and status messaging;
- recovery/game-over action blocking and offline return timing.

Output:

- prioritized bug/contract list with suggested tests and files to touch;
- explicit "do not change" contracts for care balance and quiet hours.

### Asset And World QA Agent

Purpose: make all visible surfaces feel coherent and avoid backup-placeholder
flashes.

Audit:

- stage sheets: `assets/stages/<stage>/*_sheet.png`;
- activity sheets: `assets/activities/<stage>/*_sheet.png`;
- top-level activity compatibility sheets;
- effects sheets under `assets/effects/`;
- generated environment assets under `assets/environment/`;
- animation selection/fallback paths in `ClientAnimation.html`,
  `ClientRuntime.html`, and `ClientJournalPopover.html`;
- rendering layers in `ClientScene*.html`.

Focus risks:

- frame drift and body placement, especially legendary glints and activity
  sheets;
- spore sleep split line and body/cap motion;
- backup-placeholder flashes during normal loading;
- journal polaroid pending placeholders and mobile clipping;
- grass edge blending and coverage near the bottom/sides;
- ambient creature scale, route variety, foreground/background layering;
- sunbeams, clouds, stars, fog, aurora, meteors, precipitation, and sky bands.

Output:

- screenshot/capture matrix proposal;
- exact command list for static asset checks and browser captures;
- visual "must fix before release" list.

### Online Research Agent

Purpose: keep events and world-life ideas grounded instead of arbitrary.

Research topics:

- virtual pet care loops and neglected-care patterns;
- cozy daily loops and low-pressure retention;
- collection/attraction loops with rare guests and mementos;
- official nature/environment/space observances;
- informal mushroom/fungus/butterfly days;
- meteor showers, aurora visibility, seasonal ecology, and pollinator behavior.

Output:

- source-backed event catalog with category: official, source-backed,
  seasonal-natural, or informal/game-flavored;
- feature ideas translated into Pieczargotchi mechanics, not copied directly.

## 4. Full Audit Matrix

### Static Asset Audit

Run before browser visual work:

```sh
node scripts/validate-assets.mjs
python3 scripts/audit-spore-sprites.py
python3 scripts/audit-sprite-consistency.py
python3 scripts/audit-activity-sprite-motion.py
python3 scripts/audit-glint-sprites.py
```

Acceptance:

- all manifest assets exist and have valid dimensions;
- activity sheets have visible frame-to-frame motion;
- spore sheets keep body/cap motion natural;
- glints animate without plus-shaped static artifacts;
- top-level `assets/activities/*.png` compatibility files are understood as
  backup-only, not accidentally missing entries loaded during play.

### Animation Selection And Backup Audit

Browser captures should force:

- every stage;
- every activity;
- sleep/wake;
- happy/excellent;
- each need state;
- cursor/immersion reactions;
- easter eggs;
- before-assets state;
- blocked or missing sprite assets;
- normal journal polaroid asset wait.

Acceptance:

- no emergency mushroom during normal loading;
- no one-frame creepy backup-placeholder flash in main scene or polaroids;
- no canvas-drawn face/instrument stacked over sprite-owned feed, instrument,
  or sing animations;
- no adult/legendary backup-placeholder jump when another stage asset is pending;
- grass occlusion remains stable while the mushroom breathes or squirms.

### Weather, Sky, Grass, And World Audit

Run deterministic checks first:

```sh
node scripts/test-weather-precip-motion.mjs
node scripts/test-grass-wind-motion.mjs
node scripts/test-celestial-position.mjs
node scripts/test-scene-palette.mjs
```

Then capture:

```sh
node dev-server.mjs 8092
node scripts/capture-weather-matrix.mjs http://127.0.0.1:8092/ /tmp/pieczargotchi-weather-matrix
node scripts/capture-life-motion.mjs /tmp/pieczargotchi-life-motion
```

Acceptance:

- day phases blend smoothly without hard color jumps;
- sun height respects season/location logic;
- clouds are driven by wind and do not look like static overlays;
- sunbeams align with sun position and cloud cover;
- rain/snow/fog/halo/fogbow/dew/frost/steam/heat haze layer cleanly;
- grass fills bottom and side edges without a visible pasted sprite border;
- sprite grass and rendered grass behave as one system;
- ambient insects are readable at normal canvas scale;
- bees can land on flowers, butterflies vary direction/height and can turn,
  fireflies drift naturally and glow softly, small insects do not become single
  invisible pixels;
- night visitors such as moths/bats stay rare and atmospheric.

### Journal And Polaroid Audit

Capture:

```sh
PIECZARGOTCHI_CAPTURE_JOURNAL=1 node scripts/capture-app-render.mjs http://127.0.0.1:8092/ /tmp/pieczargotchi-journal
PIECZARGOTCHI_CAPTURE_JOURNAL=1 PIECZARGOTCHI_CAPTURE_BLOCK_ASSETS=stages/adult node scripts/capture-app-render.mjs http://127.0.0.1:8092/ /tmp/pieczargotchi-journal-fallback
```

Acceptance:

- hover/click works with mouse, keyboard focus, and touch-friendly layout;
- popover does not clip on mobile;
- polaroid scene is not blank;
- pending mushroom placeholder is neutral, not creepy;
- discovered phenomena have useful Polish descriptions;
- photo caption matches the scene and mushroom emotion.

### Calendar Event Audit

Capture:

```sh
PIECZARGOTCHI_CAPTURE_CALENDAR_MATRIX=1 node scripts/capture-app-render.mjs http://127.0.0.1:8092/ /tmp/pieczargotchi-calendar
PIECZARGOTCHI_CAPTURE_CALENDAR_CHECKLIST=1 node scripts/capture-app-render.mjs http://127.0.0.1:8092/ /tmp/pieczargotchi-calendar-checklist
PIECZARGOTCHI_DEBUG_CALENDAR_EVENT=<eventId> node scripts/capture-app-render.mjs http://127.0.0.1:8092/ /tmp/pieczargotchi-calendar-event
```

Acceptance:

- date matching uses local daily rhythm semantics, not UTC surprises;
- active event discovery logs once per event occurrence;
- checklist stays unlocked after buying `Kalendarz grzybni`;
- mobile checklist does not clip or hide important controls;
- event accents are subtle and do not overwhelm the mushroom;
- event copy distinguishes official/source-backed events from informal game
  flavor.

### Minigame Audit

Capture all minigames:

```sh
PIECZARGOTCHI_CAPTURE_ALL_MINIGAMES=1 node scripts/capture-app-render.mjs http://127.0.0.1:8092/ /tmp/pieczargotchi-minigames
```

Acceptance:

- `Łapanie rosy` reads as bucket-catching falling water drops;
- `Pękanie zarodników`, `Sortowanie kompostu`, and `Rytmiczne nucenie` have
  clear pixel-art goals and feedback;
- opportunities are not spammy;
- rewards are meaningful but bounded;
- minigames are optional charm, not mandatory chores.

## 5. Research-Backed Feature Backlog

### Daily Gentle Loop

Reference ideas:

- Tamagotchi works because care quality affects growth, not because bars exist:
  https://tamagotchi-official.com/manual/toy/connection/connection_web_manual_IS_EN.pdf
- Cozy Grove uses real-world day cadence and new daily content without asking
  for long sessions:
  https://www.nintendo.com/store/products/cozy-grove-switch/
- Finch seasonal events use daily progress and rewards while letting the user
  disable seasonal events:
  https://help.finchcare.com/hc/en-us/articles/37780438941965-Seasonal-Event-Overview

Pieczargotchi implementation direction:

- keep 1-3 gentle reasons to check in;
- no night-time punishment;
- return recap should summarize missed interesting things without guilt;
- daily rhythm should shape goals and event hints;
- care quality should influence evolution, relationship, and discoveries more
  than raw short-term stat math.

### Collection And Discovery Loop

Reference ideas:

- Neko Atsume uses food/toys to attract visitors, records them in a book, and
  keeps photos/mementos:
  https://www.nekoatsume.com/sp/en/about.html
- Usagi Shima uses island decoration, rare visitors, day-time sync, and cozy
  collection:
  https://play.google.com/store/apps/details?id=com.pank0.usagishima&hl=en-US

Pieczargotchi implementation direction:

- decorations should influence rare visitors and event chances;
- journal entries should be short, collectible, and visual;
- polaroids should become the main "I saw something cool" reward;
- rare instruments, rare visitors, rare sky events, and event props should
  share a single discovery language.

### Official Event Families

Good source-backed event families:

- International Day of Forests, 21 March:
  https://forests.desa.un.org/events/international-day-forests-2026
- World Water Day, 22 March:
  https://www.un.org/en/desa/world-water-day-2026
- International Mother Earth Day, 22 April:
  https://www.un.org/en/observances/earth-day/background
- World Bee Day, 20 May:
  https://www.un.org/en/observances/bee-day
- International Tea Day, 21 May:
  https://www.un.org/en/observances/tea-day
- International Day for Biological Diversity, 22 May:
  https://www.un.org/en/observances/international-day-biological-diversity
- World Environment Day, 5 June:
  https://www.un.org/en/climatechange/world-environment-day
- International Day of Clean Air for blue skies, 7 September:
  https://www.un.org/en/observances/clean-air-day
- World Space Week, 4-10 October:
  https://www.un.org/en/node/119970
- World Soil Day, 5 December:
  https://www.fao.org/world-soil-day/about-wsd/en/

Mushroom/fungus handling:

- `Dzień Grzyba` can remain an informal game-flavored event for 15 October.
- If we want a more source-backed fungal event, investigate UK Fungus Day from
  the British Mycological Society ecosystem:
  https://britishlichensociety.org.uk/news/uk-fungus-day-7th-october-2023
- Avoid presenting "World Mushroom Day" as an official global observance unless
  we choose and document a reliable source.

### Natural Phenomena

Meteor and aurora references:

- NASA meteor showers overview:
  https://science.nasa.gov/solar-system/meteors-meteorites/meteor-showers/
- NASA Quadrantids:
  https://science.nasa.gov/solar-system/meteors-meteorites/quadrantids/
- NOAA SWPC aurora products:
  https://www.swpc.noaa.gov/products/auror
- NOAA aurora viewing tips:
  https://www.spaceweather.gov/content/tips-viewing-aurora

Pieczargotchi implementation direction:

- meteor showers should be rare, seasonal, and weather/night gated;
- Perseid/Geminid/Quadrantid style windows can increase meteor frequency
  without constant spam;
- aurora should depend on night, latitude, clear-ish sky, and a modeled or
  optional Kp-like intensity;
- natural phenomena should unlock journal entries and polaroids, not stat power.

## 6. Prioritized Implementation Slices

### Slice 0: Consolidate Roadmap

Goal: make this file the current planning hub.

Tasks:

- keep `docs/NEXT_STEPS.md` current after each meaningful slice;
- add short links from stale docs only when they cause confusion;
- keep build number bumped for every tracked change;
- do not update `dist/` in Git.

Acceptance:

- a new session can start from this file and know what to do next;
- stale docs are clearly marked or linked;
- `git status` stays scoped.

### Slice 1: Release QA Baseline

Goal: know whether the current local build is releasable before adding more.

Tasks:

- run static/core gates;
- run sprite audits;
- run weather/grass/celestial tests;
- run one browser smoke capture;
- record failures and screenshots in a short audit note.

Acceptance:

- failures become actionable tasks;
- no broad feature work starts while release-blocking backup/render bugs are
  unknown.

### Slice 2: Journal, Polaroids, And Calendar Polish

Goal: make discoveries feel like memories.

Tasks:

- audit popover/polaroid mobile behavior;
- improve missing/pending asset states if captures show backup-placeholder issues;
- make event category labels explicit in copy/data;
- plan event-specific polaroid scenes and optional stage reaction sheets;
- tune calendar checklist reward tiers toward cosmetic frames, not stat power.

Acceptance:

- player can discover a phenomenon, inspect it later, and see a charming
  polaroid without UI clipping or creepy backup-placeholder art.

### Slice 3: Mushroom Animation And Activity Polish

Goal: all growth stages feel alive.

Tasks:

- capture every stage idle/sleep/activity;
- fix unnatural drift or too-fast motion;
- keep feed/instrument/sing sprite-owned;
- review rare instrument variants and log copy;
- plan missing event/activity sprite generation.

Acceptance:

- every stage breathes, reacts, and idles naturally;
- no extra canvas mouth, note, or instrument appears over sprite-owned sheets;
- activity motion reads clearly at normal canvas size.

### Slice 4: Minigame Polish

Goal: make minigames charming optional breaks.

Tasks:

- tune opportunity cadence and cooldowns;
- improve pixel-art minigame visuals where captures look flat;
- add per-minigame "rare moment" accents, such as glint dew, compost with
  grzybnia,
  unusual spore, or perfect rhythm shimmer;
- keep rewards bounded and readable.

Acceptance:

- every minigame has a clear fantasy, readable controls, and a reason to replay
  without becoming mandatory.

### Slice 5: World Life And Weather Enrichment

Goal: make the scene feel naturally alive.

Tasks:

- improve cloud wind response and shape variety;
- tune grass response by wind/weather/local movement;
- refine bees, butterflies, fireflies, ground insects, moths, and bats;
- add rare sky/weather phenomena only when gated by believable conditions;
- connect discoveries to journal/polaroids.

Acceptance:

- no creature path feels copy-pasted;
- weather affects the world visibly but subtly;
- rare phenomena feel discovered, not spammed.

### Slice 6: Long-Term Loop

Goal: give players reasons to keep caring without pressure.

Tasks:

- improve care history readability;
- make evolution variant identity more visible after legendary;
- add relationship memories from repeated habits;
- let decorations and calendar discoveries feed back into rare scenes;
- plan optional unlocks that are cosmetic, collectible, or narrative.

Acceptance:

- long-term progress is visible through identity, memories, discoveries, and
  scene details rather than raw stat grind.

## 7. Standard Release Gate

Before pushing a non-trivial app change:

```sh
git status --short --branch
npm run build
npm run test:cloudflare-static
node scripts/check-client-syntax.mjs
node scripts/check-deployment-readiness.mjs
node scripts/test-client-core.mjs
env TZ=UTC node scripts/test-client-core.mjs
node scripts/test-celestial-position.mjs
node scripts/test-scene-palette.mjs
node scripts/test-weather-precip-motion.mjs
node scripts/test-grass-wind-motion.mjs
node scripts/test-asset-service.mjs
node scripts/validate-assets.mjs
python3 scripts/audit-sprite-consistency.py
python3 scripts/audit-spore-sprites.py
python3 scripts/audit-activity-sprite-motion.py
python3 scripts/audit-glint-sprites.py
```

For visual polish work, add browser capture evidence. Do not rely on Node tests
alone for layout, sprite layering, polaroids, weather balance, or minigame feel.
