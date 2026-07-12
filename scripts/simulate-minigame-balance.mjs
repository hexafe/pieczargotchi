import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import { buildCloudflareStaticArtifacts } from './build-cloudflare-static.mjs';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const config = buildCloudflareStaticArtifacts().config;
const minigames = config.rules && config.rules.minigames || {};
const samples = Math.max(32, Number(process.env.PIECZARGOTCHI_BALANCE_SAMPLES) || 256);
const ids = Object.keys(minigames).filter((id) => minigames[id] && minigames[id].interactionKind);
const legendarySimulator = createLegendarySimulator(config.rules);
const failures = [];

const rows = ids.map((id, gameIndex) => {
  const rules = minigames[id];
  const scores = [];
  const flawlessScores = [];
  const flawlessCoverages = [];
  for (let index = 0; index < samples; index += 1) {
    const seed = 1000 + gameIndex * 100003 + index * 37;
    scores.push(estimatePlayerScore(id, rules, seed));
    if (rules.legendary) {
      const flawless = legendarySimulator.getFlawlessResult(id, seed);
      flawlessScores.push(flawless.score);
      flawlessCoverages.push(flawless.caught === flawless.total);
    }
  }

  const mastery = Number(rules.scoreTargetMastery || rules.masteryTarget) || 0;
  const theoreticalCeiling = getTheoreticalScoreCeiling(id, rules);
  if (theoreticalCeiling < mastery) {
    failures.push(`${id}: teoretyczny max ${theoreticalCeiling} jest niższy niż mastery ${mastery}`);
  }
  if (rules.legendary && Math.min(...flawlessScores) < mastery) {
    failures.push(`${id}: flawless run zależy od seedu i spada do ${Math.min(...flawlessScores)} przy mastery ${mastery}`);
  }
  if (rules.legendary && flawlessCoverages.some((covered) => !covered)) {
    failures.push(`${id}: nie da się trafić wszystkich celów w ich rzeczywistych oknach czasowych`);
  }

  return {
    id,
    kind: rules.interactionKind,
    casual: Number(rules.scoreTargetCasual) || 0,
    mastery,
    median: median(scores),
    low: Math.min(...scores),
    high: Math.max(...scores),
    flawlessLow: flawlessScores.length ? Math.min(...flawlessScores) : null,
    flawlessHigh: flawlessScores.length ? Math.max(...flawlessScores) : null
  };
});

console.log('Minigame balance gate from current config and live legendary target/scoring source');
rows.forEach((row) => {
  const flawless = row.flawlessLow === null ? '' : ` flawless=${row.flawlessLow}-${row.flawlessHigh}`;
  console.log(`${row.id.padEnd(16)} ${row.kind.padEnd(12)} low=${row.low} median=${row.median} high=${row.high} casual=${row.casual} mastery=${row.mastery}${flawless}`);
});

if (failures.length) {
  failures.forEach((failure) => console.error(`fail - ${failure}`));
  process.exitCode = 1;
}

function createLegendarySimulator(rules) {
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
    persistRuntimeState() {}
  };
  vm.createContext(context);
  vm.runInContext(readFileSync(path.resolve(repoRoot, 'ClientLegendaryGames.html'), 'utf8'), context, {
    filename: 'ClientLegendaryGames.html'
  });

  return {
    getFlawlessResult(gameId, seed) {
      const gameRules = rules.minigames && rules.minigames[gameId];
      const startedAt = 100000;
      context.session = {
        id: gameId,
        seed,
        startedAt,
        until: startedAt + Number(gameRules.durationMs || 42000),
        score: 0,
        caught: [],
        mistakes: 0,
        combo: 0,
        bestCombo: 0
      };
      const result = vm.runInContext(`(() => {
        runtime.state.minigames.active = session;
        runtime.minigame = {
          session,
          targets: buildLegendaryGameTargets(session),
          pulses: []
        };
        const schedule = runtime.minigame.targets.map((target) => ({
          target,
          hitAt: target.appearsAt + Math.max(1, Math.floor((target.expiresAt - target.appearsAt) * 0.35))
        }));
        schedule.forEach(({ target, hitAt }) => {
          const active = session.id === 'myceliumLeague'
            ? getActiveLegendaryTarget(hitAt)
            : getNextLegendaryTarget(hitAt);
          if (!active || active.id !== target.id || hitAt < active.appearsAt || hitAt > active.expiresAt) {
            return;
          }
          scoreLegendaryGameTarget(active, hitAt);
        });
        return {
          score: runtime.minigame.session.score,
          caught: runtime.minigame.session.caught.length,
          total: runtime.minigame.targets.length
        };
      })()`, context);
      return {
        score: Number(result && result.score) || 0,
        caught: Number(result && result.caught) || 0,
        total: Number(result && result.total) || 0
      };
    }
  };
}

function estimatePlayerScore(id, rules, seed) {
  const mastery = Number(rules.scoreTargetMastery || rules.masteryTarget) || 10;
  const casual = Number(rules.scoreTargetCasual) || Math.max(1, Math.round(mastery * 0.62));
  const perfect = Number(rules.perfectTarget || rules.masteryTarget) || mastery;
  const roll = seededUnit(seed, 1);
  const skill = 0.42 + seededUnit(seed, 2) * 0.48;
  const wobble = (seededUnit(seed, 3) - 0.5) * 0.16;
  const ceiling = getTheoreticalScoreCeiling(id, rules);
  const estimated = casual * 0.45 + perfect * (skill + wobble);
  return clamp(Math.round(estimated + roll * 2), 0, ceiling);
}

function getTheoreticalScoreCeiling(id, rules) {
  if (id === 'rhythmHum') {
    return (Number(rules.beatCount) || 8) * 3 + 3;
  }
  if (id === 'dewCatch') {
    return (Number(rules.dropCount) || 24) * 3;
  }
  if (id === 'sporePop') {
    return (Number(rules.targetCount) || 20) * 3;
  }
  if (id === 'compostSort') {
    return (Number(rules.pieceCount) || 18) * 2;
  }
  return (Number(rules.targetCount) || 12) * 3;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function seededUnit(seed, salt) {
  const value = Math.sin(seed * 0.017 + salt * 91.739) * 10000;
  return value - Math.floor(value);
}

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] || 0;
}
