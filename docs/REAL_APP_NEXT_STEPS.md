# Pieczargotchi Real App Next Steps

Last researched: 2026-05-09
Last repo checkpoint: 2026-05-16

This plan is for turning the MVP into a real, fun virtual-pet app. It is not a narrow MVP checklist.

## Current Asset Notes

- `assets/sleeping_sheet.png` is now centered frame-by-frame.
- `assets/awake.png` now uses the same cap, grass, body placement, and palette as the sleeping sheet, with only the default awake eyes redrawn.
- The current `O_O` wake face is still a temporary canvas overlay. It works for now, but a polished app should move this into a real runtime sprite sheet.
- Ambient scene life is now renderer-native: butterflies fly on smooth irregular paths, fireflies drift calmly in a bounded range, and ground bugs enter/leave through screen edges or tall grass.
- Detailed next implementation plan for all growth-stage sprites and activity animations: `docs/ASSET_ANIMATION_IMPLEMENTATION_PLAN.md`.

## Research Summary

### Tamagotchi Mechanics Worth Keeping

Classic Tamagotchi works because it is more than stat bars:

- Care actions are concrete: feed, clean, medicine, lights, health check, discipline, and play.
- The pet calls for attention when it needs care, and the player has a response window.
- Neglect is remembered as care mistakes, not only as lower stats.
- Care quality affects evolution, so long-term identity emerges from repeated behavior.
- Play is not just "increase happiness"; it often offsets side effects such as weight gain from food.
- Sleep is a real rhythm with consequences, not just a toggle.

Sources:

- Official Tamagotchi product page: feed, lights, medicine, cleaning, health check, discipline, minigame, and care-dependent adult outcome: https://tamagotchi-official.com/us/series/original/item/01_272/
- Tamagotchi care mistake mechanics and evolution impact: https://tamagotchi.fandom.com/wiki/Care
- Tamagotchi Connection manual reference for hunger, happiness, weight, discipline, cleaning, medicine, and sleep lights: https://www.mimitchi.com/tamaplus/manual.shtml

### Pixel-Art Animation Principles Worth Using

For Pieczargotchi, the best animation direction is sparse, intentional, and stateful:

- Idle loops should be 2-4 frames with tiny 1-2 pixel changes.
- Pixel-art animation usually reads well at low frame rates; smoothness is less important than rhythm.
- Use frame holds and uneven timing instead of uniform mechanical playback.
- Keep volume and placement consistent across frames; unintended size/position drift looks broken.
- Use secondary effects for feel: droplets, dust, flies, thought bubbles, notes, spores, tiny sparkles.
- Finish the base sprite style before expanding animation sets.

Sources:

- Pixel-art frame-rate guidance and idle recommendations: https://pixnote.net/en/learn/animation/
- Pixel-art timing, frame holds, secondary action, and common mistakes: https://www.sprite-ai.art/guides/animation-principles

## Product Design Thesis

Pieczargotchi should feel like a small living thing on the desk, not a dashboard. The panel can show exact numbers, but the mushroom itself should communicate most of the urgency:

- Healthy: calm stare, blink, cap breathing, occasional thought.
- Mild need: visible clue, slow animation, soft message.
- Critical need: stronger animation, attention call, timed care window.
- After care: short satisfying reaction, then return to idle.
- Neglect: logged care mistake, changed mood, possible illness or evolution consequence.

The core loop should be:

```text
Idle life -> need threshold -> attention call -> player response or care mistake -> reaction -> growth/evolution consequence
```

## Current Repo Checkpoint - 2026-05-13

Implemented local v1 systems:

- Polish-first care UI with manifest-driven growth-stage sprites, activity reactions, attention calls, care mistakes, patch quality, mycelium progress, and spore rewards.
- Weather-driven scene with day/night, celestial bodies, wind, precipitation, grass movement, seasonal ambient life, and browser capture tooling.
- Local Legendary Arena with unlock at `legendary`, separate `ClientBattleScene.html`, training, deterministic turns, rewards, mobile layout checks, and `state.battle` persistence.
- Focused QA gates now include core tests in local and UTC timezones, asset audits, local preview bootstrap, arena captures, and `scripts/capture-life-motion.mjs`.

Immediate next product slices should start from `docs/PROJECT_STATE_2026-05-13.md`, not from the older MVP checklist below.

## Current Repo Checkpoint - 2026-05-16

Implemented progression slice:

- Save version `4` with care history, action counts, attention outcomes, minigame records, evolution metadata and decoration ownership.
- Per-need attention thresholds with visible current-need chip and care history updates.
- First minigame: `Łapanie rosy`, including deterministic session data, short canvas playfield, bounded rewards and cooldown.
- Evolution branch selection based on care history, mistakes, patch quality and growth threshold.
- Local JSON export/import for backup without online sync.
- Decoration store and patch decorations rendered under the mushroom.
- Arena 2.0 foundations: weighted opponent choices, status effects and battle log metadata.
- Weather precipitation fix: rain/snow now use a monotonic motion clock and separate background/foreground passes, so visible drops/flakes do not reverse direction.

Immediate next product slices should start from `docs/PROJECT_STATE_2026-05-16.md`.

## Real App Systems Plan

### 1. Sprite And Animation Bible

Create a strict asset contract before adding more sprites.

The detailed implementation slice for this work lives in `docs/ASSET_ANIMATION_IMPLEMENTATION_PLAN.md`.

Deliverables:

- `docs/SPRITE_BIBLE.md`
- Runtime asset manifest with explicit dimensions and animation metadata.
- A source/export workflow for creating sheets from individual frames.
- A validation script that fails if frame content drifts off center.

Rules:

- Every runtime state uses `512x512` frames.
- Sheets use consistent frame size and centered content.
- No renderer offsets for normal animation.
- Main expressions come from PNG sheets. JavaScript draws only temporary overlays/effects.
- Every sprite sheet gets a purpose, frame count, FPS, loop mode, and priority.

Initial sheets:

- `awake_idle_sheet.png`: 4 frames, 4-6 FPS, blink/stare/cap breath.
- `sleeping_sheet.png`: existing 4 frames, 3 FPS.
- `wake_surprise_sheet.png`: 3-4 frames, one-shot, `O_O` transition.
- `happy_react_sheet.png`: 3-4 frames, one-shot after good care.
- `tired_idle_sheet.png`: 4 frames, slow nod/half-lids.
- `dry_need_sheet.png`: 4 frames, droop plus dry moss cue.
- `hungry_need_sheet.png`: 4 frames, looks at substrate/compost cue.
- `dirty_need_sheet.png`: 4 frames, dust/flies/mess cue.
- `sick_critical_sheet.png`: 4 frames, wobble/pale cue.

### 2. State-Driven Animation Engine

Maintain and extend the current state-driven animation selector instead of returning to a simple `mode -> draw sprite` path.

Priority order:

1. One-shot action reaction: wake, hydrate, feed, clean, play, music, spores.
2. Critical need animation: health, hydration, nutrients, cleanliness, energy.
3. Mild need animation.
4. Activity idle: thinking, listening, humming.
5. Normal awake idle.
6. Sleep loop.

Implementation tasks:

- Add `AnimationManifest` in `Config.gs` or a dedicated `AnimationConfig.gs`.
- Load all sheets through the same asset service.
- Add `selectAnimation(state, now)` as a deterministic function.
- Add one-shot animation queues with expiry timestamps.
- Add non-uniform frame durations, not only FPS.
- Keep the existing effects layer for particles and UI feedback.

Acceptance:

- Awake Pieczarka is never static for more than a few seconds.
- Low stats visibly change the mushroom before the user reads the panel.
- Critical status is visually distinct from mild status.
- Sleep, wake, idle, action, and need animations never fight each other.

### 3. Care Mistakes And Attention Calls

Checkpoint: the first version exists. Keep future work focused on the care history UI and better evolution consequences rather than rebuilding the core attention reducer.

Add a real attention system inspired by Tamagotchi care misses.

State additions:

```javascript
attention: {
  activeNeed: null,
  startedAt: null,
  deadlineAt: null,
  severity: "mild"
},
careMistakes: {
  physical: 0,
  mental: 0,
  sleep: 0,
  cleanliness: 0
}
```

Need categories:

- Physical: hydration, nutrients, sickness.
- Mental: happiness, boredom, social/music need.
- Environment: cleanliness, light, airflow, substrate.
- Rest: tiredness, bedtime, interrupted sleep.

Rules:

- A need below a threshold starts an attention call.
- If the user responds before the deadline, reward care quality.
- If ignored, log a care mistake and change future growth/evolution.
- Care mistakes should matter more than raw momentary stats.

### 4. Mushroom-Specific Personality

Do not clone Tamagotchi literally. Make it mushroom-native.

Possible systems:

- Moisture: hydration and misting matter.
- Substrate: compost quality, nutrients, contamination.
- Airflow/light: too much/too little causes stress.
- Mycelium: long-term hidden growth layer.
- Spores: adult-stage reproduction/resource action.
- Scene lighting: background now follows location weather, calculated sunrise/sunset, day phase, golden hour, blue hour, real sun/moon sky positions, moon phase, visible night constellations, and fallback Katowice timing when geolocation is unavailable. Current balance rule: rain actively increases hydration, storm hydrates but costs happiness/cleanliness, wind and heat dry the patch.
- Patch decorations: small cosmetic unlocks that also affect mood.

### 5. Interaction And Minigames

Checkpoint: `Łapanie rosy` exists as the first minigame. New games should reuse the same session/reward contract from `ClientCoreMinigames.html`.

The app needs small moments of play beyond clicking care buttons.

Initial minigames:

- Dew catch: catch falling drops to hydrate.
- Spore pop: click drifting spores in time.
- Compost sort: choose good substrate pieces, avoid contaminants.
- Rhythm hum: simple 3-5 beat music pattern for happiness.

Design rules:

- Games are short: 10-30 seconds.
- Games have tiny rewards and small stat tradeoffs.
- Games should reduce boredom/stress and optionally offset overfeeding.
- Failure should be cute, not punishing.

### 6. Evolution And Long-Term Progression

Checkpoint: the first deterministic branch selector exists. The next step is visual and behavioral identity per variant.

Growth should branch based on care style, not only time.

Track:

- Care mistake counts by category.
- Preferred actions and neglected needs.
- Sleep regularity.
- Music/play frequency.
- Cleanliness history.
- Health recovery history.

Evolution variants:

- Dewcap: consistently hydrated and calm.
- Compostcap: fed well, high substrate quality.
- Songcap: lots of music and happiness.
- Wildcap: irregular but playful care.
- Ghostcap: too many missed sleep/health calls.
- Royalcap: excellent balanced care.

Each evolution should unlock:

- Different idle animation.
- Different favorite action.
- Small UI accent or patch decoration.
- One unique log/message pattern.

### 7. UI Direction

Keep the compact toy layout, but make the mushroom the primary status surface.

Next UI changes:

- Add an attention icon/light near the canvas.
- Add a small "current need" chip, not a wall of text.
- Keep stat bars, but make exact numbers secondary.
- Add a care history panel with care mistakes and milestones.
- Add a sprite-state debug panel only in local dev mode.

### 8. Persistence And Deployment

Keep `localStorage` for fast local play, then add export/sync options.

Path:

1. Keep `localStorage` as default. Done.
2. Add manual backup/export JSON. Done.
3. Add import/restore. Done.
4. Optional Google Drive or Sheet backup only after the local model is stable.

Acceptance:

- A user can recover their mushroom after clearing browser data if they exported a backup.
- State migrations are versioned and tested.
- Apps Script deployment does not require committing private Drive URLs.

### 9. Test And Tooling Plan

Keep tests ahead of new state-machine and rendering complexity.

Test targets:

- `createDefaultState`
- migration
- stat decay
- attention call creation and expiry
- care mistake recording
- animation selection priority
- cooldown behavior
- evolution branch selection
- asset manifest validation
- local arena battle reducer and reward settlement
- ambient life profile and browser capture checks

Suggested scripts:

- `scripts/validate-assets.mjs`
- `scripts/extract-sprite-frame.mjs`
- `scripts/build-sprite-sheet.mjs`
- `scripts/smoke-preview.mjs`
- `scripts/capture-life-motion.mjs`

## Suggested Implementation Order

### Phase A - Asset And Animation Foundation

1. Create `docs/SPRITE_BIBLE.md`.
2. Add `scripts/validate-assets.mjs`.
3. Convert awake idle from a single PNG to `awake_idle_sheet.png`.
4. Convert the current canvas `O_O` overlay into `wake_surprise_sheet.png`.
5. Add animation manifest and `selectAnimation()`.

### Phase B - Maintainable Core And Need Signaling

0. Keep client logic split across Apps Script partials; do not grow a monolithic client file again.
1. Keep expanding `ClientCore.html` and its Node tests when new state, balance, animation, arena, or ambient-life contracts are added.
2. Add mild and critical thresholds per stat.
3. Implement visual clues for dry, hungry, dirty, tired, and sick states.
4. Add attention call state and deadline.
5. Add care mistakes.
6. Update logs/messages around attention calls.


### Phase C - More Fun Interactions

1. Add one minigame: dew catch.
2. Add short post-action reaction sheets.
3. Add music and singing animations.
4. Add unlockable patch decorations.

### Phase D - Long-Term Game

1. Add branchable evolution logic.
2. Add adult-stage spore/reproduction loop.
3. Add care history.
4. Add backup/export/import.
5. Add playtest balancing knobs.

## SigMap Assessment

Question: can SigMap reduce token usage for this project?

Short answer: not worth adding to Pieczargotchi right now, but worth revisiting when the repo becomes larger or moves more logic into standard `.js` modules.

What I verified from public docs/source:

- SigMap extracts function/class signatures and focused file context instead of sending whole repos.
- Its published benchmark claims average token reduction around 96.8% across 18 repos, with 80% hit@5 retrieval.
- It supports assistant adapters including `openai` and `codex`.
- The `codex` adapter writes `AGENTS.md`, which would conflict with this repo's hand-written `AGENTS.md`.
- The public bundled source lists supported code extensions but does not include `.gs`, so Google Apps Script files are likely missed unless SigMap adds Apps Script support or the project is reorganized.
- Running third-party `npx sigmap` unsandboxed was not approved in this environment, so this assessment is source/docs-based, not a local execution result.

Recommended decision:

- Do not add SigMap to this repo today.
- Revisit after either:
  - the codebase is large enough that context discovery is painful, or
  - Apps Script code is mirrored/extracted into standard `.js` modules, or
  - SigMap adds `.gs` support.

If testing later:

1. Run it only in a throwaway worktree first.
2. Do not use `--setup` until generated files are reviewed.
3. Avoid `--adapter codex` unless we intentionally replace `AGENTS.md`.
4. Prefer `--adapter openai` so output goes to `.github/openai-context.md`.
5. Add a config that excludes `assets/`, `assets/reference/`, generated PNGs, and any deployment files.

Sources:

- SigMap GitHub README: https://github.com/manojmallick/sigmap
- SigMap quick start: https://manojmallick.github.io/sigmap/guide/quick-start
- SigMap benchmark overview: https://manojmallick.github.io/sigmap/guide/benchmark
- SigMap/Repomix positioning: https://manojmallick.github.io/sigmap/guide/repomix

## Active Real-App Implementation Slice - 2026-05-09

Status legend: `[ ]` not started, `[~]` in progress, `[x]` complete.

- [x] Polish-first interface pass
  - Scope: convert all visible UI strings, messages, logs, actions, stage names, and reset/tooltip text to Polish.
- [x] Living Pieczarka state engine
  - Scope: add attention calls, care-mistake counters, need severity, and mushroom-specific farming stats.
- [x] Awake and need-driven animation layer
  - Scope: add subtle awake idling plus visual overlays for dryness, hunger, dirt, tiredness, sickness, attention, and excellent care.
- [x] Farming fun loop
  - Scope: add patch quality, harvest/spore rewards, visible clue-driven care, and stronger post-action feedback.
- [x] Validation and local preview check
  - Scope: run syntax checks, asset checks, and local preview response verification.
- [x] Growth-stage asset pack
  - Scope: add manifest-driven sprites for all growth stages, activity reactions, optional effect sheets, Sprite Bible, and asset validation tooling.
- [x] Local Legendary Arena
  - Scope: add legendary-only arena switch, battle renderer, training, deterministic move resolution, rewards, mobile capture checks, and battle persistence.
- [x] Seasonal ambient life motion
  - Scope: move butterflies, small flying insects, crawling bugs, and fireflies with behavior-specific paths instead of static decorative dots.
- [x] Release-readiness checkpoint
  - Scope: refresh README/project state, add focused life-motion capture gate, and document current validation commands.

Implemented in this slice:

- The app interface is now Polish-first for visible controls, messages, logs, action labels, state labels, and local preview text.
- `awake.png` and `sleeping_sheet.png` remain centered and style-matched.
- Pieczarka now breathes, blinks, thinks, and shows visual cues for wilgoć, odżywki, radość, czystość, energia, zdrowie, attention, and excellent care.
- The state model now tracks attention calls, care mistakes, podłoże quality, grzybnia progress, care streak, harvest count, and zarodniki.
- Good care improves podłoże quality and grzybnia. Mature grzybnia produces zarodniki and a visible spore effect.
- The animation manifest now covers 63 runtime animations: 5 growth stages with 11 state sheets each, plus 8 activity sheets.
- The asset folder now also includes 5 optional effect sheets and `scripts/validate-assets.mjs` validates 68 PNG sheets.
- The local Arena now lives outside the care renderer and is testable through deterministic core helpers plus browser captures.
- Scene life now has a dedicated capture gate for warm daylight insects, summer night fireflies, and mobile layout.
