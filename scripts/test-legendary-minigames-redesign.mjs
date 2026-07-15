import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const tests = [];

test('legendary configs describe the redesigned finite rounds', () => {
  const config = loadLegendaryConfig();
  assert(config.sporeTrail.durationMs === 34000, 'trail should fit the 30-35 second target');
  assert(config.sporeTrail.decisionCount === 8 && config.sporeTrail.targetCount === 8, 'trail needs eight decisions');
  assert(config.sporeTrail.riskyOpenChanceByWeather.clear > config.sporeTrail.riskyOpenChanceByWeather.storm, 'clear weather should open more shortcuts than storms');
  assert(JSON.stringify(config.sporeTrail.scoreLabelForms) === JSON.stringify(['punkt', 'punkty', 'punktów']), 'trail weighted score should use point forms');
  assert(config.myceliumLeague.durationMs === 39500, 'league should fit the 35-40 second target');
  assert(config.myceliumLeague.exchangeCount === 12 && config.myceliumLeague.targetCount === 12, 'league needs twelve exchanges');
  assert(config.myceliumLeague.guidedExchangeCount === 3, 'league should teach only its first three exchanges');
  assert(config.myceliumLeague.counterCycle.strike === 'guard', 'guard must counter strike');
  assert(config.myceliumLeague.counterCycle.guard === 'focus', 'focus must counter guard');
  assert(config.myceliumLeague.counterCycle.focus === 'strike', 'strike must counter focus');
  assert(JSON.stringify(config.memoryGarden.sequenceLengths) === JSON.stringify([3, 4, 5, 6]), 'garden needs 3/4/5/6 sequences');
  assert(JSON.stringify(config.memoryGarden.scoreLabelForms) === JSON.stringify(['punkt', 'punkty', 'punktów']), 'garden weighted score should use point forms');
  const allMinigames = loadAllMinigameConfig();
  ['dewCatch', 'sporePop', 'compostSort', 'rhythmHum'].forEach((id) => {
    assert(JSON.stringify(allMinigames[id].scoreLabelForms) === JSON.stringify(['punkt', 'punkty', 'punktów']), `${id} should label weighted scores as points`);
  });
});

test('trail exposes only active safe/risky windows and completes after eight decisions', () => {
  const harness = createRuntimeHarness();
  harness.prepare('sporeTrail', 'practice');
  const summary = harness.evaluate(`(() => {
    const targets = runtime.minigame.targets;
    const firstAt = targets[0].appearsAt;
    return {
      count: targets.length,
      decisions: new Set(targets.map((target) => target.decisionId)).size,
      choices: Array.from(new Set(targets.map((target) => target.choice))).sort(),
      before: getNextLegendaryTarget(firstAt - 1),
      active: getActiveLegendaryTargets(firstAt).map((target) => target.choice).sort(),
      open: targets.filter((target) => target.choice === 'risky' && target.riskyOpen).length,
      closed: targets.filter((target) => target.choice === 'risky' && !target.riskyOpen).length,
      lastExpiresAt: targets[targets.length - 1].expiresAt,
      until: runtime.minigame.session.until,
      seedCeiling: runtime.minigame.session.seedCeiling,
      calculatedCeiling: getLegendaryTrailSeedCeiling(runtime.minigame.session, rules.minigames.sporeTrail, 8),
      mode: runtime.minigame.session.mode,
      metricsAreScalar: Object.values(runtime.minigame.session.metrics).every((value) => value === null || ['string', 'number', 'boolean'].includes(typeof value))
    };
  })()`);
  assert(summary.count === 16 && summary.decisions === 8, 'trail should build two choices for each of eight decisions');
  assert(JSON.stringify(summary.choices) === JSON.stringify(['risky', 'safe']), 'trail choices should be safe and risky');
  assert(summary.before === null, 'trail keyboard helper must not expose a future target');
  assert(JSON.stringify(summary.active) === JSON.stringify(['risky', 'safe']), 'both branches should share the active window');
  assert(summary.open + summary.closed === 8 && summary.open > 0 && summary.closed > 0, 'the deterministic practice seed should expose open and closed shortcuts');
  assert(summary.seedCeiling === summary.calculatedCeiling && summary.seedCeiling === 16 + summary.open, 'trail ceiling should sum the best valid branch for every decision');
  assert(summary.lastExpiresAt <= summary.until, 'last trail decision must fit inside the session');
  assert(summary.mode === 'practice' && summary.metricsAreScalar, 'practice mode and scalar metrics must survive normalization');

  const completion = harness.evaluate(`(() => {
    for (let index = 0; index < 8; index += 1) {
      const pair = runtime.minigame.targets.filter((item) => item.decisionIndex === index);
      const target = pair.find((item) => item.choice === 'risky' && item.riskyOpen)
        || pair.find((item) => item.choice === 'safe');
      scoreLegendaryGameTarget(target, target.appearsAt);
    }
    return {
      score: runtime.minigame.session.score,
      resolved: runtime.minigame.session.metrics.resolved,
      phase: runtime.minigame.session.legendaryPhase,
      mode: runtime.minigame.session.mode,
      completed: runtime.minigame.session.metrics.completed,
      seedCeiling: runtime.minigame.session.seedCeiling,
      safeChoices: runtime.minigame.session.metrics.safeChoices,
      riskyChoices: runtime.minigame.session.metrics.riskyChoices,
      endReasons: endReasons.slice(),
      session: runtime.minigame.session
    };
  })()`);
  assert(completion.score === completion.seedCeiling && completion.resolved === 8, 'the visible optimal strategy should reach the exact seed ceiling');
  assert(completion.safeChoices > 0 && completion.riskyChoices > 0, 'optimal play should use safe and risky branches when their state changes');
  assert(completion.phase === 'complete' && completion.completed, 'trail should auto-finish after the eighth decision');
  assert(completion.mode === 'practice', 'auto-finish must never promote practice to reward mode');
  assert(completion.endReasons.includes('complete'), 'trail auto-finish should use the complete reason');
  const trailOutcome = getCoreOutcomeMetrics(completion.session, 'sporeTrail');
  assertOutcomeMetrics(trailOutcome, {
    inputCount: 8, resolvedCount: 8, correctCount: 8, expiredCount: 0, decisionCount: 8, seedCeiling: completion.seedCeiling
  }, 'trail');
});

test('trail risk profile is deterministic, weather-shaped, explicit, and hazardous choices resolve once', () => {
  const harness = createRuntimeHarness();
  let clearOpen = 0;
  let stormOpen = 0;
  let openSeen = false;
  let closedSeen = false;
  for (let seed = 730000; seed < 730040; seed += 1) {
    harness.prepare('sporeTrail', 'practice', { seed, weather: 'clear' });
    const clear = harness.evaluate(`runtime.minigame.targets.filter((target) => target.choice === 'risky').map((target) => target.riskyOpen)`);
    harness.prepare('sporeTrail', 'practice', { seed, weather: 'clear' });
    const repeated = harness.evaluate(`runtime.minigame.targets.filter((target) => target.choice === 'risky').map((target) => target.riskyOpen)`);
    assert(JSON.stringify(clear) === JSON.stringify(repeated), `trail profile should repeat for seed ${seed}`);
    clearOpen += clear.filter(Boolean).length;
    openSeen = openSeen || clear.some(Boolean);
    closedSeen = closedSeen || clear.some((value) => !value);

    harness.prepare('sporeTrail', 'practice', { seed, weather: 'storm' });
    const storm = harness.evaluate(`runtime.minigame.targets.filter((target) => target.choice === 'risky').map((target) => target.riskyOpen)`);
    stormOpen += storm.filter(Boolean).length;
    openSeen = openSeen || storm.some(Boolean);
    closedSeen = closedSeen || storm.some((value) => !value);
  }
  assert(clearOpen > stormOpen, `clear weather should open more seeded shortcuts than storms (${clearOpen} vs ${stormOpen})`);
  assert(openSeen && closedSeen, 'seeded profiles should contain both available and hazardous shortcuts');

  let hazardousSeed = 1;
  for (; hazardousSeed < 1000; hazardousSeed += 1) {
    harness.prepare('sporeTrail', 'reward', { seed: hazardousSeed, weather: 'storm' });
    const hasClosed = harness.evaluate(`runtime.minigame.targets.some((target) => target.choice === 'risky' && !target.riskyOpen)`);
    if (hasClosed) break;
  }
  const result = harness.evaluate(`(() => {
    const target = runtime.minigame.targets.find((item) => item.choice === 'risky' && !item.riskyOpen);
    const semantic = (() => {
      const pair = runtime.minigame.targets.filter((item) => item.decisionIndex === target.decisionIndex);
      const risky = pair.find((item) => item.choice === 'risky');
      return getLegendaryTrailSemanticCue(pair) + '|' + getLegendaryTrailChoiceLabel(risky) + '|' + risky.riskLabel + '|' + risky.kind + '|' + risky.penaltyPoints;
    })();
    scoreLegendaryGameTarget(target, target.appearsAt);
    scoreLegendaryGameTarget(target, target.appearsAt + 1);
    return {
      semantic,
      resolved: runtime.minigame.session.metrics.resolved,
      misses: runtime.minigame.session.metrics.misses,
      inputs: runtime.minigame.session.metrics.inputs,
      riskyChoices: runtime.minigame.session.metrics.riskyChoices,
      hazardousChoices: runtime.minigame.session.metrics.hazardousChoices,
      missedIds: runtime.minigame.session.missed.slice(),
      metricsAreScalar: Object.values(runtime.state.minigames.active.metrics).every((value) => value === null || ['string', 'number', 'boolean'].includes(typeof value))
    };
  })()`);
  assert(result.semantic.includes('Skrót jest zamknięty i kosztuje punkt.') && result.semantic.endsWith('|SKRÓT ZAMKNIĘTY -1|skrót zamknięty|hazard|1'), 'closed shortcut should expose an unmistakable semantic and visual hazard label');
  assert(result.resolved === 1 && result.misses === 1 && result.inputs === 1, 'hazardous shortcut should resolve exactly once as one miss');
  assert(result.riskyChoices === 1 && result.hazardousChoices === 1 && result.missedIds.length === 1, 'hazard attempt counters should stay singular');
  assert(result.metricsAreScalar, 'trail persistence must retain scalar-only metrics');
});

test('expired trail windows are persisted once as misses', () => {
  const harness = createRuntimeHarness();
  harness.prepare('sporeTrail', 'reward');
  const result = harness.evaluate(`(() => {
    const first = runtime.minigame.targets[0];
    settleExpiredLegendaryWindows(first.expiresAt + 1);
    settleExpiredLegendaryWindows(first.expiresAt + 2);
    return {
      expired: runtime.minigame.session.metrics.expired,
      misses: runtime.minigame.session.metrics.misses,
      resolved: runtime.minigame.session.metrics.resolved,
      missedIds: runtime.minigame.session.missed.slice(),
      persisted: persistCount,
      directPersisted: directPersistCount,
      session: runtime.minigame.session
    };
  })()`);
  assert(result.expired === 1 && result.misses === 1 && result.resolved === 1, 'one expired decision should count once');
  assert(result.missedIds.length === 1 && result.persisted > 0, 'expired decision should persist its resolution');
  assert(result.directPersisted === 0, 'legendary progress should use the debounced persistence scheduler when available');
  const expiredOutcome = getCoreOutcomeMetrics(result.session, 'sporeTrail');
  assertOutcomeMetrics(expiredOutcome, {
    inputCount: 0, resolvedCount: 1, correctCount: 0, expiredCount: 1, decisionCount: 8, seedCeiling: result.session.seedCeiling
  }, 'expired trail');
});

test('league generates twelve telegraphed counters and tracks wins separately', () => {
  const harness = createRuntimeHarness();
  harness.prepare('myceliumLeague', 'reward');
  const summary = harness.evaluate(`(() => ({
    count: runtime.minigame.targets.length,
    validCounters: runtime.minigame.targets.every((target) => target.lane === getLegendaryCounterLane(target.opponentLane, rules.minigames.myceliumLeague)),
    futureTarget: getNextLegendaryTarget(runtime.minigame.targets[0].appearsAt - 1),
    guidedCanvas: getLegendaryLeagueGuideText(runtime.minigame.targets[2], rules.minigames.myceliumLeague),
    unguidedCanvas: getLegendaryLeagueGuideText(runtime.minigame.targets[3], rules.minigames.myceliumLeague),
    guidedSemantic: getLegendaryLeagueSemanticCue(runtime.minigame.targets[2], rules.minigames.myceliumLeague),
    unguidedSemantic: getLegendaryLeagueSemanticCue(runtime.minigame.targets[3], rules.minigames.myceliumLeague),
    unguidedOpponent: getLegendaryLaneLabel(runtime.minigame.targets[3].opponentLane),
    unguidedAnswer: getLegendaryLaneLabel(runtime.minigame.targets[3].lane),
    aria: getLegendaryGameAriaLabel('myceliumLeague')
  }))()`);
  assert(summary.count === 12 && summary.validCounters, 'league should build twelve correct counter pairs');
  assert(summary.futureTarget === null, 'league must not accept input before the telegraph window');
  assert(summary.guidedCanvas.includes(' > ') && summary.guidedSemantic.includes('Nauka kontry:'), 'first three exchanges should teach opponent to counter');
  assert(summary.unguidedCanvas === 'rywal: ' + summary.unguidedOpponent && !summary.unguidedCanvas.includes(' > '), 'later canvas guidance should expose only the opponent');
  assert(summary.unguidedSemantic.endsWith('Wybierz kontrę.') && !summary.unguidedSemantic.includes(summary.unguidedAnswer), 'later live cues should stop announcing the answer');
  assert(summary.aria.includes('C lub 1') && summary.aria.includes('atak odpowiedz osłoną'), 'league ARIA should retain labeled controls and the full counter mapping');

  const completion = harness.evaluate(`(() => {
    runtime.minigame.targets.forEach((target) => scoreLegendaryGameTarget(target, target.appearsAt));
    return {
      score: runtime.minigame.session.score,
      wins: runtime.minigame.session.metrics.wins,
      winStreak: runtime.minigame.session.metrics.winStreak,
      bestWinStreak: runtime.minigame.session.metrics.bestWinStreak,
      resolved: runtime.minigame.session.metrics.resolved,
      completed: runtime.minigame.session.metrics.completed,
      endReasons: endReasons.slice(),
      session: runtime.minigame.session
    };
  })()`);
  assert(completion.score >= 24 && completion.wins === 12, 'twelve counters should win all exchanges');
  assert(completion.winStreak === 12 && completion.bestWinStreak === 12, 'league should retain a dedicated win streak');
  assert(completion.resolved === 12 && completion.completed && completion.endReasons.includes('complete'), 'league should auto-finish after twelve exchanges');
  const leagueOutcome = getCoreOutcomeMetrics(completion.session, 'myceliumLeague');
  assertOutcomeMetrics(leagueOutcome, {
    inputCount: 12, resolvedCount: 12, correctCount: 12, expiredCount: 0, decisionCount: 12, seedCeiling: 30
  }, 'league');
});

test('garden follows preview-hide-recall and completes deterministic 3/4/5/6 rounds', () => {
  const harness = createRuntimeHarness();
  harness.prepare('memoryGarden', 'reward');
  const phases = harness.evaluate(`(() => {
    initializeLegendaryGardenPhase(runtime.minigame.session, runtime.minigame.session.startedAt);
    const previewInput = getLegendaryGardenInputTarget(0, runtime.minigame.session.startedAt);
    advanceLegendaryGardenPhase(runtime.minigame.session.metrics.phaseUntil);
    const afterPreview = runtime.minigame.session.legendaryPhase;
    advanceLegendaryGardenPhase(runtime.minigame.session.metrics.phaseUntil);
    return {
      previewInput,
      afterPreview,
      afterHide: runtime.minigame.session.legendaryPhase,
      lengths: buildLegendaryGardenRounds(runtime.minigame.session, rules.minigames.memoryGarden).map((sequence) => sequence.length)
    };
  })()`);
  assert(phases.previewInput === null, 'garden input must stay blocked during preview');
  assert(phases.afterPreview === 'hide' && phases.afterHide === 'recall', 'garden should expose the preview-hide-recall phases');
  assert(JSON.stringify(phases.lengths) === JSON.stringify([3, 4, 5, 6]), 'garden rounds should retain their deterministic lengths');

  const completion = harness.evaluate(`(() => {
    while (runtime.minigame.session.metrics.completedRounds < 4) {
      const session = runtime.minigame.session;
      setLegendaryGardenPhase(session, 'recall', session.metrics.phaseStartedAt + 10);
      const sequence = getLegendaryGardenCurrentSequence().slice();
      sequence.forEach((cellIndex) => {
        const target = getLegendaryGardenInputTarget(cellIndex, session.metrics.phaseStartedAt + 20);
        scoreLegendaryGameTarget(target, session.metrics.phaseStartedAt + 20);
      });
    }
    return {
      score: runtime.minigame.session.score,
      correct: runtime.minigame.session.metrics.correct,
      rounds: runtime.minigame.session.metrics.completedRounds,
      phase: runtime.minigame.session.legendaryPhase,
      mode: runtime.minigame.session.mode,
      endReasons: endReasons.slice(),
      session: runtime.minigame.session
    };
  })()`);
  assert(completion.score >= 18 && completion.correct === 18, 'garden should score all eighteen recalled cells');
  assert(completion.rounds === 4 && completion.phase === 'complete', 'garden should auto-finish after four rounds');
  assert(completion.mode === 'reward' && completion.endReasons.includes('complete'), 'garden completion should preserve reward mode');
  const gardenOutcome = getCoreOutcomeMetrics(completion.session, 'memoryGarden');
  assertOutcomeMetrics(gardenOutcome, {
    inputCount: 18, resolvedCount: 18, correctCount: 18, expiredCount: 0, decisionCount: 18, seedCeiling: 22
  }, 'garden');
});

test('garden keyboard navigation clamps at edges and end-time catch-up completes every decision', () => {
  const harness = createRuntimeHarness();
  harness.prepare('memoryGarden', 'reward');
  const navigation = harness.evaluate(`({
    leftTop: moveLegendaryGardenSelection(0, 'arrowleft'),
    upTop: moveLegendaryGardenSelection(1, 'arrowup'),
    rightTop: moveLegendaryGardenSelection(2, 'arrowright'),
    downBottom: moveLegendaryGardenSelection(7, 'arrowdown'),
    rightWithin: moveLegendaryGardenSelection(1, 'arrowright'),
    downWithin: moveLegendaryGardenSelection(2, 'arrowdown'),
    aria: getLegendaryGameAriaLabel('memoryGarden')
  })`);
  assert(navigation.leftTop === 0 && navigation.upTop === 1 && navigation.rightTop === 2 && navigation.downBottom === 7, 'garden arrows should stop at each grid edge without wrapping');
  assert(navigation.rightWithin === 2 && navigation.downWithin === 5, 'garden arrows should move naturally within the 3x3 grid');
  assert(navigation.aria.includes('zatrzymują się na krawędzi') && navigation.aria.includes('od 1 do 9'), 'garden ARIA should explain clamped arrows, confirmation, and direct cell keys');

  const catchUp = harness.evaluate(`(() => {
    const finished = advanceLegendaryGameState(runtime.minigame.session.until);
    return {
      finished,
      phase: runtime.minigame.session.legendaryPhase,
      resolved: runtime.minigame.session.metrics.resolved,
      expired: runtime.minigame.session.metrics.expired,
      completedRounds: runtime.minigame.session.metrics.completedRounds,
      endReasons: endReasons.slice(),
      session: runtime.minigame.session
    };
  })()`);
  assert(catchUp.finished && catchUp.phase === 'complete', 'jumping to session end should complete Garden before timeout handling');
  assert(catchUp.resolved === 18 && catchUp.expired === 18 && catchUp.completedRounds === 4, 'end-time catch-up should resolve all 18 cells across all four rounds');
  assert(catchUp.endReasons.filter((reason) => reason === 'complete').length === 1, 'Garden catch-up should request completion exactly once');
  const outcome = getCoreOutcomeMetrics(catchUp.session, 'memoryGarden');
  assertOutcomeMetrics(outcome, {
    inputCount: 0, resolvedCount: 18, correctCount: 0, expiredCount: 18, decisionCount: 18, seedCeiling: 22
  }, 'garden catch-up');
});

test('core migrates league records, exposes dashboard detail, and gates daily featured reward', () => {
  const { core, rules } = createCoreHarness();
  const now = Date.parse('2026-05-21T14:00:00.000Z');
  const migrated = plain(core.normalizeLegendaryGamesState({
    league: { rank: 4, streak: 2, bestStreak: 17 }
  }, now, rules));
  assert(migrated.league.bestScore === 17, 'legacy bestStreak should remain a best-score fallback');
  assert(migrated.league.winStreak === 2 && migrated.league.bestWinStreak === 17, 'legacy streak fields should remain readable');

  let state = createLegendaryCoreState(now, 'memoryGarden');
  const firstUpdate = core.updateLongLoopProgress(state, {
    type: 'minigame', minigameId: 'memoryGarden', score: 18, mode: 'reward', tier: 'perfect', clear: true,
    metrics: { completedRounds: 4, expired: 0, misses: 0 }
  }, rules, now, {});
  const first = plain(firstUpdate.state);
  assert(first.inventory.substrate === 1 && first.inventory.spores === 3, 'perfect garden clear should grant one substrate and one spore');
  assert(first.legendaryGames.lastResult.bonus.substrate === 1 && first.legendaryGames.lastResult.bonus.spores === 1, 'garden bonus should be explicit in the outcome');
  assert(first.legendaryGames.daily.featuredClears.memoryGarden, 'first featured clear should be retained for the day');
  assert(first.legendaryGames.lastResult.featuredSeasonPoint === 1, 'first featured clear outcome should expose exactly one bonus season point');
  assert(first.longLoop.season.points === 6, `first perfect featured clear should include mastery, base and one featured point, got ${first.longLoop.season.points}`);

  const repeatedUpdate = core.updateLongLoopProgress(first, {
    type: 'minigame', minigameId: 'memoryGarden', score: 18, mode: 'reward', tier: 'perfect', clear: true
  }, rules, now + 1000, {});
  const repeated = plain(repeatedUpdate.state);
  assert(repeated.longLoop.season.points === 11, 'repeat perfect clear should add mastery and base points without a second featured point');

  const inventoryBeforePractice = plain(repeated.inventory);
  const practiceUpdate = core.updateLongLoopProgress(repeated, {
    type: 'minigame', minigameId: 'memoryGarden', score: 18, mode: 'practice', tier: 'perfect', clear: true
  }, rules, now + 2000, {});
  const practiced = plain(practiceUpdate.state);
  assert(practiced.longLoop.season.points === 11, 'practice must not award base or featured season points');
  assert(JSON.stringify(practiced.inventory) === JSON.stringify(inventoryBeforePractice), 'practice must not award garden inventory bonuses');

  practiced.legendaryGames.trail.discoveredNodes['trail-2'] = true;
  practiced.legendaryGames.garden.discoveredSets['set-4'] = true;
  practiced.legendaryGames.league.rank = 5;
  practiced.legendaryGames.league.bestScore = 22;
  practiced.legendaryGames.league.bestWinStreak = 4;
  const dashboard = plain(core.getLegendaryGamesDashboard(practiced, rules, now + 3000, {}));
  assert(dashboard.trailDiscoveries.includes('trail-2'), 'dashboard should expose trail discoveries');
  assert(dashboard.gardenSets.includes('set-4'), 'dashboard should expose garden sets');
  assert(dashboard.league.rank === 5 && dashboard.league.bestScore === 22 && dashboard.league.bestWinStreak === 4, 'dashboard should expose separated league records');
});

function createRuntimeHarness() {
  const config = loadLegendaryConfig();
  const noop = () => {};
  const drawingContext = new Proxy({}, {
    get(target, key) {
      if (!(key in target)) target[key] = noop;
      return target[key];
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    }
  });
  const canvas = {
    width: 300,
    height: 180,
    getContext: () => drawingContext,
    setAttribute: noop,
    focus: noop,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 180 })
  };
  const context = {
    console,
    Date,
    Math,
    JSON,
    Set,
    rules: { minigames: config },
    runtime: { state: { minigames: { active: null } }, minigame: null },
    dom: { legendaryGameCanvas: canvas },
    endReasons: [],
    persistCount: 0,
    directPersistCount: 0,
    weatherCondition: 'rain',
    getRuntimeNow: () => 1_000_000,
    getCurrentWeatherScene: () => ({ condition: context.weatherCondition }),
    stopMinigameRuntime: noop,
    setActiveMinigameCanvas: noop,
    focusMinigameCanvas: noop,
    scheduleMinigameAnimationFrame: () => 0,
    handleMinigameEnd(reason) { context.endReasons.push(reason); },
    scheduleMinigameRuntimePersist() { context.persistCount += 1; },
    persistRuntimeState() { context.directPersistCount += 1; },
    updateMinigameHud: noop,
    pushMinigameFloater: noop,
    drawMinigameFloaters: noop,
    getMinigamePointerForgivenessPx: () => 0,
    isCurrentMinigameInputAllowed: () => true,
    shouldHandleMinigameKeydown: () => true,
    positiveModulo: (value, divisor) => ((value % divisor) + divisor) % divisor,
    window: { addEventListener: noop, PieczargotchiMinigameAudio: null }
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(readFileSync(path.join(rootDir, 'ClientLegendaryGames.html'), 'utf8'), context, { filename: 'ClientLegendaryGames.html' });
  return {
    context,
    evaluate(expression) {
      return plain(vm.runInContext(expression, context));
    },
    prepare(gameId, mode, options) {
      const settings = options || {};
      const duration = Number(config[gameId].durationMs);
      context.gameId = gameId;
      context.sessionMode = mode;
      context.sessionDuration = duration;
      context.sessionSeed = Number(settings.seed) || 737373;
      context.weatherCondition = String(settings.weather || 'rain');
      vm.runInContext(`(() => {
        const raw = {
          id: gameId,
          label: rules.minigames[gameId].label,
          seed: sessionSeed,
          startedAt: 1000000,
          until: 1000000 + sessionDuration,
          score: 0,
          caught: [],
          missed: [],
          mistakes: 0,
          combo: 0,
          bestCombo: 0,
          mode: sessionMode,
          metrics: {}
        };
        const session = normalizeLegendaryRuntimeSession(raw);
        runtime.minigame = {
          session,
          targets: buildLegendaryGameTargets(session),
          pulses: [],
          floaters: [],
          keyboardLaneIndex: 0,
          keyboardGardenCell: 0,
          completionRequested: false
        };
        runtime.state.minigames.active = session;
        initializeLegendaryGardenPhase(session, session.startedAt);
        syncLegendaryGameActiveSession(false);
        endReasons.length = 0;
        persistCount = 0;
        directPersistCount = 0;
      })()`, context);
    }
  };
}

function getCoreOutcomeMetrics(session, gameId) {
  const { core, rules } = createCoreHarness();
  return plain(core.getMinigameOutcomeMetrics(session, rules.minigames[gameId]));
}

function assertOutcomeMetrics(actual, expected, label) {
  Object.entries(expected).forEach(([key, value]) => {
    assert(actual[key] === value, `${label} ${key} should be ${value}, got ${actual[key]}`);
  });
}

function createCoreHarness() {
  const script = renderTemplate('ClientCore.html')
    .replace(/^<script>\s*/, '')
    .replace(/\s*<\/script>\s*$/, '');
  const context = { console, globalThis: null };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(script, context, { filename: 'ClientCore.html' });
  const config = loadLegendaryConfig();
  const rules = {
    minigames: config,
    legendaryGames: {
      unlockStage: 'legendary',
      dailyProjectPointCap: 6,
      games: config
    }
  };
  return { context, core: context.PieczargotchiCore, rules };
}

function createLegendaryCoreState(now, featuredId) {
  const dateKey = new Date(now).toISOString().slice(0, 10);
  return {
    stage: 'legendary',
    minigames: { active: null, lastResult: { id: featuredId, tier: 'perfect', mistakes: 0 } },
    legendaryGames: {
      daily: { dateKey, projectPointsEarned: 0, featuredIds: [featuredId], featuredClears: {} }
    },
    longLoop: {},
    relationship: { entries: [] },
    inventory: { spores: 2, substrate: 0 },
    coins: 2,
    cooldowns: {}
  };
}

function loadLegendaryConfig() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(readFileSync(path.join(rootDir, 'LegendaryGamesConfig.gs'), 'utf8'), context, { filename: 'LegendaryGamesConfig.gs' });
  return plain(vm.runInContext('getLegendaryMinigamesConfig()', context));
}

function loadAllMinigameConfig() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(readFileSync(path.join(rootDir, 'LegendaryGamesConfig.gs'), 'utf8'), context, { filename: 'LegendaryGamesConfig.gs' });
  vm.runInContext(readFileSync(path.join(rootDir, 'MinigamesConfig.gs'), 'utf8'), context, { filename: 'MinigamesConfig.gs' });
  return plain(vm.runInContext('getMinigamesConfig()', context));
}

function renderTemplate(fileName) {
  const content = readFileSync(path.join(rootDir, fileName), 'utf8');
  return content.replace(/<\?!=\s*include\('([^']+)'\);\s*\?>/g, (_match, partialName) => {
    return renderTemplate(partialName + '.html');
  });
}

function plain(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function test(name, fn) {
  tests.push({ name, fn });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

let failed = 0;
for (const entry of tests) {
  try {
    entry.fn();
    console.log(`PASS ${entry.name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${entry.name}`);
    console.error(error && error.stack ? error.stack : error);
  }
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log(`Legendary minigame redesign tests passed (${tests.length})`);
}
