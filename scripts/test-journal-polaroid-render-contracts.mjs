import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const coreExportsSource = readFileSync(path.join(rootDir, 'ClientCoreExports.html'), 'utf8');
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
  const originalFind = context.findStageAnimation;
  context.findStageAnimation = (stage, state) => {
    requested.push({ stage, state });
    return { key: `${stage}.${state}` };
  };
  context.ensureAssetLoaded = () => Promise.resolve();

  context.preloadWorldJournalPolaroidAsset({
    reaction: 'calm',
    photoSnapshot: { stage: 'sprout', growth: 4, reaction: 'awe' }
  });

  assert(requested.length === 1, `expected one preload resolution, got ${requested.length}`);
  assert(requested[0].stage === 'baby' && requested[0].state === 'stargaze', `preload/render contract diverged: ${JSON.stringify(requested[0])}`);
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
    journalPolaroidCanvas: {},
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

test('journal polaroid reconstructs a tight frame inside the 144px logical canvas', () => {
  context.getJournalPhotoSnapshot = () => ({ reaction: 'calm' });
  context.getJournalPolaroidStage = () => 'spore';
  context.getJournalReactionState = () => 'idle';
  const draws = [];
  const ctx = {
    drawImage(...args) {
      draws.push(args);
    }
  };

  context.drawJournalPhotoMushroom(ctx, 192, 192, { id: 'photo' });

  assert(draws.length === 1, `expected one raster draw, got ${draws.length}`);
  const args = draws[0];
  assert(args[1] === 200 && args[3] === 100 && args[4] === 104, `unexpected source crop: ${args}`);
  assert(near(args[5], 81.9375) && near(args[6], 137.125), `unexpected logical destination: ${args}`);
  assert(near(args[7], 28.125) && near(args[8], 29.25), `tight frame must keep 512-space scale: ${args}`);
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
