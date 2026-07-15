import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = readFileSync(path.join(rootDir, 'ClientWeather.html'), 'utf8');
const documentListeners = new Map();
const document = {
  hidden: false,
  addEventListener(type, callback) {
    const list = documentListeners.get(type) || [];
    list.push(callback);
    documentListeners.set(type, list);
  },
  dispatchEvent(event) {
    (documentListeners.get(event.type) || []).forEach((callback) => callback(event));
  }
};
const runtime = {
  weatherLocation: {
    label: 'Katowice',
    latitude: 50.2649,
    longitude: 19.0238,
    fallback: true
  },
  weatherScene: null,
  spaceWeather: null
};
const context = {
  AbortController,
  Date,
  Error,
  Math,
  Number,
  Promise,
  String,
  URLSearchParams,
  console,
  document,
  defaultWeatherLocation: runtime.weatherLocation,
  navigator: {},
  runtime,
  weatherRefreshMs: 15 * 60 * 1000,
  getRuntimeDate() {
    return new Date('2026-07-10T12:00:00.000Z');
  },
  getRuntimeNow() {
    return Date.parse('2026-07-10T12:00:00.000Z');
  },
  window: {
    clearTimeout,
    fetch: globalThis.fetch,
    setInterval() {},
    setTimeout
  }
};

vm.createContext(context);
vm.runInContext(source, context, { filename: 'ClientWeather.html' });

await test('Open-Meteo local timestamps honor the response UTC offset', async () => {
  const summer = context.parseWeatherLocalTime('2026-07-10T12:00', 2 * 60 * 60);
  const winter = context.parseWeatherLocalTime('2026-01-10T12:00', 60 * 60);
  const explicit = context.parseWeatherLocalTime('2026-07-10T12:00:00Z', 2 * 60 * 60);

  assert(summer.toISOString() === '2026-07-10T10:00:00.000Z', `unexpected summer time: ${summer.toISOString()}`);
  assert(winter.toISOString() === '2026-01-10T11:00:00.000Z', `unexpected winter time: ${winter.toISOString()}`);
  assert(explicit.toISOString() === '2026-07-10T12:00:00.000Z', `explicit offsets must win: ${explicit.toISOString()}`);
});

await test('hourly weather samples are normalized to real instants', async () => {
  const hours = context.extractWeatherHours({
    hourly: {
      time: ['2026-07-10T12:00', '2026-07-10T13:00'],
      weather_code: [1, 2]
    }
  }, 2 * 60 * 60);

  assert(hours.length === 2, `expected two samples, got ${hours.length}`);
  assert(hours[0].time.toISOString() === '2026-07-10T10:00:00.000Z', 'first hourly sample should use response offset');
  assert(hours[1].time.toISOString() === '2026-07-10T11:00:00.000Z', 'second hourly sample should use response offset');
});

await test('an older weather response cannot overwrite a newer request', async () => {
  const requests = [];
  context.fetchWeatherScene = function() {
    return new Promise(function(resolve, reject) {
      requests.push({ resolve, reject });
    });
  };

  const first = context.updateWeatherScene();
  const second = context.updateWeatherScene();
  await Promise.resolve();
  await Promise.resolve();
  assert(requests.length === 2, `expected two requests, got ${requests.length}`);

  requests[1].resolve({ id: 'newer' });
  await second;
  requests[0].resolve({ id: 'older' });
  await first;

  assert(runtime.weatherScene.id === 'newer', `stale request overwrote current weather: ${runtime.weatherScene.id}`);
});

await test('a transient fetch failure preserves the last known weather scene', async () => {
  const lastKnown = { id: 'last-live', source: 'live' };
  runtime.weatherScene = lastKnown;
  context.fetchWeatherScene = function() {
    return Promise.reject(new Error('offline'));
  };

  const result = await context.updateWeatherScene();
  assert(result === lastKnown, 'failed refresh should return the last known scene');
  assert(runtime.weatherScene === lastKnown, 'failed refresh should not replace the last known scene');
  assert(Number.isFinite(runtime.weatherFetchErrorAt), 'failed refresh should expose a diagnostic timestamp');
});

await test('hidden tabs stop weather work, invalidate in-flight responses, and refresh once on return', async () => {
  runtime.weatherVisibilityBound = false;
  runtime.weatherScene = { id: 'visible-weather' };
  runtime.spaceWeather = { id: 'visible-space' };
  let weatherCalls = 0;
  let spaceCalls = 0;
  let resolveWeather = null;
  let resolveSpace = null;
  context.fetchWeatherScene = function() {
    weatherCalls += 1;
    return new Promise((resolve) => { resolveWeather = resolve; });
  };
  context.fetchSpaceWeatherSnapshot = function() {
    spaceCalls += 1;
    return new Promise((resolve) => { resolveSpace = resolve; });
  };
  context.bindWeatherVisibilityRefresh();

  document.hidden = false;
  const weatherPending = context.updateWeatherScene();
  const spacePending = context.updateSpaceWeather();
  await Promise.resolve();
  assert(weatherCalls === 1 && spaceCalls === 1, 'visible tab should start both live refreshes');

  document.hidden = true;
  document.dispatchEvent({ type: 'visibilitychange' });
  resolveWeather({ id: 'stale-hidden-weather' });
  resolveSpace({ id: 'stale-hidden-space' });
  await Promise.all([weatherPending, spacePending]);
  assert(runtime.weatherScene.id === 'visible-weather' && runtime.spaceWeather.id === 'visible-space',
    'responses invalidated on hide must not overwrite the last visible snapshots');

  await context.updateWeatherScene();
  await context.updateSpaceWeather();
  assert(weatherCalls === 1 && spaceCalls === 1, 'hidden interval callbacks must perform zero network work');

  context.fetchWeatherScene = function() {
    weatherCalls += 1;
    return Promise.resolve({ id: 'resumed-weather' });
  };
  context.fetchSpaceWeatherSnapshot = function() {
    spaceCalls += 1;
    return Promise.resolve({ id: 'resumed-space' });
  };
  document.hidden = false;
  document.dispatchEvent({ type: 'visibilitychange' });
  await new Promise((resolve) => setImmediate(resolve));
  assert(weatherCalls === 2 && spaceCalls === 2, 'returning visible must trigger exactly one weather and one space refresh');
  assert(runtime.weatherScene.id === 'resumed-weather' && runtime.spaceWeather.id === 'resumed-space',
    'resume refreshes should become the active visible snapshots');
});

console.log('Weather client resilience tests passed.');

async function test(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
