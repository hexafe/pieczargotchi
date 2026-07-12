import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const script = readFileSync(path.join(rootDir, 'ClientSprites.html'), 'utf8')
  .replace(/\}\)\(\);\s*<\/script>\s*$/, '');
const context = {
  console,
  Math,
  Number,
  String,
  canvasSize: 512,
  runtime: {
    state: {
      stage: 'spore',
      stats: { cleanliness: 20 }
    },
    motionDiagnostics: {}
  },
  getActiveActivity() {
    return null;
  },
  getRuntimeNow() {
    return 1000;
  },
  clamp(value, min, max, fallback) {
    const next = Number.isFinite(Number(value)) ? Number(value) : fallback;
    return Math.min(max, Math.max(min, next));
  }
};

vm.createContext(context);
vm.runInContext(script, context, { filename: 'ClientSprites.html' });

test('body-only dirt overlay follows the tight atlas pivot without a grass split', () => {
  const ctx = createRecordingContext();
  context.drawMushroomConditionOverlay(ctx, {
    key: 'spore.idle',
    kind: 'stage',
    stage: 'spore',
    bakedGrass: false
  }, 0, {
    x: 2,
    y: -3,
    scaleX: 0.99,
    scaleY: 1.01,
    pivotX: 154,
    pivotY: 306
  });

  assert(ctx.clips === 0, `body-only overlay must not freeze a lower region, clips=${ctx.clips}`);
  assert(ctx.translations[0][0] === 156 && ctx.translations[0][1] === 303, `overlay should use the body pivot plus motion, translate=${ctx.translations[0]}`);
  assert(ctx.translations[1][0] === -154 && ctx.translations[1][1] === -306, 'overlay should return from the same body pivot');
  assert(ctx.fillRects > 0, 'dirty body-only state should still render visible marks');
});

test('legacy dirt overlay keeps the anchored lower split for baked-grass sheets', () => {
  const ctx = createRecordingContext();
  context.drawMushroomConditionOverlay(ctx, {
    key: 'spore.idle',
    kind: 'stage',
    stage: 'spore'
  }, 0, {
    x: 1,
    y: -2,
    scaleX: 1,
    scaleY: 1.01
  }, 424);

  assert(ctx.clips === 2, `legacy overlay should keep upper and lower grass clips, clips=${ctx.clips}`);
  assert(ctx.fillRects > 0, 'legacy dirty state should still render visible marks');
});

function createRecordingContext() {
  return {
    clips: 0,
    fillRects: 0,
    translations: [],
    globalAlpha: 1,
    fillStyle: '#000000',
    save() {},
    restore() {},
    beginPath() {},
    rect() {},
    clip() {
      this.clips += 1;
    },
    translate(x, y) {
      this.translations.push([x, y]);
    },
    scale() {},
    fillRect() {
      this.fillRects += 1;
    }
  };
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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
