import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const coreScript = renderTemplate('ClientCore.html')
  .replace(/^<script>\s*/, '')
  .replace(/\s*<\/script>\s*$/, '');
const coreContext = { globalThis: {} };
coreContext.globalThis = coreContext;
vm.createContext(coreContext);
vm.runInContext(coreScript, coreContext, { filename: 'ClientCore.html' });
const core = coreContext.PieczargotchiCore;

test('daily rhythm selection is idempotent', () => {
  const now = Date.parse('2026-07-10T09:00:00.000Z');
  const scene = { condition: 'clear', isDay: true, temperature: 20 };
  const state = makeProgressionState();
  const options = core.getDailyRhythmOptions(state, {}, now, scene);
  assert(options.options.length > 0, 'expected a daily rhythm option');
  const selected = core.selectDailyRhythm(state, options.options[0].id, {}, now, scene);
  assert(selected.ok, 'expected initial rhythm selection to succeed');
  selected.state.dailyPlan.completed.kept = { id: 'kept', completedAt: new Date(now).toISOString() };
  const repeated = core.selectDailyRhythm(selected.state, options.options[0].id, {}, now, scene);
  assert(repeated.ok && repeated.unchanged, 'expected repeated selection to be a no-op');
  assert(repeated.state.dailyPlan.completed.kept, 'expected completed daily-plan progress to survive');
});

test('legendary project daily cap covers ordinary actions', () => {
  const now = Date.parse('2026-07-10T09:00:00.000Z');
  const rules = { legendaryGames: { unlockStage: 'legendary', dailyProjectPointCap: 6, games: {} } };
  let state = makeProgressionState();
  state.stage = 'legendary';
  state.longLoop = { legendaryProjects: { activeId: 'dewGarden', progress: {}, completed: {} } };
  for (let index = 0; index < 10; index += 1) {
    state = core.updateLongLoopProgress(state, { type: 'action', actionId: 'hydrate' }, rules, now + index, {}).state;
  }
  assert(state.longLoop.legendaryProjects.progress.dewGarden.points === 6, 'expected ordinary actions to respect the six-point cap');
  assert(state.legendaryGames.daily.projectPointsEarned === 6, 'expected every project point source to update the daily counter');
});

test('battle guard is consumed by the next opposing turn even when it rests', () => {
  const catalog = [
    { id: 'expensive', staminaCost: 99, power: 10, accuracy: 1, stat: 'strength' },
    { id: 'jab', staminaCost: 0, power: 3, accuracy: 1, stat: 'strength' }
  ];
  const battle = {
    rngSeed: 42,
    turn: 0,
    player: makeCombatant({ stamina: 0, speed: 30 }),
    opponent: makeCombatant({ guard: 0.35, speed: 10 })
  };
  const resolved = core.resolveBattleTurn(battle, 'expensive', 'jab', catalog);
  assert(resolved.events[0].type === 'rest', 'expected the first combatant to rest');
  assert(resolved.opponent.guard === 0, 'expected the waiting guard to be consumed');
});

test('legendary combo bonuses make flawless seed-independent mastery reachable', () => {
  const source = readFileSync(path.join(rootDir, 'ClientLegendaryGames.html'), 'utf8');
  const comboBonus = evaluateFunction(source, 'getLegendaryComboBonus', {});
  const league = Array.from({ length: 16 }, (_value, index) => 1 + comboBonus('myceliumLeague', index + 1));
  const garden = Array.from({ length: 12 }, (_value, index) => 1 + comboBonus('memoryGarden', index + 1));
  assert(sum(league) === 24, `expected league minimum flawless score 24, got ${sum(league)}`);
  assert(sum(garden) === 15, `expected garden minimum flawless score 15, got ${sum(garden)}`);
});

test('minimal future save gets a safe read-only view without mutating raw data', () => {
  const source = readFileSync(path.join(rootDir, 'ClientBoot.html'), 'utf8');
  const defaults = makeProgressionState();
  const raw = { version: 18, saveRevision: 9, futureOnly: { untouched: true } };
  const before = JSON.stringify(raw);
  const createView = evaluateFunction(source, 'createReadOnlyStateView', {
    deepClone: (value) => JSON.parse(JSON.stringify(value)),
    createDefaultState: () => JSON.parse(JSON.stringify(defaults)),
    mergeState: (base, override) => deepMerge(base, override),
    normalizeState: (state) => state
  });
  const view = createView(raw);
  assert(JSON.stringify(raw) === before, 'expected raw future save to remain byte-equivalent');
  assert(view.version === 18 && view.saveRevision === 9, 'expected future metadata in the view');
  assert(view.stats && view.inventory && view.minigames && view.battle, 'expected current UI subtrees in the safe view');
  assert(view.futureOnly.untouched, 'expected unknown future fields to remain visible in memory');
});

test('elapsed game over remains terminal and cannot be replaced by a return recap', () => {
  const source = readFileSync(path.join(rootDir, 'ClientState.html'), 'utf8');
  const start = Date.parse('2026-07-10T12:00:00.000Z');
  const end = start + 2 * 60000;
  let recapCalls = 0;
  let dailyPlanCalls = 0;
  const rules = {
    statBounds: { min: 0, max: 100 },
    stageThresholds: [{ id: 'spore', growth: 0 }, { id: 'legendary', growth: 100 }],
    decayPerHour: { awake: {}, sleeping: {}, quietAwake: {}, quietSleeping: {} },
    healthPerHour: { poorConditions: -0.01, goodConditions: 0.01 },
    growthPerHour: { awakeHealthy: 0.01, sleepingHealthy: 0.01, quietDrowsyHealthy: 0.01 },
    patchPerHour: { cleanHealthy: 0.01, neglected: -0.01 },
    careRhythm: { quietStartMinute: 22 * 60 + 30, quietEndMinute: 7 * 60, morningGraceMs: 45 * 60000, offlineCapHours: 24 },
    attention: { mildThreshold: 40, criticalThreshold: 20, deadlineMs: 90000, criticalDeadlineMs: 60000 },
    needDefinitions: { hydration: { category: 'physical', actionId: 'hydrate' } },
    recovery: {
      triggerHealth: 0,
      durationMs: 6 * 3600000,
      extensionMs: 2 * 3600000,
      recentCareMs: 2.5 * 3600000,
      maxMissedCare: 3,
      startHealth: 8,
      completeHealth: 28,
      careMinimums: { hydration: 28, nutrients: 28, cleanliness: 28 },
      requiredCareActionIds: ['hydrate', 'feed', 'clean']
    }
  };
  const state = makeProgressionState();
  state.createdAt = new Date(start - 86400000).toISOString();
  state.lastUpdatedAt = new Date(start).toISOString();
  state.currentActivity = { type: 'notice', until: end + 10000 };
  Object.assign(state.stats, { health: 8, hydration: 10, nutrients: 10, cleanliness: 10 });
  state.recovery = {
    active: true,
    startedAt: new Date(start - 60000).toISOString(),
    until: new Date(start + 60000).toISOString(),
    lastCareAt: null,
    careActions: {},
    missedCare: 2,
    reason: 'healthZero'
  };
  const applyElapsedTime = evaluateFunction(source, 'applyElapsedTime', {
    persistenceState: { readOnly: false },
    window: { PieczargotchiCore: core },
    rules,
    getCurrentWeatherScene: () => null,
    getStageForGrowth: () => 'spore',
    updateArenaUnlock: () => {},
    refreshDailyPlanState: () => { dailyPlanCalls += 1; },
    applyReturnRecapState: (nextState) => {
      recapCalls += 1;
      nextState.currentActivity = { type: 'notice', label: 'Powrót' };
    },
    logElapsedHarvestEvent: () => {},
    logRecoveryEvent: () => {},
    logAttentionEvent: () => {},
    addLog: () => {},
    triggerEffect: () => {}
  });
  const result = applyElapsedTime(state, end);

  assert(result.gameOver.active, 'expected elapsed recovery neglect to reach game over');
  assert(result.currentActivity === null, 'terminal state must clear recap and activity notices');
  assert(recapCalls === 0 && dailyPlanCalls === 0, 'terminal transition must skip recap and daily-plan mutations');
});

test('foreign exclusive sessions stay passive and never autosave or resume locally', () => {
  const bootSource = readFileSync(path.join(rootDir, 'ClientBoot.html'), 'utf8');
  const describe = evaluateFunction(bootSource, 'getActiveExclusiveSessionDescriptor', {});
  const state = makeProgressionState();
  state.minigames.active = {
    id: 'dewCatch',
    startedAt: 100,
    until: 200,
    ownerWriterId: 'other-tab',
    ownerLeaseUntil: 10000
  };
  const descriptor = describe(state);
  assert(descriptor && descriptor.kind === 'minigame' && descriptor.minigameId === 'dewCatch', 'expected the external minigame to be detected');
  const battleState = makeProgressionState();
  battleState.battle.activeBattle = { id: 'arena-1', mode: 'active' };
  const battleDescriptor = describe(battleState);
  assert(battleDescriptor && battleDescriptor.kind === 'battle' && battleDescriptor.battleId === 'arena-1', 'expected the external battle to be detected');
  battleState.battle.activeBattle.mode = 'victory';
  assert(describe(battleState) === null, 'expected a terminal battle not to keep passive ownership');

  let resumeCount = 0;
  let reconcileCount = 0;
  let stopCount = 0;
  let renderedReason = '';
  const externalRuntime = {
    state: makeProgressionState(),
    persistenceStatus: { mode: 'storage' },
    exclusiveSession: { kind: 'minigame', id: 'local' },
    foreignExclusiveSession: null
  };
  const getWriterId = evaluateFunction(bootSource, 'getCurrentPersistenceWriterId', {
    getPersistenceStatus: () => ({ tabId: 'this-tab' }),
    runtime: externalRuntime
  });
  const inspectOwnership = evaluateFunction(bootSource, 'inspectExclusiveSessionOwnership', {
    getActiveExclusiveSessionDescriptor: describe,
    getCurrentPersistenceWriterId: getWriterId
  });
  let scheduledAt = 0;
  const handleExternal = evaluateFunction(bootSource, 'handleExternalPersistenceUpdate', {
    runtime: externalRuntime,
    cancelPendingExclusiveStart: () => {},
    getPersistenceStatus: () => ({ mode: 'storage' }),
    stopMinigameRuntime: () => { stopCount += 1; },
    deepClone: (value) => JSON.parse(JSON.stringify(value)),
    createReadOnlyStateView: (value) => value,
    migrateState: (value) => JSON.parse(JSON.stringify(value)),
    acknowledgePersistenceRevision: () => {},
    inspectExclusiveSessionOwnership: inspectOwnership,
    markForeignExclusiveOwnership: (ownership, claimPending) => {
      externalRuntime.foreignExclusiveSession = Object.assign({}, ownership.descriptor, { claimPending });
    },
    scheduleExclusiveOwnershipClaim: (at) => { scheduledAt = at; },
    clearExclusiveOwnershipClaimSchedule: () => { scheduledAt = 0; },
    getExclusiveOwnershipNow: () => 123,
    getRuntimeNow: () => 123,
    reconcileExclusiveRuntimeSession: () => { reconcileCount += 1; },
    renderUi: () => {},
    resumeMinigameIfActive: () => { resumeCount += 1; },
    renderPersistenceStatus: (status) => { renderedReason = status && status.reason || ''; }
  });
  handleExternal({ state, revision: 4, writerId: 'other-tab' });
  assert(externalRuntime.foreignExclusiveSession && externalRuntime.foreignExclusiveSession.kind === 'minigame', 'expected external ownership to enter passive mode');
  assert(stopCount === 1 && resumeCount === 0 && reconcileCount === 0, 'expected no foreign runtime takeover');
  assert(renderedReason === 'foreignExclusive', 'expected passive-session status');
  assert(scheduledAt === 10000, 'expected takeover to wait for the persisted lease expiry');

  const finishedState = JSON.parse(JSON.stringify(state));
  finishedState.minigames.active = null;
  handleExternal({ state: finishedState, revision: 5, writerId: 'other-tab' });
  assert(externalRuntime.foreignExclusiveSession === null, 'expected passive mode to clear after the owner finishes');
  assert(resumeCount === 1 && reconcileCount === 1, 'expected normal reconciliation to resume after the foreign session ends');

  let writeCount = 0;
  let statusReason = '';
  const persist = evaluateFunction(bootSource, 'persistRuntimeState', {
    isForeignExclusiveSessionActive: () => true,
    runtime: { persistenceStatus: { mode: 'storage' } },
    renderPersistenceStatus: (result) => { statusReason = result.reason; },
    saveState: () => { writeCount += 1; return { ok: true }; }
  });
  const persisted = persist(state, 0);
  assert(!persisted.ok && persisted.reason === 'foreignExclusive', 'expected passive persistence result');
  assert(writeCount === 0 && statusReason === 'foreignExclusive', 'expected no write while another tab owns the session');

  const minigameSource = readFileSync(path.join(rootDir, 'ClientMinigameDewCatch.html'), 'utf8');
  let passiveStopCount = 0;
  const passiveRuntime = { state, minigame: null, exclusiveSession: { kind: 'minigame' } };
  const resume = evaluateFunction(minigameSource, 'resumeMinigameIfActive', {
    isForeignExclusiveSessionActive: () => true,
    stopMinigameRuntime: () => { passiveStopCount += 1; },
    runtime: passiveRuntime
  });
  resume();
  assert(passiveStopCount === 1 && passiveRuntime.exclusiveSession === null, 'expected the secondary tab to refuse runtime ownership');

  let initialClaimCount = 0;
  let initialScheduledAt = 0;
  const initialRuntime = {
    state: JSON.parse(JSON.stringify(state)),
    foreignExclusiveSession: null
  };
  const initializeOwnership = evaluateFunction(bootSource, 'initializeLoadedExclusiveSessionOwnership', {
    runtime: initialRuntime,
    inspectExclusiveSessionOwnership: inspectOwnership,
    clearExclusiveOwnershipClaimSchedule: () => {},
    markForeignExclusiveOwnership: (ownership) => {
      initialRuntime.foreignExclusiveSession = Object.assign({}, ownership.descriptor);
    },
    scheduleExclusiveOwnershipClaim: (at) => { initialScheduledAt = at; },
    renderPersistenceStatus: () => {},
    claimExclusiveSessionOwnership: () => { initialClaimCount += 1; return { ok: false }; }
  });
  assert(initializeOwnership(123) === false, 'expected an initial second tab to remain passive');
  assert(initialClaimCount === 0 && initialScheduledAt === 10000, 'expected no initial write before the live foreign lease expires');

  let applyCount = 0;
  let initialWriteCount = 0;
  let initialResumeCount = 0;
  let timerStartCount = 0;
  const finishRuntime = { booted: false, state: null };
  const finishInit = evaluateFunction(bootSource, 'finishInit', {
    runtime: finishRuntime,
    markClientBootSeen: () => {},
    loadState: () => JSON.parse(JSON.stringify(state)),
    initializeRuntimePersistenceSync: () => {},
    isRuntimeReadOnly: () => false,
    getExclusiveOwnershipNow: () => 123,
    initializeLoadedExclusiveSessionOwnership: () => false,
    applyElapsedTime: (value) => { applyCount += 1; return value; },
    getRuntimeNow: () => 123,
    persistRuntimeState: () => { initialWriteCount += 1; return { ok: true }; },
    warmUpCurrentStageAssets: () => {},
    renderBuildBadge: () => {},
    renderActions: () => {},
    initAdaptiveActionDock: () => {},
    renderDebugControls: () => {},
    bindControls: () => {},
    bindImmersionInput: () => {},
    bindKeyboardShortcuts: () => {},
    renderUi: () => {},
    focusNameInputIfNeeded: () => {},
    resumeMinigameIfActive: () => { initialResumeCount += 1; },
    startTimers: () => { timerStartCount += 1; },
    startRenderLoop: () => {}
  });
  finishInit();
  assert(applyCount === 0 && initialWriteCount === 0 && initialResumeCount === 0, 'expected boot to avoid elapsed mutation, write, and resume in the second tab');
  assert(timerStartCount === 1, 'expected passive boot to keep timers available for bounded lease takeover');
});

test('expired exclusive ownership is claimed with replacement CAS before resume', () => {
  const bootSource = readFileSync(path.join(rootDir, 'ClientBoot.html'), 'utf8');
  const describe = evaluateFunction(bootSource, 'getActiveExclusiveSessionDescriptor', {});
  const runtime = { persistenceStatus: { tabId: 'new-owner' } };
  const getWriterId = evaluateFunction(bootSource, 'getCurrentPersistenceWriterId', {
    getPersistenceStatus: () => ({ tabId: 'new-owner' }),
    runtime
  });
  const inspectOwnership = evaluateFunction(bootSource, 'inspectExclusiveSessionOwnership', {
    getActiveExclusiveSessionDescriptor: describe,
    getCurrentPersistenceWriterId: getWriterId
  });
  const ownershipConfig = {
    battleLeaseMs: 240000,
    battleRefreshBeforeMs: 150000,
    minigameGraceMs: 30000,
    maxAcceptedLeaseMs: 600000,
    retryDelayMs: 750,
    maxClaimAttempts: 4
  };
  const assignOwnership = evaluateFunction(bootSource, 'assignExclusiveSessionOwnership', {
    getActiveExclusiveSessionDescriptor: describe,
    getCurrentPersistenceWriterId: getWriterId,
    exclusiveOwnershipConfig: ownershipConfig
  });
  const state = makeProgressionState();
  state.saveRevision = 7;
  state.saveWriterId = 'old-writer';
  state.minigames.active = {
    id: 'dewCatch',
    startedAt: 100,
    until: 5000,
    ownerWriterId: 'dead-owner',
    ownerLeaseUntil: 999
  };
  const original = JSON.stringify(state);
  let casCalls = 0;
  let casPrevious = null;
  const claim = evaluateFunction(bootSource, 'claimExclusiveSessionOwnership', {
    inspectExclusiveSessionOwnership: inspectOwnership,
    deepClone: (value) => JSON.parse(JSON.stringify(value)),
    assignExclusiveSessionOwnership: assignOwnership,
    saveReplacementState: (candidate, previous) => {
      casCalls += 1;
      casPrevious = JSON.parse(JSON.stringify(previous));
      candidate.saveRevision = 8;
      candidate.saveWriterId = 'new-owner';
      return { ok: true, revision: 8, mode: 'storage' };
    }
  });
  const result = claim(state, 1000);
  assert(result.ok && result.claimed, 'expected the expired lease to be claimed');
  assert(casCalls === 1 && casPrevious.saveRevision === 7 && casPrevious.saveWriterId === 'old-writer', 'expected exact previous revision to be supplied to replacement CAS');
  assert(result.state.minigames.active.ownerWriterId === 'new-owner', 'expected ownership to move to the current writer');
  assert(result.state.minigames.active.ownerLeaseUntil === 35900, 'expected minigame lease to cover its full duration plus grace');
  assert(JSON.stringify(state) === original, 'expected ownership claim preparation not to mutate the loaded snapshot');

  const hostileLeaseState = JSON.parse(JSON.stringify(state));
  hostileLeaseState.minigames.active.ownerWriterId = 'hostile-owner';
  hostileLeaseState.minigames.active.ownerLeaseUntil = 1e20;
  assert(inspectOwnership(hostileLeaseState, 1000).mode === 'claimable', 'far-future foreign lease must not block the game indefinitely');

  const leaseRuntime = {
    state: makeProgressionState(),
    persistenceStatus: { tabId: 'new-owner' },
    pendingExclusiveStart: null,
    exclusiveSession: { kind: 'battle' },
    foreignExclusiveSession: null
  };
  leaseRuntime.state.saveRevision = 8;
  leaseRuntime.state.battle.activeBattle = {
    id: 'battle-refresh',
    mode: 'choosingMove',
    ownerWriterId: 'new-owner',
    ownerLeaseUntil: 101000
  };
  let refreshCasCalls = 0;
  const refreshLease = evaluateFunction(bootSource, 'refreshOwnedBattleSessionLease', {
    runtime: leaseRuntime,
    exclusiveOwnershipConfig: ownershipConfig,
    isRuntimeReadOnly: () => false,
    inspectExclusiveSessionOwnership: inspectOwnership,
    deepClone: (value) => JSON.parse(JSON.stringify(value)),
    assignExclusiveSessionOwnership: assignOwnership,
    saveReplacementState: (candidate) => {
      refreshCasCalls += 1;
      candidate.saveRevision = 9;
      return { ok: true, revision: 9, mode: 'storage' };
    },
    acknowledgePersistenceRevision: () => {},
    getPersistenceStatus: () => ({ tabId: 'new-owner', mode: 'storage' })
  });
  refreshLease(1000);
  assert(refreshCasCalls === 1, 'expected battle owner to refresh the lease with replacement CAS');
  assert(leaseRuntime.state.battle.activeBattle.ownerLeaseUntil === 241000, 'expected refreshed battle lease to cover background throttling');
});

test('exclusive ownership metadata survives minigame and battle normalization', () => {
  const now = 1000;
  const state = makeProgressionState();
  state.minigames.active = {
    id: 'dewCatch',
    startedAt: 500,
    until: 5000,
    ownerWriterId: 'owner-a',
    ownerLeaseUntil: 9000
  };
  const normalized = core.normalizeProgressionState(state, {
    minigames: { dewCatch: { label: 'Łapanie rosy', durationMs: 4500 } }
  }, [], now);
  assert(normalized.minigames.active.ownerWriterId === 'owner-a', 'expected normalized minigame owner id');
  assert(normalized.minigames.active.ownerLeaseUntil === 9000, 'expected normalized minigame lease');

  const battle = core.normalizeBattleState({
    activeBattle: {
      id: 'battle-lease',
      startedAt: new Date(now).toISOString(),
      mode: 'choosingMove',
      player: makeCombatant(),
      opponent: makeCombatant(),
      ownerWriterId: 'owner-b',
      ownerLeaseUntil: 12000
    }
  });
  assert(battle.activeBattle.ownerWriterId === 'owner-b', 'expected normalized battle owner id');
  assert(battle.activeBattle.ownerLeaseUntil === 12000, 'expected normalized battle lease');

  state.minigames.active.ownerLeaseUntil = 1e20;
  const hostileMinigame = core.normalizeProgressionState(state, {
    minigames: { dewCatch: { label: 'Łapanie rosy', durationMs: 4500 } }
  }, [], now);
  assert(hostileMinigame.minigames.active.ownerLeaseUntil === 0, 'far-future minigame lease must become immediately claimable');

  const hostileBattle = core.normalizeBattleState({
    activeBattle: {
      id: 'battle-hostile-lease',
      startedAt: new Date(now).toISOString(),
      mode: 'choosingMove',
      player: makeCombatant(),
      opponent: makeCombatant(),
      ownerWriterId: 'hostile-owner',
      ownerLeaseUntil: 1e20
    }
  }, now);
  assert(hostileBattle.activeBattle.ownerLeaseUntil === 0, 'far-future battle lease must become immediately claimable');
});

test('corrupt save recovery banner survives the successful default-state save result', () => {
  const bootSource = readFileSync(path.join(rootDir, 'ClientBoot.html'), 'utf8');
  const statusNode = { textContent: '', hidden: true, dataset: {} };
  const runtime = {
    persistenceStatus: { mode: 'storage', reason: 'corruptRecovered' },
    foreignExclusiveSession: null
  };
  const renderStatus = evaluateFunction(bootSource, 'renderPersistenceStatus', {
    dom: { persistenceStatus: statusNode, resetButton: { disabled: false } },
    runtime,
    isForeignExclusiveSessionActive: () => false,
    isRuntimeMutationBlocked: () => false
  });
  renderStatus({ ok: true, revision: 1, mode: 'storage' });
  assert(!statusNode.hidden && statusNode.textContent.includes('uszkodzony zapis'), 'expected a Polish corrupt-save recovery warning');
  assert(statusNode.dataset.tone === 'danger', 'expected corrupt recovery to remain prominent after the default save succeeds');
});

test('runtime asset aliases share one file cache identity while manual overrides stay isolated', () => {
  const source = readFileSync(path.join(rootDir, 'ClientRuntime.html'), 'utf8');
  const assetsByKey = new Map([
    ['adult.instrument', { key: 'adult.instrument', fileName: 'activities/adult/instrument_sheet.png', hasFileId: false }],
    ['adult.instrument_flute', { key: 'adult.instrument_flute', fileName: 'activities/adult/instrument_sheet.png', hasFileId: false }],
    ['adult.instrument_rare', { key: 'adult.instrument_rare', fileName: 'activities/adult/instrument_sheet.png', hasFileId: true }]
  ]);
  const getIdentity = evaluateFunction(source, 'getRuntimeAssetIdentity', { assetsByKey });
  const getAliases = evaluateFunction(source, 'getRuntimeAssetAliasKeys', {
    assetsByKey,
    getRuntimeAssetIdentity: getIdentity
  });
  const sharedIdentity = getIdentity('adult.instrument');
  assert(sharedIdentity === getIdentity('adult.instrument_flute'), 'expected aliases of one PNG to share the file identity');
  assert(sharedIdentity !== getIdentity('adult.instrument_rare'), 'expected a per-key Drive override to keep its own cache identity');
  assert(getAliases(sharedIdentity).length === 2, 'expected both ordinary aliases to reuse the shared file load');
});

test('interaction clock stays in epoch domain when its runtime origin starts as null', () => {
  const source = readFileSync(path.join(rootDir, 'ClientRuntime.html'), 'utf8');
  const epoch = Date.parse('2026-07-11T12:00:00.000Z');
  let frameNow = 492_652;
  const runtime = { interactionClockOrigin: null };
  const getInteractionNow = evaluateFunction(source, 'getInteractionNow', {
    runtime,
    Date: { now: () => epoch },
    getRenderClockNow: () => frameNow
  });

  const first = getInteractionNow();
  frameNow += 250;
  const second = getInteractionNow();
  assert(first === epoch, `null origin must initialize the interaction clock in epoch time, got ${first}`);
  assert(second === epoch + 250, `interaction time must remain monotonic after initialization, got ${second}`);
  assert(runtime.interactionClockOrigin === epoch - 492_652, 'expected a stable epoch-to-frame clock origin');

  const state = {
    mode: 'awake',
    stats: { hydration: 82, nutrients: 82, happiness: 82, cleanliness: 82, energy: 82, health: 100 },
    patch: { quality: 82 },
    attention: {}
  };
  const rules = {
    attention: { mildThreshold: 45, criticalThreshold: 25 },
    needDefinitions: { hydration: { category: 'physical', actionId: 'hydrate' } }
  };
  const now = second;
  const pointer = core.selectImmersionReaction(state, { condition: 'clear', isDay: true, cloudCover: 20 }, {
    inside: true,
    x: 260,
    y: 268,
    lastMoveAt: now - 80,
    lastDownAt: now - 120,
    consumedDownAt: 0,
    speed: 0.2
  }, now, rules);
  const ambientPointer = core.selectImmersionReaction(state, { condition: 'clear', isDay: true, cloudCover: 20 }, {
    inside: true,
    x: 188,
    y: 210,
    lastMoveAt: now - 80,
    lastDownAt: now - 90,
    consumedDownAt: 0,
    lastDownTargetKind: 'butterfly',
    speed: 0.1
  }, now, rules);
  const rain = core.selectImmersionReaction(state, {
    condition: 'rain',
    isDay: true,
    cloudCover: 92,
    precipitation: 2.4,
    rain: 2.4
  }, { inside: false }, now, rules);
  const sun = core.selectImmersionReaction(state, {
    condition: 'clear',
    isDay: true,
    cloudCover: 18,
    precipitation: 0
  }, { inside: false }, now, rules);
  assert(pointer && pointer.id === 'pointerTap' && pointer.sourceAt > 1e12, 'pointer reaction must use the epoch interaction domain');
  assert(ambientPointer && ambientPointer.source === 'input' && ambientPointer.sourceAt > 1e12, 'ambient pointer reaction must use the epoch interaction domain');
  assert(rain && rain.sourceAt === now, 'weather reaction must be born in the interaction domain');
  assert(sun && sun.sourceAt === now, 'celestial reaction must be born in the interaction domain');
});

test('runtime asset first-load time stays stable while LRU touches and grass fade advance', () => {
  const runtimeSource = readFileSync(path.join(rootDir, 'ClientRuntime.html'), 'utf8');
  const groundSource = readFileSync(path.join(rootDir, 'ClientSceneGround.html'), 'utf8');
  let clock = 100;
  const runtime = {
    assetLoadedAt: {},
    assetFileLoadedAt: {}
  };
  const touchRuntimeAsset = evaluateFunction(runtimeSource, 'touchRuntimeAsset', {
    runtime,
    getRenderClockNow: () => clock,
    getRuntimeAssetIdentity: () => 'file:environment/grass_patch.png'
  });
  const getGrassPatchImageFade = evaluateFunction(groundSource, 'getGrassPatchImageFade', {
    runtime,
    smoothStep(edge0, edge1, value) {
      const t = Math.max(0, Math.min(1, (value - edge0) / Math.max(0.0001, edge1 - edge0)));
      return t * t * (3 - 2 * t);
    }
  });

  touchRuntimeAsset('environment.grassPatch');
  clock = 250;
  touchRuntimeAsset('environment.grassPatch');
  clock = 600;
  touchRuntimeAsset('environment.grassPatch');

  assert(runtime.assetLoadedAt['environment.grassPatch'] === 100, 'render touches must not restart the first-load fade clock');
  assert(runtime.assetFirstLoadedAt['environment.grassPatch'] === 100, 'expected an explicit stable first-load timestamp');
  assert(runtime.assetLastTouchedAt['environment.grassPatch'] === 600, 'expected a separate per-key LRU timestamp');
  assert(runtime.assetFileLastTouchedAt['file:environment/grass_patch.png'] === 600, 'expected a separate shared-file LRU timestamp');
  assert(getGrassPatchImageFade(600) === 1, 'grass PNG must be fully visible and its fallback disabled after 500 ms');
});

test('main scene throttles during minigames and becomes sparse with reduced motion', () => {
  const source = readFileSync(path.join(rootDir, 'ClientRuntime.html'), 'utf8');
  const runtime = { state: { minigames: { active: { id: 'dewCatch' } } }, minigame: {}, reducedMotion: false };
  const getInterval = evaluateFunction(source, 'getRuntimeMainSceneFrameIntervalMs', { runtime });
  const shouldRender = evaluateFunction(source, 'shouldRenderRuntimeFrame', {
    runtime,
    getRuntimeMainSceneFrameIntervalMs: getInterval
  });

  const minigameDraws = Array.from({ length: 63 }, (_value, index) => index * 16)
    .filter((frameNow) => shouldRender(frameNow)).length;
  assert(minigameDraws <= 8, `main scene must stay at or below about 8 FPS during a minigame, got ${minigameDraws}`);

  runtime.lastRenderedFrameAt = null;
  runtime.reducedMotion = true;
  const reducedDraws = Array.from({ length: 63 }, (_value, index) => index * 16)
    .filter((frameNow) => shouldRender(frameNow)).length;
  assert(reducedDraws <= 2, `reduced motion should update the main scene at about 2 FPS, got ${reducedDraws}`);

  runtime.lastRenderedFrameAt = null;
  runtime.reducedMotion = false;
  runtime.minigame = null;
  runtime.state.minigames.active = null;
  assert([0, 16, 32].every((frameNow) => shouldRender(frameNow)), 'ordinary scene rendering must remain requestAnimationFrame-driven');
});

test('runtime asset cache uses decoded bytes and device-aware budgets', () => {
  const source = readFileSync(path.join(rootDir, 'ClientRuntime.html'), 'utf8');
  const MiB = 1024 * 1024;
  const defaultBudget = evaluateFunction(source, 'getRuntimeAssetCacheByteBudget', { runtimeOptions: {} });
  const mobileBudget = evaluateFunction(source, 'getRuntimeAssetCacheByteBudget', {
    runtimeOptions: {},
    window: { matchMedia: () => ({ matches: true }) },
    navigator: { deviceMemory: 8 }
  });
  const lowMemoryBudget = evaluateFunction(source, 'getRuntimeAssetCacheByteBudget', {
    runtimeOptions: {},
    window: { matchMedia: () => ({ matches: false }) },
    navigator: { deviceMemory: 4 }
  });
  const highMemoryBudget = evaluateFunction(source, 'getRuntimeAssetCacheByteBudget', {
    runtimeOptions: {},
    window: { matchMedia: () => ({ matches: false }) },
    navigator: { deviceMemory: 16 }
  });
  assert(defaultBudget() === 96 * MiB, 'default decoded cache budget must be 96 MiB');
  assert(mobileBudget() === 64 * MiB, 'mobile decoded cache budget must be 64 MiB');
  assert(lowMemoryBudget() === 64 * MiB, 'low-memory decoded cache budget must be 64 MiB');
  assert(highMemoryBudget() === 128 * MiB, 'high-memory decoded cache budget must be 128 MiB');

  const assetsByKey = new Map();
  const runtime = {
    assetFiles: {},
    assets: {},
    assetFileLoadedAt: {},
    assetFileLastTouchedAt: {},
    assetLoadedAt: {},
    assetFirstLoadedAt: {},
    assetLastTouchedAt: {},
    effects: [],
    currentAnimationKey: ''
  };
  for (let index = 0; index < 7; index += 1) {
    const key = `sheet.${index}`;
    const identity = `file:sheet-${index}.png`;
    const image = { naturalWidth: 2048, naturalHeight: 2048 };
    assetsByKey.set(key, { key, fileName: `sheet-${index}.png` });
    runtime.assetFiles[identity] = image;
    runtime.assets[key] = image;
    runtime.assetFileLoadedAt[identity] = index + 1;
    runtime.assetFileLastTouchedAt[identity] = index + 1;
  }
  const getIdentity = evaluateFunction(source, 'getRuntimeAssetIdentity', { assetsByKey });
  const getAliases = evaluateFunction(source, 'getRuntimeAssetAliasKeys', {
    assetsByKey,
    getRuntimeAssetIdentity: getIdentity
  });
  const getDecodedBytes = evaluateFunction(source, 'getRuntimeAssetDecodedBytes', {});
  const getCacheBytes = evaluateFunction(source, 'getRuntimeAssetCacheDecodedBytes', {
    runtime,
    getRuntimeAssetDecodedBytes: getDecodedBytes
  });
  const isProtected = evaluateFunction(source, 'isRuntimeAssetProtected', { runtime, assetsByKey });
  const isIdentityProtected = evaluateFunction(source, 'isRuntimeAssetIdentityProtected', {
    getRuntimeAssetAliasKeys: getAliases,
    isRuntimeAssetProtected: isProtected
  });
  const evictIdentity = evaluateFunction(source, 'evictRuntimeAssetIdentity', {
    runtime,
    getRuntimeAssetAliasKeys: getAliases
  });
  const configuredBudget = evaluateFunction(source, 'getRuntimeAssetCacheByteBudget', {
    runtimeOptions: { assetCacheDecodedBytes: 96 * MiB }
  });
  const enforceCache = evaluateFunction(source, 'enforceRuntimeAssetCacheLimit', {
    runtime,
    runtimeOptions: { assetCacheLimit: 32 },
    getRuntimeAssetCacheByteBudget: configuredBudget,
    getRuntimeAssetCacheDecodedBytes: getCacheBytes,
    getRuntimeAssetDecodedBytes: getDecodedBytes,
    isRuntimeAssetIdentityProtected: isIdentityProtected,
    evictRuntimeAssetIdentity: evictIdentity
  });

  enforceCache();
  assert(!runtime.assetFiles['file:sheet-0.png'], 'decoded-byte pressure must evict the least-recently-used sheet first');
  assert(Object.keys(runtime.assetFiles).length === 6, '96 MiB budget should retain six 16 MiB decoded sheets');
  assert(runtime.assetCacheDiagnostics.decodedBytes === 96 * MiB, 'cache diagnostics must report post-eviction decoded bytes');
});

test('action-state render labels read-only and foreign-session mutation blocks without crashing', () => {
  const source = readFileSync(path.join(rootDir, 'ClientUi.html'), 'utf8');
  const cooldownLabel = { textContent: '' };
  let readOnly = true;
  const renderActionStates = evaluateFunction(source, 'renderActionStates', {
    actions: [],
    runtime: { state: makeProgressionState(), actionButtons: new Map() },
    dom: { cooldownLabel },
    getRuntimeNow: () => 1000,
    isGameOverUiState: () => false,
    isRuntimeMutationBlocked: () => true,
    isRuntimeReadOnly: () => readOnly,
    hasNamedMushroom: () => true,
    getExclusiveGameplaySessionForUi: () => null,
    updateMobileActionTrayState: () => {}
  });
  renderActionStates();
  assert(cooldownLabel.textContent === 'Tylko podgląd', 'expected future-save read-only label');
  readOnly = false;
  renderActionStates();
  assert(cooldownLabel.textContent === 'Aktywne w innej karcie', 'expected foreign-session mutation label');
});

test('persistence conflicts are reconciled after the current minigame callback unwinds', () => {
  const source = readFileSync(path.join(rootDir, 'ClientBoot.html'), 'utf8');
  let scheduled = null;
  let resolved = 0;
  const runtime = { persistenceConflictTimer: null };
  const scheduleConflict = evaluateFunction(source, 'schedulePersistenceConflictResolution', {
    runtime,
    window: {
      setTimeout(callback) {
        scheduled = callback;
        return 77;
      }
    },
    resolvePersistenceConflict: () => { resolved += 1; }
  });
  scheduleConflict();
  scheduleConflict();
  assert(resolved === 0, 'conflict handling must not synchronously destroy the active minigame object');
  assert(typeof scheduled === 'function' && runtime.persistenceConflictTimer === 77, 'expected exactly one deferred reconciliation');
  scheduled();
  assert(resolved === 1 && runtime.persistenceConflictTimer === null, 'expected deferred conflict reconciliation to run once');
});

test('active and pending exclusive sessions block every non-session mutation without persistence', () => {
  const actionsSource = readFileSync(path.join(rootDir, 'ClientActions.html'), 'utf8');
  const bootSource = readFileSync(path.join(rootDir, 'ClientBoot.html'), 'utf8');
  const scenarios = [
    { label: 'active battle', battle: { id: 'battle-active', mode: 'active' } },
    { label: 'pending battle', pending: { kind: 'battle', phase: 'turn', id: 'battle-pending' } },
    { label: 'active minigame', minigame: { id: 'dewCatch', startedAt: 100, until: 1000, runtimeToken: 'minigame-active' } },
    { label: 'pending minigame', pending: { kind: 'minigame', phase: 'start', id: 'sporePop', runtimeToken: 'minigame-pending' } }
  ];

  scenarios.forEach((scenario) => {
    const state = makeProgressionState();
    state.battle.activeBattle = scenario.battle || null;
    state.minigames.active = scenario.minigame || null;
    const runtime = { state, pendingExclusiveStart: scenario.pending || null, viewMode: 'care' };
    const before = JSON.stringify(state);
    let persistCalls = 0;
    let messageCalls = 0;
    const getExclusiveGameplaySession = evaluateFunction(actionsSource, 'getExclusiveGameplaySession', { runtime });
    const guardNonSessionMutation = evaluateFunction(actionsSource, 'guardNonSessionMutation', {
      getExclusiveGameplaySession,
      runtime,
      setTransientMessage: () => {
        messageCalls += 1;
        runtime.state.currentActivity = { type: 'notice', label: 'blocked' };
      },
      renderUi: () => {}
    });
    const common = {
      runtime,
      guardNonSessionMutation,
      isRuntimeMutationBlocked: () => false,
      renderPersistenceStatus: () => {},
      persistRuntimeState: () => { persistCalls += 1; }
    };
    const calls = [
      [evaluateFunction(actionsSource, 'handleAction', Object.assign({}, common, {
        actionsById: new Map([['hydrate', { id: 'hydrate', label: 'Zraszanie' }]])
      })), ['hydrate', 'test']],
      [evaluateFunction(actionsSource, 'handleDailyRhythmSelect', common), ['calm']],
      [evaluateFunction(actionsSource, 'handleBattleTrain', common), ['strength']],
      [evaluateFunction(actionsSource, 'handleDecorationBuy', common), ['fern']],
      [evaluateFunction(actionsSource, 'handleHabitatVisitorGreet', common), ['visitor']],
      [evaluateFunction(actionsSource, 'handleSporeExpeditionStart', common), ['nearby']],
      [evaluateFunction(actionsSource, 'handleSporeExpeditionClaim', common), []],
      [evaluateFunction(bootSource, 'performGameReset', common), []]
    ];
    calls.forEach(([handler, args]) => handler(...args));

    assert(JSON.stringify(state) === before, `${scenario.label} must keep state byte-equivalent`);
    assert(persistCalls === 0, `${scenario.label} must perform zero persistence writes`);
    assert(messageCalls === calls.length, `${scenario.label} must explain every blocked operation`);

    const canRunAction = evaluateFunction(actionsSource, 'canRunAction', {
      window: { PieczargotchiCore: {} },
      runtime,
      hasNamedMushroom: () => true,
      guardNonSessionMutation,
      getExclusiveGameplaySession
    });
    const availability = canRunAction({ id: 'hydrate' }, 200);
    assert(!availability.ok, `${scenario.label} must disable care action availability`);
  });

  const terminalRuntime = { state: makeProgressionState(), pendingExclusiveStart: null };
  terminalRuntime.state.battle.activeBattle = { id: 'done', mode: 'victory' };
  const getTerminal = evaluateFunction(actionsSource, 'getExclusiveGameplaySession', { runtime: terminalRuntime });
  assert(getTerminal() === null, 'terminal battle results must not remain exclusive');

  const runtimeMessageState = makeProgressionState();
  runtimeMessageState.battle.activeBattle = { id: 'battle-message', mode: 'active' };
  const runtimeMessage = { state: runtimeMessageState, pendingExclusiveStart: null };
  const runtimeMessageBefore = JSON.stringify(runtimeMessageState);
  const getRuntimeMessageSession = evaluateFunction(actionsSource, 'getExclusiveGameplaySession', { runtime: runtimeMessage });
  let runtimeMessageCalls = 0;
  const runtimeOnlyGuard = evaluateFunction(actionsSource, 'guardNonSessionMutation', {
    runtime: runtimeMessage,
    getExclusiveGameplaySession: getRuntimeMessageSession,
    setNonSessionGuardUiMessage: () => { runtimeMessageCalls += 1; },
    setTransientMessage: () => { throw new Error('save-backed transient fallback must not run'); },
    renderUi: () => {}
  });
  assert(runtimeOnlyGuard('Arena') && runtimeMessageCalls === 1, 'available UI seam must receive the block message');
  assert(JSON.stringify(runtimeMessageState) === runtimeMessageBefore, 'runtime-only guard message must not touch save state');
});

test('modal and exclusive-session guards prevent global care shortcuts', () => {
  const bootSource = readFileSync(path.join(rootDir, 'ClientBoot.html'), 'utf8');
  const guardSource = readFileSync(path.join(rootDir, 'ClientInputGuards.html'), 'utf8');
  const runtime = { ui: { activeModal: 'settings' } };
  const dom = { nameGate: { hidden: true } };
  const modalDocument = { querySelector: () => null };
  const isUiInputModalActive = evaluateFunction(guardSource, 'isUiInputModalActive', { runtime, dom, document: modalDocument });
  assert(isUiInputModalActive(), 'runtime modal must block global input');
  runtime.ui.activeModal = null;
  dom.nameGate.hidden = false;
  assert(isUiInputModalActive(), 'visible name gate must block global input');
  dom.nameGate.hidden = true;

  let keydown = null;
  let actionCalls = 0;
  let exclusive = null;
  let modalOpen = true;
  const bindKeyboardShortcuts = evaluateFunction(bootSource, 'bindKeyboardShortcuts', {
    document: { addEventListener: (_type, handler) => { keydown = handler; } },
    actions: [{ id: 'hydrate', shortcut: 'N' }],
    shouldIgnoreShortcut: () => false,
    isUiInputModalActive: () => modalOpen,
    getExclusiveGameplaySession: () => exclusive,
    handleAction: () => { actionCalls += 1; },
    flashActionButton: () => {}
  });
  bindKeyboardShortcuts();
  const event = () => ({
    key: 'n', target: { tagName: 'BUTTON' }, defaultPrevented: false,
    ctrlKey: false, metaKey: false, altKey: false, isComposing: false, repeat: false,
    preventDefault() {}
  });
  keydown(event());
  modalOpen = false;
  exclusive = { kind: 'battle', phase: 'active', id: 'battle' };
  keydown(event());
  exclusive = null;
  keydown(event());
  assert(actionCalls === 1, 'care shortcut must run only with no modal and no exclusive session');
});

test('exclusive navigation keeps battle and pending minigame in their required workspaces', () => {
  const actionsSource = readFileSync(path.join(rootDir, 'ClientActions.html'), 'utf8');
  const dewSource = readFileSync(path.join(rootDir, 'ClientMinigameDewCatch.html'), 'utf8');
  const uiSource = readFileSync(path.join(rootDir, 'ClientUi.html'), 'utf8');

  const battleRuntime = { state: makeProgressionState(), pendingExclusiveStart: null, viewMode: 'care' };
  battleRuntime.state.battle.activeBattle = { id: 'battle', mode: 'active' };
  const getBattle = evaluateFunction(actionsSource, 'getExclusiveGameplaySession', { runtime: battleRuntime });
  const guardBattle = evaluateFunction(actionsSource, 'guardNonSessionMutation', {
    runtime: battleRuntime,
    getExclusiveGameplaySession: getBattle,
    setTransientMessage: () => {},
    renderUi: () => {}
  });
  const setBattleView = evaluateFunction(actionsSource, 'setViewMode', {
    runtime: battleRuntime,
    getExclusiveGameplaySession: getBattle,
    guardNonSessionMutation: guardBattle,
    isArenaUnlockedForRuntime: () => true,
    isLegendaryMinigameRuntimeId: () => false
  });
  setBattleView('care');
  assert(battleRuntime.viewMode === 'arena', 'active battle must force Arena view');

  const pendingRuntime = {
    state: makeProgressionState(),
    pendingExclusiveStart: { kind: 'minigame', phase: 'start', id: 'sporePop', legendary: false },
    viewMode: 'arena',
    ui: {}
  };
  const getPending = evaluateFunction(actionsSource, 'getExclusiveGameplaySession', { runtime: pendingRuntime });
  const guardPending = evaluateFunction(actionsSource, 'guardNonSessionMutation', {
    runtime: pendingRuntime,
    getExclusiveGameplaySession: getPending,
    setTransientMessage: () => {},
    renderUi: () => {}
  });
  let returnedToMinigame = 0;
  const setPendingView = evaluateFunction(actionsSource, 'setViewMode', {
    runtime: pendingRuntime,
    getExclusiveGameplaySession: getPending,
    guardNonSessionMutation: guardPending,
    isArenaUnlockedForRuntime: () => true,
    isLegendaryMinigameRuntimeId: () => false,
    returnToActiveMinigame: () => { returnedToMinigame += 1; }
  });
  setPendingView('arena');
  assert(pendingRuntime.viewMode === 'care' && returnedToMinigame === 1, 'pending ordinary minigame must force Games view');

  const pendingStateBefore = JSON.stringify(pendingRuntime.state);
  let prevented = 0;
  let stopped = 0;
  let persistCalls = 0;
  let guardRenderCalls = 0;
  const realSetTransientMessage = evaluateFunction(uiSource, 'setTransientMessage', {
    runtime: pendingRuntime,
    getRuntimeNow: () => 500,
    formatMushroomText: (value) => String(value || '')
  });
  const navigationMutationGuard = evaluateFunction(actionsSource, 'guardNonSessionMutation', {
    runtime: pendingRuntime,
    getExclusiveGameplaySession: getPending,
    setTransientMessage: realSetTransientMessage,
    persistRuntimeState: () => { persistCalls += 1; },
    renderUi: () => { guardRenderCalls += 1; }
  });
  const showNavigationGuard = evaluateFunction(dewSource, 'showActiveMinigameNavigationGuard', {
    guardNonSessionMutation: navigationMutationGuard
  });
  const isNavigationAllowed = evaluateFunction(dewSource, 'isMinigameNavigationTargetAllowed', {
    isLegendaryMinigameRuntimeId: () => false
  });
  const navigationContext = {
    getExclusiveGameplaySession: getPending,
    isMinigameNavigationTargetAllowed: isNavigationAllowed,
    showActiveMinigameNavigationGuard: showNavigationGuard,
    returnToActiveMinigame: () => { returnedToMinigame += 1; }
  };
  const guardNavigation = evaluateFunction(dewSource, 'guardActiveMinigameNavigation', navigationContext);
  const guardNavigationKeydown = evaluateFunction(dewSource, 'guardActiveMinigameNavigationKeydown', navigationContext);
  const blockedTarget = { dataset: { workspaceTab: 'care' } };
  const allowedTarget = { dataset: { workspaceTab: 'games' } };
  const navigationEvent = (target, key) => ({
    key,
    target: { closest: () => target },
    preventDefault: () => { prevented += 1; },
    stopImmediatePropagation: () => { stopped += 1; }
  });
  guardNavigation(navigationEvent(allowedTarget));
  guardNavigationKeydown(navigationEvent(allowedTarget, 'ArrowRight'));
  assert(prevented === 0 && stopped === 0, 'current minigame tab must remain available to click and keyboard navigation');

  guardNavigation(navigationEvent(blockedTarget));
  guardNavigationKeydown(navigationEvent(blockedTarget, 'ArrowRight'));
  assert(prevented === 2 && stopped === 2, 'pending minigame must block unrelated click and keyboard navigation');
  assert(guardRenderCalls === 2 && returnedToMinigame === 3, 'each blocked navigation must explain and return to the minigame');
  assert(JSON.stringify(pendingRuntime.state) === pendingStateBefore, 'pending navigation guard must leave CAS source state byte-equivalent');
  assert(persistCalls === 0, 'pending navigation guard must perform zero persistence writes');
});

test('minigame keyboard handlers require the focused canvas and ignore form controls and dialogs', () => {
  const sources = {
    dew: readFileSync(path.join(rootDir, 'ClientMinigameDewCatch.html'), 'utf8'),
    spore: readFileSync(path.join(rootDir, 'ClientMinigameSporePop.html'), 'utf8'),
    compost: readFileSync(path.join(rootDir, 'ClientMinigameCompostSort.html'), 'utf8'),
    rhythm: readFileSync(path.join(rootDir, 'ClientMinigameRhythmHum.html'), 'utf8'),
    legendary: readFileSync(path.join(rootDir, 'ClientLegendaryGames.html'), 'utf8')
  };
  let modalOpen = false;
  const input = { tagName: 'INPUT' };
  const makeEvent = (key, target) => ({
    key, target, ctrlKey: false, metaKey: false, altKey: false, isComposing: false, repeat: false,
    preventDefault() {}
  });
  const shouldHandleMinigameKeydown = (event, canvas) => !modalOpen && event.target === canvas;
  const common = {
    getRuntimeNow: () => 150,
    shouldHandleMinigameKeydown,
    isCurrentMinigameInputAllowed: () => true
  };

  const dewCanvas = { width: 240 };
  const dewRuntime = { minigame: { session: { id: 'dewCatch' }, bucket: { x: 10, targetX: 10, width: 40 } } };
  const dew = evaluateFunction(sources.dew, 'handleDewCatchKeydown', Object.assign({}, common, {
    runtime: dewRuntime,
    dom: { dewCatchCanvas: dewCanvas },
    clampDewBucketX: (value) => value
  }));
  dew(makeEvent('ArrowRight', input));
  modalOpen = true;
  dew(makeEvent('ArrowRight', dewCanvas));
  modalOpen = false;
  dew(makeEvent('ArrowRight', dewCanvas));
  assert(dewRuntime.minigame.bucket.targetX === 36, 'dew input must run exactly once on its focused canvas');

  const sporeCanvas = {};
  const sporeRuntime = { minigame: { session: { id: 'sporePop' }, keyboardTargetIndex: 0 } };
  let sporeScores = 0;
  const spore = evaluateFunction(sources.spore, 'handleSporePopKeydown', Object.assign({}, common, {
    runtime: sporeRuntime,
    dom: { sporePopCanvas: sporeCanvas },
    getVisibleSporePopTargets: () => [{ spore: { id: 'spore' }, position: { x: 1, y: 2 } }],
    positiveModulo: (value) => value,
    scoreSporePopTarget: () => { sporeScores += 1; }
  }));
  spore(makeEvent('Enter', input));
  modalOpen = true;
  spore(makeEvent('Enter', sporeCanvas));
  modalOpen = false;
  spore(makeEvent('Enter', sporeCanvas));
  assert(sporeScores === 1, 'spore input must ignore forms and dialogs');

  const compostCanvas = {};
  const compostRuntime = { minigame: { session: { id: 'compostSort' }, keyboardPieceIndex: 0 } };
  let compostScores = 0;
  const compost = evaluateFunction(sources.compost, 'handleCompostSortKeydown', Object.assign({}, common, {
    runtime: compostRuntime,
    dom: { compostSortCanvas: compostCanvas },
    getVisibleKeyboardCompostPieces: () => [{ piece: { id: 'leaf' }, position: { x: 1, y: 2 } }],
    positiveModulo: (value) => value,
    finishCompostSortDrag: () => { compostScores += 1; }
  }));
  compost(makeEvent('c', input));
  modalOpen = true;
  compost(makeEvent('c', compostCanvas));
  modalOpen = false;
  compost(makeEvent('c', compostCanvas));
  assert(compostScores === 1, 'compost input must ignore forms and dialogs');

  const rhythmCanvas = {};
  const rhythmRuntime = { minigame: { session: { id: 'rhythmHum' } } };
  let rhythmScores = 0;
  const rhythm = evaluateFunction(sources.rhythm, 'handleRhythmHumKeydown', Object.assign({}, common, {
    runtime: rhythmRuntime,
    dom: { rhythmHumCanvas: rhythmCanvas },
    RHYTHM_HUM_KEY_TO_LANE: { ArrowLeft: 'left' },
    scoreRhythmHumLane: () => { rhythmScores += 1; }
  }));
  rhythm(makeEvent('ArrowLeft', input));
  modalOpen = true;
  rhythm(makeEvent('ArrowLeft', rhythmCanvas));
  modalOpen = false;
  rhythm(makeEvent('ArrowLeft', rhythmCanvas));
  assert(rhythmScores === 1, 'rhythm input must ignore forms and dialogs');

  const legendaryCanvas = {};
  const legendaryRuntime = { minigame: { session: { id: 'memoryGarden' } } };
  let legendaryScores = 0;
  const legendary = evaluateFunction(sources.legendary, 'handleLegendaryGameKeydown', Object.assign({}, common, {
    runtime: legendaryRuntime,
    dom: { legendaryGameCanvas: legendaryCanvas },
    isLegendaryMinigameRuntimeId: () => true,
    getNextLegendaryTarget: () => ({ id: 'memory' }),
    scoreLegendaryGameTarget: () => { legendaryScores += 1; },
    registerLegendaryGameMiss: () => {},
    positiveModulo: (value) => value
  }));
  legendary(makeEvent('Enter', input));
  modalOpen = true;
  legendary(makeEvent('Enter', legendaryCanvas));
  modalOpen = false;
  legendary(makeEvent('Enter', legendaryCanvas));
  assert(legendaryScores === 1, 'legendary input must ignore forms and dialogs');
});

test('minigame input expires at the exact deadline while pointer cancel only clears local drag', () => {
  const guardSource = readFileSync(path.join(rootDir, 'ClientInputGuards.html'), 'utf8');
  const dewSource = readFileSync(path.join(rootDir, 'ClientMinigameDewCatch.html'), 'utf8');
  const sporeSource = readFileSync(path.join(rootDir, 'ClientMinigameSporePop.html'), 'utf8');
  const compostSource = readFileSync(path.join(rootDir, 'ClientMinigameCompostSort.html'), 'utf8');
  const session = { id: 'sporePop', startedAt: 100, until: 200, runtimeToken: 'token' };
  const runtime = {
    state: { minigames: { active: Object.assign({}, session) } },
    minigame: { session: Object.assign({}, session), score: 0 },
    exclusiveSession: { kind: 'minigame', id: 'sporePop', token: 'token' },
    ui: { activeModal: null }
  };
  const modalDom = { nameGate: { hidden: true } };
  const modalDocument = { querySelector: () => null };
  const isUiInputModalActive = evaluateFunction(guardSource, 'isUiInputModalActive', {
    runtime,
    dom: modalDom,
    document: modalDocument
  });
  const getMinigameLaunchPhase = evaluateFunction(dewSource, 'getMinigameLaunchPhase', {});
  const isCurrentMinigameInputAllowed = evaluateFunction(guardSource, 'isCurrentMinigameInputAllowed', {
    runtime,
    getRuntimeNow: () => 200,
    getMinigameLaunchPhase,
    isUiInputModalActive,
    isForeignExclusiveSessionActive: () => false,
    doesRuntimeMinigameSessionMatch: (left, right) => Boolean(right
      && left.id === right.id
      && left.startedAt === right.startedAt
      && left.runtimeToken === right.runtimeToken)
  });
  assert(isCurrentMinigameInputAllowed(runtime.minigame.session, 199), 'owned running session input must remain available before deadline');
  assert(!isCurrentMinigameInputAllowed(runtime.minigame.session, 200), 'input must expire at now === until');
  runtime.exclusiveSession.token = 'stale-token';
  assert(!isCurrentMinigameInputAllowed(runtime.minigame.session, 199), 'stale runtime token must reject input');
  runtime.exclusiveSession.token = 'token';

  const canvas = {};
  let modalOpen = false;
  const document = { activeElement: canvas };
  const shouldHandleMinigameKeydown = evaluateFunction(guardSource, 'shouldHandleMinigameKeydown', {
    document,
    getRuntimeNow: () => 199,
    isCurrentMinigameInputAllowed,
    isUiInputModalActive: () => modalOpen
  });
  assert(!shouldHandleMinigameKeydown({ target: { tagName: 'INPUT' } }, canvas, runtime.minigame.session), 'form target must reject minigame keyboard input');
  modalOpen = true;
  assert(!shouldHandleMinigameKeydown({ target: canvas }, canvas, runtime.minigame.session), 'open dialog must reject minigame keyboard input');
  modalOpen = false;
  assert(shouldHandleMinigameKeydown({ target: canvas }, canvas, runtime.minigame.session), 'focused canvas must accept owned running input');

  let prevented = false;
  const pointer = evaluateFunction(sporeSource, 'handleSporePopPointer', {
    runtime,
    dom: { sporePopCanvas: {} },
    getRuntimeNow: () => 200,
    isCurrentMinigameInputAllowed
  });
  const before = JSON.stringify(runtime.minigame.session);
  pointer({ preventDefault: () => { prevented = true; } });
  assert(JSON.stringify(runtime.minigame.session) === before && !prevented, 'deadline pointer must not score or consume input');

  const compostSession = { id: 'compostSort', score: 7 };
  const compostRuntime = { minigame: { session: compostSession, dragging: { id: 'leaf' } } };
  const cancel = evaluateFunction(compostSource, 'handleCompostSortPointer', {
    runtime: compostRuntime,
    dom: { compostSortCanvas: {} }
  });
  cancel({ type: 'pointercancel' });
  assert(compostRuntime.minigame.dragging === null && compostSession.score === 7, 'pointercancel must clear drag without changing score');
});

test('modal and name gate block minigame pointers while captured compost drag still cleans up', () => {
  const guardSource = readFileSync(path.join(rootDir, 'ClientInputGuards.html'), 'utf8');
  const actionsSource = readFileSync(path.join(rootDir, 'ClientActions.html'), 'utf8');
  const dewSource = readFileSync(path.join(rootDir, 'ClientMinigameDewCatch.html'), 'utf8');
  const compostSource = readFileSync(path.join(rootDir, 'ClientMinigameCompostSort.html'), 'utf8');
  const dewSession = { id: 'dewCatch', startedAt: 100, until: 300, runtimeToken: 'dew-token', score: 4 };
  const runtime = {
    state: { minigames: { active: Object.assign({}, dewSession) } },
    minigame: {
      session: Object.assign({}, dewSession),
      bucket: { x: 40, targetX: 40, width: 20 }
    },
    exclusiveSession: { kind: 'minigame', id: 'dewCatch', token: 'dew-token' },
    ui: { activeModal: 'settings' }
  };
  const dom = {
    nameGate: { hidden: true },
    dewCatchCanvas: {
      width: 240,
      getBoundingClientRect: () => ({ left: 0, width: 240 })
    }
  };
  const document = { querySelector: () => null };
  const isUiInputModalActive = evaluateFunction(guardSource, 'isUiInputModalActive', { runtime, dom, document });
  const getMinigameLaunchPhase = evaluateFunction(dewSource, 'getMinigameLaunchPhase', {});
  const doesRuntimeMinigameSessionMatch = evaluateFunction(actionsSource, 'doesRuntimeMinigameSessionMatch', {});
  const isCurrentMinigameInputAllowed = evaluateFunction(guardSource, 'isCurrentMinigameInputAllowed', {
    runtime,
    getRuntimeNow: () => 150,
    getMinigameLaunchPhase,
    isUiInputModalActive,
    isForeignExclusiveSessionActive: () => false,
    doesRuntimeMinigameSessionMatch
  });
  let prevented = 0;
  let focused = 0;
  const dewPointer = evaluateFunction(dewSource, 'handleDewCatchPointer', {
    runtime,
    dom,
    getRuntimeNow: () => 150,
    isCurrentMinigameInputAllowed,
    focusMinigameCanvas: () => { focused += 1; },
    clampDewBucketX: (value) => value
  });
  const pointerEvent = {
    type: 'pointermove',
    clientX: 180,
    preventDefault: () => { prevented += 1; }
  };
  dewPointer(pointerEvent);
  assert(runtime.minigame.bucket.targetX === 40 && runtime.minigame.session.score === 4, 'dialog must block dew pointer movement and scoring');

  runtime.ui.activeModal = null;
  dom.nameGate.hidden = false;
  dewPointer(pointerEvent);
  assert(runtime.minigame.bucket.targetX === 40 && focused === 0 && prevented === 0, 'name gate must also block dew pointer input');

  const compostSession = { id: 'compostSort', startedAt: 100, until: 300, runtimeToken: 'compost-token', score: 9 };
  runtime.state.minigames.active = Object.assign({}, compostSession);
  runtime.minigame = {
    session: Object.assign({}, compostSession),
    dragging: { id: 'leaf', x: 10, y: 10 }
  };
  runtime.exclusiveSession = { kind: 'minigame', id: 'compostSort', token: 'compost-token' };
  runtime.ui.activeModal = 'settings';
  dom.nameGate.hidden = true;
  dom.compostSortCanvas = {};
  const compostPointer = evaluateFunction(compostSource, 'handleCompostSortPointer', {
    runtime,
    dom,
    getRuntimeNow: () => 150,
    isCurrentMinigameInputAllowed
  });
  compostPointer({
    type: 'pointerup',
    preventDefault: () => { prevented += 1; }
  });
  assert(runtime.minigame.dragging === null, 'captured pointerup behind a modal must clear local compost drag');
  assert(runtime.minigame.session.score === 9 && prevented === 0, 'modal pointerup must not score or consume gameplay input');
});

test('battle moves remain valid session-local mutations', () => {
  const source = readFileSync(path.join(rootDir, 'ClientActions.html'), 'utf8');
  const state = makeProgressionState();
  state.battle.activeBattle = { id: 'battle', mode: 'active', runtimeToken: 'battle-token', turn: 0 };
  const runtime = { state, pendingExclusiveStart: null, exclusiveSession: { kind: 'battle', id: 'battle' } };
  let resolveCalls = 0;
  const handleBattleMove = evaluateFunction(source, 'handleBattleMove', {
    runtime,
    window: { PieczargotchiCore: {
      resolveBattleRound: (active) => {
        resolveCalls += 1;
        return Object.assign({}, active, { turn: 1, mode: 'active' });
      }
    } },
    rules: { battle: { moveCatalog: [] } },
    isRuntimeMutationBlocked: () => false,
    isMinigameActive: () => false,
    ensureMushroomNamed: () => true,
    getRuntimeNow: () => 150,
    isGameOverForRuntime: () => false,
    isRecoveryActiveForRuntime: () => false,
    deepClone: (value) => JSON.parse(JSON.stringify(value)),
    addBattleLogEntry: () => {},
    formatBattleEvents: () => '',
    assignExclusiveSessionOwnership: () => {},
    getExclusiveOwnershipNow: () => 150,
    persistExclusiveStartCandidate: (candidate, _base, _pending, callback) => callback({ ok: true }, candidate),
    renderUi: () => {}
  });
  handleBattleMove('strike');
  assert(resolveCalls === 1 && runtime.state.battle.activeBattle.turn === 1, 'battle move must survive non-session guards');
});

test('client bundle has no duplicate top-level named helper declarations', () => {
  const client = renderTemplate('Client.html');
  const names = [...client.matchAll(/^  function ([A-Za-z0-9_]+)\s*\(/gm)].map((match) => match[1]);
  const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
  assert(duplicates.length === 0, `duplicate client helpers: ${[...new Set(duplicates)].join(', ')}`);
});

function makeProgressionState() {
  return {
    version: 17,
    playerId: 'runtime-regression',
    mushroomName: 'Testka',
    mode: 'awake',
    stage: 'adult',
    stats: { hydration: 80, nutrients: 80, energy: 80, happiness: 80, cleanliness: 80, health: 90, growth: 70 },
    inventory: { water: 0, compost: 0, toys: 0, substrate: 0, spores: 0 },
    patch: { quality: 70, mycelium: 0, harvests: 0, careStreak: 0 },
    history: {},
    minigames: { active: null, lastResult: null },
    battle: { activeBattle: null },
    dailyRhythm: {},
    dailyPlan: {},
    relationship: {},
    journal: {},
    discoveries: {},
    decorations: {},
    returnRecap: {},
    longLoop: {},
    legendaryGames: {},
    recovery: {},
    gameOver: {},
    cooldowns: {},
    flags: {}
  };
}

function makeCombatant(overrides = {}) {
  return Object.assign({
    name: 'Grzyb',
    hp: 80,
    maxHp: 80,
    stamina: 50,
    maxStamina: 50,
    strength: 10,
    attack: 12,
    defense: 10,
    speed: 10,
    focus: 10,
    guard: 0,
    statusEffects: {},
    strategy: 'balanced',
    weights: {}
  }, overrides);
}

function renderTemplate(fileName) {
  const content = readFileSync(path.join(rootDir, fileName), 'utf8');
  return content.replace(/<\?!=\s*include\('([^']+)'\);\s*\?>/g, (_match, partialName) => {
    return renderTemplate(partialName + '.html');
  });
}

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

function deepMerge(base, override) {
  const result = JSON.parse(JSON.stringify(base));
  Object.keys(override || {}).forEach((key) => {
    const value = override[key];
    if (value && typeof value === 'object' && !Array.isArray(value) && result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) {
      result[key] = deepMerge(result[key], value);
    } else {
      result[key] = JSON.parse(JSON.stringify(value));
    }
  });
  return result;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
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
