import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const indexSource = readFileSync(path.join(rootDir, 'Index.html'), 'utf8');
const bootSource = readFileSync(path.join(rootDir, 'ClientBoot.html'), 'utf8');
const actionsSource = readFileSync(path.join(rootDir, 'ClientActions.html'), 'utf8');
const backupSource = readFileSync(path.join(rootDir, 'ClientBackup.html'), 'utf8');
const dewSource = readFileSync(path.join(rootDir, 'ClientMinigameDewCatch.html'), 'utf8');
const compostSource = readFileSync(path.join(rootDir, 'ClientMinigameCompostSort.html'), 'utf8');
const uiSource = readFileSync(path.join(rootDir, 'ClientUi.html'), 'utf8');

test('mushroom copy substitutes only the explicit name token', () => {
  const runtime = { state: { mushroomName: 'Borowik', flags: { nameConfirmed: true } } };
  const format = evaluateFunction(bootSource, 'formatMushroomText', {
    runtime,
    defaultMushroomName: 'Pieczarka',
    hasNamedMushroom: () => true,
    getMushroomName: () => 'Borowik'
  });
  assert(format('Pieczarkę trzeba nakarmić.') === 'Pieczarkę trzeba nakarmić.', 'inflected generic copy must remain unchanged');
  assert(format('{name} chce odpocząć.') === 'Borowik chce odpocząć.', 'explicit token should use the chosen name');
});

test('minigame launch preserves duration and starts after a three-second countdown', () => {
  const prepare = evaluateFunction(dewSource, 'prepareMinigameSessionLaunch', {
    Date,
    minigameLaunchCountdownMs: 3000
  });
  const phase = evaluateFunction(dewSource, 'getMinigameLaunchPhase', { Date });
  const session = prepare({ id: 'dewCatch', startedAt: 1000, until: 11000 }, 5000);
  assert(session.startedAt === 8000, `expected countdown end at 8000, got ${session.startedAt}`);
  assert(session.until === 18000, 'expected the original ten-second play duration to survive');
  assert(phase(session, 7999) === 'countdown', 'input must remain locked before countdown completion');
  assert(phase(session, 8000) === 'running', 'gameplay should start exactly at countdown completion');
  assert(phase(session, 18000) === 'expired', 'session should expire at the shifted deadline');
});

test('runtime persistence batches rapid minigame mutations', () => {
  let scheduled = null;
  let timerCount = 0;
  let persistCount = 0;
  const runtime = { minigame: {}, state: { minigames: { active: { score: 1 } } } };
  const schedule = evaluateFunction(dewSource, 'scheduleMinigameRuntimePersist', {
    runtime,
    minigamePersistDebounceMs: 250,
    persistRuntimeState: () => { persistCount += 1; },
    window: {
      setTimeout(callback, delay) {
        timerCount += 1;
        scheduled = callback;
        assert(delay === 250, 'expected a 250 ms persistence batch');
        return 41;
      }
    }
  });
  schedule();
  schedule();
  runtime.state.minigames.active.score = 9;
  assert(timerCount === 1 && persistCount === 0, 'rapid updates must share one pending write');
  scheduled();
  assert(persistCount === 1 && runtime.minigame.persistTimer === null, 'the batch should flush once using current state');
});

test('ending a minigame reserves persistence for the final exclusive write', () => {
  const session = { id: 'dewCatch', runtimeToken: 'round-1', startedAt: 1000, until: 21000, score: 0 };
  const runtime = {
    state: { saveRevision: 1, minigames: { active: structuredClone(session) } },
    minigame: { session: structuredClone(session) },
    pendingExclusiveStart: null
  };
  let persisted = false;
  const end = evaluateFunction(actionsSource, 'handleMinigameEnd', {
    runtime,
    rules: {},
    window: {
      PieczargotchiCore: {
        finishMinigame(state) {
          return { ok: false, reason: 'Zakończono.', state: structuredClone(state) };
        }
      }
    },
    getRuntimeNow: () => 5000,
    isRuntimeMutationBlocked: () => false,
    doesRuntimeMinigameSessionMatch: () => true,
    isGameOverForRuntime: () => false,
    isRecoveryActiveForRuntime: () => false,
    isBattleSessionActive: () => false,
    flushMinigameRuntimePersist: (reason) => {
      assert(reason === 'end', 'finish must clear the runtime batch without scheduling a generic write');
    },
    deepClone: structuredClone,
    stopMinigameRuntime: () => { runtime.minigame = null; },
    releaseExclusiveRuntimeSession: () => {},
    persistExclusiveStartCandidate(candidate, base, _pending, complete) {
      assert(base.saveRevision === 1, 'finish CAS base must keep the current durable revision');
      assert(JSON.stringify(base) === JSON.stringify(runtime.state), 'finish CAS base must match the live state before the exclusive write');
      persisted = true;
      complete({ ok: true }, candidate);
    },
    reconcileExclusiveRuntimeSession: () => {},
    setTransientMessage: () => {},
    renderPersistenceStatus: () => {},
    renderUi: () => {},
    Date
  });
  end('manual');
  assert(persisted, 'ending the minigame should reach the durable result write');
  assert(runtime.state.minigames.active === null, 'successful result persistence should close the active session');
});

test('end flush clears the debounce without scheduling a competing write', () => {
  const clearedTimers = [];
  let persistCount = 0;
  const runtime = {
    minigame: { persistTimer: 41 },
    persistenceRetryTimer: 51,
    state: { saveRevision: 3 }
  };
  const flush = evaluateFunction(dewSource, 'flushMinigameRuntimePersist', {
    runtime,
    persistRuntimeState: () => { persistCount += 1; return { ok: true }; },
    window: {
      clearTimeout(timer) { clearedTimers.push(timer); }
    }
  });

  const endResult = flush('end');
  assert(clearedTimers.join(',') === '41,51', 'end must clear both the debounce and any generic storage retry');
  assert(runtime.minigame.persistTimer === null && runtime.persistenceRetryTimer === null, 'end must own the complete pending write queue');
  assert(persistCount === 0 && endResult.deferred, 'end must leave the only durable write to the exclusive result CAS');

  runtime.minigame.persistTimer = 42;
  flush('visibility');
  assert(clearedTimers.at(-1) === 42 && persistCount === 1, 'visibility flush should still persist the current session immediately');
});

test('pointercancel abandons compost drag without scoring a drop', () => {
  let finishCount = 0;
  const runtime = {
    minigame: {
      session: { id: 'compostSort', startedAt: 0, until: 10000 },
      dragging: { id: 'piece-1' },
      pieces: [{ id: 'piece-1', good: true }]
    }
  };
  const handlePointer = evaluateFunction(compostSource, 'handleCompostSortPointer', {
    runtime,
    dom: { compostSortCanvas: {} },
    focusMinigameCanvas: () => {},
    getCompostPointerPosition: () => ({ x: 20, y: 20 }),
    getRuntimeNow: () => 500,
    finishCompostSortDrag: () => { finishCount += 1; }
  });
  handlePointer({ type: 'pointercancel', preventDefault() {} });
  assert(runtime.minigame.dragging === null, 'cancelled pointer must release the dragged piece');
  assert(finishCount === 0, 'cancelled pointer must not resolve or score a drop');
});

test('import parsing creates preview metadata without replacing the live state', () => {
  let saveCount = 0;
  let previewCount = 0;
  const runtime = { state: { mushroomName: 'Obecny' }, pendingImport: null };
  const metadata = evaluateFunction(backupSource, 'buildImportPreviewMetadata', {
    normalizeMushroomNameValue: (value) => String(value || '').trim(),
    defaultMushroomName: 'Pieczarka',
    Date,
    Number,
    String
  });
  const importText = evaluateFunction(backupSource, 'importStateText', {
    window: {
      PieczargotchiCore: {
        importStateEnvelope(value) {
          return { ok: true, state: value.state };
        }
      }
    },
    runtime,
    config: { stateVersion: 18 },
    rules: {},
    getRuntimeNow: () => Date.parse('2026-07-12T10:00:00.000Z'),
    isImportReplacementBlocked: () => false,
    normalizeState: (value) => value,
    mergeState: (_base, value) => structuredClone(value),
    createDefaultState: () => ({}),
    buildImportPreviewMetadata: metadata,
    showPendingImportPreview: () => { previewCount += 1; },
    saveReplacementState: () => { saveCount += 1; },
    setBackupMessage: () => {},
    JSON
  });
  importText(JSON.stringify({
    kind: 'pieczargotchi-state',
    exportedAt: '2026-07-11T08:30:00.000Z',
    state: { version: 18, mushroomName: 'Nowy', stage: 'young', stats: {} }
  }));
  assert(saveCount === 0, 'file selection must never replace the save immediately');
  assert(previewCount === 1 && runtime.pendingImport, 'valid import should enter the preview phase');
  assert(runtime.pendingImport.metadata.name === 'Nowy', 'preview should expose the imported name');
  assert(runtime.pendingImport.metadata.stage === 'young', 'preview should expose the imported stage');
  assert(runtime.pendingImport.metadata.version === 18, 'preview should expose the source version');
  assert(runtime.pendingImport.metadata.exportedAt === '2026-07-11T08:30:00.000Z', 'preview should expose the export timestamp');
});

test('import replacement happens only after explicit confirmation', () => {
  let saveCount = 0;
  let cancelled = 0;
  const previous = { mushroomName: 'Obecny', minigames: { active: null } };
  const imported = { mushroomName: 'Nowy', minigames: { active: null } };
  const runtime = { state: previous, pendingImport: { state: imported } };
  const confirm = evaluateFunction(backupSource, 'confirmPendingImport', {
    runtime,
    isImportReplacementBlocked: () => false,
    getRuntimeNow: () => 1234,
    normalizeState: (value) => value,
    mergeState: (_base, value) => structuredClone(value),
    createDefaultState: () => ({}),
    addLog: () => {},
    saveReplacementState: (next, before) => {
      saveCount += 1;
      assert(next.mushroomName === 'Nowy' && before === previous, 'confirmation should use the previewed state and current CAS base');
      return { ok: true };
    },
    stopMinigameRuntime: () => {},
    cancelPendingImport: () => { cancelled += 1; runtime.pendingImport = null; },
    resumeMinigameIfActive: () => {},
    setBackupMessage: () => {},
    renderUi: () => {},
    Date
  });
  assert(saveCount === 0, 'setup must not write before confirmation');
  confirm();
  assert(saveCount === 1 && cancelled === 1, 'confirmation should perform one replacement and clear preview state');
  assert(runtime.state.mushroomName === 'Nowy', 'confirmed state should become live');
});

test('view switching and workspace navigation keep an active minigame visible', () => {
  assert(
    actionsSource.includes('if (activeMinigame || pendingMinigame)')
      && actionsSource.includes("isLegendaryMinigameRuntimeId(activeMinigame.id) ? 'arena' : 'care'"),
    'top-level view guard is missing'
  );
  const allowed = evaluateFunction(dewSource, 'isMinigameNavigationTargetAllowed', {
    isLegendaryMinigameRuntimeId: (id) => id === 'myceliumLeague'
  });
  assert(allowed('dewCatch', { dataset: { workspaceTab: 'games' } }), 'care minigame should allow its Games workspace');
  assert(!allowed('dewCatch', { dataset: { workspaceTab: 'mycelium' } }), 'care minigame should block unrelated workspaces');
  assert(allowed('myceliumLeague', { dataset: { legendsTab: 'challenges' } }), 'legendary minigame should allow Challenges');
  assert(!allowed('myceliumLeague', { dataset: { legendsTab: 'arena' } }), 'legendary minigame should block Arena while its challenge runs');
});

test('nested dialogs restore focus to their own visible launch points', () => {
  const dialogs = [];
  const makeTrigger = () => ({
    isConnected: true,
    focusCount: 0,
    focus() { this.focusCount += 1; }
  });
  const makeDialog = (kind) => {
    const attributes = new Set(['aria-hidden']);
    const innerFocus = makeTrigger();
    const dialog = {
      open: false,
      hidden: true,
      innerFocus,
      showModal() { this.open = true; attributes.add('open'); },
      close() { this.open = false; attributes.delete('open'); },
      hasAttribute(name) { return attributes.has(name); },
      setAttribute(name) { attributes.add(name); if (name === 'open') this.open = true; },
      removeAttribute(name) { attributes.delete(name); if (name === 'open') this.open = false; },
      getAttribute(name) { return name === 'data-dialog' ? kind : null; },
      querySelector() { return innerFocus; },
      matches() { return false; }
    };
    dialogs.push(dialog);
    return dialog;
  };
  const menu = makeTrigger();
  const importButton = makeTrigger();
  const settingsDialog = makeDialog('settings');
  const importDialog = makeDialog('import');
  const ui = {};
  const document = {
    activeElement: menu,
    querySelector(selector) {
      return selector === 'dialog[open]' ? dialogs.find((dialog) => dialog.open) || null : null;
    }
  };
  const window = { setTimeout(callback) { callback(); } };
  const ensureSceneFirstUiRuntime = () => ui;
  const open = evaluateFunction(uiSource, 'openSceneFirstDialog', {
    document,
    window,
    ensureSceneFirstUiRuntime,
    updateMobileActionTrayState: () => {},
    getRuntimeNow: () => 0
  });
  const close = evaluateFunction(uiSource, 'closeSceneFirstDialog', {
    document,
    ensureSceneFirstUiRuntime,
    scheduleAdaptiveActionDockUpdate: () => {}
  });

  open(settingsDialog, 'settings', menu);
  open(importDialog, 'import', importButton);
  close(importDialog);
  assert(importButton.focusCount === 1 && menu.focusCount === 0, 'import preview must return to its own button');
  close(settingsDialog);
  assert(menu.focusCount === 1, 'Menu must retain its independent return target');
  close(settingsDialog);
  assert(menu.focusCount === 1, 'closing an already closed dialog must be idempotent');
});

test('mobile action tray does not reserve space outside the Care workspace', () => {
  const hiddenReason = evaluateFunction(uiSource, 'getMobileActionTrayHiddenReason', {
    runtime: { state: {}, viewMode: 'care' },
    dom: { actionsPanel: { hidden: true } },
    ensureSceneFirstUiRuntime: () => ({ workspaceTab: 'games', activeModal: null }),
    hasNamedMushroom: () => true,
    isGameOverUiState: () => false,
    isMinigameActive: () => false,
    isBattleSessionActive: () => false,
    document: { querySelector: () => null }
  });
  assert(hiddenReason() === 'workspace', 'Games and Mycelium must release the mobile tray inset');
});

test('dialog and launch hooks remain optional but discoverable by layout', () => {
  const requiredHooks = [
    'data-minigame-launch-status',
    'data-minigame-return',
    'data-import-preview',
    'data-import-confirm',
    'data-import-cancel',
    'data-reset-dialog',
    'data-reset-confirm',
    'data-reset-cancel',
    'data-rename-dialog',
    'data-rename-form'
  ];
  requiredHooks.forEach((hook) => {
    assert(bootSource.includes(hook), `missing optional layout hook ${hook}`);
  });
  assert(indexSource.includes('data-game-over-reset'), 'game over needs a direct reset action');
  assert(
    indexSource.indexOf('data-minigame-return') < indexSource.indexOf('<main'),
    'active-minigame return must live outside either hidden workspace'
  );
});

function evaluateFunction(source, name, context) {
  const declaration = extractFunction(source, name);
  return vm.runInNewContext(`(${declaration})`, context, { filename: `${name}.js` });
}

function extractFunction(source, name) {
  const start = source.indexOf(`  function ${name}(`);
  assert(start !== -1, `missing function ${name}`);
  const functionStart = start + 2;
  const braceStart = source.indexOf('{', functionStart);
  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(functionStart, index + 1);
  }
  throw new Error(`unterminated function ${name}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
