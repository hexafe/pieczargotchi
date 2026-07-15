import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const indexSource = readFileSync(path.join(rootDir, 'Index.html'), 'utf8');
const bootSource = readFileSync(path.join(rootDir, 'ClientBoot.html'), 'utf8');
const actionsSource = readFileSync(path.join(rootDir, 'ClientActions.html'), 'utf8');
const backupSource = readFileSync(path.join(rootDir, 'ClientBackup.html'), 'utf8');
const debugSource = readFileSync(path.join(rootDir, 'ClientDebug.html'), 'utf8');
const dewSource = readFileSync(path.join(rootDir, 'ClientMinigameDewCatch.html'), 'utf8');
const compostSource = readFileSync(path.join(rootDir, 'ClientMinigameCompostSort.html'), 'utf8');
const uiSource = readFileSync(path.join(rootDir, 'ClientUi.html'), 'utf8');
const interactionSource = readFileSync(path.join(rootDir, 'ClientInteraction.html'), 'utf8');
const stylesSource = readFileSync(path.join(rootDir, 'Styles.html'), 'utf8');
const captureSource = readFileSync(path.join(rootDir, 'scripts/capture-app-render.mjs'), 'utf8');
const browserSmokeSource = readFileSync(path.join(rootDir, 'scripts/test-browser-smoke.mjs'), 'utf8');

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

test('untouched auto-resolved reward rounds preserve seed and cooldown eligibility', () => {
  const session = {
    id: 'dewCatch',
    runtimeToken: 'round-idle',
    startedAt: 1000,
    until: 21000,
    score: 7,
    inputCount: 0,
    resolvedCount: 18
  };
  const runtime = {
    state: {
      saveRevision: 1,
      stats: { hydration: 50 },
      cooldowns: {},
      minigames: {
        active: structuredClone(session),
        pendingRewardSeeds: { dewCatch: 4242 }
      }
    },
    minigame: { session: structuredClone(session) },
    pendingExclusiveStart: null
  };
  let persistedCandidate = null;
  const end = evaluateFunction(actionsSource, 'handleMinigameEnd', {
    runtime,
    rules: {},
    window: {
      PieczargotchiCore: {
        finishMinigame(state) {
          const next = structuredClone(state);
          next.minigames.active = null;
          return {
            ok: true,
            state: next,
            outcome: { id: 'dewCatch', score: 7, resolvedCount: 18 },
            settledReward: false
          };
        }
      }
    },
    getRuntimeNow: () => 22000,
    isRuntimeMutationBlocked: () => false,
    doesRuntimeMinigameSessionMatch: () => true,
    isGameOverForRuntime: () => false,
    isRecoveryActiveForRuntime: () => false,
    isBattleSessionActive: () => false,
    flushMinigameRuntimePersist: () => {},
    deepClone: structuredClone,
    stopMinigameRuntime: () => { runtime.minigame = null; },
    releaseExclusiveRuntimeSession: () => {},
    persistExclusiveStartCandidate(candidate, _base, _pending, complete) {
      persistedCandidate = structuredClone(candidate);
      complete({ ok: true }, candidate);
    },
    reconcileExclusiveRuntimeSession: () => {},
    setTransientMessage: () => {},
    renderPersistenceStatus: () => {},
    renderUi: () => {},
    Date
  });

  end('timeout');
  assert(persistedCandidate.minigames.pendingRewardSeeds.dewCatch === 4242, 'idle timeout must retain the deterministic reward seed');
  assert(Object.keys(persistedCandidate.cooldowns).length === 0, 'idle timeout must not start a cooldown');
});

test('manual reward abort rotates the revealed seed without starting a cooldown', () => {
  const session = {
    id: 'memoryGarden',
    runtimeToken: 'round-abort',
    startedAt: 1000,
    until: 43000,
    seed: 4242,
    score: 0,
    inputCount: 0
  };
  const runtime = {
    state: {
      saveRevision: 1,
      cooldowns: {},
      minigames: {
        active: structuredClone(session),
        pendingRewardSeeds: { memoryGarden: 4242 }
      }
    },
    minigame: { session: structuredClone(session) },
    pendingExclusiveStart: null
  };
  let persistedCandidate = null;
  let message = '';
  const end = evaluateFunction(actionsSource, 'handleMinigameEnd', {
    runtime,
    rules: {},
    window: {
      PieczargotchiCore: {
        finishMinigame(state) {
          const next = structuredClone(state);
          next.minigames.active = null;
          return {
            ok: true,
            state: next,
            outcome: { id: 'memoryGarden', score: 0 },
            aborted: true,
            settledReward: false
          };
        }
      }
    },
    getRuntimeNow: () => 5000,
    isRuntimeMutationBlocked: () => false,
    doesRuntimeMinigameSessionMatch: () => true,
    isGameOverForRuntime: () => false,
    isRecoveryActiveForRuntime: () => false,
    isBattleSessionActive: () => false,
    flushMinigameRuntimePersist: () => {},
    deepClone: structuredClone,
    buildNextMinigameRewardSeed: (_id, current) => current + 1,
    stopMinigameRuntime: () => { runtime.minigame = null; },
    releaseExclusiveRuntimeSession: () => {},
    persistExclusiveStartCandidate(candidate, _base, _pending, complete) {
      persistedCandidate = structuredClone(candidate);
      complete({ ok: true }, candidate);
    },
    reconcileExclusiveRuntimeSession: () => {},
    setTransientMessage(_title, body) { message = body; },
    renderPersistenceStatus: () => {},
    renderUi: () => {},
    Date
  });

  end('manual');
  assert(persistedCandidate.minigames.pendingRewardSeeds.memoryGarden === 4243, 'manual abort must replace the revealed reward seed');
  assert(Object.keys(persistedCandidate.cooldowns).length === 0, 'manual abort must remain free of cooldown penalties');
  assert(message.includes('nowy układ'), 'abort feedback should explain that the next reward layout changes');
});

test('reward seed rotation cannot return the same deterministic seed', () => {
  const rotate = evaluateFunction(actionsSource, 'buildNextMinigameRewardSeed', {
    buildMinigameSeed: () => 4242
  });
  assert(rotate('memoryGarden', 4242, 5000) === 4243, 'seed collision should advance to a distinct bounded seed');
  assert(rotate('memoryGarden', 2147483645, 5000) === 4242, 'a distinct generated seed should remain valid at the upper bound');
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
  const runtime = { state: {}, viewMode: 'care', pendingExclusiveStart: null };
  let guarded = 0;
  let returned = 0;
  let renders = 0;
  let exclusive = { kind: 'minigame', phase: 'active', id: 'dewCatch' };
  const setView = evaluateFunction(actionsSource, 'setViewMode', {
    runtime,
    isArenaUnlockedForRuntime: () => true,
    getExclusiveGameplaySession: () => exclusive,
    isLegendaryMinigameRuntimeId: (id) => id === 'myceliumLeague',
    returnToActiveMinigame: () => { returned += 1; return true; },
    guardNonSessionMutation: () => { guarded += 1; return true; },
    warmUpBattleAssets: () => {},
    renderUi: () => { renders += 1; }
  });
  setView('arena');
  assert(runtime.viewMode === 'care' && guarded === 1 && returned === 1, 'care minigame must reject the Arena view');

  exclusive = { kind: 'battle', phase: 'active', id: 'battle-1' };
  runtime.viewMode = 'arena';
  setView('care');
  assert(runtime.viewMode === 'arena' && guarded === 2, 'active battle must reject the Care view');

  exclusive = null;
  setView('care');
  assert(runtime.viewMode === 'care' && renders === 1, 'normal navigation must remain available outside an exclusive session');

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
    collapseMobileActionTray: () => {},
    renderExclusiveSessionControls: () => {},
    updateMobileActionTrayState: () => {},
    getRuntimeNow: () => 0
  });
  const close = evaluateFunction(uiSource, 'closeSceneFirstDialog', {
    document,
    ensureSceneFirstUiRuntime,
    getOpenSceneFirstDialogKind: () => dialogs.find((dialog) => dialog.open) ? 'dialog' : null,
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

test('fallback dialogs close on Escape before background shortcuts run', () => {
  const fallbackDialog = {};
  let prevented = 0;
  let stopped = 0;
  let closed = 0;
  let trayCollapsed = 0;
  const handleKeydown = evaluateFunction(uiSource, 'handleSceneFirstUiKeydown', {
    document: {
      querySelector(selector) {
        assert(selector === 'dialog[open][data-fallback-modal="true"]', 'fallback lookup should remain scoped to the open dialog');
        return fallbackDialog;
      }
    },
    ensureSceneFirstUiRuntime: () => ({ actionTrayExpanded: true }),
    closeSceneFirstDialog(dialog) {
      assert(dialog === fallbackDialog, 'Escape should close the active fallback dialog');
      closed += 1;
    },
    collapseMobileActionTray: () => { trayCollapsed += 1; }
  });
  handleKeydown({
    key: 'Escape',
    preventDefault() { prevented += 1; },
    stopPropagation() { stopped += 1; }
  });
  assert(closed === 1 && prevented === 1 && stopped === 1, 'fallback Escape should close modally and consume the key');
  assert(trayCollapsed === 0, 'background action tray must not receive fallback-dialog Escape');
});

test('fallback dialogs isolate the interactive runtime alert but preserve passive live regions', () => {
  const makeNode = (kind) => {
    const attributes = new Map();
    return {
      kind,
      inert: false,
      hasAttribute(name) { return attributes.has(name); },
      getAttribute(name) { return attributes.has(name) ? attributes.get(name) : null; },
      setAttribute(name, value) { attributes.set(name, String(value)); },
      removeAttribute(name) { attributes.delete(name); },
      matches(selector) {
        return kind === 'status' && selector.includes('[data-ui-status]');
      }
    };
  };
  const dialog = makeNode('dialog');
  const runtimeAlert = makeNode('runtime-alert');
  const status = makeNode('status');
  const ui = {};
  const isolate = evaluateFunction(uiSource, 'syncFallbackDialogBackgroundIsolation', {
    document: { querySelectorAll: () => [dialog, runtimeAlert, status] },
    ensureSceneFirstUiRuntime: () => ui
  });

  isolate(dialog, true);
  assert(runtimeAlert.inert && runtimeAlert.getAttribute('aria-hidden') === 'true', 'runtime retry action must be inert behind the fallback dialog');
  assert(!status.inert && status.getAttribute('aria-hidden') === null, 'passive live status should remain available to assistive technology');
  isolate(dialog, false);
  assert(!runtimeAlert.inert && runtimeAlert.getAttribute('aria-hidden') === null, 'runtime alert isolation must restore its original state');
});

test('minigame completion focus scrolls the recap target into the visible scrollport', () => {
  let focusOptions = null;
  let scrollOptions = null;
  const replay = {
    isConnected: true,
    hidden: false,
    disabled: false,
    closest: () => null,
    getBoundingClientRect: () => ({ width: 100, height: 44 }),
    focus(options) { focusOptions = options; },
    scrollIntoView(options) { scrollOptions = options; }
  };
  const recap = { querySelector: () => replay };
  const runtime = {
    state: { minigames: { active: null } },
    pendingMinigameFocusRestore: { id: 'dewCatch', legendary: false, scheduled: false }
  };
  const restore = evaluateFunction(uiSource, 'restorePendingMinigameFocus', {
    runtime,
    document: {
      querySelector(selector) {
        return selector.startsWith('[data-minigame-recap=') ? recap : null;
      },
      querySelectorAll: () => []
    },
    window: {
      requestAnimationFrame(callback) { callback(); },
      getComputedStyle() { return { display: 'block', visibility: 'visible' }; }
    }
  });

  restore();
  assert(focusOptions && focusOptions.preventScroll === false, 'completion focus should permit native scroll restoration');
  assert(scrollOptions && scrollOptions.block === 'nearest' && scrollOptions.inline === 'nearest', 'completion target should be scrolled into the nearest visible region');
  assert(runtime.pendingMinigameFocusRestore === null, 'successful focus restoration should clear the pending target');
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

test('exclusive-session settings controls stay focusable and expose a Polish reason', () => {
  const makeControl = () => ({
    dataset: {},
    attributes: new Map(),
    title: '',
    setAttribute(name, value) { this.attributes.set(name, String(value)); },
    getAttribute(name) { return this.attributes.get(name) || null; }
  });
  const controls = [makeControl(), makeControl(), makeControl()];
  let session = { kind: 'battle', phase: 'active', id: 'battle-1' };
  const render = evaluateFunction(uiSource, 'renderExclusiveSessionControls', {
    document: { querySelectorAll(selector) {
      assert(selector.includes('.panel-block--debug .debug-controls input'), 'debug inputs must share the exclusive-session UI contract');
      assert(selector.includes('.panel-block--debug .debug-controls button'), 'debug buttons must share the exclusive-session UI contract');
      assert(selector.includes('[data-world-preference]'), 'world preference inputs must share the exclusive-session UI contract');
      assert(selector.includes('[data-world-preference-toggle]'), 'world preference toggles must share the exclusive-session UI contract');
      return controls;
    } },
    getExclusiveGameplaySessionForUi: () => session,
    getExclusiveGameplayUiReason: () => 'Najpierw zakończ walkę na Arenie.'
  });
  render();
  controls.forEach((control) => {
    assert(control.getAttribute('aria-disabled') === 'true', 'mutating settings control should expose aria-disabled');
    assert(control.dataset.disabledReason.includes('Arenie'), 'blocked control should expose its reason');
    assert(!('disabled' in control), 'aria-disabled control should not be removed from keyboard focus order');
  });
  session = null;
  render();
  controls.forEach((control) => {
    assert(control.getAttribute('aria-disabled') === 'false', 'session-owned aria-disabled state should be cleared');
    assert(!control.dataset.disabledReason, 'stale session reason should be removed');
  });
});

test('world preferences restore their rendered value and stop before an exclusive mutation', () => {
  const reason = 'Najpierw zakończ minigrę albo wróć do jej planszy.';
  const session = { kind: 'minigame', phase: 'active', id: 'dewCatch' };
  let prevented = 0;
  let stopped = 0;
  let restored = 0;
  let blockedInputUpdate = 0;
  let announcement = '';
  const control = {
    value: '77',
    dataset: { worldPreference: 'volume', disabledReason: reason },
    closest: () => control,
    getAttribute(name) { return name === 'aria-disabled' ? 'true' : null; }
  };
  const handleInput = evaluateFunction(uiSource, 'handleWorldPreferenceInput', {
    getExclusiveGameplaySessionForUi: () => session,
    getExclusiveGameplayUiReason: () => reason,
    syncWorldPreferenceControls: () => { restored += 1; control.value = '40'; },
    renderExclusiveSessionControls: () => {},
    announceUiStatus: (message) => { announcement = message; },
    updateWorldPreferenceFromUi: () => { blockedInputUpdate += 1; }
  });
  handleInput({
    target: control,
    type: 'change',
    preventDefault() { prevented += 1; },
    stopImmediatePropagation() { stopped += 1; }
  });
  assert(prevented === 1 && stopped === 1, 'blocked preference input must stop before other change listeners');
  assert(restored === 1 && control.value === '40', 'blocked preference input must restore the durable rendered value');
  assert(blockedInputUpdate === 0 && announcement === reason, 'blocked preference input must announce the Polish reason without updating');

  let canonicalUpdates = 0;
  let guarded = 0;
  let rendered = 0;
  const update = evaluateFunction(uiSource, 'updateWorldPreferenceFromUi', {
    window: { updateWorldPreference() { canonicalUpdates += 1; return { ok: true }; } },
    getExclusiveGameplaySessionForUi: () => session,
    getExclusiveGameplayUiReason: () => reason,
    guardExclusiveUiMutation: () => { guarded += 1; return true; },
    syncWorldPreferenceControls: () => { restored += 1; return {}; },
    renderExclusiveSessionControls: () => { rendered += 1; },
    announceUiStatus: (message) => { announcement = message; },
    isRuntimeReadOnly: () => false
  });
  assert(update('audio', 'atmosphere', { userGesture: true }) === false, 'exclusive preference update must report a blocked mutation');
  assert(guarded === 1 && canonicalUpdates === 0, 'exclusive guard must run before the canonical preference helper');
  assert(rendered === 1 && announcement === reason, 'exclusive preference update must restore blocked semantics and announce its reason');
});

test('debug mutations stop before save-backed handlers during an exclusive session', () => {
  const runtime = {
    state: { saveRevision: 8, stats: { growth: 72 } },
    debug: { enabled: false }
  };
  const before = JSON.stringify(runtime.state);
  let prevented = false;
  let stopped = false;
  let rendered = 0;
  let exclusiveStateRendered = 0;
  let persisted = 0;
  const control = { closest: () => control };
  const event = {
    target: control,
    preventDefault() { prevented = true; },
    stopImmediatePropagation() { stopped = true; }
  };
  const block = evaluateFunction(debugSource, 'blockExclusiveDebugMutation', {
    dom: { debugPanel: { contains: (target) => target === control } },
    guardNonSessionMutation: () => true,
    renderDebugControls: () => { rendered += 1; },
    renderExclusiveSessionControls: () => { exclusiveStateRendered += 1; }
  });

  const blocked = block(event);
  if (!stopped) {
    runtime.state.stats.growth = 1;
    persisted += 1;
  }
  assert(blocked && prevented && stopped, 'exclusive debug input must be cancelled during capture');
  assert(rendered === 1, 'blocked debug input must restore its rendered value');
  assert(exclusiveStateRendered === 1, 'rebuilt dynamic debug controls must regain exclusive-session semantics');
  assert(JSON.stringify(runtime.state) === before, 'blocked debug input must leave state byte-for-byte unchanged');
  assert(persisted === 0, 'blocked debug input must not reach persistence');
});

test('name gate isolates and exactly restores background attributes', () => {
  const makeNode = (kind, attributes = {}, inert = false) => ({
    kind,
    inert,
    attributes: new Map(Object.entries(attributes)),
    matches(selector) { return kind === 'live' && selector.includes('[data-ui-status]'); },
    hasAttribute(name) { return this.attributes.has(name); },
    getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; },
    setAttribute(name, value) { this.attributes.set(name, String(value)); },
    removeAttribute(name) { this.attributes.delete(name); }
  });
  const header = makeNode('header', { 'aria-hidden': 'false' });
  const previouslyInert = makeNode('main', { inert: '' }, true);
  const live = makeNode('live');
  const ui = { nameGateBackgroundState: null };
  const sync = evaluateFunction(uiSource, 'syncNameGateBackgroundIsolation', {
    ensureSceneFirstUiRuntime: () => ui,
    document: { querySelectorAll: () => [header, previouslyInert, live] },
    Array
  });
  sync(true);
  assert(header.inert && header.getAttribute('aria-hidden') === 'true', 'background should become inert and hidden');
  assert(previouslyInert.inert, 'already inert background should stay inert');
  assert(!live.inert && !live.hasAttribute('aria-hidden'), 'live error/status output must remain exposed');
  sync(false);
  assert(!header.inert && header.getAttribute('aria-hidden') === 'false' && !header.hasAttribute('inert'), 'header attributes should be restored exactly');
  assert(previouslyInert.inert && previouslyInert.hasAttribute('inert'), 'pre-existing inert state should survive restoration');
});

test('closing the More menu restores focus when its action becomes hidden', () => {
  const ui = { actionTrayExpanded: true };
  const active = {};
  const moreButton = { hidden: false, focusCount: 0, focus() { this.focusCount += 1; } };
  const overflow = { hidden: false, contains: (node) => node === active };
  const runtime = { actionTray: { overflow, moreButton } };
  const collapse = evaluateFunction(uiSource, 'collapseMobileActionTray', {
    ensureSceneFirstUiRuntime: () => ui,
    runtime,
    document: { activeElement: active },
    updateMobileActionTrayState: () => { overflow.hidden = true; },
    getRuntimeNow: () => 0
  });
  assert(collapse({ restoreFocus: true }), 'expanded More menu should collapse');
  assert(!ui.actionTrayExpanded && overflow.hidden, 'collapsed state and hidden popup should stay in sync');
  assert(moreButton.focusCount === 1, 'focus should return to More after hiding a focused overflow action');
});

test('automatic action-tray hiding restores focus across breakpoint and workspace changes', () => {
  const firstAction = {
    disabled: false,
    hidden: false,
    focusCount: 0,
    classList: { contains: () => false },
    getAttribute: () => 'false',
    focus() { this.focusCount += 1; }
  };
  const selectedView = {
    disabled: false,
    hidden: false,
    focusCount: 0,
    getAttribute: () => 'false',
    closest: () => null,
    focus() { this.focusCount += 1; }
  };
  const staleHiddenTab = {
    disabled: false,
    hidden: false,
    getAttribute: () => 'false',
    closest: () => ({})
  };
  const moreButton = {};
  const overflowAction = {};
  const overflow = { contains: (node) => node === overflowAction };
  const primary = { querySelectorAll: () => [firstAction] };
  const panel = {
    contains: (node) => node === moreButton || node === overflowAction,
    querySelectorAll: () => [firstAction]
  };
  const restore = evaluateFunction(uiSource, 'restoreFocusAfterAutomaticActionTrayHide', {
    document: {
      querySelector(selector) {
        if (selector === 'dialog[open]') return null;
        if (selector.includes('[data-view-arena]')) return selectedView;
        if (selector.includes('[data-workspace-tab]')) return staleHiddenTab;
        return null;
      }
    },
    Array
  });

  assert(
    restore(panel, { moreButton, overflow, primary }, moreButton, false, true, false),
    'desktop breakpoint should move focus away from the hidden More trigger'
  );
  assert(firstAction.focusCount === 1, 'desktop breakpoint should focus the first visible action');
  assert(
    restore(panel, { moreButton, overflow, primary }, overflowAction, true, true, true, 'battle'),
    'hidden mobile tray should move focus to stable navigation'
  );
  assert(selectedView.focusCount === 1, 'session-driven view change should focus the visible top-level view');
});

test('calendar discovery sync is read-only during a pending exclusive session', () => {
  const initialState = {
    mushroomName: 'Borowik',
    flags: { nameConfirmed: true },
    worldJournal: { calendar: {} },
    saveRevision: 7
  };
  const runtime = { state: structuredClone(initialState) };
  let calendarReads = 0;
  let discoveryWrites = 0;
  let persistenceWrites = 0;
  const sync = evaluateFunction(uiSource, 'syncCalendarDiscoveries', {
    runtime,
    rules: {},
    window: {
      PieczargotchiCore: {
        getCalendarEventsForDate() {
          calendarReads += 1;
          return [{ id: 'event-1', active: true }];
        },
        recordCalendarDiscovery(state) {
          discoveryWrites += 1;
          return { ok: true, newlyDiscovered: true, state };
        }
      }
    },
    isRuntimeMutationBlocked: () => false,
    getExclusiveGameplaySessionForUi: () => ({ kind: 'battle', phase: 'pending', id: 'battle-pending' }),
    hasNamedMushroom: () => true,
    getRuntimeNow: () => 1000,
    getRuntimeDate: () => new Date(1000),
    persistRuntimeState: () => { persistenceWrites += 1; },
    Boolean,
    Date
  });

  const before = JSON.stringify(runtime.state);
  sync();
  assert(JSON.stringify(runtime.state) === before, 'pending session must leave the state byte-for-byte unchanged');
  assert(calendarReads === 0 && discoveryWrites === 0, 'calendar core helpers must not run during a pending session');
  assert(persistenceWrites === 0, 'pending session must not schedule persistence from render-time calendar sync');
});

test('active minigames expose a reversible focus-layout state hook', () => {
  const app = { dataset: {} };
  const html = { dataset: {} };
  const stagePanel = { dataset: {} };
  const standardSurface = { dataset: { launchPhase: 'running' } };
  const legendarySurface = { dataset: { launchPhase: 'countdown' } };
  const runtime = {
    state: { minigames: { active: { id: 'dewCatch' } } },
    minigameLaunch: null
  };
  const sync = evaluateFunction(uiSource, 'syncActiveGameplayLayoutState', {
    runtime,
    dom: { app, stagePanel, minigamePlayfield: standardSurface, legendaryGamePlayfield: legendarySurface },
    document: { documentElement: html },
    isForeignExclusiveSessionActive: () => false,
    isLegendaryMinigameRuntimeId: (id) => id === 'memoryGarden',
    Boolean
  });

  sync();
  assert(app.dataset.gameplayFocus === 'standard' && app.dataset.gameplayPhase === 'running', 'standard round should mark the app and its phase');
  assert(html.dataset.gameplayFocus === 'standard' && stagePanel.dataset.sceneCalm === 'true', 'document and stage should expose the same calm-layout state');

  runtime.state.minigames.active = { id: 'memoryGarden' };
  sync();
  assert(app.dataset.gameplayFocus === 'legendary' && app.dataset.gameplayPhase === 'countdown', 'legendary round should switch the focus kind and surface phase');

  runtime.state.minigames.active = null;
  sync();
  assert(!app.dataset.gameplayFocus && !html.dataset.gameplayFocus && !stagePanel.dataset.sceneCalm, 'normal care view must remove every focus-layout hook');
});

test('keyboard E opens exploration only outside inputs, dialogs, and exclusive play', () => {
  let keydown = null;
  let opened = 0;
  let modal = false;
  let exclusive = null;
  const shouldIgnoreShortcut = evaluateFunction(bootSource, 'shouldIgnoreShortcut', {});
  const bind = evaluateFunction(bootSource, 'bindKeyboardShortcuts', {
    document: {
      addEventListener(type, handler) {
        if (type === 'keydown') keydown = handler;
      }
    },
    actions: [],
    shouldIgnoreShortcut,
    isUiInputModalActive: () => modal,
    getExclusiveGameplaySession: () => exclusive,
    toggleWorldExplorationPanel: () => { opened += 1; },
    handleAction: () => {},
    flashActionButton: () => {}
  });
  bind();
  const target = { tagName: 'DIV', isContentEditable: false };
  const event = (overrides = {}) => Object.assign({
    key: 'e',
    target,
    defaultPrevented: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    isComposing: false,
    repeat: false,
    preventDefault() { this.defaultPrevented = true; }
  }, overrides);

  const openEvent = event();
  keydown(openEvent);
  assert(opened === 1 && openEvent.defaultPrevented, 'plain E should open exploration and consume the shortcut');

  keydown(event({ target: { tagName: 'INPUT', isContentEditable: false } }));
  modal = true;
  keydown(event());
  modal = false;
  exclusive = { kind: 'minigame', id: 'dewCatch' };
  keydown(event());
  assert(opened === 1, 'E must be ignored in inputs, dialogs, and active gameplay sessions');
});

test('exploration actions reuse grass, celestial, guest, and cooldown seams', () => {
  const runtime = {
    input: {},
    worldInteractions: { effects: [], cooldowns: {} }
  };
  const cooldownKeys = [];
  let celestialCount = 0;
  let guestCount = 0;
  const perform = evaluateFunction(interactionSource, 'performWorldExplorationAction', {
    runtime,
    getInteractionNow: () => 1000,
    getWorldExplorationActions: () => [
      { id: 'grass', available: true },
      { id: 'sky', available: true },
      { id: 'guest', available: true }
    ],
    canUseWorldInteractionCooldown(key) { cooldownKeys.push(key); return true; },
    playWorldInteractionSensoryCue: () => {},
    createDefaultInputState: () => ({}),
    triggerGrassBrushInteraction() {
      runtime.worldInteractions.effects.push({ type: 'grassFind', label: 'Srebrny pyłek' });
    },
    getWorldExplorationCelestialTarget: () => ({ id: 'celestial:sun', kind: 'sun', x: 50, y: 60 }),
    handleCelestialPointerDown: () => { celestialCount += 1; },
    getWorldExplorationGuestTarget: () => ({ id: 'visitor:bee', kind: 'visitor', x: 20, y: 30 }),
    isWorldInteractionCooldownActive: () => false,
    triggerAmbientPointerEffect: () => { guestCount += 1; },
    Math,
    Number,
    Array
  });

  const grass = perform('grass', 1000);
  const sky = perform('sky', 1000);
  const guest = perform('guest', 1000);
  assert(grass.ok && grass.message.includes('Srebrny pyłek'), 'grass exploration should report an existing discovery effect');
  assert(runtime.input.grassBrushDistance >= 132 && cooldownKeys.includes('explore:grass'), 'grass exploration should use the shared brush threshold and cooldown store');
  assert(sky.ok && celestialCount === 1 && cooldownKeys.includes('explore:sky'), 'sky exploration should route through the existing celestial reaction');
  assert(guest.ok && guestCount === 1, 'guest exploration should route through the existing ambient pointer effect');
});

test('world pointer interactions emit optional cues only after their cooldown seam', () => {
  const cues = [];
  const effects = [];
  const common = {
    runtime: { input: { x: 80, y: 90 }, worldInteractions: { cooldowns: {} }, celestialMood: null },
    canUseWorldInteractionCooldown: () => true,
    playWorldInteractionSensoryCue: (cue) => cues.push(cue),
    addWorldInteractionEffect: (effect) => effects.push(effect),
    createDefaultCelestialMoodState: () => ({}),
    createDefaultCelestialMoodTarget: () => ({ count: 0, lastAt: 0 }),
    Math,
    Number
  };
  const grass = evaluateFunction(interactionSource, 'triggerGrassTapRustle', common);
  const ambient = evaluateFunction(interactionSource, 'triggerAmbientPointerEffect', common);
  const celestial = evaluateFunction(interactionSource, 'handleCelestialPointerDown', common);

  grass({ x: 120, y: 420 }, 1000);
  ambient({ id: 'butterfly:1', kind: 'butterfly', x: 140, y: 170 }, { x: 140, y: 170 }, 1200);
  celestial('sun', 1400);
  assert(cues.join(',') === 'focus,focus,weather', `expected semantic world cues, got ${cues.join(',')}`);
  assert(effects.length === 3, 'audio integration must not replace any visual interaction effect');

  const blockedGrass = evaluateFunction(interactionSource, 'triggerGrassTapRustle', Object.assign({}, common, {
    canUseWorldInteractionCooldown: () => false
  }));
  blockedGrass({ x: 120, y: 420 }, 1500);
  assert(cues.length === 3, 'cooldown-rejected interaction must not emit another cue');
});

test('exclusive gameplay blocks canvas world gestures before effects, audio, or persistence', () => {
  const runtime = {
    state: {
      minigames: { active: { id: 'sporePop' } },
      battle: { activeBattle: null },
      discoveries: { environment: {} }
    },
    input: {},
    worldInteractions: { effects: [], cooldowns: {} },
    pendingExclusiveStart: null
  };
  const isExclusive = evaluateFunction(interactionSource, 'isWorldInteractionExclusiveSessionActive', { runtime });
  assert(isExclusive(), 'active minigame must block world input');
  runtime.state.minigames.active = null;
  runtime.pendingExclusiveStart = { kind: 'battle', id: 'pending-battle' };
  assert(isExclusive(), 'pending battle must block world input');
  runtime.pendingExclusiveStart = null;
  runtime.state.battle.activeBattle = { id: 'battle-1', mode: 'playing' };
  assert(isExclusive(), 'active battle must block world input');
  const immersionBlocked = evaluateFunction(interactionSource, 'isRuntimeImmersionBlocked', {
    runtime,
    isWorldInteractionExclusiveSessionActive: isExclusive
  });
  assert(immersionBlocked(2000), 'exclusive gameplay must also suppress autonomous immersion reactions');

  let downCalls = 0;
  let dragCalls = 0;
  let hoverCalls = 0;
  const stateBefore = JSON.stringify(runtime.state);
  const update = evaluateFunction(interactionSource, 'updatePointerState', {
    runtime,
    getCanvasPointerPoint: () => ({ x: 180, y: 430 }),
    getInteractionNow: () => 2000,
    isWorldInteractionExclusiveSessionActive: isExclusive,
    handlePointerDownGesture: () => { downCalls += 1; },
    updatePointerDragGesture: () => { dragCalls += 1; },
    updatePointerHoverBrushGesture: () => { hoverCalls += 1; },
    Math,
    Number
  });
  update({ pointerType: 'mouse', pointerId: 7 }, true, true);
  update({ pointerType: 'mouse', pointerId: 7 }, true, false);
  assert(downCalls + dragCalls + hoverCalls === 0, 'exclusive canvas events must stop before all world gesture handlers');
  assert(JSON.stringify(runtime.state) === stateBefore && runtime.worldInteractions.effects.length === 0,
    'exclusive canvas events must leave save state and world effects byte-equivalent');

  let persistCalls = 0;
  const discover = evaluateFunction(interactionSource, 'maybeRecordGrassInteractionDiscovery', {
    runtime,
    isRuntimeMutationBlocked: () => false,
    isWorldInteractionExclusiveSessionActive: isExclusive,
    persistRuntimeState: () => { persistCalls += 1; }
  });
  assert(discover({ x: 180, y: 430 }, 2000) === null && persistCalls === 0,
    'grass discovery defense must stop before core mutation and persistence');
});

test('world effects invalidate their start and one-shot cleanup frames', () => {
  const runtime = { worldInteractions: { effects: [], cooldowns: {}, effectCleanupTimer: null, effectCleanupAt: 0 } };
  let startRenders = 0;
  let cleanupSchedules = 0;
  const add = evaluateFunction(interactionSource, 'addWorldInteractionEffect', {
    runtime,
    isWorldInteractionExclusiveSessionActive: () => false,
    getInteractionNow: () => 1000,
    requestWorldInteractionRender: () => { startRenders += 1; },
    scheduleWorldInteractionEffectCleanup: () => { cleanupSchedules += 1; },
    Object
  });
  add({ type: 'grassRustle', startedAt: 1000, duration: 100, visible: true });
  assert(startRenders === 1 && cleanupSchedules === 1 && runtime.worldInteractions.effects.length === 1,
    'adding a world effect must request its visible frame and one cleanup schedule');

  let now = 1000;
  let cleanupCallback = null;
  let cleanupRenders = 0;
  const schedule = evaluateFunction(interactionSource, 'scheduleWorldInteractionEffectCleanup', {
    runtime,
    getInteractionNow: () => now,
    requestWorldInteractionRender: () => { cleanupRenders += 1; },
    scheduleWorldInteractionEffectCleanup: () => {},
    window: {
      setTimeout(callback) { cleanupCallback = callback; return 17; },
      clearTimeout() {}
    },
    Math,
    Number
  });
  schedule();
  assert(typeof cleanupCallback === 'function', 'effect expiry must arm one cleanup callback');
  now = 1116;
  cleanupCallback();
  assert(runtime.worldInteractions.effects.length === 0 && cleanupRenders === 1,
    'expiry callback must remove the frozen effect and invalidate its cleanup frame');

  runtime.immersion = { active: { id: 'rain', until: 1300 } };
  now = 1200;
  cleanupCallback = null;
  schedule();
  assert(typeof cleanupCallback === 'function', 'still-mode immersion must arm its end-frame invalidation');
  now = 1316;
  cleanupCallback();
  assert(runtime.immersion.active === null && cleanupRenders === 2,
    'expired immersion must clear itself and request exactly one cleanup frame');
  assert(interactionSource.includes("getEffectiveRuntimeMotionMode() === 'still'") && interactionSource.includes('Math.max(0.22, progress)'),
    'still mode must render a readable static effect frame instead of a near-transparent fade-in');
});

test('world setting controls call the canonical preference helper', () => {
  let update = null;
  let announcement = '';
  const values = { motion: 'gentle', flash: true, battery: false, audio: 'cues', volume: 40 };
  const updateFromUi = evaluateFunction(uiSource, 'updateWorldPreferenceFromUi', {
    window: {
      updateWorldPreference(key, value, options) {
        update = { key, value, options };
        return { ok: true };
      }
    },
    document: { dispatchEvent() {} },
    getExclusiveGameplaySessionForUi: () => null,
    isRuntimeReadOnly: () => false,
    syncWorldPreferenceControls: () => values,
    announceUiStatus: (message) => { announcement = message; },
    String
  });
  assert(updateFromUi('motion', 'gentle', { userGesture: true, announce: true }), 'canonical preference update should succeed');
  assert(update && update.key === 'motion' && update.value === 'gentle' && update.options.userGesture, 'UI must pass the public motion key and user-gesture flag');
  assert(announcement.includes('Ruch świata') && announcement.includes('ograniczony'), 'the change should be confirmed through the Polish live status');
});

test('GUI accessibility hooks and desktop focus dimensions remain explicit', () => {
  const canvasIndex = indexSource.indexOf('<div class="canvas-wrap">');
  const messageIndex = indexSource.indexOf('<div class="message-panel"');
  const rhythmIndex = indexSource.indexOf('data-daily-rhythm');
  const planIndex = indexSource.indexOf('data-day-plan');
  const explorationIndex = indexSource.indexOf('<div class="world-explore"');
  assert(
    canvasIndex < messageIndex
      && messageIndex < rhythmIndex
      && rhythmIndex < planIndex
      && planIndex < explorationIndex,
    'care attention order must stay canvas, urgent message, daily context, then exploration'
  );
  ['grass', 'sky', 'guest'].forEach((id) => {
    assert(indexSource.includes(`data-world-explore-action="${id}"`), `missing accessible exploration action ${id}`);
  });
  ['motion', 'flash', 'battery', 'audio', 'volume'].forEach((key) => {
    assert(indexSource.includes(`="${key}"`), `missing world preference hook ${key}`);
  });
  assert(indexSource.includes('data-world-explore-status></p>')
    && !indexSource.includes('data-world-explore-status role="status"'),
  'local exploration copy must remain visual while the single global live region announces it');
  assert(uiSource.includes('announceUiStatus(message, false)'), 'exploration feedback must reach the global polite live region once');
  assert(/\.world-explore__toggle\s*\{[^}]*min-height:\s*44px/s.test(stylesSource),
    'short landscape layouts must retain the 44 px touch target');
  assert((compostSource.match(/drawCompostZoneSymbols\(/g) || []).length === 2
    && (compostSource.match(/drawCompostZoneLabels\(/g) || []).length === 2,
  'compost labels and symbols must be drawn once, not overdrawn by both background and drop-zone passes');
  assert(stylesSource.includes('minmax(440px, 520px)'), 'active desktop gameplay panel must stay within the accepted 440-520 px range');
  assert(stylesSource.includes('width: min(100%, 420px)') && stylesSource.includes('width: min(100%, 460px)'), 'standard and legendary canvases need enlarged desktop widths');
  assert(stylesSource.includes('.stage-panel[data-scene-calm="true"]'), 'active gameplay must visibly calm the unrelated care scene');
});

test('browser QA covers responsive journal, real touch cancellation, and world interactions', () => {
  assert(indexSource.includes('data-minigame-announcement'), 'dedicated minigame status output is missing');
  assert(uiSource.includes("button.dataset.focusKey = 'legendary-game-' + game.id"), 'legendary start buttons need stable focus keys');
  assert(captureSource.includes('expectsTiltedPolaroid = viewportWidth > 640'), 'journal tilt assertion must follow the CSS breakpoint');
  assert(captureSource.includes("type: 'touchCancel'"), 'mobile capture must issue a real touchCancel event');
  assert(captureSource.includes('qa.beginStorageBusyProbe()'), 'pending-session QA must wrap the real persistence seam');
  assert(bootSource.includes('installRuntimeQaControls()'), 'runtime QA controls must remain behind exposeRuntime');
  assert(bootSource.includes('saveStateForRuntime(candidate)'), 'exclusive starts must pass through the instrumented persistence seam');
  assert(!captureSource.includes("runtime.pendingExclusiveStart = { kind: 'battle', phase: 'pending'"), 'pending-session QA must not inject the pending flag manually');
  assert(browserSmokeSource.includes("PIECZARGOTCHI_CAPTURE_INTERACTIONS: '1'"), 'canonical browser smoke must enable world interactions');
  assert(browserSmokeSource.includes('runMobileVisualProbe'), 'canonical browser smoke must include mobile journal and touch coverage');
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
