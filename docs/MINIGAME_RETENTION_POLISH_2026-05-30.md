# Minigame Retention Polish - 2026-05-30

App version: `0.1.34`
State version: `15`
Primary preview target: Cloudflare static build

## Research Takeaways

- Self-determination theory is the main design lens for repeat play: minigames
  should support competence, autonomy, and relatedness rather than only pay out
  resources. Source: Przybylski, Rigby, Ryan, "A Motivational Model of Video
  Game Engagement", https://journals.sagepub.com/doi/10.1037/a0019440
- GameFlow frames enjoyable play around concentration, challenge, skills,
  control, clear goals, feedback, immersion, and social connection. For these
  short games, the practical version is: obvious target, visible progress,
  immediate feedback, and no ambiguous controls. Source: Sweetser and Wyeth,
  "GameFlow", https://www.readkong.com/page/gameflow-a-model-for-evaluating-player-enjoyment-in-games-4126799
- Juicy feedback helps only when it clarifies action results. Medium/high
  juiciness improved experience in a large action RPG study, while both none
  and extreme feedback reduced play time, motivation, and performance. Source:
  Kao, "The effects of juiciness in an action RPG",
  https://www.sciencedirect.com/science/article/pii/S1875952118300879
- Daily and repeat rewards can motivate, but can also become FOMO or chores.
  Pieczargotchi should keep minigame returns optional, contextual, and cozy:
  visible records, mastery goals, and mementos without mandatory streak loss.
  Source: Frommel and Mandryk, "Daily Quests or Daily Pests?",
  https://dspace.library.uu.nl/handle/1874/424105
- Game-feel work should tune physicality, amplify meaningful events, and
  streamline intended actions. Source: Pichlmair and Johansen, "Designing Game
  Feel. A Survey", https://arxiv.org/abs/2011.09201

## Implemented Slice

- Minigame cards now show last result, best score, and the next mastery target.
- The active HUD now shows score, remaining time, combo/mistake state, and a
  compact progress strip.
- `masteryTarget` is explicit in `MinigamesConfig.gs`, so perfect/mastery goals
  are not tied to raw object counts when bonus points exist.
- End-of-run results now record target, combo, mistakes, tier, and whether the
  score is a new record; the transient result copy highlights perfect runs,
  records, and near misses.
- Canvas feedback now adds pływające punkty, combo callouts, clearer rare/bad
  silhouettes, stronger Spore Pop halos, a more readable compost basket, and
  larger Rhythm Hum rail/pulse feedback.
- Rhythm Hum now uses four arrow-key lanes with timing windows, falling notes,
  auto-miss feedback, and persisted per-note judgments instead of mouse-click
  pads.
- Browser capture now performs a scripted Rhythm Hum key press and fails if the
  input path does not score.

## Acceptance Criteria

- A player can tell before starting why another run matters: rekord, cel, or
  perfekcyjna pamiątka is visible in each minigame card.
- During play, each successful or failed action produces immediate pixel
  feedback without covering the main target.
- Spore Pop targets are not just beige squares; quick/golden spores have
  distinct silhouettes and halos.
- Compost Sort clearly shows good/bad classification and the destination
  basket.
- Rhythm Hum exposes the current beat and timing line clearly, accepts arrow-key
  input, and never rewards mouse clicks.
- Mobile `390x844` and desktop captures keep the HUD readable with no
  horizontal overflow.

## Follow-Up Candidates

- The next gameplay pass is implemented in
  `docs/MINIGAME_GAMEPLAY_UPGRADE_2026-05-31.md`.
- Post-legendary games now continue this direction in
  `docs/POST_LEGENDARY_GAMES_PLAN_2026-05-31.md`.
- Simulate one pointer hit in browser capture for every minigame and assert
  visible feedback pixels after the hit.
- Add frame-diff checks for minigame animation, not only nonblank canvas checks.
- Add a post-run recap row under the playfield with a one-click "jeszcze raz"
  affordance after cooldown rules are reviewed.
- Later, make Compost Sort a true drag/sort interaction. For this slice it stays
  tap-based to avoid adding a new gesture contract across desktop and mobile.
