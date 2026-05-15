import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const script = renderTemplate('ClientCore.html')
  .replace(/^<script>\s*/, '')
  .replace(/\s*<\/script>\s*$/, '');
const context = { globalThis: {} };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(script, context, { filename: 'ClientCore.html' });

const core = context.PieczargotchiCore;
if (!core || typeof core.calculateWeatherStatDeltas !== 'function') {
  throw new Error('PieczargotchiCore was not exported');
}

function renderTemplate(fileName) {
  const content = readFileSync(path.join(rootDir, fileName), 'utf8');
  return content.replace(/<\?!=\s*include\('([^']+)'\);\s*\?>/g, (_match, partialName) => {
    return renderTemplate(partialName + '.html');
  });
}

test('rain actively increases hydration', () => {
  const deltas = core.calculateWeatherStatDeltas({
    condition: 'rain',
    precipitation: 3,
    rain: 3,
    showers: 0,
    snowfall: 0,
    rainIntensity: 0.6,
    windLevel: 0.1,
    humidity: 90,
    temperature: 15
  }, 1, {});

  assert(deltas.hydration > 0, `expected positive hydration delta, got ${deltas.hydration}`);
});

test('storm hydrates but also stresses the patch', () => {
  const deltas = core.calculateWeatherStatDeltas({
    condition: 'storm',
    precipitation: 6,
    rain: 6,
    showers: 3,
    stormIntensity: 0.8,
    rainIntensity: 0.8,
    windLevel: 0.75,
    humidity: 92,
    temperature: 18
  }, 1, {});

  assert(deltas.hydration > 0, `expected storm hydration, got ${deltas.hydration}`);
  assert(deltas.happiness < 0, `expected storm happiness cost, got ${deltas.happiness}`);
  assert(deltas.cleanliness < 0, `expected storm cleanliness cost, got ${deltas.cleanliness}`);
});

test('dry wind without rain lowers hydration', () => {
  const deltas = core.calculateWeatherStatDeltas({
    condition: 'clear',
    precipitation: 0,
    rain: 0,
    showers: 0,
    snowfall: 0,
    windLevel: 1,
    humidity: 30,
    temperature: 31
  }, 1, {});

  assert(deltas.hydration < 0, `expected drying wind, got ${deltas.hydration}`);
});

test('weather balance caps long offline intervals', () => {
  const oneHour = core.calculateWeatherStatDeltas({
    condition: 'rain',
    rain: 7,
    precipitation: 7,
    rainIntensity: 1,
    windLevel: 0,
    humidity: 90
  }, 1, {});
  const tenHours = core.calculateWeatherStatDeltas({
    condition: 'rain',
    rain: 7,
    precipitation: 7,
    rainIntensity: 1,
    windLevel: 0,
    humidity: 90
  }, 10, {});

  assert(tenHours.hydration <= oneHour.hydration * 2.05, `expected capped weather delta, got ${tenHours.hydration}`);
});

test('snowfall is classified as snow even without a snow weather code', () => {
  const condition = core.classifyWeatherCondition(61, 0.8, 92, 1.1);
  assert(condition === 'snow', `expected snow, got ${condition}`);
});

test('zero precipitation rain scene has no hydration boost', () => {
  const deltas = core.calculateWeatherStatDeltas({
    condition: 'rain',
    precipitation: 0,
    rain: 0,
    showers: 0,
    snowfall: 0,
    rainIntensity: 0,
    windLevel: 0,
    humidity: 60,
    temperature: 18
  }, 1, {});

  assert(!('hydration' in deltas), `expected no hydration delta, got ${deltas.hydration}`);
});

test('weather immersion classifies cloud forms, rain, wind, fog, and wet ground', () => {
  const immersion = core.deriveWeatherImmersionFields({
    condition: 'storm',
    code: 95,
    dayPhase: 'evening',
    cloudCover: 98,
    cloudCoverLow: 94,
    cloudCoverMid: 90,
    cloudCoverHigh: 76,
    precipitation: 8,
    rain: 7.8,
    showers: 3.2,
    snowfall: 0,
    windSpeed: 62,
    windGusts: 96,
    humidity: 94,
    temperature: 18,
    dewPoint: 17,
    visibility: 2400,
    pressure: 1003
  }, [], null, Date.parse('2026-05-14T18:00:00.000Z'));

  assert(immersion.skyCoverClass === 'overcast', `expected overcast sky, got ${immersion.skyCoverClass}`);
  assert(immersion.rainClass === 'heavy', `expected heavy rain, got ${immersion.rainClass}`);
  assert(immersion.precipitationStyle === 'storm', `expected storm precipitation style, got ${immersion.precipitationStyle}`);
  assert(immersion.windBeaufort.force >= 8, `expected gale-class wind, got ${immersion.windBeaufort.force}`);
  assert(immersion.cloudForms.low === 'cumulonimbus', `expected storm low cloud, got ${immersion.cloudForms.low}`);
  assert(immersion.surfaceWetnessTarget > 0.9, `expected saturated surface, got ${immersion.surfaceWetnessTarget}`);
});

test('weather immersion detects likely fog from live humidity, dew point, visibility, and low wind', () => {
  const immersion = core.deriveWeatherImmersionFields({
    condition: 'cloudy',
    dayPhase: 'sunrise',
    cloudCover: 92,
    cloudCoverLow: 94,
    cloudCoverMid: 56,
    cloudCoverHigh: 24,
    precipitation: 0,
    rain: 0,
    snowfall: 0,
    windSpeed: 4,
    windGusts: 6,
    humidity: 97,
    temperature: 7,
    dewPoint: 6.4,
    visibility: 800
  }, [], null, Date.parse('2026-10-08T05:00:00.000Z'));

  assert(immersion.fogPotential > 0.8, `expected strong fog potential, got ${immersion.fogPotential}`);
  assert(immersion.cloudForms.low === 'stratus', `expected stratus low cloud, got ${immersion.cloudForms.low}`);
  assert(immersion.surfaceWetnessTarget > 0.5, `expected damp surface, got ${immersion.surfaceWetnessTarget}`);
});

test('weather immersion pressure trend and forecast hint use nearby hourly data', () => {
  const now = Date.parse('2026-05-14T12:00:00.000Z');
  const immersion = core.deriveWeatherImmersionFields({
    condition: 'cloudy',
    cloudCover: 40,
    cloudCoverLow: 35,
    cloudCoverMid: 42,
    cloudCoverHigh: 38,
    precipitation: 0,
    rain: 0,
    snowfall: 0,
    humidity: 70,
    windSpeed: 9,
    pressure: 1008
  }, [
    { time: '2026-05-14T09:00:00.000Z', pressure: 1012, precipitation: 0, cloudCover: 30 },
    { time: '2026-05-14T12:00:00.000Z', pressure: 1008, precipitation: 0, cloudCover: 40 },
    { time: '2026-05-14T15:00:00.000Z', pressure: 1004, precipitation: 2, cloudCover: 90 }
  ], null, now);

  assert(immersion.pressureTrend.direction === 'falling', `expected falling pressure, got ${immersion.pressureTrend.direction}`);
  assert(immersion.pressureTrend.deltaHpa === -8, `expected -8 hPa trend, got ${immersion.pressureTrend.deltaHpa}`);
  assert(immersion.weatherIncomingHint === 'precipitationApproaching', `expected incoming rain hint, got ${immersion.weatherIncomingHint}`);
});

test('weather immersion snow cover responds to snowfall, depth, wind, and melt', () => {
  const coldSnow = core.deriveWeatherImmersionFields({
    condition: 'snow',
    cloudCover: 80,
    cloudCoverLow: 72,
    precipitation: 2,
    snowfall: 2,
    snowDepth: 0.03,
    temperature: -2,
    windSpeed: 12,
    humidity: 86
  }, [], null, Date.parse('2026-01-14T12:00:00.000Z'));
  const warmOldSnow = core.deriveWeatherImmersionFields({
    condition: 'clear',
    cloudCover: 12,
    precipitation: 0,
    snowfall: 0,
    snowDepth: 0.03,
    temperature: 5,
    windSpeed: 8,
    humidity: 58
  }, [], null, Date.parse('2026-02-14T12:00:00.000Z'));

  assert(coldSnow.snowCoverTarget > 0.75, `expected accumulated snow, got ${coldSnow.snowCoverTarget}`);
  assert(coldSnow.snowStyle === 'powder', `expected powder snow, got ${coldSnow.snowStyle}`);
  assert(warmOldSnow.snowCoverTarget < coldSnow.snowCoverTarget, 'warm old snow should melt compared with active snowfall');
});

test('weather immersion exposes rainbow potential for low-cloud light rain with sun window', () => {
  const immersion = core.deriveWeatherImmersionFields({
    condition: 'rain',
    dayPhase: 'evening',
    isDay: true,
    cloudCover: 46,
    cloudCoverLow: 32,
    cloudCoverMid: 44,
    cloudCoverHigh: 28,
    precipitation: 1.2,
    rain: 0.9,
    showers: 0.7,
    snowfall: 0,
    humidity: 82,
    visibility: 7800,
    windSpeed: 9
  }, [], null, Date.parse('2026-09-12T17:30:00.000Z'));

  assert(immersion.rainbowDropletScore > 0.6, `expected airborne droplets, got ${immersion.rainbowDropletScore}`);
  assert(immersion.rainbowSunWindowScore > 0.5, `expected sun window, got ${immersion.rainbowSunWindowScore}`);
  assert(immersion.rainbowPotential > 0.35, `expected visible rainbow potential, got ${immersion.rainbowPotential}`);
  assert(immersion.rainbowVariant === 'primary' || immersion.rainbowVariant === 'double', `expected rainbow variant, got ${immersion.rainbowVariant}`);
});

test('weather immersion carries weak rainbow potential after recent rain and clearing', () => {
  const now = Date.parse('2026-09-12T18:10:00.000Z');
  const immersion = core.deriveWeatherImmersionFields({
    condition: 'clear',
    dayPhase: 'evening',
    isDay: true,
    cloudCover: 34,
    cloudCoverLow: 20,
    cloudCoverMid: 30,
    cloudCoverHigh: 24,
    precipitation: 0,
    rain: 0,
    showers: 0,
    snowfall: 0,
    humidity: 86,
    visibility: 9000,
    windSpeed: 7
  }, [
    { time: '2026-09-12T16:20:00.000Z', precipitation: 1.1, rain: 0.8, showers: 0.4, snowfall: 0 },
    { time: '2026-09-12T18:10:00.000Z', precipitation: 0, rain: 0, showers: 0, snowfall: 0 }
  ], null, now);

  assert(immersion.rainbowDropletScore === 0, `expected no current droplets, got ${immersion.rainbowDropletScore}`);
  assert(immersion.rainbowRecentRainScore > 0.15, `expected recent rain memory, got ${immersion.rainbowRecentRainScore}`);
  assert(immersion.rainbowPotential > 0.05, `expected weak post-rain rainbow potential, got ${immersion.rainbowPotential}`);
});

test('weather immersion suppresses rainbow for dry clear, snow, and night scenes', () => {
  const dry = core.deriveWeatherImmersionFields({
    condition: 'clear',
    dayPhase: 'afternoon',
    isDay: true,
    cloudCover: 8,
    precipitation: 0,
    rain: 0,
    showers: 0,
    snowfall: 0,
    humidity: 45,
    windSpeed: 4
  }, [], null, Date.now());
  const snow = core.deriveWeatherImmersionFields({
    condition: 'snow',
    dayPhase: 'afternoon',
    isDay: true,
    cloudCover: 70,
    precipitation: 1,
    snowfall: 1,
    humidity: 90,
    windSpeed: 8
  }, [], null, Date.now());
  const nightRain = core.deriveWeatherImmersionFields({
    condition: 'rain',
    dayPhase: 'night',
    isDay: false,
    cloudCover: 38,
    cloudCoverLow: 24,
    precipitation: 1.4,
    rain: 1,
    showers: 0.7,
    snowfall: 0,
    humidity: 86,
    windSpeed: 7
  }, [], null, Date.now());

  assert(dry.rainbowPotential === 0, `expected dry rainbow suppression, got ${dry.rainbowPotential}`);
  assert(snow.rainbowPotential === 0, `expected snow rainbow suppression, got ${snow.rainbowPotential}`);
  assert(nightRain.rainbowPotential === 0, `expected night rainbow suppression, got ${nightRain.rainbowPotential}`);
});

test('weather immersion fields do not change care weather balance', () => {
  const scene = {
    condition: 'rain',
    precipitation: 3,
    rain: 3,
    showers: 0.6,
    snowfall: 0,
    rainIntensity: 0.6,
    windLevel: 0.1,
    humidity: 90,
    temperature: 15,
    cloudCover: 90,
    cloudCoverLow: 82,
    cloudCoverMid: 74,
    cloudCoverHigh: 60,
    windSpeed: 18
  };
  const baseline = core.calculateWeatherStatDeltas(scene, 1, {});
  const enhanced = Object.assign({}, scene, core.deriveWeatherImmersionFields(scene, [], null, Date.now()));
  const afterImmersion = core.calculateWeatherStatDeltas(enhanced, 1, {});

  assert(JSON.stringify(afterImmersion) === JSON.stringify(baseline), 'visual immersion fields should not alter care deltas');
});

test('v2 saves migrate to v3 battle subtree', () => {
  const migrated = core.migrateStateVersion({
    version: 2,
    stage: 'adult',
    stats: { growth: 70 }
  }, 3);

  assert(migrated.version === 3, `expected version 3, got ${migrated.version}`);
  assert(migrated.battle && migrated.battle.mode === 'idle', 'expected default battle state');
  assert(migrated.battle.training.strength === 0, 'expected default battle training');
});

test('corrupted save shape falls back to a normal migration target', () => {
  const migrated = core.migrateStateVersion(null, 3);

  assert(migrated.version === 3, `expected version 3, got ${migrated.version}`);
  assert(migrated.battle && migrated.battle.rewards.wins === 0, 'expected normalized battle rewards');
});

test('arena unlocks only at legendary stage', () => {
  const rules = {
    battle: { unlockStage: 'legendary' },
    stageThresholds: [
      { id: 'spore' },
      { id: 'adult' },
      { id: 'legendary' }
    ]
  };

  assert(!core.isArenaUnlocked({ stage: 'adult' }, rules), 'adult stage should not unlock arena');
  assert(core.isArenaUnlocked({ stage: 'legendary' }, rules), 'legendary stage should unlock arena');
});

test('care actions respect cooldown, awake, stage, and energy blocks', () => {
  const now = 1_000_000;
  const rules = {
    stageThresholds: [
      { id: 'spore' },
      { id: 'adult' },
      { id: 'legendary' }
    ]
  };
  const baseState = {
    mode: 'awake',
    stage: 'adult',
    stats: { energy: 12 },
    cooldowns: {}
  };

  assert(!core.getActionAvailability(
    { ...baseState, cooldowns: { hydrate: now + 1500 } },
    { id: 'hydrate', awakeOnly: true },
    now,
    rules
  ).ok, 'cooldown should block the action');
  assert(!core.getActionAvailability(
    { ...baseState, mode: 'sleeping' },
    { id: 'hydrate', awakeOnly: true },
    now,
    rules
  ).ok, 'sleeping should block awake-only actions');
  assert(!core.getActionAvailability(
    { ...baseState, stage: 'spore' },
    { id: 'spores', requiresStage: 'adult' },
    now,
    rules
  ).ok, 'stage requirement should block early actions');
  assert(!core.getActionAvailability(
    { ...baseState, stats: { energy: 0 } },
    { id: 'play', awakeOnly: true },
    now,
    rules
  ).ok, 'empty energy should block care actions');
  assert(core.getActionAvailability(
    { ...baseState, stats: { energy: 0 } },
    { id: 'sleepWake' },
    now,
    rules
  ).ok, 'sleep/wake should remain available at zero energy');
});

test('attention call starts, records missed deadline, and clears after the right care action', () => {
  const now = Date.parse('2026-05-13T12:00:00.000Z');
  const rules = {
    attention: {
      mildThreshold: 45,
      criticalThreshold: 25,
      deadlineMs: 1000,
      criticalDeadlineMs: 500,
      repeatedMistakeCooldownMs: 10_000
    },
    needDefinitions: {
      hydration: {
        category: 'physical',
        actionId: 'hydrate',
        title: 'Chce wilgoci',
        mildMessage: 'Sucho.',
        criticalMessage: 'Bardzo sucho.'
      }
    }
  };
  const state = {
    mode: 'awake',
    stats: { hydration: 40, health: 100, happiness: 80 },
    attention: {},
    careMistakes: {},
    patch: { quality: 72, mycelium: 0, harvests: 0, careStreak: 0 }
  };
  const started = core.evaluateAttentionState(state, rules, now);
  assert(started.state.attention.activeNeed === 'hydration', 'expected hydration attention');
  assert(started.events[0].type === 'start', 'expected attention start event');
  assert(Date.parse(started.state.attention.deadlineAt) === now + 1000, 'expected mild deadline');

  const missed = core.evaluateAttentionState(started.state, rules, now + 1001);
  assert(missed.state.careMistakes.physical === 1, 'expected one physical care mistake');
  assert(missed.state.stats.health === 96, `expected health penalty, got ${missed.state.stats.health}`);
  assert(missed.events[0].type === 'mistake', 'expected missed-deadline event');

  const handled = core.resolveAttentionAction(started.state, 'hydrate', rules, now + 400);
  assert(handled.handled, 'expected hydrate to handle hydration attention');
  assert(handled.state.attention.activeNeed === null, 'expected attention to clear');
  assert(handled.state.patch.careStreak === 1, 'expected care streak reward');
});

test('animation intent keeps activity and wake above sleep, need above happy, then idle', () => {
  const now = 1_000_000;
  const rules = {
    attention: { mildThreshold: 45, criticalThreshold: 25 },
    needDefinitions: {
      hydration: { category: 'physical', actionId: 'hydrate' }
    }
  };
  const excellentState = {
    mode: 'awake',
    stats: { hydration: 80, happiness: 90, health: 90 },
    patch: { quality: 90 }
  };

  assert(core.getAnimationIntent({
    ...excellentState,
    mode: 'sleeping',
    currentActivity: { type: 'play', until: now + 1000 }
  }, rules, now).state === 'play', 'activity should outrank sleep');
  assert(core.getAnimationIntent({
    ...excellentState,
    currentActivity: { type: 'wake', until: now + 1000 }
  }, rules, now).state === 'wake', 'wake should be explicit');
  assert(core.getAnimationIntent({
    ...excellentState,
    mode: 'sleeping',
    currentActivity: null
  }, rules, now).state === 'sleep', 'sleep should outrank needs while asleep');
  assert(core.getAnimationIntent({
    ...excellentState,
    stats: { hydration: 20, happiness: 90, health: 90 }
  }, rules, now).state === 'critical', 'critical need should outrank excellent mood');
  assert(core.getAnimationIntent(excellentState, rules, now).state === 'excellent', 'excellent mood should be selected before idle');
  assert(core.getAnimationIntent({
    mode: 'awake',
    stats: { hydration: 80, happiness: 50, health: 90 },
    patch: { quality: 70 }
  }, rules, now).state === 'idle', 'neutral care state should idle');
});

test('battle training spends one spore and respects the configured cap', () => {
  const rules = getBattleTestRules();
  const state = getLegendaryBattleState({
    inventory: { spores: 2 },
    coins: 2,
    battle: { training: { strength: 19, defense: 0, speed: 0, focus: 0 } }
  });
  const trained = core.trainBattleStat(state, 'strength', rules, Date.now());

  assert(trained.ok, `expected training success: ${trained.reason}`);
  assert(trained.state.battle.training.strength === 20, 'expected strength to reach cap');
  assert(trained.state.inventory.spores === 1, 'expected one spore spent');
  assert(trained.state.coins === 1, 'expected spore label balance to match');
  assert(!core.trainBattleStat(trained.state, 'strength', rules, Date.now()).ok, 'cap should block further training');
});

test('battle start stores seed and care snapshot without mutating care stats', () => {
  const rules = getBattleTestRules();
  const state = getLegendaryBattleState();
  const beforeStats = JSON.stringify(state.stats);
  const started = core.startBattle(state, rules, Date.parse('2026-05-13T12:00:00.000Z'), 777);

  assert(started.ok, `expected battle start: ${started.reason}`);
  assert(JSON.stringify(state.stats) === beforeStats, 'input care stats should not mutate');
  assert(started.state.battle.activeBattle.seed === 777, 'expected stored seed');
  started.state.stats.hydration = 1;
  assert(started.state.battle.activeBattle.careSnapshot.hydration === 80, 'care snapshot should stay stable');
});

test('battle round is deterministic and low stamina forces rest instead of an attack', () => {
  const rules = getBattleTestRules();
  const started = core.startBattle(getLegendaryBattleState(), rules, Date.now(), 12345).state.battle.activeBattle;
  const first = core.resolveBattleRound(started, 'sporeJab', rules.battle.moveCatalog);
  const second = core.resolveBattleRound(started, 'sporeJab', rules.battle.moveCatalog);
  assert(JSON.stringify(first) === JSON.stringify(second), 'expected deterministic battle round');

  const tiredBattle = {
    rngSeed: 5,
    mode: 'choosingMove',
    turn: 0,
    player: { hp: 80, stamina: 0, attack: 14, defense: 10, speed: 12, focus: 8, strength: 12 },
    opponent: { hp: 70, stamina: 0, attack: 12, defense: 9, speed: 10, focus: 7, strength: 8 }
  };
  const rested = core.resolveBattleRound(tiredBattle, 'focusBloom', rules.battle.moveCatalog);
  const playerEvent = rested.events.find((event) => event.actor === 'player');
  assert(playerEvent.type === 'rest', `expected rest event, got ${playerEvent.type}`);
  assert(rested.player.stamina > 0, 'expected stamina recovery on forced rest');
});

test('battle victory and defeat rewards do not touch care stats', () => {
  const rules = getBattleTestRules();
  const base = getLegendaryBattleState({ inventory: { spores: 0 }, coins: 0 });
  const careStats = JSON.stringify(base.stats);
  const victory = core.applyBattleOutcomeRewards({
    ...base,
    battle: {
      ...base.battle,
      mode: 'victory',
      activeBattle: { mode: 'victory', rewarded: false }
    }
  }, rules, Date.now());

  assert(victory.ok, 'expected victory rewards');
  assert(victory.state.battle.rewards.wins === 1, 'expected win increment');
  assert(victory.state.battle.rewards.trophies === 1, 'expected trophy increment');
  assert(victory.state.inventory.spores === 2, 'expected two spore reward');
  assert(JSON.stringify(victory.state.stats) === careStats, 'victory should not change care stats');

  const defeat = core.applyBattleOutcomeRewards({
    ...base,
    battle: {
      ...base.battle,
      mode: 'defeat',
      activeBattle: { mode: 'defeat', rewarded: false }
    }
  }, rules, Date.now());
  assert(defeat.ok, 'expected defeat accounting');
  assert(defeat.state.battle.rewards.losses === 1, 'expected loss increment');
  assert(defeat.state.inventory.spores === 0, 'defeat should not grant spores');
  assert(JSON.stringify(defeat.state.stats) === careStats, 'defeat should not change care stats');
});

test('active battle save data normalizes back into a resumable fight', () => {
  const rules = getBattleTestRules();
  const activeBattle = core.startBattle(getLegendaryBattleState(), rules, Date.now(), 42).state.battle.activeBattle;
  const normalized = core.normalizeBattleState({
    mode: 'choosingMove',
    activeBattle,
    rewards: { wins: 0, losses: 0, trophies: 0 }
  });

  assert(normalized.activeBattle.player.hp > 0, 'expected player combatant to survive normalization');
  assert(normalized.activeBattle.opponent.hp > 0, 'expected opponent combatant to survive normalization');
  assert(normalized.activeBattle.seed === 42, 'expected seed to survive normalization');
});

test('battle turn resolution is deterministic for a fixed seed', () => {
  const battle = {
    rngSeed: 12345,
    mode: 'choosingMove',
    turn: 0,
    player: { hp: 80, stamina: 50, attack: 14, defense: 10, speed: 12, focus: 8 },
    opponent: { hp: 70, stamina: 45, attack: 12, defense: 9, speed: 10, focus: 7 }
  };
  const moves = [
    { id: 'sporeJab', staminaCost: 8, power: 14, accuracy: 0.94, stat: 'strength' },
    { id: 'capGuard', staminaCost: 6, power: 4, accuracy: 1, stat: 'defense', guard: 0.35 }
  ];
  const first = core.resolveBattleTurn(battle, 'sporeJab', 'capGuard', moves);
  const second = core.resolveBattleTurn(battle, 'sporeJab', 'capGuard', moves);

  assert(JSON.stringify(first) === JSON.stringify(second), 'expected deterministic battle result');
  assert(first.turn === 1, `expected turn 1, got ${first.turn}`);
});

test('ambient life is strongest in warm clear summer daylight', () => {
  const summer = core.calculateAmbientLife({
    condition: 'clear',
    dayPhase: 'noon',
    latitude: 50.2649,
    temperature: 24,
    humidity: 68,
    windSpeed: 5,
    windLevel: 0.06,
    precipitation: 0
  }, new Date(2026, 6, 8, 12, 0));
  const winter = core.calculateAmbientLife({
    condition: 'clear',
    dayPhase: 'noon',
    latitude: 50.2649,
    temperature: 2,
    humidity: 72,
    windSpeed: 4,
    windLevel: 0.05,
    precipitation: 0
  }, new Date(2026, 0, 8, 12, 0));

  assert(summer.generalIntensity > 0.7, `expected vivid summer life, got ${summer.generalIntensity}`);
  assert(summer.butterflyIntensity > 0.7, `expected summer butterflies, got ${summer.butterflyIntensity}`);
  assert(winter.generalIntensity < 0.05, `expected quiet winter life, got ${winter.generalIntensity}`);
});

test('ambient life treats missing temperature as neutral instead of freezing', () => {
  const profile = core.calculateAmbientLife({
    condition: 'clear',
    dayPhase: 'noon',
    latitude: 50.2649,
    temperature: null,
    apparentTemperature: null,
    humidity: 62,
    windSpeed: 6,
    precipitation: 0
  }, new Date(2026, 6, 8, 12, 0));

  assert(profile.generalIntensity > 0.6, `expected neutral-temperature summer life, got ${profile.generalIntensity}`);
});

test('ambient insects collapse during storm and snow', () => {
  const storm = core.calculateAmbientLife({
    condition: 'storm',
    dayPhase: 'noon',
    latitude: 50.2649,
    temperature: 23,
    humidity: 86,
    windLevel: 0.8,
    gustLevel: 0.7,
    precipitation: 6,
    rain: 6
  }, new Date(2026, 6, 8, 12, 0));
  const snow = core.calculateAmbientLife({
    condition: 'snow',
    dayPhase: 'noon',
    latitude: 50.2649,
    temperature: -2,
    humidity: 82,
    windLevel: 0.2,
    precipitation: 1,
    snowfall: 1
  }, new Date(2026, 6, 8, 12, 0));

  assert(storm.generalIntensity < 0.02, `expected near-zero storm insects, got ${storm.generalIntensity}`);
  assert(storm.fireflyIntensity === 0, `expected no storm fireflies, got ${storm.fireflyIntensity}`);
  assert(snow.generalIntensity === 0, `expected no snow insects, got ${snow.generalIntensity}`);
});

test('fireflies appear in the right summer evening window', () => {
  const baseScene = {
    condition: 'clear',
    latitude: 50.2649,
    temperature: 21,
    humidity: 82,
    windLevel: 0.08,
    precipitation: 0
  };
  const evening = core.calculateAmbientLife(Object.assign({ dayPhase: 'night' }, baseScene), new Date(2026, 5, 24, 22, 0));
  const noon = core.calculateAmbientLife(Object.assign({ dayPhase: 'noon' }, baseScene), new Date(2026, 5, 24, 12, 0));
  const january = core.calculateAmbientLife(Object.assign({ dayPhase: 'night' }, baseScene), new Date(2026, 0, 24, 22, 0));

  assert(evening.fireflyIntensity > 0.7, `expected strong summer evening fireflies, got ${evening.fireflyIntensity}`);
  assert(noon.fireflyIntensity === 0, `expected no noon fireflies, got ${noon.fireflyIntensity}`);
  assert(january.fireflyIntensity === 0, `expected no winter fireflies, got ${january.fireflyIntensity}`);
});

function getBattleTestRules() {
  return {
    battle: {
      unlockStage: 'legendary',
      trainingCost: 1,
      trainingCaps: { strength: 20, defense: 20, speed: 20, focus: 20 },
      victoryRewards: { spores: 2, wins: 1, trophies: 1 },
      defeatRewards: { losses: 1 },
      moveCatalog: [
        { id: 'sporeJab', staminaCost: 8, power: 14, accuracy: 0.94, stat: 'strength' },
        { id: 'capGuard', staminaCost: 6, power: 4, accuracy: 1, stat: 'defense', guard: 0.35 },
        { id: 'myceliumFeint', staminaCost: 10, power: 10, accuracy: 0.9, stat: 'speed' },
        { id: 'focusBloom', staminaCost: 12, power: 18, accuracy: 0.82, stat: 'focus' }
      ]
    },
    maxLogEntries: 8,
    stageThresholds: [
      { id: 'spore' },
      { id: 'adult' },
      { id: 'legendary' }
    ]
  };
}

function getLegendaryBattleState(overrides = {}) {
  const battle = core.normalizeBattleState(overrides.battle || {});
  return {
    stage: 'legendary',
    mushroomName: 'Pieczarka',
    stats: {
      hydration: 80,
      nutrients: 80,
      energy: 80,
      happiness: 80,
      cleanliness: 80,
      health: 100,
      growth: 100
    },
    inventory: { spores: 5, ...(overrides.inventory || {}) },
    coins: overrides.coins ?? 5,
    battle
  };
}

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
