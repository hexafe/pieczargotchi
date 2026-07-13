import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let appUrl = '';
const configuredOutputDir = String(process.env.PIECZARGOTCHI_BROWSER_SMOKE_OUTPUT_DIR || '').trim();
const outputDir = configuredOutputDir
  ? path.resolve(rootDir, configuredOutputDir)
  : path.join(tmpdir(), `pieczargotchi-browser-smoke-${process.pid}`);
const outputPrefix = path.join(outputDir, 'capture');
const chromiumPath = findChromium();
await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
const server = spawn(process.execPath, ['dev-server.mjs', '0'], {
  cwd: rootDir,
  env: {
    ...process.env,
    PIECZARGOTCHI_ASSET_MODE: 'critical'
  },
  stdio: ['ignore', 'pipe', 'pipe']
});
let serverError = '';
let serverSpawnError = null;
let serverOutput = '';
server.stdout.on('data', (chunk) => {
  serverOutput += String(chunk);
  const match = serverOutput.match(/http:\/\/127\.0\.0\.1:(\d+)\//);
  if (match) {
    appUrl = `http://127.0.0.1:${match[1]}/`;
  }
});
server.stderr.on('data', (chunk) => {
  serverError += String(chunk);
});
server.on('error', (error) => {
  serverSpawnError = error;
});

let smokePassed = false;
try {
  await waitForPreview();
  await runCapture();
  await runMobileVisualProbe();
  await runUiFlowProbe();
  await runExceptionProbe();
  smokePassed = true;
  console.log(`Browser smoke passed with ${chromiumPath}.`);
} finally {
  server.kill('SIGTERM');
  if (smokePassed) {
    await rm(outputDir, { recursive: true, force: true });
  } else {
    console.error(`Artefakty nieudanego browser smoke zachowano w: ${outputDir}`);
  }
}

function findChromium() {
  const candidates = [
    process.env.CHROMIUM_BIN,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe')
  ].filter(Boolean);
  const match = candidates.find((candidate) => existsSync(candidate));
  if (!match) {
    throw new Error('Nie znaleziono Chromium/Chrome. Ustaw CHROMIUM_BIN przed pełnym npm run qa.');
  }
  return match;
}

async function waitForPreview() {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (serverSpawnError) {
      throw serverSpawnError;
    }
    if (server.exitCode !== null) {
      throw new Error(`Local preview zakończył się przed smoke testem: ${serverError.trim()}`);
    }
    if (!appUrl) {
      await delay(40);
      continue;
    }
    try {
      const response = await fetch(appUrl);
      if (response.ok) {
        return;
      }
    } catch (_error) {
      // Server jeszcze startuje.
    }
    await delay(100);
  }
  throw new Error(`Local preview nie wystartował w 10 s: ${serverError.trim() || serverOutput.trim()}`);
}

function runCapture() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      'scripts/capture-app-render.mjs',
      appUrl,
      outputPrefix
    ], {
      cwd: rootDir,
      env: {
        ...process.env,
        CHROMIUM_BIN: chromiumPath,
        PIECZARGOTCHI_CAPTURE_DELAY_MS: '80',
        PIECZARGOTCHI_CAPTURE_ALL_MINIGAMES: '1',
        PIECZARGOTCHI_CAPTURE_INTERACTIONS: '1',
        PIECZARGOTCHI_CAPTURE_JOURNAL: '1'
      },
      stdio: 'inherit'
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Browser capture zakończył się kodem ${code}.`));
      }
    });
  });
}

function runMobileVisualProbe() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      'scripts/capture-app-render.mjs',
      appUrl,
      path.join(outputDir, 'mobile-visual')
    ], {
      cwd: rootDir,
      env: {
        ...process.env,
        CHROMIUM_BIN: chromiumPath,
        PIECZARGOTCHI_CAPTURE_DELAY_MS: '80',
        PIECZARGOTCHI_CAPTURE_INTERACTIONS: '1',
        PIECZARGOTCHI_CAPTURE_JOURNAL: '1',
        PIECZARGOTCHI_VIEWPORT_WIDTH: '390',
        PIECZARGOTCHI_VIEWPORT_HEIGHT: '844',
        PIECZARGOTCHI_EMULATE_MOBILE: '1'
      },
      stdio: 'inherit'
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Mobilny journal/touch probe zakończył się kodem ${code}.`));
      }
    });
  });
}

function runExceptionProbe() {
  return new Promise((resolve, reject) => {
    let output = '';
    const child = spawn(process.execPath, [
      'scripts/capture-app-render.mjs',
      appUrl,
      path.join(outputDir, 'exception-probe')
    ], {
      cwd: rootDir,
      env: {
        ...process.env,
        CHROMIUM_BIN: chromiumPath,
        PIECZARGOTCHI_CAPTURE_EXCEPTION_PROBE: '1'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    child.stdout.on('data', (chunk) => { output += String(chunk); });
    child.stderr.on('data', (chunk) => { output += String(chunk); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0 && output.includes('PIECZARGOTCHI_CAPTURE_EXCEPTION_PROBE')) {
        resolve();
      } else {
        reject(new Error(`Capture exception probe nie zadziałał (code=${code}): ${output.slice(-1200)}`));
      }
    });
  });
}

function runUiFlowProbe() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      'scripts/capture-app-render.mjs',
      appUrl,
      path.join(outputDir, 'ui-flow')
    ], {
      cwd: rootDir,
      env: {
        ...process.env,
        CHROMIUM_BIN: chromiumPath,
        PIECZARGOTCHI_CAPTURE_UI_FLOW: '1',
        PIECZARGOTCHI_VIEWPORT_WIDTH: '390',
        PIECZARGOTCHI_VIEWPORT_HEIGHT: '844',
        PIECZARGOTCHI_EMULATE_MOBILE: '1'
      },
      stdio: 'inherit'
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Realny UI flow zakończył się kodem ${code}.`));
      }
    });
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
