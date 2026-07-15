import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const script = readFileSync(path.join(rootDir, 'ClientScene.html'), 'utf8');
const animationScript = readFileSync(path.join(rootDir, 'ClientAnimation.html'), 'utf8');
const celestialScript = readFileSync(path.join(rootDir, 'ClientSceneCelestial.html'), 'utf8');
const phenomenaScript = readFileSync(path.join(rootDir, 'ClientScenePhenomena.html'), 'utf8');
const cloudScript = readFileSync(path.join(rootDir, 'ClientSceneWeatherClouds.html'), 'utf8');
const lifeScript = readFileSync(path.join(rootDir, 'ClientSceneLife.html'), 'utf8');
const interactionScript = readFileSync(path.join(rootDir, 'ClientInteraction.html'), 'utf8');
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

test('measured render cost lowers scene quality and gentle motion caps scene FPS', () => {
  const state = context.createSceneRenderQualityState();
  state.tier = 'balanced';
  context.runtime.sceneRenderQuality = state;
  for (let sampleAt = 0; sampleAt <= 2100; sampleAt += 1000 / 60) {
    context.updateSceneRenderQualityGovernor(state, sampleAt, 14, false, true);
  }
  let quality = context.getSceneRenderQuality(2200);
  assert(quality.tier === 'low', `sustained expensive render work should lower quality, tier=${quality.tier}`);
  assert(quality.grassScale < 0.6 && quality.precipitationScale < 0.7, 'low tier should materially reduce scene effects');
  assert(quality.lifeScale < 0.7 && quality.cloudScale < 0.7, 'low tier should expose broader scene budgets');

  context.runtime.reducedMotion = true;
  quality = context.getSceneRenderQuality(2300);
  assert(quality.motionMode === 'gentle', `system reduced motion should resolve to gentle, mode=${quality.motionMode}`);
  assert(quality.targetFps <= 30, `gentle motion must cap scene updates at 30 FPS, fps=${quality.targetFps}`);
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

test('production diagnostics retain ambient hit targets without full telemetry', () => {
  const visualContext = {
    console,
    Math,
    Number,
    Array,
    runtime: { debug: { enabled: false }, motionDiagnostics: null }
  };
  vm.createContext(visualContext);
  vm.runInContext(lifeScript, visualContext, { filename: 'ClientSceneLife.html' });
  vm.runInContext(interactionScript, visualContext, { filename: 'ClientInteraction.html' });

  visualContext.beginAmbientLifeDiagnostics(1000);
  assert(Array.isArray(visualContext.runtime.motionDiagnostics.butterflies),
    'butterfly hit samples must exist when runtime exposure is disabled');
  assert(Array.isArray(visualContext.runtime.motionDiagnostics.crawlers),
    'crawler hit samples must exist when runtime exposure is disabled');
  assert(visualContext.runtime.motionDiagnostics.flowers === null,
    'non-interactive detailed flower telemetry should remain disabled in production');

  visualContext.recordAmbientLifeSample('butterflies', { id: 'b1', x: 120, y: 160, alpha: 0.8 });
  visualContext.recordAmbientLifeSample('crawlers', { id: 'c1', x: 280, y: 420, alpha: 0.7 });
  const butterfly = visualContext.getAmbientPointerTarget({ x: 121, y: 159 }, 1000);
  const crawler = visualContext.getAmbientPointerTarget({ x: 279, y: 421 }, 1000);
  assert(butterfly && butterfly.kind === 'butterfly', 'visible production butterfly must remain pointer-reactive');
  assert(crawler && crawler.kind === 'crawler', 'visible production crawler must remain pointer-reactive');
});

test('scene discovery sync remains read-only throughout exclusive gameplay', () => {
  let exclusive = true;
  let recordCalls = 0;
  let persistCalls = 0;
  let renderCalls = 0;
  const discoveryContext = {
    console,
    Math,
    Number,
    Object,
    Array,
    runtime: {
      state: { discoveries: { sky: {}, environment: {} }, log: [] }
    },
    window: {
      PieczargotchiCore: {
        recordSkyDiscovery(state, id) {
          recordCalls += 1;
          state.discoveries.sky[id] = { discoveredAt: 1000 };
          return { newlyDiscovered: true, message: `Niebo: ${id}` };
        },
        recordEnvironmentDiscovery(state, id) {
          recordCalls += 1;
          state.discoveries.environment[id] = { discoveredAt: 1000 };
          return { newlyDiscovered: true, message: `Środowisko: ${id}` };
        }
      }
    },
    isRuntimeWorldDiscoveryMutationBlocked: () => exclusive,
    getCurrentWeatherScene: () => ({ condition: 'clear' }),
    addLog: (state, message) => state.log.push(message),
    persistRuntimeState: () => { persistCalls += 1; },
    renderUi: () => { renderCalls += 1; }
  };
  vm.createContext(discoveryContext);
  vm.runInContext(celestialScript, discoveryContext, { filename: 'ClientSceneCelestial.html' });
  vm.runInContext(phenomenaScript, discoveryContext, { filename: 'ClientScenePhenomena.html' });

  const before = JSON.stringify(discoveryContext.runtime.state);
  discoveryContext.syncSkyDiscoveries({ discoveries: ['meteor'] }, 1000);
  discoveryContext.syncEnvironmentDiscoveries({ discoveries: ['fogbow'] }, 1000);
  assert(JSON.stringify(discoveryContext.runtime.state) === before && recordCalls === 0 && persistCalls === 0 && renderCalls === 0,
    'active or pending exclusive sessions must stop scene discoveries before core mutation and persistence');

  exclusive = false;
  discoveryContext.syncSkyDiscoveries({ discoveries: ['meteor'] }, 1000);
  discoveryContext.syncEnvironmentDiscoveries({ discoveries: ['fogbow'] }, 1000);
  assert(recordCalls === 2 && persistCalls === 2 && renderCalls === 2,
    'normal play and terminal battle views must continue to record visible discoveries');
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
