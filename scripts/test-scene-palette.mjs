import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const script = readFileSync(path.join(rootDir, 'ClientScenePalette.html'), 'utf8');
const context = {
  Date,
  Number,
  Math,
  Object,
  String,
  Array,
  parseInt,
  console,
  runtime: {
    frameNow: 0,
    debug: { enabled: false, weather: 'auto' },
    sceneWeatherPaletteTransition: null
  },
  getRuntimeDate: () => new Date(2026, 5, 21, 12, 0, 0)
};
vm.createContext(context);
vm.runInContext(script, context, { filename: 'ClientScenePalette.html' });

if (typeof context.getScenePalette !== 'function' || typeof context.getSceneLightingProfile !== 'function') {
  throw new Error('Scene palette helpers were not exported');
}

const sunScene = {
  condition: 'clear',
  isDay: true,
  dayPhase: 'sunrise',
  dayTone: 'dawnGold',
  cloudDensity: 0,
  cloudCover: 0,
  latitude: 50.2649,
  longitude: 19.0238,
  sunriseAt: new Date(2026, 5, 21, 4, 30, 0).toISOString(),
  sunsetAt: new Date(2026, 5, 21, 20, 50, 0).toISOString()
};

test('sunrise palette blends between blue hour and gold instead of snapping', () => {
  context.getRuntimeDate = () => new Date(2026, 5, 21, 4, 18, 0);
  const palette = context.getScenePalette(sunScene);
  assert(palette.lighting.source === 'sun', `expected sun lighting source, got ${palette.lighting.source}`);
  assert(palette.lighting.from.tone === 'dawnBlue', `expected dawnBlue source, got ${palette.lighting.from.tone}`);
  assert(palette.lighting.to.tone === 'dawnGold', `expected dawnGold target, got ${palette.lighting.to.tone}`);
  assert(palette.lighting.progress > 0.4 && palette.lighting.progress < 0.9, `expected intermediate progress, got ${palette.lighting.progress}`);
  assert(palette.blueHourFactor > 0.2, `expected blue-hour wash, got ${palette.blueHourFactor}`);
  assert(palette.goldenFactor > 0.2, `expected golden glow, got ${palette.goldenFactor}`);
});

test('local fallback does not hard-jump at the old sunrise to morning boundary', () => {
  const scene = {
    condition: 'clear',
    isDay: true,
    dayPhase: 'sunrise',
    dayTone: 'dawnGold',
    cloudDensity: 0,
    cloudCover: 0
  };
  context.getRuntimeDate = () => new Date(2026, 4, 17, 6, 29, 0);
  const before = context.getScenePalette(scene);
  context.getRuntimeDate = () => new Date(2026, 4, 17, 6, 31, 0);
  const after = context.getScenePalette(Object.assign({}, scene, { dayPhase: 'morning', dayTone: 'neutral' }));
  const distance = colorDistance(before.skyTop, after.skyTop)
    + colorDistance(before.skyMid, after.skyMid)
    + colorDistance(before.skyLow, after.skyLow);
  assert(distance < 24, `expected tiny palette delta across phase boundary, got ${distance}`);
});

test('dusk exposes a partial night factor for smooth star fade-in', () => {
  context.getRuntimeDate = () => new Date(2026, 8, 12, 20, 10, 0);
  const palette = context.getScenePalette({
    condition: 'clear',
    isDay: true,
    dayPhase: 'sunset',
    dayTone: 'duskBlue',
    cloudDensity: 0,
    cloudCover: 0
  });
  assert(palette.nightFactor > 0.45 && palette.nightFactor < 0.8, `expected partial night factor, got ${palette.nightFactor}`);
  assert(palette.blueHourFactor > 0.55, `expected blue-hour factor, got ${palette.blueHourFactor}`);
});

test('weather condition changes blend over 1200 ms instead of snapping', () => {
  context.runtime.sceneWeatherPaletteTransition = null;
  context.getRuntimeDate = () => new Date(2026, 5, 21, 12, 0, 0);
  context.runtime.frameNow = 100;
  const clear = context.getScenePalette({
    condition: 'clear',
    isDay: true,
    dayPhase: 'noon',
    cloudDensity: 0
  });
  const storm = {
    condition: 'storm',
    isDay: true,
    dayPhase: 'noon',
    cloudDensity: 0.92,
    rainIntensity: 0.86,
    stormIntensity: 0.82
  };

  context.runtime.frameNow = 200;
  const started = context.getScenePalette(storm);
  context.runtime.frameNow = 800;
  const midpoint = context.getScenePalette(storm);
  context.runtime.frameNow = 1400;
  const finished = context.getScenePalette(storm);

  assert(colorDistance(clear.skyTop, started.skyTop) === 0, 'weather transition should begin from the visible clear palette');
  assert(colorDistance(clear.skyTop, midpoint.skyTop) > 10, 'weather transition should visibly progress by its midpoint');
  assert(colorDistance(midpoint.skyTop, finished.skyTop) > 10, 'weather transition should keep progressing until 1200 ms');
});

test('ambient grade darkens raster subjects at night and leaves emissive passes outside the grade', () => {
  const day = context.getSceneAmbientGradeProfile({ condition: 'clear', isDay: true }, { nightFactor: 0 });
  const night = context.getSceneAmbientGradeProfile({ condition: 'clear', isDay: false }, { nightFactor: 1 });
  const snow = context.getSceneAmbientGradeProfile({ condition: 'snow', isDay: true, snowIntensity: 0.7 }, { nightFactor: 0 });

  assert(day.alpha === 0, `clear daylight should not tint the subject, alpha=${day.alpha}`);
  assert(night.alpha >= 0.27 && night.compositeOperation === 'multiply', `night should apply a restrained multiply grade, alpha=${night.alpha}`);
  assert(night.x === 0 && night.y === 0 && night.width === 512 && night.height === 512, 'night grade must cover the entire scene without a horizontal seam');
  assert(night.emissiveBypass === true, 'emissive effects should be rendered after and bypass the ambient grade');
  assert(snow.compositeOperation === 'source-atop' && snow.alpha > 0.05, 'snow should softly cool raster subjects without blurring pixel art');
});

test('immediate palette shares snapshot colors without mutating the live weather transition', () => {
  context.runtime.sceneWeatherPaletteTransition = null;
  const snapshot = context.getScenePaletteImmediate({
    condition: 'rain',
    isDay: false,
    dayPhase: 'night',
    rainIntensity: 0.7,
    visualDate: new Date(2026, 5, 21, 23, 0, 0).toISOString()
  });

  assert(snapshot.nightFactor > 0.9, `snapshot palette should preserve night lighting, factor=${snapshot.nightFactor}`);
  assert(context.runtime.sceneWeatherPaletteTransition === null, 'snapshot palette must not enter the live transition cache');
});

function test(name, callback) {
  try {
    callback();
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

function colorDistance(left, right) {
  const a = parseColor(left);
  const b = parseColor(right);
  return Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
}

function parseColor(value) {
  const hex = /^#([0-9a-f]{6})$/i.exec(String(value));
  if (!hex) {
    throw new Error(`Expected hex color, got ${value}`);
  }
  return {
    r: parseInt(hex[1].slice(0, 2), 16),
    g: parseInt(hex[1].slice(2, 4), 16),
    b: parseInt(hex[1].slice(4, 6), 16)
  };
}
