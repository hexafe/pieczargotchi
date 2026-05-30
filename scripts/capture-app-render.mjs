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
const captureDelayOverride = Number(process.env.PIECZARGOTCHI_CAPTURE_DELAY_MS);
const captureDelayMs = Number.isFinite(captureDelayOverride) ? Math.max(0, captureDelayOverride) : 350;
const captureAppsScriptNoAssets = process.env.PIECZARGOTCHI_CAPTURE_APPS_SCRIPT_NO_ASSETS === '1';
const captureBeforeAssets = process.env.PIECZARGOTCHI_CAPTURE_BEFORE_ASSETS === '1';
const captureAllMinigames = process.env.PIECZARGOTCHI_CAPTURE_ALL_MINIGAMES === '1';
const captureJournal = process.env.PIECZARGOTCHI_CAPTURE_JOURNAL === '1';
const captureJournalDiscoveryId = String(process.env.PIECZARGOTCHI_CAPTURE_JOURNAL_DISCOVERY || 'aurora').trim() || 'aurora';
const debugCalendarEvent = String(process.env.PIECZARGOTCHI_DEBUG_CALENDAR_EVENT || '').trim();
const captureCalendarMatrix = process.env.PIECZARGOTCHI_CAPTURE_CALENDAR_MATRIX === '1';
const captureCalendarChecklist = process.env.PIECZARGOTCHI_CAPTURE_CALENDAR_CHECKLIST === '1';
const blockedAssetPatterns = readListEnv('PIECZARGOTCHI_CAPTURE_BLOCK_ASSETS');
const captureGrassPointer = process.env.PIECZARGOTCHI_CAPTURE_GRASS_POINTER === '1';
const captureCleanlinessOverride = readOptionalEnvNumber('PIECZARGOTCHI_CAPTURE_CLEANLINESS');
const captureCleanliness = captureCleanlinessOverride === null
  ? 80
  : Math.max(0, Math.min(100, captureCleanlinessOverride));
const port = 9237 + Math.floor(Math.random() * 400);
const userDataDir = path.join(tmpdir(), `pieczargotchi-cdp-${Date.now()}`);
const captureDebugSettings = createCaptureDebugSettings();
const captureSceneOverrides = createCaptureSceneOverrides();
const captureDecorations = readListEnv('PIECZARGOTCHI_CAPTURE_DECORATIONS');
const calendarCaptureSamples = [
  'teaDay',
  'worldBeeDay',
  'biodiversityDay',
  'soilDay',
  'spaceWeek'
];
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
  const calendarTimestamp = debugCalendarEvent ? getCalendarEventCaptureTimestamp(debugCalendarEvent) : null;
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
    || rainbow !== 'auto'
    || calendarTimestamp !== null;

  if (!hasDebugWeather) {
    return null;
  }

  return {
    enabled: true,
    fixedAt: fixedAt === null
      ? (calendarTimestamp !== null ? calendarTimestamp : deterministicBaseline ? Date.parse('2026-05-14T12:00:00.000Z') : Date.now())
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
    neutralEasterEggOverride: calendarTimestamp !== null && easterEgg === 'auto' ? 'off' : easterEgg,
    calendarEventOverride: debugCalendarEvent || 'auto',
    panelOpen: false
  };
}

function getCalendarEventCaptureTimestamp(eventId) {
  const dates = {
    worldWildlifeDay: '2026-03-03T10:00:00.000Z',
    forestDay: '2026-03-21T10:00:00.000Z',
    waterDay: '2026-03-22T10:00:00.000Z',
    earthDay: '2026-04-22T10:00:00.000Z',
    migratoryBirdDaySpring: '2026-05-09T10:00:00.000Z',
    worldBeeDay: '2026-05-20T10:00:00.000Z',
    teaDay: '2026-05-21T10:00:00.000Z',
    biodiversityDay: '2026-05-22T10:00:00.000Z',
    asteroidDay: '2026-06-30T20:00:00.000Z',
    moonDay: '2026-07-20T20:00:00.000Z',
    perseidNights: '2026-08-12T21:00:00.000Z',
    migratoryBirdDayAutumn: '2026-10-10T10:00:00.000Z',
    spaceWeek: '2026-10-06T20:00:00.000Z',
    mushroomDay: '2026-10-15T10:00:00.000Z',
    soilDay: '2026-12-05T10:00:00.000Z'
  };
  const value = dates[eventId];
  if (!value) {
    return null;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function getCaptureDebugSettingsForCalendarEvent(eventId) {
  const timestamp = getCalendarEventCaptureTimestamp(eventId);
  if (timestamp === null) {
    return null;
  }
  return Object.assign({}, captureDebugSettings || createCaptureDebugSettings() || {}, {
    enabled: true,
    fixedAt: timestamp,
    weather: eventId === 'soilDay' ? 'cloudy' : 'clear',
    cloudCoverOverride: eventId === 'soilDay' ? 44 : eventId === 'spaceWeek' ? 10 : 18,
    precipitationOverride: 0,
    windSpeedOverride: eventId === 'worldBeeDay' ? 1.4 : 1.0,
    neutralEasterEggOverride: 'off',
    calendarEventOverride: eventId
  });
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
  const cloudCoverLow = readOptionalEnvNumber('PIECZARGOTCHI_DEBUG_CLOUD_LOW');
  const cloudCoverMid = readOptionalEnvNumber('PIECZARGOTCHI_DEBUG_CLOUD_MID');
  const cloudCoverHigh = readOptionalEnvNumber('PIECZARGOTCHI_DEBUG_CLOUD_HIGH');
  const flowerDensity = readOptionalEnvNumber('PIECZARGOTCHI_DEBUG_FLOWER_DENSITY');
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
    && cloudCoverLow === null
    && cloudCoverMid === null
    && cloudCoverHigh === null
    && flowerDensity === null
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
    cloudCoverLow,
    cloudCoverMid,
    cloudCoverHigh,
    flowerDensity,
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
  if (blockedAssetPatterns.length) {
    await cdp.send('Network.enable');
    await cdp.send('Network.setBlockedURLs', {
      urls: blockedAssetPatterns.map((pattern) => `*${pattern}*`)
    });
  }
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
    await setCaptureGrowth(cdp, 70);
    await captureViewport(cdp);
  }
  if (captureJournal) {
    await captureWorldJournal(cdp);
  }
  if (captureCalendarMatrix) {
    for (const eventId of calendarCaptureSamples) {
      await captureCalendarEvent(cdp, eventId);
    }
  } else if (debugCalendarEvent) {
    await captureCalendarEvent(cdp, debugCalendarEvent);
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

  if (process.env.PIECZARGOTCHI_CAPTURE_DEW_MINIGAME === '1' || captureAllMinigames) {
    await captureDewMinigame(cdp);
  }

  if (captureAllMinigames) {
    await captureConfiguredMinigame(cdp, {
      id: 'sporePop',
      label: 'Pękanie zarodników',
      fileLabel: 'spore-pop',
      canvasSelector: '[data-spore-pop-canvas]',
      seed: 474747,
      habitatTags: { spores: 1 },
      detailKey: 'spores',
      detailMin: 10,
      domainPixelName: 'sporePixels',
      domainPixelExpression: `(r > 110 && r < 255 && g > 80 && g < 225 && b < 150)`
    });
    await captureConfiguredMinigame(cdp, {
      id: 'compostSort',
      label: 'Sortowanie kompostu',
      fileLabel: 'compost-sort',
      canvasSelector: '[data-compost-sort-canvas]',
      seed: 515151,
      habitatTags: { shelter: 1, insects: 1 },
      detailKey: 'pieces',
      detailMin: 12,
      domainPixelName: 'compostPixels',
      domainPixelExpression: `(r > 58 && r < 160 && g > 35 && g < 125 && b < 100)`
    });
    await captureConfiguredMinigame(cdp, {
      id: 'rhythmHum',
      label: 'Rytmiczne nucenie',
      fileLabel: 'rhythm-hum',
      canvasSelector: '[data-rhythm-hum-canvas]',
      seed: 616161,
      habitatTags: { music: 1 },
      detailKey: 'pattern',
      detailMin: 5,
      domainPixelName: 'padPixels',
      domainPixelExpression: `(r > 95 && g > 55 && b < 230 && (r - b > 12 || b - g > 24))`
    });
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
      ? `{ type: 'wake_surprise', label: 'Przebudzenie', startedAt: runtimeNow, until: runtimeNow + 1800 }`
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
  if (!isCaptureActivityAllowedForStage(stage, activity)) {
    console.log(`activity-${stage}-${activity}: skipped; activity is not available at ${stage} stage`);
    return;
  }

  await captureCanvas(cdp, `activity-${stage}-${activity}`, {
    mode: 'awake',
    growth,
    activity: `{ type: ${JSON.stringify(activity)}, label: ${JSON.stringify(activity)}, startedAt: runtimeNow - 850, until: runtimeNow + 2400 }`,
    expectedAnimationKey: `${stage}.activity.${activity}`
  });
}

function isCaptureActivityAllowedForStage(stage, activity) {
  if (activity !== 'spores') {
    return true;
  }

  return ['adult', 'legendary'].includes(stage);
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
    state.mushroomName = 'Auditka';
    state.flags = Object.assign({}, state.flags || {}, { nameConfirmed: true });
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

async function captureWorldJournal(cdp) {
  const now = captureDebugSettings && Number.isFinite(Number(captureDebugSettings.fixedAt))
    ? Number(captureDebugSettings.fixedAt)
    : Date.parse('2026-05-21T21:20:00.000Z');
  const stateExpression = `(() => {
    const config = window.PIECZARGOTCHI_CONFIG;
    const state = JSON.parse(JSON.stringify(config.state.defaultState));
    const iso = new Date(${now}).toISOString();
    state.version = config.stateVersion;
    state.playerId = 'journal-audit';
    state.mushroomName = 'Auditka';
    state.flags = Object.assign({}, state.flags || {}, { nameConfirmed: true });
    state.createdAt = iso;
    state.lastUpdatedAt = iso;
    state.mode = 'awake';
    state.stage = 'adult';
    state.stats.growth = 70;
    state.stats.hydration = 82;
    state.stats.nutrients = 82;
    state.stats.energy = 88;
    state.stats.happiness = 92;
    state.stats.cleanliness = 88;
    state.stats.health = 100;
    state.patch.quality = 86;
    state.discoveries = {
      sky: {
        aurora: {
          id: 'aurora',
          label: 'Zorza polarna',
          firstSeenAt: '2026-01-12T22:30:00.000Z',
          lastSeenAt: iso,
          count: 3
        }
      },
      environment: {
        dew: {
          id: 'dew',
          label: 'Rosa na trawie',
          firstSeenAt: '2026-05-21T04:30:00.000Z',
          lastSeenAt: iso,
          count: 2
        }
      },
      instruments: {
        rareInstrument_adult: {
          id: 'rareInstrument_adult',
          label: 'Kometowa harfa',
          stage: 'adult',
          firstSeenAt: '2026-05-20T20:30:00.000Z',
          lastSeenAt: iso,
          count: 1
        }
      },
      calendar: {
        teaDay: {
          id: 'teaDay',
          label: 'Międzynarodowy Dzień Herbaty',
          firstSeenAt: '2026-05-21T08:00:00.000Z',
          lastSeenAt: iso,
          lastSeenDateKey: '2026-05-21',
          count: 1
        },
        worldBeeDay: {
          id: 'worldBeeDay',
          label: 'Światowy Dzień Pszczół',
          firstSeenAt: '2026-05-20T08:00:00.000Z',
          lastSeenAt: iso,
          lastSeenDateKey: '2026-05-20',
          count: 1
        },
        biodiversityDay: {
          id: 'biodiversityDay',
          label: 'Międzynarodowy Dzień Bioróżnorodności',
          firstSeenAt: '2026-05-22T08:00:00.000Z',
          lastSeenAt: iso,
          lastSeenDateKey: '2026-05-22',
          count: 1
        },
        soilDay: {
          id: 'soilDay',
          label: 'Światowy Dzień Gleby',
          firstSeenAt: '2026-12-05T08:00:00.000Z',
          lastSeenAt: iso,
          lastSeenDateKey: '2026-12-05',
          count: 1
        },
        spaceWeek: {
          id: 'spaceWeek',
          label: 'Światowy Tydzień Kosmosu',
          firstSeenAt: '2026-10-04T20:00:00.000Z',
          lastSeenAt: iso,
          lastSeenDateKey: '2026-10-04',
          count: 1
        }
      }
    };
    state.journal = { entries: [] };
    localStorage.setItem(config.storageKey, JSON.stringify(state));
  })()`;

  await cdp.send('Runtime.evaluate', { expression: stateExpression, awaitPromise: true });
  await waitForLoad(cdp, () => cdp.send('Page.reload', { ignoreCache: true }));
  await waitForExpression(cdp, getAssetStatusReadyExpression(), 6000);
  await waitForExpression(cdp, `Boolean(document.querySelector('[data-discovery-id="${captureJournalDiscoveryId}"][data-discovered="true"]'))`, 3000);
  const diagnostics = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const button = document.querySelector('[data-discovery-id="${captureJournalDiscoveryId}"][data-discovered="true"]');
      const panel = document.querySelector('.panel-block--discoveries');
      if (!button || !panel) {
        return { ok: false };
      }
      const rectInfo = (node) => {
        const rect = node.getBoundingClientRect();
        return {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height
        };
      };
      panel.scrollIntoView({ block: 'center', inline: 'nearest' });
      const rect = button.getBoundingClientRect();
      const x = Math.round(rect.left + Math.min(36, rect.width / 2));
      const y = Math.round(rect.top + Math.min(18, rect.height / 2));
      button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: x, clientY: y }));
      const tooltipVisible = !document.querySelector('[data-journal-tooltip]').hidden;
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
      const polaroid = document.querySelector('[data-journal-polaroid]');
      const canvas = document.querySelector('[data-journal-polaroid-canvas]');
      const ctx = canvas.getContext('2d');
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let nonBlank = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index + 3] > 0 && (pixels[index] !== 0 || pixels[index + 1] !== 0 || pixels[index + 2] !== 0)) {
          nonBlank += 1;
        }
      }
      const polaroidRect = rectInfo(polaroid);
      const canvasRect = rectInfo(canvas);
      const viewport = { width: innerWidth, height: innerHeight };
      return {
        ok: true,
        tooltipVisible,
        polaroidVisible: !polaroid.hidden,
        title: document.querySelector('[data-journal-polaroid-title]').textContent,
        nonBlank,
        polaroidRect,
        canvasRect,
        viewport,
        polaroidInViewport: polaroidRect.left >= -1
          && polaroidRect.top >= -1
          && polaroidRect.right <= innerWidth + 1
          && polaroidRect.bottom <= innerHeight + 1,
        canvasVisible: canvasRect.width >= 120 && canvasRect.height >= 90
      };
    })()`,
    returnByValue: true
  });
  const info = diagnostics.result.value || {};
  if (
    !info.ok
    || !info.tooltipVisible
    || !info.polaroidVisible
    || !info.title
    || info.nonBlank < 1000
    || !info.polaroidInViewport
    || !info.canvasVisible
  ) {
    throw new Error(`Dziennik świata nie otworzył pamiątki poprawnie: ${JSON.stringify(info)}`);
  }

  const screenshot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true
  });
  const filePath = `${outputPrefix}-journal-polaroid-${viewportWidth}x${viewportHeight}.png`;
  writeFileSync(filePath, Buffer.from(screenshot.data, 'base64'));
  console.log(`journal-polaroid: ${filePath}`);
  console.log(`journal diagnostics: title=${info.title}, canvasPixels=${info.nonBlank}, tooltip=${info.tooltipVisible}, polaroid=${Math.round(info.polaroidRect.width)}x${Math.round(info.polaroidRect.height)}`);
}

async function captureDewMinigame(cdp) {
  const now = captureDebugSettings && Number.isFinite(Number(captureDebugSettings.fixedAt))
    ? Number(captureDebugSettings.fixedAt)
    : Date.now();
  const startedAt = now - 4200;
  const stateExpression = `(() => {
    const config = window.PIECZARGOTCHI_CONFIG;
    const state = JSON.parse(JSON.stringify(config.state.defaultState));
    const iso = new Date(${now}).toISOString();
    state.version = config.stateVersion;
    state.playerId = 'dew-audit';
    state.mushroomName = 'Auditka';
    state.flags = Object.assign({}, state.flags || {}, { nameConfirmed: true });
    state.createdAt = iso;
    state.lastUpdatedAt = iso;
    state.mode = 'awake';
    state.stats.growth = 70;
    state.stats.hydration = 70;
    state.stats.nutrients = 70;
    state.stats.energy = 80;
    state.stats.happiness = 70;
    state.stats.cleanliness = 80;
    state.stats.health = 100;
    state.minigames.active = {
      id: 'dewCatch',
      label: 'Łapanie rosy',
      seed: 424242,
      startedAt: ${startedAt},
      until: ${now + 16000},
      score: 0,
      caught: [],
      missed: []
    };
    localStorage.setItem(config.storageKey, JSON.stringify(state));
  })()`;

  await cdp.send('Runtime.evaluate', { expression: stateExpression, awaitPromise: true });
  await waitForLoad(cdp, () => cdp.send('Page.reload', { ignoreCache: true }));
  await waitForExpression(cdp, `Boolean(window.__pieczargotchiRuntime && window.__pieczargotchiRuntime.booted && window.__pieczargotchiRuntime.minigame && window.__pieczargotchiRuntime.minigame.session && window.__pieczargotchiRuntime.minigame.session.id === 'dewCatch')`, 6000);
  await delay(Math.max(captureDelayMs, 650));
  const diagnostics = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const canvas = document.querySelector('[data-dew-catch-canvas]');
      const runtime = window.__pieczargotchiRuntime || {};
      const bucket = runtime.minigame && runtime.minigame.bucket;
      const imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let nonBlank = 0;
      let bluePixels = 0;
      let bucketPixels = 0;
      for (let index = 0; index < imageData.length; index += 4) {
        const r = imageData[index];
        const g = imageData[index + 1];
        const b = imageData[index + 2];
        const a = imageData[index + 3];
        if (a) {
          nonBlank += 1;
        }
        if (b > 120 && g > 90 && r < 120) {
          bluePixels += 1;
        }
        if (r > 120 && r > g && g > 60 && b < 120) {
          bucketPixels += 1;
        }
      }
      return {
        nonBlank,
        bluePixels,
        bucketPixels,
        bucketX: bucket && bucket.x,
        dropCount: runtime.minigame && runtime.minigame.drops && runtime.minigame.drops.length,
        drawnDrops: runtime.minigame && runtime.minigame.drawnDrops,
        progress: runtime.minigame && runtime.minigame.lastProgress,
        visibleDrops: runtime.minigame && runtime.minigame.drops && runtime.minigame.drops.filter((drop) => {
          const progress = Number(runtime.minigame.lastProgress) || 0;
          const local = (progress - Number(drop.start)) / Math.max(0.01, Number(drop.speed) || 1);
          const y = -18 + local * (canvas.height + 34);
          return y >= -16 && y <= canvas.height + 14;
        }).length,
        caught: runtime.minigame && runtime.minigame.session && runtime.minigame.session.caught && runtime.minigame.session.caught.length,
        missed: runtime.minigame && runtime.minigame.session && runtime.minigame.session.missed && runtime.minigame.session.missed.length,
        now: runtime.minigame && runtime.minigame.lastProgress,
        startedAt: runtime.minigame && runtime.minigame.session && runtime.minigame.session.startedAt,
        until: runtime.minigame && runtime.minigame.session && runtime.minigame.session.until
      };
    })()`,
    returnByValue: true
  });
  const info = diagnostics.result.value || {};
  if (info.nonBlank < 8000 || info.bluePixels < 6 || info.bucketPixels < 80 || !info.dropCount) {
    throw new Error(`Dew minigame render looks incomplete: ${JSON.stringify(info)}`);
  }

  const result = await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('[data-dew-catch-canvas]').toDataURL('image/png')`,
    returnByValue: true
  });
  const png = Buffer.from(result.result.value.replace(/^data:image\/png;base64,/, ''), 'base64');
  const filePath = `${outputPrefix}-dew-catch.png`;
  writeFileSync(filePath, png);
  console.log(`dew-catch: ${filePath}`);
  console.log(`dew-catch diagnostics: ${JSON.stringify(info)}`);
}

async function captureConfiguredMinigame(cdp, sample) {
  const now = captureDebugSettings && Number.isFinite(Number(captureDebugSettings.fixedAt))
    ? Number(captureDebugSettings.fixedAt)
    : Date.now();
  const startedAt = now - 3600;
  const stateExpression = `(() => {
    const config = window.PIECZARGOTCHI_CONFIG;
    const state = JSON.parse(JSON.stringify(config.state.defaultState));
    const iso = new Date(${now}).toISOString();
    state.version = config.stateVersion;
    state.playerId = ${JSON.stringify(sample.fileLabel + '-audit')};
    state.mushroomName = 'Auditka';
    state.flags = Object.assign({}, state.flags || {}, { nameConfirmed: true });
    state.createdAt = iso;
    state.lastUpdatedAt = iso;
    state.mode = 'awake';
    state.stats.growth = 70;
    state.stats.hydration = 70;
    state.stats.nutrients = 70;
    state.stats.energy = 80;
    state.stats.happiness = 70;
    state.stats.cleanliness = 80;
    state.stats.health = 100;
    state.minigames.active = {
      id: ${JSON.stringify(sample.id)},
      label: ${JSON.stringify(sample.label)},
      seed: ${Number(sample.seed) || 1},
      startedAt: ${startedAt},
      until: ${now + 16000},
      score: 0,
      caught: [],
      missed: [],
      mistakes: 0,
      nextBeat: 0,
      habitatTags: ${JSON.stringify(sample.habitatTags || {})}
    };
    localStorage.setItem(config.storageKey, JSON.stringify(state));
  })()`;

  await cdp.send('Runtime.evaluate', { expression: stateExpression, awaitPromise: true });
  await waitForLoad(cdp, () => cdp.send('Page.reload', { ignoreCache: true }));
  await waitForExpression(cdp, `Boolean(window.__pieczargotchiRuntime && window.__pieczargotchiRuntime.booted && window.__pieczargotchiRuntime.minigame && window.__pieczargotchiRuntime.minigame.session && window.__pieczargotchiRuntime.minigame.session.id === ${JSON.stringify(sample.id)})`, 6000);
  await delay(Math.max(captureDelayMs, 650));
  const diagnostics = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const canvas = document.querySelector(${JSON.stringify(sample.canvasSelector)});
      const runtime = window.__pieczargotchiRuntime || {};
      const minigame = runtime.minigame || {};
      const imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let nonBlank = 0;
      let domainPixels = 0;
      for (let index = 0; index < imageData.length; index += 4) {
        const r = imageData[index];
        const g = imageData[index + 1];
        const b = imageData[index + 2];
        const a = imageData[index + 3];
        if (a) {
          nonBlank += 1;
        }
        if (${sample.domainPixelExpression}) {
          domainPixels += 1;
        }
      }
      return {
        nonBlank,
        domainPixels,
        hidden: canvas.hidden || getComputedStyle(canvas).display === 'none',
        spores: Array.isArray(minigame.spores) ? minigame.spores.length : 0,
        pieces: Array.isArray(minigame.pieces) ? minigame.pieces.length : 0,
        pattern: Array.isArray(minigame.pattern) ? minigame.pattern.length : 0,
        score: minigame.session && minigame.session.score
      };
    })()`,
    returnByValue: true
  });
  const info = diagnostics.result.value || {};
  const detail = Number(info[sample.detailKey]) || 0;
  if (info.hidden || info.nonBlank < 8000 || info.domainPixels < 70 || detail < Number(sample.detailMin || 1)) {
    throw new Error(`${sample.label} render looks incomplete: ${JSON.stringify(info)}`);
  }

  const result = await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector(${JSON.stringify(sample.canvasSelector)}).toDataURL('image/png')`,
    returnByValue: true
  });
  const png = Buffer.from(result.result.value.replace(/^data:image\/png;base64,/, ''), 'base64');
  const filePath = `${outputPrefix}-${sample.fileLabel}.png`;
  writeFileSync(filePath, png);
  const outputInfo = Object.assign({}, info);
  outputInfo[sample.domainPixelName] = outputInfo.domainPixels;
  delete outputInfo.domainPixels;
  console.log(`${sample.fileLabel}: ${filePath}`);
  console.log(`${sample.fileLabel} diagnostics: ${JSON.stringify(outputInfo)}`);
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
      state.mushroomName = 'Auditka';
      state.flags = Object.assign({}, state.flags || {}, { nameConfirmed: true });
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
      if (${JSON.stringify(captureCalendarChecklist || Boolean(debugCalendarEvent))}) {
        state.decorations.owned = ['myceliumCalendar', 'cloverPatch', 'sporeLantern'];
        state.decorations.active = ['cloverPatch', 'sporeLantern'];
        state.inventory.spores = 24;
        state.coins = 24;
        state.discoveries = state.discoveries || {};
        state.discoveries.calendar = Object.assign({}, state.discoveries.calendar || {}, {
          teaDay: { id: 'teaDay', label: 'Międzynarodowy Dzień Herbaty', firstSeenAt: iso, lastSeenAt: iso, lastSeenDateKey: iso.slice(0, 10), count: 1 },
          worldBeeDay: { id: 'worldBeeDay', label: 'Światowy Dzień Pszczół', firstSeenAt: iso, lastSeenAt: iso, lastSeenDateKey: iso.slice(0, 10), count: 1 },
          biodiversityDay: { id: 'biodiversityDay', label: 'Międzynarodowy Dzień Bioróżnorodności', firstSeenAt: iso, lastSeenAt: iso, lastSeenDateKey: iso.slice(0, 10), count: 1 }
        });
      }
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
  if (!captureDebugSettings || captureDebugSettings.neutralEasterEggOverride === 'auto' || captureDebugSettings.neutralEasterEggOverride === 'off') {
    if (isCaptureRainy()) {
      return `${stage}.rain`;
    }
    if (isCaptureSnowy()) {
      return `${stage}.snow`;
    }
    if (captureCleanliness <= 35) {
      return `${stage}.dirty`;
    }
    return `${stage}.idle`;
  }

  if (captureDebugSettings.neutralEasterEggOverride === 'iwonia' && isCaptureRainy()) {
    return `${stage}.easter.neutral_rain`;
  }

  return `${stage}.easter.neutral`;
}

async function captureCalendarEvent(cdp, eventId) {
  const debugSettings = getCaptureDebugSettingsForCalendarEvent(eventId);
  if (!debugSettings) {
    throw new Error(`Nieznany event kalendarza do capture: ${eventId}`);
  }

  await captureCanvas(cdp, `calendar-${eventId}`, {
    mode: 'awake',
    growth: eventId === 'teaDay' ? 12 : eventId === 'soilDay' ? 35 : 70,
    activity: 'null',
    expectedAnimationKey: eventId === 'teaDay' ? 'baby.idle' : eventId === 'soilDay' ? 'young.idle' : 'adult.idle',
    debugSettings,
    decorations: ['myceliumCalendar', 'cloverPatch', 'sporeLantern'],
    discoverCalendarEvent: eventId
  });
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
  const debugSettings = options.debugSettings || captureDebugSettings;
  const decorations = Array.isArray(options.decorations) ? options.decorations : captureDecorations;
  const stateExpression = `(() => {
    const config = window.PIECZARGOTCHI_CONFIG;
    const state = JSON.parse(JSON.stringify(config.state.defaultState));
    const debugSettings = ${JSON.stringify(debugSettings)};
    const runtimeNow = debugSettings && Number.isFinite(Number(debugSettings.fixedAt))
      ? Number(debugSettings.fixedAt)
      : ${now};
    const iso = new Date(runtimeNow).toISOString();
    state.version = config.stateVersion;
    state.playerId = 'audit';
    state.mushroomName = 'Auditka';
    state.flags = Object.assign({}, state.flags || {}, { nameConfirmed: true });
    state.createdAt = iso;
    state.lastUpdatedAt = iso;
    state.mode = ${JSON.stringify(options.mode)};
    state.stats.growth = ${JSON.stringify(options.growth)};
    state.stats.hydration = 70;
    state.stats.nutrients = 70;
    state.stats.energy = 80;
    state.stats.happiness = 60;
    state.stats.cleanliness = ${JSON.stringify(captureCleanliness)};
    state.stats.health = 100;
    state.patch.quality = 72;
    state.patch.mycelium = 0;
    state.decorations.owned = ${JSON.stringify(decorations)};
    state.decorations.active = ${JSON.stringify(decorations.filter((item) => item !== 'myceliumCalendar').slice(0, 3))};
    state.discoveries = state.discoveries || {};
    state.discoveries.calendar = state.discoveries.calendar || {};
    if (${JSON.stringify(options.discoverCalendarEvent || '')}) {
      const eventId = ${JSON.stringify(options.discoverCalendarEvent || '')};
      state.discoveries.calendar[eventId] = {
        id: eventId,
        label: eventId,
        firstSeenAt: iso,
        lastSeenAt: iso,
        lastSeenDateKey: iso.slice(0, 10),
        count: 1
      };
    }
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
  if (!captureBeforeAssets) {
    await waitForExpression(cdp, getAssetStatusReadyExpression(), 6000);
  }
  await applyCaptureSceneOverrides(cdp);
  if (captureGrassPointer) {
    await forceCaptureGrassPointer(cdp);
  }
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
          const minNumber = (field) => {
            const values = numbers(field);
            return values.length ? Math.min(...values) : 0;
          };
          const counts = (field) => samples.reduce((acc, sample) => {
            const value = sample[field];
            if (value !== undefined && value !== null && value !== '') {
              acc[value] = (acc[value] || 0) + 1;
            }
            return acc;
          }, {});
          return {
            count: samples.length,
            xRange: range('x'),
            yRange: range('y'),
            alphaRange: range('alpha'),
            glowRange: range('glow'),
            lightAlphaRange: range('lightAlpha'),
            glowRadiusRange: range('glowRadius'),
            lightRadiusRange: range('lightRadius'),
            pauseRange: range('pause'),
            maxGlowRadius: Math.max(0, ...numbers('glowRadius')),
            maxLightRadius: Math.max(0, ...numbers('lightRadius')),
            maxLightAlpha: Math.max(0, ...numbers('lightAlpha')),
            maxExcursion: Math.max(0, ...numbers('excursion')),
            maxTurnbacks: Math.max(0, ...numbers('turnbacks')),
            maxHeightWaves: Math.max(0, ...numbers('heightWaves')),
            maxTargetCount: Math.max(0, ...numbers('targetCount')),
            minVisualWidth: minNumber('visualWidth'),
            minVisualHeight: minNumber('visualHeight'),
            maxVisualWidth: Math.max(0, ...numbers('visualWidth')),
            maxVisualHeight: Math.max(0, ...numbers('visualHeight')),
            layers: counts('layer'),
            depths: counts('depth'),
            mushroomOverlaps: counts('mushroomOverlap'),
            routes: counts('route'),
            variants: counts('variant'),
            routeVariants: counts('routeVariant'),
            entrySides: counts('entrySide'),
            exitSides: counts('exitSide'),
            flowerVariants: counts('flowerVariant'),
            noLanding: counts('noLanding'),
            directions: counts('direction'),
            phases: counts('phase'),
            flowers: counts('flowerId'),
            landed: counts('landed')
          };
        };
        const sampleForLog = (sample) => ({
          seed: sample.seed,
          layer: sample.layer,
          depth: sample.depth,
          route: sample.route,
          variant: sample.variant,
          routeVariant: sample.routeVariant,
          entrySide: sample.entrySide,
          exitSide: sample.exitSide,
          phase: sample.phase,
          flowerId: sample.flowerId,
          flowerVariant: sample.flowerVariant,
          targetCount: sample.targetCount,
          noLanding: sample.noLanding,
          landed: sample.landed,
          landedDuration: sample.landedDuration,
          direction: sample.direction,
          routeDirection: sample.routeDirection,
          turnbacks: sample.turnbacks,
          heightWaves: sample.heightWaves,
          cycleIndex: sample.cycleIndex,
          visitSeed: sample.visitSeed,
          x: sample.x,
          y: sample.y,
          alpha: sample.alpha,
          glow: sample.glow,
          lightAlpha: sample.lightAlpha,
          glowRadius: sample.glowRadius,
          lightRadius: sample.lightRadius,
          visualWidth: sample.visualWidth,
          visualHeight: sample.visualHeight,
          excursion: sample.excursion,
          pause: sample.pause,
          mushroomOverlap: sample.mushroomOverlap,
          progress: sample.progress
        });
        const sampleGrassRegion = (x, y, width, height) => {
          const canvas = document.getElementById('mushroomCanvas');
          if (!canvas) {
            return null;
          }
          const image = canvas.getContext('2d').getImageData(x, y, width, height).data;
          let red = 0;
          let green = 0;
          let blue = 0;
          let count = 0;
          for (let index = 0; index < image.length; index += 4) {
            red += image[index];
            green += image[index + 1];
            blue += image[index + 2];
            count += 1;
          }
          if (!count) {
            return null;
          }
          const meanRed = red / count;
          const meanGreen = green / count;
          const meanBlue = blue / count;
          let textured = 0;
          let vegetation = 0;
          let deltaTotal = 0;
          let luminance = 0;
          for (let index = 0; index < image.length; index += 4) {
            const r = image[index];
            const g = image[index + 1];
            const b = image[index + 2];
            const delta = Math.abs(r - meanRed) + Math.abs(g - meanGreen) + Math.abs(b - meanBlue);
            const greenish = g >= r * 0.78 && g >= b * 0.72 && g - Math.min(r, b) >= -10;
            const snowish = r > 185 && g > 195 && b > 180 && Math.abs(r - b) < 48;
            if (delta >= 24 || greenish || snowish) {
              textured += 1;
            }
            if (greenish) {
              vegetation += 1;
            }
            deltaTotal += delta;
            luminance += r * 0.2126 + g * 0.7152 + b * 0.0722;
          }
          return {
            coverage: Math.round(textured / count * 1000) / 1000,
            vegetation: Math.round(vegetation / count * 1000) / 1000,
            avgDelta: Math.round(deltaTotal / count * 1000) / 1000,
            luminance: Math.round(luminance / count * 1000) / 1000
          };
        };
        const grassMetrics = {
          bottom: sampleGrassRegion(0, 500, 512, 12),
          left: sampleGrassRegion(0, 412, 16, 100),
          right: sampleGrassRegion(496, 412, 16, 100),
          center: sampleGrassRegion(196, 426, 120, 86)
        };
        return {
          flowers: Array.isArray(diagnostics.flowers) ? diagnostics.flowers.length : 0,
          bees: Array.isArray(diagnostics.bees) ? diagnostics.bees.length : 0,
          butterflies: Array.isArray(diagnostics.butterflies) ? diagnostics.butterflies.length : 0,
          bats: Array.isArray(diagnostics.bats) ? diagnostics.bats.length : 0,
          moths: Array.isArray(diagnostics.moths) ? diagnostics.moths.length : 0,
          fireflies: Array.isArray(diagnostics.fireflies) ? diagnostics.fireflies.length : 0,
          crawlers: Array.isArray(diagnostics.crawlers) ? diagnostics.crawlers.length : 0,
          flowerSummary: summarize(diagnostics.flowers),
          beeSummary: summarize(diagnostics.bees),
          butterflySummary: summarize(diagnostics.butterflies),
          batSummary: summarize(diagnostics.bats),
          mothSummary: summarize(diagnostics.moths),
          fireflySummary: summarize(diagnostics.fireflies),
          crawlerSummary: summarize(diagnostics.crawlers),
          flowerSamples: Array.isArray(diagnostics.flowers)
            ? diagnostics.flowers.slice(0, 8).map(sampleForLog)
            : [],
          beeSamples: Array.isArray(diagnostics.bees)
            ? diagnostics.bees.slice(0, 8).map(sampleForLog)
            : [],
          butterflySamples: Array.isArray(diagnostics.butterflies)
            ? diagnostics.butterflies.slice(0, 8).map(sampleForLog)
            : [],
          batSamples: Array.isArray(diagnostics.bats)
            ? diagnostics.bats.slice(0, 8).map(sampleForLog)
            : [],
          mothSamples: Array.isArray(diagnostics.moths)
            ? diagnostics.moths.slice(0, 8).map(sampleForLog)
            : [],
          fireflySamples: Array.isArray(diagnostics.fireflies)
            ? diagnostics.fireflies.slice(0, 8).map(sampleForLog)
            : [],
          crawlerSamples: Array.isArray(diagnostics.crawlers)
            ? diagnostics.crawlers.slice(0, 8).map(sampleForLog)
            : [],
          sleepGlyphs: Array.isArray(diagnostics.sleepGlyphs) ? diagnostics.sleepGlyphs.length : 0,
          sleepBody: diagnostics.sleepBody || null,
          activityBody: diagnostics.activityBody || null,
          idleBody: diagnostics.idleBody || null,
          conditionOverlay: diagnostics.conditionOverlay || null,
          sunbeams: diagnostics.sunbeams || null,
          clouds: diagnostics.clouds || null,
          ground: diagnostics.ground || null,
          grassMetrics: grassMetrics,
          celestial: diagnostics.celestial || null
        };
      })()`,
      returnByValue: true
    });
    const motionValue = motionDiagnostics.result.value;
    console.log(`${label} motion: ${JSON.stringify(motionValue)}`);
    if (label === 'sleeping' && (!motionValue || Number(motionValue.sleepGlyphs) < 3)) {
      throw new Error('Stan snu powinien renderować trzy czytelne glify Zzz.');
    }
    const foreground = motionValue && motionValue.ground && motionValue.ground.foreground;
    if (foreground && Number(foreground.coverCount) > 92) {
      throw new Error(`Trawa pierwszego planu ma zbyt gęstą warstwę środka: coverCount=${foreground.coverCount}.`);
    }
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

async function forceCaptureGrassPointer(cdp) {
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const runtime = window.__pieczargotchiRuntime;
      if (!runtime) {
        return;
      }
      const now = Number(runtime.debug && runtime.debug.fixedAt) || Date.now();
      runtime.input = Object.assign(runtime.input || {}, {
        inside: true,
        x: 262,
        y: 436,
        lastMoveAt: now,
        lastDownAt: 0,
        consumedDownAt: 0,
        speed: 0.2
      });
    })()`,
    awaitPromise: true
  });
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
        ['cloudCoverLow', 'cloudCoverLow'],
        ['cloudCoverMid', 'cloudCoverMid'],
        ['cloudCoverHigh', 'cloudCoverHigh'],
        ['flowerDensity', 'flowerDensity'],
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
  await waitForMobileActionDock(cdp);

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
      const elementInfo = (selector) => {
        const element = document.querySelector(selector);
        if (!element) {
          return null;
        }
        const rect = rectOf(selector);
        const style = getComputedStyle(element);
        return {
          ...rect,
          display: style.display,
          visibility: style.visibility,
          overflow: style.overflow,
          visible: style.display !== 'none' && style.visibility !== 'hidden' && rect && rect.width > 0 && rect.height > 0,
          clipped: rect && rect.height > 0 && (element.scrollHeight > element.clientHeight + 1 || element.scrollWidth > element.clientWidth + 1)
        };
      };
      const actionButtons = Array.from(document.querySelectorAll('.action-button')).map((button) => {
        const rect = button.getBoundingClientRect();
        const label = button.querySelector('.action-label');
        const style = getComputedStyle(button);
        return {
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          labelText: label ? label.textContent : '',
          visible: style.display !== 'none' && rect.width > 0 && rect.height > 0,
          hiddenByContext: button.classList.contains('is-mobile-context-hidden'),
          labelClipped: label ? label.scrollWidth > label.clientWidth + 1 || label.scrollHeight > label.clientHeight + 1 : false
        };
      });
      const actionsGrid = document.querySelector('.actions-grid');
      const actionsPanel = document.querySelector('.panel-block--actions');
      const actionsStyle = actionsPanel ? getComputedStyle(actionsPanel) : null;
      const getOverlapRatio = (base, overlay) => {
        if (!base || !overlay) {
          return 0;
        }
        const left = Math.max(base.left, overlay.left);
        const right = Math.min(base.right, overlay.right);
        const top = Math.max(base.top, overlay.top);
        const bottom = Math.min(base.bottom, overlay.bottom);
        const area = Math.max(1, base.width * base.height);
        return (Math.max(0, right - left) * Math.max(0, bottom - top)) / area;
      };
      const actionColumns = actionsGrid
        ? getComputedStyle(actionsGrid).gridTemplateColumns.split(' ').filter(Boolean).length
        : 0;
      const stageRect = rectOf('.stage-panel');
      const messageRect = elementInfo('.message-panel');
      const canvasRect = rectOf('.canvas-wrap');
      const actionsRect = rectOf('.panel-block--actions');
      const sidePanel = document.querySelector('.side-panel');
      const sideRect = rectOf('.side-panel');
      const statusRect = rectOf('.panel-block--status');
      const minigamesRect = rectOf('.panel-block--minigames');
      return {
        innerWidth,
        innerHeight,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        app: rectOf('.app'),
        stage: stageRect,
        message: messageRect,
        side: sideRect,
        actions: actionsRect,
        actionsAnchor: rectOf('.actions-dock-anchor'),
        status: statusRect,
        dailyRhythm: elementInfo('.daily-rhythm-strip'),
        dailyPlan: elementInfo('.daily-plan-strip'),
        resources: rectOf('.panel-block--resources'),
        discoveries: rectOf('.panel-block--discoveries'),
        minigames: minigamesRect,
        minigamesHeading: elementInfo('.panel-block--minigames .block-heading'),
        buildBadge: elementInfo('[data-build-badge]'),
        calendar: rectOf('[data-calendar-checklist]'),
        calendarList: rectOf('[data-calendar-list]'),
        calendarRows: Array.from(document.querySelectorAll('.calendar-event')).map((row) => {
          const rect = row.getBoundingClientRect();
          const label = row.querySelector('strong');
          const meta = row.querySelector('span:last-child');
          return {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            labelText: label ? label.textContent : '',
            labelClipped: label ? label.scrollWidth > label.clientWidth + 1 || label.scrollHeight > label.clientHeight + 1 : false,
            metaClipped: meta ? meta.scrollWidth > meta.clientWidth + 1 || meta.scrollHeight > meta.clientHeight + 1 : false
          };
        }),
        log: rectOf('.panel-block--log'),
        debug: rectOf('.panel-block--debug'),
        canvas: canvasRect,
        actionsPosition: actionsStyle ? actionsStyle.position : '',
        actionsDockActive: actionsPanel ? actionsPanel.classList.contains('is-adaptive-docked') : false,
        actionsDockPlacement: actionsPanel ? actionsPanel.dataset.adaptiveDock || 'flow' : 'missing',
        actionsStageOverlapRatio: getOverlapRatio(stageRect, actionsRect),
        actionsCanvasOverlapRatio: getOverlapRatio(canvasRect, actionsRect),
        actionsMessageOverlapRatio: getOverlapRatio(messageRect, actionsRect),
        actionsSideOverlapRatio: getOverlapRatio(sideRect, actionsRect),
        actionsStatusOverlapRatio: getOverlapRatio(statusRect, actionsRect),
        actionsMinigamesOverlapRatio: getOverlapRatio(minigamesRect, actionsRect),
        sideScrollTop: sidePanel ? sidePanel.scrollTop : 0,
        sideScrollHeight: sidePanel ? sidePanel.scrollHeight : 0,
        sideClientHeight: sidePanel ? sidePanel.clientHeight : 0,
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

  if (viewportWidth <= 640) {
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
  if ((viewportWidth <= 1024 || viewportHeight <= 760) && info.actionsDockActive) {
    await assertAdaptiveDockReleasesOnSidePanelScroll(cdp, info);
    await assertAdaptiveDockReleasesPastStandardPlace(cdp);
  }
  if (viewportWidth > 640 && viewportHeight <= 700 && !info.actionsDockActive && info.actionsPosition === 'sticky') {
    await assertShortDesktopActionsStayVisibleOnSidePanelScroll(cdp, info);
  }
  console.log(`viewport: ${filePath}`);
  console.log(`viewport layout: side=${Math.round(info.side.width)}x${Math.round(info.side.height)}, canvas=${Math.round(info.canvas.width)}x${Math.round(info.canvas.height)}, actionColumns=${info.actionColumns}`);
}

async function waitForMobileActionDock(cdp) {
  if (viewportWidth > 640) {
    return;
  }

  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      window.dispatchEvent(new Event('resize'));
      if (window.visualViewport) {
        window.visualViewport.dispatchEvent(new Event('resize'));
      }
      return true;
    })()`,
    returnByValue: true
  });

  await waitForExpression(
    cdp,
    `Boolean(document.querySelector('.panel-block--actions.is-adaptive-docked'))`,
    2500
  );
}

function assertMobileLayout(info) {
  if (!info.stage || !info.canvas || !info.message || !info.actions || !info.status) {
    throw new Error('Brakuje kluczowych elementów layoutu mobilnego.');
  }

  const canvasTopLimit = info.innerWidth <= 640 || info.innerHeight <= 500 ? 150 : 190;
  if (info.canvas.top > canvasTopLimit) {
    throw new Error(`Canvas jest zbyt nisko na mobile: top=${Math.round(info.canvas.top)}px, limit=${canvasTopLimit}px`);
  }

  if (!info.actionsDockActive) {
    throw new Error('Mobilny panel akcji powinien przejść w aktywny dock, gdy scena jest w widoku.');
  }

  if (info.actionsDockActive && info.actionsPosition !== 'fixed') {
    throw new Error(`Aktywny dock akcji powinien być fixed, wykryto ${info.actionsPosition}.`);
  }

  if (info.actionsDockActive && !['bottom', 'top'].includes(info.actionsDockPlacement)) {
    throw new Error(`Mobilny dock akcji powinien być na dole albo u góry, wykryto ${info.actionsDockPlacement}.`);
  }

  if (info.actionColumns !== 5) {
    throw new Error(`Kompaktowy panel akcji powinien mieć 5 kolumn, wykryto ${info.actionColumns}.`);
  }

  assertAdaptiveDockBounds(info);

  const visibleActionButtons = info.actionButtons.filter((button) => button.visible);
  if (visibleActionButtons.length > 8) {
    throw new Error(`Kompaktowy panel akcji pokazuje za dużo przycisków naraz: ${visibleActionButtons.length}.`);
  }

  const shortButtons = visibleActionButtons.filter((button) => button.height < 48);
  if (shortButtons.length) {
    throw new Error(`Za niskie touch targety akcji: ${shortButtons.map((button) => `${button.labelText}:${Math.round(button.height)}px`).join(', ')}`);
  }

  const clippedLabels = visibleActionButtons.filter((button) => button.labelClipped);
  if (clippedLabels.length) {
    throw new Error(`Ucięte etykiety akcji: ${clippedLabels.map((button) => button.labelText).join(', ')}`);
  }

  if (captureCalendarChecklist && info.calendar) {
    if (info.calendar.width > info.innerWidth - 12) {
      throw new Error(`Kalendarz wychodzi poza mobile viewport: width=${Math.round(info.calendar.width)}px`);
    }
    const shortRows = info.calendarRows.filter((row) => row.height < 38);
    if (shortRows.length) {
      throw new Error(`Za niskie wiersze kalendarza: ${shortRows.map((row) => `${row.labelText}:${Math.round(row.height)}px`).join(', ')}`);
    }
    const clippedRows = info.calendarRows.filter((row) => row.labelClipped || row.metaClipped);
    if (clippedRows.length) {
      throw new Error(`Ucięte etykiety kalendarza: ${clippedRows.map((row) => row.labelText).join(', ')}`);
    }
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

  const canvasLimit = info.innerHeight <= 500 ? 320 : 352;
  if (info.canvas.width > canvasLimit || info.canvas.height > canvasLimit) {
    throw new Error(`Canvas jest za duży dla krótkiego viewportu: ${Math.round(info.canvas.width)}x${Math.round(info.canvas.height)}px`);
  }

  assertShortStageStack(info);

  if (info.innerWidth <= 640) {
    if (!info.actionsDockActive) {
      throw new Error('Akcje w krótkim layoucie dotykowym powinny przejść w aktywny dock, gdy scena jest w widoku.');
    }

    if (info.actionsPosition !== 'fixed') {
      throw new Error(`Aktywny dock akcji w krótkim layoucie powinien być fixed, wykryto ${info.actionsPosition}.`);
    }

    if (info.actionColumns !== 2 && info.actionColumns !== 5) {
      throw new Error(`Dock akcji w krótkim layoucie powinien mieć 2 albo 5 kolumn, wykryto ${info.actionColumns}.`);
    }

    assertAdaptiveDockBounds(info);
    return;
  }

  assertShortDesktopActionFlow(info);
}

function assertShortStageStack(info) {
  const visibleSections = [info.message, info.dailyRhythm, info.dailyPlan].filter((section) => {
    return section && section.visible;
  });
  let previous = info.canvas;

  visibleSections.forEach((section) => {
    if (previous && section.top < previous.bottom - 1) {
      throw new Error(
        `Sekcja lewego panelu nachodzi na poprzedni element: previousBottom=${Math.round(previous.bottom)}, sectionTop=${Math.round(section.top)}.`
      );
    }
    if (section.bottom > info.stage.bottom + 1) {
      throw new Error(`Sekcja lewego panelu jest ucięta przez scenę: bottom=${Math.round(section.bottom)}, stageBottom=${Math.round(info.stage.bottom)}.`);
    }
    if (section.clipped && info.innerHeight > 500) {
      throw new Error('Sekcja lewego panelu jest przypadkowo przycięta w krótkim layoucie.');
    }
    previous = section;
  });
}

function assertShortDesktopActionFlow(info) {
  if (info.actionsDockActive) {
    throw new Error(`Akcje w krótkim layoucie desktopowym nie powinny używać fixed docka, wykryto ${info.actionsDockPlacement}.`);
  }

  if (info.actionsDockPlacement !== 'flow') {
    throw new Error(`Panel akcji powinien zostać w przepływie side-panelu, wykryto ${info.actionsDockPlacement}.`);
  }

  if (info.actionsPosition !== 'static') {
    throw new Error(`Panel akcji w krótkim layoucie desktopowym powinien zostać w przepływie, wykryto ${info.actionsPosition}.`);
  }

  if (info.actionColumns !== 3) {
    throw new Error(`Panel akcji w krótkim layoucie desktopowym powinien mieć 3 kompaktowe kolumny, wykryto ${info.actionColumns}.`);
  }

  if (info.actions.left < info.side.left - 1 || info.actions.right > info.side.right + 1) {
    throw new Error(
      `Panel akcji powinien mieścić się w bocznym panelu: actions=${Math.round(info.actions.left)}..${Math.round(info.actions.right)}, side=${Math.round(info.side.left)}..${Math.round(info.side.right)}.`
    );
  }

  if (info.actions.top < info.side.top - 1 || info.actions.bottom > info.innerHeight + 1) {
    throw new Error(`Panel akcji nie jest w pełni widoczny w krótkim layoucie: top=${Math.round(info.actions.top)}, bottom=${Math.round(info.actions.bottom)}, height=${info.innerHeight}.`);
  }

  if (info.actionsCanvasOverlapRatio > 0.01 || info.actionsMessageOverlapRatio > 0.01) {
    throw new Error(
      `Panel akcji nie powinien zasłaniać sceny ani komunikatu: canvas=${(info.actionsCanvasOverlapRatio * 100).toFixed(1)}%, message=${(info.actionsMessageOverlapRatio * 100).toFixed(1)}%.`
    );
  }

  if (!info.minigamesHeading || !info.minigamesHeading.visible) {
    throw new Error('Nagłówek Gry powinien być widoczny w krótkim layoucie.');
  }

  if (info.minigamesHeading.top < info.side.top - 1 || info.minigamesHeading.top > info.innerHeight - 32) {
    throw new Error(`Nagłówek Gry jest poza pierwszym widokiem: top=${Math.round(info.minigamesHeading.top)}, height=${info.innerHeight}.`);
  }

  const headingOverlap = getLayoutOverlapRatio(info.minigamesHeading, info.actions);
  if (headingOverlap > 0.01) {
    throw new Error(`Panel akcji nachodzi na nagłówek Gry: ${(headingOverlap * 100).toFixed(1)}%.`);
  }

  if (info.buildBadge && info.buildBadge.visible) {
    const badgeOverlap = Math.max(
      getLayoutOverlapRatio(info.actions, info.buildBadge),
      getLayoutOverlapRatio(info.side, info.buildBadge),
      getLayoutOverlapRatio(info.stage, info.buildBadge)
    );
    if (badgeOverlap > 0.01) {
      throw new Error(`Build badge nachodzi na obszar aplikacji w krótkim layoucie: ${(badgeOverlap * 100).toFixed(1)}%.`);
    }
  }
}

function getLayoutOverlapRatio(base, overlay) {
  if (!base || !overlay) {
    return 0;
  }
  const left = Math.max(base.left, overlay.left);
  const right = Math.min(base.right, overlay.right);
  const top = Math.max(base.top, overlay.top);
  const bottom = Math.min(base.bottom, overlay.bottom);
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);
  return (width * height) / Math.max(1, base.width * base.height);
}

function assertAdaptiveDockBounds(info) {
  if (!info.actionsDockActive) {
    return;
  }

  if (!info.actions || !info.canvas) {
    throw new Error('Brakuje geometrii aktywnego docka.');
  }

  if (info.actions.left < -1 || info.actions.right > info.innerWidth + 1) {
    throw new Error(`Dock akcji wychodzi poza viewport: left=${Math.round(info.actions.left)}, right=${Math.round(info.actions.right)}, width=${info.innerWidth}`);
  }

  if (info.actions.top < -1 || info.actions.bottom > info.innerHeight + 1) {
    throw new Error(`Dock akcji wychodzi pionowo poza viewport: top=${Math.round(info.actions.top)}, bottom=${Math.round(info.actions.bottom)}, height=${info.innerHeight}`);
  }

  if (info.actionsCanvasOverlapRatio > 0.18) {
    throw new Error(`Dock akcji zasłania zbyt dużo sceny: ${(info.actionsCanvasOverlapRatio * 100).toFixed(1)}%.`);
  }

  if (info.innerWidth > 640) {
    const panelOverlap = Math.max(
      Number(info.actionsSideOverlapRatio) || 0,
      Number(info.actionsStatusOverlapRatio) || 0,
      Number(info.actionsMinigamesOverlapRatio) || 0
    );
    if (panelOverlap > 0.01) {
      throw new Error(
        `Dock akcji nachodzi na panel opieki: side=${(info.actionsSideOverlapRatio * 100).toFixed(1)}%, status=${(info.actionsStatusOverlapRatio * 100).toFixed(1)}%, minigry=${(info.actionsMinigamesOverlapRatio * 100).toFixed(1)}%.`
      );
    }
  }
}

async function assertShortDesktopActionsStayVisibleOnSidePanelScroll(cdp, info) {
  if (!info || !info.side || info.innerWidth <= 640 || Number(info.sideScrollHeight) <= Number(info.sideClientHeight) + 80) {
    return;
  }

  const scrollResult = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const side = document.querySelector('.side-panel');
      if (!side || side.scrollHeight <= side.clientHeight + 80) {
        return { skipped: true };
      }
      side.scrollTop = Math.min(220, side.scrollHeight - side.clientHeight);
      side.dispatchEvent(new Event('scroll'));
      return { skipped: false, scrollTop: side.scrollTop };
    })()`,
    returnByValue: true
  });

  const scrollInfo = scrollResult.result.value || {};
  if (scrollInfo.skipped) {
    return;
  }

  await delay(180);
  const stickyResult = await cdp.send('Runtime.evaluate', {
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
      const getOverlapRatio = (base, overlay) => {
        if (!base || !overlay) {
          return 0;
        }
        const left = Math.max(base.left, overlay.left);
        const right = Math.min(base.right, overlay.right);
        const top = Math.max(base.top, overlay.top);
        const bottom = Math.min(base.bottom, overlay.bottom);
        const area = Math.max(1, base.width * base.height);
        return (Math.max(0, right - left) * Math.max(0, bottom - top)) / area;
      };
      const actions = document.querySelector('.panel-block--actions');
      const side = document.querySelector('.side-panel');
      const actionsRect = rectOf('.panel-block--actions');
      const sideRect = rectOf('.side-panel');
      const canvasRect = rectOf('.canvas-wrap');
      const messageRect = rectOf('.message-panel');
      const actionsStyle = actions ? getComputedStyle(actions) : null;
      return {
        active: actions ? actions.classList.contains('is-adaptive-docked') : false,
        placement: actions ? actions.dataset.adaptiveDock || 'flow' : 'missing',
        position: actionsStyle ? actionsStyle.position : '',
        sideScrollTop: side ? side.scrollTop : 0,
        actions: actionsRect,
        side: sideRect,
        canvasOverlap: getOverlapRatio(canvasRect, actionsRect),
        messageOverlap: getOverlapRatio(messageRect, actionsRect)
      };
    })()`,
    returnByValue: true
  });

  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const side = document.querySelector('.side-panel');
      if (side) {
        side.scrollTop = 0;
        side.dispatchEvent(new Event('scroll'));
      }
    })()`,
    awaitPromise: true
  });
  await delay(80);

  const stickyInfo = stickyResult.result.value || {};
  if (stickyInfo.sideScrollTop > 12 && stickyInfo.active) {
    throw new Error(`Panel akcji desktopowego krótkiego layoutu nie powinien wracać do fixed docka po scrollu, wykryto ${stickyInfo.placement}.`);
  }

  if (stickyInfo.position !== 'sticky') {
    throw new Error(`Panel akcji powinien zostać sticky po scrollu side-panelu, wykryto ${stickyInfo.position}.`);
  }

  if (!stickyInfo.actions || !stickyInfo.side) {
    throw new Error('Brakuje geometrii panelu akcji po scrollu side-panelu.');
  }

  if (stickyInfo.actions.left < stickyInfo.side.left - 1 || stickyInfo.actions.right > stickyInfo.side.right + 1) {
    throw new Error('Panel akcji po scrollu side-panelu wyszedł poza boczny panel.');
  }

  if (stickyInfo.actions.top < stickyInfo.side.top - 1 || stickyInfo.actions.bottom > info.innerHeight + 1) {
    throw new Error(`Panel akcji po scrollu side-panelu nie jest widoczny: top=${Math.round(stickyInfo.actions.top)}, bottom=${Math.round(stickyInfo.actions.bottom)}, height=${info.innerHeight}.`);
  }

  if (stickyInfo.canvasOverlap > 0.01 || stickyInfo.messageOverlap > 0.01) {
    throw new Error(
      `Panel akcji po scrollu nie powinien zasłaniać sceny ani komunikatu: canvas=${(stickyInfo.canvasOverlap * 100).toFixed(1)}%, message=${(stickyInfo.messageOverlap * 100).toFixed(1)}%.`
    );
  }
}

async function assertAdaptiveDockReleasesPastStandardPlace(cdp) {
  const scrollResult = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const anchor = document.querySelector('.actions-dock-anchor');
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      if (!anchor || maxScroll < 80) {
        return { skipped: true, reason: 'no-scroll' };
      }
      const anchorTop = anchor.getBoundingClientRect().top + window.scrollY;
      const target = Math.min(maxScroll, Math.max(0, anchorTop + 24));
      window.scrollTo(0, target);
      return { skipped: false, target, anchorTop };
    })()`,
    returnByValue: true
  });

  const scrollInfo = scrollResult.result.value || {};
  if (scrollInfo.skipped) {
    return;
  }

  await delay(180);
  const dockResult = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const canvas = document.querySelector('.canvas-wrap');
      const actions = document.querySelector('.panel-block--actions');
      const anchor = document.querySelector('.actions-dock-anchor');
      const rect = canvas ? canvas.getBoundingClientRect() : null;
      const anchorRect = anchor ? anchor.getBoundingClientRect() : null;
      const visibleWidth = rect ? Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0)) : 0;
      const visibleHeight = rect ? Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0)) : 0;
      const ratio = rect ? (visibleWidth * visibleHeight) / Math.max(1, rect.width * rect.height) : 0;
      return {
        active: actions ? actions.classList.contains('is-adaptive-docked') : false,
        placement: actions ? actions.dataset.adaptiveDock || 'flow' : 'missing',
        sceneRatio: ratio,
        anchorTop: anchorRect ? anchorRect.top : null
      };
    })()`,
    returnByValue: true
  });

  await cdp.send('Runtime.evaluate', {
    expression: `window.scrollTo(0, 0)`,
    awaitPromise: true
  });
  await delay(80);

  const dockInfo = dockResult.result.value || {};
  if (dockInfo.anchorTop !== null && dockInfo.anchorTop <= 8 && dockInfo.active) {
    throw new Error(`Dock akcji powinien wrócić do flow po minięciu standardowego miejsca, wykryto ${dockInfo.placement}.`);
  }
}

async function assertAdaptiveDockReleasesOnSidePanelScroll(cdp, info) {
  if (!info || !info.side || info.innerWidth <= 640 || Number(info.sideScrollHeight) <= Number(info.sideClientHeight) + 80) {
    return;
  }

  const scrollResult = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const side = document.querySelector('.side-panel');
      if (!side || side.scrollHeight <= side.clientHeight + 80) {
        return { skipped: true };
      }
      side.scrollTop = Math.min(180, side.scrollHeight - side.clientHeight);
      side.dispatchEvent(new Event('scroll'));
      return { skipped: false, scrollTop: side.scrollTop };
    })()`,
    returnByValue: true
  });

  const scrollInfo = scrollResult.result.value || {};
  if (scrollInfo.skipped) {
    return;
  }

  await delay(180);
  const releaseResult = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const actions = document.querySelector('.panel-block--actions');
      const side = document.querySelector('.side-panel');
      return {
        active: actions ? actions.classList.contains('is-adaptive-docked') : false,
        placement: actions ? actions.dataset.adaptiveDock || 'flow' : 'missing',
        sideScrollTop: side ? side.scrollTop : 0
      };
    })()`,
    returnByValue: true
  });

  const releaseInfo = releaseResult.result.value || {};
  if (releaseInfo.sideScrollTop > 12 && releaseInfo.active) {
    throw new Error(`Dock akcji powinien wrócić do flow przy scrollu bocznego panelu, wykryto ${releaseInfo.placement}.`);
  }

  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const side = document.querySelector('.side-panel');
      if (side) {
        side.scrollTop = 0;
        side.dispatchEvent(new Event('scroll'));
      }
    })()`,
    awaitPromise: true
  });
  await delay(180);

  const restoreResult = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const actions = document.querySelector('.panel-block--actions');
      const side = document.querySelector('.side-panel');
      return {
        active: actions ? actions.classList.contains('is-adaptive-docked') : false,
        placement: actions ? actions.dataset.adaptiveDock || 'flow' : 'missing',
        sideScrollTop: side ? side.scrollTop : 0
      };
    })()`,
    returnByValue: true
  });

  const restoreInfo = restoreResult.result.value || {};
  if (restoreInfo.sideScrollTop <= 12 && !restoreInfo.active) {
    throw new Error('Dock akcji powinien móc wrócić po przewinięciu bocznego panelu na górę.');
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
