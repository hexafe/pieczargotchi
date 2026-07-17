import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const coreExportsSource = readFileSync(path.join(rootDir, 'ClientCoreExports.html'), 'utf8');
const spriteLayoutSource = readFileSync(path.join(rootDir, 'SpriteLayout.gs'), 'utf8');
const spriteLayoutMatch = spriteLayoutSource.match(/Object\.freeze\((\{[\s\S]*\})\);\n\/\/ END GENERATED SPRITE LAYOUTS/);
assert(spriteLayoutMatch, 'generated sprite layout registry must remain parseable');
const spriteLayouts = JSON.parse(spriteLayoutMatch[1]);
const coreHelperStart = coreExportsSource.indexOf('  function normalizeJournalSnapshotStageCore');
const coreHelperEnd = coreExportsSource.indexOf('\n\n  global.PieczargotchiCore', coreHelperStart);
const context = {
  Array,
  Math,
  Number,
  console,
  canvasSize: 512,
  runtime: {
    assets: { 'spore.idle': { id: 'tight-atlas' } },
    assetDiagnostics: {},
    state: { stage: 'adult', stats: { growth: 70 } }
  },
  rules: {
    stageThresholds: [
      { id: 'spore', growth: 0 },
      { id: 'baby', growth: 8 },
      { id: 'young', growth: 28 },
      { id: 'adult', growth: 62 },
      { id: 'legendary', growth: 100 }
    ]
  },
  findStageAnimation() {
    return {
      key: 'spore.idle',
      frames: 4,
      frameWidth: 100,
      frameHeight: 104,
      drawX: 206,
      drawY: 324,
      storedFrameCount: 3,
      frameSequence: [2, 1, 2, 0],
      bakedGrass: false
    };
  },
  touchRuntimeAsset() {},
  isRuntimeAssetFailureCoolingDown() {
    return false;
  }
};
context.window = { PieczargotchiCore: null };

vm.createContext(context);
assert(coreHelperStart >= 0 && coreHelperEnd > coreHelperStart, 'core stage normalizer must be extractable for focused tests');
vm.runInContext(coreExportsSource.slice(coreHelperStart, coreHelperEnd), context, { filename: 'ClientCoreExports.helper.html' });
context.window.PieczargotchiCore = {
  normalizeJournalSnapshotStage: context.normalizeJournalSnapshotStageCore
};
vm.runInContext(readFileSync(path.join(rootDir, 'ClientJournalPopover.html'), 'utf8'), context, {
  filename: 'ClientJournalPopover.html'
});

function getRealStageAnimation(stage, state) {
  const layout = spriteLayouts[`stages/${stage}/${state}_sheet.png`];
  assert(layout, `missing real sprite layout for ${stage}.${state}`);
  return Object.assign({}, layout, {
    key: `${stage}.${state}`,
    frames: layout.frameCount
  });
}

test('legacy journal stage aliases and growth fallback resolve to canonical sprite stages', () => {
  assert(context.normalizeJournalSnapshotStage('sprout', 99) === 'baby', 'sprout alias must select the baby sprite instead of falling through to spore');
  assert(context.normalizeJournalSnapshotStage('juvenile', 2) === 'young', 'juvenile alias must select the young sprite');
  assert(context.normalizeJournalSnapshotStage('', 8) === 'baby', 'missing stage should fall back through canonical growth thresholds');
  assert(context.normalizeJournalSnapshotStage('unknown', 62) === 'adult', 'unknown stage should resolve from growth');
  assert(context.getWorldJournalStageLabel('sprout', 0) === 'maluch', 'journal description must use the same normalized stage as rendering');
  assert(context.getJournalPolaroidStage({ photoSnapshot: { stage: 'juvenile', growth: 12 } }) === 'young', 'polaroid renderer must normalize legacy snapshots');
});

test('journal preloader requests the same canonical stage used by the renderer', () => {
  const requested = [];
  const assetKeys = [];
  const originalFind = context.findStageAnimation;
  context.findStageAnimation = (stage, state) => {
    requested.push({ stage, state });
    return { key: `${stage}.${state}` };
  };
  context.ensureAssetLoaded = (key) => {
    assetKeys.push(key);
    return Promise.resolve();
  };

  context.preloadWorldJournalPolaroidAsset({
    reaction: 'calm',
    photoSnapshot: { stage: 'sprout', growth: 4, reaction: 'awe' }
  });

  assert(requested.length === 1, `expected one preload resolution, got ${requested.length}`);
  assert(requested[0].stage === 'baby' && requested[0].state === 'stargaze', `preload/render contract diverged: ${JSON.stringify(requested[0])}`);
  assert(assetKeys.includes('baby.stargaze'), `expected the canonical mushroom asset preload, got ${assetKeys.join(',')}`);
  assert(assetKeys.includes('environment.grassPatch'), `expected the shared raster grass preload, got ${assetKeys.join(',')}`);
  assert(assetKeys.includes('journal.polaroidProps'), `expected the polaroid prop atlas preload, got ${assetKeys.join(',')}`);
  context.findStageAnimation = originalFind;
});

test('journal opens and closes atomically through the shared native-dialog controller', () => {
  const calls = [];
  const style = {
    setProperty() {},
    removeProperty(name) {
      calls.push(`remove:${name}`);
    }
  };
  const dialog = {
    hidden: true,
    open: false,
    style,
    setAttribute() {},
    hasAttribute(name) {
      return name === 'open' && this.open;
    }
  };
  const trigger = { id: 'journal-trigger' };
  context.dom = {
    journalPolaroid: dialog,
    journalPolaroidCanvas: { setAttribute() {} },
    journalPolaroidTitle: null,
    journalPolaroidMeta: null,
    journalPolaroidCaption: null,
    journalPolaroidDescription: null,
    journalPolaroidNote: null,
    journalPolaroidClose: null,
    journalTooltip: null
  };
  context.formatMushroomText = (value) => value;
  context.drawWorldJournalPolaroidScene = () => calls.push('draw');
  context.openSceneFirstDialog = (node, kind, returnTarget) => {
    calls.push(`open:${kind}`);
    assert(node === dialog && returnTarget === trigger, 'journal dialog controller must receive the original trigger');
    node.hidden = false;
    node.open = true;
  };
  context.closeSceneFirstDialog = (node) => {
    calls.push('close');
    assert(node === dialog, 'shared close controller must own journal focus restoration');
    node.hidden = true;
    node.open = false;
  };

  context.openWorldJournalPolaroid({ id: 'aurora', groupId: 'sky', label: 'Zorza' }, null, trigger);
  assert(calls.includes('open:journal'), `journal should use shared dialog open, calls=${calls.join(',')}`);
  assert(!calls.some((entry) => entry.startsWith('position:')), 'native modal must not use legacy pointer bubble positioning');
  context.closeWorldJournalPolaroid();
  assert(calls.includes('close'), `journal should use shared dialog close, calls=${calls.join(',')}`);
  assert(context.runtime.activeJournalPolaroid === null, 'journal runtime selection should clear before modal close');
});

test('journal resolves logical frames through the deduplicated atlas sequence', () => {
  const animation = context.findStageAnimation();
  const layout = context.resolveJournalSpriteFrameLayout(animation, 0);
  assert(layout.sourceX === 200, `logical frame 0 should use stored frame 2, sourceX=${layout.sourceX}`);
  assert(layout.drawX === 206 && layout.drawY === 324, 'journal layout should retain logical canvas offsets');
});

test('journal polaroid reframes a tight sprite at a readable stage-aware size', () => {
  context.getJournalPhotoSnapshot = () => ({ reaction: 'calm' });
  context.getJournalPolaroidStage = () => 'spore';
  context.getJournalReactionState = () => 'idle';
  const draws = [];
  const ctx = {
    fillStyle: '',
    save() {},
    restore() {},
    fillRect() {},
    drawImage(...args) {
      draws.push(args);
    }
  };

  context.drawJournalPhotoMushroom(ctx, 192, 192, { id: 'photo' });

  assert(draws.length === 1, `expected one raster draw, got ${draws.length}`);
  const args = draws[0];
  assert(args[1] === 200 && args[3] === 100 && args[4] === 104, `unexpected source crop: ${args}`);
  assert(near(args[5], 62.34615384615385) && near(args[6], 114), `unexpected centered destination: ${args}`);
  assert(near(args[7], 67.3076923076923) && near(args[8], 70), `spore subject should be legible instead of inheriting its tiny 512-space footprint: ${args}`);
  assert(near(args[5] + args[7] / 2, 96), 'subject should stay centered in the photo');
  assert(near(args[6] + args[8], 184), 'subject should share one stable photo baseline');
});

test('real reaction layouts keep one stable body transform across all five stages', () => {
  const originalFind = context.findStageAnimation;
  context.findStageAnimation = getRealStageAnimation;
  const targets = { spore: 70, baby: 90, young: 108, adult: 124, legendary: 136 };
  const reactions = ['idle', 'curious', 'sun'];

  Object.keys(targets).forEach((stage) => {
    reactions.forEach((reaction) => {
      const layout = context.resolveJournalSpriteFrameLayout(getRealStageAnimation(stage, reaction), 0);
      const composition = context.getJournalMushroomComposition(stage, 192, 192, layout);
      const body = composition.bodyBounds;
      assert(near(body.x + body.width / 2, 96), `${stage}.${reaction} body drifted horizontally: ${JSON.stringify(body)}`);
      assert(near(body.y + body.height, 184), `${stage}.${reaction} body baseline drifted: ${JSON.stringify(body)}`);
      assert(near(body.height, targets[stage]), `${stage}.${reaction} body height should stay ${targets[stage]}, got ${body.height}`);
      const mappedCanvasCenter = composition.x + (256 - layout.drawX) * composition.scale;
      assert(near(mappedCanvasCenter, 96), `${stage}.${reaction} ignored drawX anchoring, center=${mappedCanvasCenter}`);
    });
  });
  context.findStageAnimation = originalFind;
});

test('primary foreground props reserve a safe right gutter for every stage', () => {
  const originalFind = context.findStageAnimation;
  context.findStageAnimation = getRealStageAnimation;
  ['instrument', 'teaDay', 'spaceWeek'].forEach((scene) => {
    Object.keys({ spore: 1, baby: 1, young: 1, adult: 1, legendary: 1 }).forEach((stage) => {
      const layout = context.resolveJournalSpriteFrameLayout(getRealStageAnimation(stage, 'idle'), 0);
      const composition = context.getJournalMushroomComposition(stage, 192, 192, layout, { photoScene: scene });
      assert(composition.bodyBounds.x >= 8, `${scene}.${stage} subject shift escaped the frame`);
      assert(composition.bodyBounds.x + composition.bodyBounds.width <= 150.001, `${scene}.${stage} did not reserve the prop gutter`);
      const placement = context.getJournalSidePropPlacement(192, 192, composition.bodyBounds, 'right', 28, 44);
      assert(placement.x >= 154, `${scene}.${stage} prop must stay in the right gutter, x=${placement.x}`);
    });
  });
  context.findStageAnimation = originalFind;
});

test('all catalog photo scenes have an explicit renderer recipe', () => {
  const catalogSources = [
    'ClientCoreSky.html',
    'ClientCorePhenomena.html',
    'ClientCoreCalendar.html'
  ].map((file) => readFileSync(path.join(rootDir, file), 'utf8')).join('\n');
  const catalogScenes = new Set(Array.from(catalogSources.matchAll(/photoScene:\s*'([^']+)'/g), (match) => match[1]));
  catalogScenes.add('instrument');
  const registry = context.getJournalPhotoSceneRegistry();
  const registered = new Set(Object.keys(registry));
  const missing = Array.from(catalogScenes).filter((scene) => !registered.has(scene));
  assert(missing.length === 0, `photo scene recipes are missing: ${missing.join(', ')}`);
  assert(context.getJournalPhotoSceneRegistry() === registry, 'scene registry should be cached instead of allocating closures per thumbnail');
  assert(Array.from(registered).every((scene) => registry[scene] && (registry[scene].draw || registry[scene].drawForeground)), 'every recipe needs a background or foreground renderer');
});

test('special celestial recipes own exactly one sun or moon body', () => {
  const registry = context.getJournalPhotoSceneRegistry();
  ['moonHalo', 'moonDay', 'sunDog', 'sunbeams', 'clearingAfterRain'].forEach((scene) => {
    assert(registry[scene].ownsCelestial, `${scene} must suppress the generic celestial body`);
  });
  assert(!registry.lightPillar.ownsCelestial, 'light pillar augments the snapshot sun instead of replacing it');

  let moonCalls = 0;
  const originalMoon = context.drawPixelMoon;
  context.drawPixelMoon = () => { moonCalls += 1; };
  const ctx = { fillRect() {}, strokeRect() {} };
  context.drawJournalSnapshotCelestial(ctx, 192, 192, { photoScene: 'moonDay' }, {
    weather: { dayPhase: 'night', isDay: false, cloudCover: 0 }
  });
  assert(moonCalls === 0, 'moonDay generic celestial pass must not draw a first moon');
  registry.moonDay.draw(ctx, 192, 192, { photoScene: 'moonDay' });
  assert(moonCalls === 1, 'moonDay recipe must draw exactly one owned moon');
  context.drawPixelMoon = originalMoon;
});

test('foreground ownership preserves the three primary props and five instrument silhouettes', () => {
  const registry = context.getJournalPhotoSceneRegistry();
  ['teaDay', 'soilDay', 'spaceWeek', 'instrument'].forEach((scene) => {
    assert(typeof registry[scene].drawGroundProp === 'function', `${scene} needs a pre-grass raster prop pass`);
    assert(typeof registry[scene].drawForeground === 'function', `${scene} needs a post-grass foreground renderer`);
  });
  assert(typeof registry.spaceWeek.draw === 'function', 'spaceWeek meteor shower should remain in the background pass');

  const variants = {
    rareInstrument_spore: 'starTone',
    rareInstrument_baby: 'ocarina',
    rareInstrument_young: 'lyre',
    rareInstrument_adult: 'harp',
    rareInstrument_legendary: 'organ'
  };
  const signatures = new Set();
  Object.entries(variants).forEach(([id, expected]) => {
    assert(context.getJournalInstrumentVariant({ id }) === expected, `${id} should resolve to ${expected}`);
    const calls = [];
    const ctx = {
      fillStyle: '',
      fillRect(...args) { calls.push(args.join(',')); }
    };
    context.drawJournalInstrumentKeepsake(ctx, 192, 192, { id }, { x: 12, y: 48, width: 138, height: 136 });
    assert(calls.length >= 8, `${id} silhouette is too sparse to be recognizable`);
    signatures.add(calls.join('|'));
  });
  assert(signatures.size === 5, `instrument silhouettes must remain distinct, got ${signatures.size}`);

  const soilCalls = [];
  context.drawJournalSoilDay({
    fillStyle: '',
    fillRect(...args) { soilCalls.push(args); }
  }, 192, 192, { id: 'soilDay' }, { x: 36, y: 60, width: 120, height: 124 });
  assert(soilCalls.length >= 18, 'soil keepsake needs two readable organic mycelium pockets');
  assert(soilCalls.every((call) => call[2] <= 5), 'soil foreground must not recreate broad rectangular color bands');
  assert(soilCalls.some((call) => call[0] < 28) && soilCalls.some((call) => call[0] > 164),
    'soil details should frame both sides without covering the mushroom');
});

test('snapshot composition keeps coherent depth order and finishes with subtle film patina', () => {
  const operations = [];
  const operationNames = [
    'drawJournalSnapshotSky',
    'drawJournalSnapshotCelestial',
    'drawJournalSnapshotClouds',
    'drawJournalSnapshotWeather',
    'drawJournalSnapshotGround',
    'drawJournalPhotoPhenomenon',
    'drawJournalSnapshotWorldDetails',
    'drawJournalPhotoGroundProp',
    'drawJournalPhotoForeground',
    'drawJournalSnapshotForegroundWeather',
    'drawJournalSnapshotFilmPatina'
  ];
  const originals = Object.fromEntries(operationNames.map((name) => [name, context[name]]));
  const originalMushroom = context.drawJournalPhotoMushroom;
  const originalGrass = context.drawJournalPhotoGrass;
  operationNames.forEach((name) => {
    context[name] = () => operations.push(name);
  });
  context.drawJournalPhotoMushroom = () => {
    operations.push('subject');
    return { rendered: true, bounds: { x: 50, y: 60, width: 90, height: 124, baseY: 184 } };
  };
  context.drawJournalPhotoGrass = () => {
    operations.push('grass');
    return { rendered: true, raster: true, clearance: { left: 45, right: 147, centerCoverTop: 179 } };
  };

  const diagnostics = context.drawWorldJournalSnapshotScene({}, 192, 192, { id: 'aurora' }, {});
  assert(operations.join('>') === [
    'drawJournalSnapshotSky',
    'drawJournalSnapshotCelestial',
    'drawJournalSnapshotClouds',
    'drawJournalSnapshotWeather',
    'drawJournalSnapshotGround',
    'drawJournalPhotoPhenomenon',
    'drawJournalSnapshotWorldDetails',
    'drawJournalPhotoGroundProp',
    'subject',
    'grass',
    'drawJournalPhotoForeground',
    'drawJournalSnapshotForegroundWeather',
    'drawJournalSnapshotFilmPatina'
  ].join('>'), `unexpected journal depth order: ${operations.join('>')}`);
  assert(diagnostics.subjectRendered && diagnostics.grassRaster, 'composition should report a raster-backed, visible subject');
  Object.assign(context, originals);
  context.drawJournalPhotoMushroom = originalMushroom;
  context.drawJournalPhotoGrass = originalGrass;
});

test('raster grass uses one masked layer and covers at most four subject pixels at center', () => {
  const originalFind = context.findStageAnimation;
  context.findStageAnimation = getRealStageAnimation;
  const ctx = {
    globalAlpha: 1,
    save() {},
    restore() {},
    beginPath() {
      this.pathRects = [];
    },
    rect(...args) {
      this.pathRects.push(args);
    },
    clip(rule) {
      this.clipRule = rule;
    },
    translate() {},
    scale() {},
    drawImage(...args) {
      this.calls.push(args);
    }
  };
  const image = { naturalWidth: 512, naturalHeight: 158 };
  ['spore', 'baby', 'young', 'adult', 'legendary'].forEach((stage) => {
    ctx.calls = [];
    const idleLayout = context.resolveJournalSpriteFrameLayout(getRealStageAnimation(stage, 'idle'), 0);
    const subject = context.getJournalMushroomComposition(stage, 192, 192, idleLayout);
    const clearance = context.getJournalPhotoGrassClearance(stage, 192, subject.bodyBounds);
    const layout = context.drawJournalGrassRasterWithClearance(ctx, image, 192, 192, clearance, `grass-${stage}`);
    assert(layout.left <= subject.bodyBounds.x - 4, `${stage} grass clearance clips the subject on the left`);
    assert(layout.right >= subject.bodyBounds.x + subject.bodyBounds.width + 4, `${stage} grass clearance clips the subject on the right`);
    assert(layout.masked, `${stage} grass should report one clipped mask`);
    assert(layout.centerCoverTop === Math.round(subject.baseY - 4), `${stage} center grass should start exactly four pixels before the baseline, got ${layout.centerCoverTop}`);
    const overlap = Math.max(0, subject.baseY - layout.centerCoverTop);
    assert(overlap <= 4, `${stage} center grass may blend feet but not the body, overlap=${overlap}`);
    assert(ctx.calls.length === 1, `${stage} should draw one masked raster layer, got ${ctx.calls.length}`);
    assert(ctx.clipRule === 'evenodd' && ctx.pathRects.length === 2, `${stage} should cut one subject clearance hole from the grass layer`);
  });
  context.findStageAnimation = originalFind;
});

test('photo readiness requires the real grass raster and reports degraded asset failures', () => {
  const attributes = new Map();
  const parentAttributes = new Map();
  const canvas = {
    parentElement: {
      setAttribute(name, value) {
        parentAttributes.set(name, value);
      }
    },
    setAttribute(name, value) {
      attributes.set(name, value);
    }
  };
  context.syncWorldJournalPhotoDiagnostics(canvas, { id: 'dew' }, {
    subjectRendered: true,
    grassRendered: true,
    grassRaster: false,
    grassFailed: false
  });
  assert(attributes.get('data-photo-ready') === 'false', 'procedural fallback grass must not count as a ready keepsake');
  assert(attributes.get('data-photo-state') === 'loading', 'temporary grass fallback should remain in loading state');
  context.syncWorldJournalPhotoDiagnostics(canvas, { id: 'dew' }, {
    subjectRendered: true,
    grassRendered: true,
    grassRaster: false,
    grassFailed: true
  });
  assert(attributes.get('data-photo-state') === 'error', 'failed raster grass should expose a degraded/error state');
  assert(parentAttributes.get('data-journal-polaroid-photo-state') === 'error', 'photo wrapper should mirror the degraded state');
});

test('ready thumbnails do not schedule a redundant preload and redraw', () => {
  const originalDraw = context.drawWorldJournalPolaroidScene;
  const originalPreload = context.preloadWorldJournalPolaroidAsset;
  let draws = 0;
  let preloads = 0;
  context.drawWorldJournalPolaroidScene = () => {
    draws += 1;
    return { subjectRendered: true, grassRaster: true };
  };
  context.preloadWorldJournalPolaroidAsset = () => {
    preloads += 1;
    return Promise.resolve([]);
  };
  context.drawWorldJournalPolaroidThumbnail({}, { id: 'ready-photo' });
  assert(draws === 1 && preloads === 0, `ready thumbnail should draw once without preload, draws=${draws}, preloads=${preloads}`);
  context.drawWorldJournalPolaroidScene = originalDraw;
  context.preloadWorldJournalPolaroidAsset = originalPreload;
});

test('prop atlas uses the documented 3x3 cells and keeps a procedural fallback seam', () => {
  const originalAtlas = context.runtime.assets['journal.polaroidProps'];
  const atlas = { naturalWidth: 384, naturalHeight: 384 };
  context.runtime.assets['journal.polaroidProps'] = atlas;
  const calls = [];
  const ctx = {
    globalAlpha: 1,
    imageSmoothingEnabled: true,
    save() {},
    restore() {},
    drawImage(...args) { calls.push(args); }
  };
  const cells = [
    ['tea', 0, 0],
    ['telescope', 128, 0],
    ['soil', 256, 0],
    ['starTone', 0, 128],
    ['ocarina', 128, 128],
    ['lyre', 256, 128],
    ['harp', 0, 256],
    ['organ', 128, 256],
    ['botanicalStamp', 256, 256]
  ];
  cells.forEach(([id, sourceX, sourceY]) => {
    const rendered = context.drawJournalPolaroidPropAtlasCell(ctx, id, { x: 4, y: 6, width: 32, height: 32 });
    assert(rendered, `${id} should render from the loaded atlas`);
    const call = calls[calls.length - 1];
    assert(call[0] === atlas && call[1] === sourceX && call[2] === sourceY && call[3] === 128 && call[4] === 128,
      `${id} uses the wrong atlas cell: ${call}`);
  });
  const fullCallCount = calls.length;
  context.drawJournalPolaroidPropAtlasCell(ctx, 'tea', { x: 4, y: 6, width: 32, height: 32 }, { visibleRatio: 0.68 });
  assert(calls.length === fullCallCount + 1 && calls.at(-1)[4] < 128 && calls.at(-1)[8] < 32,
    'foreground highlight should redraw only the top of a grounded prop');
  delete context.runtime.assets['journal.polaroidProps'];
  assert(!context.drawJournalPolaroidPropAtlasCell(ctx, 'tea', { x: 4, y: 6, width: 32, height: 32 }),
    'missing atlas must leave the procedural fallback seam active');
  if (originalAtlas) {
    context.runtime.assets['journal.polaroidProps'] = originalAtlas;
  }
});

test('aurora and iridescence execute with their own deterministic color sources', () => {
  const calls = [];
  const ctx = {
    fillStyle: '',
    globalAlpha: 1,
    fillRect(...args) { calls.push({ style: this.fillStyle, args }); }
  };
  context.drawJournalAurora(ctx, 192);
  assert(calls.some((call) => call.style === 'rgba(113,232,157,0.34)'), 'aurora must use the active color entry');
  calls.length = 0;
  context.drawJournalCloudIridescence(ctx, 192);
  assert(calls.some((call) => call.style === '#ffd8d6') && calls.some((call) => call.style === '#c8d5ff'),
    'iridescence must use each patch color without leaking an undefined loop variable');
});

test('ground, clouds, and fog avoid full-width visible bands', () => {
  const originalPalette = context.getJournalSnapshotPalette;
  context.getJournalSnapshotPalette = () => ({
    skyLow: '#c8e99a',
    ground: '#4f8a3d',
    groundLight: '#6ca54b',
    cloud: '#e9ead8',
    cloudLight: '#f7f4df',
    nightFactor: 0
  });
  const groundCalls = [];
  const groundCtx = {
    fillStyle: '',
    fillRect(...args) { groundCalls.push(args); }
  };
  context.drawJournalSnapshotGround(groundCtx, 192, 192, { id: 'ground-test' }, { seed: 'ground-test' });
  const horizon = Math.round(192 * 0.655);
  assert(!groundCalls.some((call) => call[0] === 0 && call[2] === 192 && call[1] <= horizon + 4),
    'ground must not start as one straight full-width horizon band');
  const ridgeTops = new Set(groundCalls.filter((call) => call[2] <= 5 && call[1] < horizon + 2).map((call) => call[1]));
  assert(ridgeTops.size >= 8, `ground horizon needs organic height variation, got ${ridgeTops.size} top levels`);

  const fogCalls = [];
  context.drawJournalSnapshotWeather({
    fillStyle: '',
    fillRect(...args) { fogCalls.push(args); }
  }, 192, 192, { id: 'fog-test' }, {
    seed: 'fog-test',
    weather: { condition: 'fog', fogPotential: 0.82 }
  });
  assert(fogCalls.length >= 18 && fogCalls.every((call) => call[2] < 192), 'fog should be staggered wisps, never full-width bars');

  const cloudCalls = [];
  context.drawJournalSnapshotClouds({
    fillStyle: '',
    globalAlpha: 1,
    save() {},
    restore() {},
    fillRect(...args) { cloudCalls.push(args); }
  }, 192, 192, { id: 'cloud-test' }, {
    seed: 'cloud-test',
    weather: { cloudCover: 86 }
  });
  assert(cloudCalls.length >= 20 && cloudCalls.every((call) => call[2] < 96), 'clouds should remain localized pixel puffs');
  context.getJournalSnapshotPalette = originalPalette;
});

test('film grade is deterministic, global, and has no hard canvas border', () => {
  function renderPatina() {
    const calls = [];
    const ctx = {
      fillStyle: '',
      globalCompositeOperation: 'source-over',
      save() {},
      restore() {},
      createRadialGradient() {
        return { addColorStop() {} };
      },
      fillRect(...args) { calls.push(args); }
    };
    context.drawJournalSnapshotFilmPatina(ctx, 192, 192, { id: 'vintage-test' }, {
      seed: 'vintage-test',
      weather: { dayPhase: 'night', isDay: false, condition: 'clear' }
    });
    return calls;
  }
  const first = renderPatina();
  const second = renderPatina();
  assert(first.length > 120, `strong vintage pass should include grade and seeded texture, got ${first.length} marks`);
  assert(JSON.stringify(first) === JSON.stringify(second), 'vintage texture must be deterministic for one snapshot seed');
  assert(first.filter((call) => call[0] === 0 && call[1] === 0 && call[2] === 192 && call[3] === 192).length >= 3,
    'the final grade should cover mushroom, grass, props, and background together');
  assert(!first.some((call) => (call[2] === 192 && call[3] <= 2) || (call[3] === 192 && call[2] <= 2)),
    'film treatment must not recreate a hard internal canvas frame');
});

test('modal and album share exact i-Type/600 geometry with an accessible reduced-motion reverse', () => {
  const indexSource = readFileSync(path.join(rootDir, 'Index.html'), 'utf8');
  const stylesSource = readFileSync(path.join(rootDir, 'Styles.html'), 'utf8');
  const uiSource = readFileSync(path.join(rootDir, 'ClientUi.html'), 'utf8');
  const ratios = stylesSource.match(/aspect-ratio:\s*88\.47\s*\/\s*107\.52/g) || [];
  assert(ratios.length >= 2, 'album and modal must share the exact 88.47 x 107.52 film ratio');
  assert((indexSource.match(/data-journal-polaroid-flip=/g) || []).length === 2, 'front and reverse each need an explicit flip button');
  assert(indexSource.includes('aria-controls="journalPolaroidBack"') && indexSource.includes('aria-controls="journalPolaroidFront"'),
    'flip controls must expose both controlled faces');
  assert(indexSource.includes('data-journal-polaroid-side-status aria-live="polite"'), 'side changes need a polite accessible announcement');
  assert(uiSource.includes("printFooter.className = 'discovery-item__print-footer'"), 'album cards need the shared physical print footer');
  const metaRule = stylesSource.match(/\.discovery-item__print-footer > span\s*\{([\s\S]*?)\}/);
  assert(metaRule && !/display:\s*none/.test(metaRule[1]) && /text-overflow:\s*ellipsis/.test(metaRule[1]),
    'album prints must retain one compact metadata line');
  assert(!stylesSource.includes('border-top: 4px solid var(--frame-accent)'), 'physical paper cannot retain the tier color stripe');
  assert(!stylesSource.includes('0 0 0 3px var(--frame-soft)'), 'physical paper cannot retain the tier halo');
  assert(stylesSource.includes('.journal-polaroid__face[data-flip-enter="true"]') && stylesSource.includes('animation: none'),
    'flip animation needs an explicit reduced-motion override');
});

test('front and reverse state keeps one visible face and moves focus to the return control', () => {
  function attrNode(attributes) {
    const attrs = new Map(Object.entries(attributes || {}));
    return {
      hidden: false,
      focusCount: 0,
      getAttribute(name) { return attrs.has(name) ? attrs.get(name) : null; },
      setAttribute(name, value) { attrs.set(name, String(value)); },
      removeAttribute(name) { attrs.delete(name); },
      addEventListener() {},
      focus() { this.focusCount += 1; }
    };
  }
  const front = attrNode({ 'data-journal-polaroid-face': 'front' });
  const back = attrNode({ 'data-journal-polaroid-face': 'back' });
  back.hidden = true;
  const toBack = attrNode({ 'data-journal-polaroid-flip': 'back' });
  const toFront = attrNode({ 'data-journal-polaroid-flip': 'front' });
  const sheet = attrNode({ 'data-side': 'front' });
  sheet.scrollTop = 99;
  const status = { textContent: '' };
  const dialog = {
    querySelectorAll(selector) {
      if (selector === '[data-journal-polaroid-face]') return [front, back];
      if (selector === '[data-journal-polaroid-flip]') return [toBack, toFront];
      return [];
    },
    querySelector(selector) {
      if (selector === '[data-journal-polaroid-sheet]') return sheet;
      if (selector === '[data-journal-polaroid-side-status]') return status;
      if (selector.includes('face="back"')) return toFront;
      if (selector.includes('face="front"')) return toBack;
      return null;
    }
  };
  const originalDom = context.dom;
  context.dom = { journalPolaroid: dialog };
  context.setWorldJournalPolaroidSide('back', { animate: true, announce: true, focus: true });
  assert(front.hidden && !back.hidden, 'only the reverse should remain visible after flipping');
  assert(front.getAttribute('aria-hidden') === 'true' && back.getAttribute('aria-hidden') === 'false', 'face visibility must be reflected to assistive technology');
  assert(sheet.getAttribute('data-side') === 'back' && sheet.scrollTop === 0, 'reverse should reset the physical sheet scroll position');
  assert(status.textContent === 'Pokazano rewers odbitki.' && toFront.focusCount === 1, 'reverse should announce itself and receive a usable return focus target');
  context.setWorldJournalPolaroidSide('front', { animate: false, announce: true, focus: true });
  assert(!front.hidden && back.hidden && toBack.focusCount === 1, 'returning should reveal and focus the front control');
  context.dom = originalDom;
});

test('journal focus trap includes the native details summary', () => {
  const source = readFileSync(path.join(rootDir, 'ClientJournalPopover.html'), 'utf8');
  assert(source.includes('details > summary'), 'keyboard users must be able to reach the expandable field note');
});

console.log('Journal polaroid render contracts passed.');

function test(name, callback) {
  try {
    callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function near(actual, expected) {
  return Math.abs(actual - expected) < 0.0001;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
