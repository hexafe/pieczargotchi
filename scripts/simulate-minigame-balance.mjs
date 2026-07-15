import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import { buildCloudflareStaticArtifacts } from './build-cloudflare-static.mjs';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const config = buildCloudflareStaticArtifacts().config;
const minigames = config.rules && config.rules.minigames || {};
const samples = Math.max(32, Number(process.env.PIECZARGOTCHI_BALANCE_SAMPLES) || 10000);
const ids = Object.keys(minigames).filter((id) => minigames[id] && minigames[id].interactionKind);
const simulator = createGeneratedRunSimulator(config.rules);
const failures = [];
const trailWeatherStats = {};
let trailOptimalSafeChoices = 0;
let trailOptimalRiskyChoices = 0;
let trailExactCeilingRuns = 0;
let trailRunCount = 0;

const rows = ids.map((id, gameIndex) => {
  const rules = minigames[id];
  const flawlessScores = [];
  const profiles = getHabitatProfiles(id);
  for (let index = 0; index < samples; index += 1) {
    const seed = 1000 + gameIndex * 100003 + index * 37;
    profiles.forEach((habitatTags) => {
      const flawless = simulator.getFlawlessResult(id, seed, habitatTags);
      flawlessScores.push(flawless.score);
      if (!flawless.reachable || flawless.resolved !== flawless.total) {
        failures.push(`${id}: seed ${seed} ma nieosiągalną decyzję dla habitatu ${JSON.stringify(habitatTags)}`);
      }
      if (id === 'sporeTrail') {
        trailRunCount += 1;
        if (flawless.exactCeiling && flawless.validProfile) {
          trailExactCeilingRuns += 1;
        } else {
          failures.push(`${id}: seed ${seed} / ${flawless.weatherCondition} nie zgadza się z dokładnym sufitem lub profilem gałęzi`);
        }
        const condition = flawless.weatherCondition || 'clear';
        const weatherStats = trailWeatherStats[condition] || { open: 0, closed: 0, runs: 0 };
        weatherStats.open += flawless.openCount;
        weatherStats.closed += flawless.closedCount;
        weatherStats.runs += 1;
        trailWeatherStats[condition] = weatherStats;
        trailOptimalRiskyChoices += flawless.openCount;
        trailOptimalSafeChoices += flawless.closedCount;
      }
    });
  }

  const casual = Number(rules.scoreTargetCasual) || 0;
  const flawlessLow = Math.min(...flawlessScores);
  if (flawlessLow < casual) {
    failures.push(`${id}: bezbłędna runda spada do ${flawlessLow}, poniżej clear ${casual}`);
  }

  return {
    id,
    kind: rules.interactionKind,
    casual,
    profileCount: profiles.length,
    flawlessMedian: median(flawlessScores),
    flawlessLow,
    flawlessHigh: Math.max(...flawlessScores)
  };
});

const trailClear = trailWeatherStats.clear || { open: 0, closed: 0 };
const trailStorm = trailWeatherStats.storm || { open: 0, closed: 0 };
const clearOpenRate = trailClear.open / Math.max(1, trailClear.open + trailClear.closed);
const stormOpenRate = trailStorm.open / Math.max(1, trailStorm.open + trailStorm.closed);
if (!trailOptimalSafeChoices || !trailOptimalRiskyChoices) {
  failures.push('sporeTrail: optymalna jawna strategia musi używać zarówno pewnego szlaku, jak i otwartego skrótu');
}
if (!(clearOpenRate > stormOpenRate)) {
  failures.push(`sporeTrail: pogoda nie zmienia częstości otwarcia skrótu (clear=${clearOpenRate.toFixed(3)}, storm=${stormOpenRate.toFixed(3)})`);
}
if (trailExactCeilingRuns !== trailRunCount) {
  failures.push(`sporeTrail: dokładny sufit osiągnięto w ${trailExactCeilingRuns}/${trailRunCount} profili`);
}

console.log(`Deterministic minigame reachability and ceiling gate; not player clear-rate telemetry (${samples} seeds per profile)`);
rows.forEach((row) => {
  console.log(`${row.id.padEnd(16)} ${row.kind.padEnd(20)} flawless=${row.flawlessLow}-${row.flawlessHigh} median=${row.flawlessMedian} clear=${row.casual} habitats=${row.profileCount}`);
});
console.log(`sporeTrail profile choices: optimal-safe=${trailOptimalSafeChoices} optimal-risky=${trailOptimalRiskyChoices} clear-open=${clearOpenRate.toFixed(3)} storm-open=${stormOpenRate.toFixed(3)} exact-ceilings=${trailExactCeilingRuns}/${trailRunCount}`);

if (failures.length) {
  failures.forEach((failure) => console.error(`fail - ${failure}`));
  process.exitCode = 1;
}

function createGeneratedRunSimulator(rules) {
  const context = {
    console,
    rules,
    runtime: {
      state: { minigames: { active: null } },
      minigame: null
    },
    getRuntimeNow: () => 100000,
    pushMinigameFloater() {},
    updateMinigameHud() {},
    saveState() {},
    persistRuntimeState() {},
    scheduleMinigameRuntimePersist() {},
    triggerEffect() {},
    handleMinigameEnd() {},
    window: {
      matchMedia: () => ({ matches: false })
    }
  };
  context.globalThis = context;
  vm.createContext(context);
  [
    'ClientMinigameDewCatch.html',
    'ClientMinigameSporePop.html',
    'ClientMinigameCompostSort.html',
    'ClientMinigameRhythmHum.html',
    'ClientLegendaryGames.html'
  ].forEach((fileName) => {
    vm.runInContext(readFileSync(path.resolve(repoRoot, fileName), 'utf8'), context, {
      filename: fileName
    });
  });

  return {
    getFlawlessResult(gameId, seed, habitatTags) {
      const gameRules = rules.minigames && rules.minigames[gameId];
      const startedAt = 100000;
      context.session = {
        id: gameId,
        seed,
        startedAt,
        until: startedAt + Number(gameRules.durationMs || 42000),
        score: 0,
        caught: [],
        missed: [],
        expired: [],
        expiredNotes: [],
        mistakes: 0,
        combo: 0,
        bestCombo: 0,
        habitatTags: habitatTags || {},
        sceneTone: 'day',
        weatherCondition: habitatTags && habitatTags.weatherCondition || 'clear',
        metrics: {
          weatherContext: habitatTags && habitatTags.weatherCondition || 'clear',
          weatherCondition: habitatTags && habitatTags.weatherCondition || 'clear',
          weatherLabel: habitatTags && habitatTags.weatherCondition || 'clear'
        }
      };
      const result = vm.runInContext(`(() => {
        const duration = Math.max(1, Number(session.until) - Number(session.startedAt));
        if (session.id === 'dewCatch') {
          const drops = buildDewCatchDrops(session);
          return {
            score: drops.reduce((sum, item) => sum + (item.kind === 'leaf' ? 0 : Number(item.points) || 1), 0),
            resolved: drops.length,
            total: drops.length,
            reachable: drops.every((item) => item.start >= 0 && item.start + item.speed <= 0.995)
          };
        }
        if (session.id === 'sporePop') {
          const spores = buildSporePopSpores(session);
          return {
            score: spores.reduce((sum, item) => sum + (Number(item.points) || 1), 0),
            resolved: spores.length,
            total: spores.length,
            reachable: spores.every((item) => item.start >= 0 && item.start + item.speed <= 0.995)
          };
        }
        if (session.id === 'compostSort') {
          const pieces = buildCompostSortPieces(session);
          return {
            score: pieces.reduce((sum, item) => sum + (item.good ? Number(item.points) || 1 : 1), 0),
            resolved: pieces.length,
            total: pieces.length,
            reachable: pieces.every((item) => item.start >= 0 && item.start + item.speed * 1.08 <= 0.995)
          };
        }
        if (session.id === 'rhythmHum') {
          const notes = buildRhythmHumChart(session);
          const missWindow = Math.max(150, Number(rules.minigames.rhythmHum.missWindowMs) || 260)
            + Math.max(0, Number(rules.minigames.rhythmHum.mobileForgivenessWindowMs) || 0);
          return {
            score: notes.length * 3,
            resolved: notes.length,
            total: notes.length,
            reachable: notes.every((item) => Number(item.hitAt) - Number(session.startedAt) >= 0
              && Number(item.hitAt) + missWindow <= Number(session.until))
          };
        }
        if (session.id === 'memoryGarden') {
          const config = rules.minigames.memoryGarden || {};
          const rounds = buildLegendaryGardenRounds(session, config);
          const previewStep = Math.max(250, Number(config.previewStepMs) || 450);
          const previewHold = Math.max(0, Number(config.previewHoldMs) || 500);
          const hide = Math.max(250, Number(config.hideMs) || 500);
          const recallStep = Math.max(700, Number(config.recallPerStepMs) || 1200);
          const recallGrace = Math.max(500, Number(config.recallGraceMs) || 1200);
          const gap = Math.max(300, Number(config.roundGapMs) || 600);
          const total = rounds.reduce((sum, sequence) => sum + sequence.length, 0);
          const requiredMs = rounds.reduce((sum, sequence, index) => sum
            + sequence.length * previewStep + previewHold
            + hide
            + sequence.length * recallStep + recallGrace
            + (index < rounds.length - 1 ? gap : 0), 0);
          return {
            score: total + Math.floor(total / 4),
            resolved: total,
            total,
            reachable: requiredMs <= duration
          };
        }
        const targets = buildLegendaryGameTargets(session);
        if (session.id === 'sporeTrail') {
          const decisionCount = Math.max(1, Number(rules.minigames.sporeTrail.decisionCount) || 8);
          const choices = [];
          let validProfile = true;
          for (let decisionIndex = 0; decisionIndex < decisionCount; decisionIndex += 1) {
            const pair = targets.filter((item) => Number(item.decisionIndex) === decisionIndex);
            const safe = pair.find((item) => item.choice === 'safe');
            const risky = pair.find((item) => item.choice === 'risky');
            validProfile = validProfile
              && Boolean(safe && risky)
              && Number(safe.points) === Math.max(1, Number(rules.minigames.sporeTrail.safeChoicePoints) || 2)
              && (risky.riskyOpen
                ? Number(risky.points) === Math.max(1, Number(rules.minigames.sporeTrail.riskyChoicePoints) || 3)
                : Number(risky.points) === 0 && Number(risky.penaltyPoints) >= 1);
            choices.push(risky && risky.riskyOpen ? risky : safe);
          }
          const ceiling = getLegendaryTrailSeedCeiling(session, rules.minigames.sporeTrail, decisionCount);
          const score = choices.reduce((sum, item) => sum + (Number(item.points) || 0), 0);
          const openCount = choices.filter((item) => item && item.choice === 'risky').length;
          return {
            score,
            resolved: choices.length,
            total: decisionCount,
            reachable: choices.every((item) => item && item.appearsAt >= session.startedAt && item.expiresAt <= session.until),
            exactCeiling: score === ceiling,
            validProfile,
            openCount,
            closedCount: decisionCount - openCount,
            weatherCondition: session.metrics.weatherCondition
          };
        }
        const score = targets.reduce((sum, item, index) => sum + (Number(item.points) || 1) + ((index + 1) % 4 === 0 ? 2 : 0), 0);
        return {
          score,
          resolved: targets.length,
          total: targets.length,
          reachable: targets.every((item) => item.appearsAt >= session.startedAt && item.expiresAt <= session.until)
        };
      })()`, context);
      return {
        score: Number(result && result.score) || 0,
        resolved: Number(result && result.resolved) || 0,
        total: Number(result && result.total) || 0,
        reachable: Boolean(result && result.reachable),
        exactCeiling: Boolean(result && result.exactCeiling),
        validProfile: Boolean(result && result.validProfile),
        openCount: Math.max(0, Number(result && result.openCount) || 0),
        closedCount: Math.max(0, Number(result && result.closedCount) || 0),
        weatherCondition: String(result && result.weatherCondition || '')
      };
    }
  };
}

function getHabitatProfiles(gameId) {
  if (gameId === 'dewCatch') {
    return [{ moisture: 0 }, { moisture: 1 }, { moisture: 2 }];
  }
  if (gameId === 'compostSort') {
    return [0, 1, 2, 3, 4].map((shelter) => ({ shelter }));
  }
  if (gameId === 'rhythmHum') {
    return [0, 1, 2, 3].map((music) => ({ music }));
  }
  if (gameId === 'sporeTrail') {
    return ['clear', 'cloudy', 'wind', 'fog', 'rain', 'snow', 'storm'].map((weatherCondition) => ({ weatherCondition }));
  }
  return [{}];
}

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] || 0;
}
