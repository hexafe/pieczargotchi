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
const captureAppsScriptNoAssets = process.env.PIECZARGOTCHI_CAPTURE_APPS_SCRIPT_NO_ASSETS === '1';
const port = 9237 + Math.floor(Math.random() * 400);
const userDataDir = path.join(tmpdir(), `pieczargotchi-cdp-${Date.now()}`);
const captureDebugSettings = createCaptureDebugSettings();
const captureSceneOverrides = createCaptureSceneOverrides();
const captureDecorations = readListEnv('PIECZARGOTCHI_CAPTURE_DECORATIONS');
const stageSamples = [
  ['spore', 0],
  ['baby', 12],
  ['young', 35],
  ['adult', 70],
  ['legendary', 100]
];
const activitySamples = ['hydrate', 'feed', 'clean', 'play', 'instrument', 'sing', 'spores', 'harvest'];
const immersionSamples = [
  { id: 'pointerHover', state: 'curious' },
  { id: 'idleFidget', state: 'idle_fidget' },
  { id: 'idleFidgetSway', state: 'idle_fidget_sway' },
  { id: 'idleLookLeft', state: 'idle_look_left' },
  { id: 'idleLookRight', state: 'idle_look_right' },
  { id: 'ponder', state: 'ponder' },
  { id: 'ponderUp', state: 'ponder_up' },
  { id: 'ponderSide', state: 'ponder_side' },
  { id: 'cursorLeft', state: 'watch_cursor_left' },
  { id: 'cursorRight', state: 'watch_cursor_right' },
  { id: 'cursorUpLeft', state: 'watch_cursor_up_left' },
  { id: 'cursorUpRight', state: 'watch_cursor_up_right' },
  { id: 'cursorFast', state: 'follow_cursor_fast' },
  { id: 'cursorAfter', state: 'follow_cursor_after' },
  { id: 'sun', state: 'sun' },
  { id: 'rain', state: 'rain' },
  { id: 'stargaze', state: 'stargaze' },
  { id: 'snow', state: 'snow' },
  { id: 'ambientButterfly', state: 'watch_butterfly' },
  { id: 'ambientFirefly', state: 'watch_firefly' },
  { id: 'ambientCrawler', state: 'watch_crawler' }
];

function createCaptureDebugSettings() {
  const liveWeatherBaseline = process.env.PIECZARGOTCHI_CAPTURE_LIVE_WEATHER === '1';
  const explicitDebugWeather = process.env.PIECZARGOTCHI_DEBUG_WEATHER !== undefined;
  const deterministicBaseline = !liveWeatherBaseline && !explicitDebugWeather;
  const weather = process.env.PIECZARGOTCHI_DEBUG_WEATHER || (deterministicBaseline ? 'clear' : 'auto');
  const cloud = readOptionalEnvNumber('PIECZARGOTCHI_DEBUG_CLOUD');
  const precipitation = readOptionalEnvNumber('PIECZARGOTCHI_DEBUG_PRECIPITATION');
  const wind = readOptionalEnvNumber('PIECZARGOTCHI_DEBUG_WIND');
  const windDirection = readOptionalEnvNumber('PIECZARGOTCHI_DEBUG_WIND_DIRECTION');
  const fixedAt = readOptionalEnvNumber('PIECZARGOTCHI_DEBUG_FIXED_AT');
  const easterEgg = process.env.PIECZARGOTCHI_DEBUG_EASTER_EGG || 'auto';
  const location = process.env.PIECZARGOTCHI_DEBUG_LOCATION || 'auto';
  const moonPhase = process.env.PIECZARGOTCHI_DEBUG_MOON_PHASE || 'auto';
  const constellation = process.env.PIECZARGOTCHI_DEBUG_CONSTELLATION || 'auto';
  const skyEffect = process.env.PIECZARGOTCHI_DEBUG_SKY_EFFECT || 'auto';
  const rainbow = process.env.PIECZARGOTCHI_DEBUG_RAINBOW || 'auto';
  const hasDebugWeather = deterministicBaseline
    || weather !== 'auto'
    || cloud !== null
    || precipitation !== null
    || wind !== null
    || windDirection !== null
    || fixedAt !== null
    || easterEgg !== 'auto'
    || location !== 'auto'
    || moonPhase !== 'auto'
    || constellation !== 'auto'
    || skyEffect !== 'auto'
    || rainbow !== 'auto';

  if (!hasDebugWeather) {
    return null;
  }

  return {
    enabled: true,
    fixedAt: fixedAt === null
      ? (deterministicBaseline ? Date.parse('2026-05-14T12:00:00.000Z') : Date.now())
      : fixedAt,
    weather,
    cloudCoverOverride: cloud === null && deterministicBaseline ? 18 : cloud,
    precipitationOverride: precipitation === null && deterministicBaseline ? 0 : precipitation,
    windSpeedOverride: wind === null && deterministicBaseline ? 1.2 : wind,
    windDirectionOverride: windDirection,
    locationOverride: location,
    moonPhaseOverride: moonPhase,
    rainbowOverride: rainbow,
    forcedConstellation: constellation,
    skyEffectOverride: skyEffect,
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

function readListEnv(name) {
  return String(process.env[name] || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function createCaptureSceneOverrides() {
  const temperature = readOptionalEnvNumber('PIECZARGOTCHI_DEBUG_TEMPERATURE');
  const humidity = readOptionalEnvNumber('PIECZARGOTCHI_DEBUG_HUMIDITY');
  const dewPoint = readOptionalEnvNumber('PIECZARGOTCHI_DEBUG_DEW_POINT');
  const pressure = readOptionalEnvNumber('PIECZARGOTCHI_DEBUG_PRESSURE');
  const visibility = readOptionalEnvNumber('PIECZARGOTCHI_DEBUG_VISIBILITY');
  const vaporPressureDeficit = readOptionalEnvNumber('PIECZARGOTCHI_DEBUG_VPD');
  const evapotranspiration = readOptionalEnvNumber('PIECZARGOTCHI_DEBUG_ET0');
  const snowDepth = readOptionalEnvNumber('PIECZARGOTCHI_DEBUG_SNOW_DEPTH');
  const surfaceWetnessTarget = readOptionalEnvNumber('PIECZARGOTCHI_DEBUG_SURFACE_WETNESS');
  const snowCoverTarget = readOptionalEnvNumber('PIECZARGOTCHI_DEBUG_SNOW_COVER');
  if (
    temperature === null
    && humidity === null
    && dewPoint === null
    && pressure === null
    && visibility === null
    && vaporPressureDeficit === null
    && evapotranspiration === null
    && snowDepth === null
    && surfaceWetnessTarget === null
    && snowCoverTarget === null
  ) {
    return null;
  }

  return {
    temperature,
    humidity,
    dewPoint,
    pressure,
    visibility,
    vaporPressureDeficit,
    evapotranspiration,
    snowDepth,
    surfaceWetnessTarget,
    snowCoverTarget
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
  if (captureAppsScriptNoAssets) {
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        (() => {
          function createRunner(successHandler, failureHandler) {
            return {
              withSuccessHandler(handler) {
                return createRunner(handler, failureHandler);
              },
              withFailureHandler(handler) {
                return createRunner(successHandler, handler);
              },
              getAssetDataUrl(assetKey) {
                setTimeout(() => {
                  if (typeof successHandler === 'function') {
                    successHandler({
                      key: String(assetKey || ''),
                      fileName: '',
                      required: false,
                      dataUrl: null,
                      source: null,
                      status: 'missingFileId',
                      error: 'capture Apps Script no-assets stub'
                    });
                  }
                }, 0);
              }
            };
          }

          window.google = {
            script: {
              run: createRunner(null, null)
            }
          };
        })();
      `
    });
  }
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

  if (process.env.PIECZARGOTCHI_CAPTURE_IMMERSION === '1') {
    for (const sample of immersionSamples) {
      await captureImmersion(cdp, sample);
    }
  }

  if (process.env.PIECZARGOTCHI_CAPTURE_ARENA === '1') {
    await captureArena(cdp);
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
    activity: `{ type: ${JSON.stringify(activity)}, label: ${JSON.stringify(activity)}, startedAt: runtimeNow - 850, until: runtimeNow + 2400 }`,
    expectedAnimationKey: `${stage}.activity.${activity}`
  });
}

async function captureImmersion(cdp, sample) {
  await captureCanvas(cdp, `immersion-${sample.id}`, {
    mode: 'awake',
    growth: 70,
    activity: 'null',
    expectedAnimationKey: `adult.${sample.state}`,
    immersion: sample
  });
}

async function captureArena(cdp) {
  await assertArenaUnlockVisibility(cdp);
  const now = Date.now();
  const stateExpression = `(() => {
    const config = window.PIECZARGOTCHI_CONFIG;
    const state = JSON.parse(JSON.stringify(config.state.defaultState));
    const iso = new Date(${now}).toISOString();
    state.version = config.stateVersion;
    state.playerId = 'arena-audit';
    state.createdAt = iso;
    state.lastUpdatedAt = iso;
    state.mode = 'awake';
    state.stats.growth = 100;
    state.stats.hydration = 86;
    state.stats.nutrients = 86;
    state.stats.energy = 90;
    state.stats.happiness = 88;
    state.stats.cleanliness = 90;
    state.stats.health = 100;
    state.inventory.spores = 6;
    state.coins = 6;
    localStorage.setItem(config.storageKey, JSON.stringify(state));
  })()`;

  await cdp.send('Runtime.evaluate', { expression: stateExpression, awaitPromise: true });
  await waitForLoad(cdp, () => cdp.send('Page.reload', { ignoreCache: true }));
  await waitForExpression(cdp, `Boolean(window.__pieczargotchiRuntime && window.__pieczargotchiRuntime.booted)`, 6000);
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('[data-view-arena]').click()`,
    awaitPromise: true
  });
  await waitForExpression(cdp, `!document.querySelector('[data-arena-panel]').hidden`, 2000);
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('[data-battle-start]').click()`,
    awaitPromise: true
  });
  await waitForExpression(cdp, `Boolean(window.__pieczargotchiRuntime.state.battle.activeBattle)`, 2000);
  await delay(captureDelayMs);

  const info = await getArenaLayout(cdp);
  assertArenaLayout(info);

  const screenshot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    clip: { x: 0, y: 0, width: viewportWidth, height: viewportHeight, scale: 1 }
  });
  const filePath = `${outputPrefix}-arena-${viewportWidth}x${viewportHeight}.png`;
  writeFileSync(filePath, Buffer.from(screenshot.data, 'base64'));
  console.log(`arena: ${filePath}`);
  console.log(`arena layout: moves=${info.moveColumns}, minMoveHeight=${Math.round(info.minMoveHeight)}px, arenaHidden=${info.arenaHidden}`);
}

async function assertArenaUnlockVisibility(cdp) {
  await setCaptureGrowth(cdp, 70);
  let visibility = await getArenaVisibility(cdp);
  if (!visibility.switchHidden || !visibility.arenaHidden) {
    throw new Error('Arena powinna być ukryta przed etapem legendary.');
  }

  await setCaptureGrowth(cdp, 100);
  visibility = await getArenaVisibility(cdp);
  if (visibility.switchHidden) {
    throw new Error('Przełącznik areny powinien być widoczny na etapie legendary.');
  }
}

async function setCaptureGrowth(cdp, growth) {
  const now = Date.now();
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const config = window.PIECZARGOTCHI_CONFIG;
      const state = JSON.parse(JSON.stringify(config.state.defaultState));
      const iso = new Date(${now}).toISOString();
      state.version = config.stateVersion;
      state.playerId = 'arena-unlock-audit';
      state.createdAt = iso;
      state.lastUpdatedAt = iso;
      state.mode = 'awake';
      state.stats.growth = ${growth};
      state.stats.hydration = 80;
      state.stats.nutrients = 80;
      state.stats.energy = 80;
      state.stats.happiness = 80;
      state.stats.cleanliness = 80;
      state.stats.health = 100;
      localStorage.setItem(config.storageKey, JSON.stringify(state));
    })()`,
    awaitPromise: true
  });
  await waitForLoad(cdp, () => cdp.send('Page.reload', { ignoreCache: true }));
  await waitForExpression(cdp, `Boolean(window.__pieczargotchiRuntime && window.__pieczargotchiRuntime.booted)`, 6000);
}

async function getArenaVisibility(cdp) {
  const result = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const viewSwitch = document.querySelector('[data-view-switch]');
      const arenaPanel = document.querySelector('[data-arena-panel]');
      return {
        switchHidden: !viewSwitch || viewSwitch.hidden || getComputedStyle(viewSwitch).display === 'none',
        arenaHidden: !arenaPanel || arenaPanel.hidden || getComputedStyle(arenaPanel).display === 'none'
      };
    })()`,
    returnByValue: true
  });
  return result.result.value;
}

async function getArenaLayout(cdp) {
  const result = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const rectOf = (selector) => {
        const element = document.querySelector(selector);
        if (!element) {
          return null;
        }
        const rect = element.getBoundingClientRect();
        return {
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height
        };
      };
      const moveButtons = Array.from(document.querySelectorAll('.battle-move-button')).map((button) => {
        const rect = button.getBoundingClientRect();
        return {
          height: rect.height,
          text: button.textContent,
          clipped: button.scrollWidth > button.clientWidth + 1 || button.scrollHeight > button.clientHeight + 1
        };
      });
      const moves = document.querySelector('.battle-moves');
      const moveColumns = moves
        ? getComputedStyle(moves).gridTemplateColumns.split(' ').filter(Boolean).length
        : 0;
      const canvas = document.getElementById('mushroomCanvas');
      const imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let nonBlank = 0;
      for (let index = 3; index < imageData.length; index += 40) {
        if (imageData[index] !== 0) {
          nonBlank += 1;
        }
      }
      return {
        innerWidth,
        innerHeight,
        documentWidth: document.documentElement.scrollWidth,
        stage: rectOf('.stage-panel'),
        message: rectOf('.message-panel'),
        arena: rectOf('[data-arena-panel]'),
        moves: rectOf('.battle-moves'),
        status: rectOf('.battle-status'),
        log: rectOf('.battle-log'),
        moveColumns,
        minMoveHeight: moveButtons.reduce((min, button) => Math.min(min, button.height), Infinity),
        clippedMoves: moveButtons.filter((button) => button.clipped).map((button) => button.text),
        arenaHidden: document.querySelector('[data-arena-panel]').hidden,
        nonBlank
      };
    })()`,
    returnByValue: true
  });
  return result.result.value;
}

function assertArenaLayout(info) {
  if (info.documentWidth > info.innerWidth + 1) {
    throw new Error(`Arena wychodzi poza viewport: document=${info.documentWidth}, width=${info.innerWidth}`);
  }
  if (!info.stage || !info.message || !info.arena || !info.moves || !info.status || !info.log) {
    throw new Error('Brakuje kluczowych elementów areny.');
  }
  if (info.arenaHidden) {
    throw new Error('Panel areny jest ukryty po przełączeniu.');
  }
  if (info.moveColumns !== 2) {
    throw new Error(`Ruchy areny powinny mieć 2 kolumny, wykryto ${info.moveColumns}.`);
  }
  if (info.minMoveHeight < 48) {
    throw new Error(`Ruchy areny mają za niski touch target: ${Math.round(info.minMoveHeight)}px.`);
  }
  if (info.clippedMoves.length) {
    throw new Error(`Ucięte etykiety ruchów areny: ${info.clippedMoves.join(', ')}`);
  }
  if (rectsHorizontallyOverlap(info.moves, info.message) && info.moves.top < info.message.bottom - 1) {
    throw new Error('Ruchy areny nakładają się na komunikat.');
  }
  if (info.status.top < info.moves.bottom - 1 || info.log.top < info.status.bottom - 1) {
    throw new Error('Status i log areny powinny być pod ruchami.');
  }
  if (info.nonBlank < 100) {
    throw new Error('Canvas areny wygląda na pusty.');
  }
}

function rectsHorizontallyOverlap(first, second) {
  if (!first || !second) {
    return false;
  }
  return first.left < second.right - 1 && second.left < first.right - 1;
}

function getExpectedAwakeIdleAnimationKey(stage) {
  if (!captureDebugSettings || captureDebugSettings.neutralEasterEggOverride === 'auto') {
    if (isCaptureRainy()) {
      return `${stage}.rain`;
    }
    if (isCaptureSnowy()) {
      return `${stage}.snow`;
    }
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

function isCaptureSnowy() {
  if (!captureDebugSettings) {
    return false;
  }

  return captureDebugSettings.weather === 'snow'
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
    state.decorations.owned = ${JSON.stringify(captureDecorations)};
    state.decorations.active = ${JSON.stringify(captureDecorations.slice(0, 3))};
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
  await waitForExpression(cdp, getAssetStatusReadyExpression(), 6000);
  await applyCaptureSceneOverrides(cdp);
  if (options.immersion) {
    await forceCaptureImmersion(cdp, options.immersion);
  } else if (shouldSuppressCaptureImmersion(options)) {
    await suppressCaptureImmersion(cdp);
  }
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
    const motionDiagnostics = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const diagnostics = window.__pieczargotchiRuntime && window.__pieczargotchiRuntime.motionDiagnostics;
        if (!diagnostics) {
          return null;
        }
        const summarize = (samples) => {
          if (!Array.isArray(samples) || samples.length === 0) {
            return null;
          }
          const numbers = (field) => samples
            .map((sample) => Number(sample[field]))
            .filter((value) => Number.isFinite(value));
          const range = (field) => {
            const values = numbers(field);
            if (!values.length) {
              return 0;
            }
            return Math.round((Math.max(...values) - Math.min(...values)) * 1000) / 1000;
          };
          return {
            count: samples.length,
            xRange: range('x'),
            yRange: range('y'),
            alphaRange: range('alpha'),
            glowRange: range('glow'),
            glowRadiusRange: range('glowRadius'),
            maxGlowRadius: Math.max(0, ...numbers('glowRadius')),
            maxExcursion: Math.max(0, ...numbers('excursion'))
          };
        };
        const sampleForLog = (sample) => ({
          seed: sample.seed,
          layer: sample.layer,
          x: sample.x,
          y: sample.y,
          alpha: sample.alpha,
          glow: sample.glow,
          glowRadius: sample.glowRadius,
          progress: sample.progress
        });
        return {
          butterflies: Array.isArray(diagnostics.butterflies) ? diagnostics.butterflies.length : 0,
          fireflies: Array.isArray(diagnostics.fireflies) ? diagnostics.fireflies.length : 0,
          butterflySummary: summarize(diagnostics.butterflies),
          fireflySummary: summarize(diagnostics.fireflies),
          fireflySamples: Array.isArray(diagnostics.fireflies)
            ? diagnostics.fireflies.slice(0, 8).map(sampleForLog)
            : [],
          sleepGlyphs: Array.isArray(diagnostics.sleepGlyphs) ? diagnostics.sleepGlyphs.length : 0,
          sleepBody: diagnostics.sleepBody || null,
          activityBody: diagnostics.activityBody || null,
          celestial: diagnostics.celestial || null
        };
      })()`,
      returnByValue: true
    });
    console.log(`${label} motion: ${JSON.stringify(motionDiagnostics.result.value)}`);
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
          dewPoint: scene.dewPoint,
          pressure: scene.pressure,
          pressureTrend: scene.pressureTrend,
          visibility: scene.visibility,
          fogPotential: scene.fogPotential,
          skyCoverClass: scene.skyCoverClass,
          rainClass: scene.rainClass,
          rainbowDropletScore: scene.rainbowDropletScore,
          rainbowRecentRainScore: scene.rainbowRecentRainScore,
          rainbowSunWindowScore: scene.rainbowSunWindowScore,
          rainbowPotential: scene.rainbowPotential,
          rainbowVariant: scene.rainbowVariant,
          snowStyle: scene.snowStyle,
          surfaceWetnessTarget: scene.surfaceWetnessTarget,
          snowCoverTarget: scene.snowCoverTarget,
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

async function forceCaptureImmersion(cdp, sample) {
  const sceneOverrides = getCaptureImmersionSceneOverrides(sample.id);
  const debugOverrides = getCaptureImmersionDebugOverrides(sample.id);
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const runtime = window.__pieczargotchiRuntime;
      if (!runtime) {
        return;
      }
      const now = Number(runtime.debug && runtime.debug.fixedAt) || Date.now();
      const sceneOverrides = ${JSON.stringify(sceneOverrides)};
      const debugOverrides = ${JSON.stringify(debugOverrides)};
      runtime.debug = Object.assign(runtime.debug || {}, { enabled: true, panelOpen: false }, debugOverrides, {
        forcedAnimation: 'state.' + ${JSON.stringify(sample.state)},
        forcedAnimationStartedAt: now
      });
      if (runtime.weatherScene && sceneOverrides) {
        Object.assign(runtime.weatherScene, sceneOverrides);
      }
      runtime.input = Object.assign(runtime.input || {}, {
        inside: true,
        x: 258,
        y: 266,
        lastMoveAt: now,
        lastDownAt: ${sample.id === 'pointerHover' ? '0' : 'now - 5000'},
        consumedDownAt: now,
        speed: 0.1
      });
      runtime.immersion = runtime.immersion || {};
      runtime.immersion.active = {
        id: ${JSON.stringify(sample.id)},
        state: ${JSON.stringify(sample.state)},
        source: 'capture',
        sourceAt: now,
        startedAt: now,
        until: now + 5000,
        durationMs: 5000,
        cooldownMs: 10000,
        priority: 99
      };
      runtime.immersion.cooldownUntil = now + 10000;
    })()`,
    awaitPromise: true
  });
}

function shouldSuppressCaptureImmersion(options) {
  return typeof options.expectedAnimationKey === 'string'
    && options.expectedAnimationKey.endsWith('.idle');
}

async function suppressCaptureImmersion(cdp) {
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const runtime = window.__pieczargotchiRuntime;
      if (!runtime) {
        return;
      }
      const now = Number(runtime.debug && runtime.debug.fixedAt) || Date.now();
      runtime.immersion = runtime.immersion || {};
      runtime.immersion.active = null;
      runtime.immersion.cooldownUntil = now + 30000;
    })()`,
    awaitPromise: true
  });
}

function getCaptureImmersionDebugOverrides(id) {
  if (id === 'rain') {
    return { fixedAt: Date.parse('2026-05-14T12:00:00.000Z'), weather: 'rain', cloudCoverOverride: 86, precipitationOverride: 2.8 };
  }
  if (id === 'snow') {
    return { fixedAt: Date.parse('2026-01-14T12:00:00.000Z'), weather: 'snow', cloudCoverOverride: 82, precipitationOverride: 1.6 };
  }
  if (id === 'stargaze') {
    return { fixedAt: Date.parse('2026-01-14T23:00:00.000Z'), weather: 'clear', cloudCoverOverride: 8, precipitationOverride: 0, skyEffectOverride: 'shootingStar' };
  }
  if (id === 'ambientFirefly') {
    return { fixedAt: Date.parse('2026-07-14T22:30:00.000Z'), weather: 'clear', cloudCoverOverride: 10, precipitationOverride: 0, windOverride: 0.8 };
  }
  if (id === 'ambientCrawler') {
    return { fixedAt: Date.parse('2026-06-14T17:00:00.000Z'), weather: 'clear', cloudCoverOverride: 22, precipitationOverride: 0, windOverride: 1.6 };
  }
  if (id === 'idleFidget'
    || id === 'idleFidgetSway'
    || id === 'idleLookLeft'
    || id === 'idleLookRight'
    || id === 'ponder'
    || id === 'ponderUp'
    || id === 'ponderSide'
    || id.startsWith('cursor')
    || id === 'ambientButterfly') {
    return { fixedAt: Date.parse('2026-06-14T14:00:00.000Z'), weather: 'clear', cloudCoverOverride: 16, precipitationOverride: 0, windOverride: 1.2 };
  }
  return { fixedAt: Date.parse('2026-05-14T12:00:00.000Z'), weather: 'clear', cloudCoverOverride: 18, precipitationOverride: 0 };
}

function getCaptureImmersionSceneOverrides(id) {
  if (id === 'rain') {
    return { condition: 'rain', isDay: true, dayPhase: 'noon', cloudCover: 86, precipitation: 2.8, rain: 2.8, showers: 0.6 };
  }
  if (id === 'snow') {
    return { condition: 'snow', isDay: true, dayPhase: 'noon', cloudCover: 82, precipitation: 1.6, snowfall: 1.6, snowIntensity: 0.6, snowCoverTarget: 0.55 };
  }
  if (id === 'stargaze') {
    return { condition: 'clear', isDay: false, dayPhase: 'night', cloudCover: 8, precipitation: 0, rain: 0, snowfall: 0, starVisibility: 1 };
  }
  if (id === 'sun') {
    return { condition: 'clear', isDay: true, dayPhase: 'noon', cloudCover: 12, precipitation: 0, rain: 0, snowfall: 0 };
  }
  if (id === 'ambientFirefly') {
    return { condition: 'clear', isDay: false, dayPhase: 'night', cloudCover: 10, precipitation: 0, rain: 0, snowfall: 0, windSpeed: 0.8, gustLevel: 0.1, fireflyIntensity: 1, starVisibility: 0.9 };
  }
  if (id === 'ambientCrawler') {
    return { condition: 'clear', isDay: true, dayPhase: 'afternoon', cloudCover: 22, precipitation: 0, rain: 0, snowfall: 0, windSpeed: 1.6, gustLevel: 0.2, crawlerIntensity: 1 };
  }
  if (id === 'idleFidget'
    || id === 'idleFidgetSway'
    || id === 'idleLookLeft'
    || id === 'idleLookRight'
    || id === 'ponder'
    || id === 'ponderUp'
    || id === 'ponderSide'
    || id.startsWith('cursor')
    || id === 'ambientButterfly') {
    return { condition: 'clear', isDay: true, dayPhase: 'afternoon', cloudCover: 16, precipitation: 0, rain: 0, snowfall: 0, windSpeed: 1.2, gustLevel: 0.1, butterflyIntensity: 1 };
  }
  return { condition: 'clear', isDay: true, dayPhase: 'noon', cloudCover: 18, precipitation: 0, rain: 0, snowfall: 0 };
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
      const setSceneNumber = (field, value) => {
        if (value === null) {
          return;
        }
        runtime.weatherScene[field] = value;
        const baseField = 'base' + field.charAt(0).toUpperCase() + field.slice(1);
        runtime.weatherScene[baseField] = value;
      };
      if (overrides.temperature !== null) {
        setSceneNumber('temperature', overrides.temperature);
        setSceneNumber('apparentTemperature', overrides.temperature);
      }
      if (overrides.humidity !== null) {
        setSceneNumber('humidity', overrides.humidity);
      }
      const optionalFields = [
        ['dewPoint', 'dewPoint'],
        ['pressure', 'pressure'],
        ['visibility', 'visibility'],
        ['vaporPressureDeficit', 'vaporPressureDeficit'],
        ['evapotranspiration', 'evapotranspiration'],
        ['snowDepth', 'snowDepth']
      ];
      optionalFields.forEach(([field, overrideKey]) => {
        setSceneNumber(field, overrides[overrideKey]);
      });
      const core = window.PieczargotchiCore;
      if (core && typeof core.deriveWeatherImmersionFields === 'function') {
        Object.assign(
          runtime.weatherScene,
          core.deriveWeatherImmersionFields(
            runtime.weatherScene,
            runtime.weatherScene.weatherHours,
            null,
            runtime.debug && runtime.debug.fixedAt || runtime.weatherScene.updatedAt || Date.now()
          )
        );
      }
      if (overrides.surfaceWetnessTarget !== null) {
        runtime.weatherScene.surfaceWetnessTarget = overrides.surfaceWetnessTarget;
      }
      if (overrides.snowCoverTarget !== null) {
        runtime.weatherScene.snowCoverTarget = overrides.snowCoverTarget;
      }
      runtime.weatherSurface = null;
    })()`,
    awaitPromise: true
  });
}

async function captureViewport(cdp) {
  await waitForExpression(cdp, getAssetStatusReadyExpression(), 6000);
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

  if (viewportWidth > 640 && viewportHeight <= 700) {
    assertShortViewportLayout(info);
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

function assertShortViewportLayout(info) {
  if (!info.stage || !info.side || !info.canvas || !info.actions) {
    throw new Error('Brakuje kluczowych elementów krótkiego layoutu.');
  }

  if (info.stage.bottom > info.innerHeight + 1) {
    throw new Error(`Scena wychodzi poza niski viewport: bottom=${Math.round(info.stage.bottom)}px, height=${info.innerHeight}`);
  }

  if (info.side.bottom > info.innerHeight + 1) {
    throw new Error(`Panel boczny wychodzi poza niski viewport: bottom=${Math.round(info.side.bottom)}px, height=${info.innerHeight}`);
  }

  if (info.canvas.width > 392 || info.canvas.height > 392) {
    throw new Error(`Canvas jest za duży dla krótkiego viewportu: ${Math.round(info.canvas.width)}x${Math.round(info.canvas.height)}px`);
  }

  if (info.actionColumns !== 2) {
    throw new Error(`Akcje w krótkim layoucie powinny mieć 2 kolumny, wykryto ${info.actionColumns}.`);
  }

  if (info.actions.top - info.side.top > 28) {
    throw new Error(`Akcje są za nisko w panelu bocznym: gap=${Math.round(info.actions.top - info.side.top)}px`);
  }
}

async function getCurrentAnimationKey(cdp) {
  const result = await cdp.send('Runtime.evaluate', {
    expression: `window.__pieczargotchiRuntime && window.__pieczargotchiRuntime.currentAnimationKey`,
    returnByValue: true
  });
  return result.result ? result.result.value : null;
}

function getAssetStatusReadyExpression() {
  if (captureAppsScriptNoAssets) {
    return `(() => {
      const node = document.querySelector('[data-asset-status]');
      const text = node && node.textContent || '';
      return text.includes('Grafiki załadowane')
        || text.includes('Część grafik')
        || text.includes('Aktywne grafiki zapasowe');
    })()`;
  }

  return `document.querySelector('[data-asset-status]') && document.querySelector('[data-asset-status]').textContent.includes('Grafiki załadowane')`;
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
    if (message.method === 'Runtime.exceptionThrown') {
      const details = message.params && message.params.exceptionDetails;
      const text = details && (details.exception && details.exception.description || details.text);
      const url = details && details.url ? ` ${details.url}:${details.lineNumber || 0}` : '';
      console.error(`page exception:${url} ${text || JSON.stringify(details || {})}`);
    }
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
  const diagnostic = await getRuntimeWaitDiagnostic(cdp);
  if (diagnostic) {
    console.error(`capture diagnostic: ${JSON.stringify(diagnostic)}`);
  }
  throw new Error(`Warunek nie spełnił się: ${expression}`);
}

async function getRuntimeWaitDiagnostic(cdp) {
  try {
    const result = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const runtime = window.__pieczargotchiRuntime;
        return {
          hasConfig: Boolean(window.PIECZARGOTCHI_CONFIG),
          hasRuntime: Boolean(runtime),
          booted: Boolean(runtime && runtime.booted),
          renderStarted: Boolean(runtime && runtime.renderStarted),
          currentAnimationKey: runtime && runtime.currentAnimationKey || null,
          forcedAnimation: runtime && runtime.debug && runtime.debug.forcedAnimation || null,
          activeImmersion: runtime && runtime.immersion && runtime.immersion.active
            ? runtime.immersion.active.state
            : null,
          assetStatus: document.querySelector('[data-asset-status]') && document.querySelector('[data-asset-status]').textContent,
          bodyText: document.body && document.body.textContent ? document.body.textContent.slice(0, 180) : ''
        };
      })()`,
      returnByValue: true
    });
    return result.result && result.result.value ? result.result.value : null;
  } catch {
    return null;
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
