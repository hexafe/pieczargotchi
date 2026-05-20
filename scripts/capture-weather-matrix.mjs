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
    id: 'transition-dawn-blue-hour',
    env: {
      PIECZARGOTCHI_DEBUG_WEATHER: 'clear',
      PIECZARGOTCHI_DEBUG_CLOUD: '4',
      PIECZARGOTCHI_DEBUG_LOCATION: 'katowice',
      PIECZARGOTCHI_DEBUG_FIXED_AT: Date.parse('2026-06-21T03:52:00')
    }
  },
  {
    id: 'transition-sunrise-gold',
    env: {
      PIECZARGOTCHI_DEBUG_WEATHER: 'clear',
      PIECZARGOTCHI_DEBUG_CLOUD: '8',
      PIECZARGOTCHI_DEBUG_LOCATION: 'katowice',
      PIECZARGOTCHI_DEBUG_FIXED_AT: Date.parse('2026-06-21T04:42:00')
    }
  },
  {
    id: 'transition-morning-soft',
    env: {
      PIECZARGOTCHI_DEBUG_WEATHER: 'clear',
      PIECZARGOTCHI_DEBUG_CLOUD: '12',
      PIECZARGOTCHI_DEBUG_LOCATION: 'katowice',
      PIECZARGOTCHI_DEBUG_FIXED_AT: Date.parse('2026-06-21T05:50:00')
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
    id: 'transition-sunset-gold',
    env: {
      PIECZARGOTCHI_DEBUG_WEATHER: 'clear',
      PIECZARGOTCHI_DEBUG_CLOUD: '16',
      PIECZARGOTCHI_DEBUG_LOCATION: 'katowice',
      PIECZARGOTCHI_DEBUG_FIXED_AT: Date.parse('2026-06-21T20:05:00')
    }
  },
  {
    id: 'transition-dusk-blue-hour',
    env: {
      PIECZARGOTCHI_DEBUG_WEATHER: 'clear',
      PIECZARGOTCHI_DEBUG_CLOUD: '10',
      PIECZARGOTCHI_DEBUG_LOCATION: 'katowice',
      PIECZARGOTCHI_DEBUG_FIXED_AT: Date.parse('2026-06-21T21:04:00')
    }
  },
  {
    id: 'transition-night-settled',
    env: {
      PIECZARGOTCHI_DEBUG_WEATHER: 'clear',
      PIECZARGOTCHI_DEBUG_CLOUD: '4',
      PIECZARGOTCHI_DEBUG_LOCATION: 'katowice',
      PIECZARGOTCHI_DEBUG_FIXED_AT: Date.parse('2026-06-21T22:10:00')
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
    id: 'drizzle-morning-dew',
    env: {
      PIECZARGOTCHI_DEBUG_WEATHER: 'rain',
      PIECZARGOTCHI_DEBUG_PRECIPITATION: '0.18',
      PIECZARGOTCHI_DEBUG_CLOUD: '72',
      PIECZARGOTCHI_DEBUG_WIND: '8',
      PIECZARGOTCHI_DEBUG_HUMIDITY: '94',
      PIECZARGOTCHI_DEBUG_TEMPERATURE: '10',
      PIECZARGOTCHI_DEBUG_DEW_POINT: '9.4',
      PIECZARGOTCHI_DEBUG_VISIBILITY: '5200',
      PIECZARGOTCHI_DEBUG_SURFACE_WETNESS: '0.46',
      PIECZARGOTCHI_DEBUG_FIXED_AT: Date.parse('2026-09-12T07:20:00')
    }
  },
  {
    id: 'heavy-rain-sheets-low-visibility',
    env: {
      PIECZARGOTCHI_DEBUG_WEATHER: 'rain',
      PIECZARGOTCHI_DEBUG_PRECIPITATION: '9.4',
      PIECZARGOTCHI_DEBUG_CLOUD: '96',
      PIECZARGOTCHI_DEBUG_WIND: '42',
      PIECZARGOTCHI_DEBUG_WIND_DIRECTION: '250',
      PIECZARGOTCHI_DEBUG_HUMIDITY: '96',
      PIECZARGOTCHI_DEBUG_VISIBILITY: '1800',
      PIECZARGOTCHI_DEBUG_SURFACE_WETNESS: '1',
      PIECZARGOTCHI_DEBUG_FIXED_AT: Date.parse('2026-09-12T16:30:00')
    }
  },
  {
    id: 'post-rain-wet-ground-clearing',
    env: {
      PIECZARGOTCHI_DEBUG_WEATHER: 'clear',
      PIECZARGOTCHI_DEBUG_CLOUD: '34',
      PIECZARGOTCHI_DEBUG_WIND: '12',
      PIECZARGOTCHI_DEBUG_HUMIDITY: '88',
      PIECZARGOTCHI_DEBUG_TEMPERATURE: '17',
      PIECZARGOTCHI_DEBUG_SURFACE_WETNESS: '0.74',
      PIECZARGOTCHI_DEBUG_FIXED_AT: Date.parse('2026-09-12T18:10:00')
    }
  },
  {
    id: 'rainbow-light-rain-sunset',
    env: {
      PIECZARGOTCHI_DEBUG_WEATHER: 'rain',
      PIECZARGOTCHI_DEBUG_PRECIPITATION: '1.1',
      PIECZARGOTCHI_DEBUG_CLOUD: '46',
      PIECZARGOTCHI_DEBUG_WIND: '10',
      PIECZARGOTCHI_DEBUG_HUMIDITY: '84',
      PIECZARGOTCHI_DEBUG_VISIBILITY: '8200',
      PIECZARGOTCHI_DEBUG_FIXED_AT: Date.parse('2026-09-12T17:40:00')
    }
  },
  {
    id: 'rainbow-after-shower-low-sun',
    env: {
      PIECZARGOTCHI_DEBUG_WEATHER: 'clear',
      PIECZARGOTCHI_DEBUG_CLOUD: '30',
      PIECZARGOTCHI_DEBUG_WIND: '8',
      PIECZARGOTCHI_DEBUG_HUMIDITY: '88',
      PIECZARGOTCHI_DEBUG_SURFACE_WETNESS: '0.72',
      PIECZARGOTCHI_DEBUG_RAINBOW: 'force',
      PIECZARGOTCHI_DEBUG_FIXED_AT: Date.parse('2026-09-12T18:05:00')
    }
  },
  {
    id: 'double-rainbow-clearing',
    env: {
      PIECZARGOTCHI_DEBUG_WEATHER: 'rain',
      PIECZARGOTCHI_DEBUG_PRECIPITATION: '2.8',
      PIECZARGOTCHI_DEBUG_CLOUD: '42',
      PIECZARGOTCHI_DEBUG_WIND: '14',
      PIECZARGOTCHI_DEBUG_HUMIDITY: '90',
      PIECZARGOTCHI_DEBUG_VISIBILITY: '9000',
      PIECZARGOTCHI_DEBUG_RAINBOW: 'force',
      PIECZARGOTCHI_DEBUG_FIXED_AT: Date.parse('2026-09-12T17:55:00')
    }
  },
  {
    id: 'rainbow-hidden-high-sun',
    env: {
      PIECZARGOTCHI_DEBUG_WEATHER: 'rain',
      PIECZARGOTCHI_DEBUG_PRECIPITATION: '1.4',
      PIECZARGOTCHI_DEBUG_CLOUD: '30',
      PIECZARGOTCHI_DEBUG_WIND: '8',
      PIECZARGOTCHI_DEBUG_HUMIDITY: '84',
      PIECZARGOTCHI_DEBUG_FIXED_AT: Date.parse('2026-06-21T12:30:00')
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
    id: 'rainbow-hidden-overcast-storm',
    env: {
      PIECZARGOTCHI_DEBUG_WEATHER: 'storm',
      PIECZARGOTCHI_DEBUG_PRECIPITATION: '5.6',
      PIECZARGOTCHI_DEBUG_CLOUD: '100',
      PIECZARGOTCHI_DEBUG_WIND: '62',
      PIECZARGOTCHI_DEBUG_HUMIDITY: '94',
      PIECZARGOTCHI_DEBUG_FIXED_AT: Date.parse('2026-09-12T17:50:00')
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
    id: 'blowing-snow-gale',
    env: {
      PIECZARGOTCHI_DEBUG_WEATHER: 'snow',
      PIECZARGOTCHI_DEBUG_PRECIPITATION: '2.8',
      PIECZARGOTCHI_DEBUG_CLOUD: '92',
      PIECZARGOTCHI_DEBUG_WIND: '62',
      PIECZARGOTCHI_DEBUG_WIND_DIRECTION: '315',
      PIECZARGOTCHI_DEBUG_TEMPERATURE: '-4',
      PIECZARGOTCHI_DEBUG_SNOW_DEPTH: '0.08',
      PIECZARGOTCHI_DEBUG_SNOW_COVER: '0.88',
      PIECZARGOTCHI_DEBUG_LOCATION: 'tromso',
      PIECZARGOTCHI_DEBUG_FIXED_AT: Date.parse('2026-01-19T15:40:00')
    }
  },
  {
    id: 'warm-old-snow-melting',
    env: {
      PIECZARGOTCHI_DEBUG_WEATHER: 'clear',
      PIECZARGOTCHI_DEBUG_CLOUD: '28',
      PIECZARGOTCHI_DEBUG_WIND: '9',
      PIECZARGOTCHI_DEBUG_TEMPERATURE: '4',
      PIECZARGOTCHI_DEBUG_SNOW_DEPTH: '0.03',
      PIECZARGOTCHI_DEBUG_SNOW_COVER: '0.28',
      PIECZARGOTCHI_DEBUG_SURFACE_WETNESS: '0.52',
      PIECZARGOTCHI_DEBUG_FIXED_AT: Date.parse('2026-02-08T11:30:00')
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
    id: 'fog-low-visibility-dawn',
    env: {
      PIECZARGOTCHI_DEBUG_WEATHER: 'cloudy',
      PIECZARGOTCHI_DEBUG_CLOUD: '92',
      PIECZARGOTCHI_DEBUG_WIND: '4',
      PIECZARGOTCHI_DEBUG_HUMIDITY: '97',
      PIECZARGOTCHI_DEBUG_TEMPERATURE: '7',
      PIECZARGOTCHI_DEBUG_DEW_POINT: '6.4',
      PIECZARGOTCHI_DEBUG_VISIBILITY: '700',
      PIECZARGOTCHI_DEBUG_FIXED_AT: Date.parse('2026-10-08T06:05:00')
    }
  },
  {
    id: 'clear-high-pressure-crisp',
    env: {
      PIECZARGOTCHI_DEBUG_WEATHER: 'clear',
      PIECZARGOTCHI_DEBUG_CLOUD: '6',
      PIECZARGOTCHI_DEBUG_WIND: '5',
      PIECZARGOTCHI_DEBUG_PRESSURE: '1032',
      PIECZARGOTCHI_DEBUG_HUMIDITY: '46',
      PIECZARGOTCHI_DEBUG_TEMPERATURE: '19',
      PIECZARGOTCHI_DEBUG_FIXED_AT: Date.parse('2026-06-21T13:30:00')
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
    id: 'perseids-clear-night',
    env: {
      PIECZARGOTCHI_DEBUG_WEATHER: 'clear',
      PIECZARGOTCHI_DEBUG_CLOUD: '2',
      PIECZARGOTCHI_DEBUG_LOCATION: 'katowice',
      PIECZARGOTCHI_DEBUG_MOON_PHASE: 'new',
      PIECZARGOTCHI_DEBUG_SKY_EFFECT: 'perseids',
      PIECZARGOTCHI_DEBUG_FIXED_AT: Date.parse('2026-08-12T23:15:00')
    }
  },
  {
    id: 'aurora-tromso-clear-night',
    env: {
      PIECZARGOTCHI_DEBUG_WEATHER: 'clear',
      PIECZARGOTCHI_DEBUG_CLOUD: '8',
      PIECZARGOTCHI_DEBUG_LOCATION: 'tromso',
      PIECZARGOTCHI_DEBUG_MOON_PHASE: 'crescent',
      PIECZARGOTCHI_DEBUG_SKY_EFFECT: 'aurora',
      PIECZARGOTCHI_DEBUG_FIXED_AT: Date.parse('2026-01-18T23:40:00')
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
  await runScenarioWithRetry(scenario);
}

console.log(`Weather matrix complete: ${scenarios.length} scenarios, prefix ${outputPrefix}`);

async function runScenarioWithRetry(scenario) {
  const attempts = 2;
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await runScenario(scenario, attempt);
      return;
    } catch (error) {
      lastError = error;
      if (attempt >= attempts) {
        break;
      }
      console.warn(`${scenario.id} failed on attempt ${attempt}, retrying: ${error.message}`);
      await delay(700);
    }
  }
  throw lastError;
}

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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
