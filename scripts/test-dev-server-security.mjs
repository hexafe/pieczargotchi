import { spawn } from 'node:child_process';
import { rm, symlink } from 'node:fs/promises';
import { request } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const escapeLink = path.join(rootDir, 'assets', `.dev-server-security-escape-${process.pid}.txt`);
let escapeLinkCreated = false;
let port = 0;
try {
  await symlink(path.join(rootDir, 'README.md'), escapeLink, 'file');
  escapeLinkCreated = true;
} catch (error) {
  if (!error || !['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) {
    throw error;
  }
}
const server = spawn(process.execPath, ['dev-server.mjs', '0'], {
  cwd: rootDir,
  stdio: ['ignore', 'pipe', 'pipe']
});
let stderr = '';
let stdout = '';
let serverSpawnError = null;
server.stdout.on('data', (chunk) => {
  stdout += String(chunk);
  const match = stdout.match(/http:\/\/127\.0\.0\.1:(\d+)\//);
  if (match) {
    port = Number(match[1]);
  }
});
server.stderr.on('data', (chunk) => {
  stderr += String(chunk);
});
server.on('error', (error) => {
  serverSpawnError = error;
});

try {
  await waitForServer();
  const app = await testRequest('GET', '/', '127.0.0.1', 200);
  assert(!app.body.includes('<?= PIECZARGOTCHI_APP_VERSION ?>'), 'local preview should render versioned Apps Script bundle URLs');
  const config = await testRequest('GET', '/?bundle=config', 'localhost', 200);
  assert(config.body.includes('"assetMode":"critical"'), 'local preview should default to critical asset mode');
  const clientConfig = parseConfigBundle(config.body);
  const idleAnimation = clientConfig.animations.find((animation) => animation.key === 'spore.idle');
  const idleAsset = clientConfig.assets.find((asset) => asset.key === 'spore.idle');
  assert(idleAnimation && idleAsset, 'local preview should expose the critical spore idle animation and asset');
  assert(idleAnimation.bakedGrass === false, 'local preview should load SpriteLayout metadata for body-only atlases');
  assert(idleAnimation.frameWidth * idleAnimation.storedFrameCount === idleAsset.width,
    'animation layout should match the physical runtime atlas width');
  assert(idleAnimation.frameHeight === idleAsset.height,
    'animation layout should match the physical runtime atlas height');
  await testRequest('GET', '/assets/environment/grass_patch.png', '127.0.0.1', 200);
  await testRequest('GET', '/README.md', '127.0.0.1', 403);
  await testRequest('GET', '/assets/source/imagegen/raw/feed_atlas.png', '127.0.0.1', 403);
  await testRequest('GET', '/assets/SoUrCe/imagegen/raw/feed_atlas.png', '127.0.0.1', 403);
  await testRequest('GET', '/assets/ReFeReNcE/example.png', '127.0.0.1', 403);
  if (escapeLinkCreated) {
    await testRequest('GET', `/assets/${path.basename(escapeLink)}`, '127.0.0.1', 403);
  }
  await testRequest('GET', '/.clasp.json', '127.0.0.1', 403);
  await testRequest('GET', '/', 'attacker.example', 421);
  await testRequest('POST', '/', '127.0.0.1', 405);
  console.log('Local preview security contract passed.');
} finally {
  server.kill('SIGTERM');
  await rm(escapeLink, { force: true });
}

async function waitForServer() {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (serverSpawnError) {
      throw serverSpawnError;
    }
    if (server.exitCode !== null) {
      throw new Error(`dev-server exited early: ${stderr.trim()}`);
    }
    try {
      if (!port) {
        await delay(40);
        continue;
      }
      const response = await testRequest('GET', '/', '127.0.0.1', 200, false);
      if (response.status === 200) {
        return;
      }
    } catch (_error) {
      // Server jeszcze startuje.
    }
    await delay(80);
  }
  throw new Error(`dev-server did not start: ${stderr.trim() || stdout.trim()}`);
}

function testRequest(method, route, host, expectedStatus, assertStatus = true) {
  return new Promise((resolve, reject) => {
    const req = request({
      hostname: '127.0.0.1',
      port,
      path: route,
      method,
      headers: { Host: `${host}:${port}` }
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const result = { status: response.statusCode, body: Buffer.concat(chunks).toString('utf8') };
        try {
          if (assertStatus) {
            assert(result.status === expectedStatus, `${method} ${route} Host=${host}: expected ${expectedStatus}, got ${result.status}`);
          }
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function parseConfigBundle(source) {
  const prefix = 'window.PIECZARGOTCHI_CONFIG = ';
  assert(source.startsWith(prefix), 'local preview config bundle should use the expected assignment');
  return JSON.parse(source.slice(prefix.length).replace(/;\s*$/, ''));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
