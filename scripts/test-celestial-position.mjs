import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const context = {
  console,
  runtime: { debug: { enabled: false, locationOverride: 'auto' } },
  defaultWeatherLocation: {
    latitude: 50.2649,
    longitude: 19.0238
  }
};
context.globalThis = context;

vm.createContext(context);
for (const fileName of [
  'ClientState.html',
  'ClientSceneWeatherShared.html',
  'ClientWeather.html',
  'ClientSceneCelestial.html'
]) {
  vm.runInContext(readFileSync(path.join(rootDir, fileName), 'utf8'), context, { filename: fileName });
}

if (typeof context.getSunPosition !== 'function') {
  throw new Error('getSunPosition was not exposed by ClientSceneCelestial.html');
}

const locations = {
  katowice: { latitude: 50.2649, longitude: 19.0238 },
  sydney: { latitude: -33.8688, longitude: 151.2093 },
  tromso: { latitude: 69.6492, longitude: 18.9553 }
};

test('Katowice summer noon sun is higher than winter noon', () => {
  const summer = getSun(locations.katowice, '2026-06-21T10:00:00.000Z');
  const winter = getSun(locations.katowice, '2026-12-21T11:00:00.000Z');

  assert(summer, 'expected visible Katowice summer sun');
  assert(winter, 'expected visible Katowice winter sun');
  assert(
    summer.altitude - winter.altitude > 35,
    `expected strong seasonal altitude gap, summer=${summer.altitude}, winter=${winter.altitude}`
  );
  assert(summer.y < winter.y, `expected higher screen sun in summer, summerY=${summer.y}, winterY=${winter.y}`);
});

test('Sydney season is inverted relative to northern hemisphere', () => {
  const june = getSun(locations.sydney, '2026-06-21T02:00:00.000Z');
  const december = getSun(locations.sydney, '2026-12-21T01:00:00.000Z');

  assert(june, 'expected visible Sydney June sun');
  assert(december, 'expected visible Sydney December sun');
  assert(
    december.altitude - june.altitude > 30,
    `expected Sydney December sun higher than June, june=${june.altitude}, december=${december.altitude}`
  );
  assert(december.y < june.y, `expected higher screen sun in Sydney December, juneY=${june.y}, decemberY=${december.y}`);
});

test('Tromso polar edge cases stay bounded', () => {
  const summer = getSun(locations.tromso, '2026-06-21T10:00:00.000Z');
  const winter = getSun(locations.tromso, '2026-12-21T11:00:00.000Z');

  assert(summer, 'expected visible Tromso summer sun');
  assert(summer.altitude > 35, `expected high polar summer sun, got ${summer.altitude}`);
  assert(summer.x >= 26 && summer.x <= 486, `expected bounded Tromso x, got ${summer.x}`);
  assert(summer.y >= 30 && summer.y <= 292, `expected bounded Tromso y, got ${summer.y}`);
  assert(winter === null, `expected polar winter sun below render threshold, got ${JSON.stringify(winter)}`);
});

function getSun(location, isoTimestamp) {
  context.runtime.debug = { enabled: false, locationOverride: 'auto' };
  return context.getSunPosition({
    condition: 'clear',
    isDay: true,
    dayPhase: 'noon',
    latitude: location.latitude,
    longitude: location.longitude,
    cloudCover: 0
  }, new Date(isoTimestamp));
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
