import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputDir = path.join(tmpdir(), `pieczargotchi-ui-viewports-${process.pid}`);
const chromiumPath = findChromium();
const viewports = [
  { width: 1440, height: 900, label: 'desktop-wide' },
  { width: 1194, height: 891, label: 'desktop-reference' },
  { width: 1024, height: 600, label: 'desktop-short' },
  { width: 900, height: 600, label: 'desktop-short-narrow' },
  { width: 844, height: 390, label: 'landscape-wide', mobile: true },
  { width: 740, height: 360, label: 'landscape-short', mobile: true },
  { width: 768, height: 1024, label: 'tablet' },
  { width: 390, height: 844, label: 'mobile-reference', mobile: true },
  { width: 360, height: 800, label: 'mobile-narrow', mobile: true },
  { width: 320, height: 568, label: 'mobile-small', mobile: true },
  { width: 640, height: 500, label: 'breakpoint-640', mobile: true },
  { width: 641, height: 500, label: 'breakpoint-641' },
  { width: 642, height: 500, label: 'breakpoint-642' },
  { width: 643, height: 500, label: 'breakpoint-643' },
  { width: 644, height: 500, label: 'breakpoint-644' },
  { width: 645, height: 500, label: 'breakpoint-645' },
  { width: 645, height: 700, label: 'breakpoint-645-tall' },
  { width: 646, height: 500, label: 'breakpoint-646' }
];
const activeMinigameViewports = [
  { width: 1194, height: 891, label: 'active-desktop-reference' },
  { width: 1024, height: 600, label: 'active-desktop-short' },
  { width: 900, height: 600, label: 'active-desktop-short-narrow' },
  { width: 844, height: 390, label: 'active-landscape-wide', mobile: true },
  { width: 740, height: 360, label: 'active-landscape-short', mobile: true },
  { width: 320, height: 568, label: 'active-mobile-small', mobile: true },
  { width: 641, height: 500, label: 'active-breakpoint-641', mobile: true },
  { width: 646, height: 500, label: 'active-breakpoint-646', mobile: true }
];

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

let appUrl = '';
let serverOutput = '';
let serverError = '';
let serverSpawnError = null;
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

let passed = false;
try {
  await waitForPreview();
  for (const viewport of viewports) {
    await runViewport(viewport);
  }
  for (const viewport of activeMinigameViewports) {
    await runViewport(viewport, { activeMinigames: true });
  }
  passed = true;
  console.log(`UI viewport contracts passed for ${viewports.length} base viewport(s) and ${activeMinigameViewports.length} active-minigame viewport(s).`);
} finally {
  server.kill('SIGTERM');
  if (passed) {
    await rm(outputDir, { recursive: true, force: true });
  } else {
    console.error(`Artefakty nieudanego testu viewportów zachowano w: ${outputDir}`);
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
    throw new Error('Nie znaleziono Chromium/Chrome. Ustaw CHROMIUM_BIN przed testem viewportów.');
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
      throw new Error(`Local preview zakończył się przed testem viewportów: ${serverError.trim()}`);
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
      // Preview jeszcze startuje.
    }
    await delay(100);
  }
  throw new Error(`Local preview nie wystartował w 10 s: ${serverError.trim() || serverOutput.trim()}`);
}

function runViewport(viewport, options = {}) {
  const prefix = path.join(outputDir, viewport.label);
  const activeMinigames = Boolean(options.activeMinigames);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      'scripts/capture-app-render.mjs',
      appUrl,
      prefix
    ], {
      cwd: rootDir,
      env: {
        ...process.env,
        CHROMIUM_BIN: chromiumPath,
        PIECZARGOTCHI_CAPTURE_DELAY_MS: '40',
        PIECZARGOTCHI_CAPTURE_VIEWPORT: activeMinigames ? '0' : '1',
        PIECZARGOTCHI_CAPTURE_ALL_MINIGAMES: activeMinigames ? '1' : '0',
        PIECZARGOTCHI_CAPTURE_MINIGAMES_ONLY: activeMinigames ? '1' : '0',
        PIECZARGOTCHI_CAPTURE_MINIGAME_PANEL: activeMinigames ? '1' : '0',
        PIECZARGOTCHI_VIEWPORT_WIDTH: String(viewport.width),
        PIECZARGOTCHI_VIEWPORT_HEIGHT: String(viewport.height),
        PIECZARGOTCHI_EMULATE_MOBILE: viewport.mobile ? '1' : '0'
      },
      stdio: 'inherit'
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${activeMinigames ? 'Active minigame viewport' : 'Viewport'} ${viewport.label} (${viewport.width}x${viewport.height}) zakończył się kodem ${code}.`));
    });
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
