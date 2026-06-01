# Minigame Gameplay Upgrade - 2026-05-31

App version: `0.1.34`
State version: `15`
Primary preview target: Cloudflare static build

## Research Basis

- GameFlow and accessibility guidance point to the same practical target for
  small minigames: visible goals, immediate feedback, understandable controls,
  and a difficulty curve that teaches before it tests.
- Self-determination theory maps replay value to competence, autonomy, and
  relatedness, so the reward loop should highlight mastery, records, pamiątki,
  and cozy choice rather than mandatory streak pressure.
- Rhythm-game practice uses receptors, timing bands, judgment labels, and input
  offset thinking. `Rytmiczne nucenie` now treats the hit line as a real
  readable timing object, not only a decoration.
- Pokemon-style retention is useful here as structure: contextual daily picks,
  optional mastery, collection records, and postgame variants, not direct
  imitation or grind.

## Implemented Slice

- `Rytmiczne nucenie` now scores keyboard and touch through the same lane path.
  Pads only become urgent inside the actual timing window, with visible
  `perfect/good/ok` timing bands, `TERAZ` cue, and early/late/wrong-lane
  feedback.
- `Łapanie rosy` adds landing previews and a more forgiving bucket feel so the
  catch decision is readable before the drop reaches the grass.
- `Pękanie zarodników` adds spawn telegraphs and quick-spore trails, so targets
  are discovered before they are already disappearing.
- `Sortowanie kompostu` changes from tap-to-score into drag/drop sorting:
  useful pieces go to the green compost zone, contaminants go to the red reject
  zone.
- Legendary games split their identities further: `Szlak Zarodników` and
  `Ogród Pamiątek` require ordered choices, while `Liga Grzybni` asks for a
  stance counter instead of tapping the glowing target itself.
- `scripts/simulate-minigame-balance.mjs` estimates low/median/high score
  ranges from the built static config, so future reward and mastery tuning can
  start from deterministic numbers.

## Balance Contract

- The default profile is `cozy mastery`: casual clears should feel attainable,
  while perfect runs remain a learnable skill target.
- Weak runs do not damage care stats. They can miss records, combos, pamiątki,
  or capped project progress, but they do not punish normal life.
- Rewards stay bounded; replay value comes from mastery labels, records,
  album/pamiątka progress, and contextual daily recommendations.

## Validation Targets

- `node scripts/check-client-syntax.mjs`
- `node scripts/test-client-core.mjs`
- `env TZ=UTC node scripts/test-client-core.mjs`
- `npm run build`
- `npm run test:cloudflare-static`
- `npm run balance:minigames`
- Browser capture with `PIECZARGOTCHI_CAPTURE_ALL_MINIGAMES=1`
