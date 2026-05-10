import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const appUrl = process.argv[2] || 'http://127.0.0.1:8091/';
const outputPrefix = process.argv[3] || path.join(tmpdir(), 'pieczargotchi-render');
const chromiumPath = process.env.CHROMIUM_BIN || '/usr/bin/chromium';
const viewportWidth = Number(process.env.PIECZARGOTCHI_VIEWPORT_WIDTH) || 1194;
const viewportHeight = Number(process.env.PIECZARGOTCHI_VIEWPORT_HEIGHT) || 891;
const port = 9237 + Math.floor(Math.random() * 400);
const userDataDir = path.join(tmpdir(), `pieczargotchi-cdp-${Date.now()}`);
const stageSamples = [
  ['spore', 0],
  ['baby', 12],
  ['young', 35],
  ['adult', 70],
  ['legendary', 100]
];
const activitySamples = ['hydrate', 'feed', 'clean', 'play', 'instrument', 'sing', 'spores', 'harvest'];

const browser = spawn(chromiumPath, [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${userDataDir}`,
  'about:blank'
], {
  stdio: ['ignore', 'pipe', 'pipe']
});
const browserClosed = new Promise((resolve) => browser.on('close', resolve));

try {
  const endpoint = await waitForEndpoint();
  const cdp = await connectCdp(endpoint.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: viewportWidth,
    height: viewportHeight,
    deviceScaleFactor: 1,
    mobile: false
  });

  await navigate(cdp, appUrl);
  if (process.env.PIECZARGOTCHI_CAPTURE_VIEWPORT === '1') {
    await captureViewport(cdp);
  }
  await captureState(cdp, 'sleeping');
  await captureState(cdp, 'wake');
  await captureState(cdp, 'awake');

  if (process.env.PIECZARGOTCHI_CAPTURE_STAGES === '1') {
    for (const [stage, growth] of stageSamples) {
      await captureStage(cdp, stage, growth);
    }
  }

  if (process.env.PIECZARGOTCHI_CAPTURE_ACTIVITIES === '1') {
    for (const [stage, growth] of stageSamples) {
      for (const activity of activitySamples) {
        await captureActivity(cdp, stage, growth, activity);
      }
    }
  }

  await cdp.close();
} finally {
  browser.kill('SIGTERM');
  await Promise.race([browserClosed, delay(1000)]);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await rm(userDataDir, { recursive: true, force: true });
      break;
    } catch {
      await delay(250);
    }
  }
}

async function captureState(cdp, mode) {
  await captureCanvas(cdp, mode, {
    mode: mode === 'sleeping' ? 'sleeping' : 'awake',
    growth: 0,
    activity: mode === 'wake'
      ? `{ type: 'wake', label: 'O_O', startedAt: Date.now(), until: Date.now() + 1800 }`
      : 'null',
    expectedAnimationKey: mode === 'sleeping'
      ? 'spore.sleep'
      : mode === 'wake'
        ? 'spore.wake'
        : 'spore.idle'
  });
}

async function captureStage(cdp, stage, growth) {
  await captureCanvas(cdp, `stage-${stage}`, {
    mode: 'awake',
    growth,
    activity: 'null',
    expectedAnimationKey: `${stage}.idle`
  });
}

async function captureActivity(cdp, stage, growth, activity) {
  await captureCanvas(cdp, `activity-${stage}-${activity}`, {
    mode: 'awake',
    growth,
    activity: `{ type: ${JSON.stringify(activity)}, label: ${JSON.stringify(activity)}, startedAt: Date.now(), until: Date.now() + 2400 }`,
    expectedAnimationKey: `${stage}.activity.${activity}`
  });
}

async function captureCanvas(cdp, label, options) {
  const now = Date.now();
  const stateExpression = `(() => {
    const config = window.PIECZARGOTCHI_CONFIG;
    const state = JSON.parse(JSON.stringify(config.state.defaultState));
    const iso = new Date(${now}).toISOString();
    state.version = config.stateVersion;
    state.playerId = 'audit';
    state.createdAt = iso;
    state.lastUpdatedAt = iso;
    state.mode = ${JSON.stringify(options.mode)};
    state.stats.growth = ${JSON.stringify(options.growth)};
    state.stats.hydration = 70;
    state.stats.nutrients = 70;
    state.stats.energy = 80;
    state.stats.happiness = 60;
    state.stats.cleanliness = 80;
    state.stats.health = 100;
    state.patch.quality = 72;
    state.patch.mycelium = 0;
    state.attention.activeNeed = null;
    state.attention.severity = null;
    state.currentActivity = ${options.activity};
    localStorage.setItem(config.storageKey, JSON.stringify(state));
  })()`;

  await cdp.send('Runtime.evaluate', { expression: stateExpression, awaitPromise: true });
  await waitForLoad(cdp, () => cdp.send('Page.reload', { ignoreCache: true }));
  await waitForExpression(cdp, `document.querySelector('[data-asset-status]') && document.querySelector('[data-asset-status]').textContent.includes('Grafiki załadowane')`, 6000);
  await delay(350);

  const animationKey = await getCurrentAnimationKey(cdp);
  if (options.expectedAnimationKey && animationKey !== options.expectedAnimationKey) {
    throw new Error(`Nieprawidlowa animacja dla ${label}: ${animationKey}, oczekiwano ${options.expectedAnimationKey}`);
  }

  const result = await cdp.send('Runtime.evaluate', {
    expression: `document.getElementById('mushroomCanvas').toDataURL('image/png')`,
    returnByValue: true
  });
  const dataUrl = result.result.value;
  const png = Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
  const filePath = `${outputPrefix}-${label}.png`;
  writeFileSync(filePath, png);
  console.log(`${label}: ${filePath}`);
  if (animationKey) {
    console.log(`${label} animation: ${animationKey}`);
  }
}

async function captureViewport(cdp) {
  await waitForExpression(cdp, `document.querySelector('[data-asset-status]') && document.querySelector('[data-asset-status]').textContent.includes('Grafiki załadowane')`, 6000);
  await delay(350);

  const layout = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const side = document.querySelector('.side-panel').getBoundingClientRect();
      const canvas = document.querySelector('.canvas-wrap').getBoundingClientRect();
      return {
        innerWidth,
        innerHeight,
        side: { left: side.left, right: side.right, top: side.top, bottom: side.bottom, width: side.width, height: side.height },
        canvas: { left: canvas.left, right: canvas.right, top: canvas.top, bottom: canvas.bottom, width: canvas.width, height: canvas.height }
      };
    })()`,
    returnByValue: true
  });
  const info = layout.result.value;
  if (info.side.right > info.innerWidth + 1) {
    throw new Error(`Panel boczny wychodzi poza viewport: right=${info.side.right}, width=${info.innerWidth}`);
  }

  const screenshot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    clip: { x: 0, y: 0, width: viewportWidth, height: viewportHeight, scale: 1 }
  });
  const filePath = `${outputPrefix}-viewport-${viewportWidth}x${viewportHeight}.png`;
  writeFileSync(filePath, Buffer.from(screenshot.data, 'base64'));
  console.log(`viewport: ${filePath}`);
  console.log(`viewport layout: side=${Math.round(info.side.width)}x${Math.round(info.side.height)}, canvas=${Math.round(info.canvas.width)}x${Math.round(info.canvas.height)}`);
}

async function getCurrentAnimationKey(cdp) {
  const result = await cdp.send('Runtime.evaluate', {
    expression: `window.__pieczargotchiRuntime && window.__pieczargotchiRuntime.currentAnimationKey`,
    returnByValue: true
  });
  return result.result ? result.result.value : null;
}

async function navigate(cdp, url) {
  await waitForLoad(cdp, () => cdp.send('Page.navigate', { url }));
  await waitForExpression(cdp, 'Boolean(window.PIECZARGOTCHI_CONFIG)', 6000);
}

async function waitForEndpoint() {
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
        if (page) {
          return page;
        }
      }
    } catch {
      // Chromium jeszcze startuje.
    }
    await delay(100);
  }
  throw new Error('Nie udało się połączyć z Chromium DevTools.');
}

function connectCdp(url) {
  const socket = new WebSocket(url);
  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.method && listeners.has(message.method)) {
      const callbacks = listeners.get(message.method);
      listeners.delete(message.method);
      callbacks.forEach((callback) => callback(message.params || {}));
    }

    if (!message.id || !pending.has(message.id)) {
      return;
    }

    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) {
      reject(new Error(message.error.message || JSON.stringify(message.error)));
    } else {
      resolve(message.result || {});
    }
  });

  return new Promise((resolve, reject) => {
    socket.addEventListener('open', () => {
      resolve({
        send(method, params = {}) {
          const id = nextId;
          nextId += 1;
          socket.send(JSON.stringify({ id, method, params }));
          return new Promise((resolveSend, rejectSend) => {
            pending.set(id, { resolve: resolveSend, reject: rejectSend });
          });
        },
        close() {
          socket.close();
        },
        once(method, timeoutMs = 5000) {
          return new Promise((resolveOnce, rejectOnce) => {
            const timeout = setTimeout(() => {
              const callbacks = listeners.get(method) || [];
              listeners.set(method, callbacks.filter((callback) => callback !== done));
              rejectOnce(new Error(`Timeout: ${method}`));
            }, timeoutMs);

            function done(params) {
              clearTimeout(timeout);
              resolveOnce(params);
            }

            const callbacks = listeners.get(method) || [];
            callbacks.push(done);
            listeners.set(method, callbacks);
          });
        }
      });
    });
    socket.addEventListener('error', reject);
  });
}

async function waitForLoad(cdp, action) {
  const loadPromise = cdp.once('Page.loadEventFired', 5000);
  await action();
  await loadPromise.catch(() => {});
}

async function waitForExpression(cdp, expression, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true });
    if (result.result && result.result.value) {
      return;
    }
    await delay(100);
  }
  throw new Error(`Warunek nie spełnił się: ${expression}`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
