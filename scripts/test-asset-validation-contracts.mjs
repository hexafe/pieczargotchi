import {
  countExteriorMagentaSpill,
  normalizeAssetPath,
  validateManifestContracts
} from './asset-validation-contracts.mjs';

assert(
  normalizeAssetPath('activities\\spore\\instrument_sheet.png') === 'activities/spore/instrument_sheet.png',
  'Windows asset paths should use manifest separators'
);

const validAliases = validateManifestContracts([
  { key: 'spore.activity.instrument', fileName: 'activities\\spore\\instrument_sheet.png', width: 4096, height: 512, frames: 8 },
  { key: 'spore.activity.instrument_bell', fileName: 'activities/spore/instrument_sheet.png', width: 4096, height: 512, frames: 8 }
]);
assert(validAliases.errors.length === 0, `matching aliases should pass: ${validAliases.errors.join('; ')}`);
assert(
  validAliases.assetsByFile.has('activities/spore/instrument_sheet.png'),
  'normalized aliases should share one file identity'
);

const duplicateKeys = validateManifestContracts([
  { key: 'effect.sparkle', fileName: 'effects/sparkle_sheet.png', width: 2048, height: 512, frames: 4 },
  { key: 'effect.sparkle', fileName: 'effects/dust_sheet.png', width: 2048, height: 512, frames: 4 }
]);
assert(
  duplicateKeys.errors.some((error) => error.includes('zduplikowany klucz assetu: effect.sparkle')),
  'duplicate manifest keys should fail'
);

const conflictingAliases = validateManifestContracts([
  { key: 'adult.activity.instrument', fileName: 'activities/adult/instrument_sheet.png', width: 4096, height: 512, frames: 8 },
  { key: 'adult.activity.instrument_rare', fileName: 'activities\\adult\\instrument_sheet.png', width: 2048, height: 512, frames: 4 }
]);
assert(
  conflictingAliases.errors.some((error) => error.includes('sprzeczny kontrakt')),
  'aliases of one file should agree on dimensions and frame count'
);

const chromaEdge = createRgbaFixture(11, 11);
paintPixel(chromaEdge, 4, 4, [255, 0, 255, 255]);
assert(
  countExteriorMagentaSpill(chromaEdge) === 1,
  'opaque magenta touching the exterior alpha band should fail'
);

const intentionalPurple = createRgbaFixture(13, 13);
for (let y = 3; y <= 9; y += 1) {
  for (let x = 3; x <= 9; x += 1) {
    paintPixel(intentionalPurple, x, y, [105, 60, 130, 255]);
  }
}
paintPixel(intentionalPurple, 6, 6, [255, 0, 255, 255]);
assert(
  countExteriorMagentaSpill(intentionalPurple) === 0,
  'intentional interior magenta protected by a clean purple edge should pass'
);

console.log('Asset manifest validation contracts passed.');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createRgbaFixture(width, height) {
  return {
    width,
    height,
    pixels: new Uint8Array(width * height * 4)
  };
}

function paintPixel(image, x, y, rgba) {
  const offset = (y * image.width + x) * 4;
  image.pixels.set(rgba, offset);
}
