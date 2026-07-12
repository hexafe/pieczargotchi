import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createProductionEnvironment,
  getDeployEnvironmentError,
  getWranglerInvocation
} from './deploy-cloudflare.mjs';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('production deploy accepts a clean environment', () => {
  assert(getDeployEnvironmentError({}) === '', 'clean deploy environment should pass');
});

for (const name of [
  'PIECZARGOTCHI_CLOUDFLARE_DEBUG',
  'PIECZARGOTCHI_CLOUDFLARE_EXPOSE_RUNTIME',
  'PIECZARGOTCHI_ALLOW_DEBUG_BUILD'
]) {
  test(`production deploy rejects ${name}`, () => {
    assert(getDeployEnvironmentError({ [name]: '1' }).includes(name), `${name} should block deploy`);
  });
}

test('production deploy rejects debug output and full asset mode', () => {
  assert(getDeployEnvironmentError({ PIECZARGOTCHI_BUILD_OUTPUT_DIR: 'dist-debug' }).includes('BUILD_OUTPUT_DIR'), 'dist-debug should block deploy');
  assert(getDeployEnvironmentError({ PIECZARGOTCHI_CLOUDFLARE_ASSET_MODE: 'full' }).includes('ASSET_MODE'), 'full asset mode should block deploy');
});

test('production environment is sanitized and explicitly marked', () => {
  const result = createProductionEnvironment({
    PIECZARGOTCHI_CLOUDFLARE_DEBUG: '1',
    PIECZARGOTCHI_CLOUDFLARE_EXPOSE_RUNTIME: '1',
    PIECZARGOTCHI_ALLOW_DEBUG_BUILD: '1',
    PIECZARGOTCHI_BUILD_OUTPUT_DIR: 'dist-debug'
  });
  assert(result.PIECZARGOTCHI_PRODUCTION_BUILD === '1', 'production marker should be set');
  assert(result.PIECZARGOTCHI_BUILD_OUTPUT_DIR === 'dist', 'production output should be dist');
  assert(result.PIECZARGOTCHI_CLOUDFLARE_ASSET_MODE === 'critical', 'production asset mode should be critical');
  assert(!result.PIECZARGOTCHI_CLOUDFLARE_DEBUG, 'debug flag should be removed');
  assert(!result.PIECZARGOTCHI_CLOUDFLARE_EXPOSE_RUNTIME, 'runtime exposure flag should be removed');
  assert(!result.PIECZARGOTCHI_ALLOW_DEBUG_BUILD, 'debug allow flag should be removed');
});

test('Wrangler is invoked through Node and its package JS entry', () => {
  const invocation = getWranglerInvocation(rootDir);
  assert(invocation.executable === process.execPath, 'deploy should use the current Node executable');
  assert(existsSync(invocation.entryPath), 'Wrangler JS entry should exist');
  assert(
    invocation.entryPath.endsWith(path.join('node_modules', 'wrangler', 'bin', 'wrangler.js')),
    `unexpected Wrangler entry: ${invocation.entryPath}`
  );
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
