import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const script = readFileSync(path.join(rootDir, 'ClientAnimation.html'), 'utf8');
const overlays = [];
const animationsByKey = new Map([
  ['spore.idle', { key: 'spore.idle', frameWidth: 100, frameHeight: 104, drawX: 206, drawY: 324, pivotX: 256, pivotY: 428 }],
  ['baby.idle', { key: 'baby.idle', frameWidth: 232, frameHeight: 230, drawX: 140, drawY: 190, pivotX: 256, pivotY: 420 }],
  ['young.idle', { key: 'young.idle', frameWidth: 304, frameHeight: 326, drawX: 104, drawY: 104, pivotX: 256, pivotY: 430 }],
  ['adult.idle', { key: 'adult.idle', frameWidth: 400, frameHeight: 414, drawX: 56, drawY: 32, pivotX: 256, pivotY: 446 }],
  ['legendary.idle', { key: 'legendary.idle', frameWidth: 420, frameHeight: 414, drawX: 46, drawY: 32, pivotX: 256, pivotY: 446 }]
]);
const context = {
  console,
  Math,
  Number,
  String,
  animationsByKey,
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

test('ground shadow anchors remain stage-stable and derive from idle metadata', () => {
  const expected = {
    spore: { y: 426, casterHeight: 96, contactWidth: 58, castWidth: 72 },
    baby: { y: 418, casterHeight: 222, contactWidth: 70, castWidth: 106 },
    young: { y: 428, casterHeight: 318, contactWidth: 92, castWidth: 140 },
    adult: { y: 444, casterHeight: 406, contactWidth: 120, castWidth: 184 },
    legendary: { y: 444, casterHeight: 406, contactWidth: 120, castWidth: 194 }
  };

  Object.entries(expected).forEach(([stage, values]) => {
    const anchor = context.getMushroomGroundAnchor(stage);
    assert(anchor.x === 256 && anchor.y === values.y, `${stage} shadow anchor should stay centered at its idle foot line`);
    assert(anchor.casterHeight === values.casterHeight, `${stage} caster height should derive from idle frame metadata`);
    assert(anchor.contactWidth === values.contactWidth, `${stage} contact width should stay footprint-sized, got ${anchor.contactWidth}`);
    assert(anchor.castWidth === values.castWidth, `${stage} cast width should stay stage-scaled, got ${anchor.castWidth}`);
    assert(anchor.animationKey === `${stage}.idle`, `${stage} anchor must not follow activity props`);
  });
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
