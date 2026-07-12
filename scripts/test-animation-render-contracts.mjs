import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const script = readFileSync(path.join(rootDir, 'ClientAnimation.html'), 'utf8');
const overlays = [];
const context = {
  console,
  Math,
  Number,
  String,
  canvasSize: 512,
  drawMushroomConditionOverlay(ctx, animation, frame, motion, grassTop) {
    overlays.push({ animation, frame, motion, grassTop });
  }
};

vm.createContext(context);
vm.runInContext(script, context, { filename: 'ClientAnimation.html' });

test('body-only animation metadata bypasses the legacy grass anchor split', () => {
  const ctx = createRecordingContext();
  const animation = {
    key: 'adult.idle',
    state: 'idle',
    bakedGrass: false,
    drawX: 90,
    drawY: 210,
    pivotX: 150,
    pivotY: 398
  };
  const motion = { x: 2, y: -3, scaleX: 0.99, scaleY: 1.01 };

  context.drawGrassAnchoredMotionFrame(ctx, {}, 1, 128, 192, animation, motion);

  assert(context.shouldAnchorAnimationGrass(animation) === false, 'body-only animation must opt out of grass anchoring');
  assert(ctx.drawImages === 1, `body-only frame should draw once, drawImages=${ctx.drawImages}`);
  assert(ctx.clips === 0, `body-only frame should never freeze a lower sheet region, clips=${ctx.clips}`);
  assert(ctx.translations[0][0] === 152 && ctx.translations[0][1] === 395, `tight atlas motion should use its configured pivot, translate=${ctx.translations[0]}`);
  assert(ctx.drawArgs[0][5] === -60 && ctx.drawArgs[0][6] === -188, 'tight atlas should draw relative to its configured pivot');
  assert(ctx.drawArgs[0][7] === 128 && ctx.drawArgs[0][8] === 192, 'tight atlas must not scale to the 512 canvas');
  assert(overlays.at(-1).grassTop === undefined, 'body-only condition overlay should not receive a baked-grass boundary');
  assert(overlays.at(-1).motion.pivotX === 150 && overlays.at(-1).motion.pivotY === 398, 'body-only overlay should share the tight atlas pivot');
});

test('static body-only frames honor drawX and drawY without canvas scaling', () => {
  const ctx = createRecordingContext();
  const animation = {
    key: 'baby.dry',
    state: 'dry',
    bakedGrass: false,
    drawX: 144,
    drawY: 238
  };

  context.drawBodyOnlyStaticFrame(ctx, {}, 2, 96, 140, animation);

  assert(ctx.drawImages === 1, `static body-only frame should draw once, drawImages=${ctx.drawImages}`);
  assert(ctx.drawArgs[0][1] === 192, `frame source x should use tight frame width, sourceX=${ctx.drawArgs[0][1]}`);
  assert(ctx.drawArgs[0][5] === 144 && ctx.drawArgs[0][6] === 238, `static body-only frame should honor draw position, args=${ctx.drawArgs[0]}`);
  assert(ctx.drawArgs[0][7] === 96 && ctx.drawArgs[0][8] === 140, 'static body-only frame must keep native dimensions');
});

test('logical duplicate frames resolve through the stored frame sequence', () => {
  const ctx = createRecordingContext();
  const animation = {
    key: 'adult.idle',
    bakedGrass: false,
    frameCount: 4,
    storedFrameCount: 3,
    frameSequence: [0, 1, 1, 2],
    drawX: 80,
    drawY: 120
  };

  context.drawBodyOnlyStaticFrame(ctx, {}, 2, 128, 196, animation);

  assert(ctx.drawArgs[0][1] === 128, `logical frame 2 should reuse stored frame 1, sourceX=${ctx.drawArgs[0][1]}`);
});

test('legacy sheets keep the split until their metadata explicitly declares body-only output', () => {
  const ctx = createRecordingContext();
  const animation = {
    key: 'adult.idle',
    state: 'idle'
  };
  const motion = { x: 1, y: -2, scaleX: 1, scaleY: 1.01 };

  context.drawGrassAnchoredMotionFrame(ctx, {}, 0, 512, 512, animation, motion);

  assert(context.shouldAnchorAnimationGrass(animation) === true, 'missing metadata should preserve compatibility with baked-grass sheets');
  assert(ctx.drawImages === 2, `legacy frame should keep moving and anchored draws, drawImages=${ctx.drawImages}`);
  assert(ctx.clips === 1, `legacy frame should keep one anchored clip, clips=${ctx.clips}`);
  assert(Number.isFinite(overlays.at(-1).grassTop), 'legacy condition overlay should retain the grass boundary');
});

function createRecordingContext() {
  return {
    drawImages: 0,
    clips: 0,
    translations: [],
    drawArgs: [],
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
    drawImage(...args) {
      this.drawImages += 1;
      this.drawArgs.push(args);
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
