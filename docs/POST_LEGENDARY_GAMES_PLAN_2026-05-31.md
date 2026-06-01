# Post-Legendary Games Plan - 2026-05-31

App version: `0.1.34`
State version: `15`
Primary preview target: Cloudflare static build

## Research Basis

- Pokemon-like retention works best here as structure, not imitation:
  collection, research tasks, mastery ladders, optional endgame battles, and
  relationship loops.
- Useful source patterns:
  - `Pokemon Legends: Arceus` uses survey/catch/research loops to make repeated
    actions meaningful beyond one completion check:
    https://legends.arceus.pokemon.com/en-us/
  - `Pokemon Platinum` used Battle Frontier as a postgame skill test with
    variant rules and long-term battle goals:
    https://www.pokemon.com/us/pokemon-video-games/pokemon-platinum-version
  - Pokemon GO Research and Buddy systems show bounded tasks, daily progress,
    and relationship perks:
    https://niantic.helpshift.com/hc/en/6-pokemon-go/faq/45-types-of-research/
    and
    https://niantic.helpshift.com/hc/en/6-pokemon-go/faq/2155-buddy-adventure/
- Design lenses:
  autonomy, competence, and relatedness from self-determination theory; clear
  goals and feedback from GameFlow; medium game-feel amplification without
  hiding the mushroom face.

## Implemented Slice

- Added three legendary-only games after `stage === 'legendary'`:
  `sporeTrail`, `myceliumLeague`, and `memoryGarden`.
- Added `state.legendaryGames` for daily project cap, featured legendary game
  picks, records, league badges, garden layouts, and last result.
- Kept the games on the existing minigame session path, so cooldowns, recovery
  blocking, game-over blocking, history, mastery, and long-loop events stay
  centralized.
- Turned the Arena panel into the `Legendy` hub while preserving internal
  `viewMode: 'arena'` and `data-arena-panel` compatibility.
- Added a canvas play layer for legendary games using pixel symbols, route nodes,
  league runes, memory tiles, pulses, and score floaters.
- Legendary game wins feed season points, mementos, album completion, and
  legendary project progress with a daily project cap of `6`.
- The follow-up minigame gameplay pass gives the legendary games stronger
  identity: ordered spore trails, stance-counter league input, and ordered
  memory garden choices.

## Balance Contracts

- No night babysitting, streak loss, or missed-day penalty.
- Recovery and terminal game-over block all legendary games.
- Care stats are not damaged by Arena or legendary game losses.
- Project progress is capped daily; records and album discovery still save.
- Rewards are bounded to spores/substrate and long-loop progress, not core-stat
  power creep.

## Subagent Workstreams Used

- Core/data: state v15, config, core reducers, dashboard exports, tests.
- UI/runtime: `Legendy` hub, cards, canvas, handlers, HUD.
- Visual/capture: pixel canvas game feel and capture assertions.
- Docs/QA: plan doc, `NEXT_STEPS`, product rules, static build checks.

## Validation Targets

- `node scripts/check-client-syntax.mjs`
- `node scripts/test-client-core.mjs`
- `env TZ=UTC node scripts/test-client-core.mjs`
- `node scripts/check-deployment-readiness.mjs`
- `npm run build`
- `npm run test:cloudflare-static`
- Browser capture with `PIECZARGOTCHI_CAPTURE_LEGENDARY_GAMES=1`
