import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(new URL('..', import.meta.url).pathname);
const configPath = resolve(repoRoot, 'dist/config.js');
const configSource = readFileSync(configPath, 'utf8');
const prefix = 'window.PIECZARGOTCHI_CONFIG = ';
const start = configSource.indexOf(prefix);

if (start === -1) {
  throw new Error('Nie znaleziono dist/config.js. Uruchom najpierw npm run build.');
}

let json = configSource.slice(start + prefix.length).trim();
if (json.endsWith(';')) {
  json = json.slice(0, -1);
}
const config = JSON.parse(json);
const minigames = config.rules && config.rules.minigames || {};
const samples = Number(process.env.PIECZARGOTCHI_BALANCE_SAMPLES) || 64;
const ids = Object.keys(minigames).filter((id) => minigames[id] && minigames[id].interactionKind);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function estimateScore(id, rules, seed) {
  const mastery = Number(rules.scoreTargetMastery || rules.masteryTarget) || 10;
  const casual = Number(rules.scoreTargetCasual) || Math.max(1, Math.round(mastery * 0.62));
  const perfect = Number(rules.perfectTarget || rules.masteryTarget) || mastery;
  const roll = seededUnit(seed, 1);
  const skill = 0.42 + seededUnit(seed, 2) * 0.48;
  const wobble = (seededUnit(seed, 3) - 0.5) * 0.16;
  const ceiling = getScoreCeiling(id, rules);
  const estimated = casual * 0.45 + perfect * (skill + wobble);
  return clamp(Math.round(estimated + roll * 2), 0, ceiling);
}

function getScoreCeiling(id, rules) {
  if (id === 'rhythmHum') {
    return (Number(rules.beatCount) || 8) * 3 + 3;
  }
  if (id === 'dewCatch') {
    return Math.round((Number(rules.dropCount) || 24) * 1.45);
  }
  if (id === 'sporePop') {
    return Math.round((Number(rules.targetCount) || 20) * 1.55);
  }
  if (id === 'compostSort') {
    return Math.round((Number(rules.pieceCount) || 18) * 1.28);
  }
  return Math.round((Number(rules.targetCount) || Number(rules.masteryTarget) || 12) * 1.25);
}

function seededUnit(seed, salt) {
  const value = Math.sin(seed * 0.017 + salt * 91.739) * 10000;
  return value - Math.floor(value);
}

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] || 0;
}

const rows = ids.map((id) => {
  const rules = minigames[id];
  const scores = [];
  for (let index = 0; index < samples; index += 1) {
    scores.push(estimateScore(id, rules, 1000 + index * 37));
  }
  return {
    id,
    kind: rules.interactionKind,
    casual: Number(rules.scoreTargetCasual) || 0,
    mastery: Number(rules.scoreTargetMastery || rules.masteryTarget) || 0,
    median: median(scores),
    low: Math.min(...scores),
    high: Math.max(...scores)
  };
});

console.log('Minigame balance estimate from dist/config.js');
rows.forEach((row) => {
  console.log(`${row.id.padEnd(16)} ${row.kind.padEnd(12)} low=${row.low} median=${row.median} high=${row.high} casual=${row.casual} mastery=${row.mastery}`);
});
