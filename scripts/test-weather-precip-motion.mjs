import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const script = [
  'ClientCoreShared.html',
  'ClientSceneWeatherShared.html',
  'ClientSceneWeatherClouds.html',
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

test('precipitation motion clock does not wrap after one hour', () => {
  context.runtime.precipitationMotion = {
    lastFrameNow: 1000,
    frameNow: 1000,
    elapsedMs: 3599990,
    value: 3599990
  };

  const before = context.getPrecipitationMotionNow(1000);
  const after = context.getPrecipitationMotionNow(1020);

  assert(before === 3599990, `same frame should keep the near-hour motion time, got ${before}`);
  assert(after > before, `clock should continue past one hour instead of wrapping backward: ${before} -> ${after}`);
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

test('rain and snow vertical fall stays monotonic inside a cycle', () => {
  const cases = [
    ['rain', -152, 462],
    ['snow', -104, 486]
  ];

  for (const [label, spawnY, landingY] of cases) {
    const travelHeight = context.getPrecipitationTravelHeight(spawnY, landingY);
    const early = context.getPrecipitationFallY(spawnY, 0.42, travelHeight);
    const later = context.getPrecipitationFallY(spawnY, 0.50, travelHeight);

    assert(later > early, `${label} should keep falling inside one loop: ${early} -> ${later}`);
    assert(later <= landingY, `${label} should not fall past its grass landing point: ${later} > ${landingY}`);
  }
});

test('precipitation cycle speed ignores dynamic gust phase', () => {
  const rainProfile = {
    cycleBase: 800,
    minimumCycle: 340
  };
  const calmPhaseWind = {
    averageLevel: 0.26,
    level: 0.12,
    gustPulse: 0
  };
  const gustPhaseWind = {
    averageLevel: 0.26,
    level: 0.74,
    gustPulse: 0.42
  };

  const rainCalm = context.getRainCycleBase(rainProfile, 0.64, calmPhaseWind);
  const rainGust = context.getRainCycleBase(rainProfile, 0.64, gustPhaseWind);
  const snowCalm = context.getSnowCycleBase(0.72, calmPhaseWind, 1);
  const snowGust = context.getSnowCycleBase(0.72, gustPhaseWind, 1);

  assert(rainCalm === rainGust, `rain cycle should not shift with gust phase: ${rainCalm} -> ${rainGust}`);
  assert(snowCalm === snowGust, `snow cycle should not shift with gust phase: ${snowCalm} -> ${snowGust}`);
});

test('north-south wind keeps rain and snow cycle progress monotonic', () => {
  const verticalWindFrames = [
    { averageLevel: 0.28, level: 0.08, gustPulse: 0.00, directionX: 0, lateralFactor: 0, vectorY: 1 },
    { averageLevel: 0.28, level: 0.46, gustPulse: 0.24, directionX: 0, lateralFactor: 0, vectorY: 1 },
    { averageLevel: 0.28, level: 0.18, gustPulse: 0.04, directionX: 0, lateralFactor: 0, vectorY: 1 }
  ];
  const rainProfile = {
    cycleBase: 800,
    minimumCycle: 340
  };
  const seedPhase = 0.37;
  const times = [1200, 1320, 1440];

  const rainProgress = verticalWindFrames.map((wind, index) => {
    const cycleMs = context.getRainCycleBase(rainProfile, 0.64, wind);
    return context.getFallingLoopProgress(times[index], seedPhase * cycleMs, cycleMs);
  });
  const snowProgress = verticalWindFrames.map((wind, index) => {
    const cycleMs = context.getSnowCycleBase(0.72, wind, 1);
    return context.getFallingLoopProgress(times[index], seedPhase * cycleMs, cycleMs);
  });

  assert(rainProgress[1] > rainProgress[0], `rain should keep falling in north-south wind: ${rainProgress.join(' -> ')}`);
  assert(rainProgress[2] > rainProgress[1], `rain should keep falling after gust phase changes: ${rainProgress.join(' -> ')}`);
  assert(snowProgress[1] > snowProgress[0], `snow should keep falling in north-south wind: ${snowProgress.join(' -> ')}`);
  assert(snowProgress[2] > snowProgress[1], `snow should keep falling after gust phase changes: ${snowProgress.join(' -> ')}`);
});

test('cloud layer motion is driven by wind strength and direction', () => {
  const layer = {
    windResponse: 0.62,
    depthResponse: 0.40,
    shearResponse: 0.62
  };
  const calmScene = {
    windSpeed: 4,
    windGusts: 5,
    windDirection: 90,
    windLevel: 0.05,
    gustLevel: 0.02,
    windVector: { x: -1, y: 0 }
  };
  const windyEastScene = {
    windSpeed: 46,
    windGusts: 72,
    windDirection: 270,
    windLevel: 0.62,
    gustLevel: 0.47,
    windVector: { x: 1, y: 0 }
  };
  const windyWestScene = {
    ...windyEastScene,
    windDirection: 90,
    windVector: { x: -1, y: 0 }
  };

  const calm = context.getCloudLayerWindMotion(calmScene, context.getDynamicWindState(calmScene, 1400), layer, 1, 52, 1400, 0.016);
  const windyEast = context.getCloudLayerWindMotion(windyEastScene, context.getDynamicWindState(windyEastScene, 1400), layer, 1, 52, 1400, 0.016);
  const windyWest = context.getCloudLayerWindMotion(windyWestScene, context.getDynamicWindState(windyWestScene, 1400), layer, 1, 52, 1400, 0.016);

  assert(windyEast.speed > calm.speed * 2.5, `windy clouds should move much faster than calm clouds: ${calm.speed} -> ${windyEast.speed}`);
  assert(windyEast.directionX > 0.8, `eastbound cloud wind should be positive, got ${windyEast.directionX}`);
  assert(windyWest.directionX < -0.8, `westbound cloud wind should be negative, got ${windyWest.directionX}`);
  assert(windyEast.shear > 0, `eastbound cloud shear should be positive, got ${windyEast.shear}`);
  assert(windyWest.shear < 0, `westbound cloud shear should be negative, got ${windyWest.shear}`);
  assert(windyEast.streakAlpha > calm.streakAlpha, `windy clouds should draw stronger wind wisps: ${calm.streakAlpha} -> ${windyEast.streakAlpha}`);
});

test('cloud form profiles preserve realistic altitude, thickness, and scale cues', () => {
  const cirrus = context.getCloudFormProfile('cirrus', 0, 24, { condition: 'clear' });
  const cumulus = context.getCloudFormProfile('cumulus', 2, 34, { condition: 'clear' });
  const nimbostratus = context.getCloudFormProfile('nimbostratus', 1, 92, { condition: 'rain' });
  const cumulonimbus = context.getCloudFormProfile('cumulonimbus', 2, 96, { condition: 'storm' });

  assert(cirrus.yOffset < 0, `high cirrus should sit higher than its layer baseline, got ${cirrus.yOffset}`);
  assert(cirrus.heightScale < cumulus.heightScale, `cirrus should be thinner than cumulus: ${cirrus.heightScale} >= ${cumulus.heightScale}`);
  assert(nimbostratus.opticalThickness > cumulus.opticalThickness, `rain cloud should be optically heavier than fair cumulus: ${nimbostratus.opticalThickness} <= ${cumulus.opticalThickness}`);
  assert(cumulonimbus.verticalGrowth > 0.8, `storm tower should carry strong vertical growth, got ${cumulonimbus.verticalGrowth}`);
  assert(cumulonimbus.shadowStrength > nimbostratus.shadowStrength, `cumulonimbus should cast the strongest visual weight: ${cumulonimbus.shadowStrength} <= ${nimbostratus.shadowStrength}`);
});

test('cloud render layers apply profile-specific height and parallax traits', () => {
  const palette = { cloud: '#b7c2c9', cloudLight: '#eef3e9' };
  const fairScene = {
    condition: 'clear',
    cloudCoverHigh: 34,
    cloudCoverMid: 42,
    cloudCoverLow: 30,
    cloudForms: {
      high: 'cirrus',
      mid: 'altocumulus',
      low: 'cumulus'
    }
  };
  const stormScene = {
    condition: 'storm',
    cloudCoverHigh: 76,
    cloudCoverMid: 90,
    cloudCoverLow: 96,
    cloudForms: {
      high: 'cirrostratus',
      mid: 'nimbostratus',
      low: 'cumulonimbus'
    }
  };

  const fair = context.getCloudRenderLayers(fairScene, palette);
  assert(fair[0].y < fair[1].y && fair[1].y < fair[2].y, `fair-weather cloud layers should stay ordered by altitude: ${fair.map((layer) => layer.y).join(', ')}`);
  assert(fair[0].windResponse > fair[2].windResponse, `high clouds should respond more to upper flow than low cumulus: ${fair[0].windResponse} <= ${fair[2].windResponse}`);
  assert(fair[0].heightScale < fair[2].heightScale, `high cirrus should render thinner than low cumulus: ${fair[0].heightScale} >= ${fair[2].heightScale}`);

  const storm = context.getCloudRenderLayers(stormScene, palette);
  assert(storm[2].form === 'cumulonimbus', `storm low layer should render as cumulonimbus, got ${storm[2].form}`);
  assert(storm[2].y < 100, `storm tower should start visually higher than a normal low layer, got y=${storm[2].y}`);
  assert(storm[2].opticalThickness > storm[0].opticalThickness, `storm tower should be optically heavier than high veil: ${storm[2].opticalThickness} <= ${storm[0].opticalThickness}`);
  assert(storm[1].veilStrength > 0.4, `nimbostratus should expose rain/snow veil cue, got ${storm[1].veilStrength}`);
});

test('cloud slot lifecycle fades in and dissolves without abrupt popping', () => {
  const slot = {
    birthAt: 1000,
    growthDuration: 5000,
    lifeDuration: 26000,
    dissolveDuration: 6000
  };

  const newborn = context.getCloudSlotLife(slot, 1000);
  const growing = context.getCloudSlotLife(slot, 3500);
  const mature = context.getCloudSlotLife(slot, 9000);
  const dissolving = context.getCloudSlotLife(slot, 24000);
  const finished = context.getCloudSlotLife(slot, 28050);

  assert(newborn.alpha <= 0.02, `new cloud should begin almost invisible, got ${newborn.alpha}`);
  assert(growing.alpha > newborn.alpha, `cloud should fade in during growth: ${newborn.alpha} -> ${growing.alpha}`);
  assert(mature.alpha > 0.95, `mature cloud should be fully present, got ${mature.alpha}`);
  assert(dissolving.alpha < mature.alpha, `cloud should fade out near the end of life: ${mature.alpha} -> ${dissolving.alpha}`);
  assert(finished.done === true, 'cloud should report done after dissolve completes');
});

test('rain and snow land at varied grass heights instead of the canvas bottom', () => {
  const cases = [
    ['rain foreground', 'foreground', 'rain', 430, 472],
    ['rain background', 'background', 'rain', 416, 456],
    ['snow foreground', 'foreground', 'snow', 432, 498],
    ['snow background', 'background', 'snow', 418, 476]
  ];

  for (const [label, depth, kind, minY, maxY] of cases) {
    const landings = Array.from({ length: 36 }, (_, index) => (
      context.getPrecipitationGrassLandingY(9000 + index * 37, depth, kind)
    ));
    const lowest = Math.min(...landings);
    const highest = Math.max(...landings);
    const spread = highest - lowest;

    assert(lowest >= minY, `${label} landing should stay in grass band: min ${lowest} < ${minY}`);
    assert(highest <= maxY, `${label} landing should stay in grass band: max ${highest} > ${maxY}`);
    assert(spread >= 22, `${label} should use varied landing heights, spread=${spread}`);
    assert(context.getPrecipitationCullBottom(highest, kind) <= 508, `${label} should not cull below the full canvas bottom`);
  }
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

test('foreground rain covers left, center, and right side for every rain strength', () => {
  const samples = [
    ['drizzle', 0.18],
    ['light', 0.32],
    ['moderate', 0.64],
    ['heavy', 0.88],
    ['violent', 1]
  ];

  for (const [rainClass, rainIntensity] of samples) {
    context.runtime.precipitationMotion = null;
    const ctx = createRecordingContext();
    context.drawRainLayer(ctx, {
      condition: rainClass === 'violent' ? 'storm' : 'rain',
      rainIntensity,
      rainClass,
      rain: rainClass === 'drizzle' ? 0.18 : rainClass === 'light' ? 0.8 : rainClass === 'moderate' ? 4 : 10,
      windLevel: 0.08,
      gustLevel: 0.03,
      windVector: { x: 0.22, y: 0 },
      isDay: true
    }, 1800, 'foreground');
    assertHorizontalCoverage(ctx, `foreground ${rainClass} rain`);
  }
});

test('foreground snow covers left, center, and right side for snow styles', () => {
  const samples = [
    ['powder', 0.28],
    ['wet', 0.42],
    ['blowing', 0.72]
  ];

  for (const [snowStyle, snowIntensity] of samples) {
    context.runtime.precipitationMotion = null;
    const ctx = createRecordingContext();
    context.drawSnowLayer(ctx, {
      condition: 'snow',
      snowIntensity,
      snowStyle,
      windLevel: snowStyle === 'blowing' ? 0.35 : 0.08,
      gustLevel: snowStyle === 'blowing' ? 0.2 : 0.04,
      windVector: { x: snowStyle === 'blowing' ? -0.45 : 0.16, y: 0 },
      isDay: true
    }, 1800, 'foreground');
    assertHorizontalCoverage(ctx, `foreground ${snowStyle} snow`);
  }
});

test('foreground rain and snow render into varied grass height without crossing the full canvas', () => {
  const samples = [
    [
      'foreground heavy rain',
      context.drawRainLayer,
      {
        condition: 'rain',
        rainIntensity: 0.88,
        rainClass: 'heavy',
        rain: 10,
        windLevel: 0.42,
        gustLevel: 0.2,
        windVector: { x: 0.65, y: 0 },
        isDay: true
      }
    ],
    [
      'foreground powder snow',
      context.drawSnowLayer,
      {
        condition: 'snow',
        snowIntensity: 0.72,
        snowStyle: 'powder',
        windLevel: 0.35,
        gustLevel: 0.12,
        windVector: { x: -0.45, y: 0 },
        isDay: true
      }
    ]
  ];

  for (const [label, drawLayer, scene] of samples) {
    let deepest = -Infinity;
    let highest = Infinity;
    for (let motionNow = 0; motionNow <= 7200; motionNow += 120) {
      context.runtime.precipitationMotion = {
        lastFrameNow: motionNow,
        frameNow: motionNow,
        elapsedMs: motionNow,
        value: motionNow
      };
      const ctx = createRecordingContext();
      drawLayer(ctx, scene, motionNow, 'foreground');
      deepest = Math.max(deepest, getDeepestVisiblePixel(ctx));
      highest = Math.min(highest, getHighestVisibleGrassPixel(ctx));
    }

    assert(highest <= 456, `${label} should enter the grass band, highest grass y=${highest}`);
    assert(deepest >= 468, `${label} should render below the top grass band, deepest y=${deepest}`);
    assert(deepest <= 520, `${label} should not run through the full canvas, deepest y=${deepest}`);
  }
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

function createRecordingContext() {
  return {
    fillRects: 0,
    rects: [],
    globalAlpha: 1,
    fillStyle: '#000',
    save() {},
    restore() {},
    fillRect(x, y, width, height) {
      this.fillRects += 1;
      this.rects.push({ x, y, width, height });
    }
  };
}

function assertHorizontalCoverage(ctx, label) {
  const visibleRects = ctx.rects.filter((rect) => (
    rect.x + rect.width >= -4
    && rect.x <= 516
    && rect.y + rect.height >= -4
    && rect.y <= 516
  ));
  assert(visibleRects.length > 0, `${label} should draw visible foreground precipitation`);
  assert(visibleRects.some((rect) => rect.x < 150), `${label} should reach the left side`);
  assert(visibleRects.some((rect) => rect.x >= 190 && rect.x <= 322), `${label} should reach the center`);
  assert(visibleRects.some((rect) => rect.x > 350), `${label} should reach the right side`);
}

function getDeepestVisiblePixel(ctx) {
  return ctx.rects.reduce((deepest, rect) => {
    if (rect.x + rect.width < -4 || rect.x > 516 || rect.y + rect.height < -4 || rect.y > 524) {
      return deepest;
    }
    return Math.max(deepest, rect.y + rect.height);
  }, -Infinity);
}

function getHighestVisibleGrassPixel(ctx) {
  return ctx.rects.reduce((highest, rect) => {
    if (rect.x + rect.width < -4 || rect.x > 516 || rect.y + rect.height < 424 || rect.y > 520) {
      return highest;
    }
    return Math.min(highest, rect.y);
  }, Infinity);
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
