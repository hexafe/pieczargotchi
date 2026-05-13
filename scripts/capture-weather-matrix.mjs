import { spawn } from 'node:child_process';
import path from 'node:path';
import { tmpdir } from 'node:os';

const appUrl = process.argv[2] || 'http://127.0.0.1:8092/';
const outputPrefix = process.argv[3] || path.join(tmpdir(), 'pieczargotchi-weather-matrix');

const scenarios = [
  {
    id: 'clear-noon-cloud0-wind0',
    env: {
      PIECZARGOTCHI_DEBUG_WEATHER: 'clear',
      PIECZARGOTCHI_DEBUG_CLOUD: '0',
      PIECZARGOTCHI_DEBUG_WIND: '0',
      PIECZARGOTCHI_DEBUG_FIXED_AT: Date.parse('2026-06-21T12:00:00')
    }
  },
  {
    id: 'cloudy-sunset-cloud100-wind40',
    env: {
      PIECZARGOTCHI_DEBUG_WEATHER: 'cloudy',
      PIECZARGOTCHI_DEBUG_CLOUD: '100',
      PIECZARGOTCHI_DEBUG_WIND: '40',
      PIECZARGOTCHI_DEBUG_WIND_DIRECTION: '90',
      PIECZARGOTCHI_DEBUG_FIXED_AT: Date.parse('2026-06-21T20:00:00')
    }
  },
  {
    id: 'rain-afternoon-wind-west',
    env: {
      PIECZARGOTCHI_DEBUG_WEATHER: 'rain',
      PIECZARGOTCHI_DEBUG_PRECIPITATION: '3.4',
      PIECZARGOTCHI_DEBUG_CLOUD: '85',
      PIECZARGOTCHI_DEBUG_WIND: '38',
      PIECZARGOTCHI_DEBUG_WIND_DIRECTION: '270',
      PIECZARGOTCHI_DEBUG_FIXED_AT: Date.parse('2026-09-12T15:00:00')
    }
  },
  {
    id: 'storm-night-wind100',
    env: {
      PIECZARGOTCHI_DEBUG_WEATHER: 'storm',
      PIECZARGOTCHI_DEBUG_PRECIPITATION: '7.2',
      PIECZARGOTCHI_DEBUG_CLOUD: '100',
      PIECZARGOTCHI_DEBUG_WIND: '100',
      PIECZARGOTCHI_DEBUG_WIND_DIRECTION: '180',
      PIECZARGOTCHI_DEBUG_FIXED_AT: Date.parse('2026-07-20T23:00:00')
    }
  },
  {
    id: 'snow-night-full-moon',
    env: {
      PIECZARGOTCHI_DEBUG_WEATHER: 'snow',
      PIECZARGOTCHI_DEBUG_PRECIPITATION: '2.1',
      PIECZARGOTCHI_DEBUG_CLOUD: '45',
      PIECZARGOTCHI_DEBUG_WIND: '14',
      PIECZARGOTCHI_DEBUG_LOCATION: 'tromso',
      PIECZARGOTCHI_DEBUG_MOON_PHASE: 'full',
      PIECZARGOTCHI_DEBUG_FIXED_AT: Date.parse('2026-01-18T23:30:00')
    }
  },
  {
    id: 'fog-sunrise',
    env: {
      PIECZARGOTCHI_DEBUG_WEATHER: 'fog',
      PIECZARGOTCHI_DEBUG_CLOUD: '90',
      PIECZARGOTCHI_DEBUG_WIND: '4',
      PIECZARGOTCHI_DEBUG_FIXED_AT: Date.parse('2026-10-08T06:30:00')
    }
  },
  {
    id: 'stars-orion-new-moon',
    env: {
      PIECZARGOTCHI_DEBUG_WEATHER: 'clear',
      PIECZARGOTCHI_DEBUG_CLOUD: '0',
      PIECZARGOTCHI_DEBUG_LOCATION: 'equator',
      PIECZARGOTCHI_DEBUG_MOON_PHASE: 'new',
      PIECZARGOTCHI_DEBUG_CONSTELLATION: 'orion',
      PIECZARGOTCHI_DEBUG_FIXED_AT: Date.parse('2026-12-05T23:00:00')
    }
  },
  {
    id: 'crescent-cygnus-windy',
    env: {
      PIECZARGOTCHI_DEBUG_WEATHER: 'clear',
      PIECZARGOTCHI_DEBUG_CLOUD: '18',
      PIECZARGOTCHI_DEBUG_WIND: '55',
      PIECZARGOTCHI_DEBUG_WIND_DIRECTION: '0',
      PIECZARGOTCHI_DEBUG_LOCATION: 'katowice',
      PIECZARGOTCHI_DEBUG_MOON_PHASE: 'crescent',
      PIECZARGOTCHI_DEBUG_CONSTELLATION: 'cygnus',
      PIECZARGOTCHI_DEBUG_FIXED_AT: Date.parse('2026-08-15T22:30:00')
    }
  }
];

for (const scenario of scenarios) {
  await runScenario(scenario);
}

console.log(`Weather matrix complete: ${scenarios.length} scenarios, prefix ${outputPrefix}`);

function runScenario(scenario) {
  const env = Object.assign({}, process.env, scenario.env, {
    PIECZARGOTCHI_CAPTURE_VIEWPORT: '1'
  });
  const args = [
    'scripts/capture-app-render.mjs',
    appUrl,
    `${outputPrefix}-${scenario.id}`
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      env,
      stdio: 'inherit'
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${scenario.id} failed with exit code ${code}`));
      }
    });
  });
}
