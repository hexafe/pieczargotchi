import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('future-version load is read-only and never rewrites storage', () => {
  const futureRaw = JSON.stringify({
    version: 18,
    saveRevision: 9,
    futureOnly: { keep: true }
  });
  const harness = createHarness({ initialRaw: futureRaw });
  const state = harness.context.loadState();
  const result = harness.context.saveState(state);

  assert(state.futureOnly.keep, 'future-only field should survive loading');
  assert(!result.ok && result.reason === 'futureVersion', 'future save should be read-only');
  assert(harness.storage.getItem('pieczargotchi_state_v2') === futureRaw, 'future raw save should remain untouched');
  assert(harness.context.getPersistenceStatus().readOnly, 'status should expose read-only mode');
});

test('syntactically valid malformed current save is preserved before recovery', () => {
  const malformedRaw = JSON.stringify({ version: 17, saveRevision: 4, stats: null, log: [null] });
  const harness = createHarness({ initialRaw: malformedRaw });
  const state = harness.context.loadState();
  const status = harness.context.getPersistenceStatus();

  assert(state.version === 17 && state.stats.health === 100, 'malformed save should recover a playable default');
  assert(status.reason === 'corruptRecovered', 'malformed shape should use corrupt recovery flow');
  assert(harness.storage.getItem(status.corruptBackupKey) === malformedRaw, 'sidecar should preserve exact malformed JSON');
});

test('loadState preserves corrupt raw state in a timestamped recovery sidecar', () => {
  const harness = createHarness({ initialRaw: '{broken-json' });
  const recovered = harness.context.loadState();
  const status = harness.context.getPersistenceStatus();

  assert(recovered.version === 17, 'corrupt load should recover a playable default state');
  assert(status.reason === 'corruptRecovered', 'status should report corrupt recovery');
  assert(status.corruptBackupKey && status.corruptBackupKey.startsWith('pieczargotchi_state_v2_corrupt_'), 'expected timestamped sidecar key');
  assert(harness.storage.getItem(status.corruptBackupKey) === '{broken-json', 'sidecar should preserve exact raw text');
  assert(harness.context.getCorruptStateBackup().raw === '{broken-json', 'recovery copy should remain available to the export UI');
  assert(harness.storage.getItem('pieczargotchi_state_v2') === null, 'corrupt primary slot should be cleared only after sidecar succeeds');
  const saved = harness.context.saveState(recovered);
  assert(saved.ok && JSON.parse(harness.storage.getItem('pieczargotchi_state_v2')).version === 17, 'recovered default should persist in the primary slot');
});

test('localStorage read SecurityError falls back to a playable in-memory state', () => {
  const harness = createHarness({ throwOnGet: true });
  const state = harness.context.loadState();
  const status = harness.context.getPersistenceStatus();

  assert(state.version === 17 && state.stats.health === 100, 'read failure should still create a playable state');
  assert(status.mode === 'memory' && status.reason === 'storageUnavailable', 'read failure should expose memory fallback');
});

test('storage write failure falls back to a playable memory save', () => {
  const harness = createHarness({ throwOnSet: true });
  const state = { version: 17, saveRevision: 0, stats: { health: 100 } };
  const result = harness.context.saveState(state);
  const status = harness.context.getPersistenceStatus();

  assert(result.ok, 'memory fallback should keep the session writable');
  assert(result.mode === 'memory' && status.memoryOnly, 'status should expose memory-only persistence');
  assert(state.saveRevision === 1, 'memory save should still advance its revision');
});

test('external storage events report newer revisions and can be acknowledged', () => {
  const harness = createHarness();
  let received = null;
  harness.context.initializePersistenceSync((payload) => {
    received = payload;
  });
  harness.dispatchStorage({
    key: 'pieczargotchi_state_v2',
    newValue: JSON.stringify({ version: 17, saveRevision: 3, saveWriterId: 'other-tab', stats: {} })
  });

  assert(received && received.revision === 3, 'newer external revision should reach the callback');
  assert(harness.context.getPersistenceStatus().conflicted, 'external update should mark local state stale');
  harness.context.acknowledgePersistenceRevision(3);
  assert(!harness.context.getPersistenceStatus().conflicted, 'acknowledgement should clear the stale marker');
});

test('external storage event reports split-brain writes at the same revision', () => {
  const harness = createHarness();
  const state = { version: 17, saveRevision: 0, stats: { health: 100 } };
  const saved = harness.context.saveState(state);
  let received = null;
  harness.context.initializePersistenceSync((payload) => {
    received = payload;
  });
  harness.dispatchStorage({
    key: 'pieczargotchi_state_v2',
    newValue: JSON.stringify({ version: 17, saveRevision: saved.revision, saveWriterId: 'other-tab', stats: { health: 80 } })
  });

  assert(received && received.revision === saved.revision, 'same-revision external writer should reach conflict handling');
  assert(harness.context.getPersistenceStatus().conflicted, 'same-revision split brain should mark local state stale');
});

test('saveState rejects a stale local revision without changing storage', () => {
  const storedRaw = JSON.stringify({ version: 17, saveRevision: 5, saveWriterId: 'other-tab', stats: { health: 91 } });
  const harness = createHarness({ initialRaw: storedRaw });
  const result = harness.context.saveState({ version: 17, saveRevision: 4, stats: { health: 80 } });

  assert(!result.ok && result.reason === 'conflict', 'stale save should report conflict');
  assert(harness.storage.getItem('pieczargotchi_state_v2') === storedRaw, 'stale save must not alter persisted data');
});

test('saveState respects an active cross-tab write lease', () => {
  const harness = createHarness();
  harness.storage.setItem('pieczargotchi_state_v2_write_lock', JSON.stringify({
    owner: 'other-tab',
    expiresAt: Date.now() + 10000
  }));
  const result = harness.context.saveState({ version: 17, saveRevision: 0, stats: { health: 100 } });

  assert(!result.ok && result.reason === 'storageBusy', 'active foreign lease should delay the write');
  assert(harness.storage.getItem('pieczargotchi_state_v2') === null, 'busy write must not touch primary state');
});

test('saveState rechecks revision and lease immediately before writing', () => {
  const initial = JSON.stringify({ version: 17, saveRevision: 1, saveWriterId: 'tab-a', stats: { health: 91 } });
  const replacement = JSON.stringify({ version: 17, saveRevision: 2, saveWriterId: 'tab-b', stats: { health: 92 } });
  const harness = createHarness({ initialRaw: initial, replacePrimaryOnSecondRead: replacement });
  const result = harness.context.saveState({ version: 17, saveRevision: 1, saveWriterId: 'tab-a', stats: { health: 80 } });

  assert(!result.ok && result.reason === 'conflict', 'preflight revision change should reject the write');
  assert(harness.storage.getItem('pieczargotchi_state_v2') === replacement, 'preflight must preserve the winning external write');
});

test('saveState detects an external winner immediately after its commit', () => {
  const initial = JSON.stringify({ version: 17, saveRevision: 1, saveWriterId: 'tab-a', stats: { health: 91 } });
  const replacement = JSON.stringify({ version: 17, saveRevision: 2, saveWriterId: 'tab-b', stats: { health: 92 } });
  const harness = createHarness({ initialRaw: initial, replacePrimaryOnThirdRead: replacement });
  const result = harness.context.saveState({ version: 17, saveRevision: 1, saveWriterId: 'tab-a', stats: { health: 80 } });

  assert(!result.ok && result.reason === 'conflict', 'post-commit winner should be reported as a conflict');
  assert(harness.storage.getItem('pieczargotchi_state_v2') === replacement, 'post-commit check must retain the external winner');
});

test('saveReplacementState replaces only the expected current revision', () => {
  const storedRaw = JSON.stringify({ version: 17, saveRevision: 5, saveWriterId: 'old-tab', stats: { health: 91 } });
  const successHarness = createHarness({ initialRaw: storedRaw });
  const replacement = { version: 17, saveRevision: 0, saveWriterId: 'exported-old-writer', stats: { health: 100 } };
  const success = successHarness.context.saveReplacementState(replacement, { saveRevision: 5, saveWriterId: 'old-tab' });
  const persisted = JSON.parse(successHarness.storage.getItem('pieczargotchi_state_v2'));

  assert(success.ok && replacement.saveRevision === 6, 'replacement should inherit and advance expected revision');
  assert(persisted.stats.health === 100 && persisted.saveRevision === 6, 'replacement should become the persisted state');

  const conflictHarness = createHarness({ initialRaw: storedRaw });
  const conflict = conflictHarness.context.saveReplacementState(
    { version: 17, saveRevision: 0, stats: { health: 100 } },
    { saveRevision: 4, saveWriterId: 'old-tab' }
  );
  assert(!conflict.ok && conflict.reason === 'conflict', 'replacement with stale expectation should be rejected');
  assert(conflictHarness.storage.getItem('pieczargotchi_state_v2') === storedRaw, 'failed replacement must preserve storage');

  const splitBrainHarness = createHarness({ initialRaw: storedRaw });
  const splitBrain = splitBrainHarness.context.saveReplacementState(
    { version: 17, saveRevision: 0, stats: { health: 100 } },
    { saveRevision: 5, saveWriterId: 'other-writer-at-revision-five' }
  );
  assert(!splitBrain.ok && splitBrain.reason === 'conflict', 'replacement must compare the writer as well as the revision');
  assert(splitBrainHarness.storage.getItem('pieczargotchi_state_v2') === storedRaw, 'split-brain replacement must preserve the winning writer');
});

test('saveReplacementState advances the expected revision in memory fallback', () => {
  const harness = createHarness({ throwOnGet: true });
  const replacement = { version: 17, saveRevision: 0, saveWriterId: 'backup-writer', stats: { health: 77 } };
  const result = harness.context.saveReplacementState(replacement, { saveRevision: 5, saveWriterId: 'backup-writer' });

  assert(result.ok && result.mode === 'memory', 'replacement should remain available without localStorage');
  assert(replacement.saveRevision === 6, 'memory replacement should advance from the expected revision');
});

test('successful save clears transient busy persistence status', () => {
  const harness = createHarness();
  harness.storage.setItem('pieczargotchi_state_v2_write_lock', JSON.stringify({
    owner: 'other-tab',
    expiresAt: Date.now() + 10000
  }));
  const state = { version: 17, saveRevision: 0, stats: { health: 100 } };
  const busy = harness.context.saveState(state);
  harness.storage.removeItem('pieczargotchi_state_v2_write_lock');
  const saved = harness.context.saveState(state);

  assert(!busy.ok && busy.reason === 'storageBusy', 'first save should observe the foreign lease');
  assert(saved.ok, 'save should recover after the lease is released');
  assert(harness.context.getPersistenceStatus().reason === null, 'successful storage write should clear the stale busy warning');
});

function createHarness(options = {}) {
  const values = new Map();
  if (options.initialRaw) {
    values.set('pieczargotchi_state_v2', options.initialRaw);
  }
  const listeners = new Map();
  let primaryReadCount = 0;
  const storage = {
    getItem(key) {
      if (options.throwOnGet) {
        throw new Error('storage denied');
      }
      if (key === 'pieczargotchi_state_v2') {
        primaryReadCount += 1;
        if (options.replacePrimaryOnSecondRead && primaryReadCount === 2) {
          values.set(key, options.replacePrimaryOnSecondRead);
        }
        if (options.replacePrimaryOnThirdRead && primaryReadCount === 3) {
          values.set(key, options.replacePrimaryOnThirdRead);
        }
      }
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      if (options.throwOnSet) {
        throw new Error('storage denied');
      }
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    }
  };
  const context = {
    console,
    config: { stateVersion: 17, storageKey: 'pieczargotchi_state_v2' },
    rules: {},
    stateConfig: {
      defaultState: createDefaultStateFixture(),
      statOrder: ['hydration', 'nutrients', 'energy', 'happiness', 'cleanliness', 'health', 'growth']
    },
    actions: [],
    defaultMushroomName: 'Pieczarka',
    getRuntimeNow: () => Date.parse('2026-05-17T12:00:00.000Z'),
    normalizeMushroomNameValue: (value) => String(value || '').trim().slice(0, 24),
    cleanupActivity() {},
    window: {
      localStorage: storage,
      PieczargotchiCore: loadCore(),
      addEventListener(type, listener) {
        listeners.set(type, listener);
      },
      removeEventListener(type) {
        listeners.delete(type);
      }
    }
  };
  vm.createContext(context);
  vm.runInContext(readFileSync(path.join(rootDir, 'ClientState.html'), 'utf8'), context, {
    filename: 'ClientState.html'
  });
  return {
    context,
    storage,
    dispatchStorage(event) {
      const listener = listeners.get('storage');
      if (listener) {
        listener(event);
      }
    }
  };
}

function createDefaultStateFixture() {
  return {
    version: 17,
    saveRevision: 0,
    saveWriterId: null,
    mode: 'sleeping',
    stats: { hydration: 70, nutrients: 70, energy: 80, happiness: 60, cleanliness: 80, health: 100, growth: 0 },
    inventory: { water: 3, compost: 2, toys: 1, substrate: 1, spores: 0 },
    history: {},
    patch: { quality: 72, mycelium: 0, harvests: 0, careStreak: 0 },
    attention: {},
    recovery: {},
    gameOver: {},
    careMistakes: {},
    battle: {},
    evolution: {},
    minigames: {},
    legendaryGames: {},
    dailyPlan: {},
    dailyRhythm: {},
    relationship: {},
    journal: {},
    decorations: {},
    discoveries: {},
    returnRecap: {},
    longLoop: {},
    cooldowns: {},
    flags: {},
    log: []
  };
}

function loadCore() {
  const script = renderTemplate('ClientCore.html')
    .replace(/^<script>\s*/, '')
    .replace(/\s*<\/script>\s*$/, '');
  const context = { globalThis: {} };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(script, context, { filename: 'ClientCore.html' });
  return context.PieczargotchiCore;
}

function renderTemplate(fileName) {
  const content = readFileSync(path.join(rootDir, fileName), 'utf8');
  return content.replace(/<\?!=\s*include\('([^']+)'\);\s*\?>/g, (_match, partialName) => {
    return renderTemplate(partialName + '.html');
  });
}

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
