import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const script = readFileSync(path.join(rootDir, 'ClientCore.html'), 'utf8')
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
  }, new Date('2026-07-08T12:00:00+02:00'));
  const winter = core.calculateAmbientLife({
    condition: 'clear',
    dayPhase: 'noon',
    latitude: 50.2649,
    temperature: 2,
    humidity: 72,
    windSpeed: 4,
    windLevel: 0.05,
    precipitation: 0
  }, new Date('2026-01-08T12:00:00+01:00'));

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
  }, new Date('2026-07-08T12:00:00+02:00'));

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
  }, new Date('2026-07-08T12:00:00+02:00'));
  const snow = core.calculateAmbientLife({
    condition: 'snow',
    dayPhase: 'noon',
    latitude: 50.2649,
    temperature: -2,
    humidity: 82,
    windLevel: 0.2,
    precipitation: 1,
    snowfall: 1
  }, new Date('2026-07-08T12:00:00+02:00'));

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
  const evening = core.calculateAmbientLife(Object.assign({ dayPhase: 'night' }, baseScene), new Date('2026-06-24T22:00:00+02:00'));
  const noon = core.calculateAmbientLife(Object.assign({ dayPhase: 'noon' }, baseScene), new Date('2026-06-24T12:00:00+02:00'));
  const january = core.calculateAmbientLife(Object.assign({ dayPhase: 'night' }, baseScene), new Date('2026-01-24T22:00:00+01:00'));

  assert(evening.fireflyIntensity > 0.7, `expected strong summer evening fireflies, got ${evening.fireflyIntensity}`);
  assert(noon.fireflyIntensity === 0, `expected no noon fireflies, got ${noon.fireflyIntensity}`);
  assert(january.fireflyIntensity === 0, `expected no winter fireflies, got ${january.fireflyIntensity}`);
});

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
