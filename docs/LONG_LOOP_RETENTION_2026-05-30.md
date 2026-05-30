# Long-Loop Retention Slice

Date: 2026-05-30
App version: `0.1.32`
State version: `14`
Primary target: Cloudflare static build

## Research Basis

This slice keeps retention low-pressure. It avoids login streak punishment and
instead adds optional progress, visible mastery, and living-world surprises.

Research anchors:

- Self-determination theory in game contexts supports autonomy, competence, and
  relatedness as useful motivation targets.
- Gamification reviews point to clear goals, immediate feedback, manageable
  tasks, and player-chosen progress paths as healthy engagement supports.
- Daily/engagement rewards can help motivation but can also feel like chores or
  FOMO, so Pieczargotchi rewards natural play without missed-day punishment.

Design translation:

- Autonomy: spore expeditions are optional choices, not mandatory timers.
- Competence: minigame mastery records perfect rounds and practice progress.
- Relatedness: daily finales, visitors, and mementos frame progress as shared
  moments with the mushroom.
- Novelty: rare visitors depend on decoration tags, weather, stage, and day seed.
- Long arc: season points and legendary projects give repeat sessions a visible
  destination without overnight babysitting.

## Implemented Systems

- `state.longLoop` persisted under state version `14`.
- Daily finale creates one daily memento after all active daily-plan goals are
  complete.
- Grzybnia visitors can appear from decoration tags and can be greeted once per
  day for a visitor memento.
- Mementos collect daily finale, visitor, mastery, expedition, and legendary
  keepsakes.
- Minigame mastery tracks plays, best score, perfects, and badges.
- Spore expeditions spend spores, return after a timer, and can be claimed for
  resources plus a memento.
- Season progress gains points from long-loop accomplishments.
- Legendary projects unlock at the legendary stage and complete through normal
  events.
- The side panel includes a compact `Grzybnia` dashboard below minigames.
- The canvas draws the currently available grzybnia visitor as a small animated
  pixel creature in the foreground life layer.

## Acceptance Criteria

- No long-loop action is required during quiet hours or recovery.
- Existing saves migrate safely to version `14` and receive normalized
  `longLoop` defaults.
- Normal care/minigame/decor/battle events update daily finale, mastery,
  season, and legendary progress through the shared event path.
- Mobile first viewport keeps Status, Opieka, and Gry readable; `Grzybnia`
  appears below minigames instead of stealing primary care space.
- No generated `dist/` output is committed.

## Validation

Required gates for this slice:

- `node scripts/check-client-syntax.mjs`
- `node scripts/test-client-core.mjs`
- `env TZ=UTC node scripts/test-client-core.mjs`
- `node scripts/check-deployment-readiness.mjs`
- `npm run audit:polish-copy`
- `npm run build`
- `npm run test:cloudflare-static`
- Browser capture on desktop and mobile Cloudflare preview, including a grzybnia
  setup that shows the long-loop panel and visitor.
