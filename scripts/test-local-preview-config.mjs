import { buildClientConfig } from '../dev-server.mjs';

const config = buildClientConfig();
const assetsByKey = new Map((config.assets || []).map((asset) => [asset.key, asset]));
const animations = Array.isArray(config.animations) ? config.animations : [];

assert(animations.length > 0, 'local preview should expose animation metadata');

for (const animation of animations) {
  const asset = assetsByKey.get(animation.key);
  const frameWidth = Number(animation.frameWidth);
  const frameHeight = Number(animation.frameHeight);
  const frameCount = Number(animation.frameCount);
  const storedFrameCount = Number(animation.storedFrameCount);
  const frameSequence = animation.frameSequence;

  assert(asset, `${animation.key}: missing runtime asset entry`);
  assert(animation.bakedGrass === false, `${animation.key}: local preview did not load body-only SpriteLayout metadata`);
  assert(Number.isInteger(frameWidth) && frameWidth > 0, `${animation.key}: invalid frameWidth`);
  assert(Number.isInteger(frameHeight) && frameHeight > 0, `${animation.key}: invalid frameHeight`);
  assert(Number.isInteger(frameCount) && frameCount > 0, `${animation.key}: invalid frameCount`);
  assert(Number.isInteger(storedFrameCount) && storedFrameCount > 0, `${animation.key}: invalid storedFrameCount`);
  assert(Array.isArray(frameSequence) && frameSequence.length === frameCount,
    `${animation.key}: logical frameSequence length mismatch`);
  assert(frameSequence.every((index) => Number.isInteger(index) && index >= 0 && index < storedFrameCount),
    `${animation.key}: frameSequence points outside physical atlas`);
  assert(Number(asset.width) === frameWidth * storedFrameCount,
    `${animation.key}: runtime asset width does not match tight atlas`);
  assert(Number(asset.height) === frameHeight,
    `${animation.key}: runtime asset height does not match tight atlas`);
}

console.log(`Local preview sprite layout contract passed for ${animations.length} animations.`);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
