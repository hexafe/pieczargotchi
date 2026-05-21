import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, rm } from 'node:fs/promises';
import { get } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputDir = process.argv[2] || path.join(tmpdir(), `pieczargotchi-life-motion-${Date.now()}`);
const port = await getAvailablePort();
const appUrl = `http://127.0.0.1:${port}/`;

const scenarios = [
  {
    name: 'summer-day-life',
    fixedAt: Date.parse('2026-06-21T13:00:00+02:00'),
    env: {
      PIECZARGOTCHI_CAPTURE_LIFE_PROFILE: '1',
      PIECZARGOTCHI_CAPTURE_DELAY_MS: '900',
      PIECZARGOTCHI_DEBUG_WEATHER: 'clear',
      PIECZARGOTCHI_DEBUG_CLOUD: '12',
      PIECZARGOTCHI_DEBUG_PRECIPITATION: '0',
      PIECZARGOTCHI_DEBUG_WIND: '6',
      PIECZARGOTCHI_DEBUG_WIND_DIRECTION: '90',
      PIECZARGOTCHI_DEBUG_TEMPERATURE: '26',
      PIECZARGOTCHI_DEBUG_HUMIDITY: '66'
    },
    minimums: {
      butterflyIntensity: 0.55,
      flyingInsectIntensity: 0.45,
      crawlerIntensity: 0.35
    }
  },
  {
    name: 'summer-night-fireflies',
    fixedAt: Date.parse('2026-07-10T22:00:00+02:00'),
    motionCaptureDelaysMs: [700, 1600],
    env: {
      PIECZARGOTCHI_CAPTURE_LIFE_PROFILE: '1',
      PIECZARGOTCHI_CAPTURE_DELAY_MS: '1000',
      PIECZARGOTCHI_DEBUG_WEATHER: 'clear',
      PIECZARGOTCHI_DEBUG_CLOUD: '8',
      PIECZARGOTCHI_DEBUG_PRECIPITATION: '0',
      PIECZARGOTCHI_DEBUG_WIND: '4',
      PIECZARGOTCHI_DEBUG_WIND_DIRECTION: '40',
      PIECZARGOTCHI_DEBUG_TEMPERATURE: '22',
      PIECZARGOTCHI_DEBUG_HUMIDITY: '82'
    },
    minimums: {
      fireflyIntensity: 0.55,
      flyingInsectIntensity: 0.18,
      batIntensity: 0.45,
      mothIntensity: 0.45
    }
  },
  {
    name: 'sunbeam-cloud-anchor',
    fixedAt: Date.parse('2026-06-21T18:35:00+02:00'),
    env: {
      PIECZARGOTCHI_CAPTURE_LIFE_PROFILE: '1',
      PIECZARGOTCHI_CAPTURE_DELAY_MS: '950',
      PIECZARGOTCHI_DEBUG_WEATHER: 'cloudy',
      PIECZARGOTCHI_DEBUG_CLOUD: '54',
      PIECZARGOTCHI_DEBUG_CLOUD_LOW: '50',
      PIECZARGOTCHI_DEBUG_CLOUD_MID: '46',
      PIECZARGOTCHI_DEBUG_CLOUD_HIGH: '20',
      PIECZARGOTCHI_DEBUG_PRECIPITATION: '0',
      PIECZARGOTCHI_DEBUG_WIND: '11',
      PIECZARGOTCHI_DEBUG_WIND_DIRECTION: '245',
      PIECZARGOTCHI_DEBUG_TEMPERATURE: '24',
      PIECZARGOTCHI_DEBUG_HUMIDITY: '70'
    },
    minimums: {},
    sunbeams: {
      minIntensity: 0.04,
      minAnchorScore: 0.08
    }
  },
  {
    name: 'mobile-summer-life',
    fixedAt: Date.parse('2026-06-21T15:30:00+02:00'),
    env: {
      PIECZARGOTCHI_CAPTURE_VIEWPORT: '1',
      PIECZARGOTCHI_CAPTURE_LIFE_PROFILE: '1',
      PIECZARGOTCHI_CAPTURE_DELAY_MS: '900',
      PIECZARGOTCHI_VIEWPORT_WIDTH: '390',
      PIECZARGOTCHI_VIEWPORT_HEIGHT: '844',
      PIECZARGOTCHI_EMULATE_MOBILE: '1',
      PIECZARGOTCHI_DEBUG_WEATHER: 'clear',
      PIECZARGOTCHI_DEBUG_CLOUD: '16',
      PIECZARGOTCHI_DEBUG_PRECIPITATION: '0',
      PIECZARGOTCHI_DEBUG_WIND: '5',
      PIECZARGOTCHI_DEBUG_WIND_DIRECTION: '110',
      PIECZARGOTCHI_DEBUG_TEMPERATURE: '25',
      PIECZARGOTCHI_DEBUG_HUMIDITY: '64'
    },
    minimums: {
      butterflyIntensity: 0.5,
      crawlerIntensity: 0.32
    }
  },
  {
    name: 'grass-polish-storm',
    fixedAt: Date.parse('2026-06-21T16:20:00+02:00'),
    motionCaptureDelaysMs: [450, 1150],
    env: {
      PIECZARGOTCHI_CAPTURE_LIFE_PROFILE: '1',
      PIECZARGOTCHI_CAPTURE_DELAY_MS: '900',
      PIECZARGOTCHI_CAPTURE_DECORATIONS: 'mossBell,sporeLantern,dewStone',
      PIECZARGOTCHI_DEBUG_WEATHER: 'storm',
      PIECZARGOTCHI_DEBUG_CLOUD: '92',
      PIECZARGOTCHI_DEBUG_PRECIPITATION: '8',
      PIECZARGOTCHI_DEBUG_WIND: '54',
      PIECZARGOTCHI_DEBUG_WIND_DIRECTION: '255',
      PIECZARGOTCHI_DEBUG_TEMPERATURE: '21',
      PIECZARGOTCHI_DEBUG_HUMIDITY: '92'
    },
    minimums: {},
    ground: {
      minBottomCoverage: 0.78,
      minEdgeCoverage: 0.36,
      minCenterCoverage: 0.66,
      minWetness: 0.35,
      minWindLevel: 0.48,
      minStormFlattening: 0.48,
      minPatchSwayAbs: 4.0,
      maxHeightScale: 0.94
    }
  },
  {
    name: 'grass-polish-snow',
    fixedAt: Date.parse('2026-01-12T13:20:00+01:00'),
    env: {
      PIECZARGOTCHI_CAPTURE_LIFE_PROFILE: '1',
      PIECZARGOTCHI_CAPTURE_DELAY_MS: '950',
      PIECZARGOTCHI_DEBUG_WEATHER: 'snow',
      PIECZARGOTCHI_DEBUG_CLOUD: '88',
      PIECZARGOTCHI_DEBUG_PRECIPITATION: '3',
      PIECZARGOTCHI_DEBUG_WIND: '18',
      PIECZARGOTCHI_DEBUG_WIND_DIRECTION: '300',
      PIECZARGOTCHI_DEBUG_TEMPERATURE: '-4',
      PIECZARGOTCHI_DEBUG_HUMIDITY: '86',
      PIECZARGOTCHI_DEBUG_SNOW_COVER: '0.72'
    },
    minimums: {},
    ground: {
      minBottomCoverage: 0.82,
      minEdgeCoverage: 0.44,
      minCenterCoverage: 0.72,
      minSnowCover: 0.5,
      minSnowLoad: 0.55,
      maxHeightScale: 0.9
    }
  },
  {
    name: 'grass-polish-fallback',
    fixedAt: Date.parse('2026-06-21T13:00:00+02:00'),
    env: {
      PIECZARGOTCHI_CAPTURE_LIFE_PROFILE: '1',
      PIECZARGOTCHI_CAPTURE_DELAY_MS: '1000',
      PIECZARGOTCHI_CAPTURE_BLOCK_ASSETS: 'grass_patch.png',
      PIECZARGOTCHI_DEBUG_WEATHER: 'clear',
      PIECZARGOTCHI_DEBUG_CLOUD: '12',
      PIECZARGOTCHI_DEBUG_PRECIPITATION: '0',
      PIECZARGOTCHI_DEBUG_WIND: '6',
      PIECZARGOTCHI_DEBUG_WIND_DIRECTION: '90',
      PIECZARGOTCHI_DEBUG_TEMPERATURE: '26',
      PIECZARGOTCHI_DEBUG_HUMIDITY: '66'
    },
    minimums: {},
    ground: {
      minBottomCoverage: 0.72,
      minEdgeCoverage: 0.30,
      minCenterCoverage: 0.58,
      expectFallbackActive: true
    }
  },
  {
    name: 'grass-polish-pointer',
    fixedAt: Date.parse('2026-06-21T15:20:00+02:00'),
    env: {
      PIECZARGOTCHI_CAPTURE_LIFE_PROFILE: '1',
      PIECZARGOTCHI_CAPTURE_DELAY_MS: '1000',
      PIECZARGOTCHI_CAPTURE_GRASS_POINTER: '1',
      PIECZARGOTCHI_CAPTURE_CLEANLINESS: '24',
      PIECZARGOTCHI_DEBUG_WEATHER: 'clear',
      PIECZARGOTCHI_DEBUG_CLOUD: '14',
      PIECZARGOTCHI_DEBUG_PRECIPITATION: '0',
      PIECZARGOTCHI_DEBUG_WIND: '5',
      PIECZARGOTCHI_DEBUG_WIND_DIRECTION: '80',
      PIECZARGOTCHI_DEBUG_TEMPERATURE: '25',
      PIECZARGOTCHI_DEBUG_HUMIDITY: '64'
    },
    minimums: {},
    ground: {
      minBottomCoverage: 0.72,
      minEdgeCoverage: 0.30,
      minCenterCoverage: 0.58,
      minLocalReactions: 1
    },
    conditionOverlay: {
      minIntensity: 0.65,
      maxCleanliness: 30
    }
  }
];

await mkdir(outputDir, { recursive: true });

const server = spawn(process.execPath, ['dev-server.mjs', String(port)], {
  cwd: rootDir,
  env: { ...process.env, PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe']
});
let serverExited = false;
server.on('exit', () => {
  serverExited = true;
});
server.stdout.on('data', (chunk) => process.stdout.write(chunk));
server.stderr.on('data', (chunk) => process.stderr.write(chunk));

try {
  await waitForServer(appUrl, 6000);
  for (const scenario of scenarios) {
    await runScenario(scenario);
  }
  console.log(`life motion captures: ${outputDir}`);
} finally {
  if (!serverExited) {
    server.kill('SIGTERM');
  }
}

async function runScenario(scenario) {
  const captures = Array.isArray(scenario.motionCaptureDelaysMs) && scenario.motionCaptureDelaysMs.length
    ? scenario.motionCaptureDelaysMs
    : [null];
  const stdoutParts = [];
  for (let index = 0; index < captures.length; index += 1) {
    const outputPrefix = path.join(outputDir, captures.length > 1 ? `${scenario.name}-frame${index + 1}` : scenario.name);
    const env = {
      ...process.env,
      ...scenario.env,
      PIECZARGOTCHI_DEBUG_FIXED_AT: String(scenario.fixedAt)
    };
    if (captures[index] !== null) {
      env.PIECZARGOTCHI_CAPTURE_DELAY_MS = String(captures[index]);
    }
    const result = await runCommand(process.execPath, ['scripts/capture-app-render.mjs', appUrl, outputPrefix], env);
    stdoutParts.push(result.stdout);
  }
  const stdout = stdoutParts.join('\n');
  assertLifeProfile(scenario, stdout);
  assertMotionDiagnostics(scenario, stdout);
}

function assertLifeProfile(scenario, stdout) {
  const profiles = stdout
    .split(/\r?\n/)
    .map((line) => line.match(/ life: (\{.*\})$/))
    .filter(Boolean)
    .map((match) => JSON.parse(match[1]));

  if (profiles.length === 0) {
    throw new Error(`${scenario.name}: capture did not report an ambient-life profile`);
  }

  for (const [field, minimum] of Object.entries(scenario.minimums)) {
    const observed = Math.max(...profiles.map((profile) => Number(profile[field]) || 0));
    if (observed < minimum) {
      throw new Error(`${scenario.name}: ${field}=${observed} below ${minimum}`);
    }
  }
}

function assertMotionDiagnostics(scenario, stdout) {
  const expectedFields = [];
  if (Object.prototype.hasOwnProperty.call(scenario.minimums, 'butterflyIntensity')) {
    expectedFields.push('butterflies');
  }
  if (Object.prototype.hasOwnProperty.call(scenario.minimums, 'fireflyIntensity')) {
    expectedFields.push('fireflies');
  }
  if (Object.prototype.hasOwnProperty.call(scenario.minimums, 'batIntensity')) {
    expectedFields.push('bats');
  }
  if (Object.prototype.hasOwnProperty.call(scenario.minimums, 'mothIntensity')) {
    expectedFields.push('moths');
  }
  if (Object.prototype.hasOwnProperty.call(scenario.minimums, 'crawlerIntensity')) {
    expectedFields.push('crawlers');
  }
  if (expectedFields.length === 0 && !scenario.ground && !scenario.conditionOverlay && !scenario.sunbeams) {
    return;
  }

  const diagnostics = stdout
    .split(/\r?\n/)
    .map((line) => line.match(/ motion: (\{.*\})$/))
    .filter(Boolean)
    .map((match) => JSON.parse(match[1]))
    .filter(Boolean);
  if (diagnostics.length === 0) {
    throw new Error(`${scenario.name}: capture did not report render motion diagnostics`);
  }

  for (const field of expectedFields) {
    const observed = Math.max(...diagnostics.map((diagnostic) => Number(diagnostic[field]) || 0));
    if (observed < 1) {
      throw new Error(`${scenario.name}: render diagnostics did not draw any ${field}`);
    }
  }

  if (Object.prototype.hasOwnProperty.call(scenario.minimums, 'butterflyIntensity')) {
    assertButterflyMotionDiagnostics(scenario, diagnostics);
  }
  if (Object.prototype.hasOwnProperty.call(scenario.minimums, 'fireflyIntensity')) {
    assertFireflyMotionDiagnostics(scenario, diagnostics);
  }
  if (Object.prototype.hasOwnProperty.call(scenario.minimums, 'batIntensity')) {
    assertBatMotionDiagnostics(scenario, diagnostics);
  }
  if (Object.prototype.hasOwnProperty.call(scenario.minimums, 'mothIntensity')) {
    assertMothMotionDiagnostics(scenario, diagnostics);
  }
  if (Object.prototype.hasOwnProperty.call(scenario.minimums, 'crawlerIntensity')) {
    assertCrawlerMotionDiagnostics(scenario, diagnostics);
  }
  if (scenario.ground) {
    assertGroundDiagnostics(scenario, diagnostics);
  }
  if (scenario.conditionOverlay) {
    assertConditionOverlayDiagnostics(scenario, diagnostics);
  }
  if (scenario.sunbeams) {
    assertSunbeamDiagnostics(scenario, diagnostics);
  }
}

function assertButterflyMotionDiagnostics(scenario, diagnostics) {
  const butterflyDiagnostics = diagnostics.filter((diagnostic) => {
    return Number(diagnostic.butterflies) > 0 && diagnostic.butterflySummary;
  });
  if (butterflyDiagnostics.length === 0) {
    throw new Error(`${scenario.name}: expected butterfly motion diagnostics`);
  }

  const maxYRange = Math.max(...butterflyDiagnostics.map((diagnostic) => Number(diagnostic.butterflySummary.yRange) || 0));
  if (maxYRange < 54) {
    throw new Error(`${scenario.name}: butterfly paths are too flat, yRange=${maxYRange}`);
  }
  const maxVariantCount = Math.max(...butterflyDiagnostics.map((diagnostic) => countObjectKeys(diagnostic.butterflySummary.variants)));
  if (maxVariantCount < 2) {
    throw new Error(`${scenario.name}: butterfly paths need multiple route variants`);
  }
  const maxDirectionCount = Math.max(...butterflyDiagnostics.map((diagnostic) => countObjectKeys(diagnostic.butterflySummary.directions)));
  if (maxDirectionCount < 2) {
    throw new Error(`${scenario.name}: butterflies should not all fly in one direction`);
  }
  const maxLayerCount = Math.max(...butterflyDiagnostics.map((diagnostic) => countObjectKeys(diagnostic.butterflySummary.layers)));
  if (maxLayerCount < 2) {
    throw new Error(`${scenario.name}: butterflies should render both behind and in front of the mushroom`);
  }
  const maxDepthCount = Math.max(...butterflyDiagnostics.map((diagnostic) => countObjectKeys(diagnostic.butterflySummary.depths)));
  if (maxDepthCount < 2) {
    throw new Error(`${scenario.name}: butterfly depth diagnostics should include front and back passes`);
  }
}

function assertFireflyMotionDiagnostics(scenario, diagnostics) {
  const fireflyDiagnostics = diagnostics.filter((diagnostic) => {
    return Number(diagnostic.fireflies) > 0 && diagnostic.fireflySummary;
  });
  if (fireflyDiagnostics.length < 2) {
    throw new Error(`${scenario.name}: expected multiple firefly motion samples`);
  }

  const alphaRange = Math.max(...fireflyDiagnostics.map((diagnostic) => Number(diagnostic.fireflySummary.alphaRange) || 0));
  if (alphaRange < 0.035) {
    throw new Error(`${scenario.name}: firefly glow alpha did not pulse enough, range=${alphaRange}`);
  }
  const maxGlowRadius = Math.max(...fireflyDiagnostics.map((diagnostic) => Number(diagnostic.fireflySummary.maxGlowRadius) || 0));
  if (maxGlowRadius < 5.2) {
    throw new Error(`${scenario.name}: firefly glow did not render as a visible light source, radius=${maxGlowRadius}`);
  }
  const maxLightRadius = Math.max(...fireflyDiagnostics.map((diagnostic) => Number(diagnostic.fireflySummary.maxLightRadius) || 0));
  if (maxLightRadius < 12) {
    throw new Error(`${scenario.name}: firefly environmental light is too weak, radius=${maxLightRadius}`);
  }
  const maxYRange = Math.max(...fireflyDiagnostics.map((diagnostic) => Number(diagnostic.fireflySummary.yRange) || 0));
  if (maxYRange < 48) {
    throw new Error(`${scenario.name}: fireflies are moving in too narrow a vertical band, yRange=${maxYRange}`);
  }
  const maxRouteCount = Math.max(...fireflyDiagnostics.map((diagnostic) => countObjectKeys(diagnostic.fireflySummary.routes)));
  if (maxRouteCount < 3) {
    throw new Error(`${scenario.name}: fireflies need more route variety`);
  }
  const maxDirectionCount = Math.max(...fireflyDiagnostics.map((diagnostic) => countObjectKeys(diagnostic.fireflySummary.directions)));
  if (maxDirectionCount < 2) {
    throw new Error(`${scenario.name}: fireflies should drift in both horizontal directions`);
  }
  const maxLayerCount = Math.max(...fireflyDiagnostics.map((diagnostic) => countObjectKeys(diagnostic.fireflySummary.layers)));
  if (maxLayerCount < 2) {
    throw new Error(`${scenario.name}: fireflies should render both behind and in front of the mushroom`);
  }
  const maxDepthCount = Math.max(...fireflyDiagnostics.map((diagnostic) => countObjectKeys(diagnostic.fireflySummary.depths)));
  if (maxDepthCount < 2) {
    throw new Error(`${scenario.name}: firefly depth diagnostics should include front and back passes`);
  }

  const samplesBySeed = new Map();
  for (const diagnostic of fireflyDiagnostics) {
    for (const sample of diagnostic.fireflySamples || []) {
      if (!Number.isFinite(Number(sample.seed))) {
        continue;
      }
      const samples = samplesBySeed.get(sample.seed) || [];
      samples.push({ x: Number(sample.x), y: Number(sample.y), alpha: Number(sample.alpha) });
      samplesBySeed.set(sample.seed, samples);
    }
  }

  let maxMovement = 0;
  for (const samples of samplesBySeed.values()) {
    for (let index = 1; index < samples.length; index += 1) {
      const first = samples[0];
      const current = samples[index];
      if (!Number.isFinite(first.x) || !Number.isFinite(first.y) || !Number.isFinite(current.x) || !Number.isFinite(current.y)) {
        continue;
      }
      maxMovement = Math.max(maxMovement, Math.hypot(current.x - first.x, current.y - first.y));
    }
  }
  if (maxMovement < 0.25) {
    throw new Error(`${scenario.name}: fireflies did not visibly drift between capture frames, movement=${maxMovement.toFixed(3)}`);
  }
}

function assertBatMotionDiagnostics(scenario, diagnostics) {
  const batDiagnostics = diagnostics.filter((diagnostic) => {
    return Number(diagnostic.bats) > 0 && diagnostic.batSummary;
  });
  if (batDiagnostics.length === 0) {
    throw new Error(`${scenario.name}: expected bat motion diagnostics`);
  }

  const maxYRange = Math.max(...batDiagnostics.map((diagnostic) => Number(diagnostic.batSummary.yRange) || 0));
  if (maxYRange < 10) {
    throw new Error(`${scenario.name}: bat paths are too flat, yRange=${maxYRange}`);
  }
  const maxAlphaRange = Math.max(...batDiagnostics.map((diagnostic) => Number(diagnostic.batSummary.alphaRange) || 0));
  if (maxAlphaRange < 0.07) {
    throw new Error(`${scenario.name}: bat silhouettes do not fade naturally, alphaRange=${maxAlphaRange}`);
  }
  const maxDirectionCount = Math.max(...batDiagnostics.map((diagnostic) => countObjectKeys(diagnostic.batSummary.directions)));
  if (maxDirectionCount < 2) {
    throw new Error(`${scenario.name}: bats should not all fly in one direction`);
  }
}

function assertMothMotionDiagnostics(scenario, diagnostics) {
  const mothDiagnostics = diagnostics.filter((diagnostic) => {
    return Number(diagnostic.moths) > 0 && diagnostic.mothSummary;
  });
  if (mothDiagnostics.length === 0) {
    throw new Error(`${scenario.name}: expected moth motion diagnostics`);
  }

  const maxYRange = Math.max(...mothDiagnostics.map((diagnostic) => Number(diagnostic.mothSummary.yRange) || 0));
  if (maxYRange < 60) {
    throw new Error(`${scenario.name}: moth paths are too flat, yRange=${maxYRange}`);
  }
  const maxRouteCount = Math.max(...mothDiagnostics.map((diagnostic) => countObjectKeys(diagnostic.mothSummary.routes)));
  if (maxRouteCount < 3) {
    throw new Error(`${scenario.name}: moths need more route variety`);
  }
  const maxDirectionCount = Math.max(...mothDiagnostics.map((diagnostic) => countObjectKeys(diagnostic.mothSummary.directions)));
  if (maxDirectionCount < 2) {
    throw new Error(`${scenario.name}: moths should drift in both horizontal directions`);
  }
  const maxLayerCount = Math.max(...mothDiagnostics.map((diagnostic) => countObjectKeys(diagnostic.mothSummary.layers)));
  if (maxLayerCount < 2) {
    throw new Error(`${scenario.name}: moths should render both behind and in front of the mushroom`);
  }
  const maxDepthCount = Math.max(...mothDiagnostics.map((diagnostic) => countObjectKeys(diagnostic.mothSummary.depths)));
  if (maxDepthCount < 2) {
    throw new Error(`${scenario.name}: moth depth diagnostics should include front and back passes`);
  }
}

function assertCrawlerMotionDiagnostics(scenario, diagnostics) {
  const crawlerDiagnostics = diagnostics.filter((diagnostic) => {
    return Number(diagnostic.crawlers) > 0 && diagnostic.crawlerSummary;
  });
  if (crawlerDiagnostics.length === 0) {
    throw new Error(`${scenario.name}: expected crawler motion diagnostics`);
  }

  const maxRouteCount = Math.max(...crawlerDiagnostics.map((diagnostic) => countObjectKeys(diagnostic.crawlerSummary.routes)));
  if (maxRouteCount < 2) {
    throw new Error(`${scenario.name}: crawlers need multiple grass/edge routes`);
  }
  const maxDirectionCount = Math.max(...crawlerDiagnostics.map((diagnostic) => countObjectKeys(diagnostic.crawlerSummary.directions)));
  if (maxDirectionCount < 2) {
    throw new Error(`${scenario.name}: crawlers should not all move in one direction`);
  }
  const maxXRange = Math.max(...crawlerDiagnostics.map((diagnostic) => Number(diagnostic.crawlerSummary.xRange) || 0));
  if (maxXRange < 70) {
    throw new Error(`${scenario.name}: crawlers are not spanning enough grass, xRange=${maxXRange}`);
  }
}

function assertConditionOverlayDiagnostics(scenario, diagnostics) {
  const overlayDiagnostics = diagnostics
    .map((diagnostic) => diagnostic.conditionOverlay)
    .filter(Boolean);
  if (overlayDiagnostics.length === 0) {
    throw new Error(`${scenario.name}: capture did not report condition overlay diagnostics`);
  }

  const maxIntensity = Math.max(...overlayDiagnostics.map((overlay) => Number(overlay.dirtIntensity) || 0));
  if (Number(scenario.conditionOverlay.minIntensity) && maxIntensity < scenario.conditionOverlay.minIntensity) {
    throw new Error(`${scenario.name}: dirt overlay intensity ${maxIntensity} below ${scenario.conditionOverlay.minIntensity}`);
  }
  const minCleanliness = Math.min(...overlayDiagnostics.map((overlay) => Number(overlay.cleanliness) || 100));
  if (Number(scenario.conditionOverlay.maxCleanliness) && minCleanliness > scenario.conditionOverlay.maxCleanliness) {
    throw new Error(`${scenario.name}: dirt overlay cleanliness ${minCleanliness} above ${scenario.conditionOverlay.maxCleanliness}`);
  }
}

function assertSunbeamDiagnostics(scenario, diagnostics) {
  const sunbeamDiagnostics = diagnostics.filter((diagnostic) => diagnostic && diagnostic.sunbeams);
  if (sunbeamDiagnostics.length === 0) {
    throw new Error(`${scenario.name}: capture did not report sunbeam diagnostics`);
  }

  const visible = sunbeamDiagnostics.filter((diagnostic) => diagnostic.sunbeams.visible === true);
  if (visible.length === 0) {
    const reasons = sunbeamDiagnostics.map((diagnostic) => diagnostic.sunbeams.reason || 'unknown').join(', ');
    throw new Error(`${scenario.name}: expected visible sunbeams, got ${reasons}`);
  }

  const maxIntensity = Math.max(...visible.map((diagnostic) => Number(diagnostic.sunbeams.intensity) || 0));
  if (Number(scenario.sunbeams.minIntensity) && maxIntensity < scenario.sunbeams.minIntensity) {
    throw new Error(`${scenario.name}: sunbeam intensity ${maxIntensity} below ${scenario.sunbeams.minIntensity}`);
  }
  const maxAnchorScore = Math.max(...visible.map((diagnostic) => Number(diagnostic.sunbeams.anchorScore) || 0));
  if (Number(scenario.sunbeams.minAnchorScore) && maxAnchorScore < scenario.sunbeams.minAnchorScore) {
    throw new Error(`${scenario.name}: sunbeam cloud anchor score ${maxAnchorScore} below ${scenario.sunbeams.minAnchorScore}`);
  }

  const anchoredToRenderedCloud = visible.some((diagnostic) => {
    const sunbeam = diagnostic.sunbeams;
    const layers = diagnostic.clouds && Array.isArray(diagnostic.clouds.layers)
      ? diagnostic.clouds.layers
      : [];
    return layers.some((layer) => {
      return Number(layer.index) === Number(sunbeam.cloudLayer)
        && layer.form === sunbeam.cloudForm
        && Number(layer.active) > 0;
    });
  });
  if (!anchoredToRenderedCloud) {
    throw new Error(`${scenario.name}: sunbeam anchor did not match a rendered cloud layer`);
  }
}

function countObjectKeys(value) {
  if (!value || typeof value !== 'object') {
    return 0;
  }
  return Object.keys(value).length;
}

function assertGroundDiagnostics(scenario, diagnostics) {
  const groundDiagnostics = diagnostics.filter((diagnostic) => diagnostic && diagnostic.ground);
  if (groundDiagnostics.length === 0) {
    throw new Error(`${scenario.name}: capture did not report ground diagnostics`);
  }

  const criteria = scenario.ground || {};
  const metrics = groundDiagnostics
    .map((diagnostic) => diagnostic.grassMetrics)
    .filter(Boolean);
  if (metrics.length === 0) {
    throw new Error(`${scenario.name}: capture did not report grass pixel metrics`);
  }

  const maxBottomCoverage = Math.max(...metrics.map((metric) => Number(metric.bottom && metric.bottom.coverage) || 0));
  const maxLeftCoverage = Math.max(...metrics.map((metric) => Number(metric.left && metric.left.coverage) || 0));
  const maxRightCoverage = Math.max(...metrics.map((metric) => Number(metric.right && metric.right.coverage) || 0));
  const maxCenterCoverage = Math.max(...metrics.map((metric) => Number(metric.center && metric.center.coverage) || 0));
  const minEdgeCoverage = Math.min(maxLeftCoverage, maxRightCoverage);
  if (Number(criteria.minBottomCoverage) && maxBottomCoverage < criteria.minBottomCoverage) {
    throw new Error(`${scenario.name}: grass bottom coverage ${maxBottomCoverage} below ${criteria.minBottomCoverage}`);
  }
  if (Number(criteria.minEdgeCoverage) && minEdgeCoverage < criteria.minEdgeCoverage) {
    throw new Error(`${scenario.name}: grass edge coverage ${minEdgeCoverage} below ${criteria.minEdgeCoverage}`);
  }
  if (Number(criteria.minCenterCoverage) && maxCenterCoverage < criteria.minCenterCoverage) {
    throw new Error(`${scenario.name}: grass center coverage ${maxCenterCoverage} below ${criteria.minCenterCoverage}`);
  }

  const fields = groundDiagnostics
    .map((diagnostic) => diagnostic.ground && diagnostic.ground.field)
    .filter(Boolean);
  if (fields.length === 0) {
    throw new Error(`${scenario.name}: capture did not report grass field diagnostics`);
  }
  const maxField = (name) => Math.max(...fields.map((field) => Number(field[name]) || 0));
  const minField = (name) => Math.min(...fields.map((field) => Number(field[name]) || 0));
  const maxPatchSwayAbs = Math.max(...fields.map((field) => Math.abs(Number(field.patchSway) || 0)));

  if (Number(criteria.minWetness) && maxField('wetness') < criteria.minWetness) {
    throw new Error(`${scenario.name}: grass wetness ${maxField('wetness')} below ${criteria.minWetness}`);
  }
  if (Number(criteria.minWindLevel) && maxField('windLevel') < criteria.minWindLevel) {
    throw new Error(`${scenario.name}: grass windLevel ${maxField('windLevel')} below ${criteria.minWindLevel}`);
  }
  if (Number(criteria.minStormFlattening) && maxField('stormFlattening') < criteria.minStormFlattening) {
    throw new Error(`${scenario.name}: storm flattening ${maxField('stormFlattening')} below ${criteria.minStormFlattening}`);
  }
  if (Number(criteria.minPatchSwayAbs) && maxPatchSwayAbs < criteria.minPatchSwayAbs) {
    throw new Error(`${scenario.name}: grass patch sway ${maxPatchSwayAbs} below ${criteria.minPatchSwayAbs}`);
  }
  if (Number(criteria.minSnowCover) && maxField('snowCover') < criteria.minSnowCover) {
    throw new Error(`${scenario.name}: snowCover ${maxField('snowCover')} below ${criteria.minSnowCover}`);
  }
  if (Number(criteria.minSnowLoad) && maxField('snowLoad') < criteria.minSnowLoad) {
    throw new Error(`${scenario.name}: snowLoad ${maxField('snowLoad')} below ${criteria.minSnowLoad}`);
  }
  if (Number(criteria.maxHeightScale) && minField('heightScale') > criteria.maxHeightScale) {
    throw new Error(`${scenario.name}: grass heightScale ${minField('heightScale')} above ${criteria.maxHeightScale}`);
  }
  if (Number(criteria.minLocalReactions) && maxField('localReactions') < criteria.minLocalReactions) {
    throw new Error(`${scenario.name}: grass localReactions ${maxField('localReactions')} below ${criteria.minLocalReactions}`);
  }
  if (criteria.expectFallbackActive) {
    const observedFallback = groundDiagnostics.some((diagnostic) => {
      return diagnostic.ground && diagnostic.ground.fallbackActive && !diagnostic.ground.grassPatchLoaded;
    });
    if (!observedFallback) {
      throw new Error(`${scenario.name}: expected grass patch fallback diagnostics`);
    }
  }
}

function runCommand(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      const text = String(chunk);
      stdout += text;
      process.stdout.write(text);
    });
    child.stderr.on('data', (chunk) => {
      const text = String(chunk);
      stderr += text;
      process.stderr.write(text);
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} exited with ${code}\n${stderr}`));
    });
  });
}

function waitForServer(url, timeoutMs) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (serverExited) {
        reject(new Error('Local preview server exited before it became ready'));
        return;
      }
      get(url, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode < 500) {
          resolve();
          return;
        }
        retry();
      }).on('error', retry);
    };
    const retry = () => {
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }
      setTimeout(attempt, 150);
    };
    attempt();
  });
}

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      probe.close(() => {
        if (!address || typeof address === 'string') {
          reject(new Error('Could not allocate a local TCP port'));
          return;
        }
        resolve(address.port);
      });
    });
  });
}
