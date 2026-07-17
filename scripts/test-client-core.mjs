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

test('Polish count formatter chooses singular, few, and many forms', () => {
  const spores = ['zarodnik', 'zarodniki', 'zarodników'];
  const drops = ['kropla', 'krople', 'kropli'];
  const pieces = ['kawałek', 'kawałki', 'kawałków'];
  const notes = ['nuta', 'nuty', 'nut'];
  const observations = ['obserwacja', 'obserwacje', 'obserwacji'];
  const days = ['dzień', 'dni', 'dni'];
  const trophies = ['trofeum', 'trofea', 'trofeów'];

  assert(core.formatPolishCount(1, spores) === '1 zarodnik', 'expected singular spore');
  assert(core.formatPolishCount(2, spores) === '2 zarodniki', 'expected few spores');
  assert(core.formatPolishCount(5, spores) === '5 zarodników', 'expected many spores');
  assert(core.formatPolishCount(12, drops) === '12 kropli', 'expected teen drop form');
  assert(core.formatPolishCount(22, pieces) === '22 kawałki', 'expected twenty-two piece form');
  assert(core.formatPolishCount(25, notes) === '25 nut', 'expected many note form');
  assert(core.formatPolishCount(0, observations) === '0 obserwacji', 'expected zero observation form');
  assert(core.formatPolishCount(1, days) === '1 dzień', 'expected singular day');
  assert(core.formatPolishCount(3, trophies) === '3 trofea', 'expected few trophies');
});

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

test('weather immersion exposes red rainbow only during low warm light', () => {
  const red = core.deriveWeatherImmersionFields({
    condition: 'rain',
    dayPhase: 'sunset',
    dayTone: 'duskGold',
    isDay: true,
    cloudCover: 36,
    cloudCoverLow: 14,
    cloudCoverMid: 24,
    cloudCoverHigh: 30,
    precipitation: 2.2,
    rain: 1.8,
    showers: 0.7,
    snowfall: 0,
    humidity: 90,
    visibility: 10200,
    windSpeed: 7
  }, [], null, Date.parse('2026-09-12T18:02:00.000Z'));
  const noon = core.deriveWeatherImmersionFields({
    condition: 'rain',
    dayPhase: 'noon',
    dayTone: 'neutral',
    isDay: true,
    cloudCover: 36,
    cloudCoverLow: 14,
    cloudCoverMid: 24,
    cloudCoverHigh: 30,
    precipitation: 2.2,
    rain: 1.8,
    showers: 0.7,
    snowfall: 0,
    humidity: 90,
    visibility: 10200,
    windSpeed: 7
  }, [], null, Date.parse('2026-09-12T12:02:00.000Z'));

  assert(red.rainbowRedShiftScore > 0.58, `expected strong red-shift score, got ${red.rainbowRedShiftScore}`);
  assert(red.rainbowVariant === 'red' || red.rainbowVariant === 'redDouble', `expected red rainbow variant, got ${red.rainbowVariant}`);
  assert(noon.rainbowRedShiftScore === 0, `expected noon red-shift suppression, got ${noon.rainbowRedShiftScore}`);
  assert(noon.rainbowVariant === 'primary' || noon.rainbowVariant === 'double', `expected noon regular rainbow, got ${noon.rainbowVariant}`);
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

test('future saves stay untouched and persistence refuses to downgrade them', () => {
  const future = {
    version: 18,
    saveRevision: 7,
    stats: { health: 93 },
    futureOnly: { nested: ['preserve-me'] }
  };
  const snapshot = JSON.stringify(future);
  const migrated = core.migrateStateVersion(future, 17);
  const prepared = core.prepareStatePersistenceWrite(future, future, 17, 'test-tab');

  assert(JSON.stringify(migrated) === snapshot, 'future migration must preserve every field');
  assert(!prepared.ok && prepared.reason === 'futureVersion', 'future save write should be blocked');
  assert(JSON.stringify(future) === snapshot, 'future source must remain byte-equivalent after checks');
});

test('v17 migration reconciles legacy coins, revisions, and invalid sessions', () => {
  const now = Date.parse('2026-05-17T12:00:00.000Z');
  const migrated = core.migrateStateVersion({
    version: 16,
    coins: 10,
    inventory: { spores: 0 },
    stats: { health: 80 },
    minigames: { active: { id: 'removedMinigame', score: 4 } },
    recovery: {
      active: true,
      until: 'not-a-date',
      lastCareAt: '2099-01-01T00:00:00.000Z'
    },
    discoveries: {
      instruments: {
        bell: { id: 'bell', label: 'Dzwonek', firstSeenAt: '1970-01-01T00:00:01.820Z' }
      }
    },
    journal: {
      entries: [{ id: 'legacy-clock', at: '1970-01-01T00:00:01.820Z', title: 'Odkrycie' }]
    }
  }, 17, { minigames: { dewCatch: { id: 'dewCatch' } } }, now);

  assert(migrated.version === 17, `expected v17, got ${migrated.version}`);
  assert(migrated.inventory.spores === 10 && migrated.coins === 10, 'legacy coins should migrate to canonical spores');
  assert(migrated.saveRevision === 0, 'legacy save should start at revision zero');
  assert(migrated.minigames.active === null, 'unknown minigame should be quarantined');
  assert(migrated.minigames.quarantined.id === 'removedMinigame', 'quarantine should retain the unknown id');
  assert(!migrated.recovery.active && migrated.recovery.reason === 'invalidTimestamp', 'invalid recovery should be safely deactivated');
  assert(migrated.recovery.lastCareAt === null, 'future care timestamp should be rejected');
  assert(Date.parse(migrated.discoveries.instruments.bell.firstSeenAt) === now, '1970 discovery timestamp should migrate to wall time');
  assert(Date.parse(migrated.journal.entries[0].at) === now, '1970 journal timestamp should migrate to wall time');
});

test('active recovery without a valid start timestamp is safely invalidated', () => {
  const now = Date.parse('2026-05-17T12:00:00.000Z');
  const migrated = core.migrateStateVersion({
    version: 16,
    stats: { health: 20 },
    recovery: {
      active: true,
      startedAt: null,
      until: new Date(now + 3600000).toISOString()
    }
  }, 17, getRecoveryTestRules(), now);

  assert(!migrated.recovery.active, 'recovery without startedAt must not become an unwinnable active recovery');
  assert(migrated.recovery.reason === 'invalidTimestamp', 'invalid recovery should retain a diagnostic reason');
});

test('persistence compare-before-write detects stale revisions and increments current writes', () => {
  const current = { version: 17, saveRevision: 4, stats: { health: 90 } };
  const stored = { version: 17, saveRevision: 5, stats: { health: 91 } };
  const conflict = core.prepareStatePersistenceWrite(current, stored, 17, 'tab-a');
  const prepared = core.prepareStatePersistenceWrite(stored, stored, 17, 'tab-b');

  assert(!conflict.ok && conflict.reason === 'conflict', 'stale write should be rejected');
  assert(conflict.storedRevision === 5, 'conflict should report the external revision');
  assert(prepared.ok && prepared.revision === 6, 'current write should increment revision');
  assert(prepared.state.saveWriterId === 'tab-b', 'write should identify its tab');
  assert(current.saveRevision === 4, 'prepare helper must not mutate the source');
});

test('persistence rejects equal revisions produced by different writers', () => {
  const source = { version: 17, saveRevision: 5, saveWriterId: 'tab-a', stats: { health: 80 } };
  const stored = { version: 17, saveRevision: 5, saveWriterId: 'tab-b', stats: { health: 90 } };
  const result = core.prepareStatePersistenceWrite(source, stored, 17, 'tab-a');

  assert(!result.ok && result.reason === 'conflict', 'same revision from another writer must be treated as a split-brain conflict');
});

test('v2 saves migrate to v17 progression history, discoveries, evolution, minigames, decorations, daily rhythm, journal, return recap, relationship, naming gate, calendar, long loop, legendary games, and journal snapshots', () => {
  const migrated = core.migrateStateVersion({
    version: 2,
    stage: 'adult',
    stats: { growth: 70 },
    history: { actionsPerformed: { hydrate: 2 } }
  }, 16);

  assert(migrated.version === 16, `expected version 16, got ${migrated.version}`);
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
  assert(migrated.longLoop && migrated.longLoop.mementos && migrated.longLoop.mastery, 'expected long-loop defaults');
  assert(migrated.longLoop.expeditions && migrated.longLoop.expeditions.active === null, 'expected empty expedition state');
  assert(migrated.legendaryGames && migrated.legendaryGames.daily && migrated.legendaryGames.trail, 'expected legendary game defaults');
  assert(migrated.legendaryGames.league && migrated.legendaryGames.garden, 'expected legendary league and garden defaults');
});

test('custom mushroom names survive migration as confirmed names', () => {
  const migrated = core.migrateStateVersion({
    version: 11,
    mushroomName: 'Borowik',
    flags: {}
  }, 16);

  assert(migrated.version === 16, `expected version 16, got ${migrated.version}`);
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

test('long-loop daily finale creates one memento after completing the care plan', () => {
  const now = Date.parse('2026-05-21T08:00:00.000Z');
  const rules = getGameplayLoopTestRules();
  const scene = { dayPhase: 'morning', humidity: 88, precipitation: 0, rain: 0, condition: 'clear' };
  const state = core.ensureDailyPlan(getGameplayLoopTestState({
    stats: { hydration: 82, nutrients: 78, energy: 80, happiness: 76, cleanliness: 80, health: 90, growth: 18 }
  }), rules, now, scene);
  const plan = core.getDailyCarePlan(state, rules, now, scene);
  state.dailyPlan.completed = plan.goals.reduce((result, goal) => {
    result[goal.id] = { at: new Date(now).toISOString(), title: goal.title };
    return result;
  }, {});

  const first = core.updateLongLoopProgress(state, { type: 'action', actionId: 'hydrate' }, rules, now + 1000, scene);
  const second = core.updateLongLoopProgress(first.state, { type: 'action', actionId: 'feed' }, rules, now + 2000, scene);

  assert(first.state.longLoop.dailyEpisode.completedAt, 'expected daily finale timestamp');
  assert(first.state.longLoop.mementos.owned['daily-2026-05-21'], 'expected daily finale memento');
  assert(first.state.longLoop.season.points === 4, `expected four season points, got ${first.state.longLoop.season.points}`);
  assert(second.state.longLoop.season.points === 4, 'daily finale should not reward twice');
});

test('long-loop habitat visitor can be greeted once per day and leaves a memento', () => {
  const now = Date.parse('2026-05-21T09:00:00.000Z');
  const rules = getGameplayLoopTestRules();
  const scene = { dayPhase: 'morning', condition: 'clear', isDay: true };
  const state = getGameplayLoopTestState({
    decorations: { owned: ['dewStone'], active: ['dewStone'] }
  });
  const dashboard = core.getLongLoopDashboard(state, rules, now, scene);
  const visitor = dashboard.visitor;
  const greeted = core.greetHabitatVisitor(state, visitor && visitor.id, rules, now, scene);
  const after = core.getLongLoopDashboard(greeted.state, rules, now + 1000, scene);

  assert(visitor && visitor.id === 'dewSnail', `expected dew snail visitor, got ${visitor && visitor.id}`);
  assert(greeted.ok, `expected visitor greeting to succeed: ${greeted.reason}`);
  assert(greeted.state.longLoop.visitors.seen.dewSnail.count === 1, 'expected visitor seen count');
  assert(greeted.state.longLoop.mementos.owned['memento-dew-snail'], 'expected visitor memento');
  assert(after.visitor && after.visitor.available === false, 'expected visitor to be unavailable after greeting today');
});

test('long-loop minigame mastery tracks perfect scores and practice badges', () => {
  const now = Date.parse('2026-05-21T10:00:00.000Z');
  const rules = getGameplayLoopTestRules();
  const state = getGameplayLoopTestState();
  const first = core.updateLongLoopProgress(state, { type: 'minigame', minigameId: 'dewCatch', score: 24 }, rules, now, {});
  const second = core.updateLongLoopProgress(first.state, { type: 'minigame', minigameId: 'dewCatch', score: 24 }, rules, now + 1000, {});

  const mastery = second.state.longLoop.mastery.minigames.dewCatch;
  assert(mastery.plays === 2, `expected two mastery plays, got ${mastery.plays}`);
  assert(mastery.perfects === 2, `expected two perfects, got ${mastery.perfects}`);
  assert(mastery.badges.includes('perfect'), 'expected perfect badge');
  assert(second.state.longLoop.mementos.owned['mastery-dewCatch-perfect'], 'expected minigame mastery memento');
});

test('long-loop spore expeditions spend spores, return rewards, and store keepsakes', () => {
  const now = Date.parse('2026-05-21T11:00:00.000Z');
  const rules = getGameplayLoopTestRules();
  const state = getGameplayLoopTestState({ inventory: { spores: 3, substrate: 0 }, coins: 3 });
  const started = core.startSporeExpedition(state, 'shortMossTrail', rules, now);
  const early = core.claimSporeExpedition(started.state, rules, now + 5 * 60000);
  const claimed = core.claimSporeExpedition(started.state, rules, now + 26 * 60000);

  assert(started.ok, `expected expedition start: ${started.reason}`);
  assert(started.state.inventory.spores === 2, `expected spent spore, got ${started.state.inventory.spores}`);
  assert(!early.ok, 'expected early expedition claim to be blocked');
  assert(claimed.ok, `expected expedition claim: ${claimed.reason}`);
  assert(claimed.state.longLoop.expeditions.active === null, 'expected active expedition to clear');
  assert(claimed.state.longLoop.expeditions.completed.length === 1, 'expected completed expedition history');
  assert(claimed.state.longLoop.mementos.owned['memento-moss-map'], 'expected expedition memento');
});

test('long-loop legendary projects finish at the legendary stage', () => {
  const now = Date.parse('2026-05-21T12:00:00.000Z');
  const rules = getGameplayLoopTestRules();
  const state = getGameplayLoopTestState({
    stage: 'legendary',
    stats: { growth: 120 },
    longLoop: {
      legendaryProjects: {
        progress: { dewGarden: { points: 17 } },
        completed: {}
      }
    }
  });
  const result = core.updateLongLoopProgress(state, { type: 'action', actionId: 'hydrate' }, rules, now, {});

  assert(result.state.longLoop.legendaryProjects.completed.dewGarden, 'expected legendary project completion');
  assert(result.state.longLoop.mementos.owned['memento-dew-garden'], 'expected legendary memento');
});

test('post-legendary games are locked before legendary and available after evolution', () => {
  const now = Date.parse('2026-05-21T13:00:00.000Z');
  const rules = getGameplayLoopTestRules();
  const locked = core.createMinigameSession('sporeTrail', rules, now, 111, getGameplayLoopTestState({
    stage: 'adult',
    stats: { growth: 70 }
  }), {});
  const opened = core.createMinigameSession('sporeTrail', rules, now, 111, getGameplayLoopTestState({
    stage: 'legendary',
    stats: { growth: 100 }
  }), {});
  const dashboard = core.getLegendaryGamesDashboard({
    stage: 'legendary',
    minigames: {},
    cooldowns: {},
    legendaryGames: {},
    longLoop: {}
  }, rules, now, {});

  assert(!locked.ok, 'expected legendary game to be locked before legendary stage');
  assert(opened.ok, `expected legendary game session: ${opened.reason}`);
  assert(opened.session.label === 'Szlak Zarodników', `unexpected legendary session label: ${opened.session.label}`);
  assert(dashboard.unlocked, 'expected legendary dashboard to unlock at legendary stage');
  assert(dashboard.games.length === 3, `expected three legendary games, got ${dashboard.games.length}`);
});

test('post-legendary game finish and long-loop rewards stay locked before legendary', () => {
  const now = Date.parse('2026-05-21T13:30:00.000Z');
  const rules = getGameplayLoopTestRules();
  const adultState = getGameplayLoopTestState({
    stage: 'adult',
    stats: { growth: 70 },
    minigames: {
      active: { id: 'sporeTrail', score: 18 },
      lastResult: null
    }
  });
  const finish = core.finishMinigame(adultState, {
    id: 'sporeTrail',
    score: 18,
    bestCombo: 4,
    mistakes: 0
  }, rules, now);
  const loop = core.updateLongLoopProgress(adultState, { type: 'minigame', minigameId: 'sporeTrail', score: 18 }, rules, now, {});

  assert(!finish.ok, 'expected forged legendary finish to stay locked before legendary');
  assert(!loop.state.longLoop.mementos.owned['memento-spore-trail-map'], 'adult legendary result should not award album memento');
  assert(!loop.state.legendaryGames.lastResult, 'adult legendary result should not record last result');
});

test('post-legendary game results update album, project progress, and daily cap', () => {
  const now = Date.parse('2026-05-21T14:00:00.000Z');
  const rules = getGameplayLoopTestRules();
  const state = getGameplayLoopTestState({
    stage: 'legendary',
    stats: { growth: 100 },
    longLoop: {
      legendaryProjects: {
        activeId: 'dewGarden',
        progress: { dewGarden: { points: 15 } },
        completed: {}
      }
    }
  });
  const updated = core.updateLongLoopProgress(state, { type: 'minigame', minigameId: 'sporeTrail', score: 18 }, rules, now, {});

  assert(updated.state.legendaryGames.trail.plays === 1, 'expected trail play count');
  assert(updated.state.legendaryGames.trail.bestScore === 18, 'expected trail best score');
  assert(updated.state.legendaryGames.daily.projectPointsEarned === 3, 'expected project points to count against daily cap');
  assert(updated.state.longLoop.legendaryProjects.completed.dewGarden, 'expected legendary project completion from trail');
  assert(updated.state.longLoop.mementos.owned['memento-spore-trail-map'], 'expected trail album memento');
});

test('post-legendary project progress is capped per day without blocking records', () => {
  const now = Date.parse('2026-05-21T15:00:00.000Z');
  const rules = getGameplayLoopTestRules();
  const state = getGameplayLoopTestState({
    stage: 'legendary',
    stats: { growth: 100 },
    legendaryGames: {
      daily: {
        dateKey: '2026-05-21',
        projectPointsEarned: 5,
        featuredIds: ['sporeTrail']
      }
    },
    longLoop: {
      legendaryProjects: {
        activeId: 'mossChoir',
        progress: { mossChoir: { points: 2 } },
        completed: {}
      }
    }
  });
  const updated = core.updateLongLoopProgress(state, { type: 'minigame', minigameId: 'memoryGarden', score: 15 }, rules, now, {});

  assert(updated.state.legendaryGames.garden.layouts['2026-05-21'] === 15, 'expected garden record despite daily cap');
  assert(updated.state.legendaryGames.daily.projectPointsEarned === 6, 'expected daily project cap to stop at six');
  assert(updated.state.longLoop.legendaryProjects.progress.mossChoir.points === 3, `expected one capped project point, got ${updated.state.longLoop.legendaryProjects.progress.mossChoir.points}`);
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

test('decoration habitat summary uses singular grammar for one decoration', () => {
  const rules = getGameplayLoopTestRules();
  const state = getGameplayLoopTestState({
    decorations: { owned: ['dewStone'], active: ['dewStone'] }
  });
  const habitat = core.getDecorationHabitatSummary(state, rules);

  assert(habitat.body === 'Kamień rosy zmienia nastrój grzybni.', `unexpected singular habitat body: ${habitat.body}`);
});

test('return recap uses Polish discovery and day labels', () => {
  const rules = getGameplayLoopTestRules();
  const from = Date.parse('2026-05-20T08:00:00.000Z');
  const to = Date.parse('2026-05-21T08:00:00.000Z');
  const state = getGameplayLoopTestState({
    lastUpdatedAt: new Date(from).toISOString(),
    discoveries: {
      sky: { comet: { id: 'comet', label: 'Kometa', firstSeenAt: new Date(from).toISOString(), lastSeenAt: new Date(from).toISOString(), count: 1 } },
      environment: {},
      instruments: {},
      calendar: {}
    }
  });
  const recap = core.getReturnRecap(state, rules, from, to, null, {});

  assert(recap.entries[0].title === 'Powrót (1 dzień)', `unexpected return entry title: ${recap.entries[0].title}`);
  assert(recap.body.includes('Dziennik pamięta już 1 odkrycie.'), `unexpected discovery count body: ${recap.body}`);
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

test('moss-bed recovery requires hydrate, feed, and clean during the current recovery', () => {
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

  let cared = {
    ...extended.state,
    stats: { ...extended.state.stats, hydration: 44, nutrients: 42, cleanliness: 41 }
  };
  ['hydrate', 'feed', 'clean'].forEach((actionId, index) => {
    const careAt = until + (index + 1) * 60_000;
    cared = core.recordRecoveryCare(cared, actionId, rules, careAt).state;
    cared = core.normalizeProgressionState(cared, rules, null, careAt);
  });
  const completed = core.updateRecoveryState(cared, rules, Date.parse(cared.recovery.until) + 1);

  assert(!completed.state.recovery.active, 'recovery should complete after all required care and stable needs');
  assert(completed.state.stats.health === 28, `expected completion health, got ${completed.state.stats.health}`);
  assert(completed.events[0].type === 'recoveryComplete', 'expected completion event');
});

test('moss rest alone does not satisfy required recovery care', () => {
  const now = Date.parse('2026-05-17T12:00:00.000Z');
  const rules = getRecoveryTestRules();
  const started = core.updateRecoveryState({
    mode: 'awake',
    stats: { health: 0, hydration: 50, nutrients: 50, cleanliness: 50, energy: 30, happiness: 50 },
    patch: { quality: 70, mycelium: 0, harvests: 0, careStreak: 0 },
    recovery: {}
  }, rules, now).state;
  const rested = core.recordRecoveryCare(started, 'mossRest', rules, now + 60_000).state;
  const result = core.updateRecoveryState(rested, rules, Date.parse(rested.recovery.until) + 1);

  assert(result.state.recovery.active, 'moss rest should not replace hydrate, feed, and clean');
  assert(result.events[0].type === 'recoveryExtended', 'missing required care should extend recovery');
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

  assert(started.minigames.active === null, 'recovery should stop an active minigame immediately');
  assert(started.battle.activeBattle === null, 'recovery should stop an active battle immediately');
  assert(!started.attention.activeNeed, 'recovery should clear active attention deadlines');

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

test('elapsed care reduction is invariant between one batch and minute ticks', () => {
  const rules = getElapsedReducerTestRules();
  const start = new Date(2026, 4, 16, 8, 0).getTime();
  const end = start + 24 * 3600000;
  const initial = getElapsedReducerTestState(start);
  const batched = core.reduceElapsedCareState(initial, rules, start, end).state;
  let ticked = initial;
  for (let cursor = start; cursor < end; cursor += 60000) {
    ticked = core.reduceElapsedCareState(ticked, rules, cursor, cursor + 60000).state;
  }

  ['hydration', 'nutrients', 'energy', 'happiness', 'cleanliness', 'health', 'growth'].forEach((stat) => {
    assert(
      Math.abs(batched.stats[stat] - ticked.stats[stat]) < 1e-7,
      `expected batch invariant ${stat}, got ${batched.stats[stat]} vs ${ticked.stats[stat]}`
    );
  });
  assert(batched.gameOver.active === ticked.gameOver.active, 'expected batch invariant game-over state');
  assert(batched.recovery.active === ticked.recovery.active, 'expected batch invariant recovery state');
  assert(batched.history.attention.missed === ticked.history.attention.missed, 'expected batch invariant attention history');
  assert(batched.history.dailyGrowth.dateKey === ticked.history.dailyGrowth.dateKey, 'expected midnight growth bucket parity');
  assert(Math.abs(batched.history.statSamples.weightedHealth - ticked.history.statSamples.weightedHealth) < 1e-4, 'expected weighted health parity');
  assert(batched.stats.health > 20, `one normal day should remain survivable, got health ${batched.stats.health}`);
});

test('elapsed care reduction applies current weather only within the global offline weather cap', () => {
  const rules = getElapsedReducerTestRules();
  rules.decayPerHour = {
    awake: {}, sleeping: {}, quietAwake: {}, quietSleeping: {}
  };
  rules.healthPerHour = { poorConditions: 0, goodConditions: 0 };
  rules.growthPerHour = { awakeHealthy: 0, sleepingHealthy: 0, quietDrowsyHealthy: 0 };
  rules.patchPerHour = { cleanHealthy: 0, neglected: 0 };
  rules.weatherBalance = {
    maxElapsedHours: 2,
    rainHydrationPerHour: 8,
    stormHydrationPerHour: 5,
    snowHydrationPerHour: 1.5,
    highHumidityHydrationPerHour: 0,
    windDryingPerHour: 0,
    heatDryingPerHour: 0
  };
  const end = new Date(2026, 4, 17, 8, 0).getTime();
  const initial = getElapsedReducerTestState(end - 24 * 3600000);
  initial.stats.hydration = 50;
  initial.stats.happiness = 100;
  const rain = { condition: 'rain', rain: 7, precipitation: 7, rainIntensity: 1, humidity: 60, windLevel: 0, temperature: 16 };
  const fullDay = core.reduceElapsedCareState(initial, rules, end - 24 * 3600000, end, { weatherScene: rain }).state;
  const twoHours = core.reduceElapsedCareState(initial, rules, end - 2 * 3600000, end, { weatherScene: rain }).state;

  assert(Math.abs(fullDay.stats.hydration - twoHours.stats.hydration) < 1e-7, `24h weather should equal capped 2h weather, got ${fullDay.stats.hydration} vs ${twoHours.stats.hydration}`);
});

test('small weather effects are identical for one batch and minute ticks', () => {
  const rules = getElapsedReducerTestRules();
  rules.decayPerHour = { awake: {}, sleeping: {}, quietAwake: {}, quietSleeping: {} };
  rules.healthPerHour = { poorConditions: 0, goodConditions: 0 };
  rules.growthPerHour = { awakeHealthy: 0, sleepingHealthy: 0, quietDrowsyHealthy: 0 };
  rules.patchPerHour = { cleanHealthy: 0, neglected: 0 };
  rules.weatherBalance = {
    maxElapsedHours: 2,
    rainHydrationPerHour: 0,
    stormHydrationPerHour: 0,
    snowHydrationPerHour: 0,
    highHumidityHydrationPerHour: 1.2,
    windDryingPerHour: 0,
    heatDryingPerHour: 0
  };
  const start = Date.parse('2026-05-17T08:00:00.000Z');
  const end = start + 3 * 3600000;
  const initial = getElapsedReducerTestState(start);
  Object.assign(initial.stats, {
    hydration: 50,
    nutrients: 100,
    energy: 100,
    happiness: 100,
    cleanliness: 100,
    health: 100
  });
  const scene = {
    updatedAt: '2026-05-17T08:00:00.000Z',
    condition: 'clear',
    humidity: 79.3,
    windLevel: 0,
    temperature: 18
  };
  const expectedDelta = ((scene.humidity - 78) / 22) * rules.weatherBalance.highHumidityHydrationPerHour * 2;
  const batched = core.reduceElapsedCareState(initial, rules, start, end, { weatherScene: scene }).state;
  let ticked = initial;
  for (let cursor = start; cursor < end; cursor += 60000) {
    ticked = core.reduceElapsedCareState(ticked, rules, cursor, cursor + 60000, { weatherScene: scene }).state;
  }

  assert(Math.abs((batched.stats.hydration - 50) - expectedDelta) < 1e-8, `expected precise low weather delta ${expectedDelta}, got ${batched.stats.hydration - 50}`);
  assert(Math.abs(batched.stats.hydration - ticked.stats.hydration) < 1e-8, `weather batch/tick mismatch: ${batched.stats.hydration} vs ${ticked.stats.hydration}`);
  assert(batched.weatherCare.appliedMs === 2 * 3600000, 'batch should consume only the configured weather budget');
  assert(ticked.weatherCare.appliedMs === 2 * 3600000, 'minute ticks should share the same weather budget');
});

test('24h elapsed reduction stays bounded for a history-heavy save', () => {
  const rules = getElapsedReducerTestRules();
  const start = new Date(2026, 4, 16, 8, 0).getTime();
  const initial = getElapsedReducerTestState(start);
  initial.relationship = {
    entries: Array.from({ length: 400 }, (_, index) => ({
      id: `entry-${index}`,
      at: new Date(start - index * 60000).toISOString(),
      title: `Wpis ${index}`,
      body: 'Historia spokojnej opieki nad grzybnią.'
    }))
  };
  initial.journal = { entries: initial.relationship.entries.slice() };
  const benchmarkStartedAt = Date.now();
  const result = core.reduceElapsedCareState(initial, rules, start, start + 24 * 3600000);
  const durationMs = Date.now() - benchmarkStartedAt;

  assert(durationMs < 2000, `24h reduction should stay below 2s, took ${durationMs}ms`);
  assert(result.events.length < 80, `protected/no-op events should not accumulate, got ${result.events.length}`);
});

test('recovery deadline started at night waits through quiet hours and morning grace', () => {
  const rules = Object.assign({}, getRecoveryTestRules(), {
    careRhythm: {
      quietStartMinute: 22 * 60 + 30,
      quietEndMinute: 7 * 60,
      morningGraceMs: 45 * 60000,
      offlineCapHours: 24
    }
  });
  const start = new Date(2026, 4, 16, 21, 0).getTime();
  const graceEnd = new Date(2026, 4, 17, 7, 45).getTime();
  const started = core.updateRecoveryState({
    mode: 'awake',
    stats: { health: 0, hydration: 50, nutrients: 50, cleanliness: 50, energy: 20, happiness: 50 },
    patch: { quality: 70, mycelium: 0, harvests: 0, careStreak: 0 },
    recovery: {}
  }, rules, start).state;

  assert(Date.parse(started.recovery.until) === graceEnd, `expected recovery deadline at morning grace end, got ${started.recovery.until}`);
  const protectedState = core.updateRecoveryState(started, rules, new Date(2026, 4, 17, 7, 30).getTime()).state;
  assert(protectedState.recovery.missedCare === 0, 'quiet recovery should not count a missed care window');
});

test('recovery deadline crossing into quiet hours is protected at the boundary', () => {
  const rules = Object.assign({}, getRecoveryTestRules(), {
    careRhythm: {
      quietStartMinute: 22 * 60 + 30,
      quietEndMinute: 7 * 60,
      morningGraceMs: 45 * 60000,
      offlineCapHours: 24
    }
  });
  const startedAt = new Date(2026, 4, 16, 18, 0).getTime();
  const oldDeadline = new Date(2026, 4, 16, 22, 29, 30).getTime();
  const boundary = new Date(2026, 4, 16, 22, 30).getTime();
  const graceEnd = new Date(2026, 4, 17, 7, 45).getTime();
  const result = core.updateRecoveryState({
    mode: 'sleeping',
    stats: { health: 8, hydration: 50, nutrients: 50, cleanliness: 50, energy: 30, happiness: 50 },
    patch: { quality: 70, mycelium: 0, harvests: 0, careStreak: 0 },
    recovery: {
      active: true,
      startedAt: new Date(startedAt).toISOString(),
      until: new Date(oldDeadline).toISOString(),
      missedCare: 0
    }
  }, rules, boundary);

  assert(Date.parse(result.state.recovery.until) === graceEnd, 'boundary should shift the recovery deadline through morning grace');
  assert(result.state.recovery.missedCare === 0, 'boundary protection must not count a missed recovery window');
  assert(result.events[0].type === 'recoveryProtected', 'expected explicit recovery protection event');
});

test('elapsed reduction stays batch invariant when recovery changes awake decay to sleep', () => {
  const rules = getElapsedReducerTestRules();
  const start = new Date(2026, 4, 16, 20, 0).getTime();
  const end = new Date(2026, 4, 17, 8, 0).getTime();
  const initial = getElapsedReducerTestState(start);
  Object.assign(initial.stats, {
    health: 0,
    hydration: 50,
    nutrients: 50,
    cleanliness: 50,
    happiness: 50,
    energy: 20
  });
  const batched = core.reduceElapsedCareState(initial, rules, start, end).state;
  let ticked = initial;
  for (let cursor = start; cursor < end; cursor += 60000) {
    ticked = core.reduceElapsedCareState(ticked, rules, cursor, cursor + 60000).state;
  }

  assert(batched.mode === 'sleeping' && ticked.mode === 'sleeping', 'recovery should switch both paths to sleeping');
  assert(batched.recovery.missedCare === ticked.recovery.missedCare, 'recovery misses should be batch invariant');
  ['hydration', 'nutrients', 'energy', 'health'].forEach((stat) => {
    assert(Math.abs(batched.stats[stat] - ticked.stats[stat]) < 1e-7, `recovery ${stat} should match batch and ticks`);
  });
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

test('interactive world gestures select pester, brush, and ambient reactions with target cooldowns', () => {
  const now = 1_320_000;
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

  const pester = core.selectImmersionReaction(state, scene, {
    inside: true,
    x: 262,
    y: 266,
    previousX: 262,
    previousY: 266,
    lastMoveAt: now - 70,
    lastDownAt: now - 90,
    consumedDownAt: 0,
    lastDownTargetKind: 'mushroomBody',
    lastTapTarget: 'mushroom:body',
    lastTapAt: now - 60,
    clickStreak: 3,
    speed: 0.1,
    targetCooldowns: {}
  }, now, rules);
  assert(pester && pester.id === 'pointerPester', `expected pester reaction, got ${pester && pester.id}`);
  assert(pester.targetId === 'mushroom' && pester.consumeDown, 'expected pester to target mushroom and consume tap');

  const brush = core.selectImmersionReaction(state, scene, {
    inside: true,
    x: 300,
    y: 426,
    previousX: 250,
    previousY: 424,
    lastMoveAt: now - 40,
    grassBrushLastAt: now - 35,
    grassBrushDistance: 88,
    speed: 0.9,
    targetCooldowns: {}
  }, now, rules);
  assert(brush && brush.id === 'pointerGrassBrush', `expected grass brush reaction, got ${brush && brush.id}`);
  assert(brush.targetId === 'grass' && brush.brushDistance === 88, 'expected brush target and distance metadata');

  const blockedBrush = core.selectImmersionReaction(state, scene, {
    inside: true,
    x: 300,
    y: 426,
    previousX: 250,
    previousY: 424,
    lastMoveAt: now - 40,
    grassBrushLastAt: now - 35,
    grassBrushDistance: 88,
    speed: 0.9,
    targetCooldowns: { grass: now + 1000 }
  }, now, rules);
  assert(!blockedBrush || blockedBrush.id !== 'pointerGrassBrush', 'grass cooldown should block only the brush reaction');

  const mushroomTap = core.selectImmersionReaction(state, scene, {
    inside: true,
    x: 260,
    y: 268,
    lastMoveAt: now - 80,
    lastDownAt: now - 120,
    consumedDownAt: 0,
    speed: 0.2,
    targetCooldowns: { grass: now + 1000 }
  }, now, rules);
  assert(mushroomTap && mushroomTap.id === 'pointerTap', `grass cooldown should not block mushroom tap, got ${mushroomTap && mushroomTap.id}`);

  const butterfly = core.selectImmersionReaction(state, scene, {
    inside: true,
    x: 188,
    y: 210,
    lastMoveAt: now - 80,
    lastDownAt: now - 90,
    consumedDownAt: 0,
    lastDownTargetKind: 'butterfly',
    speed: 0.1,
    targetCooldowns: {}
  }, now, rules);
  assert(butterfly && butterfly.id === 'pointerScareButterfly', `expected butterfly scare reaction, got ${butterfly && butterfly.id}`);
  assert(butterfly.state === 'watch_butterfly', `expected butterfly watch state, got ${butterfly && butterfly.state}`);
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

  for (let step = 0; step < 180; step += 1) {
    reaction = core.selectImmersionReaction(state, quietScene, { inside: false }, start + step * 1000, rules);
    if (reaction && reaction.source === 'idle') {
      break;
    }
  }

  assert(reaction && reaction.source === 'idle', 'expected deterministic idle motion in quiet scene');
  assert([
    'idle_fidget',
    'idle_fidget_sway',
    'idle_fidget_shift',
    'idle_look_left',
    'idle_look_right',
    'ponder',
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
  for (let step = 0; step < 180; step += 1) {
    const now = start + step * 1000;
    const candidate = core.selectImmersionReaction(state, quietScene, { inside: false }, now, rules);
    if (!candidate || candidate.source !== 'idle') {
      continue;
    }
    const repeated = core.selectImmersionReaction(state, quietScene, {
      inside: false,
      lastVariantByGroup: {
        [candidate.variantGroup]: candidate.state
      }
    }, now, rules);
    if (repeated && repeated.source === 'idle') {
      assert(repeated.state !== candidate.state, `expected different variant than ${candidate.state}, got ${repeated && repeated.state}`);
      return;
    }
  }

  assert(false, 'expected an idle variant with repeat-avoidance coverage');
});

test('quiet idle reactions happen often enough to keep the mushroom alive', () => {
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
  const reactions = [];
  for (let step = 0; step < 420; step += 1) {
    const candidate = core.selectImmersionReaction(state, quietScene, { inside: false }, start + step * 1000, rules);
    if (candidate && candidate.source === 'idle') {
      reactions.push(candidate.state);
    }
  }

  assert(reactions.length >= 30, `expected regular idle life over seven minutes, got ${reactions.length}`);
  assert(new Set(reactions).size >= 4, `expected varied idle life states, got ${reactions.join(', ')}`);
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
  assert(trained.state.battle.log[0].text === 'Trening: siła +1.', `expected Polish stat label, got ${trained.state.battle.log[0].text}`);
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
  assert(started.state.battle.activeBattle.player.visualId === 'playerLegendary', 'player should use the body-only legendary arena sheet');
  assert(started.state.battle.activeBattle.opponent.visualId === 'sproutling', 'first opponent should keep its configured visual identity');
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
  const now = Date.parse('2026-05-13T12:00:00.000Z');
  const activeBattle = core.startBattle(base, rules, now, 555).state.battle.activeBattle;
  const careStats = JSON.stringify(base.stats);
  const victory = core.applyBattleOutcomeRewards({
    ...base,
    battle: {
      ...base.battle,
      mode: 'victory',
      activeBattle: { ...activeBattle, mode: 'victory', rewarded: false }
    }
  }, rules, now);

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
      activeBattle: { ...activeBattle, mode: 'defeat', rewarded: false }
    }
  }, rules, now);
  assert(defeat.ok, 'expected defeat accounting');
  assert(defeat.state.battle.rewards.losses === 1, 'expected loss increment');
  assert(defeat.state.inventory.spores === 0, 'defeat should not grant spores');
  assert(JSON.stringify(defeat.state.stats) === careStats, 'defeat should not change care stats');

  const nextBattle = core.startBattle(victory.state, rules, now + 1, 556);
  assert(nextBattle.ok, 'a rewarded terminal battle should not block the next fight');
  assert(nextBattle.state.battle.activeBattle.id !== activeBattle.id, 'the next fight should get a fresh session');
  assert(nextBattle.state.battle.rewards.wins === 1, 'starting another fight must preserve the previous result');

  const trainableDefeat = {
    ...defeat.state,
    inventory: { ...defeat.state.inventory, spores: 5 },
    coins: 5
  };
  const trained = core.trainBattleStat(trainableDefeat, 'strength', rules, now + 2);
  assert(trained.ok, 'a rewarded terminal battle should not block later training');
  assert(trained.state.battle.activeBattle === null, 'training should archive the completed fight');

  const unrewardedTerminal = {
    ...base,
    battle: {
      ...base.battle,
      mode: 'victory',
      activeBattle: { ...activeBattle, mode: 'victory', rewarded: false }
    }
  };
  const recoveredStart = core.startBattle(unrewardedTerminal, rules, now + 3, 557);
  assert(recoveredStart.ok, 'a terminal fight restored before reward persistence should recover on next start');
  assert(recoveredStart.state.battle.rewards.wins === 1, 'recovered terminal reward should be granted exactly once');
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
  assert(normalized.activeBattle.player.visualId === 'playerLegendary', 'player visual identity should survive normalization');
  assert(normalized.activeBattle.opponent.visualId === 'sproutling', 'opponent visual identity should survive normalization');

  const legacyOpponent = JSON.parse(JSON.stringify(activeBattle));
  delete legacyOpponent.opponent.visualId;
  legacyOpponent.opponent.name = 'Wiatrokapelusz';
  const migrated = core.normalizeBattleState({ mode: 'choosingMove', activeBattle: legacyOpponent });
  assert(migrated.activeBattle.opponent.visualId === 'windcap', 'legacy opponent names should migrate to a stable visualId');
});

test('v18 migration preserves a v17 active battle and adds stable visual identities', () => {
  const now = Date.parse('2026-07-11T10:00:00.000Z');
  const rules = getBattleTestRules();
  const activeBattle = core.startBattle(getLegendaryBattleState(), rules, now, 88).state.battle.activeBattle;
  delete activeBattle.player.visualId;
  delete activeBattle.opponent.visualId;
  activeBattle.opponent.name = 'Wiatrokapelusz';

  const migrated = core.migrateStateVersion({
    version: 17,
    stage: 'legendary',
    stats: { health: 90 },
    inventory: { spores: 3 },
    battle: {
      mode: 'choosingMove',
      activeBattle: activeBattle,
      rewards: { wins: 2, losses: 1, trophies: 2 }
    }
  }, 18, rules, now);

  assert(migrated.version === 18, `expected state v18, got ${migrated.version}`);
  assert(migrated.battle.activeBattle.player.visualId === 'playerLegendary', 'v18 should restore the player visualId');
  assert(migrated.battle.activeBattle.opponent.visualId === 'windcap', 'v18 should infer the legacy opponent visualId');
  assert(migrated.inventory.spores === 3 && migrated.battle.rewards.wins === 2, 'v18 migration must preserve unrelated progress');
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
        masteryTarget: 26,
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
  Object.assign(session, { inputCount: 11, resolvedCount: 11, correctCount: 11, decisionCount: 18 });
  const result = core.finishMinigame({
    stats: { hydration: 50, happiness: 50 },
    inventory: { spores: 0 },
    history: {},
    minigames: { active: session }
  }, session, rules, now + 20000);

  assert(result.ok, 'expected minigame finish success');
  assert(result.state.stats.hydration === 68, `expected hydration capped reward, got ${result.state.stats.hydration}`);
  assert(result.state.stats.happiness === 56, `expected happiness capped reward, got ${result.state.stats.happiness}`);
  assert(result.state.inventory.spores === 1, 'expected score-based spore reward');
  assert(result.state.history.minigames.dewCatch.plays === 1, 'expected minigame play history');
  assert(result.state.history.minigames.dewCatch.bestScore === 20, 'expected best score history');
  assert(result.state.minigames.lastResult.targetScore === 26, 'expected configured mastery target in last result');
  assert(result.state.minigames.lastResult.tier === 'near', `expected near tier, got ${result.state.minigames.lastResult.tier}`);
  assert(result.state.minigames.lastResult.newBest, 'expected first scored run to become a new best');
  assert(result.state.legendaryGames.daily.dateKey === '2026-05-16', 'minigame normalization should use the supplied gameplay clock');
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
  Object.assign(session, { inputCount: 20, resolvedCount: 20, correctCount: 20, decisionCount: 20 });
  const result = core.finishMinigame({
    stats: { hydration: 50, happiness: 50 },
    inventory: { spores: 1 },
    coins: 1,
    history: {},
    minigames: { active: session }
  }, session, rules, now + 18000);

  assert(result.ok, 'expected spore pop finish success');
  assert(result.state.stats.hydration === 50, `expected unchanged hydration, got ${result.state.stats.hydration}`);
  assert(result.state.stats.happiness === 64, `expected capped happiness reward, got ${result.state.stats.happiness}`);
  assert(result.state.inventory.spores === 5, `expected capped spore reward, got ${result.state.inventory.spores}`);
  assert(result.state.history.minigames.sporePop.plays === 1, 'expected spore pop history');
  assert(result.state.minigames.lastResult.id === 'sporePop', 'expected spore pop last result');
});

test('terminal and stale minigame sessions cannot grant core rewards', () => {
  const rules = {
    minigames: {
      dewCatch: {
        id: 'dewCatch',
        label: 'Łapanie rosy',
        durationMs: 20000,
        rewards: { hydrationBase: 4, hydrationPerCatch: 2, hydrationMax: 18 }
      }
    }
  };
  const now = Date.parse('2026-05-16T12:00:00.000Z');
  const session = core.createMinigameSession('dewCatch', rules, now, 123).session;
  session.runtimeToken = 'session-current';
  session.score = 20;
  const base = {
    stats: { hydration: 50, happiness: 50 },
    inventory: { spores: 0 },
    history: {},
    minigames: { active: { ...session } }
  };
  const terminal = core.finishMinigame({
    ...base,
    gameOver: { active: true, reason: 'recoveryNeglected' }
  }, session, rules, now + 20000);
  const stale = core.finishMinigame(base, {
    ...session,
    runtimeToken: 'session-stale'
  }, rules, now + 20000);

  assert(!terminal.ok && terminal.state.stats.hydration === 50, 'game over must reject rewards without changing care stats');
  assert(!terminal.state.history.minigames.dewCatch, 'terminal session must not record a play');
  assert(!stale.ok && stale.state.stats.hydration === 50, 'stale token must not grant rewards');
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
  Object.assign(compostSession, { inputCount: 18, resolvedCount: 18, correctCount: 18, decisionCount: 18 });
  const compost = core.finishMinigame({
    stats: { nutrients: 50, cleanliness: 60, happiness: 50 },
    inventory: { spores: 0, substrate: 0 },
    history: {},
    minigames: { active: compostSession }
  }, compostSession, rules, now + 22000);

  const rhythmSession = core.createMinigameSession('rhythmHum', rules, now, 790).session;
  rhythmSession.score = 10;
  Object.assign(rhythmSession, { inputCount: 4, resolvedCount: 4, correctCount: 4, decisionCount: 8 });
  const rhythm = core.finishMinigame({
    stats: { happiness: 50, energy: 60 },
    inventory: { spores: 0 },
    history: {},
    minigames: { active: rhythmSession }
  }, rhythmSession, rules, now + 18000);

  assert(compost.ok, 'expected compost sort finish success');
  assert(compost.state.stats.nutrients === 62, `expected capped nutrients, got ${compost.state.stats.nutrients}`);
  assert(compost.state.stats.cleanliness === 65, `expected capped cleanliness, got ${compost.state.stats.cleanliness}`);
  assert(compost.state.inventory.substrate === 1, `expected substrate reward, got ${compost.state.inventory.substrate}`);
  assert(rhythm.ok, 'expected rhythm hum finish success');
  assert(rhythm.state.stats.happiness === 62, `expected capped rhythm happiness, got ${rhythm.state.stats.happiness}`);
  assert(rhythm.state.stats.energy === 62.5, `expected small rhythm energy reward, got ${rhythm.state.stats.energy}`);
});

test('minigame abort and practice clear the session without persistent rewards or history', () => {
  const rules = {
    minigames: {
      dewCatch: {
        id: 'dewCatch',
        label: 'Łapanie rosy',
        durationMs: 20000,
        dropCount: 4,
        scoreTargetCasual: 2,
        masteryTarget: 4,
        rewards: { hydrationBase: 4, hydrationPerCatch: 2, hydrationMax: 14 }
      }
    }
  };
  const now = Date.parse('2026-07-13T12:00:00.000Z');
  const reward = core.createMinigameSession('dewCatch', rules, now, 101, {}, null, { mode: 'reward' }).session;
  Object.assign(reward, { score: 4, inputCount: 4, resolvedCount: 4, correctCount: 4, decisionCount: 4, seedCeiling: 4 });
  const base = {
    stats: { hydration: 50 },
    inventory: { spores: 0 },
    history: {},
    minigames: { active: reward, lastResult: { id: 'older', score: 2 }, pendingRewardSeeds: { dewCatch: 101 } }
  };
  const aborted = core.finishMinigame(base, reward, rules, now + 5000, { reason: 'abort' });
  assert(aborted.ok && aborted.aborted && !aborted.settledReward, 'abort should be a successful non-settling close');
  assert(aborted.state.stats.hydration === 50, 'abort must not change care stats');
  assert(!aborted.state.history.minigames.dewCatch, 'abort must not record history');
  assert(aborted.state.minigames.lastResult.id === 'older', 'abort must preserve the previous persistent result');

  const practice = core.createMinigameSession('dewCatch', rules, now + 10000, 202, {}, null, { mode: 'practice' }).session;
  Object.assign(practice, { score: 4, inputCount: 4, resolvedCount: 4, correctCount: 4, decisionCount: 4, seedCeiling: 4 });
  const practiced = core.finishMinigame({
    stats: { hydration: 50 },
    inventory: { spores: 0 },
    history: {},
    minigames: { active: practice, lastResult: null, pendingRewardSeeds: {} }
  }, practice, rules, now + 15000, { reason: 'complete' });
  assert(practiced.ok && practiced.practice && !practiced.settledReward, 'practice should return an ephemeral outcome');
  assert(practiced.outcome.tier === 'perfect', 'practice should still give useful skill feedback');
  assert(practiced.state.stats.hydration === 50 && !practiced.state.history.minigames.dewCatch, 'practice must not persist economy or records');
});

test('untouched auto-resolved timeout grants nothing while fair tiers use coverage and accuracy', () => {
  const rules = {
    minigames: {
      compostSort: {
        id: 'compostSort',
        durationMs: 22000,
        pieceCount: 18,
        scoreTargetCasual: 14,
        masteryTarget: 23,
        perfectTarget: 27,
        rewards: { nutrientsBase: 2, nutrientsPerPoint: 1.2, nutrientsMax: 12 }
      }
    }
  };
  const now = Date.parse('2026-07-13T13:00:00.000Z');
  const empty = core.createMinigameSession('compostSort', rules, now, 303).session;
  Object.assign(empty, {
    score: 7,
    resolvedCount: 18,
    correctCount: 7,
    expiredCount: 11,
    decisionCount: 18,
    inputCount: 0
  });
  const emptyResult = core.finishMinigame({
    stats: { nutrients: 50 },
    inventory: { spores: 0 },
    history: {},
    minigames: { active: empty, lastResult: null, pendingRewardSeeds: {} }
  }, empty, rules, now + 22000, { reason: 'timeout' });
  assert(emptyResult.ok && !emptyResult.settledReward, 'an untouched auto-resolved timeout must not consume a reward run');
  assert(emptyResult.outcome.score === 7 && emptyResult.outcome.resolvedCount === 18, 'automatic score and expiries should remain available as round feedback');
  assert(emptyResult.state.stats.nutrients === 50 && !emptyResult.state.history.minigames.compostSort, 'untouched auto-resolved timeout must grant nothing');

  const flawless = core.createMinigameSession('compostSort', rules, now + 30000, 304).session;
  Object.assign(flawless, {
    score: 18,
    inputCount: 18,
    resolvedCount: 18,
    correctCount: 18,
    expiredCount: 0,
    decisionCount: 18,
    seedCeiling: 22,
    mistakes: 0
  });
  assert(core.getMinigameResultTier(flawless, rules.minigames.compostSort) === 'perfect', 'flawless coverage must not depend on rare-item luck');

  const leafAvoidance = {
    id: 'dewCatch',
    score: 3,
    caught: ['drop_0', 'drop_1'],
    missed: ['leaf_2'],
    inputCount: 2,
    resolvedCount: 3,
    correctCount: 3,
    expiredCount: 0,
    decisionCount: 3,
    seedCeiling: 3,
    mistakes: 0
  };
  const leafMetrics = core.getMinigameOutcomeMetrics(leafAvoidance, { id: 'dewCatch', dropCount: 3 });
  assert(leafMetrics.expiredCount === 0, 'correctly avoided hazards must not be reported as expired targets');
  const strayMetrics = core.getMinigameOutcomeMetrics(Object.assign({}, leafAvoidance, { mistakes: 1 }), { id: 'dewCatch', dropCount: 3 });
  assert(strayMetrics.accuracy === 0.75, 'a stray failed action must lower reported accuracy even when every target resolves');
});

test('v20 migration quarantines legacy active minigames and separates league records', () => {
  const now = Date.parse('2026-07-13T14:00:00.000Z');
  const rules = { minigames: { dewCatch: { id: 'dewCatch', durationMs: 20000 } } };
  const migrated = core.migrateStateVersion({
    version: 18,
    stats: {},
    inventory: {},
    history: { minigames: { myceliumLeague: { bestScore: 31 } } },
    minigames: { active: { id: 'dewCatch', startedAt: now, until: now + 20000, score: 5 } },
    legendaryGames: { league: { streak: 3, bestStreak: 28 } }
  }, 20, rules, now);
  assert(migrated.version === 20, 'migration should reach state version 20');
  assert(migrated.minigames.active === null && migrated.minigames.quarantined.reason === 'legacyMinigameSession', 'legacy active results must not be payable after migration');
  assert(migrated.preferences.minigames.audioEnabled && !migrated.preferences.minigames.hapticsEnabled, 'new minigame preferences need safe defaults');
  assert(migrated.legendaryGames.league.bestScore >= 31, 'league score should survive the split from streak');
  assert(migrated.legendaryGames.league.bestWinStreak >= 3, 'current valid streak should seed best win streak');

  const hiddenAt = now - 31000;
  const normalized = core.normalizeProgressionState({
    version: 20,
    minigames: {
      active: {
        id: 'dewCatch',
        seed: 404,
        startedAt: now - 5000,
        until: now + 15000,
        hiddenAt: hiddenAt,
        caught: [],
        missed: []
      }
    }
  }, rules, null, now);
  assert(normalized.minigames.active.hiddenAt === hiddenAt, 'normalization must preserve hiddenAt for reload abort policy');
});

test('rhythm input judgment explains timing and lane mistakes', () => {
  const windows = { perfect: 90, good: 155, ok: 235, miss: 360 };
  const perfect = core.judgeRhythmInput('left', 'left', 12, windows, 0);
  const goodEarly = core.judgeRhythmInput('left', 'left', -120, windows, 0);
  const okLate = core.judgeRhythmInput('left', 'left', 220, windows, 0);
  const tooEarly = core.judgeRhythmInput('left', 'left', -300, windows, 0);
  const tooLate = core.judgeRhythmInput('left', 'left', 410, windows, 0);
  const wrongLane = core.judgeRhythmInput('left', 'right', 10, windows, 0);

  assert(perfect.judgment === 'perfect' && perfect.points === 3, 'expected perfect timing');
  assert(goodEarly.judgment === 'good' && goodEarly.timing === 'slightlyEarly', 'expected early good timing');
  assert(okLate.judgment === 'ok' && okLate.timing === 'lateOk', 'expected late ok timing');
  assert(tooEarly.judgment === 'miss' && tooEarly.timing === 'early', 'expected early miss');
  assert(tooLate.judgment === 'miss' && tooLate.timing === 'late', 'expected late miss');
  assert(wrongLane.judgment === 'bad' && wrongLane.timing === 'wrongLane', 'expected wrong lane feedback');
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

test('evolution health averages are time-weighted instead of tick-count weighted', () => {
  const base = {
    mode: 'awake',
    stats: { hydration: 60, nutrients: 60, energy: 60, happiness: 70, cleanliness: 60, health: 0 },
    history: {},
    careMistakes: {},
    patch: { quality: 72 }
  };
  let batched = core.recordElapsedHistory(base, 2 * 3600000);
  batched.stats.health = 100;
  batched = core.recordElapsedHistory(batched, 3600000);

  let ticked = base;
  for (let minute = 0; minute < 180; minute += 1) {
    ticked.stats.health = minute < 120 ? 0 : 100;
    ticked = core.recordElapsedHistory(ticked, 60000);
  }

  const batchedVariant = core.getEvolutionVariant(batched.history, batched, {});
  const tickedVariant = core.getEvolutionVariant(ticked.history, ticked, {});
  assert(batchedVariant.variant === 'ghostcap', `expected weighted low-health path, got ${batchedVariant.variant}`);
  assert(tickedVariant.variant === batchedVariant.variant, 'batch and minute samples should choose the same evolution');
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
  assert(result.state.legendaryGames.daily.dateKey === '2026-05-16', 'decoration normalization should use the supplied gameplay clock');
});

test('state export and import preserve save shape while rejecting invalid files', () => {
  const envelope = core.buildStateExportEnvelope({
    version: 8,
    mushroomName: 'Puszek',
    stage: 'young',
    stats: { hydration: 70 },
    history: { actionsPerformed: { hydrate: 1 } }
  }, Date.parse('2026-05-16T12:00:00.000Z'));
  const imported = core.importStateEnvelope(JSON.stringify(envelope), 9);
  const rejected = core.importStateEnvelope(JSON.stringify({ nope: true }), 9);

  assert(imported.ok, `expected import success: ${imported.reason}`);
  assert(imported.state.version === 9, 'expected imported state migrated to v9');
  assert(imported.state.history.actionsPerformed.hydrate === 1, 'expected imported history');
  assert(imported.state.discoveries.environment, 'expected imported state to include environment discoveries');
  assert(imported.metadata.sourceVersion === 8, 'expected import preview to preserve the source version');
  assert(imported.metadata.name === 'Puszek' && imported.metadata.stage === 'young', 'expected import preview identity metadata');
  assert(imported.metadata.exportedAt === '2026-05-16T12:00:00.000Z', 'expected import preview export timestamp');
  assert(!rejected.ok, 'expected invalid import rejection');
});

test('state import clamps cooldowns and inventory while quarantining malformed sessions and logs', () => {
  const now = Date.parse('2026-05-16T12:00:00.000Z');
  const rules = {
    maxLogEntries: 8,
    minigames: {
      dewCatch: { id: 'dewCatch', label: 'Łapanie rosy', durationMs: 20000 }
    }
  };
  const imported = core.importStateEnvelope(JSON.stringify({
    version: 16,
    stats: { health: 80 },
    inventory: { spores: 1e99, water: -10 },
    cooldowns: { hydrate: 1e99, broken: null },
    minigames: {
      active: {
        id: 'dewCatch',
        startedAt: now,
        until: now + 30 * 86400000,
        score: 1e99
      }
    },
    battle: {
      mode: 'victory',
      activeBattle: { mode: 'victory', rewarded: false },
      log: [null, { at: 'bad-date', text: 'Bezpieczny wpis' }]
    },
    log: [null, { at: 'bad-date', text: 'Zachowany wpis' }]
  }), 17, rules, now);

  assert(imported.ok, `expected hardened import success: ${imported.reason}`);
  assert(imported.state.inventory.spores === 999999 && imported.state.inventory.water === 0, 'inventory should be bounded');
  assert(imported.state.cooldowns.hydrate === now + 7 * 86400000, 'far-future cooldown should be capped');
  assert(!Object.prototype.hasOwnProperty.call(imported.state.cooldowns, 'broken'), 'invalid cooldown should be dropped');
  assert(imported.state.minigames.active === null, 'malformed minigame session should be deactivated');
  assert(imported.state.minigames.quarantined.reason === 'invalidMinigameSession', 'malformed minigame should retain a diagnostic');
  assert(imported.state.battle.activeBattle === null, 'malformed battle session should be deactivated');
  assert(imported.state.battle.quarantined.reason === 'invalidBattleSession', 'malformed battle should retain a diagnostic');
  assert(imported.state.log.length === 1 && imported.state.log[0].text === 'Zachowany wpis', 'main log should drop malformed entries');
  assert(imported.state.battle.log.length === 1 && imported.state.battle.log[0].text === 'Bezpieczny wpis', 'battle log should drop malformed entries');
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
  assert(!profile.noctilucentClouds.visible, 'expected noctilucent clouds hidden in storm');
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

test('ambient sky recognizes noctilucent clouds in clear summer twilight', () => {
  const profile = core.calculateAmbientSkyEffects({
    condition: 'clear',
    isDay: false,
    dayPhase: 'sunset',
    dayTone: 'duskBlue',
    latitude: 50.2649,
    longitude: 19.0238,
    cloudCover: 4,
    cloudCoverLow: 0,
    cloudCoverMid: 2,
    cloudCoverHigh: 8,
    precipitation: 0
  }, new Date(2026, 5, 21, 22, 5), Date.parse('2026-06-21T20:05:00.000Z'));

  assert(profile.noctilucentClouds.visible, `expected noctilucent clouds, got ${profile.noctilucentClouds.intensity}`);
  assert(profile.discoveries.includes('noctilucentClouds'), 'expected noctilucent discovery');
});

test('ground shadow lighting follows solar altitude, azimuth, and cloud transmission', () => {
  const scene = {
    condition: 'clear',
    isDay: true,
    dayPhase: 'noon',
    latitude: 50.2649,
    cloudCover: 0,
    cloudCoverLow: 0,
    cloudCoverMid: 0,
    cloudCoverHigh: 0
  };
  const highSun = core.calculateGroundShadowLighting({
    scene,
    date: new Date('2026-06-21T10:00:00.000Z'),
    nightFactor: 0,
    sun: { altitude: 62, azimuth: 90, alpha: 1, cloudVisibility: 1 },
    surface: { wetness: 0, snowCover: 0 }
  });
  const lowSun = core.calculateGroundShadowLighting({
    scene,
    date: new Date('2026-12-21T11:00:00.000Z'),
    nightFactor: 0,
    sun: { altitude: 12, azimuth: 270, alpha: 1, cloudVisibility: 1 },
    surface: { wetness: 0, snowCover: 0 }
  });
  const cloudySun = core.calculateGroundShadowLighting({
    scene: Object.assign({}, scene, {
      condition: 'cloudy',
      cloudCover: 72,
      cloudCoverLow: 76,
      cloudCoverMid: 68,
      cloudCoverHigh: 62,
      cloudDensity: 0.72
    }),
    date: new Date('2026-06-21T10:00:00.000Z'),
    nightFactor: 0,
    sun: { altitude: 62, azimuth: 90, alpha: 1, cloudVisibility: 0.34 },
    surface: { wetness: 0, snowCover: 0 }
  });

  assert(highSun.source === 'sun' && lowSun.source === 'sun', 'clear eligible sun should own the directional shadow');
  assert(highSun.directionX > 0, `eastern sun should cast right, direction=${highSun.directionX}`);
  assert(lowSun.directionX < 0, `western sun should cast left, direction=${lowSun.directionX}`);
  assert(highSun.castAlpha > cloudySun.castAlpha, `cloud cover should weaken cast alpha, clear=${highSun.castAlpha}, cloudy=${cloudySun.castAlpha}`);
  assert(cloudySun.softness > highSun.softness, `cloud cover should widen the penumbra, clear=${highSun.softness}, cloudy=${cloudySun.softness}`);
  assert(highSun.castAlpha <= 0.26, `sun cast must stay bounded, alpha=${highSun.castAlpha}`);
});

test('ground shadow gives the sun priority and only bright night moons a cast shadow', () => {
  const nightScene = {
    condition: 'clear',
    isDay: false,
    dayPhase: 'night',
    latitude: 50.2649,
    cloudCover: 4,
    cloudDensity: 0.04
  };
  const fullMoon = core.calculateGroundShadowLighting({
    scene: nightScene,
    date: new Date('2026-12-21T23:00:00.000Z'),
    nightFactor: 1,
    moon: { altitude: 52, azimuth: 243, alpha: 1, cloudVisibility: 1, phase: { illumination: 1 } },
    surface: { wetness: 0, snowCover: 0 }
  });
  const crescent = core.calculateGroundShadowLighting({
    scene: nightScene,
    date: new Date('2026-12-21T23:00:00.000Z'),
    nightFactor: 1,
    moon: { altitude: 52, azimuth: 243, alpha: 0.5, cloudVisibility: 1, phase: { illumination: 0.22 } },
    surface: { wetness: 0, snowCover: 0 }
  });
  const twilight = core.calculateGroundShadowLighting({
    scene: Object.assign({}, nightScene, { isDay: true, dayPhase: 'sunset' }),
    date: new Date('2026-06-21T18:30:00.000Z'),
    nightFactor: 0.62,
    sun: { altitude: 3, azimuth: 305, alpha: 0.72, cloudVisibility: 1 },
    moon: { altitude: 32, azimuth: 215, alpha: 0.8, cloudVisibility: 1, phase: { illumination: 0.9 } },
    surface: { wetness: 0, snowCover: 0 }
  });
  const storm = core.calculateGroundShadowLighting({
    scene: Object.assign({}, nightScene, { condition: 'storm', cloudCover: 96, cloudDensity: 0.96 }),
    date: new Date('2026-12-21T23:00:00.000Z'),
    nightFactor: 1,
    moon: { altitude: 52, azimuth: 243, alpha: 1, cloudVisibility: 0.08, phase: { illumination: 1 } },
    surface: { wetness: 0.8, snowCover: 0 }
  });

  assert(fullMoon.source === 'moon', 'clear full moon should own a restrained night cast');
  assert(fullMoon.castAlpha > 0 && fullMoon.castAlpha <= 0.115, `moon alpha must stay restrained, alpha=${fullMoon.castAlpha}`);
  assert(crescent.source === 'ambient' && crescent.castAlpha === 0, 'crescent moon should leave only contact shadow');
  assert(twilight.source === 'sun', `visible twilight sun must win over the moon, source=${twilight.source}`);
  assert(storm.source === 'ambient' && storm.castAlpha === 0, 'storm must suppress directional moon shadow');
});

test('ground shadow lighting has hemisphere-aware seasons and safe ambient fallback', () => {
  const north = core.calculateGroundShadowLighting({
    scene: { condition: 'clear', isDay: true, latitude: 50.2649 },
    date: new Date('2026-06-21T10:00:00.000Z'),
    sun: { altitude: 60, azimuth: 180, alpha: 1, cloudVisibility: 1 }
  });
  const south = core.calculateGroundShadowLighting({
    scene: { condition: 'clear', isDay: true, latitude: -33.8688 },
    date: new Date('2026-06-21T10:00:00.000Z'),
    sun: { altitude: 30, azimuth: 180, alpha: 1, cloudVisibility: 1 }
  });
  const fallback = core.calculateGroundShadowLighting({
    scene: { condition: 'fog', isDay: false },
    sun: { altitude: 'bad', azimuth: null },
    moon: null,
    surface: { wetness: 'bad', snowCover: null }
  });

  assert(north.season === 'summer' && south.season === 'winter', `expected inverted ecological seasons, north=${north.season}, south=${south.season}`);
  assert(fallback.source === 'ambient' && fallback.castAlpha === 0, 'invalid bodies should degrade to ambient contact shadow');
  assert(Number.isFinite(fallback.contactAlpha) && Number.isFinite(fallback.softness), 'ambient fallback must never leak NaN');
  assert(fallback.season === 'winter', 'missing dates should use a deterministic epoch season instead of wall-clock time');
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

  const redRainbowDate = new Date(2026, 8, 12, 18, 2);
  const redRainbow = core.calculateAmbientPhenomena({
    condition: 'rain',
    isDay: true,
    dayPhase: 'sunset',
    dayTone: 'duskGold',
    precipitation: 1.8,
    rainbowPotential: 0.82,
    rainbowRedShiftScore: 0.86,
    rainbowVariant: 'redDouble',
    cloudCover: 36,
    cloudCoverLow: 14,
    cloudCoverMid: 24,
    cloudCoverHigh: 30
  }, redRainbowDate, redRainbowDate.getTime());
  assert(redRainbow.redRainbow.visible, `expected visible red rainbow, got ${redRainbow.redRainbow.intensity}`);

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

  const crystalDate = new Date(2026, 0, 18, 15, 25);
  const crystalOptics = core.calculateAmbientPhenomena({
    condition: 'clear',
    isDay: true,
    dayPhase: 'sunset',
    dayTone: 'duskGold',
    temperature: -5,
    humidity: 72,
    windLevel: 0.03,
    precipitation: 0,
    visibility: 11000,
    cloudCover: 54,
    cloudCoverLow: 6,
    cloudCoverMid: 18,
    cloudCoverHigh: 74
  }, crystalDate, crystalDate.getTime());
  assert(crystalOptics.sunDog.visible, `expected visible sun dog, got ${crystalOptics.sunDog.intensity}`);

  const pillarDate = new Date(2026, 0, 18, 7, 5);
  const pillar = core.calculateAmbientPhenomena({
    condition: 'clear',
    isDay: true,
    dayPhase: 'sunrise',
    dayTone: 'dawnGold',
    temperature: -8,
    humidity: 78,
    windLevel: 0.02,
    precipitation: 0,
    visibility: 9000,
    cloudCover: 58,
    cloudCoverLow: 5,
    cloudCoverMid: 16,
    cloudCoverHigh: 82
  }, pillarDate, pillarDate.getTime());
  assert(pillar.lightPillar.visible, `expected visible light pillar, got ${pillar.lightPillar.intensity}`);

  const iridescenceDate = new Date(2026, 5, 21, 15, 40);
  const iridescence = core.calculateAmbientPhenomena({
    condition: 'clear',
    isDay: true,
    dayPhase: 'afternoon',
    temperature: 22,
    humidity: 58,
    windLevel: 0.12,
    precipitation: 0,
    visibility: 12000,
    cloudCover: 44,
    cloudCoverLow: 4,
    cloudCoverMid: 46,
    cloudCoverHigh: 62
  }, iridescenceDate, iridescenceDate.getTime());
  assert(iridescence.cloudIridescence.visible, `expected visible cloud iridescence, got ${iridescence.cloudIridescence.intensity}`);

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
  const grass = core.recordEnvironmentDiscovery(state, 'grassDewPearl', Date.parse('2026-06-21T04:26:00.000Z'));
  const unknown = core.recordEnvironmentDiscovery(state, 'impossibleThing', Date.parse('2026-06-21T04:30:00.000Z'));
  const normalized = core.normalizeDiscoveriesState({
    sky: { aurora: { firstSeenAt: '2026-01-12T22:30:00.000Z', count: 1 } },
    environment: {
      dew: { firstSeenAt: '2026-06-21T04:20:00.000Z', count: 2 },
      grassDewPearl: { firstSeenAt: '2026-06-21T04:26:00.000Z', count: 1 },
      bogus: { firstSeenAt: '2026-06-21T04:20:00.000Z', count: 1 }
    }
  });

  assert(first.newlyDiscovered, 'expected first dew discovery');
  assert(!second.newlyDiscovered, 'expected repeated dew to be known');
  assert(grass.newlyDiscovered, 'expected first hidden grass discovery');
  assert(!unknown.ok, 'unknown environment discovery should be rejected');
  assert(state.discoveries.environment.dew.count === 2, `expected dew count 2, got ${state.discoveries.environment.dew.count}`);
  assert(state.discoveries.environment.grassDewPearl.count === 1, 'expected hidden grass discovery to be recorded');
  assert(normalized.environment.dew.count === 2, 'expected normalized dew discovery');
  assert(normalized.environment.grassDewPearl.count === 1, 'expected normalized hidden grass discovery');
  assert(!normalized.environment.bogus, 'expected unknown environment discovery to be dropped');
});

test('hidden grass discovery selector is deterministic and respects care blockers', () => {
  const now = Date.parse('2026-06-21T05:50:00.000Z');
  const rules = {
    attention: { mildThreshold: 45, criticalThreshold: 25 },
    needDefinitions: {
      hydration: { category: 'physical', actionId: 'hydrate' }
    }
  };
  const state = getGameplayLoopTestState({
    playerId: 'grass-finds-test',
    mode: 'awake',
    stats: { hydration: 88, nutrients: 88, energy: 88, happiness: 88, cleanliness: 88, health: 100, growth: 40 },
    patch: { quality: 86, mycelium: 20, careStreak: 4 },
    decorations: { owned: ['dewStone', 'cloverPatch'], active: ['dewStone', 'cloverPatch'] },
    discoveries: { sky: {}, environment: {}, instruments: {}, calendar: {} }
  });
  const scene = {
    condition: 'clear',
    isDay: true,
    dayPhase: 'morning',
    humidity: 92,
    surfaceWetnessTarget: 0.82,
    windLevel: 0.04,
    precipitation: 0
  };
  const interaction = { x: 264, y: 426, grassBrushDistance: 160 };
  const first = core.selectGrassInteractionDiscovery(state, scene, interaction, now, rules);
  const second = core.selectGrassInteractionDiscovery(state, scene, interaction, now, rules);

  assert(first && first.id === 'grassDewPearl', `expected deterministic dew pearl, got ${first && first.id}`);
  assert(second && second.id === first.id, 'expected repeated selector call to be deterministic');

  const blockedNeed = core.selectGrassInteractionDiscovery({
    ...state,
    stats: { ...state.stats, hydration: 20 }
  }, scene, interaction, now, rules);
  assert(blockedNeed === null, 'urgent care need should block hidden grass discovery');

  const sleeping = core.selectGrassInteractionDiscovery({
    ...state,
    mode: 'sleeping'
  }, scene, interaction, now, rules);
  assert(sleeping === null, 'sleep should block hidden grass discovery');

  const tooShort = core.selectGrassInteractionDiscovery(state, scene, {
    x: 264,
    y: 426,
    grassBrushDistance: 12
  }, now, rules);
  assert(tooShort === null, 'short grass brush should not create a persistent discovery');

  const tooCasual = core.selectGrassInteractionDiscovery(state, scene, {
    x: 264,
    y: 426,
    grassBrushDistance: 88
  }, now, rules);
  assert(tooCasual === null, 'casual grass brush should not create a persistent discovery');
});

test('world journal discovery snapshots preserve the first photographed world state', () => {
  const state = getGameplayLoopTestState({
    stage: 'juvenile',
    mode: 'awake',
    stats: { hydration: 88, nutrients: 72, energy: 80, happiness: 91, cleanliness: 90, health: 100, growth: 44 },
    patch: { quality: 82, mycelium: 12, careStreak: 3 },
    decorations: { owned: ['dewStone'], active: ['dewStone'] },
    discoveries: { sky: {}, environment: {}, instruments: {}, calendar: {} },
    journal: { entries: [] }
  });
  const firstContext = {
    scene: {
      condition: 'snow',
      dayPhase: 'night',
      dayTone: 'night',
      isDay: false,
      temperature: -2.4,
      humidity: 94,
      precipitation: 2,
      snowfall: 2,
      snowIntensity: 0.58,
      cloudCover: 72,
      frostRisk: 0.8
    },
    environmentProfile: {
      id: 'snow-night',
      discoveries: ['frost'],
      frost: { visible: true, intensity: 0.9 }
    }
  };
  const secondContext = {
    scene: {
      condition: 'clear',
      dayPhase: 'day',
      isDay: true,
      humidity: 48,
      cloudCover: 0
    }
  };

  const first = core.recordEnvironmentDiscovery(state, 'frost', Date.parse('2026-01-03T22:15:00.000Z'), firstContext);
  state.stage = 'adult';
  state.stats.growth = 80;
  const second = core.recordEnvironmentDiscovery(state, 'frost', Date.parse('2026-01-03T22:25:00.000Z'), secondContext);
  const snapshot = state.discoveries.environment.frost.photoSnapshot;

  assert(first.newlyDiscovered, 'expected first frost snapshot');
  assert(!second.newlyDiscovered, 'expected repeated frost to keep the original snapshot');
  assert(snapshot && !snapshot.fallback, 'expected live snapshot on discovery');
  assert(snapshot.stage === 'juvenile', `expected first stage juvenile, got ${snapshot.stage}`);
  assert(snapshot.growth === 44, `expected first growth 44, got ${snapshot.growth}`);
  assert(snapshot.weather.condition === 'snow', `expected first weather snow, got ${snapshot.weather.condition}`);
  assert(snapshot.weather.dayPhase === 'night', `expected first phase night, got ${snapshot.weather.dayPhase}`);
  assert(snapshot.environment.discoveries.includes('frost'), 'expected environment profile discoveries in snapshot');
  assert(snapshot.world.decorations.includes('dewStone'), 'expected active decorations in snapshot');
});

test('world journal sky snapshots do not leak sky discovery ids into environment fields', () => {
  const state = getGameplayLoopTestState({
    discoveries: { sky: {}, environment: {}, instruments: {}, calendar: {} },
    journal: { entries: [] }
  });
  const context = {
    scene: {
      condition: 'clear',
      dayPhase: 'night',
      isDay: false,
      cloudCover: 12
    },
    skyEffects: {
      discoveries: ['aurora']
    }
  };

  const result = core.recordSkyDiscovery(state, 'aurora', Date.parse('2026-01-12T22:30:00.000Z'), context);
  const snapshot = state.discoveries.sky.aurora.photoSnapshot;

  assert(result.newlyDiscovered, 'expected first aurora discovery');
  assert(snapshot.sky.activeIds.includes('aurora'), 'expected sky snapshot to preserve sky discovery ids');
  assert(snapshot.environment.discoveries.length === 0, 'expected sky snapshot not to copy sky ids into environment discoveries');
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
  assert(aurora.photoSnapshot && aurora.photoSnapshot.fallback === false, 'expected aurora to expose a live photo snapshot');
  assert(aurora.reaction === 'awe', `expected aurora awe reaction, got ${aurora.reaction}`);
  assert(aurora.description.includes('Zielonkawe'), 'expected aurora to expose journal description');
  assert(aurora.scienceNote.includes('geomagnetyczna'), 'expected aurora to expose science note');
  assert(dew.photoScene === 'dew', `expected dew photo scene, got ${dew.photoScene}`);
  assert(dew.conditionNote.includes('Poranek'), 'expected dew to expose condition note');
  assert(rare.photoScene === 'instrument', `expected rare instrument photo scene, got ${rare.photoScene}`);
  assert(rare.reaction === 'proud', `expected rare instrument proud reaction, got ${rare.reaction}`);
  assert(comet && !comet.discovered && comet.hint, 'expected locked sky item to keep a hint');
  assert(state.journal.entries.length === 3, 'expected first sightings to create journal entries');
  assert(state.journal.entries.every((entry) => !/dopisało|dopisał/.test(entry.body)), 'expected natural journal entry wording');
});

test('legacy world journal discoveries get deterministic fallback photo snapshots', () => {
  const state = getGameplayLoopTestState({
    discoveries: {
      sky: {
        comet: {
          firstSeenAt: '2026-01-12T22:30:00.000Z',
          count: 1
        }
      },
      environment: {},
      instruments: {},
      calendar: {}
    },
    journal: { entries: [] }
  });
  const journal = core.getWorldJournal(state, getGameplayLoopTestRules());
  const sky = journal.groups.find((group) => group.id === 'sky');
  const comet = sky.items.find((item) => item.id === 'comet');

  assert(comet.discovered, 'expected legacy comet discovery');
  assert(comet.photoSnapshot && comet.photoSnapshot.fallback, 'expected fallback snapshot for legacy discovery');
  assert(comet.photoSnapshot.weather.dayPhase === 'night', 'expected comet fallback to preserve night atmosphere');
  assert(comet.photoSnapshot.stage === 'adult', 'expected fallback stage to be adult');
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
  assert(tea.sourceType === 'official' && tea.sourceLabel === 'oficjalne', 'expected Tea Day to expose an official source label');
  assert(bees && !bees.active, 'expected World Bee Day not to be active on May 21');
  assert(springBirds && springBirds.active, 'expected migratory bird day to match second Saturday in May 2026');
  const perseids = core.getCalendarEventsForDate(new Date(2026, 7, 12, 23), state, rules)
    .find((item) => item.id === 'perseidNights');
  const mushroomDay = core.getCalendarEventsForDate(new Date(2026, 9, 15, 9), state, rules)
    .find((item) => item.id === 'mushroomDay');
  assert(perseids && perseids.sourceType === 'seasonalNatural', 'expected Perseids to be marked as a natural season');
  assert(mushroomDay && mushroomDay.sourceType === 'informal', 'expected Mushroom Day to be marked as informal game flavor');

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
  assert(unlockedChecklist.frameReward.current.id === 'moss', 'expected initial calendar frame to be moss');
  ['teaDay', 'worldBeeDay', 'biodiversityDay'].forEach((eventId) => {
    core.recordCalendarDiscovery(purchase.state, eventId, new Date(2026, 4, 22, 9));
  });
  const rewardChecklist = core.getCalendarChecklist(purchase.state, rules, new Date(2026, 4, 23, 9));
  assert(rewardChecklist.frameReward.current.id === 'dew', 'expected three checked events to unlock dew frame');
  assert(rewardChecklist.frameReward.next && rewardChecklist.frameReward.next.id === 'pollen', 'expected next cosmetic frame to be pollen');
  assert(rewardChecklist.status.includes('Ramka rosy'), 'expected checklist status to mention the cosmetic frame');
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
  assert(tea.sourceLabel === 'oficjalne', 'expected calendar journal item to expose source label');
  assert(journal.discoveredCount === 1, `expected one calendar discovery, got ${journal.discoveredCount}`);
  assert(state.journal.entries.some((entry) => entry.type === 'calendar'), 'expected calendar journal entry');
  assert(state.journal.entries.some((entry) => entry.category === 'oficjalne'), 'expected calendar journal entry category to use source label');
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
  for (let step = 0; step < 260; step += 1) {
    const now = start + step * 5000 + 2200;
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
      rhythmHum: { id: 'rhythmHum', label: 'Rytmiczne nucenie' },
      ...getLegendaryGameTestRules()
    },
    legendaryGames: {
      unlockStage: 'legendary',
      dailyProjectPointCap: 6,
      games: getLegendaryGameTestRules()
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

function getLegendaryGameTestRules() {
  return {
    sporeTrail: {
      id: 'sporeTrail',
      label: 'Szlak Zarodników',
      requiresStage: 'legendary',
      legendary: true,
      masteryTarget: 18,
      targetCount: 18,
      projectPoints: 3,
      seasonPoints: 2,
      memento: { id: 'memento-spore-trail-map', label: 'Mapa szlaku zarodników' }
    },
    myceliumLeague: {
      id: 'myceliumLeague',
      label: 'Liga Grzybni',
      requiresStage: 'legendary',
      legendary: true,
      masteryTarget: 24,
      targetCount: 16,
      projectPoints: 2,
      seasonPoints: 3,
      memento: { id: 'memento-mycelium-league-badge', label: 'Odznaka ligi grzybni' }
    },
    memoryGarden: {
      id: 'memoryGarden',
      label: 'Ogród Pamiątek',
      requiresStage: 'legendary',
      legendary: true,
      masteryTarget: 15,
      targetCount: 12,
      projectPoints: 3,
      seasonPoints: 2,
      memento: { id: 'memento-memory-garden-frame', label: 'Ramka ogrodu pamiątek' }
    }
  };
}

function getGameplayLoopTestState(overrides = {}) {
  return {
    version: 15,
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
    legendaryGames: overrides.legendaryGames || {},
    dailyPlan: overrides.dailyPlan || { dateKey: null, activeIds: [], completed: {} },
    dailyRhythm: overrides.dailyRhythm || { dateKey: null, selectedId: null, options: [] },
    relationship: overrides.relationship || { entries: [] },
    journal: overrides.journal || { entries: [] },
    decorations: overrides.decorations || { owned: [], active: [] },
    discoveries: overrides.discoveries || { sky: {}, environment: {}, instruments: {}, calendar: {} },
    returnRecap: overrides.returnRecap || { lastSeenAt: null, lastDigestAt: null, entries: [] },
    longLoop: overrides.longLoop || {},
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

function getElapsedReducerTestRules() {
  return {
    statBounds: { min: 0, max: 100 },
    stageThresholds: [
      { id: 'spore', growth: 0 },
      { id: 'baby', growth: 8 },
      { id: 'young', growth: 28 },
      { id: 'adult', growth: 62 },
      { id: 'legendary', growth: 100 }
    ],
    decayPerHour: {
      awake: { hydration: -3.8, nutrients: -3.1, energy: -4.2, happiness: -2.4, cleanliness: -1.35 },
      sleeping: { hydration: -1.2, nutrients: -1, energy: 8.5, happiness: -0.45, cleanliness: -0.45 },
      quietSleeping: { hydration: -0.6, nutrients: -0.5, energy: 8, happiness: -0.2, cleanliness: -0.25 },
      quietAwake: { hydration: -1, nutrients: -0.8, energy: 3, happiness: -0.4, cleanliness: -0.35 }
    },
    healthPerHour: { poorConditions: -4, goodConditions: 2 },
    growthPerHour: { awakeHealthy: 0.6, sleepingHealthy: 0.18, quietDrowsyHealthy: 0.08 },
    patchPerHour: { cleanHealthy: 0.9, neglected: -3 },
    careRhythm: {
      quietStartMinute: 22 * 60 + 30,
      quietEndMinute: 7 * 60,
      morningGraceMs: 45 * 60000,
      offlineCapHours: 24,
      dailyGrowthCap: 8.5
    },
    attention: {
      mildThreshold: 40,
      criticalThreshold: 20,
      deadlineMs: 90 * 60000,
      criticalDeadlineMs: 35 * 60000,
      repeatedMistakeCooldownMs: 3 * 60 * 60000,
      penalties: {
        mild: { health: -2, happiness: -1, patchQuality: -2 },
        critical: { health: -6, happiness: -4, patchQuality: -5 }
      }
    },
    needDefinitions: {
      hydration: { category: 'physical', actionId: 'hydrate' },
      nutrients: { category: 'physical', actionId: 'feed' },
      happiness: { category: 'mental', actionId: 'play' },
      cleanliness: { category: 'environment', actionId: 'clean' },
      energy: { category: 'rest', actionId: 'sleepWake' },
      health: { category: 'physical', actionId: 'hydrate' }
    },
    recovery: getRecoveryTestRules().recovery,
    evolution: { legendaryGrowth: 100 },
    minigames: { dewCatch: { id: 'dewCatch' } }
  };
}

function getElapsedReducerTestState(now) {
  return {
    version: 17,
    createdAt: new Date(now - 86400000).toISOString(),
    lastUpdatedAt: new Date(now).toISOString(),
    mode: 'awake',
    stage: 'spore',
    stats: { hydration: 70, nutrients: 70, energy: 80, happiness: 60, cleanliness: 80, health: 100, growth: 0 },
    inventory: { spores: 0 },
    history: {
      actionsPerformed: {},
      modeMs: { awake: 0, sleeping: 0 },
      statSamples: {},
      attention: { handled: 0, missed: 0 },
      dailyGrowth: { dateKey: null, earned: 0 },
      minigames: {}
    },
    patch: { quality: 72, mycelium: 0, harvests: 0, careStreak: 0 },
    attention: {},
    recovery: {},
    gameOver: {},
    careMistakes: {},
    evolution: {},
    minigames: { active: null, lastResult: null },
    battle: {},
    flags: {},
    decorations: {},
    discoveries: {},
    cooldowns: {}
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
