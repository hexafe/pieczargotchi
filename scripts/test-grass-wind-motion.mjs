import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const script = [
  'ClientCoreShared.html',
  'ClientSceneWeatherShared.html',
  'ClientSceneGround.html'
].map((fileName) => readFileSync(path.join(rootDir, fileName), 'utf8')).join('\n');

const context = {
  console,
  Math,
  Number,
  runtime: {
    input: {
      inside: false,
      x: null,
      y: null,
      previousX: null,
      previousY: null,
      lastMoveAt: 0,
      lastDownAt: 0,
      speed: 0
    },
    motionDiagnostics: null
  },
  clamp(value, min, max, fallback) {
    const next = Number.isFinite(value) ? value : fallback;
    return Math.min(max, Math.max(min, next));
  }
};

vm.createContext(context);
vm.runInContext(script, context, { filename: 'grass-wind-motion.js' });

test('storm grass bends with wind direction while keeping roots damped', () => {
  const eastStorm = {
    condition: 'storm',
    rainIntensity: 0.82,
    windSpeed: 52,
    windGusts: 84,
    windLevel: 0.78,
    gustLevel: 0.58,
    windDirection: 270,
    windVector: { x: 1, y: 0 }
  };
  const westStorm = {
    ...eastStorm,
    windDirection: 90,
    windVector: { x: -1, y: 0 }
  };

  const east = context.getGrassFieldState(eastStorm, 4200, { wetness: 0.76, snowCover: 0 });
  const west = context.getGrassFieldState(westStorm, 4200, { wetness: 0.76, snowCover: 0 });
  const eastBend = context.getGrassWeatherBend(east, 56, true);
  const westBend = context.getGrassWeatherBend(west, 56, true);

  assert(east.patchSway > 0, `east storm should push grass right, patchSway=${east.patchSway}`);
  assert(west.patchSway < 0, `west storm should push grass left, patchSway=${west.patchSway}`);
  assert(eastBend > 0, `east storm weather bend should be positive, got ${eastBend}`);
  assert(westBend < 0, `west storm weather bend should be negative, got ${westBend}`);
  assert(east.rootHold < 0.78, `storm roots should damp carpet movement, rootHold=${east.rootHold}`);
  assert(east.tipWhip > 2.8, `storm gusts should add visible tip whip, tipWhip=${east.tipWhip}`);
  assert(east.heightScale < 0.92, `storm should flatten grass height, heightScale=${east.heightScale}`);
});

test('traveling wind wave is directional and stronger in the foreground', () => {
  const field = context.getGrassFieldState({
    condition: 'clear',
    windSpeed: 38,
    windGusts: 60,
    windLevel: 0.55,
    gustLevel: 0.38,
    windDirection: 270,
    windVector: { x: 1, y: 0 }
  }, 7600, { wetness: 0.12, snowCover: 0 });

  const samples = [84, 156, 230, 312, 418].map((x, index) => ({
    front: context.getGrassTravelingWindWave(x, 58, field, 9191 + index * 47, true),
    back: context.getGrassTravelingWindWave(x, 58, field, 9191 + index * 47, false)
  }));
  const strongestFront = Math.max(...samples.map((sample) => Math.abs(sample.front)));
  const strongestBack = Math.max(...samples.map((sample) => Math.abs(sample.back)));
  assert(samples.some((sample) => sample.front > 0), `eastbound wind wave should have positive samples, got ${JSON.stringify(samples)}`);
  assert(strongestFront > strongestBack, `foreground wave should be stronger: front=${strongestFront}, back=${strongestBack}`);
});

test('grass patch sprite bends tips more than anchored roots', () => {
  const stormScene = {
    condition: 'storm',
    rainIntensity: 0.72,
    windSpeed: 48,
    windGusts: 78,
    windLevel: 0.70,
    gustLevel: 0.52,
    windDirection: 270,
    windVector: { x: 1, y: 0 }
  };
  const eastField = context.getGrassFieldState(stormScene, 6800, { wetness: 0.68, snowCover: 0 });
  const westField = context.getGrassFieldState({
    ...stormScene,
    windDirection: 90,
    windVector: { x: -1, y: 0 }
  }, 6800, { wetness: 0.68, snowCover: 0 });

  const eastRoot = context.getGrassPatchSliceOffset(eastField, 248, 0.10, 6719, true);
  const eastTip = context.getGrassPatchSliceOffset(eastField, 248, 0.92, 6719, true);
  const westTip = context.getGrassPatchSliceOffset(westField, 248, 0.92, 6719, true);

  assert(eastTip > 0, `eastbound patch tip should bend right, got ${eastTip}`);
  assert(westTip < 0, `westbound patch tip should bend left, got ${westTip}`);
  assert(Math.abs(eastTip) > Math.abs(eastRoot) * 2.2, `tips should move much more than roots: root=${eastRoot}, tip=${eastTip}`);
});

test('grass patch uses an eight-draw tapered clearing without per-strip redraws', () => {
  const field = context.getGrassFieldState({
    condition: 'clear',
    windSpeed: 18,
    windGusts: 28,
    windLevel: 0.22,
    gustLevel: 0.12,
    windDirection: 270,
    windVector: { x: 1, y: 0 }
  }, 4200, { wetness: 0.08, snowCover: 0 });
  const ctx = {
    drawImages: 0,
    calls: [],
    alphas: [],
    globalAlpha: 1,
    save() {},
    restore() {
      this.globalAlpha = 1;
    },
    drawImage(...args) {
      this.drawImages += 1;
      this.calls.push(args);
      this.alphas.push(this.globalAlpha);
    }
  };
  const drawCalls = context.drawGrassPatchToBottom(ctx, {}, 354, 512, 158, field, 4200);

  assert(drawCalls === ctx.drawImages, `reported draw calls should match canvas calls: ${drawCalls} != ${ctx.drawImages}`);
  assert(drawCalls === 8, `grass raster should stay within an eight-draw budget, got ${drawCalls}`);
  assert(ctx.calls[0][7] <= 220 && ctx.calls[1][5] >= 320, 'top band should preserve a wide, stage-aware spore corridor');
  assert(ctx.alphas[6] === 0.3, `center grass should stay subdued behind the mushroom, alpha=${ctx.alphas[6]}`);
  assert(ctx.calls[7][2] >= 120 && ctx.calls[7][7] >= 570, 'lowest band should reconnect the clearing to a full-width grass base');
});

test('foreground grass keeps stage-aware face clearance and a small blade budget', () => {
  for (const stage of ['spore', 'baby', 'young', 'adult', 'legendary']) {
    const profile = context.getGroundForegroundProfile(stage);
    const tallLayers = [profile.primary, profile.secondary, profile.tall, profile.canopy];
    const crossesCenter = tallLayers.some((layer) => layer.xBands.some((band) => band[0] < 256 && band[1] > 256));
    const bladeBudget = [profile.primary, profile.secondary, profile.groundline, profile.tall, profile.canopy, profile.cover]
      .reduce((total, layer) => total + layer.count, 0);

    assert(!crossesCenter, `${stage} tall grass should leave the mushroom face corridor clear`);
    assert(bladeBudget <= 76, `${stage} foreground blade budget should stay compact, got ${bladeBudget}`);
    assert(profile.cover.heightMax <= 24, `${stage} central occluder should cover only the feet, height=${profile.cover.heightMax}`);
  }
});

test('decorations and their emissive pixels render before the light foreground occluder', () => {
  const operations = [];
  const originals = {
    getSceneFrameSnapshot: context.getSceneFrameSnapshot,
    drawSceneAmbientGrade: context.drawSceneAmbientGrade,
    drawPatchDecorations: context.drawPatchDecorations,
    drawWindResponsiveGrassBlades: context.drawWindResponsiveGrassBlades,
    drawGrassBottomEdgeFill: context.drawGrassBottomEdgeFill,
    recordGrassForegroundDiagnostics: context.recordGrassForegroundDiagnostics
  };
  context.runtime.state = { stage: 'spore', decorations: { active: ['sporeLantern'] } };
  context.getSceneFrameSnapshot = () => ({
    scene: { condition: 'clear', windVector: { x: 0, y: 0 } },
    palette: { blade: '#91ca60', groundLight: '#83b955' },
    surface: { wetness: 0, snowCover: 0 },
    quality: { grassScale: 1 },
    decorationsDrawn: false
  });
  context.drawSceneAmbientGrade = () => operations.push('grade');
  context.drawPatchDecorations = (ctx, palette, now, scene, pass) => operations.push(`decorations-${pass}`);
  context.drawWindResponsiveGrassBlades = () => operations.push('grass');
  context.drawGrassBottomEdgeFill = () => operations.push('grass-edge');
  context.recordGrassForegroundDiagnostics = () => {};

  context.drawGroundForeground({}, 4200);

  assert(operations[0] === 'decorations-base', `decoration bodies should be rooted before ambient lighting, order=${operations.join(' -> ')}`);
  assert(operations[1] === 'grade', `ambient grade should light the sprite, grass raster, and decoration bodies together, order=${operations.join(' -> ')}`);
  assert(operations[2] === 'decorations-emissive', `emissive pixels should bypass the ambient grade, order=${operations.join(' -> ')}`);
  assert(operations.slice(3).every((operation) => operation.startsWith('grass')), `only the light occluder should follow decorations, order=${operations.join(' -> ')}`);

  Object.assign(context, originals);
});

test('depth wind rolls the grass without becoming a hard lateral shove', () => {
  const crosswind = context.getGrassFieldState({
    condition: 'clear',
    windSpeed: 44,
    windGusts: 64,
    windLevel: 0.62,
    gustLevel: 0.42,
    windDirection: 270,
    windVector: { x: 1, y: 0 }
  }, 8200, { wetness: 0.08, snowCover: 0 });
  const headwind = context.getGrassFieldState({
    condition: 'clear',
    windSpeed: 44,
    windGusts: 64,
    windLevel: 0.62,
    gustLevel: 0.42,
    windDirection: 0,
    windVector: { x: 0, y: 1 }
  }, 8200, { wetness: 0.08, snowCover: 0 });

  const crossCorridor = context.getGrassWindCorridor(236, 58, crosswind, 9341, true);
  const headCorridor = context.getGrassWindCorridor(236, 58, headwind, 9341, true);
  const headWave = context.getGrassTravelingWindWave(236, 58, headwind, 9341, true);
  const crossWave = context.getGrassTravelingWindWave(236, 58, crosswind, 9341, true);

  assert(headwind.depthFactor > 0.9, `headwind should record depth factor, got ${headwind.depthFactor}`);
  assert(Math.abs(headwind.patchSway) < Math.abs(crosswind.patchSway) * 0.55, `headwind patch sway should stay restrained: head=${headwind.patchSway}, cross=${crosswind.patchSway}`);
  assert(Math.abs(headCorridor.depthRoll) > 0.08, `headwind should add rolling motion, got ${headCorridor.depthRoll}`);
  assert(Math.abs(headWave) < Math.abs(crossWave) * 0.82, `headwind should be subtler than crosswind: head=${headWave}, cross=${crossWave}`);
  assert(crossCorridor.lateralStrength > headCorridor.lateralStrength, `crosswind should keep stronger lateral strength: cross=${crossCorridor.lateralStrength}, head=${headCorridor.lateralStrength}`);
});

test('snow load damps flutter and tip whip', () => {
  const windy = {
    condition: 'clear',
    windSpeed: 28,
    windGusts: 46,
    windLevel: 0.42,
    gustLevel: 0.24,
    windDirection: 270,
    windVector: { x: 1, y: 0 }
  };
  const snowy = {
    ...windy,
    condition: 'snow'
  };

  const clearField = context.getGrassFieldState(windy, 5200, { wetness: 0.04, snowCover: 0 });
  const snowField = context.getGrassFieldState(snowy, 5200, { wetness: 0.02, snowCover: 0.74 });
  const clearWhip = Math.abs(context.getGrassTipWhip(clearField, 210, 54, 7811, true));
  const snowWhip = Math.abs(context.getGrassTipWhip(snowField, 210, 54, 7811, true));

  assert(snowField.patchFlutter < clearField.patchFlutter, `snow should damp patch flutter: clear=${clearField.patchFlutter}, snow=${snowField.patchFlutter}`);
  assert(snowField.heightScale < clearField.heightScale, `snow should press grass lower: clear=${clearField.heightScale}, snow=${snowField.heightScale}`);
  assert(snowWhip < clearWhip, `snow should damp tip whip: clear=${clearWhip}, snow=${snowWhip}`);
});

test('pointer grass reaction is fresh and expires instead of sticking forever', () => {
  context.runtime.input = {
    inside: true,
    x: 264,
    y: 436,
    previousX: 246,
    previousY: 436,
    lastMoveAt: 10000,
    lastDownAt: 10000,
    speed: 0.9
  };

  const fresh = context.getGrassPointerReaction(10120);
  const stale = context.getGrassPointerReaction(11550);

  assert(fresh && fresh.kind === 'pointer', 'fresh grass pointer should create a local reaction');
  assert(fresh.strength > 0.04 && fresh.strength < 0.16, `fresh pointer should stay subtle, strength=${fresh && fresh.strength}`);
  assert(fresh.radius <= 44, `fresh pointer should stay local, radius=${fresh && fresh.radius}`);
  assert(fresh.direction === 1, `pointer direction should follow movement, got ${fresh && fresh.direction}`);
  assert(stale === null, 'stale pointer should expire');
});

test('grass brush reaction scales with drag distance and expires', () => {
  context.runtime.input = {
    inside: true,
    x: 330,
    y: 424,
    previousX: 280,
    previousY: 420,
    lastMoveAt: 5000,
    lastDownAt: 4900,
    grassBrushLastAt: 5000,
    grassBrushDistance: 96,
    grassBrushX: 330,
    grassBrushY: 424,
    speed: 0.8
  };

  const fresh = context.collectGrassLocalReactions(5080, null, true).find((reaction) => reaction.kind === 'brush');
  const stale = context.collectGrassLocalReactions(6800, null, true).find((reaction) => reaction.kind === 'brush');
  assert(fresh, 'fresh grass brush should create a local reaction');
  assert(fresh.strength > 0.12 && fresh.strength < 0.28, `brush drag should stay subtle, strength=${fresh && fresh.strength}`);
  assert(fresh.radius > 48 && fresh.radius < 64, `brush radius should stay local, radius=${fresh && fresh.radius}`);
  assert(stale === undefined, 'stale grass brush should expire');
});

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
