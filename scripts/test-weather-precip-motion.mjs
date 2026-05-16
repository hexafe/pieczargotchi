import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const script = [
  'ClientCoreShared.html',
  'ClientSceneWeatherShared.html',
  'ClientSceneWeatherPrecip.html'
].map((fileName) => readFileSync(path.join(rootDir, fileName), 'utf8')).join('\n');

const context = {
  console,
  Math,
  Number,
  clamp(value, min, max, fallback) {
    const next = Number.isFinite(value) ? value : fallback;
    return Math.min(max, Math.max(min, next));
  },
  runtime: {
    precipitationMotion: null
  }
};
vm.createContext(context);
vm.runInContext(script, context, { filename: 'weather-precip-motion.js' });

test('precipitation motion clock never runs backward when frame timestamps wobble', () => {
  const first = context.getPrecipitationMotionNow(1000);
  const sameFrame = context.getPrecipitationMotionNow(1000);
  const backwards = context.getPrecipitationMotionNow(940);
  const largeJump = context.getPrecipitationMotionNow(10000);

  assert(sameFrame === first, 'same frame should reuse the same precipitation time');
  assert(backwards >= first, `backward frame timestamp should not reverse motion: ${backwards} < ${first}`);
  assert(largeJump - backwards <= 80.01, `large frame jump should be clamped, got ${largeJump - backwards}`);
});

test('falling progress is linear between hard top resets', () => {
  const a = context.getFallingLoopProgress(100, 0, 1000);
  const b = context.getFallingLoopProgress(240, 0, 1000);
  const nearBottom = context.getFallingLoopProgress(990, 0, 1000);
  const afterReset = context.getFallingLoopProgress(1010, 0, 1000);

  assert(b > a, `progress should increase inside one fall cycle: ${a} -> ${b}`);
  assert(nearBottom > 0.98, `near-bottom progress should be high, got ${nearBottom}`);
  assert(afterReset < 0.02, `cycle should hard reset to top, got ${afterReset}`);
});

test('rain and snow have separate background and foreground passes', () => {
  const rainScene = {
    condition: 'rain',
    rainIntensity: 0.8,
    rainClass: 'heavy',
    rain: 8,
    windLevel: 0.4,
    gustLevel: 0.1,
    windVector: { x: 0.8, y: 0 },
    isDay: true
  };
  const snowScene = {
    condition: 'snow',
    snowIntensity: 0.7,
    snowStyle: 'powder',
    windLevel: 0.25,
    gustLevel: 0.08,
    windVector: { x: -0.4, y: 0 },
    isDay: true
  };

  const rainBack = createCountingContext();
  const rainFront = createCountingContext();
  const snowBack = createCountingContext();
  const snowFront = createCountingContext();

  context.drawRainLayer(rainBack, rainScene, 1200, 'background');
  context.drawRainLayer(rainFront, rainScene, 1200, 'foreground');
  context.drawSnowLayer(snowBack, snowScene, 1200, 'background');
  context.drawSnowLayer(snowFront, snowScene, 1200, 'foreground');

  assert(rainBack.fillRects > 0, 'background rain should draw');
  assert(rainFront.fillRects > 0, 'foreground rain should draw');
  assert(snowBack.fillRects > 0, 'background snow should draw');
  assert(snowFront.fillRects > 0, 'foreground snow should draw');
  assert(rainBack.fillRects !== rainFront.fillRects, 'rain passes should not duplicate the same layer set');
  assert(snowBack.fillRects !== snowFront.fillRects, 'snow passes should not duplicate the same layer set');
});

function createCountingContext() {
  return {
    fillRects: 0,
    globalAlpha: 1,
    fillStyle: '#000',
    save() {},
    restore() {},
    fillRect() {
      this.fillRects += 1;
    }
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
