import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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
const chromiumStartupTimeoutMs = Math.max(
  6000,
  Number(process.env.PIECZARGOTCHI_CHROMIUM_START_TIMEOUT_MS) || 20000,
);
const captureAppsScriptNoAssets = process.env.PIECZARGOTCHI_CAPTURE_APPS_SCRIPT_NO_ASSETS === '1';
const captureBeforeAssets = process.env.PIECZARGOTCHI_CAPTURE_BEFORE_ASSETS === '1';
const captureAllMinigames = process.env.PIECZARGOTCHI_CAPTURE_ALL_MINIGAMES === '1';
const captureMinigamesOnly = process.env.PIECZARGOTCHI_CAPTURE_MINIGAMES_ONLY === '1';
const captureUiFlow = process.env.PIECZARGOTCHI_CAPTURE_UI_FLOW === '1';
const captureExceptionProbe = process.env.PIECZARGOTCHI_CAPTURE_EXCEPTION_PROBE === '1';
const captureLegendaryGames = process.env.PIECZARGOTCHI_CAPTURE_LEGENDARY_GAMES === '1';
const captureMinigamePanelScreens = process.env.PIECZARGOTCHI_CAPTURE_MINIGAME_PANEL === '1';
const captureJournal = process.env.PIECZARGOTCHI_CAPTURE_JOURNAL === '1';
const captureJournalDiscoveryId = String(process.env.PIECZARGOTCHI_CAPTURE_JOURNAL_DISCOVERY || 'aurora').trim() || 'aurora';
const debugCalendarEvent = String(process.env.PIECZARGOTCHI_DEBUG_CALENDAR_EVENT || '').trim();
const captureCalendarMatrix = process.env.PIECZARGOTCHI_CAPTURE_CALENDAR_MATRIX === '1';
const captureCalendarChecklist = process.env.PIECZARGOTCHI_CAPTURE_CALENDAR_CHECKLIST === '1';
const blockedAssetPatterns = readListEnv('PIECZARGOTCHI_CAPTURE_BLOCK_ASSETS');
const captureGrassPointer = process.env.PIECZARGOTCHI_CAPTURE_GRASS_POINTER === '1';
const captureInteractions = process.env.PIECZARGOTCHI_CAPTURE_INTERACTIONS === '1';
const captureCleanlinessOverride = readOptionalEnvNumber('PIECZARGOTCHI_CAPTURE_CLEANLINESS');
const captureCleanliness = captureCleanlinessOverride === null
  ? 80
  : Math.max(0, Math.min(100, captureCleanlinessOverride));
const userDataDir = path.join(tmpdir(), `pieczargotchi-cdp-${process.pid}-${Date.now()}`);
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
  const phenomenon = process.env.PIECZARGOTCHI_DEBUG_PHENOMENON || 'auto';
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
    || phenomenon !== 'auto'
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
    phenomenonOverride: phenomenon,
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
  '--disable-dev-shm-usage',
  '--no-sandbox',
  '--remote-debugging-address=127.0.0.1',
  '--remote-debugging-port=0',
  `--user-data-dir=${userDataDir}`,
  'about:blank'
], {
  stdio: ['ignore', 'pipe', 'pipe']
});
let browserStdout = '';
let browserStderr = '';
let browserSpawnError = null;
let browserCloseInfo = null;
browser.stdout.on('data', (chunk) => {
  browserStdout = appendBrowserOutput(browserStdout, chunk);
});
browser.stderr.on('data', (chunk) => {
  browserStderr = appendBrowserOutput(browserStderr, chunk);
});
browser.on('error', (error) => {
  browserSpawnError = error;
});
const browserClosed = new Promise((resolve) => browser.on('close', (code, signal) => {
  browserCloseInfo = { code, signal };
  resolve(browserCloseInfo);
}));

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
  if (emulateMobile) {
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  }

  await navigate(cdp, appUrl);
  if (captureExceptionProbe) {
    await cdp.send('Runtime.evaluate', {
      expression: `setTimeout(() => { throw new Error('PIECZARGOTCHI_CAPTURE_EXCEPTION_PROBE'); }, 0)`
    });
    await delay(100);
    cdp.throwIfPageExceptions();
    throw new Error('Próba wyjątku strony nie została wykryta przez capture QA.');
  }
  if (captureUiFlow) {
    await captureRealUiFlow(cdp);
  } else {
  if (!captureMinigamesOnly) {
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
  if (captureInteractions) {
    await captureInteractionSmoke(cdp);
    if (emulateMobile) {
      await captureTouchInteractionSmoke(cdp);
    }
  }

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
      interactionMinScore: 1,
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
      interactionMinScore: 1,
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
      startedOffsetMs: -900,
      rhythmInputMode: 'touch',
      detailKey: 'pattern',
      detailMin: 5,
      interactionMinScore: 1,
      domainPixelName: 'padPixels',
      domainPixelExpression: `(r > 95 && g > 55 && b < 230 && (r - b > 12 || b - g > 24))`
    });
  }

  if (captureLegendaryGames || captureAllMinigames) {
    await captureConfiguredMinigame(cdp, {
      id: 'sporeTrail',
      label: 'Szlak Zarodników',
      fileLabel: 'spore-trail',
      canvasSelector: '[data-legendary-game-canvas]',
      seed: 717171,
      growth: 100,
      startedOffsetMs: 1800,
      viewArena: true,
      detailKey: 'targets',
      detailMin: 10,
      interactionMinScore: 1,
      domainPixelName: 'trailPixels',
      domainPixelExpression: `(r > 120 && g > 150 && b > 150)`
    });
    await captureConfiguredMinigame(cdp, {
      id: 'myceliumLeague',
      label: 'Liga Grzybni',
      fileLabel: 'mycelium-league',
      canvasSelector: '[data-legendary-game-canvas]',
      seed: 727272,
      growth: 100,
      startedOffsetMs: 1800,
      viewArena: true,
      detailKey: 'targets',
      detailMin: 10,
      interactionMinScore: 1,
      domainPixelName: 'leaguePixels',
      domainPixelExpression: `(r > 150 && g > 120 && b < 170)`
    });
    await captureConfiguredMinigame(cdp, {
      id: 'memoryGarden',
      label: 'Ogród Pamiątek',
      fileLabel: 'memory-garden',
      canvasSelector: '[data-legendary-game-canvas]',
      seed: 737373,
      growth: 100,
      startedOffsetMs: 1800,
      viewArena: true,
      detailKey: 'targets',
      detailMin: 8,
      interactionMinScore: 1,
      domainPixelName: 'gardenPixels',
      domainPixelExpression: `(r > 150 && g > 110 && b < 130)`
    });
  }
  }

  cdp.throwIfPageExceptions();
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

async function captureRealUiFlow(cdp) {
  await waitForExpression(cdp, `Boolean(window.__pieczargotchiRuntime && window.__pieczargotchiRuntime.booted)`, 6000);
  await waitForExpression(cdp, `Boolean(document.querySelector('[data-name-gate]:not([hidden])'))`, 3000);

  const gate = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const header = document.querySelector('.topbar');
      const menu = document.querySelector('[data-settings-open]');
      const live = document.querySelector('[data-ui-alert]');
      const minigameLive = document.querySelector('[data-minigame-announcement]');
      menu.focus();
      return {
        headerInert: Boolean(header && header.inert),
        headerAriaHidden: header && header.getAttribute('aria-hidden'),
        backgroundFocusBlocked: document.activeElement !== menu,
        liveAriaHidden: live && live.getAttribute('aria-hidden'),
        minigameLiveAriaHidden: minigameLive && minigameLive.getAttribute('aria-hidden')
      };
    })()`,
    returnByValue: true
  });
  const gateInfo = gate.result.value || {};
  if (!gateInfo.headerInert
    || gateInfo.headerAriaHidden !== 'true'
    || !gateInfo.backgroundFocusBlocked
    || gateInfo.liveAriaHidden !== null
    || gateInfo.minigameLiveAriaHidden !== null) {
    throw new Error(`Bramka imienia nie izoluje tła poprawnie: ${JSON.stringify(gateInfo)}`);
  }

  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const input = document.querySelector('[data-name-input]');
      const form = document.querySelector('[data-name-form]');
      input.value = 'Przepływka';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      form.requestSubmit();
      return true;
    })()`,
    returnByValue: true
  });
  await waitForExpression(cdp, `Boolean(document.querySelector('[data-name-gate][hidden]'))`, 3000);
  const gateRestored = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const header = document.querySelector('.topbar');
      return {
        inert: Boolean(header && header.inert),
        hasInert: Boolean(header && header.hasAttribute('inert')),
        hasAriaHidden: Boolean(header && header.hasAttribute('aria-hidden'))
      };
    })()`,
    returnByValue: true
  });
  if (gateRestored.result.value.inert || gateRestored.result.value.hasInert || gateRestored.result.value.hasAriaHidden) {
    throw new Error(`Bramka imienia nie odtworzyła atrybutów tła: ${JSON.stringify(gateRestored.result.value)}`);
  }

  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const wake = document.querySelector('[data-action-id="sleepWake"]');
      if (!wake) return false;
      wake.click();
      return true;
    })()`,
    returnByValue: true
  });
  await waitForExpression(cdp, `window.__pieczargotchiRuntime.state.mode === 'awake'`, 3000);

  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      document.querySelector('[data-workspace-tab="games"]').click();
      const start = document.querySelector('[data-minigame-start="dewCatch"]');
      if (!start || start.disabled) return false;
      start.click();
      return true;
    })()`,
    returnByValue: true
  });
  await waitForExpression(cdp, `(() => {
    const field = document.querySelector('[data-minigame-playfield]');
    return Boolean(field && !field.hidden && field.dataset.launchPhase === 'countdown');
  })()`, 3000);
  await waitForExpression(cdp, `(() => {
    const field = document.querySelector('[data-minigame-playfield]');
    if (!field) return false;
    const rect = field.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= innerHeight + 1;
  })()`, 1800);

  const countdown = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const runtime = window.__pieczargotchiRuntime;
      const field = document.querySelector('[data-minigame-playfield]');
      const status = document.querySelector('[data-minigame-launch-status]');
      const session = runtime.state.minigames.active;
      const rect = field.getBoundingClientRect();
      return {
        phase: field.dataset.launchPhase,
        status: status && status.textContent,
        startedIn: Number(session.startedAt) - Date.now(),
        duration: Number(session.until) - Number(session.startedAt),
        visible: rect.top >= 0 && rect.bottom <= innerHeight + 1,
        focusedInside: field.contains(document.activeElement)
      };
    })()`,
    returnByValue: true
  });
  const countdownInfo = countdown.result.value || {};
  if (countdownInfo.phase !== 'countdown'
    || !/Start za [123]/.test(String(countdownInfo.status || ''))
    || Number(countdownInfo.startedIn) < 1200
    || Number(countdownInfo.duration) !== 20000
    || !countdownInfo.visible
    || !countdownInfo.focusedInside) {
    throw new Error(`Niepoprawny realny launch minigry: ${JSON.stringify(countdownInfo)}`);
  }

  await waitForExpression(cdp, `(() => {
    const field = document.querySelector('[data-minigame-playfield]');
    const runtime = window.__pieczargotchiRuntime;
    return Boolean(field && field.dataset.launchPhase === 'running' && runtime.minigame && runtime.minigame.session);
  })()`, 5000);

  const running = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const runtime = window.__pieczargotchiRuntime;
      const session = runtime.minigame.session;
      return {
        id: session.id,
        duration: Number(session.until) - Number(session.startedAt),
        elapsed: Date.now() - Number(session.startedAt),
        workspace: runtime.ui && runtime.ui.workspaceTab
      };
    })()`,
    returnByValue: true
  });
  const runningInfo = running.result.value || {};
  if (runningInfo.id !== 'dewCatch'
    || runningInfo.duration !== 20000
    || runningInfo.elapsed < 0
    || runningInfo.elapsed > 1800
    || runningInfo.workspace !== 'games') {
    throw new Error(`Minigra nie wystartowała z pełnym czasem: ${JSON.stringify(runningInfo)}`);
  }

  const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  const screenshotPath = `${outputPrefix}-real-ui-flow-${viewportWidth}x${viewportHeight}.png`;
  writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));

  const minigameBeforeModal = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const runtime = window.__pieczargotchiRuntime;
      return {
        targetX: runtime.minigame && runtime.minigame.bucket && runtime.minigame.bucket.targetX,
        score: runtime.minigame && runtime.minigame.session && runtime.minigame.session.score
      };
    })()`,
    returnByValue: true
  });
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('[data-settings-open]').click()`,
    returnByValue: true
  });
  await waitForExpression(cdp, `Boolean(document.querySelector('[data-settings-dialog][open]'))`, 2000);
  const modal = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const dialog = document.querySelector('[data-settings-dialog]');
      const reset = dialog.querySelector('[data-reset-open]');
      return {
        open: dialog.open,
        modalActive: window.__pieczargotchiRuntime.ui.activeModal,
        focusInside: dialog.contains(document.activeElement),
        resetBlocked: reset.getAttribute('aria-disabled') === 'true',
        resetReason: reset.dataset.disabledReason || ''
      };
    })()`,
    returnByValue: true
  });
  const modalInfo = modal.result.value || {};
  if (!modalInfo.open || modalInfo.modalActive !== 'settings' || !modalInfo.focusInside || !modalInfo.resetBlocked || !modalInfo.resetReason) {
    throw new Error(`Menu nie zachowuje modalności ani blokady resetu: ${JSON.stringify(modalInfo)}`);
  }

  await dispatchWindowKey(cdp, 'ArrowLeft');
  await delay(80);
  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('[data-settings-dialog] [data-reset-open]').click()`,
    returnByValue: true
  });
  const minigameBehindModal = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const runtime = window.__pieczargotchiRuntime;
      return {
        targetX: runtime.minigame && runtime.minigame.bucket && runtime.minigame.bucket.targetX,
        score: runtime.minigame && runtime.minigame.session && runtime.minigame.session.score,
        settingsOpen: Boolean(document.querySelector('[data-settings-dialog][open]')),
        resetOpen: Boolean(document.querySelector('[data-reset-dialog][open]')),
        activeId: runtime.state.minigames.active && runtime.state.minigames.active.id
      };
    })()`,
    returnByValue: true
  });
  const minigameBefore = minigameBeforeModal.result.value || {};
  const minigameBlocked = minigameBehindModal.result.value || {};
  if (
    minigameBlocked.targetX !== minigameBefore.targetX
    || minigameBlocked.score !== minigameBefore.score
    || !minigameBlocked.settingsOpen
    || minigameBlocked.resetOpen
    || minigameBlocked.activeId !== 'dewCatch'
  ) {
    throw new Error(`Minigra przyjęła wejście albo reset zza Menu: ${JSON.stringify({ before: minigameBefore, after: minigameBlocked })}`);
  }

  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      document.querySelector('[data-settings-close]').click();
      const canvas = document.querySelector('[data-dew-catch-canvas]');
      canvas.focus({ preventScroll: true });
      return true;
    })()`,
    returnByValue: true
  });
  await waitForExpression(cdp, `!document.querySelector('[data-settings-dialog][open]')`, 2000);
  await dispatchWindowKey(cdp, 'ArrowLeft');
  const minigameRefocused = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const runtime = window.__pieczargotchiRuntime;
      const canvas = document.querySelector('[data-dew-catch-canvas]');
      const session = runtime.minigame.session;
      return {
        targetX: runtime.minigame.bucket.targetX,
        focused: document.activeElement === canvas,
        activeModal: runtime.ui && runtime.ui.activeModal,
        openDialogs: Array.from(document.querySelectorAll('dialog[open]')).map((dialog) => dialog.className),
        nameGateHidden: document.querySelector('[data-name-gate]').hidden,
        now: Date.now(),
        session: {
          id: session.id,
          startedAt: session.startedAt,
          until: session.until,
          token: session.runtimeToken
        },
        saved: runtime.state.minigames.active ? {
          id: runtime.state.minigames.active.id,
          startedAt: runtime.state.minigames.active.startedAt,
          until: runtime.state.minigames.active.until,
          token: runtime.state.minigames.active.runtimeToken
        } : null,
        exclusive: runtime.exclusiveSession || null,
        foreign: runtime.foreignExclusiveSession || null,
        launch: runtime.minigameLaunch || null
      };
    })()`,
    returnByValue: true
  });
  const refocusedInfo = minigameRefocused.result.value || {};
  if (!refocusedInfo.focused || refocusedInfo.targetX === minigameBefore.targetX) {
    throw new Error(`Minigra nie odzyskała sterowania po zamknięciu Menu: ${JSON.stringify(refocusedInfo)}`);
  }

  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('[data-minigame-end]').click()`,
    returnByValue: true
  });
  await waitForExpression(cdp, `!window.__pieczargotchiRuntime.state.minigames.active`, 4000);

  await setCaptureGrowth(cdp, 100);
  const battleLaunch = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      document.querySelector('[data-workspace-tab="care"]').click();
      const more = document.querySelector('[data-action-more]');
      const moreRect = more && more.getBoundingClientRect();
      const moreVisible = Boolean(more && !more.hidden && getComputedStyle(more).display !== 'none' && moreRect.width > 0 && moreRect.height > 0);
      const launchFocus = moreVisible ? more : document.querySelector('[data-view-care]');
      launchFocus.focus({ preventScroll: true });
      const focusedLaunchTarget = document.activeElement === launchFocus;
      document.querySelector('[data-battle-start]').click();
      return { focusedLaunchTarget, launchTarget: moreVisible ? 'more' : 'care-view' };
    })()`,
    returnByValue: true
  });
  if (!battleLaunch.result.value || !battleLaunch.result.value.focusedLaunchTarget) {
    throw new Error(`Nie udało się ustawić fokusu na widocznym punkcie startu walki: ${JSON.stringify(battleLaunch.result.value)}`);
  }
  await waitForExpression(cdp, `Boolean(window.__pieczargotchiRuntime.state.battle.activeBattle)`, 3000);
  await waitForExpression(cdp, `!document.querySelector('[data-arena-panel]').hidden`, 2000);
  const battleBefore = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const runtime = window.__pieczargotchiRuntime;
      const config = window.PIECZARGOTCHI_CONFIG;
      return {
        hydration: runtime.state.stats.hydration,
        cooldown: runtime.state.cooldowns.hydrate || null,
        revision: runtime.state.saveRevision,
        stored: localStorage.getItem(config.storageKey),
        careBlocked: document.querySelector('[data-view-care]').getAttribute('aria-disabled') === 'true',
        focusRestored: document.activeElement === document.querySelector('[data-view-arena]')
      };
    })()`,
    returnByValue: true
  });
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      document.querySelector('[data-view-care]').click();
      document.querySelector('#gameMain').focus({ preventScroll: true });
    })()`,
    returnByValue: true
  });
  await dispatchDomKey(cdp, 'n');
  await delay(100);
  const battleAfter = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const runtime = window.__pieczargotchiRuntime;
      const config = window.PIECZARGOTCHI_CONFIG;
      return {
        viewMode: runtime.viewMode,
        hydration: runtime.state.stats.hydration,
        cooldown: runtime.state.cooldowns.hydrate || null,
        revision: runtime.state.saveRevision,
        stored: localStorage.getItem(config.storageKey),
        activeBattle: Boolean(runtime.state.battle.activeBattle)
      };
    })()`,
    returnByValue: true
  });
  const battleBeforeInfo = battleBefore.result.value || {};
  const battleAfterInfo = battleAfter.result.value || {};
  if (
    !battleBeforeInfo.careBlocked
    || !battleBeforeInfo.focusRestored
    || battleAfterInfo.viewMode !== 'arena'
    || !battleAfterInfo.activeBattle
    || battleAfterInfo.hydration !== battleBeforeInfo.hydration
    || battleAfterInfo.cooldown !== battleBeforeInfo.cooldown
    || battleAfterInfo.revision !== battleBeforeInfo.revision
    || battleAfterInfo.stored !== battleBeforeInfo.stored
  ) {
    throw new Error(`Walka przepuściła Opiekę albo zapis: ${JSON.stringify({ before: battleBeforeInfo, after: battleAfterInfo })}`);
  }

  const activeDebugGuard = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const runtime = window.__pieczargotchiRuntime;
      const config = window.PIECZARGOTCHI_CONFIG;
      document.querySelector('[data-settings-open]').click();
      const control = document.querySelector('[data-debug-growth]');
      const before = {
        state: JSON.stringify(runtime.state),
        revision: runtime.state.saveRevision,
        stored: localStorage.getItem(config.storageKey)
      };
      control.value = String(Math.max(0, Number(control.value) - 7));
      const accepted = control.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      return {
        ariaDisabled: control.getAttribute('aria-disabled'),
        cancelled: !accepted,
        stateSame: JSON.stringify(runtime.state) === before.state,
        revisionSame: runtime.state.saveRevision === before.revision,
        storedSame: localStorage.getItem(config.storageKey) === before.stored
      };
    })()`,
    returnByValue: true
  });
  const activeDebugGuardInfo = activeDebugGuard.result.value || {};
  if (
    activeDebugGuardInfo.ariaDisabled !== 'true'
    || !activeDebugGuardInfo.cancelled
    || !activeDebugGuardInfo.stateSame
    || !activeDebugGuardInfo.revisionSame
    || !activeDebugGuardInfo.storedSame
  ) {
    throw new Error(`Diagnostyka zmieniła stan podczas aktywnej walki: ${JSON.stringify(activeDebugGuardInfo)}`);
  }

  await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('[data-settings-dialog] [data-reset-open]').click()`,
    returnByValue: true
  });
  const activeResetBlocked = await cdp.send('Runtime.evaluate', {
    expression: `Boolean(document.querySelector('[data-settings-dialog][open]')) && !document.querySelector('[data-reset-dialog][open]')`,
    returnByValue: true
  });
  if (!activeResetBlocked.result.value) {
    throw new Error('Reset otworzył się podczas aktywnej walki.');
  }

  const pendingSetup = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      document.querySelector('[data-settings-close]').click();
      const runtime = window.__pieczargotchiRuntime;
      const qa = window.__pieczargotchiQa;
      const config = window.PIECZARGOTCHI_CONFIG;
      const persisted = qa && qa.resetExclusiveSession('qa');
      if (qa) {
        qa.beginStorageBusyProbe();
      }
      return {
        qaAvailable: Boolean(qa),
        persisted: persisted && persisted.ok,
        activeBattle: Boolean(runtime.state.battle.activeBattle),
        pending: Boolean(runtime.pendingExclusiveStart),
        stored: Boolean(localStorage.getItem(config.storageKey))
      };
    })()`,
    returnByValue: true
  });
  const pendingSetupInfo = pendingSetup.result.value || {};
  if (
    !pendingSetupInfo.qaAvailable
    || !pendingSetupInfo.persisted
    || pendingSetupInfo.activeBattle
    || pendingSetupInfo.pending
    || !pendingSetupInfo.stored
  ) {
    throw new Error(`Nie udało się przygotować realnego testu pending session: ${JSON.stringify(pendingSetupInfo)}`);
  }

  const pendingReset = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const runtime = window.__pieczargotchiRuntime;
      const config = window.PIECZARGOTCHI_CONFIG;
      document.querySelector('[data-battle-start]').click();
      const before = {
        state: JSON.stringify(runtime.state),
        revision: runtime.state.saveRevision,
        stored: localStorage.getItem(config.storageKey),
        saveCalls: window.__pieczargotchiQa.getPersistenceProbe().calls
      };
      document.querySelector('[data-settings-open]').click();
      const debugControl = document.querySelector('[data-debug-growth]');
      debugControl.value = String(Math.max(0, Number(debugControl.value) - 9));
      const debugAccepted = debugControl.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
      document.querySelector('[data-settings-dialog] [data-reset-open]').click();
      return {
        pending: runtime.pendingExclusiveStart && runtime.pendingExclusiveStart.kind,
        settingsOpen: Boolean(document.querySelector('[data-settings-dialog][open]')),
        resetOpen: Boolean(document.querySelector('[data-reset-dialog][open]')),
        activeBattle: Boolean(runtime.state.battle.activeBattle),
        debugAriaDisabled: debugControl.getAttribute('aria-disabled'),
        debugCancelled: !debugAccepted,
        stateSame: JSON.stringify(runtime.state) === before.state,
        revisionSame: runtime.state.saveRevision === before.revision,
        storedSame: localStorage.getItem(config.storageKey) === before.stored,
        saveCallsBeforeActions: before.saveCalls,
        saveCallsAfterActions: window.__pieczargotchiQa.getPersistenceProbe().calls
      };
    })()`,
    returnByValue: true
  });
  if (pendingReset.exceptionDetails) {
    throw new Error(`Pending reset probe zgłosił wyjątek: ${JSON.stringify(pendingReset.exceptionDetails)}`);
  }
  const pendingResetInfo = pendingReset.result.value || {};
  if (
    pendingResetInfo.pending !== 'battle'
    || !pendingResetInfo.settingsOpen
    || pendingResetInfo.resetOpen
    || pendingResetInfo.activeBattle
    || pendingResetInfo.debugAriaDisabled !== 'true'
    || !pendingResetInfo.debugCancelled
    || !pendingResetInfo.stateSame
    || !pendingResetInfo.revisionSame
    || !pendingResetInfo.storedSame
    || pendingResetInfo.saveCallsBeforeActions !== 1
    || pendingResetInfo.saveCallsAfterActions !== pendingResetInfo.saveCallsBeforeActions
  ) {
    throw new Error(`Reset nie został zablokowany podczas pending session: ${JSON.stringify(pendingResetInfo)}`);
  }

  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      document.querySelector('[data-settings-close]').click();
      window.__pieczargotchiQa.releaseStorageBusyProbe();
    })()`,
    returnByValue: true
  });
  await waitForExpression(
    cdp,
    `Boolean(window.__pieczargotchiRuntime.state.battle.activeBattle) && !window.__pieczargotchiRuntime.pendingExclusiveStart`,
    3000
  );
  const pendingRetry = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const result = {
        saveCalls: window.__pieczargotchiQa.getPersistenceProbe().calls,
        activeBattle: Boolean(window.__pieczargotchiRuntime.state.battle.activeBattle),
        pending: Boolean(window.__pieczargotchiRuntime.pendingExclusiveStart)
      };
      window.__pieczargotchiQa.clearPersistenceProbe();
      return result;
    })()`,
    returnByValue: true
  });
  const pendingRetryInfo = pendingRetry.result.value || {};
  if (
    pendingRetryInfo.saveCalls <= pendingResetInfo.saveCallsAfterActions
    || !pendingRetryInfo.activeBattle
    || pendingRetryInfo.pending
  ) {
    throw new Error(`Retry realnego pending session nie zakończył startu walki: ${JSON.stringify(pendingRetryInfo)}`);
  }

  console.log(`real-ui-flow: ${screenshotPath}`);
  console.log(`real-ui-flow launch: ${JSON.stringify({
    gate: gateInfo,
    countdown: countdownInfo,
    running: runningInfo,
    modal: modalInfo,
    blockedInput: minigameBlocked,
    refocused: refocusedInfo,
    debugGuard: activeDebugGuardInfo,
    pendingBattle: pendingResetInfo,
    battle: {
      viewMode: battleAfterInfo.viewMode,
      hydration: battleAfterInfo.hydration,
      cooldown: battleAfterInfo.cooldown,
      revision: battleAfterInfo.revision,
      activeBattle: battleAfterInfo.activeBattle,
      focusRestored: battleBeforeInfo.focusRestored
    }
  })}`);
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

async function captureInteractionSmoke(cdp) {
  const diagnostics = await cdp.send('Runtime.evaluate', {
    expression: `(async () => {
      const canvas = document.getElementById('mushroomCanvas');
      const runtime = window.__pieczargotchiRuntime;
      if (!canvas || !runtime) {
        return { ok: false, reason: 'missing-canvas-runtime' };
      }
      if (runtime.captureOriginalImmersionSelector && window.PieczargotchiCore) {
        window.PieczargotchiCore.selectImmersionReaction = runtime.captureOriginalImmersionSelector;
        runtime.captureOriginalImmersionSelector = null;
      }
      const rect = canvas.getBoundingClientRect();
      const toClient = (x, y) => ({
        x: rect.left + x / 512 * rect.width,
        y: rect.top + y / 512 * rect.height
      });
      const dispatchPointer = (type, x, y, pointerType = 'mouse', pointerId = 11) => {
        const point = toClient(x, y);
        canvas.dispatchEvent(new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          clientX: point.x,
          clientY: point.y,
          pointerId,
          pointerType
        }));
      };

      dispatchPointer('pointerenter', 210, 424, 'mouse', 21);
      [235, 265, 300, 336].forEach((x) => dispatchPointer('pointermove', x, 426, 'mouse', 21));
      const brushDistanceAfterBrush = runtime.input && runtime.input.grassBrushDistance;
      if (typeof requestRuntimeRender === 'function') {
        requestRuntimeRender();
      }
      const brushRenderDeadline = performance.now() + 750;
      const hasRenderedBrush = (ground, interactions) => {
        const field = ground && ground.field;
        const localKinds = field && Array.isArray(field.localReactionKinds) ? field.localReactionKinds : [];
        const drawnEffects = interactions && Array.isArray(interactions.drawnEffects) ? interactions.drawnEffects : [];
        const hasVisibleGrassEffect = drawnEffects.some((effect) => (
          ['grassRustle', 'grassFind', 'frogJump'].includes(String(effect.type))
          && Number(effect.alpha) > 0.02
        ));
        return Boolean(
          field
          && field.brushActive === true
          && localKinds.includes('brush')
          && Number(field.brushDistance) >= Math.round(Number(brushDistanceAfterBrush))
          && Number(field.brushY) >= 386
          && hasVisibleGrassEffect
        );
      };
      let groundAfterBrush = runtime.motionDiagnostics && runtime.motionDiagnostics.ground;
      let interactionsAfterBrush = runtime.motionDiagnostics && runtime.motionDiagnostics.interactions;
      while (
        !hasRenderedBrush(groundAfterBrush, interactionsAfterBrush)
        && performance.now() < brushRenderDeadline
      ) {
        await new Promise((resolve) => setTimeout(resolve, 16));
        groundAfterBrush = runtime.motionDiagnostics && runtime.motionDiagnostics.ground;
        interactionsAfterBrush = runtime.motionDiagnostics && runtime.motionDiagnostics.interactions;
      }

      const beforeSun = runtime.motionDiagnostics && runtime.motionDiagnostics.celestial && runtime.motionDiagnostics.celestial.sun;
      let sunTargetVisible = false;
      let sunMoodAfterOne = null;
      let sunMoodCountAfterOne = 0;
      let sunMoodAfterTwo = null;
      let sunMoodCountAfterTwo = 0;
      let sunMoodAfterThree = null;
      let sunMoodCountAfterThree = 0;
      let sunMoodAfterSix = null;
      let sunMoodCountAfterSix = 0;
      if (beforeSun && beforeSun.visibleForHit) {
        sunTargetVisible = true;
        const sx = beforeSun.centerX || beforeSun.x + beforeSun.size / 2;
        const sy = beforeSun.centerY || beforeSun.y + beforeSun.size / 2;
        for (let index = 0; index < 9; index += 1) {
          dispatchPointer('pointerdown', sx, sy, 'mouse', 31);
          dispatchPointer('pointerup', sx, sy, 'mouse', 31);
          if (index === 0) {
            sunMoodAfterOne = runtime.celestialMood && runtime.celestialMood.sun && runtime.celestialMood.sun.expression;
            sunMoodCountAfterOne = runtime.celestialMood && runtime.celestialMood.sun && runtime.celestialMood.sun.count;
          } else if (index === 1) {
            sunMoodAfterTwo = runtime.celestialMood && runtime.celestialMood.sun && runtime.celestialMood.sun.expression;
            sunMoodCountAfterTwo = runtime.celestialMood && runtime.celestialMood.sun && runtime.celestialMood.sun.count;
          } else if (index === 2) {
            sunMoodAfterThree = runtime.celestialMood && runtime.celestialMood.sun && runtime.celestialMood.sun.expression;
            sunMoodCountAfterThree = runtime.celestialMood && runtime.celestialMood.sun && runtime.celestialMood.sun.count;
          } else if (index === 5) {
            sunMoodAfterSix = runtime.celestialMood && runtime.celestialMood.sun && runtime.celestialMood.sun.expression;
            sunMoodCountAfterSix = runtime.celestialMood && runtime.celestialMood.sun && runtime.celestialMood.sun.count;
          }
        }
      }

      const activeEffects = runtime.worldInteractions && Array.isArray(runtime.worldInteractions.effects)
        ? runtime.worldInteractions.effects.map((effect) => effect.type)
        : [];
      return {
        ok: true,
        brushDistance: brushDistanceAfterBrush,
        lastTarget: runtime.input && runtime.input.lastDownTargetKind,
        activeEffects,
        sunTargetVisible,
        sunMoodAfterOne,
        sunMoodCountAfterOne,
        sunMoodAfterTwo,
        sunMoodCountAfterTwo,
        sunMoodAfterThree,
        sunMoodCountAfterThree,
        sunMoodAfterSix,
        sunMoodCountAfterSix,
        sunMood: runtime.celestialMood && runtime.celestialMood.sun && runtime.celestialMood.sun.expression,
        sunMoodCount: runtime.celestialMood && runtime.celestialMood.sun && runtime.celestialMood.sun.count,
        groundAfterBrush,
        interactionsAfterBrush,
        interactionDiagnostics: runtime.motionDiagnostics && runtime.motionDiagnostics.interactions,
        groundDiagnostics: runtime.motionDiagnostics && runtime.motionDiagnostics.ground,
        celestialDiagnostics: runtime.motionDiagnostics && runtime.motionDiagnostics.celestial
      };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  const info = diagnostics.result.value || {};
  if (!info.ok) {
    throw new Error(`Interaction capture failed to start: ${JSON.stringify(info)}`);
  }
  await delay(360);
  const after = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const runtime = window.__pieczargotchiRuntime || {};
      return {
        brushDistance: runtime.input && runtime.input.grassBrushDistance,
        activeEffects: runtime.worldInteractions && Array.isArray(runtime.worldInteractions.effects)
          ? runtime.worldInteractions.effects.map((effect) => effect.type)
          : [],
        sunMood: runtime.celestialMood && runtime.celestialMood.sun && runtime.celestialMood.sun.expression,
        sunMoodCount: runtime.celestialMood && runtime.celestialMood.sun && runtime.celestialMood.sun.count,
        interactions: runtime.motionDiagnostics && runtime.motionDiagnostics.interactions,
        ground: runtime.motionDiagnostics && runtime.motionDiagnostics.ground,
        celestial: runtime.motionDiagnostics && runtime.motionDiagnostics.celestial
      };
    })()`,
    returnByValue: true
  });
  const state = after.result.value || {};
  const brushDistance = Math.max(Number(info.brushDistance) || 0, Number(state.brushDistance) || 0);
  state.brushDistance = brushDistance;
  state.brushDistanceBeforeSkyClicks = Number(info.brushDistance) || 0;
  if (brushDistance < 80) {
    throw new Error(`Interaction capture did not accumulate brush distance: ${JSON.stringify({ before: info, after: state })}`);
  }
  const activeEffects = [
    ...(Array.isArray(info.activeEffects) ? info.activeEffects : []),
    ...(Array.isArray(state.activeEffects) ? state.activeEffects : [])
  ];
  if (!activeEffects.some((type) => String(type).includes('grass'))) {
    throw new Error(`Interaction capture did not create a grass effect: ${JSON.stringify(state)}`);
  }
  const groundField = (info.groundAfterBrush && info.groundAfterBrush.field) || {};
  const localKinds = Array.isArray(groundField.localReactionKinds) ? groundField.localReactionKinds : [];
  if (groundField.brushActive !== true || !localKinds.includes('brush') || Number(groundField.brushY) < 386) {
    throw new Error(`Interaction capture did not keep grass brushing as a natural field reaction: ${JSON.stringify({ before: info, after: state })}`);
  }
  const drawnEffects = [
    ...(
      info.interactionsAfterBrush && Array.isArray(info.interactionsAfterBrush.drawnEffects)
        ? info.interactionsAfterBrush.drawnEffects
        : []
    ),
    ...(
      state.interactions && Array.isArray(state.interactions.drawnEffects)
        ? state.interactions.drawnEffects
        : []
    )
  ];
  const drawnGrassFeedback = drawnEffects.filter((effect) => ['grassRustle', 'grassFind', 'frogJump'].includes(String(effect.type)));
  if (!drawnGrassFeedback.length) {
    throw new Error(`Interaction capture did not render visible grass feedback: ${JSON.stringify({ drawnEffects, state })}`);
  }
  if (!drawnGrassFeedback.some((effect) => Number(effect.alpha) > 0.02)) {
    throw new Error(`Interaction capture recorded grass feedback without visible alpha: ${JSON.stringify({ drawnEffects, state })}`);
  }
  state.sunTargetVisible = Boolean(info.sunTargetVisible);
  state.sunMoodAfterOne = info.sunMoodAfterOne;
  state.sunMoodCountAfterOne = info.sunMoodCountAfterOne;
  state.sunMoodAfterTwo = info.sunMoodAfterTwo;
  state.sunMoodCountAfterTwo = info.sunMoodCountAfterTwo;
  state.sunMoodAfterThree = info.sunMoodAfterThree;
  state.sunMoodCountAfterThree = info.sunMoodCountAfterThree;
  state.sunMoodAfterSix = info.sunMoodAfterSix;
  state.sunMoodCountAfterSix = info.sunMoodCountAfterSix;
  if (state.sunTargetVisible) {
    if (state.sunMoodAfterOne !== 'blink' || Number(state.sunMoodCountAfterOne) !== 1) {
      throw new Error(`Interaction capture did not acknowledge the first sun click: ${JSON.stringify(state)}`);
    }
    if (state.sunMoodAfterTwo !== 'blink' || Number(state.sunMoodCountAfterTwo) !== 2) {
      throw new Error(`Interaction capture did not keep the early sun response subtle: ${JSON.stringify(state)}`);
    }
    if (state.sunMoodAfterThree !== 'blink' || Number(state.sunMoodCountAfterThree) !== 3) {
      throw new Error(`Interaction capture did not start the sun reaction after several clicks: ${JSON.stringify(state)}`);
    }
    if (state.sunMoodAfterSix !== 'annoyed' || Number(state.sunMoodCountAfterSix) !== 6) {
      throw new Error(`Interaction capture did not ramp the sun reaction gradually: ${JSON.stringify(state)}`);
    }
    if (state.sunMood !== 'angry' || Number(state.sunMoodCount) < 9) {
      throw new Error(`Interaction capture did not escalate sun mood after a deliberate click streak: ${JSON.stringify(state)}`);
    }
  }
  const image = await cdp.send('Runtime.evaluate', {
    expression: `document.getElementById('mushroomCanvas').toDataURL('image/png')`,
    returnByValue: true
  });
  const png = Buffer.from(image.result.value.replace(/^data:image\/png;base64,/, ''), 'base64');
  const filePath = `${outputPrefix}-interactions.png`;
  writeFileSync(filePath, png);
  await delay(1700);
  const expired = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const runtime = window.__pieczargotchiRuntime || {};
      const effects = runtime.worldInteractions && Array.isArray(runtime.worldInteractions.effects)
        ? runtime.worldInteractions.effects.filter((effect) => ['grassRustle', 'grassFind', 'frogJump'].includes(effect.type))
        : [];
      const ground = runtime.motionDiagnostics && runtime.motionDiagnostics.ground && runtime.motionDiagnostics.ground.field;
      return { effectCount: effects.length, brushActive: Boolean(ground && ground.brushActive), brushAgeMs: ground && ground.brushAgeMs };
    })()`,
    returnByValue: true
  });
  const expiredState = expired.result.value || {};
  if (Number(expiredState.effectCount) !== 0 || expiredState.brushActive) {
    throw new Error(`Interaction capture did not expire grass feedback: ${JSON.stringify(expiredState)}`);
  }
  console.log(`interactions: ${filePath}`);
  console.log(`interactions diagnostics: ${JSON.stringify(state)}`);
}

async function captureTouchInteractionSmoke(cdp) {
  const setup = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const canvas = document.getElementById('mushroomCanvas');
      const runtime = window.__pieczargotchiRuntime || {};
      if (!canvas || !runtime.input) {
        return { ok: false };
      }
      const rect = canvas.getBoundingClientRect();
      runtime.input.grassBrushDistance = 0;
      runtime.input.grassBrushLastAt = 0;
      runtime.input.lastCancelAt = 0;
      runtime.input.lastUpAt = 0;
      if (runtime.worldInteractions) {
        runtime.worldInteractions.effects = [];
        runtime.worldInteractions.cooldowns = {};
      }
      return {
        ok: true,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      };
    })()`,
    returnByValue: true
  });
  const canvas = setup.result.value || {};
  if (!canvas.ok || canvas.width < 1 || canvas.height < 1) {
    throw new Error(`Mobilny touch probe nie znalazł sceny: ${JSON.stringify(canvas)}`);
  }

  const point = (sceneX, sceneY, id) => ({
    x: canvas.left + sceneX / 512 * canvas.width,
    y: canvas.top + sceneY / 512 * canvas.height,
    radiusX: 2,
    radiusY: 2,
    force: 1,
    id
  });
  const dragId = 71;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(190, 424, dragId)] });
  for (const sceneX of [230, 275, 325, 370]) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(sceneX, 426, dragId)] });
    await delay(18);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await delay(100);

  const drag = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const runtime = window.__pieczargotchiRuntime || {};
      return {
        pointerType: runtime.input && runtime.input.pointerType,
        isDown: runtime.input && runtime.input.isDown,
        pointerId: runtime.input && runtime.input.pointerId,
        brushDistance: runtime.input && runtime.input.grassBrushDistance,
        lastUpAt: runtime.input && runtime.input.lastUpAt,
        grassEffects: runtime.worldInteractions && Array.isArray(runtime.worldInteractions.effects)
          ? runtime.worldInteractions.effects.filter((effect) => String(effect.type).includes('grass')).length
          : 0
      };
    })()`,
    returnByValue: true
  });
  const dragInfo = drag.result.value || {};
  if (
    dragInfo.pointerType !== 'touch'
    || dragInfo.isDown
    || dragInfo.pointerId !== null
    || Number(dragInfo.brushDistance) < 72
    || Number(dragInfo.lastUpAt) <= 0
    || Number(dragInfo.grassEffects) < 1
  ) {
    throw new Error(`Prawdziwy mobilny gest touch nie uruchomił reakcji trawy: ${JSON.stringify(dragInfo)}`);
  }

  const cancelId = 72;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(210, 420, cancelId)] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(250, 422, cancelId)] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await delay(80);
  const cancel = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const input = window.__pieczargotchiRuntime && window.__pieczargotchiRuntime.input;
      return input ? {
        pointerType: input.pointerType,
        isDown: input.isDown,
        pointerId: input.pointerId,
        lastDragX: input.lastDragX,
        lastDragY: input.lastDragY,
        lastCancelAt: input.lastCancelAt
      } : null;
    })()`,
    returnByValue: true
  });
  const cancelInfo = cancel.result.value || {};
  if (
    cancelInfo.pointerType !== 'touch'
    || cancelInfo.isDown
    || cancelInfo.pointerId !== null
    || cancelInfo.lastDragX !== null
    || cancelInfo.lastDragY !== null
    || Number(cancelInfo.lastCancelAt) <= 0
  ) {
    throw new Error(`pointercancel nie wyczyścił mobilnego gestu: ${JSON.stringify(cancelInfo)}`);
  }
  console.log(`touch interactions diagnostics: ${JSON.stringify({ drag: dragInfo, cancel: cancelInfo })}`);
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

  const stateResult = await cdp.send('Runtime.evaluate', { expression: stateExpression, awaitPromise: true, returnByValue: true });
  if (stateResult.exceptionDetails) {
    throw new Error(`Nie udało się przygotować stanu areny: ${JSON.stringify(stateResult.exceptionDetails)}`);
  }
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
  await waitForExpression(cdp,
    'Boolean(window.PIECZARGOTCHI_CONFIG && window.PIECZARGOTCHI_CONFIG.state && window.PIECZARGOTCHI_CONFIG.state.defaultState)',
    3000
  );
  const stateExpression = `(() => {
    const config = window.PIECZARGOTCHI_CONFIG;
    const state = JSON.parse(JSON.stringify(config.state.defaultState));
    const iso = new Date(${now}).toISOString();
    const makeSnapshot = (id, stage, condition, dayPhase, extras = {}) => Object.assign({
      version: 1,
      capturedAt: iso,
      seed: 'capture:' + id + ':' + condition + ':' + dayPhase,
      stage,
      growth: stage === 'legendary' ? 100 : stage === 'adult' ? 70 : 38,
      mode: 'awake',
      mood: 'happy',
      activityType: '',
      reaction: id === 'aurora' ? 'awe' : 'curious',
      fallback: false,
      weather: {
        condition,
        dayPhase,
        dayTone: dayPhase,
        isDay: dayPhase !== 'night',
        humidity: condition === 'snow' ? 94 : 72,
        precipitation: condition === 'snow' ? 2 : condition === 'rain' ? 4 : 0,
        rain: condition === 'rain' ? 4 : 0,
        snowfall: condition === 'snow' ? 2 : 0,
        rainIntensity: condition === 'rain' ? 0.52 : 0,
        snowIntensity: condition === 'snow' ? 0.58 : 0,
        stormIntensity: 0,
        windLevel: 0.18,
        cloudCover: condition === 'snow' ? 72 : 30,
        cloudCoverLow: condition === 'snow' ? 64 : 22,
        cloudCoverMid: condition === 'snow' ? 56 : 24,
        cloudCoverHigh: dayPhase === 'night' ? 20 : 32,
        surfaceWetness: condition === 'rain' ? 0.7 : 0,
        frostRisk: condition === 'snow' ? 0.85 : 0,
        fogPotential: 0
      },
      sky: { discoveryId: id === 'aurora' ? id : '', kind: '', activeIds: id === 'aurora' ? [id] : [] },
      environment: { discoveryId: ['dew', 'frost'].includes(id) ? id : '', discoveries: ['dew', 'frost'].includes(id) ? [id] : [] },
      calendar: { eventId: ['teaDay', 'worldBeeDay', 'biodiversityDay', 'soilDay', 'spaceWeek'].includes(id) ? id : '', activeIds: [] },
      world: { frameTier: 'dew', decorations: ['dewStone', 'sporeLantern'], patchQuality: 86, mycelium: 12, careStreak: 3 }
    }, extras);
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
          count: 3,
          photoSnapshot: makeSnapshot('aurora', 'juvenile', 'snow', 'night')
        }
      },
      environment: {
        dew: {
          id: 'dew',
          label: 'Rosa na trawie',
          firstSeenAt: '2026-05-21T04:30:00.000Z',
          lastSeenAt: iso,
          count: 2,
          photoSnapshot: makeSnapshot('dew', 'sprout', 'clear', 'morning')
        }
      },
      instruments: {
        rareInstrument_spore: {
          id: 'rareInstrument_spore',
          label: 'Gwiezdny zarodkofon',
          stage: 'spore',
          firstSeenAt: '2026-05-17T20:30:00.000Z',
          lastSeenAt: iso,
          count: 1,
          photoSnapshot: makeSnapshot('rareInstrument_spore', 'spore', 'clear', 'dawn')
        },
        rareInstrument_baby: {
          id: 'rareInstrument_baby',
          label: 'Księżycowa okaryna',
          stage: 'baby',
          firstSeenAt: '2026-05-18T20:30:00.000Z',
          lastSeenAt: iso,
          count: 1,
          photoSnapshot: makeSnapshot('rareInstrument_baby', 'baby', 'clear', 'morning')
        },
        rareInstrument_young: {
          id: 'rareInstrument_young',
          label: 'Świetlikowa lira',
          stage: 'young',
          firstSeenAt: '2026-05-19T20:30:00.000Z',
          lastSeenAt: iso,
          count: 1,
          photoSnapshot: makeSnapshot('rareInstrument_young', 'young', 'clear', 'dusk')
        },
        rareInstrument_adult: {
          id: 'rareInstrument_adult',
          label: 'Kometowa harfa',
          stage: 'adult',
          firstSeenAt: '2026-05-20T20:30:00.000Z',
          lastSeenAt: iso,
          count: 1,
          photoSnapshot: makeSnapshot('rareInstrument_adult', 'adult', 'clear', 'dusk')
        },
        rareInstrument_legendary: {
          id: 'rareInstrument_legendary',
          label: 'Zorzo-organki',
          stage: 'legendary',
          firstSeenAt: '2026-05-21T20:30:00.000Z',
          lastSeenAt: iso,
          count: 1,
          photoSnapshot: makeSnapshot('rareInstrument_legendary', 'legendary', 'clear', 'night')
        }
      },
      calendar: {
        teaDay: {
          id: 'teaDay',
          label: 'Międzynarodowy Dzień Herbaty',
          firstSeenAt: '2026-05-21T08:00:00.000Z',
          lastSeenAt: iso,
          lastSeenDateKey: '2026-05-21',
          count: 1,
          photoSnapshot: makeSnapshot('teaDay', 'adult', 'clear', 'day')
        },
        worldBeeDay: {
          id: 'worldBeeDay',
          label: 'Światowy Dzień Pszczół',
          firstSeenAt: '2026-05-20T08:00:00.000Z',
          lastSeenAt: iso,
          lastSeenDateKey: '2026-05-20',
          count: 1,
          photoSnapshot: makeSnapshot('worldBeeDay', 'adult', 'clear', 'day')
        },
        biodiversityDay: {
          id: 'biodiversityDay',
          label: 'Międzynarodowy Dzień Bioróżnorodności',
          firstSeenAt: '2026-05-22T08:00:00.000Z',
          lastSeenAt: iso,
          lastSeenDateKey: '2026-05-22',
          count: 1,
          photoSnapshot: makeSnapshot('biodiversityDay', 'adult', 'clear', 'day')
        },
        soilDay: {
          id: 'soilDay',
          label: 'Światowy Dzień Gleby',
          firstSeenAt: '2026-12-05T08:00:00.000Z',
          lastSeenAt: iso,
          lastSeenDateKey: '2026-12-05',
          count: 1,
          photoSnapshot: makeSnapshot('soilDay', 'adult', 'snow', 'day')
        },
        spaceWeek: {
          id: 'spaceWeek',
          label: 'Światowy Tydzień Kosmosu',
          firstSeenAt: '2026-10-04T20:00:00.000Z',
          lastSeenAt: iso,
          lastSeenDateKey: '2026-10-04',
          count: 1,
          photoSnapshot: makeSnapshot('spaceWeek', 'adult', 'clear', 'night')
        }
      }
    };
    state.journal = { entries: [] };
    localStorage.setItem(config.storageKey, JSON.stringify(state));
    return {
      storageKey: config.storageKey,
      state: JSON.parse(localStorage.getItem(config.storageKey))
    };
  })()`;

  const stateResult = await cdp.send('Runtime.evaluate', { expression: stateExpression, awaitPromise: true, returnByValue: true });
  if (stateResult.exceptionDetails) {
    throw new Error(`Nie udało się przygotować stanu dziennika: ${JSON.stringify(stateResult.exceptionDetails)}`);
  }
  const preparedEnvelope = stateResult.result && stateResult.result.value ? stateResult.result.value : null;
  const preparedState = preparedEnvelope && preparedEnvelope.state ? preparedEnvelope.state : null;
  if (!preparedState || preparedState.mushroomName !== 'Auditka') {
    throw new Error(`Nie udało się zapisać fixture dziennika: ${JSON.stringify(preparedState)}`);
  }
  const preparedStorageKey = preparedEnvelope.storageKey || 'pieczargotchi_state_v2';
  const preloadScript = await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `try { localStorage.setItem(${JSON.stringify(preparedStorageKey)}, ${JSON.stringify(JSON.stringify(preparedState))}); } catch (error) {}`
  });
  await waitForLoad(cdp, () => cdp.send('Page.reload', { ignoreCache: true }));
  if (preloadScript && preloadScript.identifier) {
    await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: preloadScript.identifier }).catch(() => {});
  }
  await waitForExpression(cdp, getAssetStatusReadyExpression(), 6000);
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const tab = document.querySelector('[data-workspace-tab="mycelium"]');
      if (tab && tab.getAttribute('aria-selected') !== 'true') {
        tab.click();
      }
      return Boolean(tab);
    })()`,
    returnByValue: true
  });
  await waitForExpression(cdp, `Boolean(document.querySelector('[data-discovery-id="${captureJournalDiscoveryId}"][data-discovered="true"]'))`, 3000);
  await waitForExpression(cdp, `(() => {
    const panel = document.querySelector('.panel-block--discoveries');
    return Boolean(panel && panel.getClientRects().length && panel.getBoundingClientRect().width > 0);
  })()`, 3000);
  const lazyAlbumDiagnostics = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const canvases = Array.from(document.querySelectorAll('[data-discovered="true"] [data-journal-thumbnail]'));
      const queued = canvases.filter((canvas) => canvas.getAttribute('data-photo-state') === 'queued');
      return {
        count: canvases.length,
        queued: queued.length,
        tinyQueued: queued.filter((canvas) => canvas.width === 1 && canvas.height === 1).length
      };
    })()`,
    returnByValue: true
  });
  const lazyAlbumInfo = lazyAlbumDiagnostics.result.value || {};
  if (
    Number(lazyAlbumInfo.count) > 4
    && (!Number(lazyAlbumInfo.queued) || Number(lazyAlbumInfo.tinyQueued) !== Number(lazyAlbumInfo.queued))
  ) {
    throw new Error(`Album uruchomił pozaekranowe canvasy przedwcześnie: ${JSON.stringify(lazyAlbumInfo)}`);
  }
  if (!blockedAssetPatterns.length) {
    await cdp.send('Runtime.evaluate', {
      expression: `(async () => {
        const canvases = Array.from(document.querySelectorAll('[data-discovered="true"] [data-journal-thumbnail]'));
        const panel = document.querySelector('.panel-block--discoveries');
        const deadline = Date.now() + 12000;
        while (Date.now() < deadline) {
          const pending = canvases.find((canvas) => {
            const state = canvas.getAttribute('data-photo-state');
            return state === 'queued' || state === 'loading';
          });
          if (!pending) {
            break;
          }
          pending.scrollIntoView({ block: 'center', inline: 'nearest' });
          await new Promise((resolve) => setTimeout(resolve, 60));
        }
        if (panel) {
          panel.scrollIntoView({ block: 'center', inline: 'nearest' });
        }
        return canvases.map((canvas) => canvas.getAttribute('data-photo-state'));
      })()`,
      awaitPromise: true,
      returnByValue: true
    });
    await waitForExpression(cdp, `(() => {
      const canvases = Array.from(document.querySelectorAll('[data-discovered="true"] [data-journal-thumbnail]'));
      return canvases.length > 0 && canvases.every((canvas) => {
        const state = canvas.getAttribute('data-photo-state');
        return state !== 'queued' && state !== 'loading';
      });
    })()`, 12000);
  }
  const albumDiagnostics = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const panel = document.querySelector('.panel-block--discoveries');
      const canvases = Array.from(document.querySelectorAll('[data-discovered="true"] [data-journal-thumbnail]'));
      if (panel) {
        panel.scrollIntoView({ block: 'center', inline: 'nearest' });
      }
      const hashes = canvases.map((canvas) => {
        const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        let hash = 2166136261;
        for (let index = 0; index < pixels.length; index += 64) {
          hash ^= pixels[index] + pixels[index + 1] * 3 + pixels[index + 2] * 7 + pixels[index + 3] * 11;
          hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
      });
      const instrumentHashes = canvases.map((canvas, index) => ({
        id: canvas.getAttribute('data-discovery-id') || '',
        hash: hashes[index]
      })).filter((entry) => entry.id.startsWith('rareInstrument_'));
      const panelRect = panel ? panel.getBoundingClientRect() : null;
      return {
        count: canvases.length,
        ready: canvases.filter((canvas) => canvas.getAttribute('data-photo-ready') === 'true').length,
        subjects: canvases.filter((canvas) => canvas.getAttribute('data-subject-rendered') === 'true').length,
        uniqueHashes: new Set(hashes).size,
        instrumentCount: instrumentHashes.length,
        uniqueInstrumentHashes: new Set(instrumentHashes.map((entry) => entry.hash)).size,
        scenes: canvases.map((canvas) => canvas.getAttribute('data-scene-id')),
        panelRect: panelRect ? {
          x: panelRect.left + scrollX,
          y: panelRect.top + scrollY,
          width: panelRect.width,
          height: panelRect.height
        } : null
      };
    })()`,
    returnByValue: true
  });
  const albumInfo = albumDiagnostics.result.value || {};
  if (
    !albumInfo.count
    || (!blockedAssetPatterns.length && (albumInfo.ready !== albumInfo.count || albumInfo.subjects !== albumInfo.count))
    || Number(albumInfo.uniqueHashes) < Math.min(3, Number(albumInfo.count) || 0)
    || (Number(albumInfo.instrumentCount) >= 5 && Number(albumInfo.uniqueInstrumentHashes) !== Number(albumInfo.instrumentCount))
  ) {
    throw new Error(`Album pamiątek nie wyrenderował prawdziwych, zróżnicowanych miniatur: ${JSON.stringify(albumInfo)}`);
  }
  const albumScreenshot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: true,
    ...(albumInfo.panelRect ? {
      clip: {
        x: Math.max(0, albumInfo.panelRect.x),
        y: Math.max(0, albumInfo.panelRect.y),
        width: Math.max(1, albumInfo.panelRect.width),
        height: Math.max(1, albumInfo.panelRect.height),
        scale: 1
      }
    } : {})
  });
  const albumPath = `${outputPrefix}-journal-album-${viewportWidth}x${viewportHeight}.png`;
  writeFileSync(albumPath, Buffer.from(albumScreenshot.data, 'base64'));
  console.log(`journal-album: ${albumPath}`);
  const diagnostics = await cdp.send('Runtime.evaluate', {
    expression: `(async () => {
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
      const deadline = Date.now() + 6000;
      while (canvas.getAttribute('data-photo-state') === 'loading' && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
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
      const closeRect = rectInfo(document.querySelector('[data-journal-polaroid-close]'));
      const viewport = { width: innerWidth, height: innerHeight };
      const runtime = window.__pieczargotchiRuntime || {};
      const state = runtime.state || {};
      const groupId = button.getAttribute('data-discovery-group');
      const discoveryId = button.getAttribute('data-discovery-id');
      const stateGroupId = groupId === 'instrument' ? 'instruments' : groupId;
      const snapshot = state.discoveries && state.discoveries[stateGroupId] && state.discoveries[stateGroupId][discoveryId]
        ? state.discoveries[stateGroupId][discoveryId].photoSnapshot
        : null;
      const expectedFrameTier = snapshot && snapshot.world && snapshot.world.frameTier ? snapshot.world.frameTier : '';
      const transform = getComputedStyle(polaroid).transform;
      const transformMatrix = transform && transform !== 'none' ? new DOMMatrixReadOnly(transform) : null;
      const sheet = polaroid.querySelector('.journal-polaroid__sheet');
      const scrollContainers = [polaroid].concat(Array.from(polaroid.querySelectorAll('*'))).filter((node) => {
        const style = getComputedStyle(node);
        return /(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1;
      });
      return {
        ok: true,
        tooltipVisible,
        polaroidVisible: !polaroid.hidden,
        title: document.querySelector('[data-journal-polaroid-title]').textContent,
        nonBlank,
        currentStage: state.stage,
        snapshotStage: snapshot && snapshot.stage,
        snapshotCondition: snapshot && snapshot.weather && snapshot.weather.condition,
        snapshotFallback: polaroid.getAttribute('data-snapshot-fallback'),
        expectedFrameTier,
        frameTier: polaroid.getAttribute('data-frame-tier'),
        polaroidTilted: Boolean(transformMatrix && (Math.abs(transformMatrix.b) > 0.001 || Math.abs(transformMatrix.c) > 0.001)),
        photoReady: canvas.getAttribute('data-photo-ready'),
        photoState: canvas.getAttribute('data-photo-state'),
        subjectRendered: canvas.getAttribute('data-subject-rendered'),
        grassRendered: canvas.getAttribute('data-grass-rendered'),
        grassRaster: canvas.getAttribute('data-grass-raster'),
        polaroidRect,
        canvasRect,
        closeRect,
        viewport,
        closeOverlapsCanvas: !(closeRect.right <= canvasRect.left
          || closeRect.left >= canvasRect.right
          || closeRect.bottom <= canvasRect.top
          || closeRect.top >= canvasRect.bottom),
        scrollContainers: scrollContainers.length,
        invalidScrollContainer: scrollContainers.some((node) => node !== sheet),
        polaroidInViewport: polaroidRect.left >= -1
          && polaroidRect.top >= -1
          && polaroidRect.right <= innerWidth + 1
          && polaroidRect.bottom <= innerHeight + 1,
        canvasVisible: canvasRect.width >= 120 && canvasRect.height >= 120,
        canvasSquare: Math.abs(canvas.width - canvas.height) <= 1 && Math.abs(canvasRect.width - canvasRect.height) <= 2
      };
    })()`,
    returnByValue: true,
    awaitPromise: true
  });
  const info = diagnostics.result.value || {};
  if (
    !info.ok
    || !info.tooltipVisible
    || !info.polaroidVisible
    || !info.title
    || info.nonBlank < 1000
    || !info.snapshotStage
    || info.snapshotFallback !== 'false'
    || (info.expectedFrameTier && info.frameTier !== info.expectedFrameTier)
    || info.polaroidTilted
    || info.photoReady !== 'true'
    || info.photoState !== 'ready'
    || info.subjectRendered !== 'true'
    || info.grassRendered !== 'true'
    || info.grassRaster !== 'true'
    || info.closeOverlapsCanvas
    || info.scrollContainers > 1
    || info.invalidScrollContainer
    || !info.canvasSquare
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
  console.log(`journal diagnostics: title=${info.title}, canvasPixels=${info.nonBlank}, tooltip=${info.tooltipVisible}, polaroid=${Math.round(info.polaroidRect.width)}x${Math.round(info.polaroidRect.height)}, snapshot=${info.snapshotStage}/${info.snapshotCondition}, frame=${info.frameTier}`);
}

async function captureDewMinigame(cdp) {
  const now = Date.now();
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
    state.stage = 'adult';
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
    return {
      storageKey: config.storageKey,
      state
    };
  })()`;

  const stateResult = await cdp.send('Runtime.evaluate', {
    expression: stateExpression,
    awaitPromise: true,
    returnByValue: true
  });
  if (stateResult.exceptionDetails) {
    throw new Error(`Nie udało się przygotować stanu minigry Łapanie rosy: ${JSON.stringify(stateResult.exceptionDetails)}`);
  }
  const preparedEnvelope = stateResult.result && stateResult.result.value ? stateResult.result.value : null;
  const preparedState = preparedEnvelope && preparedEnvelope.state ? preparedEnvelope.state : null;
  const preparedStorageKey = preparedEnvelope && preparedEnvelope.storageKey
    ? preparedEnvelope.storageKey
    : 'pieczargotchi_state_v2';
  if (!preparedState || !preparedState.minigames || !preparedState.minigames.active) {
    throw new Error(`Nie udało się przygotować fixture minigry Łapanie rosy: ${JSON.stringify(preparedEnvelope)}`);
  }
  const preloadScript = await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `try {
      localStorage.setItem(${JSON.stringify(preparedStorageKey)}, ${JSON.stringify(JSON.stringify(preparedState))});
      localStorage.removeItem(${JSON.stringify(preparedStorageKey + '_debug')});
    } catch (error) {}`
  });
  await waitForLoad(cdp, () => cdp.send('Page.reload', { ignoreCache: true }));
  if (preloadScript && preloadScript.identifier) {
    await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: preloadScript.identifier }).catch(() => {});
  }
  await waitForExpression(cdp, `Boolean(window.__pieczargotchiRuntime && window.__pieczargotchiRuntime.booted && window.__pieczargotchiRuntime.minigame && window.__pieczargotchiRuntime.minigame.session && window.__pieczargotchiRuntime.minigame.session.id === 'dewCatch')`, 6000);
  await delay(Math.max(captureDelayMs, 650));
  const dewKeyboard = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const runtime = window.__pieczargotchiRuntime || {};
      const bucket = runtime.minigame && runtime.minigame.bucket;
      const before = bucket && bucket.targetX;
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
      return { before, after: bucket && bucket.targetX };
    })()`,
    returnByValue: true
  });
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
  const keyboard = dewKeyboard.result.value || {};
  if (!(Number(keyboard.after) > Number(keyboard.before))) {
    throw new Error(`Dew minigame keyboard input did not move the bucket: ${JSON.stringify(keyboard)}`);
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
  if (captureMinigamePanelScreens) {
    await captureMinigamePanel(cdp, {
      id: 'dewCatch',
      fileLabel: 'dew-catch',
      label: 'Łapanie rosy',
      canvasSelector: '[data-dew-catch-canvas]'
    });
    await assertMinigameCompletionFocus(cdp, {
      id: 'dewCatch',
      label: 'Łapanie rosy'
    });
  }
}

async function captureConfiguredMinigame(cdp, sample) {
  const now = Date.now();
  const configuredOffset = Number.isFinite(Number(sample.startedOffsetMs))
    ? Number(sample.startedOffsetMs)
    : 3600;
  const startedAt = now - configuredOffset;
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
    state.stats.growth = ${Number(sample.growth) || 70};
    state.stage = state.stats.growth >= 100 ? 'legendary' : 'adult';
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
      until: ${startedAt} + (Number(config.rules.minigames[${JSON.stringify(sample.id)}].durationMs) || ${Number(sample.durationMs) || 19600}),
      score: 0,
      caught: [],
      missed: [],
      mistakes: 0,
      nextBeat: 0,
      habitatTags: ${JSON.stringify(sample.habitatTags || {})}
    };
    return {
      storageKey: config.storageKey,
      state
    };
  })()`;

  const stateResult = await cdp.send('Runtime.evaluate', {
    expression: stateExpression,
    awaitPromise: true,
    returnByValue: true
  });
  if (stateResult.exceptionDetails) {
    throw new Error(`Nie udało się przygotować stanu minigry ${sample.label}: ${JSON.stringify(stateResult.exceptionDetails)}`);
  }
  const preparedEnvelope = stateResult.result && stateResult.result.value ? stateResult.result.value : null;
  const preparedState = preparedEnvelope && preparedEnvelope.state ? preparedEnvelope.state : null;
  const preparedStorageKey = preparedEnvelope && preparedEnvelope.storageKey
    ? preparedEnvelope.storageKey
    : 'pieczargotchi_state_v2';
  if (!preparedState || !preparedState.minigames || !preparedState.minigames.active) {
    throw new Error(`Nie udało się przygotować fixture minigry ${sample.label}: ${JSON.stringify(preparedEnvelope)}`);
  }
  const preloadScript = await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `try {
      localStorage.setItem(${JSON.stringify(preparedStorageKey)}, ${JSON.stringify(JSON.stringify(preparedState))});
      localStorage.removeItem(${JSON.stringify(preparedStorageKey + '_debug')});
    } catch (error) {}`
  });
  await waitForLoad(cdp, () => cdp.send('Page.reload', { ignoreCache: true }));
  if (preloadScript && preloadScript.identifier) {
    await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: preloadScript.identifier }).catch(() => {});
  }
  await waitForExpression(cdp, `Boolean(window.__pieczargotchiRuntime && window.__pieczargotchiRuntime.booted && window.__pieczargotchiRuntime.minigame && window.__pieczargotchiRuntime.minigame.session && window.__pieczargotchiRuntime.minigame.session.id === ${JSON.stringify(sample.id)})`, 6000);
  if (sample.viewArena) {
    await cdp.send('Runtime.evaluate', {
      expression: `document.querySelector('[data-view-arena]') && document.querySelector('[data-view-arena]').click()`,
      awaitPromise: true
    });
    await waitForExpression(cdp, `!document.querySelector('[data-arena-panel]').hidden`, 2000);
  }
  await delay(Math.max(captureDelayMs, 650));
  const interaction = await performConfiguredMinigameInteraction(cdp, sample);
  if (interaction && Number.isFinite(Number(interaction.waitMs))) {
    await delay(Math.max(40, Math.min(3000, Number(interaction.waitMs) || 0)));
    await performConfiguredMinigameInteraction(cdp, Object.assign({}, sample, { fireInteractionNow: true }));
    await delay(120);
  } else if (interaction && interaction.applied) {
    await delay(120);
  }
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
        targets: Array.isArray(minigame.targets) ? minigame.targets.length : 0,
        pattern: Array.isArray(minigame.pattern) ? minigame.pattern.length : 0,
        chart: Array.isArray(minigame.chart) ? minigame.chart.length : 0,
        judgments: minigame.session && Array.isArray(minigame.session.rhythmJudgments)
          ? minigame.session.rhythmJudgments.filter(Boolean).length
          : 0,
        combo: minigame.session && minigame.session.combo,
        mistakes: minigame.session && minigame.session.mistakes,
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
  if (Number(sample.interactionMinScore) && Number(info.score) < Number(sample.interactionMinScore)) {
    throw new Error(`${sample.label} scripted input did not score: ${JSON.stringify(info)}`);
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
  if (captureMinigamePanelScreens) {
    await captureMinigamePanel(cdp, sample);
    await assertMinigameCompletionFocus(cdp, sample);
  }
}

async function performConfiguredMinigameInteraction(cdp, sample) {
  if (sample.id === 'sporePop') {
    const result = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const canvas = document.querySelector(${JSON.stringify(sample.canvasSelector)});
        const runtime = window.__pieczargotchiRuntime || {};
        const minigame = runtime.minigame || {};
        const session = minigame.session || {};
        const caught = Array.isArray(session.caught) ? session.caught : [];
        const progress = (Date.now() - Number(session.startedAt)) / Math.max(1, Number(session.until) - Number(session.startedAt));
        const spore = Array.isArray(minigame.spores) ? minigame.spores.find((item) => {
          if (caught.indexOf(item.id) !== -1) {
            return false;
          }
          const raw = (progress - item.start) / Math.max(0.1, item.speed);
          return raw >= 0 && raw <= 1;
        }) : null;
        if (!canvas || !spore) {
          return { applied: false };
        }
        canvas.focus({ preventScroll: true });
        const raw = (progress - spore.start) / Math.max(0.1, spore.speed);
        const local = Math.max(0, Math.min(1, raw));
        const pulse = Math.sin(local * Math.PI * 2 + spore.phase);
        const x = Math.round(Math.max(10, Math.min(canvas.width - 10, spore.x + spore.driftX * local + pulse * 4)));
        const y = Math.round(Math.max(10, Math.min(canvas.height - 18, spore.y + spore.driftY * local + Math.cos(local * 5 + spore.phase) * 5)));
        if (raw < 0 || raw > 1) {
          return { applied: false, raw };
        }
        const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
        const canceled = !window.dispatchEvent(event);
        return { applied: true, score: session.score, target: spore.id, input: 'keyboard', canceled };
      })()`,
      returnByValue: true
    });
    return result.result.value || null;
  }

  if (sample.id === 'compostSort') {
    const result = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const canvas = document.querySelector(${JSON.stringify(sample.canvasSelector)});
        const runtime = window.__pieczargotchiRuntime || {};
        const minigame = runtime.minigame || {};
        const session = minigame.session || {};
        const caught = Array.isArray(session.caught) ? session.caught : [];
        const progress = (Date.now() - Number(session.startedAt)) / Math.max(1, Number(session.until) - Number(session.startedAt));
        const piece = Array.isArray(minigame.pieces) ? minigame.pieces.find((item) => {
          if (caught.indexOf(item.id) !== -1) {
            return false;
          }
          const local = (progress - item.start) / Math.max(0.1, item.speed);
          return local >= 0 && local <= 1.08;
        }) : null;
        if (!canvas || !piece) {
          return { applied: false };
        }
        canvas.focus({ preventScroll: true });
        const local = (progress - piece.start) / Math.max(0.1, piece.speed);
        const eased = Math.max(0, Math.min(1, local));
        if (local < 0 || local > 1.08) {
          return { applied: false, local };
        }
        const x = Math.round(Math.max(12, Math.min(canvas.width - 12, piece.x + Math.sin(local * 5 + piece.variant) * 9)));
        const y = Math.round(22 + piece.lane * 30 + eased * 38);
        const key = piece.good ? 'c' : 'r';
        minigame.keyboardPieceId = piece.id;
        const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
        const canceled = !window.dispatchEvent(event);
        return { applied: true, score: session.score, target: piece.id, good: piece.good, input: 'keyboard', key, canceled };
      })()`,
      returnByValue: true
    });
    return result.result.value || null;
  }

  if (['sporeTrail', 'myceliumLeague', 'memoryGarden'].includes(sample.id)) {
    const result = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const canvas = document.querySelector(${JSON.stringify(sample.canvasSelector)});
        const runtime = window.__pieczargotchiRuntime || {};
        const minigame = runtime.minigame || {};
        const session = minigame.session || {};
        const caught = Array.isArray(session.caught) ? session.caught : [];
        const now = Date.now();
        const sampleId = ${JSON.stringify(sample.id)};
        const target = Array.isArray(minigame.targets)
          ? sampleId === 'memoryGarden'
            ? minigame.targets.find((item) => Number(item.roundIndex) === Number(session.metrics && session.metrics.roundIndex)
              && Number(item.stepIndex) === Number(session.metrics && session.metrics.recallIndex))
            : minigame.targets.find((item) => caught.indexOf(item.id) === -1 && now >= Number(item.appearsAt) && now <= Number(item.expiresAt))
          : null;
        if (!canvas || !target) {
          return { applied: false };
        }
        canvas.focus({ preventScroll: true });
        const key = sampleId === 'myceliumLeague'
          ? target.lane === 'strike' ? 'c' : target.lane === 'guard' ? 'o' : 's'
          : sampleId === 'memoryGarden'
            ? String(Number(target.cellIndex) + 1)
          : 'Enter';
        const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
        const canceled = !window.dispatchEvent(event);
        return { applied: true, score: session.score, target: target.id, input: 'keyboard', key, canceled };
      })()`,
      returnByValue: true
    });
    return result.result.value || null;
  }

  if (sample.id === 'rhythmHum') {
    if (!sample.fireInteractionNow) {
      const target = await cdp.send('Runtime.evaluate', {
        expression: `(() => {
          const runtime = window.__pieczargotchiRuntime || {};
          const minigame = runtime.minigame || {};
          const chart = Array.isArray(minigame.chart) ? minigame.chart : [];
          const judgments = minigame.session && Array.isArray(minigame.session.rhythmJudgments)
            ? minigame.session.rhythmJudgments
            : [];
          const now = Date.now();
          const note = chart.find((item, index) => !judgments[index] && Number(item.hitAt) > now + 40)
            || chart.find((item, index) => !judgments[index]);
          return note ? { waitMs: Math.max(0, Number(note.hitAt) - now), key: note.key } : null;
        })()`,
        returnByValue: true
      });
      return target.result.value || null;
    }
    const result = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const runtime = window.__pieczargotchiRuntime || {};
        const minigame = runtime.minigame || {};
        const chart = Array.isArray(minigame.chart) ? minigame.chart : [];
        const judgments = minigame.session && Array.isArray(minigame.session.rhythmJudgments)
          ? minigame.session.rhythmJudgments
          : [];
        const now = Date.now();
        const note = chart.find((item, index) => !judgments[index] && Math.abs(Number(item.hitAt) - now) <= 280)
          || chart.find((item, index) => !judgments[index]);
        if (!note) {
          return { applied: false };
        }
        let canceled = false;
        if (${JSON.stringify(sample.rhythmInputMode || 'keyboard')} === 'touch') {
          const canvas = document.querySelector(${JSON.stringify(sample.canvasSelector)});
          const rect = canvas.getBoundingClientRect();
          const laneIds = ['left', 'down', 'up', 'right'];
          const index = Math.max(0, laneIds.indexOf(note.lane));
          const available = Math.max(180, canvas.width - 26);
          const laneWidth = Math.floor(available / laneIds.length);
          const startX = Math.round((canvas.width - laneWidth * laneIds.length) / 2);
          const x = Math.round(startX + laneWidth * index + laneWidth / 2);
          const y = canvas.height - 30;
          canvas.dispatchEvent(new PointerEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            clientX: rect.left + x / canvas.width * rect.width,
            clientY: rect.top + y / canvas.height * rect.height,
            pointerId: 1,
            pointerType: 'touch'
          }));
          canceled = true;
        } else {
          const event = new KeyboardEvent('keydown', { key: note.key, bubbles: true, cancelable: true });
          canceled = !window.dispatchEvent(event);
        }
        return {
          applied: true,
          key: note.key,
          canceled,
          score: minigame.session && minigame.session.score,
          judgments: minigame.session && minigame.session.rhythmJudgments
            ? minigame.session.rhythmJudgments.filter(Boolean).length
            : 0
        };
      })()`,
      returnByValue: true
    });
    return result.result.value || null;
  }

  return null;
}

async function captureMinigamePanel(cdp, sample) {
  await delay(Math.max(160, captureDelayMs));
  const legendary = Boolean(sample.viewArena);
  const surfaceSelector = legendary ? '[data-legendary-game-playfield]' : '[data-minigame-playfield]';
  const panelSelector = legendary ? '[data-legendary-games]' : '.panel-block--minigames';
  const hudSelector = legendary ? '.legendary-game-hud' : '.minigame-hud';
  const scoreSelector = legendary ? '[data-legendary-minigame-score]' : '[data-minigame-score]';
  const timeSelector = legendary ? '[data-legendary-minigame-time]' : '[data-minigame-time]';
  const comboSelector = legendary ? '[data-legendary-minigame-combo]' : '[data-minigame-combo]';
  const endSelector = legendary ? '[data-legendary-minigame-end]' : '[data-minigame-end]';
  const progressSelector = legendary ? '[data-legendary-minigame-progress]' : '[data-minigame-progress]';
  const diagnostics = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const epsilon = 1;
      const surface = document.querySelector(${JSON.stringify(surfaceSelector)});
      const panel = document.querySelector(${JSON.stringify(panelSelector)});
      const sidePanel = surface && surface.closest('.side-panel');
      const sideRect = sidePanel && sidePanel.getBoundingClientRect();
      const sideBounds = sideRect ? {
        top: Math.max(0, sideRect.top + sidePanel.clientTop),
        left: Math.max(0, sideRect.left + sidePanel.clientLeft),
        right: Math.min(innerWidth, sideRect.right - sidePanel.clientLeft),
        bottom: Math.min(innerHeight, sideRect.bottom - sidePanel.clientTop)
      } : { top: 0, left: 0, right: innerWidth, bottom: innerHeight };
      const fullyWithin = (rect, bounds) => Boolean(
        rect
        && rect.width > 0
        && rect.height > 0
        && rect.top >= bounds.top - epsilon
        && rect.left >= bounds.left - epsilon
        && rect.right <= bounds.right + epsilon
        && rect.bottom <= bounds.bottom + epsilon
      );
      const rectOf = (element) => {
        if (!element) {
          return null;
        }
        const rect = element.getBoundingClientRect();
        const viewport = { top: 0, left: 0, right: innerWidth, bottom: innerHeight };
        return {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          bottom: rect.bottom,
          right: rect.right,
          fullyInViewport: fullyWithin(rect, viewport),
          fullyInPanel: fullyWithin(rect, sideBounds),
          fullyVisible: fullyWithin(rect, viewport) && fullyWithin(rect, sideBounds)
        };
      };
      const isClipped = (element) => {
        return Boolean(element && (element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1));
      };
      const isLayoutHidden = (element) => {
        if (!element || element.hidden) {
          return true;
        }
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display === 'none' || style.visibility === 'hidden' || rect.width <= 0 || rect.height <= 0;
      };
      const canvas = document.querySelector(${JSON.stringify(sample.canvasSelector)});
      const hud = surface && surface.querySelector(${JSON.stringify(hudSelector)});
      const interrupt = surface && surface.querySelector(${JSON.stringify(endSelector)});
      const score = surface && surface.querySelector(${JSON.stringify(scoreSelector)});
      const time = surface && surface.querySelector(${JSON.stringify(timeSelector)});
      const combo = surface && surface.querySelector(${JSON.stringify(comboSelector)});
      const progress = surface && surface.querySelector(${JSON.stringify(progressSelector)});
      const canvases = Array.from(document.querySelectorAll('[data-dew-catch-canvas], [data-spore-pop-canvas], [data-compost-sort-canvas], [data-rhythm-hum-canvas], [data-legendary-game-canvas]'));
      const visibleCanvases = canvases.filter((canvas) => {
        const rect = canvas.getBoundingClientRect();
        return !canvas.hidden && getComputedStyle(canvas).display !== 'none' && rect.width > 0 && rect.height > 0;
      });
      const progressTrack = progress ? progress.closest('.minigame-progress') : null;
      const progressRect = progressTrack ? progressTrack.getBoundingClientRect() : null;
      const progressTransform = progress ? String(progress.style.transform || '') : '';
      const progressValue = progressTransform.startsWith('scaleX(') && progressTransform.endsWith(')')
        ? Number(progressTransform.slice(7, -1))
        : NaN;
      const overflowNodes = [document.documentElement, document.body, sidePanel, panel, surface].filter(Boolean);
      const horizontalOverflow = overflowNodes.filter((element) => element.scrollWidth > element.clientWidth + 1).map((element) => {
        return element === document.documentElement
          ? 'html'
          : element === document.body
            ? 'body'
            : element.className || element.tagName;
      });
      const catalog = document.querySelector('[data-legendary-game-list]');
      const album = document.querySelector('[data-legendary-album]');
      const app = document.querySelector('[data-app]');
      const stage = document.querySelector('.stage-panel');
      return {
        viewportWidth: innerWidth,
        phase: surface && surface.dataset.launchPhase || '',
        gameplayFocus: app && app.dataset.gameplayFocus || '',
        gameplayPhase: app && app.dataset.gameplayPhase || '',
        sceneCalm: stage && stage.dataset.sceneCalm === 'true',
        panel: rectOf(panel),
        sidePanel: rectOf(sidePanel),
        canvas: rectOf(canvas),
        hud: rectOf(hud),
        interrupt: rectOf(interrupt),
        activeCanvasCount: visibleCanvases.length,
        scoreText: score && score.textContent || '',
        timeText: time && time.textContent || '',
        comboText: combo && combo.textContent || '',
        scoreClipped: isClipped(score),
        timeClipped: isClipped(time),
        comboClipped: isClipped(combo),
        endClipped: isClipped(interrupt),
        progressVisible: Boolean(progressRect && progressRect.width > 20 && progressRect.height >= 3),
        progressValueValid: Number.isFinite(progressValue) && progressValue >= 0 && progressValue <= 1,
        progressValue: Number.isFinite(progressValue) ? progressValue : null,
        progressTransform,
        horizontalOverflow,
        legendaryCatalogHidden: ${legendary} ? isLayoutHidden(catalog) : true,
        legendaryAlbumHidden: ${legendary} ? isLayoutHidden(album) : true
      };
    })()`,
    returnByValue: true
  });
  const info = diagnostics.result.value || {};
  const desktopFocusLayout = Number(info.viewportWidth) > 880;
  const minimumCanvasWidth = desktopFocusLayout ? (legendary ? 360 : 320) : 0;
  if (
    !info.panel
    || !info.panel.fullyVisible
    || info.phase !== 'running'
    || !info.canvas
    || !info.canvas.fullyVisible
    || !info.hud
    || !info.hud.fullyVisible
    || !info.interrupt
    || !info.interrupt.fullyVisible
    || info.activeCanvasCount !== 1
    || info.scoreClipped
    || info.timeClipped
    || info.comboClipped
    || info.endClipped
    || !info.progressVisible
    || !info.progressValueValid
    || info.horizontalOverflow.length
    || !info.legendaryCatalogHidden
    || !info.legendaryAlbumHidden
    || info.gameplayFocus !== (legendary ? 'legendary' : 'standard')
    || info.gameplayPhase !== 'running'
    || !info.sceneCalm
    || minimumCanvasWidth && info.canvas.width < minimumCanvasWidth
    || desktopFocusLayout && (!info.sidePanel || info.sidePanel.width < 439 || info.sidePanel.width > 521)
  ) {
    throw new Error(`${sample.label} panel layout looks incomplete: ${JSON.stringify(info)}`);
  }
  const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  const screenshotPath = `${outputPrefix}-${sample.fileLabel}-panel.png`;
  writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
  console.log(`${sample.fileLabel} panel: ${screenshotPath}`);
  console.log(`${sample.fileLabel} panel diagnostics: ${JSON.stringify(info)}`);
}

async function assertMinigameCompletionFocus(cdp, sample) {
  const legendary = Boolean(sample.viewArena);
  const endSelector = legendary ? '[data-legendary-minigame-end]' : '[data-minigame-end]';
  const interrupted = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const button = document.querySelector(${JSON.stringify(endSelector)});
      if (!button || button.hidden || button.disabled) {
        return { clicked: false };
      }
      let clickObserved = false;
      button.addEventListener('click', () => { clickObserved = true; }, { once: true });
      const runtime = window.__pieczargotchiRuntime || {};
      const disabledAncestor = button.closest('[aria-disabled="true"]');
      const before = {
        blocked: typeof isRuntimeMutationBlocked === 'function' && isRuntimeMutationBlocked(),
        pendingStart: runtime.pendingExclusiveStart && runtime.pendingExclusiveStart.kind || '',
        battleActive: typeof isBattleSessionActive === 'function' && isBattleSessionActive(),
        viewMode: runtime.viewMode || '',
        activeId: runtime.state && runtime.state.minigames && runtime.state.minigames.active && runtime.state.minigames.active.id || '',
        disabled: button.disabled,
        effectivelyDisabled: button.matches(':disabled'),
        inertAncestor: Boolean(button.closest('[inert]')),
        hiddenAncestor: Boolean(button.closest('[hidden]')),
        ariaDisabledAncestor: disabledAncestor ? {
          tag: disabledAncestor.tagName,
          id: disabledAncestor.id || '',
          className: disabledAncestor.className || '',
          data: Object.assign({}, disabledAncestor.dataset)
        } : null,
        clickSource: String(button.click)
      };
      button.click();
      return { clicked: true, clickObserved, before };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  const interruptDiagnostics = interrupted.result.value || {};
  if (!interruptDiagnostics.clicked || !interruptDiagnostics.clickObserved) {
    throw new Error(`${sample.label} nie udostępnia działającego przycisku przerwania rundy: ${JSON.stringify(interruptDiagnostics)}`);
  }
  console.log(`${sample.fileLabel || sample.id} interrupt: ${JSON.stringify(interruptDiagnostics)}`);

  await waitForExpression(cdp, `(() => {
    const runtime = window.__pieczargotchiRuntime || {};
    const active = runtime.state && runtime.state.minigames && runtime.state.minigames.active;
    return !runtime.minigame && !active;
  })()`, 4000);
  await waitForExpression(cdp, `(() => {
    const active = document.activeElement;
    if (!active || active === document.body) {
      return false;
    }
    const rect = active.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || active.closest('[hidden], [inert]')
      || rect.top < 0 || rect.left < 0 || rect.bottom > window.innerHeight || rect.right > window.innerWidth) {
      return false;
    }
    let ancestor = active.parentElement;
    while (ancestor && ancestor !== document.body) {
      const style = getComputedStyle(ancestor);
      if (/(auto|scroll|hidden|clip)/.test(style.overflow + style.overflowX + style.overflowY)) {
        const bounds = ancestor.getBoundingClientRect();
        if (rect.top < bounds.top || rect.left < bounds.left || rect.bottom > bounds.bottom || rect.right > bounds.right) {
          return false;
        }
      }
      ancestor = ancestor.parentElement;
    }
    return true;
  })()`, 2000);

  const result = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const active = document.activeElement;
      const recap = document.querySelector('[data-minigame-recap="${legendary ? 'legendary' : 'standard'}"]:not([hidden])');
      const matchingStart = active && active.matches('[data-minigame-start="${String(sample.id).replace(/"/g, '\\"')}"]');
      const catalog = document.querySelector('[data-legendary-game-list]');
      const album = document.querySelector('[data-legendary-album]');
      const isVisible = (node) => {
        if (!node || node.hidden || node.closest('[hidden], [inert]')) {
          return false;
        }
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      const isFullyVisible = (node) => {
        if (!isVisible(node)) {
          return false;
        }
        const rect = node.getBoundingClientRect();
        if (rect.top < 0 || rect.left < 0 || rect.bottom > window.innerHeight || rect.right > window.innerWidth) {
          return false;
        }
        let ancestor = node.parentElement;
        while (ancestor && ancestor !== document.body) {
          const style = getComputedStyle(ancestor);
          if (/(auto|scroll|hidden|clip)/.test(style.overflow + style.overflowX + style.overflowY)) {
            const bounds = ancestor.getBoundingClientRect();
            if (rect.top < bounds.top || rect.left < bounds.left || rect.bottom > bounds.bottom || rect.right > bounds.right) {
              return false;
            }
          }
          ancestor = ancestor.parentElement;
        }
        return true;
      };
      return {
        activeTag: active && active.tagName || '',
        activeFocusKey: active && active.dataset && active.dataset.focusKey || '',
        activeMinigameStart: active && active.dataset && active.dataset.minigameStart || '',
        activeFullyVisible: isFullyVisible(active),
        recapVisible: isVisible(recap),
        focusInRecap: Boolean(recap && active && recap.contains(active)),
        matchingStart: Boolean(matchingStart && isVisible(active) && !active.disabled),
        pendingRestore: Boolean(window.__pieczargotchiRuntime && window.__pieczargotchiRuntime.pendingMinigameFocusRestore),
        catalogRestored: ${legendary} ? isVisible(catalog) : true,
        albumRestored: ${legendary} ? isVisible(album) : true
      };
    })()`,
    returnByValue: true
  });
  const diagnostics = result.result.value || {};
  if (
    (!diagnostics.focusInRecap && !diagnostics.matchingStart)
    || !diagnostics.activeFullyVisible
    || diagnostics.pendingRestore
    || !diagnostics.catalogRestored
    || !diagnostics.albumRestored
  ) {
    throw new Error(`${sample.label} nie przywróciła stabilnego fokusu lub powierzchni po rundzie: ${JSON.stringify(diagnostics)}`);
  }
  console.log(`${sample.fileLabel || sample.id} completion focus: ${JSON.stringify(diagnostics)}`);
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
      const debugSettings = ${JSON.stringify(captureDebugSettings)};
      const runtimeNow = debugSettings && Number.isFinite(Number(debugSettings.fixedAt))
        ? Number(debugSettings.fixedAt)
        : ${now};
      const iso = new Date(runtimeNow).toISOString();
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
      const requestedDecorations = ${JSON.stringify(captureDecorations)};
      if (requestedDecorations.length) {
        state.decorations.owned = requestedDecorations;
        state.decorations.active = requestedDecorations.filter((item) => item !== 'myceliumCalendar').slice(0, 3);
        state.inventory.spores = 24;
        state.coins = 24;
      } else if (${JSON.stringify(captureCalendarChecklist || Boolean(debugCalendarEvent))}) {
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
      if (debugSettings) {
        localStorage.setItem((config.storageKey || 'pieczargotchi_state_v2') + '_debug', JSON.stringify(debugSettings));
      }
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
  if (options.expectedAnimationKey) {
    await waitForExpression(
      cdp,
      `window.__pieczargotchiRuntime.currentAnimationKey === ${JSON.stringify(options.expectedAnimationKey)}`,
      3000
    );
  }
  await delay(captureDelayMs);

  const animationKey = await getCurrentAnimationKey(cdp);
  if (options.expectedAnimationKey && animationKey !== options.expectedAnimationKey) {
    throw new Error(`Nieprawidlowa animacja dla ${label}: ${animationKey}, oczekiwano ${options.expectedAnimationKey}`);
  }
  if (animationKey) {
    await assertCurrentAnimationAtlasContract(cdp, animationKey, label);
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
          rainbow: diagnostics.rainbow || null,
          cloudOptics: diagnostics.cloudOptics || null,
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
          rainbowRedShiftScore: scene.rainbowRedShiftScore,
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
      const now = Number(runtime.wallNow) || Date.now();
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
      const core = window.PieczargotchiCore;
      if (core && typeof core.selectImmersionReaction === 'function') {
        runtime.captureOriginalImmersionSelector = runtime.captureOriginalImmersionSelector
          || core.selectImmersionReaction;
        core.selectImmersionReaction = function() { return null; };
      }
      const now = Number(runtime.wallNow) || Date.now();
      runtime.immersion = runtime.immersion || {};
      runtime.immersion.active = null;
      runtime.immersion.cooldownUntil = now + 30000;
      runtime.immersion.cooldowns = Object.assign({}, runtime.immersion.cooldowns || {}, {
        sun: now + 30000,
        stargaze: now + 30000,
        weather: now + 30000,
        ambient: now + 30000,
        idle: now + 30000
      });
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
      const actionButtons = Array.from(document.querySelectorAll('.action-button, .action-more-button')).map((button) => {
        const rect = button.getBoundingClientRect();
        const label = button.querySelector('.action-label');
        const style = getComputedStyle(button);
        return {
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          labelText: label ? label.textContent : button.textContent.trim(),
          visible: style.display !== 'none' && rect.width > 0 && rect.height > 0,
          hiddenByContext: button.classList.contains('is-mobile-context-hidden'),
          primary: Boolean(button.closest('[data-actions-primary]')),
          labelClipped: label ? label.scrollWidth > label.clientWidth + 1 || label.scrollHeight > label.clientHeight + 1 : false
        };
      });
      const actionsGrid = document.querySelector('.actions-grid');
      const actionsPrimary = document.querySelector('[data-actions-primary]');
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
      const primaryActionColumns = actionsPrimary
        ? getComputedStyle(actionsPrimary).gridTemplateColumns.split(' ').filter(Boolean).length
        : 0;
      const stagePanel = document.querySelector('.stage-panel');
      const stageRect = rectOf('.stage-panel');
      const stageStyle = stagePanel ? getComputedStyle(stagePanel) : null;
      const topbarRect = rectOf('.topbar');
      const stageToolbarRect = rectOf('.stage-toolbar');
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
        documentHeight: document.documentElement.scrollHeight,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        app: rectOf('.app'),
        topbar: topbarRect,
        stage: stageRect,
        stageScrollTop: stagePanel ? stagePanel.scrollTop : 0,
        stageScrollHeight: stagePanel ? stagePanel.scrollHeight : 0,
        stageClientHeight: stagePanel ? stagePanel.clientHeight : 0,
        stageOverflowY: stageStyle ? stageStyle.overflowY : '',
        stageToolbar: stageToolbarRect,
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
        workspaceTabs: elementInfo('[data-workspace-tabs]'),
        activeWorkspacePanel: elementInfo('[data-workspace-panel]:not([hidden])'),
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
        actionsTopbarOverlapRatio: getOverlapRatio(topbarRect, actionsRect),
        actionsStageOverlapRatio: getOverlapRatio(stageRect, actionsRect),
        actionsStageToolbarOverlapRatio: getOverlapRatio(stageToolbarRect, actionsRect),
        actionsCanvasOverlapRatio: getOverlapRatio(canvasRect, actionsRect),
        actionsMessageOverlapRatio: getOverlapRatio(messageRect, actionsRect),
        actionsSideOverlapRatio: getOverlapRatio(sideRect, actionsRect),
        actionsStatusOverlapRatio: getOverlapRatio(statusRect, actionsRect),
        actionsMinigamesOverlapRatio: getOverlapRatio(minigamesRect, actionsRect),
        sideScrollTop: sidePanel ? sidePanel.scrollTop : 0,
        sideScrollHeight: sidePanel ? sidePanel.scrollHeight : 0,
        sideClientHeight: sidePanel ? sidePanel.clientHeight : 0,
        actionColumns,
        primaryActionColumns,
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
    try {
      assertShortViewportLayout(info);
    } catch (error) {
      console.error(`short viewport diagnostics: ${JSON.stringify({
        stage: info.stage,
        canvas: info.canvas,
        message: info.message,
        dailyRhythm: info.dailyRhythm,
        dailyPlan: info.dailyPlan,
        side: info.side
      })}`);
      throw error;
    }
    if (viewportHeight <= 500) {
      await assertShortStageScrollReachability(cdp, info);
    }
  }

  const screenshot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    clip: { x: 0, y: 0, width: viewportWidth, height: viewportHeight, scale: 1 }
  });
  const filePath = `${outputPrefix}-viewport-${viewportWidth}x${viewportHeight}.png`;
  writeFileSync(filePath, Buffer.from(screenshot.data, 'base64'));
  if (viewportWidth <= 320 && viewportHeight <= 568) {
    await assertSmallMobileScrollReachability(cdp, info);
  }
  if (viewportWidth > 640 && viewportHeight <= 700 && !info.actionsDockActive && info.actionsPosition === 'sticky') {
    await assertShortDesktopActionsStayVisibleOnSidePanelScroll(cdp, info);
  }
  console.log(`viewport: ${filePath}`);
  console.log(`viewport layout: side=${Math.round(info.side.width)}x${Math.round(info.side.height)}, canvas=${Math.round(info.canvas.width)}x${Math.round(info.canvas.height)}, actionColumns=${info.primaryActionColumns}/${info.actionColumns}`);
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

  try {
    await waitForExpression(
      cdp,
      `(() => {
        const panel = document.querySelector('.panel-block--actions');
        return Boolean(panel && (
          panel.classList.contains('is-adaptive-docked')
          || (panel.dataset.adaptiveDock === 'flow' && getComputedStyle(panel).display !== 'none')
        ));
      })()`,
      2500
    );
  } catch (error) {
    const diagnostic = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const runtime = window.__pieczargotchiRuntime || {};
        const state = runtime.state || {};
        const panel = document.querySelector('.panel-block--actions');
        const openDialog = document.querySelector('dialog[open]');
        return {
          innerWidth: window.innerWidth,
          viewMode: runtime.viewMode,
          ui: runtime.ui || null,
          named: Boolean(state.mushroomName && state.flags && state.flags.nameConfirmed),
          gameOver: Boolean(state.gameOver && state.gameOver.active),
          recovery: Boolean(state.recovery && state.recovery.active),
          stateMinigame: state.minigames && state.minigames.active ? state.minigames.active.id : null,
          runtimeMinigame: runtime.minigame && runtime.minigame.session ? runtime.minigame.session.id : null,
          battle: state.battle && state.battle.activeBattle ? state.battle.activeBattle.mode : null,
          openDialog: openDialog ? openDialog.outerHTML.slice(0, 180) : null,
          hideDecision: typeof shouldHideMobileActionTray === 'function' ? shouldHideMobileActionTray() : null,
          trayPresent: Boolean(runtime.actionTray && runtime.actionTray.primary && runtime.actionTray.moreButton),
          trayHiddenReason: runtime.actionTray && runtime.actionTray.hiddenReason || null,
          trayFallbackReason: runtime.actionTray && runtime.actionTray.fallbackReason || null,
          panelHidden: panel ? panel.hidden : null,
          panelClasses: panel ? panel.className : null,
          panelDisplay: panel ? getComputedStyle(panel).display : null,
          appTrayVisible: document.querySelector('[data-app]')?.dataset.actionTrayVisible || null,
          trayHeight: getComputedStyle(document.documentElement).getPropertyValue('--action-tray-height')
        };
      })()`,
      returnByValue: true
    });
    throw new Error(`Mobilny tray nie został zadokowany: ${JSON.stringify(diagnostic.result.value || {})}`);
  }
}

function assertMobileLayout(info) {
  if (!info.stage || !info.canvas || !info.message || !info.actions || !info.status) {
    throw new Error('Brakuje kluczowych elementów layoutu mobilnego.');
  }

  const canvasTopLimit = info.innerWidth <= 640 || info.innerHeight <= 500 ? 150 : 190;
  if (info.canvas.top > canvasTopLimit) {
    throw new Error(`Canvas jest zbyt nisko na mobile: top=${Math.round(info.canvas.top)}px, limit=${canvasTopLimit}px`);
  }

  if (info.actionsDockActive && info.actionsPosition !== 'fixed') {
    throw new Error(`Aktywny dock akcji powinien być fixed, wykryto ${info.actionsPosition}.`);
  }

  if (info.actionsDockActive && info.actionsDockPlacement !== 'bottom') {
    throw new Error(`Mobilny dock akcji powinien być wyłącznie na dole, wykryto ${info.actionsDockPlacement}.`);
  }

  if (info.actionsDockActive && info.primaryActionColumns !== 5) {
    throw new Error(`Podstawowy rząd akcji powinien mieć 5 kolumn, wykryto ${info.primaryActionColumns}.`);
  }

  if (!info.actionsDockActive && (
    info.actionsDockPlacement !== 'flow'
    || !['static', 'relative'].includes(info.actionsPosition)
  )) {
    throw new Error(`Bezpieczny fallback akcji powinien pozostać w przepływie, wykryto ${info.actionsDockPlacement}/${info.actionsPosition}.`);
  }

  if (info.innerWidth <= 320 && info.innerHeight <= 568) {
    if (!info.actionsDockActive) {
      throw new Error('Na 320×568 pięć podstawowych akcji musi pozostać w stałej dolnej tacce.');
    }
    const visiblePrimary = info.actionButtons.filter((button) => button.visible && button.primary);
    if (visiblePrimary.length !== 5) {
      throw new Error(`Na 320×568 oczekiwano pięciu widocznych podstawowych akcji, wykryto ${visiblePrimary.length}.`);
    }
    if (info.actions.top < -1 || info.actions.bottom > info.innerHeight + 1) {
      throw new Error(`Tacka podstawowych akcji nie mieści się w pierwszym ekranie 320×568: ${JSON.stringify(info.actions)}.`);
    }
  }

  assertAdaptiveDockBounds(info);

  const visibleActionButtons = info.actionButtons.filter((button) => button.visible);
  if (visibleActionButtons.length > 6) {
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

async function assertSmallMobileScrollReachability(cdp, initialInfo) {
  const beforeTabsTop = initialInfo.workspaceTabs && initialInfo.workspaceTabs.top;
  const scroll = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - innerHeight);
      window.scrollTo(0, maxScroll);
      return { maxScroll };
    })()`,
    returnByValue: true
  });
  await delay(120);
  const result = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const rectOf = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
      };
      const actions = document.querySelector('.panel-block--actions');
      return {
        scrollY,
        maxScroll: Math.max(0, document.documentElement.scrollHeight - innerHeight),
        tabs: rectOf('[data-workspace-tabs]'),
        actions: rectOf('.panel-block--actions'),
        actionsFixed: actions ? getComputedStyle(actions).position === 'fixed' : false,
        documentHeight: document.documentElement.scrollHeight
      };
    })()`,
    returnByValue: true
  });
  await cdp.send('Runtime.evaluate', { expression: 'window.scrollTo(0, 0)' });
  await delay(60);

  const info = result.result.value || {};
  const expectedMax = Number(scroll.result.value && scroll.result.value.maxScroll) || 0;
  if (expectedMax > 1 && Number(info.scrollY) < expectedMax - 2) {
    throw new Error(`Mały layout mobilny nie dociera do końca dokumentu: ${JSON.stringify(info)}.`);
  }
  if (
    expectedMax > 1
    && Number.isFinite(Number(beforeTabsTop))
    && info.tabs
    && Number(info.tabs.top) >= Number(beforeTabsTop) - 20
  ) {
    throw new Error(`Treść workspace nie przesuwa się ponad stałą tackę: ${JSON.stringify(info)}.`);
  }
  if (
    !info.actionsFixed
    || !info.actions
    || info.actions.top < -1
    || info.actions.bottom > viewportHeight + 1
  ) {
    throw new Error(`Tacka nie pozostała osiągalna podczas scrollu małego layoutu: ${JSON.stringify(info)}.`);
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
    if (info.actionsDockActive && info.actionsPosition !== 'fixed') {
      throw new Error(`Aktywny dock akcji w krótkim layoucie powinien być fixed, wykryto ${info.actionsPosition}.`);
    }

    if (info.actionsDockActive && info.primaryActionColumns !== 5) {
      throw new Error(`Dock akcji w krótkim layoucie powinien mieć 5 podstawowych kolumn, wykryto ${info.primaryActionColumns}.`);
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
    const stageCanScroll = ['auto', 'scroll'].includes(info.stageOverflowY)
      && Number(info.stageScrollHeight) > Number(info.stageClientHeight) + 1;
    if (section.bottom > info.stage.bottom + 1 && !stageCanScroll) {
      throw new Error(`Sekcja lewego panelu jest ucięta przez scenę: bottom=${Math.round(section.bottom)}, stageBottom=${Math.round(info.stage.bottom)}.`);
    }
    if (section.clipped && info.innerHeight > 500) {
      throw new Error('Sekcja lewego panelu jest przypadkowo przycięta w krótkim layoucie.');
    }
    previous = section;
  });

  if (!info.message || !info.message.visible || info.message.top >= info.stage.bottom - 4 || info.message.bottom <= info.stage.top + 4) {
    throw new Error('Krótki landscape nie zachował widocznego komunikatu pod sceną.');
  }
}

async function assertShortStageScrollReachability(cdp, initialInfo) {
  const result = await cdp.send('Runtime.evaluate', {
    expression: `(async () => {
      const stage = document.querySelector('.stage-panel');
      const rhythm = document.querySelector('.daily-rhythm-strip');
      const plan = document.querySelector('.daily-plan-strip');
      if (!stage || !rhythm || !plan) {
        return null;
      }
      const initialScrollTop = stage.scrollTop;
      let maxScroll = 0;
      let attempts = 0;
      for (attempts = 1; attempts <= 4; attempts += 1) {
        maxScroll = Math.max(0, stage.scrollHeight - stage.clientHeight);
        stage.scrollTop = maxScroll;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        maxScroll = Math.max(0, stage.scrollHeight - stage.clientHeight);
        if (stage.scrollTop >= maxScroll - 1) {
          break;
        }
      }
      const stageRect = stage.getBoundingClientRect();
      const rectOf = (element) => {
        const rect = element.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
      };
      const withinStage = (element) => {
        const rect = element.getBoundingClientRect();
        return rect.top >= stageRect.top - 1
          && rect.bottom <= stageRect.bottom + 1
          && rect.left >= stageRect.left - 1
          && rect.right <= stageRect.right + 1;
      };
      const rhythmButtons = Array.from(rhythm.querySelectorAll('button'));
      const info = {
        maxScroll,
        reachedScrollTop: stage.scrollTop,
        attempts: Math.min(attempts, 4),
        rhythm: rectOf(rhythm),
        plan: rectOf(plan),
        rhythmReachable: withinStage(rhythm),
        planReachable: withinStage(plan),
        rhythmButtonCount: rhythmButtons.length,
        rhythmFocusableCount: rhythmButtons.filter((button) => !button.disabled && button.tabIndex >= 0).length
      };
      stage.scrollTop = initialScrollTop;
      return info;
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  const info = result.result.value;
  if (!info) {
    throw new Error('Brakuje komunikatu rytmu albo planu dnia w krótkim landscape.');
  }
  if (Number(initialInfo.stageScrollHeight) > Number(initialInfo.stageClientHeight) + 1) {
    if (info.maxScroll <= 1 || info.reachedScrollTop < info.maxScroll - 1) {
      throw new Error(`Scena nie dociera do końca własnego scrolla: ${JSON.stringify(info)}.`);
    }
  }
  if (!info.rhythmReachable || !info.planReachable) {
    throw new Error(`Rytm albo plan dnia nie są osiągalne w scrollu sceny: ${JSON.stringify(info)}.`);
  }
  if (!info.rhythmButtonCount || !info.rhythmFocusableCount) {
    throw new Error(`Wybór rytmu nie zachował osiągalnego przycisku: ${JSON.stringify(info)}.`);
  }
}

function assertShortDesktopActionFlow(info) {
  if (info.actionsDockActive) {
    throw new Error(`Akcje w krótkim layoucie desktopowym nie powinny używać fixed docka, wykryto ${info.actionsDockPlacement}.`);
  }

  if (info.actionsDockPlacement !== 'flow') {
    throw new Error(`Panel akcji powinien zostać w przepływie side-panelu, wykryto ${info.actionsDockPlacement}.`);
  }

  if (!['static', 'sticky'].includes(info.actionsPosition)) {
    throw new Error(`Panel akcji w krótkim layoucie desktopowym powinien być w przepływie lub sticky, wykryto ${info.actionsPosition}.`);
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

  if (!info.workspaceTabs || !info.workspaceTabs.visible) {
    throw new Error('Nawigacja Opieka/Gry/Grzybnia powinna być widoczna w krótkim layoucie.');
  }

  if (info.workspaceTabs.top < info.side.top - 1 || info.workspaceTabs.top > info.innerHeight - 32) {
    throw new Error(`Nawigacja workspace jest poza pierwszym widokiem: top=${Math.round(info.workspaceTabs.top)}, height=${info.innerHeight}.`);
  }

  const tabsOverlap = getLayoutOverlapRatio(info.workspaceTabs, info.actions);
  if (tabsOverlap > 0.01) {
    throw new Error(`Panel akcji nachodzi na nawigację workspace: ${(tabsOverlap * 100).toFixed(1)}%.`);
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

  const protectedOverlap = Math.max(
    Number(info.actionsTopbarOverlapRatio) || 0,
    Number(info.actionsStageToolbarOverlapRatio) || 0,
    Number(info.actionsCanvasOverlapRatio) || 0,
    Number(info.actionsMessageOverlapRatio) || 0
  );
  if (protectedOverlap > 0.01) {
    throw new Error(
      `Dolny tray nachodzi na chroniony obszar: topbar=${(info.actionsTopbarOverlapRatio * 100).toFixed(1)}%, `
      + `toolbar=${(info.actionsStageToolbarOverlapRatio * 100).toFixed(1)}%, canvas=${(info.actionsCanvasOverlapRatio * 100).toFixed(1)}%, `
      + `message=${(info.actionsMessageOverlapRatio * 100).toFixed(1)}%.`
    );
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

async function assertCurrentAnimationAtlasContract(cdp, animationKey, label) {
  const result = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const key = ${JSON.stringify(animationKey)};
      const config = window.PIECZARGOTCHI_CONFIG || {};
      const runtime = window.__pieczargotchiRuntime || {};
      const animation = Array.isArray(config.animations)
        ? config.animations.find((entry) => entry.key === key)
        : null;
      const asset = Array.isArray(config.assets)
        ? config.assets.find((entry) => entry.key === key)
        : null;
      const image = runtime.assets && runtime.assets[key];
      return {
        key,
        hasAnimation: Boolean(animation),
        hasAsset: Boolean(asset),
        hasImage: Boolean(image),
        bakedGrass: animation && animation.bakedGrass,
        frameWidth: Number(animation && animation.frameWidth) || 0,
        frameHeight: Number(animation && animation.frameHeight) || 0,
        storedFrameCount: Number(animation && animation.storedFrameCount) || 0,
        assetWidth: Number(asset && asset.width) || 0,
        assetHeight: Number(asset && asset.height) || 0,
        naturalWidth: Number(image && image.naturalWidth) || 0,
        naturalHeight: Number(image && image.naturalHeight) || 0
      };
    })()`,
    returnByValue: true
  });
  const info = result.result && result.result.value ? result.result.value : {};
  const expectedWidth = info.frameWidth * info.storedFrameCount;
  if (
    !info.hasAnimation
    || !info.hasAsset
    || !info.hasImage
    || info.bakedGrass !== false
    || expectedWidth <= 0
    || info.frameHeight <= 0
    || info.assetWidth !== expectedWidth
    || info.assetHeight !== info.frameHeight
    || info.naturalWidth !== expectedWidth
    || info.naturalHeight !== info.frameHeight
  ) {
    throw new Error(`Niespójny ciasny atlas animacji dla ${label}: ${JSON.stringify(info)}`);
  }
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
  const deadline = Date.now() + chromiumStartupTimeoutMs;
  while (Date.now() < deadline) {
    if (browserSpawnError) {
      throw new Error(`Nie udało się uruchomić Chromium.${formatBrowserDiagnostics()}`);
    }
    if (browserCloseInfo || browser.exitCode !== null) {
      throw new Error(`Chromium zakończył działanie przed otwarciem DevTools.${formatBrowserDiagnostics()}`);
    }
    try {
      const devToolsPortFile = path.join(userDataDir, 'DevToolsActivePort');
      if (!existsSync(devToolsPortFile)) {
        await delay(50);
        continue;
      }
      const devToolsPort = Number.parseInt(readFileSync(devToolsPortFile, 'utf8').split(/\r?\n/)[0], 10);
      if (!Number.isInteger(devToolsPort) || devToolsPort <= 0) {
        await delay(50);
        continue;
      }
      const response = await fetch(`http://127.0.0.1:${devToolsPort}/json/list`);
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
  throw new Error(
    `Nie udało się połączyć z Chromium DevTools w ${Math.ceil(chromiumStartupTimeoutMs / 1000)} s.`
      + formatBrowserDiagnostics(),
  );
}

function appendBrowserOutput(current, chunk) {
  return (current + String(chunk || '')).slice(-12000);
}

function formatBrowserDiagnostics() {
  const details = [];
  if (browserSpawnError) {
    details.push(`spawn=${browserSpawnError.message || browserSpawnError}`);
  }
  if (browserCloseInfo) {
    details.push(`close=${browserCloseInfo.code ?? 'null'}/${browserCloseInfo.signal || 'none'}`);
  }
  if (browserStderr.trim()) {
    details.push(`stderr=${browserStderr.trim().slice(-4000)}`);
  }
  if (browserStdout.trim()) {
    details.push(`stdout=${browserStdout.trim().slice(-2000)}`);
  }
  return details.length ? ` ${details.join(' | ')}` : '';
}

function connectCdp(url) {
  const socket = new WebSocket(url);
  let nextId = 1;
  let opened = false;
  let intentionallyClosed = false;
  const pending = new Map();
  const listeners = new Map();
  const pageExceptions = [];

  function rejectPending(error) {
    pending.forEach((entry) => {
      clearTimeout(entry.timeout);
      entry.reject(error);
    });
    pending.clear();
  }

  function handleSocketFailure(event) {
    const detail = event && event.message ? `: ${event.message}` : '';
    rejectPending(new Error(`Połączenie Chromium DevTools zostało przerwane${detail}`));
  }

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') {
      const details = message.params && message.params.exceptionDetails;
      const text = details && (details.exception && details.exception.description || details.text);
      const url = details && details.url ? ` ${details.url}:${details.lineNumber || 0}` : '';
      const diagnostic = `page exception:${url} ${text || JSON.stringify(details || {})}`;
      pageExceptions.push(diagnostic);
      console.error(diagnostic);
    }
    if (message.method && listeners.has(message.method)) {
      const callbacks = listeners.get(message.method);
      listeners.delete(message.method);
      callbacks.forEach((callback) => callback(message.params || {}));
    }

    if (!message.id || !pending.has(message.id)) {
      return;
    }

    const { resolve, reject, timeout } = pending.get(message.id);
    pending.delete(message.id);
    clearTimeout(timeout);
    if (message.error) {
      reject(new Error(message.error.message || JSON.stringify(message.error)));
    } else {
      resolve(message.result || {});
    }
  });

  return new Promise((resolve, reject) => {
    socket.addEventListener('open', () => {
      opened = true;
      resolve({
        send(method, params = {}, timeoutMs = 15000) {
          const id = nextId;
          nextId += 1;
          return new Promise((resolveSend, rejectSend) => {
            const timeout = setTimeout(() => {
              pending.delete(id);
              rejectSend(new Error(`Timeout polecenia CDP po ${timeoutMs} ms: ${method}`));
            }, timeoutMs);
            pending.set(id, { resolve: resolveSend, reject: rejectSend, timeout });
            try {
              socket.send(JSON.stringify({ id, method, params }));
            } catch (error) {
              clearTimeout(timeout);
              pending.delete(id);
              rejectSend(error);
            }
          });
        },
        close() {
          intentionallyClosed = true;
          socket.close();
        },
        throwIfPageExceptions() {
          if (pageExceptions.length) {
            throw new Error(`Wykryto nieobsłużone wyjątki strony:\n${pageExceptions.join('\n')}`);
          }
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
    socket.addEventListener('error', (event) => {
      handleSocketFailure(event);
      if (!opened) {
        reject(new Error('Nie udało się otworzyć połączenia Chromium DevTools.'));
      }
    });
    socket.addEventListener('close', () => {
      if (!intentionallyClosed) {
        handleSocketFailure({ message: 'socket closed' });
      }
    });
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
        const config = window.PIECZARGOTCHI_CONFIG || {};
        const storageKey = config.storageKey || 'pieczargotchi_state_v2';
        let stored = null;
        try {
          stored = JSON.parse(localStorage.getItem(storageKey) || 'null');
        } catch {}
        const playfield = document.querySelector('[data-minigame-playfield]');
        const playfieldRect = playfield ? playfield.getBoundingClientRect() : null;
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
          storageKey,
          storedName: stored && stored.mushroomName || null,
          storedVersion: stored && stored.version || null,
          storedFlags: stored && stored.flags || null,
          viewport: { width: innerWidth, height: innerHeight, scrollY, scrollHeight: document.documentElement.scrollHeight },
          documentState: {
            htmlClass: document.documentElement.className,
            bodyClass: document.body && document.body.className,
            htmlOverflow: getComputedStyle(document.documentElement).overflow,
            bodyOverflow: document.body ? getComputedStyle(document.body).overflow : null,
            scrollingElement: document.scrollingElement && document.scrollingElement.tagName,
            scrollingTop: document.scrollingElement && document.scrollingElement.scrollTop,
            activeElement: document.activeElement && (document.activeElement.getAttribute('data-dew-catch-canvas') !== null
              ? 'dew-canvas'
              : document.activeElement.tagName)
          },
          playfieldRect: playfieldRect ? {
            top: playfieldRect.top,
            right: playfieldRect.right,
            bottom: playfieldRect.bottom,
            left: playfieldRect.left,
            width: playfieldRect.width,
            height: playfieldRect.height
          } : null,
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

async function dispatchDomKey(cdp, key) {
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const target = document.activeElement || document.body;
      return target.dispatchEvent(new KeyboardEvent('keydown', {
        key: ${JSON.stringify(key)},
        bubbles: true,
        cancelable: true
      }));
    })()`,
    returnByValue: true
  });
}

async function dispatchWindowKey(cdp, key) {
  await cdp.send('Runtime.evaluate', {
    expression: `window.dispatchEvent(new KeyboardEvent('keydown', {
      key: ${JSON.stringify(key)},
      bubbles: true,
      cancelable: true
    }))`,
    returnByValue: true
  });
}
