import {
  parseClientConfigBundle,
  readPngDimensions,
  validateDeploymentUrl,
  validateImmutableAssetBaseUrl,
  validateReleaseConfig,
  validateRuntimeAssetContract
} from './check-apps-script-release.mjs';

test('release gate parses the deployed JSON config bundle', () => {
  const config = parseClientConfigBundle('window.PIECZARGOTCHI_CONFIG = {"appVersion":"0.1.49"};\n');
  assert(config.appVersion === '0.1.49', 'expected deployed config JSON');
});

test('release gate accepts only public HTTPS deployment URLs', () => {
  assert(validateDeploymentUrl('https://apps-script.example.invalid/deployment/exec?old=1').search === '', 'expected stale query to be removed');
  for (const value of ['', 'http://apps-script.example.invalid/deployment/exec', 'https://user:secret@apps-script.example.invalid/exec']) {
    assertThrows(() => validateDeploymentUrl(value), `expected rejection for ${value || 'empty URL'}`);
  }
});

test('release asset base must contain the exact retained version segment', () => {
  validateImmutableAssetBaseUrl('https://cdn.example.test/releases/0.1.49/assets/', '0.1.49');
  validateImmutableAssetBaseUrl('https://cdn.example.test/releases/v0.1.49/assets/', '0.1.49');
  assertThrows(
    () => validateImmutableAssetBaseUrl('https://cdn.example.test/assets/', '0.1.49'),
    'expected mutable unversioned root to be rejected'
  );
});

test('release config is fail-closed for version, flags, manifest, and asset host', () => {
  const config = {
    appVersion: '0.1.49',
    assetVersion: '0.1.49',
    assetBaseUrl: 'https://cdn.example.test/releases/0.1.49/assets/',
    runtime: { debugEnabled: false, exposeRuntime: false, assetMode: 'critical' },
    assets: [{
      key: 'spore.idle',
      fileName: 'stages/spore/idle_sheet.png',
      width: 300,
      height: 104,
      frames: 4,
      frameWidth: 100,
      frameHeight: 104,
      storedFrameCount: 3,
      frameSequence: [0, 1, 0, 2],
      drawX: 206,
      drawY: 324,
      bakedGrass: false
    }]
  };
  validateReleaseConfig(config, '0.1.49');
  assertThrows(() => validateReleaseConfig({ ...config, appVersion: '0.1.48' }, '0.1.49'), 'expected stale deployment rejection');
  assertThrows(() => validateReleaseConfig({ ...config, assetBaseUrl: '' }, '0.1.49'), 'expected missing asset host rejection');
  assertThrows(
    () => validateReleaseConfig({ ...config, assets: [{ ...config.assets[0], frameSequence: [0, 4, 0, 2] }] }, '0.1.49'),
    'expected invalid physical frame reference to be rejected'
  );
  assertThrows(
    () => validateReleaseConfig({ ...config, assets: [{ ...config.assets[0], width: 400 }] }, '0.1.49'),
    'expected stale tight-atlas width to be rejected'
  );
});

test('release asset contract requires full tight-atlas metadata', () => {
  const asset = {
    key: 'spore.idle',
    fileName: 'stages/spore/idle_sheet.png',
    width: 300,
    height: 104,
    frames: 4
  };
  assertThrows(() => validateRuntimeAssetContract(asset), 'expected missing SpriteLayout metadata to fail');
});

test('release PNG parser reads IHDR dimensions', () => {
  const bytes = new Uint8Array(32);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
  bytes.set([73, 72, 68, 82], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, 300);
  view.setUint32(20, 104);
  const dimensions = readPngDimensions(bytes);
  assert(dimensions.width === 300 && dimensions.height === 104, 'expected exact physical PNG dimensions');
  bytes[12] = 0;
  assertThrows(() => readPngDimensions(bytes), 'expected malformed IHDR to fail');
});

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function assertThrows(fn, message) {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  assert(threw, message);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
