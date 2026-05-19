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
      flyingInsectIntensity: 0.18
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
  if (expectedFields.length === 0) {
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

  if (Object.prototype.hasOwnProperty.call(scenario.minimums, 'fireflyIntensity')) {
    assertFireflyMotionDiagnostics(scenario, diagnostics);
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
