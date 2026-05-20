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
