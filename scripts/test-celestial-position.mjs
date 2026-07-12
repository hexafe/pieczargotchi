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
if (typeof context.getMoonCellLight !== 'function') {
  throw new Error('getMoonCellLight was not exposed by ClientSceneCelestial.html');
}
if (typeof context.getMoonCellGrid !== 'function') {
  throw new Error('getMoonCellGrid was not exposed by ClientSceneCelestial.html');
}
if (typeof context.isPointInsideCelestialBody !== 'function') {
  throw new Error('isPointInsideCelestialBody was not exposed by ClientSceneCelestial.html');
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

test('moon pixel phase mask is side-stable and vertically symmetric', () => {
  const waxingCrescent = { illumination: 0.22, waxing: true, fraction: 0.16 };
  const waningCrescent = { illumination: 0.22, waxing: false, fraction: 0.84 };

  assert(context.getMoonCellLight(0.82, 0, waxingCrescent), 'expected waxing crescent right edge to be lit');
  assert(context.getMoonCellLight(0.42, 0, waxingCrescent), 'expected waxing crescent body to stay readable');
  assert(!context.getMoonCellLight(0.18, 0, waxingCrescent), 'expected waxing crescent terminator to stay shaded');
  assert(!context.getMoonCellLight(-0.82, 0, waxingCrescent), 'expected waxing crescent left edge to stay shaded');
  assert(context.getMoonCellLight(-0.82, 0, waningCrescent), 'expected waning crescent left edge to be lit');
  assert(context.getMoonCellLight(-0.42, 0, waningCrescent), 'expected waning crescent body to stay readable');
  assert(!context.getMoonCellLight(0.82, 0, waningCrescent), 'expected waning crescent right edge to stay shaded');
  assert(
    context.getMoonCellLight(0.82, 0.38, waxingCrescent) === context.getMoonCellLight(0.82, -0.38, waxingCrescent),
    'expected moon phase mask to stay vertically symmetric'
  );
});

test('moon pixel grid stays centered across rendered sizes', () => {
  for (let size = 28; size <= 41; size += 1) {
    const grid = context.getMoonCellGrid(size);
    const leftGap = grid.start;
    const rightGap = size - (grid.start + grid.cellCount * grid.block);
    assert(Math.abs(leftGap - rightGap) < 0.01, `expected balanced moon grid gaps at size ${size}`);
    assert(grid.start >= 0, `expected non-negative moon grid start at size ${size}`);
    assert(grid.start + grid.cellCount * grid.block <= size, `expected moon grid to stay within size ${size}`);

    const crescent = { illumination: 0.22, waxing: true, fraction: 0.16 };
    let litColumns = 0;
    for (let column = 0; column < grid.cellCount; column += 1) {
      const centerX = grid.start + column * grid.block + grid.block / 2;
      const normalizedX = (centerX - grid.center) / grid.radius;
      if (context.getMoonCellLight(normalizedX, 0, crescent)) {
        litColumns += 1;
      }
    }
    assert(litColumns >= 2, `expected readable crescent width at size ${size}, got ${litColumns} columns`);
  }
});

test('celestial hit testing respects center, margin, and misses', () => {
  const sun = {
    x: 120,
    y: 64,
    size: 36,
    centerX: 138,
    centerY: 82,
    hitRadius: 28,
    drawAlpha: 0.72
  };
  const moon = {
    x: 300,
    y: 84,
    size: 32,
    centerX: 316,
    centerY: 100,
    hitRadius: 26,
    drawAlpha: 0.66
  };

  assert(context.isPointInsideCelestialBody({ x: 138, y: 82 }, sun, 'sun', 8), 'expected sun center hit');
  assert(context.isPointInsideCelestialBody({ x: 112, y: 58 }, sun, 'sun', 8), 'expected sun padded corner hit');
  assert(!context.isPointInsideCelestialBody({ x: 88, y: 58 }, sun, 'sun', 8), 'expected sun outside miss');
  assert(context.isPointInsideCelestialBody({ x: 316, y: 100 }, moon, 'moon', 0), 'expected moon center hit');
  assert(context.isPointInsideCelestialBody({ x: 340, y: 100 }, moon, 'moon', 0), 'expected moon soft edge hit');
  assert(!context.isPointInsideCelestialBody({ x: 348, y: 100 }, moon, 'moon', 0), 'expected moon outside miss');
});

test('celestial mood expression escalates with repeated clicks', () => {
  assert(context.getCelestialMoodExpression(0) === 'neutral', 'zero clicks should be neutral');
  assert(context.getCelestialMoodExpression(1) === 'blink', 'first click should receive a subtle acknowledgment');
  assert(context.getCelestialMoodExpression(2) === 'blink', 'second click should keep the response subtle');
  assert(context.getCelestialMoodExpression(3) === 'blink', 'third click should continue the small reaction');
  assert(context.getCelestialMoodExpression(5) === 'blink', 'fifth click should still only blink');
  assert(context.getCelestialMoodExpression(6) === 'annoyed', 'sixth click should begin annoyance');
  assert(context.getCelestialMoodExpression(8) === 'annoyed', 'eighth click should stay annoyed');
  assert(context.getCelestialMoodExpression(9) === 'angry', 'ninth click should be angry');
  assert(context.getCelestialMoodExpression(12) === 'angry', 'later clicks should stay angry');
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
