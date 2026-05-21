import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import {
  buildCloudflareStaticArtifacts,
  collectStaticAssetFiles,
  getBundleVersion
} from './build-cloudflare-static.mjs';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const distDir = path.join(rootDir, 'dist');

const indexHtml = readDistText('index.html');
const configJs = readDistText('config.js');
const coreJs = readDistText('core.js');
const clientJs = readDistText('client.js');
const expected = buildCloudflareStaticArtifacts();
const distConfig = evaluateConfig(configJs);

test('Cloudflare static dist matches current source bundles', () => {
  assert(configJs === expected.configBundle, 'dist/config.js is stale; run npm run build');
  assert(coreJs === expected.coreBundle, 'dist/core.js is stale; run npm run build');
  assert(clientJs === expected.clientBundle, 'dist/client.js is stale; run npm run build');
  assert(indexHtml === expected.indexHtml, 'dist/index.html is stale; run npm run build');
});

test('Cloudflare static HTML cache-busts mutable script bundles', () => {
  assertScriptVersion('config', configJs);
  assertScriptVersion('core', coreJs);
  assertScriptVersion('client', clientJs);
});

test('Cloudflare static asset manifest cache-busts runtime assets', () => {
  const assetFiles = collectStaticAssetFiles();
  assert(assetFiles.length > 0, 'static asset inventory should not be empty');
  assert(Object.keys(distConfig.assetVersions || {}).length === assetFiles.length, 'asset version map should cover every copied static asset');

  for (const fileName of assetFiles) {
    const sourcePath = path.join(rootDir, 'assets', fileName);
    const distPath = path.join(distDir, 'assets', fileName);
    assert(existsSync(distPath), `dist is missing static asset ${fileName}`);
    assert(distConfig.assetVersions[fileName] === getFileVersion(sourcePath), `asset version mismatch for ${fileName}`);
    assert(getFileVersion(distPath) === getFileVersion(sourcePath), `dist asset differs from source asset ${fileName}`);
  }

  const grassVersion = distConfig.assetVersions['environment/grass_patch.png'];
  assert(grassVersion, 'grass patch should have a content version');
  assert(indexHtml.includes(`assets/environment/grass_patch.png?v=${grassVersion}`), 'grass preload should use the versioned asset URL');
  assert(clientJs.includes('function getStaticAssetUrl('), 'static client should append asset versions at runtime');
});

test('reset flow does not depend on browser modals in the static client', () => {
  assert(clientJs.includes('function handleResetButtonClick()'), 'static client should include the reset click handler');
  assert(clientJs.includes('function performGameReset()'), 'static client should include the reset executor');
  assert(!clientJs.includes('window.confirm('), 'static client reset should not depend on window.confirm');
  assert(clientJs.includes('Potwierdź'), 'static client should expose an inline reset confirmation state');
});

function assertScriptVersion(name, content) {
  const version = getBundleVersion(content);
  const pattern = new RegExp(`<script src="${name}\\.js\\?v=${version}"></script>`);
  assert(pattern.test(indexHtml), `${name}.js should have a current content version query`);
}

function evaluateConfig(configBundle) {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(configBundle, context, { filename: 'dist/config.js' });
  return context.window.PIECZARGOTCHI_CONFIG || {};
}

function readDistText(fileName) {
  return readFileSync(path.join(distDir, fileName), 'utf8');
}

function getFileVersion(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex').slice(0, 12);
}

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
