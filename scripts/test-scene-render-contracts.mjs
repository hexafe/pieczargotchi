import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const script = readFileSync(path.join(rootDir, 'ClientScene.html'), 'utf8');
const animationScript = readFileSync(path.join(rootDir, 'ClientAnimation.html'), 'utf8');
const celestialScript = readFileSync(path.join(rootDir, 'ClientSceneCelestial.html'), 'utf8');
const cloudScript = readFileSync(path.join(rootDir, 'ClientSceneWeatherClouds.html'), 'utf8');
const calls = {
  scene: 0,
  palette: 0,
  surface: 0
};
const scene = { condition: 'clear', isDay: true };
const context = {
  console,
  Math,
  Number,
  canvasSize: 512,
  navigator: {
    deviceMemory: 8,
    hardwareConcurrency: 8
  },
  runtime: {
    reducedMotion: false,
    debug: { enabled: false },
    sceneFrameSnapshot: null,
    sceneRenderQuality: null
  },
  getCurrentWeatherScene() {
    calls.scene += 1;
    return scene;
  },
  getScenePalette(value) {
    calls.palette += 1;
    return { ground: '#000000', source: value };
  },
  getWeatherSurfaceState() {
    calls.surface += 1;
    return { wetness: 0, snowCover: 0 };
  },
  getSceneAmbientGradeProfile() {
    return {
      alpha: 0.25,
      color: '#465570',
      compositeOperation: 'multiply',
      x: 0,
      y: 0,
      width: 512,
      height: 512
    };
  }
};

vm.createContext(context);
vm.runInContext(script, context, { filename: 'ClientScene.html' });

test('one frame reuses a single scene, palette, and weather-surface snapshot', () => {
  const first = context.getSceneFrameSnapshot(1000);
  const sameFrame = context.getSceneFrameSnapshot(1000);
  const nextFrame = context.getSceneFrameSnapshot(1016);

  assert(first === sameFrame, 'same frame should return the same snapshot object');
  assert(nextFrame !== first, 'next frame should refresh the snapshot');
  assert(calls.scene === 2, `weather scene should be sampled once per frame, calls=${calls.scene}`);
  assert(calls.palette === 2, `palette should be sampled once per frame, calls=${calls.palette}`);
  assert(calls.surface === 2, `surface should be sampled once per frame, calls=${calls.surface}`);
});

test('sustained slow frames lower scene quality and reduced motion uses the cheapest tier', () => {
  context.runtime.sceneRenderQuality = {
    tier: 'balanced',
    lastFrameAt: 0,
    slowFrames: 0,
    fastFrames: 0
  };
  let quality = null;
  for (let index = 1; index <= 36; index += 1) {
    quality = context.getSceneRenderQuality(index * 34);
  }
  assert(quality.tier === 'low', `slow frame streak should lower quality, tier=${quality.tier}`);
  assert(quality.grassScale < 0.6 && quality.precipitationScale < 0.7, 'low tier should materially reduce scene effects');

  context.runtime.reducedMotion = true;
  quality = context.getSceneRenderQuality(2000);
  assert(quality.tier === 'reduced', `reduced motion should select reduced tier, tier=${quality.tier}`);
  assert(quality.grassScale <= 0.32, `reduced tier should cap grass density, scale=${quality.grassScale}`);
  context.runtime.reducedMotion = false;
});

test('ambient grade is one crisp full-canvas pass without a y=128 seam', () => {
  const operations = [];
  const ctx = {
    globalCompositeOperation: 'source-over',
    globalAlpha: 1,
    fillStyle: '#000000',
    save() {
      operations.push('save');
    },
    fillRect(x, y, width, height) {
      operations.push({ x, y, width, height, alpha: this.globalAlpha, composite: this.globalCompositeOperation });
    },
    restore() {
      operations.push('restore');
    }
  };

  context.drawSceneAmbientGrade(ctx, scene, { nightFactor: 1 });
  const fill = operations.find((operation) => typeof operation === 'object');
  assert(fill && fill.x === 0 && fill.y === 0 && fill.width === 512 && fill.height === 512, 'ambient grade should cover the complete scene surface');
  assert(fill.composite === 'multiply' && fill.alpha === 0.25, 'ambient grade should preserve pixel edges with one multiply pass');
  assert(operations.filter((operation) => typeof operation === 'object').length === 1, 'ambient grade should use exactly one fill call');
});

test('ambient composite is idempotent and emits light only after the grade', () => {
  const order = [];
  const ctx = {
    globalCompositeOperation: 'source-over',
    globalAlpha: 1,
    fillStyle: '#000000',
    save() {},
    fillRect() {
      order.push('grade');
    },
    restore() {}
  };
  context.runtime.sceneFrameSnapshot = null;
  context.drawSceneEmissiveForeground = () => order.push('emissive');

  assert(context.drawSceneAmbientComposite(ctx, 3200) === true, 'first composite call should draw');
  assert(context.drawSceneAmbientComposite(ctx, 3200) === false, 'second composite call in one frame should be ignored');
  assert(order.join(',') === 'grade,emissive', `grade must precede emission exactly once, order=${order.join(',')}`);
});

test('frame composition grades the completed non-emissive scene before overlays', () => {
  const ground = animationScript.indexOf('drawGroundForeground(ctx, frameNow)');
  const precipitation = animationScript.indexOf('drawWeatherPrecipitationForeground(ctx, frameNow)');
  const composite = animationScript.indexOf('drawSceneAmbientComposite(ctx, frameNow)');
  const immersion = animationScript.indexOf('drawImmersionForeground(ctx, frameNow, wallNow)');
  const effects = animationScript.indexOf('drawEffects(ctx, frameNow)');
  assert(ground >= 0 && precipitation > ground, 'foreground ground and precipitation should render before grading');
  assert(composite > precipitation, 'ambient grade should run after the final non-emissive weather pass');
  assert(immersion > composite && effects > immersion, 'immersive and temporary effects should stay emissive after grading');
});

test('pixel sun uses layered corona and irregular rays beyond the hit disc', () => {
  const visualContext = {
    console,
    Math,
    Number,
    runtime: {},
    clamp(value, min, max, fallback) {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? Math.min(max, Math.max(min, numeric)) : fallback;
    }
  };
  vm.createContext(visualContext);
  vm.runInContext(celestialScript, visualContext, { filename: 'ClientSceneCelestial.html' });
  const fills = [];
  const ctx = {
    globalAlpha: 1,
    fillStyle: '#000000',
    save() {},
    restore() {},
    fillRect(x, y, width, height) {
      fills.push({ x, y, width, height, alpha: this.globalAlpha });
    }
  };

  visualContext.drawPixelSun(ctx, { x: 120, y: 70, size: 40, coreInset: 9, coreSize: 22 }, {
    sun: '#ffe596',
    sunCore: '#fff3b8'
  }, 920);

  assert(fills.length >= 24, `sun should be built from a layered pixel silhouette, fills=${fills.length}`);
  assert(fills.some((fill) => fill.x < 120 || fill.y < 70), 'corona should extend beyond the physical hit disc');
  assert(fills.some((fill) => fill.x + fill.width > 160 || fill.y + fill.height > 110), 'rays should extend on both sides of the disc');
  assert(new Set(fills.map((fill) => fill.alpha.toFixed(2))).size >= 3, 'corona should use several restrained alpha rings');
});

test('stratus is assembled from staggered clusters instead of rectangular slabs', () => {
  const visualContext = {
    console,
    Math,
    Number,
    runtime: {},
    seededUnit() {
      return 0.5;
    },
    clamp(value, min, max, fallback) {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? Math.min(max, Math.max(min, numeric)) : fallback;
    }
  };
  vm.createContext(visualContext);
  vm.runInContext(cloudScript, visualContext, { filename: 'ClientSceneWeatherClouds.html' });
  const fills = [];
  const ctx = {
    globalAlpha: 1,
    fillStyle: '#000000',
    save() {},
    restore() {},
    fillRect(x, y, width, height) {
      fills.push({ x, y, width, height });
    }
  };

  visualContext.drawPixelStratusCloud(ctx, 20, 30, '#91a0a8', '#d9e1dd', 1, 0.8, 'stratus', {});

  assert(fills.length >= 16, `stratus should use many pixel clusters, fills=${fills.length}`);
  assert(Math.max(...fills.map((fill) => fill.width)) < 64, 'no stratus cluster may become a flat full-width slab');
  assert(new Set(fills.map((fill) => fill.y)).size >= 6, 'staggered cloud clusters should occupy varied vertical rows');
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
