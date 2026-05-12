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
const emulateMobile = process.env.PIECZARGOTCHI_EMULATE_MOBILE === '1';
const captureDelayMs = Number(process.env.PIECZARGOTCHI_CAPTURE_DELAY_MS) || 350;
const port = 9237 + Math.floor(Math.random() * 400);
const userDataDir = path.join(tmpdir(), `pieczargotchi-cdp-${Date.now()}`);
const captureDebugSettings = createCaptureDebugSettings();
const captureSceneOverrides = createCaptureSceneOverrides();
const stageSamples = [
  ['spore', 0],
  ['baby', 12],
  ['young', 35],
  ['adult', 70],
  ['legendary', 100]
];
const activitySamples = ['hydrate', 'feed', 'clean', 'play', 'instrument', 'sing', 'spores', 'harvest'];

function createCaptureDebugSettings() {
  const weather = process.env.PIECZARGOTCHI_DEBUG_WEATHER || 'auto';
  const cloud = readOptionalEnvNumber('PIECZARGOTCHI_DEBUG_CLOUD');
  const precipitation = readOptionalEnvNumber('PIECZARGOTCHI_DEBUG_PRECIPITATION');
  const wind = readOptionalEnvNumber('PIECZARGOTCHI_DEBUG_WIND');
  const windDirection = readOptionalEnvNumber('PIECZARGOTCHI_DEBUG_WIND_DIRECTION');
  const fixedAt = readOptionalEnvNumber('PIECZARGOTCHI_DEBUG_FIXED_AT');
  const easterEgg = process.env.PIECZARGOTCHI_DEBUG_EASTER_EGG || 'auto';
  const location = process.env.PIECZARGOTCHI_DEBUG_LOCATION || 'auto';
  const moonPhase = process.env.PIECZARGOTCHI_DEBUG_MOON_PHASE || 'auto';
  const constellation = process.env.PIECZARGOTCHI_DEBUG_CONSTELLATION || 'auto';
  const hasDebugWeather = weather !== 'auto'
    || cloud !== null
    || precipitation !== null
    || wind !== null
    || windDirection !== null
    || fixedAt !== null
    || easterEgg !== 'auto'
    || location !== 'auto'
    || moonPhase !== 'auto'
    || constellation !== 'auto';

  if (!hasDebugWeather) {
    return null;
  }

  return {
    enabled: true,
    fixedAt: fixedAt === null ? Date.now() : fixedAt,
    weather,
    cloudCoverOverride: cloud,
    precipitationOverride: precipitation,
    windSpeedOverride: wind,
    windDirectionOverride: windDirection,
    locationOverride: location,
    moonPhaseOverride: moonPhase,
    forcedConstellation: constellation,
    forcedAnimation: 'auto',
    forcedAnimationStartedAt: 0,
    neutralEasterEggOverride: easterEgg,
    panelOpen: false
  };
}

function readOptionalEnvNumber(name) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function createCaptureSceneOverrides() {
  const temperature = readOptionalEnvNumber('PIECZARGOTCHI_DEBUG_TEMPERATURE');
  const humidity = readOptionalEnvNumber('PIECZARGOTCHI_DEBUG_HUMIDITY');
  if (temperature === null && humidity === null) {
    return null;
  }

  return {
    temperature,
    humidity
  };
}

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
    mobile: emulateMobile
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
      ? `{ type: 'wake', label: 'O_O', startedAt: runtimeNow, until: runtimeNow + 1800 }`
      : 'null',
    expectedAnimationKey: mode === 'sleeping'
      ? 'spore.sleep'
      : mode === 'wake'
        ? 'spore.wake'
        : getExpectedAwakeIdleAnimationKey('spore')
  });
}

async function captureStage(cdp, stage, growth) {
  await captureCanvas(cdp, `stage-${stage}`, {
    mode: 'awake',
    growth,
    activity: 'null',
    expectedAnimationKey: getExpectedAwakeIdleAnimationKey(stage)
  });
}

async function captureActivity(cdp, stage, growth, activity) {
  await captureCanvas(cdp, `activity-${stage}-${activity}`, {
    mode: 'awake',
    growth,
    activity: `{ type: ${JSON.stringify(activity)}, label: ${JSON.stringify(activity)}, startedAt: runtimeNow, until: runtimeNow + 2400 }`,
    expectedAnimationKey: `${stage}.activity.${activity}`
  });
}

function getExpectedAwakeIdleAnimationKey(stage) {
  if (!captureDebugSettings || captureDebugSettings.neutralEasterEggOverride === 'auto') {
    return `${stage}.idle`;
  }

  if (captureDebugSettings.neutralEasterEggOverride === 'iwonia' && isCaptureRainy()) {
    return `${stage}.easter.neutral_rain`;
  }

  return `${stage}.easter.neutral`;
}

function isCaptureRainy() {
  if (!captureDebugSettings) {
    return false;
  }

  return ['rain', 'storm'].includes(captureDebugSettings.weather)
    && Math.max(0, Number(captureDebugSettings.precipitationOverride) || 0) > 0;
}

async function captureCanvas(cdp, label, options) {
  const now = Date.now();
  const stateExpression = `(() => {
    const config = window.PIECZARGOTCHI_CONFIG;
    const state = JSON.parse(JSON.stringify(config.state.defaultState));
    const debugSettings = ${JSON.stringify(captureDebugSettings)};
    const runtimeNow = debugSettings && Number.isFinite(Number(debugSettings.fixedAt))
      ? Number(debugSettings.fixedAt)
      : ${now};
    const iso = new Date(runtimeNow).toISOString();
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
    if (debugSettings) {
      localStorage.setItem((config.storageKey || 'pieczargotchi_state_v2') + '_debug', JSON.stringify(debugSettings));
    }
  })()`;

  await cdp.send('Runtime.evaluate', { expression: stateExpression, awaitPromise: true });
  await waitForLoad(cdp, () => cdp.send('Page.reload', { ignoreCache: true }));
  await waitForExpression(cdp, `document.querySelector('[data-asset-status]') && document.querySelector('[data-asset-status]').textContent.includes('Grafiki załadowane')`, 6000);
  await applyCaptureSceneOverrides(cdp);
  await waitForExpression(cdp, `Boolean(window.__pieczargotchiRuntime && window.__pieczargotchiRuntime.booted && window.__pieczargotchiRuntime.currentAnimationKey)`, 6000);
  await delay(captureDelayMs);

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

  if (process.env.PIECZARGOTCHI_CAPTURE_LIFE_PROFILE === '1') {
    const profile = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const runtime = window.__pieczargotchiRuntime;
        if (!runtime || !window.PieczargotchiCore || !window.PieczargotchiCore.calculateAmbientLife) {
          return null;
        }
        return window.PieczargotchiCore.calculateAmbientLife(runtime.weatherScene, new Date(runtime.debug && runtime.debug.fixedAt || Date.now()));
      })()`,
      returnByValue: true
    });
    console.log(`${label} life: ${JSON.stringify(profile.result.value)}`);
    const sceneSummary = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const scene = window.__pieczargotchiRuntime && window.__pieczargotchiRuntime.weatherScene;
        if (!scene) {
          return null;
        }
        return {
          condition: scene.condition,
          dayPhase: scene.dayPhase,
          temperature: scene.temperature,
          apparentTemperature: scene.apparentTemperature,
          windSpeed: scene.windSpeed,
          windLevel: scene.windLevel,
          gustLevel: scene.gustLevel,
          precipitation: scene.precipitation
        };
      })()`,
      returnByValue: true
    });
    console.log(`${label} scene: ${JSON.stringify(sceneSummary.result.value)}`);
  }
}

async function applyCaptureSceneOverrides(cdp) {
  if (!captureSceneOverrides) {
    return;
  }

  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const runtime = window.__pieczargotchiRuntime;
      const overrides = ${JSON.stringify(captureSceneOverrides)};
      if (!runtime || !runtime.weatherScene || !overrides) {
        return;
      }
      if (overrides.temperature !== null) {
        runtime.weatherScene.temperature = overrides.temperature;
        runtime.weatherScene.apparentTemperature = overrides.temperature;
      }
      if (overrides.humidity !== null) {
        runtime.weatherScene.humidity = overrides.humidity;
      }
    })()`,
    awaitPromise: true
  });
}

async function captureViewport(cdp) {
  await waitForExpression(cdp, `document.querySelector('[data-asset-status]') && document.querySelector('[data-asset-status]').textContent.includes('Grafiki załadowane')`, 6000);
  await waitForExpression(cdp, `Boolean(window.__pieczargotchiRuntime && window.__pieczargotchiRuntime.booted && window.__pieczargotchiRuntime.currentAnimationKey)`, 6000);
  await delay(captureDelayMs);

  const layout = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const rectOf = (selector) => {
        const element = document.querySelector(selector);
        if (!element) {
          return null;
        }

        const rect = element.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height
        };
      };
      const actionButtons = Array.from(document.querySelectorAll('.action-button')).map((button) => {
        const rect = button.getBoundingClientRect();
        const label = button.querySelector('.action-label');
        return {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          labelText: label ? label.textContent : '',
          labelClipped: label ? label.scrollWidth > label.clientWidth + 1 || label.scrollHeight > label.clientHeight + 1 : false
        };
      });
      const actionsGrid = document.querySelector('.actions-grid');
      const actionColumns = actionsGrid
        ? getComputedStyle(actionsGrid).gridTemplateColumns.split(' ').filter(Boolean).length
        : 0;
      return {
        innerWidth,
        innerHeight,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        app: rectOf('.app'),
        stage: rectOf('.stage-panel'),
        message: rectOf('.message-panel'),
        side: rectOf('.side-panel'),
        actions: rectOf('.panel-block--actions'),
        status: rectOf('.panel-block--status'),
        resources: rectOf('.panel-block--resources'),
        log: rectOf('.panel-block--log'),
        debug: rectOf('.panel-block--debug'),
        canvas: rectOf('.canvas-wrap'),
        actionColumns,
        actionButtons
      };
    })()`,
    returnByValue: true
  });
  const info = layout.result.value;
  if (info.documentWidth > info.innerWidth + 1 || info.bodyWidth > info.innerWidth + 1) {
    throw new Error(`Strona wychodzi poza viewport: document=${info.documentWidth}, body=${info.bodyWidth}, width=${info.innerWidth}`);
  }

  if (info.side && info.side.right > info.innerWidth + 1) {
    throw new Error(`Panel boczny wychodzi poza viewport: right=${info.side.right}, width=${info.innerWidth}`);
  }

  if (viewportWidth <= 640 || emulateMobile) {
    assertMobileLayout(info);
  }

  const screenshot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    clip: { x: 0, y: 0, width: viewportWidth, height: viewportHeight, scale: 1 }
  });
  const filePath = `${outputPrefix}-viewport-${viewportWidth}x${viewportHeight}.png`;
  writeFileSync(filePath, Buffer.from(screenshot.data, 'base64'));
  console.log(`viewport: ${filePath}`);
  console.log(`viewport layout: side=${Math.round(info.side.width)}x${Math.round(info.side.height)}, canvas=${Math.round(info.canvas.width)}x${Math.round(info.canvas.height)}, actionColumns=${info.actionColumns}`);
}

function assertMobileLayout(info) {
  if (!info.stage || !info.canvas || !info.message || !info.actions || !info.status) {
    throw new Error('Brakuje kluczowych elementów layoutu mobilnego.');
  }

  const canvasTopLimit = info.innerWidth <= 640 || info.innerHeight <= 500 ? 150 : 190;
  if (info.canvas.top > canvasTopLimit) {
    throw new Error(`Canvas jest zbyt nisko na mobile: top=${Math.round(info.canvas.top)}px, limit=${canvasTopLimit}px`);
  }

  if (info.actions.top < info.stage.bottom - 1) {
    throw new Error('Panel akcji nakłada się na scenę.');
  }

  if (info.actions.top - info.stage.bottom > 18) {
    throw new Error(`Akcje są za daleko od sceny: gap=${Math.round(info.actions.top - info.stage.bottom)}px`);
  }

  if (info.status.top < info.actions.bottom - 1) {
    throw new Error('Status powinien być pod akcjami w układzie mobilnym.');
  }

  if (info.actionColumns < 2) {
    throw new Error(`Akcje mobilne powinny mieć 2 kolumny, wykryto ${info.actionColumns}.`);
  }

  const shortButtons = info.actionButtons.filter((button) => button.height < 48);
  if (shortButtons.length) {
    throw new Error(`Za niskie touch targety akcji: ${shortButtons.map((button) => `${button.labelText}:${Math.round(button.height)}px`).join(', ')}`);
  }

  const clippedLabels = info.actionButtons.filter((button) => button.labelClipped);
  if (clippedLabels.length) {
    throw new Error(`Ucięte etykiety akcji: ${clippedLabels.map((button) => button.labelText).join(', ')}`);
  }

  if (info.innerWidth >= 390 && info.innerWidth <= 430 && info.innerHeight >= 844 && info.actions.bottom > info.innerHeight + 24) {
    throw new Error(`Pełny panel akcji nie mieści się wystarczająco wysoko na 390x844: bottom=${Math.round(info.actions.bottom)}px`);
  }
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
