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
