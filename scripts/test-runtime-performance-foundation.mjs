import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const runtimeSource = readFileSync(path.join(rootDir, 'ClientRuntime.html'), 'utf8');
const sceneSource = readFileSync(path.join(rootDir, 'ClientScene.html'), 'utf8');
const animationSource = readFileSync(path.join(rootDir, 'ClientAnimation.html'), 'utf8');
const runtime = createRuntime('system');
const context = {
  console,
  Date,
  Math,
  Number,
  Object,
  Float32Array,
  Float64Array,
  Uint8Array,
  WeakMap,
  runtime,
  navigator: { deviceMemory: 8, hardwareConcurrency: 8 },
  document: { hidden: false },
  window: {},
  performance: { now: () => 0 },
  canvasSize: 512
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(
  `${runtimeSource}\n${sceneSource}\n${animationSource}\n`
    + `globalThis.__perfFoundation = {
      ensureRuntimeScenePerfRing,
      recordRuntimeSceneFrame,
      getRuntimeWorldMotionPreference,
      isRuntimeBatterySaverEnabled,
      getEffectiveRuntimeMotionMode,
      syncRuntimeMotionMode,
      getRuntimeMainSceneFrameIntervalMs,
      shouldRenderRuntimeFrame,
      createSceneRenderQualityState,
      updateSceneRenderQualityGovernor,
      getSceneRenderQualityProfile,
      getSceneRenderQuality,
      getSceneRenderBudgetScale,
      getSceneRenderBudgetCount,
      bindRuntimeSceneSourceInvalidation,
      bindRuntimeMainSceneVisibility,
      bindRuntimeRenderInvalidationEvents,
      getAnimationFrameTiming,
      getAnimationFrame,
      touchSelectedAnimationRuntimeAsset
    };`,
  context,
  { filename: 'runtime-performance-foundation.js' }
);
const api = context.__perfFoundation;

test('scene performance samples reuse a fixed typed ring buffer', () => {
  runtime.scenePerf = null;
  const ring = api.ensureRuntimeScenePerfRing();
  const durations = ring.durationMs;
  const misses = ring.deadlineMissed;
  for (let index = 0; index < 500; index += 1) {
    api.recordRuntimeSceneFrame(index * 16, index % 10 === 0 ? 20 : 4, 1000 / 60, true);
  }
  assert(ring === runtime.scenePerf, 'expected one stable perf container');
  assert(ring.durationMs === durations && ring.deadlineMissed === misses, 'expected typed arrays to be reused');
  assert(ring.count === 360 && ring.sequence === 500, `expected capped 360-sample history, got ${ring.count}/${ring.sequence}`);
  assert(ring.deadlineMisses === 50, `expected measured deadline misses, got ${ring.deadlineMisses}`);
});

test('quality governor decisions are identical at 30, 60, and 120 Hz', () => {
  const tiers = [30, 60, 120].map((refreshRate) => {
    const state = api.createSceneRenderQualityState();
    state.tier = 'balanced';
    const step = 1000 / refreshRate;
    for (let sampleAt = 0; sampleAt <= 2200; sampleAt += step) {
      api.updateSceneRenderQualityGovernor(state, sampleAt, 14, false, true);
    }
    return state.tier;
  });
  assert(tiers.every((tier) => tier === 'low'), `refresh rate must not change the decision: ${tiers.join(', ')}`);
});

test('quality governor ignores intentional minigame and reduced-motion samples', () => {
  const state = api.createSceneRenderQualityState();
  state.tier = 'balanced';
  for (let sampleAt = 0; sampleAt <= 12000; sampleAt += 125) {
    api.updateSceneRenderQualityGovernor(state, sampleAt, 40, true, false);
  }
  assert(state.tier === 'balanced', `ineligible samples must not lower quality, tier=${state.tier}`);
  assert(state.downWindowStartedAt === null && state.fastWindowStartedAt === null, 'ineligible samples must reset hysteresis windows');
});

test('quality governor requires two seconds down and ten seconds up', () => {
  const state = api.createSceneRenderQualityState();
  state.tier = 'balanced';
  for (let sampleAt = 0; sampleAt < 2000; sampleAt += 100) {
    api.updateSceneRenderQualityGovernor(state, sampleAt, 14, false, true);
  }
  assert(state.tier === 'balanced', 'quality must not drop before the two-second window closes');
  api.updateSceneRenderQualityGovernor(state, 2000, 14, false, true);
  assert(state.tier === 'low', 'quality should drop after two sustained expensive seconds');

  for (let sampleAt = 2100; sampleAt < 12100; sampleAt += 100) {
    api.updateSceneRenderQualityGovernor(state, sampleAt, 4, false, true);
  }
  assert(state.tier === 'low', 'quality must not rise before ten continuous fast seconds');
  api.updateSceneRenderQualityGovernor(state, 12100, 4, false, true);
  assert(state.tier === 'balanced', 'quality should rise after ten continuous fast seconds');
});

test('motion modes and minigame visibility produce deterministic frame caps', () => {
  resetRuntime('full');
  runtime.minigame = {};
  runtime.mainSceneVisible = false;
  assert(!Number.isFinite(api.getRuntimeMainSceneFrameIntervalMs()), 'offscreen main scene must stop during a minigame');

  runtime.mainSceneVisible = true;
  assert(api.getRuntimeMainSceneFrameIntervalMs() === 250, 'visible minigame background must be capped at 4 FPS');
  runtime.lastRenderedFrameAt = null;
  let backgroundFrames = 0;
  for (let frameNow = 0; frameNow <= 1000; frameNow += 16) {
    runtime.renderInvalidated = true;
    backgroundFrames += api.shouldRenderRuntimeFrame(frameNow) ? 1 : 0;
  }
  assert(backgroundFrames <= 5, `input invalidations must preserve the 4 FPS background cap, frames=${backgroundFrames}`);

  resetRuntime({ motionMode: 'gentle' });
  const gentleInterval = api.getRuntimeMainSceneFrameIntervalMs();
  assert(gentleInterval >= 1000 / 30, `gentle mode must stay at or below 30 FPS, interval=${gentleInterval}`);

  resetRuntime('system');
  runtime.systemReducedMotion = true;
  assert(api.getEffectiveRuntimeMotionMode() === 'gentle', 'system preference must respect reduced-motion media state');

  resetRuntime('still');
  assert(!Number.isFinite(api.getRuntimeMainSceneFrameIntervalMs()), 'still mode must not have a continuous frame interval');
  assert(api.shouldRenderRuntimeFrame(0), 'still mode should render its initial invalidated frame');
  assert(!api.shouldRenderRuntimeFrame(16), 'still mode must stop after the initial frame');
  runtime.renderInvalidated = true;
  assert(api.shouldRenderRuntimeFrame(32), 'an explicit invalidation must render one still-mode frame');
});

test('battery saver forces the low gentle policy without overriding still mode', () => {
  resetRuntime({ motionMode: 'full', batterySaver: true });
  assert(api.isRuntimeBatterySaverEnabled(), 'battery saver should be read from world preferences');
  assert(api.getEffectiveRuntimeMotionMode() === 'gentle', 'battery saver must cap explicit full motion to gentle');
  let quality = api.getSceneRenderQuality(100);
  assert(quality.tier === 'low' && quality.motionMode === 'gentle',
    `battery saver must force low/gentle quality, got ${quality.tier}/${quality.motionMode}`);
  runtime.sceneFrameSnapshot = { quality: quality };
  assert(api.getSceneRenderBudgetCount(10, 'phenomenaScale', 1) === 4,
    'quality budget helper should deterministically reduce downstream effect counts');

  resetRuntime({ motionMode: 'still', batterySaver: true });
  assert(api.getEffectiveRuntimeMotionMode() === 'still', 'still must remain stricter than the battery-saver motion cap');
  quality = api.getSceneRenderQuality(200);
  assert(quality.tier === 'low' && quality.motionMode === 'still',
    `battery saver plus still must use the low still profile, got ${quality.tier}/${quality.motionMode}`);
});

test('still mode renders once when state or weather sources change', () => {
  resetRuntime('still');
  let schedules = 0;
  runtime.scheduleRuntimeRender = () => { schedules += 1; };
  runtime.weatherScene = { condition: 'clear' };
  runtime.spaceWeather = { kp: 1 };
  api.bindRuntimeSceneSourceInvalidation('state');
  api.bindRuntimeSceneSourceInvalidation('weatherScene');
  api.bindRuntimeSceneSourceInvalidation('spaceWeather');

  runtime.renderInvalidated = false;
  runtime.lastRenderedFrameAt = 10;
  const nextWeather = { condition: 'rain' };
  runtime.weatherScene = nextWeather;
  assert(schedules === 1 && runtime.renderInvalidated, 'a weather replacement should schedule one still frame');
  assert(api.shouldRenderRuntimeFrame(20), 'the weather invalidation should render exactly one frame');
  assert(!api.shouldRenderRuntimeFrame(21), 'still mode must stop again after the weather frame');
  runtime.weatherScene = nextWeather;
  assert(schedules === 1, 'assigning the identical weather object must not schedule another frame');

  runtime.state = {
    preferences: { world: { motionMode: 'still' } },
    minigames: { active: null }
  };
  assert(schedules === 2 && api.shouldRenderRuntimeFrame(30), 'a state replacement should schedule one still frame');
  assert(!api.shouldRenderRuntimeFrame(31), 'still mode must stop after the state frame');

  runtime.renderInProgress = true;
  runtime.spaceWeather = { kp: 5 };
  runtime.renderInProgress = false;
  assert(schedules === 2, 'a source normalized inside the current frame must not cause a redundant frame');
});

test('returning an offscreen minigame scene cancels the sparse poll before its first frame', () => {
  resetRuntime('full');
  runtime.state.minigames.active = { id: 'sporePop' };
  runtime.canvas = { closest() { return this; } };
  runtime.mainSceneVisibilityBound = false;
  runtime.mainSceneVisible = true;
  const order = [];
  runtime.cancelRuntimeRenderSchedule = () => { order.push('cancel'); runtime.renderTimer = 0; };
  runtime.scheduleRuntimeRender = () => { order.push('schedule'); };
  let observerCallback = null;
  context.window.IntersectionObserver = function(callback) {
    observerCallback = callback;
    this.observe = () => {};
  };
  api.bindRuntimeMainSceneVisibility();
  observerCallback([{ isIntersecting: true, intersectionRatio: 1 }]);
  observerCallback([{ isIntersecting: false, intersectionRatio: 0 }]);
  order.length = 0;
  runtime.renderTimer = 41;
  observerCallback([{ isIntersecting: true, intersectionRatio: 1 }]);
  assert(order.join(',') === 'cancel,schedule', `visible scene must cancel the 500 ms poll before rendering, got ${order.join(',')}`);
  assert(runtime.lastRenderedFrameAt === null && runtime.renderInvalidated, 'visible scene must restart with an immediate invalidated frame');
});

test('still-mode canvas pointer invalidation is targeted and coalesced', () => {
  resetRuntime('still');
  const listeners = new Map();
  context.document.addEventListener = (type, callback) => {
    const list = listeners.get(type) || [];
    list.push(callback);
    listeners.set(type, list);
  };
  let queuedFrame = null;
  let rafCount = 0;
  context.window.requestAnimationFrame = (callback) => {
    rafCount += 1;
    queuedFrame = callback;
    return rafCount;
  };
  context.window.setTimeout = () => 1;
  runtime.canvas = { id: 'scene' };
  runtime.renderInvalidationBound = false;
  let schedules = 0;
  runtime.scheduleRuntimeRender = () => { schedules += 1; };
  api.bindRuntimeRenderInvalidationEvents();

  const fire = (type, event) => (listeners.get(type) || []).forEach((callback) => callback(event));
  fire('pointermove', { target: runtime.canvas });
  fire('pointermove', { target: runtime.canvas });
  assert(rafCount === 1 && schedules === 0, 'rapid pointer moves should share one animation-frame invalidation');
  queuedFrame();
  assert(schedules === 1 && runtime.renderInvalidated, 'coalesced scene motion must request one still frame');
  fire('pointermove', { target: { id: 'settings' } });
  assert(rafCount === 1, 'unrelated UI pointer motion must not wake the main scene');
  fire('pointerdown', { target: runtime.canvas });
  assert(schedules === 2, 'a scene pointer edge must request one immediate still frame');

  runtime.state.preferences.world = { motionMode: 'full' };
  fire('pointerdown', { target: runtime.canvas });
  assert(schedules === 2, 'full motion must not add redundant pointer-edge invalidations');
});

test('animation timing is precomputed and selected-animation LRU touches are throttled', () => {
  const animation = { frameCount: 3, frameDurationsMs: [100, 200, 300], loop: true };
  const first = api.getAnimationFrameTiming(animation);
  const second = api.getAnimationFrameTiming(animation);
  assert(first === second, 'expected animation timing metadata to be cached by animation object');
  assert(first.totalDurationMs === 600, `expected a 600ms cycle, got ${first.totalDurationMs}`);
  assert(api.getAnimationFrame(animation, 99) === 0, 'expected the first timing bucket');
  assert(api.getAnimationFrame(animation, 100) === 1, 'expected the second timing bucket');
  assert(api.getAnimationFrame(animation, 300) === 2, 'expected the third timing bucket');
  assert(api.getAnimationFrame(animation, 600) === 0, 'expected looping timing to wrap');

  let clock = 0;
  let touches = 0;
  context.getRenderClockNow = () => clock;
  context.touchRuntimeAsset = () => { touches += 1; };
  runtime.lastAnimationAssetTouchKey = null;
  runtime.lastAnimationAssetTouchAt = null;
  api.touchSelectedAnimationRuntimeAsset('adult.idle');
  clock = 500;
  api.touchSelectedAnimationRuntimeAsset('adult.idle');
  clock = 1000;
  api.touchSelectedAnimationRuntimeAsset('adult.idle');
  api.touchSelectedAnimationRuntimeAsset('adult.sleep');
  assert(touches === 3, `expected transition/one-second LRU touches only, got ${touches}`);
});

function createRuntime(worldPreference) {
  return {
    state: {
      preferences: { world: worldPreference },
      minigames: { active: null }
    },
    minigame: null,
    reducedMotion: false,
    systemReducedMotion: false,
    mainSceneVisible: true,
    renderInvalidated: false,
    lastRenderedFrameAt: null,
    sceneFrameSnapshot: { quality: { targetFps: 60 } },
    sceneRenderQuality: null,
    debug: { enabled: false, sceneQuality: '' }
  };
}

function resetRuntime(worldPreference) {
  const fresh = createRuntime(worldPreference);
  for (const key of Object.keys(runtime)) {
    delete runtime[key];
  }
  Object.assign(runtime, fresh);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function test(name, callback) {
  try {
    callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}
