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
  const dryColdClear = core.deriveWeatherImmersionFields({
    condition: 'clear',
    cloudCover: 8,
    precipitation: 0,
    snowfall: 0,
    snowDepth: 0,
    temperature: -4,
    windSpeed: 5,
    humidity: 72
  }, [], null, Date.parse('2026-01-14T08:00:00.000Z'));

  assert(coldSnow.snowCoverTarget > 0.75, `expected accumulated snow, got ${coldSnow.snowCoverTarget}`);
  assert(coldSnow.snowStyle === 'powder', `expected powder snow, got ${coldSnow.snowStyle}`);
  assert(warmOldSnow.snowCoverTarget < coldSnow.snowCoverTarget, 'warm old snow should melt compared with active snowfall');
  assert(dryColdClear.snowCoverTarget === 0, `cold clear weather without snow should not create snow cover, got ${dryColdClear.snowCoverTarget}`);
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

test('v2 saves migrate to v13 progression history, discoveries, evolution, minigames, decorations, daily rhythm, journal, return recap, relationship, naming gate, and calendar', () => {
  const migrated = core.migrateStateVersion({
    version: 2,
    stage: 'adult',
    stats: { growth: 70 },
    history: { actionsPerformed: { hydrate: 2 } }
  }, 13);

  assert(migrated.version === 13, `expected version 13, got ${migrated.version}`);
  assert(migrated.mushroomName === '', 'expected unnamed default mushroom for first-run naming gate');
  assert(migrated.flags && migrated.flags.nameConfirmed === false, 'expected name confirmation flag to default to false');
  assert(migrated.history.actionsPerformed.hydrate === 2, 'expected action history to survive migration');
  assert(migrated.history.attention.handled === 0, 'expected attention history defaults');
  assert(migrated.history.dailyGrowth.earned === 0, 'expected daily growth defaults');
  assert(migrated.evolution && migrated.evolution.variant === null, 'expected empty evolution state');
  assert(migrated.minigames && migrated.minigames.active === null, 'expected empty minigame state');
  assert(Array.isArray(migrated.decorations.owned), 'expected decoration ownership list');
  assert(migrated.discoveries && migrated.discoveries.sky, 'expected sky discoveries subtree');
  assert(migrated.discoveries && migrated.discoveries.environment, 'expected environment discoveries subtree');
  assert(migrated.discoveries && migrated.discoveries.instruments, 'expected instrument discoveries subtree');
  assert(migrated.discoveries && migrated.discoveries.calendar, 'expected calendar discoveries subtree');
  assert(migrated.recovery && migrated.recovery.active === false, 'expected empty recovery state');
  assert(migrated.gameOver && migrated.gameOver.active === false, 'expected empty game-over state');
  assert(migrated.dailyPlan && Array.isArray(migrated.dailyPlan.activeIds), 'expected daily plan defaults');
  assert(migrated.dailyRhythm && Array.isArray(migrated.dailyRhythm.options), 'expected daily rhythm defaults');
  assert(migrated.relationship && Array.isArray(migrated.relationship.entries), 'expected relationship defaults');
  assert(migrated.journal && Array.isArray(migrated.journal.entries), 'expected world journal defaults');
  assert(migrated.returnRecap && Array.isArray(migrated.returnRecap.entries), 'expected return recap defaults');
});

test('custom mushroom names survive migration as confirmed names', () => {
  const migrated = core.migrateStateVersion({
    version: 11,
    mushroomName: 'Borowik',
    flags: {}
  }, 13);

  assert(migrated.version === 13, `expected version 13, got ${migrated.version}`);
  assert(migrated.mushroomName === 'Borowik', `expected custom name to survive, got ${migrated.mushroomName}`);
  assert(migrated.flags && migrated.flags.nameConfirmed === true, 'expected custom legacy name to count as confirmed');
});

test('daily care plan is deterministic and completes matching actions once', () => {
  const now = Date.parse('2026-05-21T08:00:00.000Z');
  const rules = getGameplayLoopTestRules();
  const state = getGameplayLoopTestState({
    stats: { hydration: 35, nutrients: 72, energy: 80, happiness: 70, cleanliness: 76, health: 90, growth: 18 },
    attention: { activeNeed: 'hydration', severity: 'mild', startedAt: null, deadlineAt: null }
  });
  const scene = { dayPhase: 'morning', humidity: 88, precipitation: 0, rain: 0 };
  const planned = core.ensureDailyPlan(state, rules, now, scene);
  const plan = core.getDailyCarePlan(planned, rules, now, scene);
  const first = core.updateDailyPlanProgress(planned, { type: 'action', actionId: 'hydrate' }, rules, now + 1000, scene);
  const second = core.updateDailyPlanProgress(first.state, { type: 'action', actionId: 'hydrate' }, rules, now + 2000, scene);

  assert(plan.goals.length === 3, `expected three daily goals, got ${plan.goals.length}`);
  assert(plan.goals[0].id === 'attention-hydration', `expected hydration attention first, got ${plan.goals[0].id}`);
  assert(first.completed.length === 1, `expected one completed goal, got ${first.completed.length}`);
  assert(first.state.dailyPlan.completed['attention-hydration'], 'expected hydration goal to be marked complete');
  assert(second.completed.length === 0, 'expected repeated action not to duplicate completion');
  assert(first.state.patch.quality > state.patch.quality, 'expected daily goal reward to improve patch quality');
});

test('daily rhythm selection reshapes the same-day care plan once', () => {
  const now = Date.parse('2026-05-21T08:00:00.000Z');
  const rules = getGameplayLoopTestRules();
  const state = getGameplayLoopTestState({
    stats: { hydration: 82, nutrients: 78, energy: 80, happiness: 76, cleanliness: 80, health: 90, growth: 18 }
  });
  const scene = { dayPhase: 'morning', humidity: 88, precipitation: 0, rain: 0 };
  const options = core.getDailyRhythmOptions(state, rules, now, scene);
  const dewOption = options.options.find((item) => item.id === 'dew');
  const selected = core.selectDailyRhythm(state, 'dew', rules, now, scene);
  const plan = core.getDailyCarePlan(selected.state, rules, now, scene);
  const second = core.selectDailyRhythm(selected.state, 'music', rules, now + 1000, scene);

  assert(dewOption, 'expected dew rhythm to be offered in a wet morning scene');
  assert(selected.ok, `expected dew rhythm selection to succeed: ${selected.reason}`);
  assert(selected.state.dailyRhythm.selectedId === 'dew', 'expected selected dew rhythm');
  assert(plan.goals.some((goal) => goal.id === 'action-hydrate' || goal.id === 'minigame-dewCatch'), 'expected dew rhythm goal in plan');
  assert(!second.ok, 'expected same day rhythm to be locked after selection');
});

test('minigame opportunities follow scene, stage, and cooldowns', () => {
  const now = Date.parse('2026-05-21T07:30:00.000Z');
  const rules = getGameplayLoopTestRules();
  const state = getGameplayLoopTestState({
    stage: 'adult',
    patch: { quality: 74, mycelium: 80, harvests: 0, careStreak: 0 },
    cooldowns: { 'minigame.dewCatch': now + 60000 }
  });
  const opportunities = core.getMinigameOpportunities(state, rules, {
    dayPhase: 'morning',
    humidity: 92,
    precipitation: 0,
    rain: 0
  }, now);
  const dew = opportunities.find((item) => item.minigameId === 'dewCatch');
  const spore = opportunities.find((item) => item.minigameId === 'sporePop');

  assert(dew && !dew.available, 'expected dew catch opportunity on cooldown');
  assert(spore && spore.available, 'expected adult spore opportunity to be available');
});

test('habitat tags influence minigame opportunities and expose effects', () => {
  const now = Date.parse('2026-05-21T13:30:00.000Z');
  const rules = getGameplayLoopTestRules();
  const state = getGameplayLoopTestState({
    stage: 'young',
    stats: { hydration: 65 },
    decorations: { owned: ['dewStone', 'sporeLantern', 'mossBell', 'cloverPatch'], active: ['dewStone', 'sporeLantern', 'mossBell', 'cloverPatch'] },
    inventory: { spores: 0 },
    patch: { quality: 74, mycelium: 24, harvests: 0, careStreak: 0 }
  });
  const opportunities = core.getMinigameOpportunities(state, rules, {
    dayPhase: 'afternoon',
    humidity: 66,
    precipitation: 0,
    rain: 0
  }, now);
  const habitat = core.getDecorationHabitatSummary(state, rules);
  const lifeScene = core.getHabitatLifeScene(state, {
    condition: 'clear',
    dayPhase: 'noon',
    humidity: 66,
    temperature: 23,
    flowerDensity: 0.05
  }, rules);

  assert(opportunities.some((item) => item.minigameId === 'dewCatch'), 'expected moisture habitat to make dew catch viable');
  assert(opportunities.some((item) => item.minigameId === 'sporePop'), 'expected spore habitat to unlock young-stage spore pop');
  assert(opportunities.some((item) => item.minigameId === 'rhythmHum'), 'expected music habitat to recommend rhythm hum');
  assert(habitat.effects.some((effect) => effect.includes('Rosa')), 'expected habitat summary to describe moisture effect');
  assert(lifeScene.flowerDensity > 0.5, `expected flower habitat to enrich scene, got ${lifeScene.flowerDensity}`);
  assert(lifeScene.fireflyHabitatBoost > 0, 'expected night/spore habitat to boost fireflies');
});

test('relationship log is bounded and decoration habitat aggregates tags', () => {
  const rules = getGameplayLoopTestRules();
  let state = getGameplayLoopTestState({
    decorations: { owned: ['dewStone', 'mossBell'], active: ['dewStone', 'mossBell'] }
  });
  for (let index = 0; index < 10; index += 1) {
    state = core.addRelationshipEntry(state, {
      title: 'Wpis ' + index,
      body: 'Krótki ślad opieki.',
      tone: 'care',
      tag: 'test'
    }, Date.parse('2026-05-21T08:00:00.000Z') + index, 4);
  }
  const habitat = core.getDecorationHabitatSummary(state, rules);

  assert(state.relationship.entries.length === 4, `expected bounded relationship entries, got ${state.relationship.entries.length}`);
  assert(state.relationship.entries[0].title === 'Wpis 9', 'expected newest relationship entry first');
  assert(habitat.tags.some((tag) => tag.id === 'comfort' && tag.count === 2), 'expected comfort habitat from active decorations');
  assert(habitat.tags.some((tag) => tag.id === 'music'), 'expected music habitat tag');
});

test('evolution compass summarizes current care direction without deciding evolution', () => {
  const rules = getGameplayLoopTestRules();
  const state = getGameplayLoopTestState({
    history: {
      actionsPerformed: { hydrate: 6, feed: 1, clean: 1, play: 0, instrument: 0, sing: 0 },
      modeMs: { awake: 1000, sleeping: 1000 },
      statSamples: { count: 2, hydration: 170, nutrients: 140, energy: 160, happiness: 130, cleanliness: 150, health: 180 },
      attention: { handled: 2, missed: 0 },
      dailyGrowth: { dateKey: '2026-05-21', earned: 1 },
      minigames: {}
    }
  });
  const compass = core.getEvolutionCompass(state, rules);
  const visual = core.getEvolutionVisualIdentity(compass.variant, rules);

  assert(compass.variant === 'dewcap', `expected dewcap direction, got ${compass.variant}`);
  assert(!compass.decided, 'expected compass to remain a preview before evolution');
  assert(compass.cues.length > 0, 'expected visible compass cues');
  assert(visual && visual.scene === 'dew', 'expected dewcap visual identity');
  assert(visual.cue.includes('Krople'), `expected dew visual cue, got ${visual.cue}`);
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

test('recovery starts at zero health and blocks play while allowing moss-bed care', () => {
  const now = Date.parse('2026-05-17T12:00:00.000Z');
  const rules = getRecoveryTestRules();
  const started = core.updateRecoveryState({
    mode: 'awake',
    stats: { health: 0, hydration: 50, nutrients: 50, cleanliness: 50, energy: 0, happiness: 50 },
    patch: { quality: 70, mycelium: 0, harvests: 0, careStreak: 0 },
    recovery: {}
  }, rules, now);

  assert(started.state.recovery.active, 'expected recovery to start at zero health');
  assert(started.state.mode === 'sleeping', 'recovery should put mushroom in moss-bed rest');
  assert(started.state.stats.health === 8, `expected recovery start health, got ${started.state.stats.health}`);
  assert(started.events[0].type === 'recoveryStart', 'expected recovery start event');
  assert(!core.getActionAvailability(started.state, { id: 'play', awakeOnly: true, recoveryBlocked: true }, now, rules).ok, 'play should be blocked during recovery');
  assert(core.getActionAvailability(started.state, { id: 'hydrate', awakeOnly: true, recoveryCare: true }, now, rules).ok, 'hydrate should be allowed during recovery even while resting');
  assert(core.getAnimationIntent(started.state, {}, now).state === 'critical', 'recovery at very low health should use critical animation');
});

test('moss-bed recovery extends without fresh care and completes after recent care with stable needs', () => {
  const now = Date.parse('2026-05-17T12:00:00.000Z');
  const rules = getRecoveryTestRules();
  const started = core.updateRecoveryState({
    mode: 'awake',
    stats: { health: 0, hydration: 50, nutrients: 50, cleanliness: 50, energy: 30, happiness: 50 },
    patch: { quality: 70, mycelium: 0, harvests: 0, careStreak: 0 },
    recovery: {}
  }, rules, now).state;
  const until = Date.parse(started.recovery.until);
  const extended = core.updateRecoveryState(started, rules, until + 1);

  assert(extended.state.recovery.active, 'recovery should remain active without recent care');
  assert(extended.events[0].type === 'recoveryExtended', 'expected extension event');
  assert(extended.state.recovery.missedCare === 1, 'expected one missed recovery care mark');

  const cared = core.recordRecoveryCare({
    ...extended.state,
    stats: { ...extended.state.stats, hydration: 44, nutrients: 42, cleanliness: 41 }
  }, 'clean', rules, until + 60_000).state;
  const completed = core.updateRecoveryState(cared, rules, Date.parse(cared.recovery.until) + 1);

  assert(!completed.state.recovery.active, 'recovery should complete after recent care and stable needs');
  assert(completed.state.stats.health === 28, `expected completion health, got ${completed.state.stats.health}`);
  assert(completed.events[0].type === 'recoveryComplete', 'expected completion event');
});

test('moss-bed recovery reaches game over after too many missed care windows', () => {
  const now = Date.parse('2026-05-17T12:00:00.000Z');
  const rules = getRecoveryTestRules();
  const started = core.updateRecoveryState({
    createdAt: '2026-05-15T09:00:00.000Z',
    mode: 'awake',
    stage: 'young',
    stats: { health: 0, hydration: 10, nutrients: 12, cleanliness: 8, energy: 5, happiness: 20 },
    patch: { quality: 20, mycelium: 0, harvests: 0, careStreak: 2 },
    attention: { activeNeed: 'hydration', severity: 'critical' },
    recovery: {},
    minigames: { active: { id: 'dewCatch' } },
    battle: { mode: 'active', activeBattle: { mode: 'active' } }
  }, rules, now).state;

  let current = started;
  for (let miss = 0; miss < 3; miss += 1) {
    current = core.updateRecoveryState(current, rules, Date.parse(current.recovery.until) + 1).state;
  }

  assert(current.gameOver && current.gameOver.active, 'expected game over after the third missed recovery window');
  assert(current.gameOver.reason === 'recoveryNeglected', `expected recoveryNeglected reason, got ${current.gameOver.reason}`);
  assert(current.gameOver.recoveryMissedCare === 3, 'expected missed recovery count on game over');
  assert(current.stats.health === 0, 'game over should leave health at zero');
  assert(!current.recovery.active, 'recovery should stop after game over');
  assert(current.minigames.active === null, 'active minigame should be cleared');
  assert(current.battle.activeBattle === null, 'active battle should be cleared');
  assert(core.isGameOver(current), 'core game-over helper should report terminal state');
  assert(!core.getActionAvailability(current, { id: 'hydrate', awakeOnly: true, recoveryCare: true }, now, rules).ok, 'care actions should be blocked after game over');
  assert(core.getAnimationIntent(current, rules, now).type === 'gameOver', 'game over should own animation intent');
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
  assert(missed.state.stats.health === 98, `expected health penalty, got ${missed.state.stats.health}`);
  assert(missed.state.patch.quality === 70, `expected patch penalty, got ${missed.state.patch.quality}`);
  assert(missed.events[0].type === 'mistake', 'expected missed-deadline event');

  const handled = core.resolveAttentionAction(started.state, 'hydrate', rules, now + 400);
  assert(handled.handled, 'expected hydrate to handle hydration attention');
  assert(handled.state.attention.activeNeed === null, 'expected attention to clear');
  assert(handled.state.patch.careStreak === 1, 'expected care streak reward');
});

test('attention can use per-need thresholds and records history outcomes', () => {
  const now = Date.parse('2026-05-16T12:00:00.000Z');
  const rules = {
    attention: {
      mildThreshold: 45,
      criticalThreshold: 25,
      deadlineMs: 1000,
      criticalDeadlineMs: 500,
      repeatedMistakeCooldownMs: 10_000,
      perNeed: {
        cleanliness: {
          mildThreshold: 30,
          criticalThreshold: 15,
          deadlineMs: 4000,
          criticalDeadlineMs: 2000
        }
      }
    },
    needDefinitions: {
      cleanliness: {
        category: 'environment',
        actionId: 'clean',
        title: 'Bałagan',
        mildMessage: 'Brudno.',
        criticalMessage: 'Bardzo brudno.'
      }
    }
  };
  const state = {
    mode: 'awake',
    stats: { cleanliness: 34, health: 100, happiness: 70 },
    attention: {},
    careMistakes: {},
    patch: { quality: 70, mycelium: 0, harvests: 0, careStreak: 0 },
    history: {}
  };

  const quiet = core.evaluateAttentionState(state, rules, now);
  assert(quiet.state.attention.activeNeed === null, 'cleanliness above per-need mild threshold should stay quiet');

  const started = core.evaluateAttentionState({
    ...state,
    stats: { cleanliness: 24, health: 100, happiness: 70 }
  }, rules, now);
  assert(started.state.attention.activeNeed === 'cleanliness', 'expected cleanliness attention below per-need threshold');
  assert(Date.parse(started.state.attention.deadlineAt) === now + 4000, 'expected per-need deadline');

  const missed = core.evaluateAttentionState(started.state, rules, now + 4001);
  assert(missed.state.history.attention.missed === 1, 'expected missed attention history');
  const handled = core.resolveAttentionAction(started.state, 'clean', rules, now + 1000);
  assert(handled.state.history.attention.handled === 1, 'expected handled attention history');
});

test('quiet hours pause attention deadlines until morning grace ends', () => {
  const rules = {
    careRhythm: {
      quietStartMinute: 22 * 60 + 30,
      quietEndMinute: 7 * 60,
      morningGraceMs: 45 * 60000,
      offlineCapHours: 24
    },
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
  const night = new Date(2026, 4, 16, 23, 0).getTime();
  const graceEnd = new Date(2026, 4, 17, 7, 45).getTime();
  const started = core.evaluateAttentionState(state, rules, night);

  assert(started.state.attention.activeNeed === 'hydration', 'expected hydration attention at night');
  assert(started.state.attention.quietSuppressed, 'night attention should be marked as quiet-suppressed');
  assert(Date.parse(started.state.attention.deadlineAt) === graceEnd, 'deadline should move to morning grace end');

  const morning = core.evaluateAttentionState(started.state, rules, new Date(2026, 4, 17, 7, 30).getTime());
  assert(!morning.state.careMistakes.physical, 'morning grace should not record mistakes');

  const late = core.evaluateAttentionState(morning.state, rules, new Date(2026, 4, 17, 8, 0).getTime());
  assert(late.state.careMistakes.physical === 1, 'missed morning grace should record one mistake');
});

test('care time segmentation applies quiet-night decay separately from daytime decay', () => {
  const rules = {
    careRhythm: {
      quietStartMinute: 22 * 60 + 30,
      quietEndMinute: 7 * 60,
      morningGraceMs: 45 * 60000,
      offlineCapHours: 24
    }
  };
  const start = new Date(2026, 4, 16, 22, 0).getTime();
  const end = new Date(2026, 4, 17, 8, 0).getTime();
  const plan = core.calculateCareTimeSegments(start, end, 'sleeping', rules);
  const quietHours = plan.segments
    .filter((segment) => segment.decayKey === 'quietSleeping')
    .reduce((sum, segment) => sum + segment.elapsedHours, 0);
  const sleepHours = plan.segments
    .filter((segment) => segment.decayKey === 'sleeping')
    .reduce((sum, segment) => sum + segment.elapsedHours, 0);

  assert(Math.abs(quietHours - 8.5) < 0.001, `expected 8.5 quiet hours, got ${quietHours}`);
  assert(Math.abs(sleepHours - 1.5) < 0.001, `expected 1.5 regular sleep hours, got ${sleepHours}`);
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
    currentActivity: { type: 'wake_surprise', until: now + 1000 }
  }, rules, now).state === 'wake', 'wake surprise should use the wake sheet');
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

test('immersion reaction prefers fresh pointer tap and blocks when care state needs attention', () => {
  const now = 1_000_000;
  const rules = {
    attention: { mildThreshold: 45, criticalThreshold: 25 },
    needDefinitions: {
      hydration: { category: 'physical', actionId: 'hydrate' }
    }
  };
  const state = {
    mode: 'awake',
    stats: { hydration: 82, nutrients: 82, happiness: 82, cleanliness: 82, energy: 82, health: 100 },
    patch: { quality: 82 },
    attention: {}
  };
  const reaction = core.selectImmersionReaction(state, { condition: 'clear', isDay: true, cloudCover: 20 }, {
    inside: true,
    x: 260,
    y: 268,
    lastMoveAt: now - 80,
    lastDownAt: now - 120,
    consumedDownAt: 0,
    speed: 0.2
  }, now, rules);

  assert(reaction && reaction.id === 'pointerTap', `expected pointer tap reaction, got ${reaction && reaction.id}`);
  assert(reaction.state === 'watch_cursor_right', `expected cursor watch state, got ${reaction.state}`);

  const blocked = core.selectImmersionReaction({
    ...state,
    stats: { ...state.stats, hydration: 20 }
  }, { condition: 'clear', isDay: true, cloudCover: 20 }, {
    inside: true,
    x: 260,
    y: 268,
    lastMoveAt: now - 80
  }, now, rules);
  assert(blocked === null, 'active care need should block immersion reaction');
});

test('cursor immersion follows direction and fast fly-by path', () => {
  const now = 1_200_000;
  const rules = {
    attention: { mildThreshold: 45, criticalThreshold: 25 },
    needDefinitions: {
      hydration: { category: 'physical', actionId: 'hydrate' }
    }
  };
  const state = {
    mode: 'awake',
    stats: { hydration: 82, nutrients: 82, happiness: 82, cleanliness: 82, energy: 82, health: 100 },
    patch: { quality: 82 },
    attention: {}
  };
  const scene = { condition: 'clear', isDay: true, cloudCover: 82, precipitation: 0 };
  const left = core.selectImmersionReaction(state, scene, {
    inside: true,
    x: 146,
    y: 270,
    previousX: 158,
    previousY: 270,
    lastMoveAt: now - 70,
    consumedDownAt: 0,
    speed: 0.18
  }, now, rules);
  const upRight = core.selectImmersionReaction(state, scene, {
    inside: true,
    x: 340,
    y: 184,
    previousX: 330,
    previousY: 190,
    lastMoveAt: now - 70,
    consumedDownAt: 0,
    speed: 0.18
  }, now, rules);
  const fast = core.selectImmersionReaction(state, scene, {
    inside: true,
    x: 420,
    y: 306,
    previousX: 88,
    previousY: 294,
    lastMoveAt: now - 40,
    consumedDownAt: 0,
    speed: 2.1
  }, now, rules);
  const after = core.selectImmersionReaction(state, scene, {
    inside: false,
    x: 430,
    y: 294,
    previousX: 250,
    previousY: 294,
    lastMoveAt: now - 120,
    consumedDownAt: 0,
    speed: 0
  }, now, rules);

  assert(left && left.state === 'watch_cursor_left', `expected left cursor watch, got ${left && left.state}`);
  assert(upRight && upRight.state === 'watch_cursor_up_right', `expected up-right cursor watch, got ${upRight && upRight.state}`);
  assert(fast && fast.state === 'follow_cursor_fast', `expected fast follow, got ${fast && fast.state}`);
  assert(after && after.state === 'follow_cursor_after', `expected after-follow outside canvas, got ${after && after.state}`);
});

test('immersion reaction maps weather and celestial context to dedicated animation states', () => {
  const now = 2_000_000;
  const rules = {
    attention: { mildThreshold: 45, criticalThreshold: 25 },
    needDefinitions: {
      hydration: { category: 'physical', actionId: 'hydrate' }
    }
  };
  const state = {
    mode: 'awake',
    stats: { hydration: 82, nutrients: 82, happiness: 82, cleanliness: 82, energy: 82, health: 100 },
    patch: { quality: 82 },
    attention: {}
  };
  const noInput = { inside: false };
  const rain = core.selectImmersionReaction(state, {
    condition: 'rain',
    isDay: true,
    cloudCover: 92,
    precipitation: 2.4,
    rain: 2.4
  }, noInput, now, rules);
  const snow = core.selectImmersionReaction(state, {
    condition: 'snow',
    isDay: true,
    cloudCover: 88,
    precipitation: 1.1,
    snowfall: 1.1
  }, noInput, now, rules);
  const sun = core.selectImmersionReaction(state, {
    condition: 'clear',
    isDay: true,
    cloudCover: 18,
    precipitation: 0
  }, noInput, now, rules);
  const stars = core.selectImmersionReaction(state, {
    condition: 'clear',
    isDay: false,
    cloudCover: 20,
    precipitation: 0
  }, noInput, now, rules);

  assert(rain && rain.state === 'rain', `expected rain state, got ${rain && rain.state}`);
  assert(snow && snow.state === 'snow', `expected snow state, got ${snow && snow.state}`);
  assert(sun && sun.state === 'sun', `expected sun state, got ${sun && sun.state}`);
  assert(stars && stars.state === 'stargaze', `expected stargaze state, got ${stars && stars.state}`);
});

test('ambient life focus cues trigger mushroom reactions without outranking care or weather', () => {
  const rules = {
    attention: { mildThreshold: 45, criticalThreshold: 25 },
    needDefinitions: {
      hydration: { category: 'physical', actionId: 'hydrate' }
    }
  };
  const state = {
    mode: 'awake',
    stats: { hydration: 82, nutrients: 82, happiness: 82, cleanliness: 82, energy: 82, health: 100 },
    patch: { quality: 82 },
    attention: {}
  };
  const summerScene = {
    condition: 'clear',
    isDay: true,
    dayPhase: 'noon',
    cloudCover: 18,
    precipitation: 0,
    rain: 0,
    snowfall: 0,
    temperature: 24,
    humidity: 68,
    windLevel: 0.06,
    latitude: 50.2649
  };
  const cueSample = findAmbientCue(summerScene, Date.parse('2026-07-08T12:00:00.000Z'));

  assert(cueSample, 'expected at least one deterministic summer ambient cue');
  assert(['butterfly', 'crawler'].includes(cueSample.cue.kind), `expected daytime ambient cue, got ${cueSample.cue.kind}`);

  const reaction = core.selectImmersionReaction(state, summerScene, { inside: false }, cueSample.now, rules);
  assert(reaction && reaction.source === 'ambient', `expected ambient reaction, got ${reaction && reaction.source}`);
  assert(['watch_butterfly', 'watch_crawler'].includes(reaction.state), `expected ambient watch state, got ${reaction && reaction.state}`);

  const pointer = core.selectImmersionReaction(state, summerScene, {
    inside: true,
    x: 260,
    y: 268,
    lastMoveAt: cueSample.now - 80,
    lastDownAt: cueSample.now - 120,
    consumedDownAt: 0,
    speed: 0.2
  }, cueSample.now, rules);
  assert(pointer && pointer.id === 'pointerTap', `pointer should outrank ambient cue, got ${pointer && pointer.id}`);

  const rain = core.selectImmersionReaction(state, Object.assign({}, summerScene, {
    condition: 'rain',
    precipitation: 2.2,
    rain: 2.2,
    cloudCover: 92
  }), { inside: false }, cueSample.now, rules);
  assert(rain && rain.state === 'rain', `rain should outrank ambient cue, got ${rain && rain.state}`);

  const blocked = core.selectImmersionReaction({
    ...state,
    stats: { ...state.stats, hydration: 20 }
  }, summerScene, { inside: false }, cueSample.now, rules);
  assert(blocked === null, 'active care need should block ambient cue');
});

test('quiet neutral scenes can select idle fidget or ponder motion', () => {
  const rules = {
    attention: { mildThreshold: 45, criticalThreshold: 25 },
    needDefinitions: {
      hydration: { category: 'physical', actionId: 'hydrate' }
    }
  };
  const state = {
    mode: 'awake',
    stats: { hydration: 82, nutrients: 82, happiness: 72, cleanliness: 82, energy: 82, health: 100 },
    patch: { quality: 72 },
    attention: {}
  };
  const quietScene = {
    condition: 'cloudy',
    isDay: true,
    dayPhase: 'afternoon',
    cloudCover: 96,
    precipitation: 0,
    rain: 0,
    snowfall: 0,
    temperature: 1,
    humidity: 60,
    windLevel: 0.08,
    latitude: 50.2649
  };
  const start = Date.parse('2026-01-08T13:00:00.000Z');
  let reaction = null;

  for (let step = 0; step < 64; step += 1) {
    reaction = core.selectImmersionReaction(state, quietScene, { inside: false }, start + step * 23000, rules);
    if (reaction && reaction.source === 'idle') {
      break;
    }
  }

  assert(reaction && reaction.source === 'idle', 'expected deterministic idle motion in quiet scene');
  assert([
    'idle_fidget_sway',
    'idle_fidget_shift',
    'idle_look_left',
    'idle_look_right',
    'ponder_up',
    'ponder_side',
    'ponder_breath'
  ].includes(reaction.state), `expected idle or ponder variant, got ${reaction && reaction.state}`);
});

test('idle and ponder variants avoid repeating the last chosen animation', () => {
  const rules = {
    attention: { mildThreshold: 45, criticalThreshold: 25 },
    needDefinitions: {
      hydration: { category: 'physical', actionId: 'hydrate' }
    }
  };
  const state = {
    mode: 'awake',
    stats: { hydration: 82, nutrients: 82, happiness: 72, cleanliness: 82, energy: 82, health: 100 },
    patch: { quality: 72 },
    attention: {}
  };
  const quietScene = {
    condition: 'cloudy',
    isDay: true,
    dayPhase: 'afternoon',
    cloudCover: 96,
    precipitation: 0,
    rain: 0,
    snowfall: 0,
    temperature: 1,
    humidity: 60,
    windLevel: 0.08,
    latitude: 50.2649
  };
  const start = Date.parse('2026-01-08T13:00:00.000Z');
  let first = null;
  for (let step = 0; step < 80; step += 1) {
    const candidate = core.selectImmersionReaction(state, quietScene, { inside: false }, start + step * 23000, rules);
    if (candidate && candidate.source === 'idle') {
      first = { candidate, now: start + step * 23000 };
      break;
    }
  }

  assert(first, 'expected first idle variant');
  const repeated = core.selectImmersionReaction(state, quietScene, {
    inside: false,
    lastVariantByGroup: {
      [first.candidate.variantGroup]: first.candidate.state
    }
  }, first.now, rules);
  assert(repeated && repeated.state !== first.candidate.state, `expected different variant than ${first.candidate.state}, got ${repeated && repeated.state}`);
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

test('battle status effects slow the next turn and self effects recover stamina', () => {
  const rules = getBattleTestRules();
  const battle = {
    rngSeed: 999,
    mode: 'choosingMove',
    turn: 0,
    player: { hp: 90, maxHp: 90, stamina: 50, maxStamina: 60, attack: 16, defense: 12, speed: 18, focus: 10, strength: 12 },
    opponent: { hp: 90, maxHp: 90, stamina: 50, maxStamina: 60, attack: 12, defense: 10, speed: 16, focus: 9, strength: 10 }
  };

  const slowed = core.resolveBattleTurn(battle, 'myceliumFeint', 'capGuard', rules.battle.moveCatalog);
  assert(slowed.opponent.statusEffects.slow, 'expected slow status after mycelium feint');
  assert(slowed.events.some((event) => event.statusEffect === 'slow'), 'expected slow event metadata');

  const staminaBefore = slowed.player.stamina;
  const bloomed = core.resolveBattleTurn(slowed, 'focusBloom', 'capGuard', rules.battle.moveCatalog);
  assert(bloomed.player.stamina >= staminaBefore - 12 + 4, 'expected focus bloom stamina recovery after cost');
  assert(bloomed.events.some((event) => event.selfEffect === 'stamina'), 'expected stamina self-effect metadata');
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

test('minigame completion grants bounded rewards and records play history', () => {
  const rules = {
    minigames: {
      dewCatch: {
        id: 'dewCatch',
        label: 'Łapanie rosy',
        durationMs: 20000,
        dropCount: 18,
        rewards: {
          hydrationBase: 4,
          hydrationPerCatch: 2,
          hydrationMax: 18,
          happinessPerCatch: 1,
          happinessMax: 6
        }
      }
    }
  };
  const now = Date.parse('2026-05-16T12:00:00.000Z');
  const session = core.createMinigameSession('dewCatch', rules, now, 123).session;
  session.score = 20;
  const result = core.finishMinigame({
    stats: { hydration: 50, happiness: 50 },
    inventory: { spores: 0 },
    history: {},
    minigames: {}
  }, session, rules, now + 20000);

  assert(result.ok, 'expected minigame finish success');
  assert(result.state.stats.hydration === 68, `expected hydration capped reward, got ${result.state.stats.hydration}`);
  assert(result.state.stats.happiness === 56, `expected happiness capped reward, got ${result.state.stats.happiness}`);
  assert(result.state.inventory.spores === 1, 'expected score-based spore reward');
  assert(result.state.history.minigames.dewCatch.plays === 1, 'expected minigame play history');
  assert(result.state.history.minigames.dewCatch.bestScore === 20, 'expected best score history');
});

test('spore pop grants bounded happiness and spores without hydration', () => {
  const rules = {
    minigames: {
      sporePop: {
        id: 'sporePop',
        label: 'Pękanie zarodników',
        durationMs: 18000,
        targetCount: 20,
        rewards: {
          happinessBase: 2,
          happinessPerPop: 1,
          happinessMax: 14,
          sporesPerPop: 0.22,
          sporesMax: 4
        }
      }
    }
  };
  const now = Date.parse('2026-05-16T12:20:00.000Z');
  const session = core.createMinigameSession('sporePop', rules, now, 456).session;
  session.score = 30;
  const result = core.finishMinigame({
    stats: { hydration: 50, happiness: 50 },
    inventory: { spores: 1 },
    coins: 1,
    history: {},
    minigames: {}
  }, session, rules, now + 18000);

  assert(result.ok, 'expected spore pop finish success');
  assert(result.state.stats.hydration === 50, `expected unchanged hydration, got ${result.state.stats.hydration}`);
  assert(result.state.stats.happiness === 64, `expected capped happiness reward, got ${result.state.stats.happiness}`);
  assert(result.state.inventory.spores === 5, `expected capped spore reward, got ${result.state.inventory.spores}`);
  assert(result.state.history.minigames.sporePop.plays === 1, 'expected spore pop history');
  assert(result.state.minigames.lastResult.id === 'sporePop', 'expected spore pop last result');
});

test('new habitat minigames grant bounded substrate and rhythm rewards', () => {
  const rules = {
    minigames: {
      compostSort: {
        id: 'compostSort',
        label: 'Sortowanie kompostu',
        rewards: {
          nutrientsBase: 2,
          nutrientsPerPoint: 1.2,
          nutrientsMax: 12,
          cleanlinessPerPoint: 0.4,
          cleanlinessMax: 5,
          substratePerPoint: 0.08,
          substrateMax: 1
        }
      },
      rhythmHum: {
        id: 'rhythmHum',
        label: 'Rytmiczne nucenie',
        rewards: {
          happinessBase: 2,
          happinessPerPoint: 1.1,
          happinessMax: 12,
          energyPerPoint: 0.25,
          energyMax: 3
        }
      }
    }
  };
  const now = Date.parse('2026-05-21T15:00:00.000Z');
  const compostSession = core.createMinigameSession('compostSort', rules, now, 789).session;
  compostSession.score = 18;
  const compost = core.finishMinigame({
    stats: { nutrients: 50, cleanliness: 60, happiness: 50 },
    inventory: { spores: 0, substrate: 0 },
    history: {},
    minigames: {}
  }, compostSession, rules, now + 22000);

  const rhythmSession = core.createMinigameSession('rhythmHum', rules, now, 790).session;
  rhythmSession.score = 10;
  const rhythm = core.finishMinigame({
    stats: { happiness: 50, energy: 60 },
    inventory: { spores: 0 },
    history: {},
    minigames: {}
  }, rhythmSession, rules, now + 18000);

  assert(compost.ok, 'expected compost sort finish success');
  assert(compost.state.stats.nutrients === 62, `expected capped nutrients, got ${compost.state.stats.nutrients}`);
  assert(compost.state.stats.cleanliness === 65, `expected capped cleanliness, got ${compost.state.stats.cleanliness}`);
  assert(compost.state.inventory.substrate === 1, `expected substrate reward, got ${compost.state.inventory.substrate}`);
  assert(rhythm.ok, 'expected rhythm hum finish success');
  assert(rhythm.state.stats.happiness === 62, `expected capped rhythm happiness, got ${rhythm.state.stats.happiness}`);
  assert(rhythm.state.stats.energy === 62.5, `expected small rhythm energy reward, got ${rhythm.state.stats.energy}`);
});

test('evolution variant reacts to care history and legendary threshold', () => {
  const rules = {
    evolution: {
      legendaryGrowth: 100,
      variants: { songcap: 'Śpiewopieczarka', dewcap: 'Rosopieczarka' },
      traits: {
        dewcap: { title: 'Rytm rosy', favoriteAction: 'hydrate', message: 'Rosopieczarka lubi rosę.' }
      }
    }
  };
  const song = core.getEvolutionVariant({
    actionsPerformed: { instrument: 4, sing: 3, play: 1 },
    statSamples: { count: 2, health: 150, happiness: 140 },
    attention: {},
    minigames: {}
  }, { careMistakes: {}, patch: { quality: 75 } }, rules);
  assert(song.variant === 'songcap', `expected songcap, got ${song.variant}`);

  const evolved = core.maybeApplyEvolution({
    stage: 'adult',
    stats: { growth: 100 },
    history: { actionsPerformed: { hydrate: 5 }, statSamples: { count: 2, health: 180 } },
    careMistakes: {},
    patch: { quality: 75 }
  }, rules, Date.parse('2026-05-16T12:00:00.000Z'));
  assert(evolved.stage === 'legendary', `expected legendary stage, got ${evolved.stage}`);
  assert(evolved.evolution.variant === 'dewcap', `expected dewcap evolution, got ${evolved.evolution.variant}`);
  assert(core.getEvolutionTrait('dewcap', rules).favoriteAction === 'hydrate', 'expected dewcap trait metadata');
});

test('decoration purchase spends spores, records ownership, and boosts happiness', () => {
  const result = core.buyDecoration({
    stats: { happiness: 60 },
    inventory: { spores: 5 },
    coins: 5,
    decorations: { owned: [], active: [] }
  }, 'mossBell', {
    decorations: [
      { id: 'mossBell', label: 'Mchowy dzwonek', cost: 5, happinessBonus: 3 }
    ]
  }, Date.parse('2026-05-16T12:00:00.000Z'));

  assert(result.ok, `expected decoration purchase: ${result.reason}`);
  assert(result.state.inventory.spores === 0, 'expected spent spores');
  assert(result.state.coins === 0, 'expected coin label to mirror spores');
  assert(result.state.decorations.owned.includes('mossBell'), 'expected owned decoration');
  assert(result.state.decorations.active.includes('mossBell'), 'expected active decoration');
  assert(result.state.stats.happiness === 63, `expected happiness bonus, got ${result.state.stats.happiness}`);
});

test('state export and import preserve save shape while rejecting invalid files', () => {
  const envelope = core.buildStateExportEnvelope({
    version: 8,
    stats: { hydration: 70 },
    history: { actionsPerformed: { hydrate: 1 } }
  }, Date.parse('2026-05-16T12:00:00.000Z'));
  const imported = core.importStateEnvelope(JSON.stringify(envelope), 9);
  const rejected = core.importStateEnvelope(JSON.stringify({ nope: true }), 9);

  assert(imported.ok, `expected import success: ${imported.reason}`);
  assert(imported.state.version === 9, 'expected imported state migrated to v9');
  assert(imported.state.history.actionsPerformed.hydrate === 1, 'expected imported history');
  assert(imported.state.discoveries.environment, 'expected imported state to include environment discoveries');
  assert(!rejected.ok, 'expected invalid import rejection');
});

test('ambient life is strongest in warm clear summer daylight', () => {
  const summer = core.calculateAmbientLife({
    condition: 'clear',
    dayPhase: 'noon',
    latitude: 50.2649,
    cloudCover: 12,
    temperature: 24,
    humidity: 68,
    windSpeed: 5,
    windLevel: 0.06,
    flowerDensity: 3,
    precipitation: 0
  }, new Date(2026, 6, 8, 12, 0));
  const lateMay = core.calculateAmbientLife({
    condition: 'clear',
    dayPhase: 'noon',
    latitude: 50.2649,
    cloudCover: 18,
    temperature: 19,
    humidity: 62,
    windSpeed: 7,
    windLevel: 0.08,
    flowerDensity: 0.35,
    precipitation: 0
  }, new Date(2026, 4, 21, 12, 0));
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
  assert(summer.flowerIntensity > 0.7, `expected flowering meadow, got ${summer.flowerIntensity}`);
  assert(summer.beeIntensity > 0.65, `expected active summer bees, got ${summer.beeIntensity}`);
  assert(summer.butterflyIntensity > 0.7, `expected summer butterflies, got ${summer.butterflyIntensity}`);
  assert(lateMay.flowerIntensity > 0.2, `expected some late-May flowers, got ${lateMay.flowerIntensity}`);
  assert(lateMay.beeIntensity > 0.1 && lateMay.beeIntensity < 0.45, `expected sparse late-May bees, got ${lateMay.beeIntensity}`);
  assert(lateMay.butterflyIntensity > 0.18 && lateMay.butterflyIntensity < 0.45, `expected sparse late-May butterflies, got ${lateMay.butterflyIntensity}`);
  assert(winter.generalIntensity < 0.05, `expected quiet winter life, got ${winter.generalIntensity}`);
  assert(winter.flowerIntensity < 0.05, `expected winter flowers to be hidden, got ${winter.flowerIntensity}`);
});

test('butterflies are sparse outside warm calm sunny windows', () => {
  const warmSunny = core.calculateAmbientLife({
    condition: 'clear',
    dayPhase: 'noon',
    latitude: 50.2649,
    cloudCover: 10,
    temperature: 25,
    windSpeed: 5,
    windLevel: 0.06,
    flowerDensity: 3,
    precipitation: 0
  }, new Date(2026, 6, 12, 12, 0));
  const coolCloudy = core.calculateAmbientLife({
    condition: 'cloudy',
    dayPhase: 'noon',
    latitude: 50.2649,
    cloudCover: 72,
    temperature: 16,
    windSpeed: 5,
    windLevel: 0.06,
    flowerDensity: 3,
    precipitation: 0
  }, new Date(2026, 6, 12, 12, 0));
  const windy = core.calculateAmbientLife({
    condition: 'clear',
    dayPhase: 'noon',
    latitude: 50.2649,
    cloudCover: 10,
    temperature: 25,
    windSpeed: 28,
    windLevel: 0.34,
    gustLevel: 0.4,
    flowerDensity: 3,
    precipitation: 0
  }, new Date(2026, 6, 12, 12, 0));

  assert(warmSunny.butterflyIntensity > 0.7, `expected warm sunny butterfly window, got ${warmSunny.butterflyIntensity}`);
  assert(coolCloudy.butterflyIntensity < 0.08, `expected cool cloudy butterfly collapse, got ${coolCloudy.butterflyIntensity}`);
  assert(windy.butterflyIntensity < 0.18, `expected windy butterfly suppression, got ${windy.butterflyIntensity}`);
});

test('bees require flowers and calm daytime weather', () => {
  const warmFlowering = core.calculateAmbientLife({
    condition: 'clear',
    dayPhase: 'noon',
    latitude: 50.2649,
    cloudCover: 12,
    temperature: 24,
    windSpeed: 5,
    windLevel: 0.06,
    flowerDensity: 3,
    precipitation: 0
  }, new Date(2026, 6, 12, 12, 0));
  const noFlowers = core.calculateAmbientLife({
    condition: 'clear',
    dayPhase: 'noon',
    latitude: 50.2649,
    cloudCover: 12,
    temperature: 24,
    windSpeed: 5,
    windLevel: 0.06,
    flowerDensity: 0,
    precipitation: 0
  }, new Date(2026, 6, 12, 12, 0));
  const rain = core.calculateAmbientLife({
    condition: 'rain',
    dayPhase: 'noon',
    latitude: 50.2649,
    cloudCover: 82,
    temperature: 22,
    windSpeed: 5,
    windLevel: 0.06,
    flowerDensity: 3,
    precipitation: 1.2,
    rain: 1.2
  }, new Date(2026, 6, 12, 12, 0));
  const evening = core.calculateAmbientLife({
    condition: 'clear',
    dayPhase: 'night',
    latitude: 50.2649,
    cloudCover: 8,
    temperature: 22,
    windSpeed: 3,
    windLevel: 0.04,
    flowerDensity: 3,
    precipitation: 0
  }, new Date(2026, 6, 12, 22, 0));

  assert(warmFlowering.flowerIntensity > 0.75, `expected flowering habitat, got ${warmFlowering.flowerIntensity}`);
  assert(warmFlowering.beeIntensity > 0.65, `expected active bees near flowers, got ${warmFlowering.beeIntensity}`);
  assert(noFlowers.flowerIntensity === 0, `expected no visible flowers when habitat has none, got ${noFlowers.flowerIntensity}`);
  assert(noFlowers.beeIntensity === 0, `expected no bees without flowers, got ${noFlowers.beeIntensity}`);
  assert(rain.beeIntensity === 0, `expected no bees in rain, got ${rain.beeIntensity}`);
  assert(evening.beeIntensity === 0, `expected no night bees, got ${evening.beeIntensity}`);
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
  assert(profile.beeIntensity < 0.55, `expected unknown-temperature bees to stay conservative, got ${profile.beeIntensity}`);
  assert(profile.butterflyIntensity < 0.55, `expected unknown-temperature butterflies to stay conservative, got ${profile.butterflyIntensity}`);
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
  assert(storm.batIntensity === 0, `expected no storm bats, got ${storm.batIntensity}`);
  assert(snow.generalIntensity === 0, `expected no snow insects, got ${snow.generalIntensity}`);
  assert(snow.mothIntensity === 0, `expected no snow moths, got ${snow.mothIntensity}`);
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

test('warm calm nights add moths and bats without daytime bats', () => {
  const baseScene = {
    condition: 'clear',
    latitude: 50.2649,
    temperature: 22,
    humidity: 74,
    windLevel: 0.05,
    gustLevel: 0.05,
    precipitation: 0
  };
  const night = core.calculateAmbientLife(Object.assign({ dayPhase: 'night' }, baseScene), new Date(2026, 6, 12, 22, 30));
  const noon = core.calculateAmbientLife(Object.assign({ dayPhase: 'noon' }, baseScene), new Date(2026, 6, 12, 12, 0));

  assert(night.mothIntensity > 0.55, `expected active night moths, got ${night.mothIntensity}`);
  assert(night.batIntensity > 0.65, `expected active night bats, got ${night.batIntensity}`);
  assert(noon.mothIntensity === 0, `expected no noon moths, got ${noon.mothIntensity}`);
  assert(noon.batIntensity === 0, `expected no noon bats, got ${noon.batIntensity}`);
});

test('ambient sky recognizes Perseids on clear August nights', () => {
  const profile = core.calculateAmbientSkyEffects({
    condition: 'clear',
    isDay: false,
    dayPhase: 'night',
    latitude: 50.2649,
    longitude: 19.0238,
    cloudCover: 4,
    cloudCoverLow: 0,
    cloudCoverMid: 2,
    cloudCoverHigh: 8,
    cloudDensity: 0.04,
    precipitation: 0
  }, new Date(2026, 7, 12, 23, 30), Date.parse('2026-08-12T21:30:00.000Z'));

  assert(profile.starVisibility > 0.8, `expected visible stars, got ${profile.starVisibility}`);
  assert(profile.activeMeteorShower && profile.activeMeteorShower.id === 'perseids', 'expected Perseids shower');
});

test('ambient sky suppresses meteors and aurora in storm weather', () => {
  const profile = core.calculateAmbientSkyEffects({
    condition: 'storm',
    isDay: false,
    dayPhase: 'night',
    latitude: 69.6492,
    longitude: 18.9553,
    cloudCover: 95,
    cloudDensity: 0.95,
    precipitation: 8,
    rain: 8
  }, new Date(2026, 0, 12, 23, 30), Date.parse('2026-01-12T22:30:00.000Z'), { kp: 8, source: 'live' });

  assert(profile.starVisibility < 0.05, `expected hidden stars, got ${profile.starVisibility}`);
  assert(!profile.meteorEvent, 'expected no meteor in storm');
  assert(!profile.aurora.visible, 'expected aurora hidden in storm');
});

test('ambient sky uses live Kp for aurora eligibility', () => {
  const profile = core.calculateAmbientSkyEffects({
    condition: 'clear',
    isDay: false,
    dayPhase: 'night',
    latitude: 69.6492,
    longitude: 18.9553,
    cloudCover: 8,
    cloudDensity: 0.08,
    precipitation: 0
  }, new Date(2026, 0, 12, 23, 30), Date.parse('2026-01-12T22:30:00.000Z'), { kp: 5, source: 'live' });

  assert(profile.aurora.visible, 'expected live Kp aurora in Tromso');
  assert(profile.aurora.source === 'live', `expected live source, got ${profile.aurora.source}`);
});

test('ambient environment phenomena detect moisture, optics, light, and heat windows', () => {
  const dewDate = new Date(2026, 5, 21, 6, 10);
  const dew = core.calculateAmbientPhenomena({
    condition: 'clear',
    isDay: true,
    dayPhase: 'sunrise',
    dayTone: 'dawnGold',
    temperature: 9,
    humidity: 96,
    windLevel: 0.03,
    gustLevel: 0.02,
    precipitation: 0,
    surfaceWetnessTarget: 0.72,
    cloudCover: 8,
    cloudCoverLow: 4,
    cloudCoverHigh: 10
  }, dewDate, dewDate.getTime());
  assert(dew.dew.visible, `expected visible dew, got ${dew.dew.intensity}`);
  assert(dew.discoveries.includes('dew'), 'expected dew discovery');

  const frostDate = new Date(2026, 0, 18, 7, 10);
  const frost = core.calculateAmbientPhenomena({
    condition: 'clear',
    isDay: true,
    dayPhase: 'sunrise',
    temperature: -3,
    humidity: 93,
    windLevel: 0.04,
    precipitation: 0,
    surfaceWetnessTarget: 0.65,
    cloudCover: 10,
    cloudCoverLow: 4,
    cloudCoverHigh: 14
  }, frostDate, frostDate.getTime());
  assert(frost.frost.visible, `expected visible frost, got ${frost.frost.intensity}`);
  assert(!frost.dew.visible, `frost morning should not also read as strong dew, got ${frost.dew.intensity}`);

  const fogbowDate = new Date(2026, 9, 8, 7, 0);
  const fogbow = core.calculateAmbientPhenomena({
    condition: 'fog',
    isDay: true,
    dayPhase: 'sunrise',
    temperature: 7,
    humidity: 98,
    windLevel: 0.03,
    precipitation: 0,
    fogPotential: 0.95,
    cloudCover: 42,
    cloudCoverLow: 28,
    cloudCoverHigh: 32
  }, fogbowDate, fogbowDate.getTime());
  assert(fogbow.fogbow.visible, `expected visible fogbow, got ${fogbow.fogbow.intensity}`);

  const haloDate = new Date(2026, 10, 22, 23, 30);
  const halo = core.calculateAmbientPhenomena({
    condition: 'cloudy',
    isDay: false,
    dayPhase: 'night',
    precipitation: 0,
    cloudCover: 58,
    cloudCoverLow: 12,
    cloudCoverHigh: 84
  }, haloDate, haloDate.getTime());
  assert(halo.moonHalo.visible, `expected visible moon halo, got ${halo.moonHalo.intensity}`);

  const steamDate = new Date(2026, 8, 12, 9, 20);
  const steam = core.calculateAmbientPhenomena({
    condition: 'clear',
    isDay: true,
    dayPhase: 'morning',
    temperature: 23,
    humidity: 88,
    windLevel: 0.05,
    precipitation: 0,
    surfaceWetnessTarget: 0.96,
    rainbowRecentRainScore: 0.88,
    cloudCover: 24,
    cloudCoverLow: 12,
    cloudCoverHigh: 26
  }, steamDate, steamDate.getTime());
  assert(steam.steam.visible, `expected visible post-rain steam, got ${steam.steam.intensity}`);
  assert(steam.clearingAfterRain.visible, `expected visible clearing glints, got ${steam.clearingAfterRain.intensity}`);

  const heatDate = new Date(2026, 6, 20, 13, 30);
  const heat = core.calculateAmbientPhenomena({
    condition: 'clear',
    isDay: true,
    dayPhase: 'noon',
    temperature: 35,
    humidity: 28,
    windLevel: 0.04,
    precipitation: 0,
    surfaceWetnessTarget: 0.01,
    cloudCover: 8,
    cloudCoverLow: 4,
    cloudCoverHigh: 10
  }, heatDate, heatDate.getTime());
  assert(heat.heatHaze.visible, `expected visible heat haze, got ${heat.heatHaze.intensity}`);
});

test('ambient environment phenomena suppress delicate effects during heavy precipitation', () => {
  const stormDate = new Date(2026, 6, 20, 18, 30);
  const storm = core.calculateAmbientPhenomena({
    condition: 'storm',
    isDay: true,
    dayPhase: 'sunset',
    temperature: 25,
    humidity: 96,
    windLevel: 0.8,
    gustLevel: 0.9,
    precipitation: 6,
    rain: 6,
    fogPotential: 0.7,
    surfaceWetnessTarget: 1,
    rainbowRecentRainScore: 1,
    cloudCover: 100,
    cloudCoverLow: 98,
    cloudCoverHigh: 84
  }, stormDate, stormDate.getTime());

  assert(!storm.dew.visible, `expected storm dew suppression, got ${storm.dew.intensity}`);
  assert(!storm.fogbow.visible, `expected storm fogbow suppression, got ${storm.fogbow.intensity}`);
  assert(!storm.sunbeams.visible, `expected storm sunbeam suppression, got ${storm.sunbeams.intensity}`);
  assert(!storm.steam.visible, `expected storm steam suppression, got ${storm.steam.intensity}`);
  assert(storm.discoveries.length === 0, `expected no delicate storm discoveries, got ${storm.discoveries.join(',')}`);
});

test('sky discoveries normalize and record first sightings once', () => {
  const state = { discoveries: { sky: {} }, log: [] };
  const first = core.recordSkyDiscovery(state, 'aurora', Date.parse('2026-01-12T22:30:00.000Z'));
  const second = core.recordSkyDiscovery(state, 'aurora', Date.parse('2026-01-12T22:35:00.000Z'));

  assert(first.newlyDiscovered, 'expected first aurora discovery');
  assert(!second.newlyDiscovered, 'expected repeated aurora to be known');
  assert(state.discoveries.sky.aurora.count === 2, `expected aurora count 2, got ${state.discoveries.sky.aurora.count}`);
});

test('environment discoveries normalize and record first sightings once', () => {
  const state = { discoveries: { sky: {}, environment: {} }, log: [] };
  const first = core.recordEnvironmentDiscovery(state, 'dew', Date.parse('2026-06-21T04:20:00.000Z'));
  const second = core.recordEnvironmentDiscovery(state, 'dew', Date.parse('2026-06-21T04:25:00.000Z'));
  const unknown = core.recordEnvironmentDiscovery(state, 'impossibleThing', Date.parse('2026-06-21T04:30:00.000Z'));
  const normalized = core.normalizeDiscoveriesState({
    sky: { aurora: { firstSeenAt: '2026-01-12T22:30:00.000Z', count: 1 } },
    environment: {
      dew: { firstSeenAt: '2026-06-21T04:20:00.000Z', count: 2 },
      bogus: { firstSeenAt: '2026-06-21T04:20:00.000Z', count: 1 }
    }
  });

  assert(first.newlyDiscovered, 'expected first dew discovery');
  assert(!second.newlyDiscovered, 'expected repeated dew to be known');
  assert(!unknown.ok, 'unknown environment discovery should be rejected');
  assert(state.discoveries.environment.dew.count === 2, `expected dew count 2, got ${state.discoveries.environment.dew.count}`);
  assert(normalized.environment.dew.count === 2, 'expected normalized dew discovery');
  assert(!normalized.environment.bogus, 'expected unknown environment discovery to be dropped');
});

test('world journal combines sky, environment, and rare instrument discoveries with locked hints', () => {
  const state = getGameplayLoopTestState({
    discoveries: { sky: {}, environment: {}, instruments: {} },
    journal: { entries: [] }
  });
  core.recordSkyDiscovery(state, 'aurora', Date.parse('2026-01-12T22:30:00.000Z'));
  core.recordEnvironmentDiscovery(state, 'dew', Date.parse('2026-06-21T04:20:00.000Z'));
  core.recordInstrumentDiscovery(state, {
    id: 'adultCometHarp',
    discoveryId: 'rareInstrument_adult',
    label: 'Kometowa harfa',
    logLabel: 'kometowej harfie',
    stage: 'adult'
  }, Date.parse('2026-06-21T21:20:00.000Z'));
  const rareInstrumentAgain = core.recordInstrumentDiscovery(state, {
    id: 'adultCometHarp',
    discoveryId: 'rareInstrument_adult',
    label: 'Kometowa harfa',
    logLabel: 'kometowej harfie',
    stage: 'adult'
  }, Date.parse('2026-06-21T21:30:00.000Z'));
  const journal = core.getWorldJournal(state, getGameplayLoopTestRules());
  const sky = journal.groups.find((group) => group.id === 'sky');
  const environment = journal.groups.find((group) => group.id === 'environment');
  const instruments = journal.groups.find((group) => group.id === 'instrument');
  const aurora = sky.items.find((item) => item.id === 'aurora');
  const comet = sky.items.find((item) => item.id === 'comet');
  const dew = environment.items.find((item) => item.id === 'dew');
  const rare = instruments.items.find((item) => item.id === 'rareInstrument_adult');

  assert(journal.discoveredCount === 3, `expected three discoveries, got ${journal.discoveredCount}`);
  assert(rareInstrumentAgain.message.includes('kometowej harfie'), 'expected rare instrument log label to mention the played instrument');
  assert(aurora.discovered, 'expected aurora to be discovered');
  assert(dew.discovered, 'expected dew to be discovered');
  assert(rare.discovered, 'expected rare instrument to be discovered');
  assert(aurora.photoScene === 'aurora', `expected aurora photo scene, got ${aurora.photoScene}`);
  assert(aurora.reaction === 'awe', `expected aurora awe reaction, got ${aurora.reaction}`);
  assert(aurora.description.includes('Zielonkawe'), 'expected aurora to expose journal description');
  assert(aurora.scienceNote.includes('geomagnetyczna'), 'expected aurora to expose science note');
  assert(dew.photoScene === 'dew', `expected dew photo scene, got ${dew.photoScene}`);
  assert(dew.conditionNote.includes('Poranek'), 'expected dew to expose condition note');
  assert(rare.photoScene === 'instrument', `expected rare instrument photo scene, got ${rare.photoScene}`);
  assert(rare.reaction === 'proud', `expected rare instrument proud reaction, got ${rare.reaction}`);
  assert(comet && !comet.discovered && comet.hint, 'expected locked sky item to keep a hint');
  assert(state.journal.entries.length === 3, 'expected first sightings to create journal entries');
});

test('calendar events use local deterministic dates and checklist unlocks through owned decoration', () => {
  const rules = getGameplayLoopTestRules();
  const state = getGameplayLoopTestState({
    inventory: { spores: 40 },
    coins: 40,
    discoveries: { sky: {}, environment: {}, instruments: {}, calendar: {} },
    decorations: { owned: ['dewStone', 'mossBell', 'sporeLantern'], active: ['dewStone', 'mossBell', 'sporeLantern'] }
  });

  const teaEvents = core.getCalendarEventsForDate(new Date(2026, 4, 21, 9), state, rules);
  const tea = teaEvents.find((item) => item.id === 'teaDay');
  const bees = teaEvents.find((item) => item.id === 'worldBeeDay');
  const springBirds = core.getCalendarEventsForDate(new Date(2026, 4, 9, 9), state, rules)
    .find((item) => item.id === 'migratoryBirdDaySpring');

  assert(tea && tea.active, 'expected International Tea Day to be active on May 21');
  assert(bees && !bees.active, 'expected World Bee Day not to be active on May 21');
  assert(springBirds && springBirds.active, 'expected migratory bird day to match second Saturday in May 2026');

  const lockedChecklist = core.getCalendarChecklist(state, rules, new Date(2026, 4, 21, 9));
  assert(!lockedChecklist.unlocked, 'expected checklist to start locked');

  const purchase = core.buyDecoration(state, 'myceliumCalendar', rules, Date.parse('2026-05-21T09:00:00.000Z'));
  assert(purchase.ok, 'expected calendar decoration purchase');
  assert(purchase.state.decorations.owned.includes('myceliumCalendar'), 'expected owned calendar decoration');
  assert(!purchase.state.decorations.active.includes('myceliumCalendar'), 'calendar should unlock UI without occupying a visible decoration slot');
  assert(purchase.state.decorations.active.includes('dewStone'), 'calendar purchase should not evict visible decorations');
  assert(purchase.state.inventory.spores === 28, `expected spores to be spent, got ${purchase.state.inventory.spores}`);

  const unlockedChecklist = core.getCalendarChecklist(purchase.state, rules, new Date(2026, 4, 21, 9));
  assert(unlockedChecklist.unlocked, 'expected owned calendar to unlock checklist');
  assert(unlockedChecklist.events.length >= 12, 'expected calendar to list annual and seasonal events');
});

test('calendar discoveries record once per event and join the world journal', () => {
  const state = getGameplayLoopTestState({
    discoveries: { sky: {}, environment: {}, instruments: {}, calendar: {} },
    journal: { entries: [] }
  });
  const first = core.recordCalendarDiscovery(state, 'teaDay', new Date(2026, 4, 21, 9));
  const second = core.recordCalendarDiscovery(state, 'teaDay', new Date(2026, 4, 21, 12));
  const nextYear = core.recordCalendarDiscovery(state, 'teaDay', new Date(2027, 4, 21, 9));
  const unknown = core.recordCalendarDiscovery(state, 'fakeDay', new Date(2026, 4, 21, 9));
  const normalized = core.normalizeDiscoveriesState({
    calendar: {
      teaDay: { firstSeenAt: '2026-05-21T07:00:00.000Z', count: 2 },
      bogus: { firstSeenAt: '2026-05-21T07:00:00.000Z', count: 1 }
    }
  });
  const journal = core.getWorldJournal(state, getGameplayLoopTestRules());
  const calendar = journal.groups.find((group) => group.id === 'calendar');
  const tea = calendar.items.find((item) => item.id === 'teaDay');

  assert(first.newlyDiscovered, 'expected first calendar discovery');
  assert(!second.newlyDiscovered, 'expected repeated same-day calendar sighting to be known');
  assert(!nextYear.newlyDiscovered, 'expected next-year sighting to keep known discovery status');
  assert(!unknown.ok, 'unknown calendar discovery should be rejected');
  assert(state.discoveries.calendar.teaDay.count === 2, `expected tea day count 2 after next year, got ${state.discoveries.calendar.teaDay.count}`);
  assert(normalized.calendar.teaDay.count === 2, 'expected normalized calendar discovery');
  assert(!normalized.calendar.bogus, 'expected unknown calendar discovery to be dropped');
  assert(tea.discovered, 'expected tea day to be discoverable in journal');
  assert(tea.photoScene === 'teaDay', `expected tea polaroid scene, got ${tea.photoScene}`);
  assert(journal.discoveredCount === 1, `expected one calendar discovery, got ${journal.discoveredCount}`);
  assert(state.journal.entries.some((entry) => entry.type === 'calendar'), 'expected calendar journal entry');
});

test('return recap is generated once for long offline windows', () => {
  const now = Date.parse('2026-05-21T12:00:00.000Z');
  const from = now - 3 * 60 * 60 * 1000;
  const rules = getGameplayLoopTestRules();
  const state = getGameplayLoopTestState({
    lastUpdatedAt: new Date(from).toISOString(),
    stats: { hydration: 44, nutrients: 72, energy: 80, happiness: 70, cleanliness: 76, health: 90 },
    discoveries: { sky: { aurora: { id: 'aurora', label: 'Zorza polarna', firstSeenAt: new Date(from).toISOString(), lastSeenAt: new Date(from).toISOString(), count: 1 } }, environment: {} },
    returnRecap: { lastSeenAt: null, lastDigestAt: null, entries: [] }
  });
  const recap = core.getReturnRecap(state, rules, from, now, { appliedMs: now - from }, {});
  const ack = core.ackReturnRecap(state, recap, now);
  const repeated = core.getReturnRecap(ack.state, rules, from, now + 1000, { appliedMs: now - from }, {});

  assert(recap.entries.length === 1, 'expected one return recap entry');
  assert(recap.body.includes('Wilgoć'), 'expected recap to mention the lowest need');
  assert(ack.state.returnRecap.entries.length === 1, 'expected recap to be persisted');
  assert(ack.state.relationship.entries[0].tag === 'recap', 'expected recap to be visible in relationship history');
  assert(repeated.entries.length === 0, 'expected acked recap not to repeat');
});

function findAmbientCue(scene, start) {
  for (let step = 0; step < 80; step += 1) {
    const now = start + step * 13500 + 2200;
    const cue = core.calculateAmbientLifeFocusCue(scene, new Date(now), now);
    if (cue && cue.visible) {
      return { cue, now };
    }
  }

  return null;
}

function getGameplayLoopTestRules() {
  return {
    needDefinitions: {
      hydration: { category: 'physical', actionId: 'hydrate', title: 'Chce wilgoci', mildMessage: 'Mech robi się suchy.' },
      nutrients: { category: 'physical', actionId: 'feed', title: 'Głodne podłoże', mildMessage: 'Podłoże traci siłę.' },
      happiness: { category: 'mental', actionId: 'play', title: 'Nudzi się', mildMessage: 'Czeka na zabawę.' },
      cleanliness: { category: 'environment', actionId: 'clean', title: 'Bałagan', mildMessage: 'W mchu zbiera się bałagan.' },
      energy: { category: 'rest', actionId: 'sleepWake', title: 'Senność', mildMessage: 'Czas na odpoczynek.' },
      health: { category: 'physical', actionId: 'hydrate', title: 'Niedomaga', mildMessage: 'Wygląda słabiej.' }
    },
    evolution: {
      legendaryGrowth: 100,
      variants: {
        dewcap: 'Rosopieczarka',
        compostcap: 'Kompostopieczarka',
        songcap: 'Śpiewopieczarka',
        wildcap: 'Dzika Pieczarka',
        ghostcap: 'Mglista Pieczarka',
        royalcap: 'Królewska Pieczarka'
      },
      traits: {
        dewcap: { title: 'Rytm rosy', favoriteAction: 'hydrate', message: 'Rosopieczarka łapie spokojny rytm wilgoci.' }
      }
    },
    decorations: [
      { id: 'dewStone', label: 'Kamień rosy', cost: 6, happinessBonus: 2, tags: ['moisture', 'comfort'] },
      { id: 'mossBell', label: 'Mchowy dzwonek', cost: 10, happinessBonus: 3, tags: ['music', 'wind', 'comfort'] },
      { id: 'sporeLantern', label: 'Latarenka zarodników', cost: 16, happinessBonus: 4, tags: ['night', 'spores'] },
      { id: 'cloverPatch', label: 'Kępa koniczyny', cost: 5, happinessBonus: 1, tags: ['wild', 'flowers', 'insects'] },
      { id: 'fallenTwig', label: 'Próchniejąca gałązka', cost: 7, happinessBonus: 1, tags: ['shelter', 'insects', 'spores'] },
      { id: 'myceliumCalendar', label: 'Kalendarz grzybni', cost: 12, happinessBonus: 1, tags: ['calendar', 'comfort', 'spores'] }
    ],
    minigames: {
      dewCatch: { id: 'dewCatch', label: 'Łapanie rosy' },
      sporePop: { id: 'sporePop', label: 'Pękanie zarodników' },
      compostSort: { id: 'compostSort', label: 'Sortowanie kompostu' },
      rhythmHum: { id: 'rhythmHum', label: 'Rytmiczne nucenie' }
    },
    instrumentCatalog: {
      stages: {
        adult: [
          { id: 'adultKalimba', label: 'Mała kalimba', logLabel: 'małej kalimbie', activityType: 'instrument_bell' },
          { id: 'adultPocketSynth', label: 'Kieszonkowy syntezator', logLabel: 'kieszonkowym syntezatorze', activityType: 'instrument_flute' },
          { id: 'adultSporeChimes', label: 'Dzwonki zarodnikowe', logLabel: 'dzwonkach zarodnikowych', activityType: 'instrument_drum' },
          { id: 'adultCometHarp', label: 'Kometowa harfa', logLabel: 'kometowej harfie', activityType: 'instrument_rare', rare: true, discoveryId: 'rareInstrument_adult', hint: 'kometa i spokojny wieczór' }
        ]
      }
    }
  };
}

function getGameplayLoopTestState(overrides = {}) {
  return {
    version: 13,
    playerId: 'test-player',
    mushroomName: overrides.mushroomName || 'Testek',
    createdAt: overrides.createdAt || '2026-05-20T08:00:00.000Z',
    lastUpdatedAt: overrides.lastUpdatedAt || '2026-05-21T08:00:00.000Z',
    mode: 'awake',
    stage: overrides.stage || 'baby',
    stats: {
      hydration: 72,
      nutrients: 72,
      energy: 80,
      happiness: 70,
      cleanliness: 76,
      health: 90,
      growth: 18,
      ...(overrides.stats || {})
    },
    history: overrides.history || {
      actionsPerformed: {},
      modeMs: { awake: 0, sleeping: 0 },
      statSamples: { count: 0, hydration: 0, nutrients: 0, energy: 0, happiness: 0, cleanliness: 0, health: 0 },
      attention: { handled: 0, missed: 0 },
      dailyGrowth: { dateKey: null, earned: 0 },
      minigames: {}
    },
    patch: overrides.patch || { quality: 72, mycelium: 12, harvests: 0, careStreak: 0 },
    attention: overrides.attention || { activeNeed: null, severity: null, startedAt: null, deadlineAt: null },
    flags: overrides.flags || { nameConfirmed: true },
    careMistakes: overrides.careMistakes || { physical: 0, mental: 0, environment: 0, rest: 0 },
    evolution: overrides.evolution || { variant: null, decidedAt: null, reason: null },
    minigames: overrides.minigames || { active: null, lastResult: null },
    dailyPlan: overrides.dailyPlan || { dateKey: null, activeIds: [], completed: {} },
    dailyRhythm: overrides.dailyRhythm || { dateKey: null, selectedId: null, options: [] },
    relationship: overrides.relationship || { entries: [] },
    journal: overrides.journal || { entries: [] },
    decorations: overrides.decorations || { owned: [], active: [] },
    discoveries: overrides.discoveries || { sky: {}, environment: {}, instruments: {}, calendar: {} },
    returnRecap: overrides.returnRecap || { lastSeenAt: null, lastDigestAt: null, entries: [] },
    inventory: overrides.inventory || { spores: 12 },
    coins: overrides.coins ?? 12,
    cooldowns: overrides.cooldowns || {}
  };
}

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
        { id: 'myceliumFeint', staminaCost: 10, power: 10, accuracy: 1, stat: 'speed', statusEffect: { target: 'opponent', type: 'slow', turns: 2, value: 3 } },
        { id: 'focusBloom', staminaCost: 12, power: 18, accuracy: 1, stat: 'focus', selfEffect: { type: 'stamina', value: 4 } }
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

function getRecoveryTestRules() {
  return {
    recovery: {
      triggerHealth: 0,
      manualHealthThreshold: 45,
      durationMs: 6 * 60 * 60000,
      extensionMs: 2 * 60 * 60000,
      recentCareMs: 2.5 * 60 * 60000,
      maxMissedCare: 3,
      startHealth: 8,
      completeHealth: 28,
      extensionPenalty: {
        happiness: -3,
        patchQuality: -4
      },
      careMinimums: {
        hydration: 28,
        nutrients: 28,
        cleanliness: 28
      },
      careActionIds: ['hydrate', 'feed', 'clean', 'mossRest'],
      blockedActionIds: ['sleepWake', 'play', 'instrument', 'sing', 'spores']
    }
  };
}

function getLegendaryBattleState(overrides = {}) {
  const battle = core.normalizeBattleState(overrides.battle || {});
  return {
    stage: 'legendary',
    mushroomName: overrides.mushroomName || 'Testek',
    flags: overrides.flags || { nameConfirmed: true },
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
