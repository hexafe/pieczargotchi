import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const tests = [];

test('state v20 sensory preferences override the local fallback', () => {
  const context = createAudioContext({
    statePreferences: { audioEnabled: false, hapticsEnabled: true },
    localPreferences: { sound: true, haptics: false }
  });
  const preferences = plain(context.getMinigameSensoryPreferences());
  assert(!preferences.sound && preferences.haptics, 'state preferences must be authoritative when present');
});

test('local sensory preferences remain a safe fallback for older saves', () => {
  const context = createAudioContext({
    localPreferences: { sound: false, haptics: true }
  });
  const preferences = plain(context.getMinigameSensoryPreferences());
  assert(!preferences.sound && preferences.haptics, 'local fallback should survive when state preferences are absent');
});

test('audio capability failure stays silent and non-blocking', async () => {
  const context = createAudioContext({
    statePreferences: { audioEnabled: true, hapticsEnabled: false }
  });
  const unlocked = await context.unlockMinigameAudio();
  assert(unlocked === false, 'missing Web Audio must resolve false instead of throwing');
});

test('practice recap exposes skill feedback without claiming rewards', () => {
  const now = Date.parse('2026-07-13T16:00:00.000Z');
  const outcome = {
    id: 'dewCatch',
    mode: 'practice',
    tier: 'perfect',
    score: 24,
    coverage: 1,
    accuracy: 1,
    rewards: { stats: { hydration: 14 }, inventory: {}, spores: 0 },
    cooldownUntil: now + 60000
  };
  const recap = createRecapNode();
  const context = createUiContext(recap, outcome, now);

  assert(context.getMinigameLastOutcomeForUi() === context.runtime.minigameLastOutcome,
    'ephemeral runtime outcome must take priority over the older persisted result');
  context.renderMinigameRecap();

  assert(!recap.hidden, 'recap should become visible after the active session ends');
  assert(recap.nodes['[data-minigame-recap-title]'].textContent.includes('praktyka'), 'recap title should identify practice');
  assert(recap.nodes['[data-minigame-recap-tier]'].textContent === 'Praktyka', 'practice must not be presented as a rewarded perfect tier');
  assert(recap.nodes['[data-minigame-recap-coverage]'].textContent === '100%', 'coverage should remain useful in practice');
  assert(recap.nodes['[data-minigame-recap-accuracy]'].textContent === '100%', 'accuracy should remain useful in practice');
  assert(recap.nodes['[data-minigame-recap-rewards]'].textContent.includes('nie przyznaje nagród'), 'practice recap must explicitly deny rewards');
  assert(recap.replay.dataset.minigameStart === 'dewCatch' && recap.replay.dataset.minigameMode === 'practice',
    'cooldown recap should offer an immediate practice replay');
});

test('start ownership and responsive sensory contracts stay singular', () => {
  const uiSource = read('ClientUi.html');
  const audioSource = read('ClientMinigameAudio.html');
  const bootSource = read('ClientBoot.html');
  const stylesSource = read('Styles.html');
  const clickHandler = extractFunction(uiSource, 'handleSceneFirstUiClick', 'handleSceneFirstUiKeydown');

  assert(!clickHandler.includes('data-minigame-start'), 'delegated UI click handler must not duplicate Boot start listeners');
  assert(!audioSource.includes('MutationObserver'), 'sensory feedback must use explicit scorer events, not HUD observation');
  assert(bootSource.includes("button.addEventListener('click'") && bootSource.includes('handleMinigameStart(minigameId'),
    'Boot should remain the single owner of static start buttons');
  assert(stylesSource.includes('@media (max-width: 320px) and (max-height: 568px)')
    && stylesSource.includes('.minigame-recap__metrics'), 'compact mobile recap rules must remain present');
});

for (const [name, callback] of tests) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    console.error(error && error.stack || error);
    process.exitCode = 1;
  }
}

function test(name, callback) {
  tests.push([name, callback]);
}

function createAudioContext(options = {}) {
  const storage = new Map();
  if (options.localPreferences) {
    storage.set('pieczargotchi_minigame_sensory_v1', JSON.stringify(options.localPreferences));
  }
  const minigamePreferences = options.statePreferences
    ? { minigames: { ...options.statePreferences } }
    : {};
  const context = {
    console,
    Date,
    Math,
    JSON,
    Promise,
    runtime: { state: { preferences: minigamePreferences }, minigameSensory: null },
    document: {
      addEventListener() {},
      dispatchEvent() {},
      querySelectorAll() { return []; }
    },
    navigator: {},
    persistRuntimeState() {},
    window: {
      localStorage: {
        getItem(key) { return storage.has(key) ? storage.get(key) : null; },
        setItem(key, value) { storage.set(key, String(value)); }
      },
      setTimeout,
      clearTimeout
    }
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(read('ClientMinigameAudio.html'), context, { filename: 'ClientMinigameAudio.html' });
  return context;
}

function createUiContext(recap, outcome, now) {
  const document = {
    activeElement: null,
    body: {},
    documentElement: {},
    querySelectorAll(selector) {
      return selector === '[data-minigame-recap]' ? [recap] : [];
    },
    querySelector(selector) {
      if (selector === '[data-minigame-recap="standard"]') return recap;
      return null;
    }
  };
  const context = {
    console,
    Date,
    Math,
    JSON,
    document,
    dom: {},
    rules: { minigames: { dewCatch: { id: 'dewCatch', label: 'Łapanie rosy' } } },
    runtime: {
      minigameLastOutcome: outcome,
      ui: { lastRecapOutcomeReference: outcome },
      state: {
        mode: 'awake',
        minigames: { active: null, lastResult: { id: 'sporePop', score: 1 } },
        cooldowns: { minigame_dewCatch: now + 60000 }
      }
    },
    window: { setTimeout, clearTimeout },
    formatMushroomText(value) { return String(value || ''); },
    getRuntimeNow() { return now; },
    getMinigameCooldownKey(id) { return `minigame_${id}`; },
    getMinigameScoreLabel(id, score) { return `${score} krople`; },
    hasNamedMushroom() { return true; },
    isGameOverUiState() { return false; },
    isMinigameActive() { return false; },
    isBattleSessionActive() { return false; },
    isRuntimeMutationBlocked() { return false; },
    isLegendaryMinigameRuntimeId() { return false; }
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(read('ClientUi.html'), context, { filename: 'ClientUi.html' });
  return context;
}

function createRecapNode() {
  const selectors = [
    '[data-minigame-recap-title]',
    '[data-minigame-recap-tier]',
    '[data-minigame-recap-score]',
    '[data-minigame-recap-coverage]',
    '[data-minigame-recap-accuracy]',
    '[data-minigame-recap-rewards]',
    '[data-minigame-recap-cooldown]',
    '[data-minigame-recap-unlocks]'
  ];
  const nodes = Object.fromEntries(selectors.map((selector) => [selector, {
    textContent: '',
    hidden: false
  }]));
  const replay = {
    dataset: {},
    textContent: '',
    disabled: false,
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = String(value); }
  };
  return {
    hidden: true,
    className: '',
    nodes,
    replay,
    querySelector(selector) {
      if (selector === '[data-minigame-recap-replay]') return replay;
      return nodes[selector] || null;
    }
  };
}

function extractFunction(source, startName, nextName) {
  const start = source.indexOf(`function ${startName}`);
  const end = source.indexOf(`function ${nextName}`, start + 1);
  assert(start >= 0 && end > start, `could not extract ${startName}`);
  return source.slice(start, end);
}

function read(relativePath) {
  return readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
