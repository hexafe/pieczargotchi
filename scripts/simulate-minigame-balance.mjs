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

console.log(`Minigame balance gate from live generators (${samples} seeds per reachable habitat profile)`);
rows.forEach((row) => {
  console.log(`${row.id.padEnd(16)} ${row.kind.padEnd(20)} flawless=${row.flawlessLow}-${row.flawlessHigh} median=${row.flawlessMedian} clear=${row.casual} habitats=${row.profileCount}`);
});

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
        weatherCondition: 'clear',
        metrics: { weatherContext: 'clear' }
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
          const choices = targets.filter((item) => item.choice === 'risky');
          return {
            score: choices.reduce((sum, item) => sum + (Number(item.points) || 1), 0),
            resolved: choices.length,
            total: Math.max(1, Number(rules.minigames.sporeTrail.decisionCount) || choices.length),
            reachable: choices.every((item) => item.appearsAt >= session.startedAt && item.expiresAt <= session.until)
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
        reachable: Boolean(result && result.reachable)
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
  return [{}];
}

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] || 0;
}
