import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const tests = [];

test('standard generators keep every target inside its active session', () => {
  const context = createContext();
  const session = {
    seed: 123456,
    startedAt: 1000,
    until: 19000,
    habitatTags: { moisture: 2, shelter: 1, music: 3 }
  };
  const dew = context.buildDewCatchDrops(session);
  const spores = context.buildSporePopSpores(session);
  const compost = context.buildCompostSortPieces(session);
  const chart = context.buildRhythmHumChart(session);

  assert(dew.every((drop) => drop.start >= 0 && drop.start + drop.speed <= 0.941), 'every dew drop must finish before the deadline');
  assert(spores.every((spore) => spore.start >= 0 && spore.start + spore.speed <= 0.941), 'every spore must expire before the deadline');
  assert(compost.every((piece) => piece.start >= 0 && piece.start + piece.speed * 1.08 <= 0.921), 'every compost piece must expire before the deadline');
  assert(Math.max(...spores.map((spore) => spore.start)) - Math.min(...spores.map((spore) => spore.start)) > 0.65, 'spore spawns must cover the active window');
  assert(chart.every((note) => note.hitAt + 360 + 45 <= session.until - 250), 'every rhythm judgment window must settle before the deadline');
});

test('standard runtime sessions expose the exact generated decision and score ceilings', () => {
  const context = createContext();
  const noop = () => {};
  const canvas = {
    width: 240,
    height: 144,
    getContext: () => ({ imageSmoothingEnabled: false }),
    setAttribute: noop,
    focus: noop
  };
  Object.assign(context.dom, {
    dewCatchCanvas: canvas,
    sporePopCanvas: canvas,
    compostSortCanvas: canvas,
    rhythmHumCanvas: canvas
  });
  Object.assign(context.window, {
    addEventListener: noop,
    removeEventListener: noop,
    requestAnimationFrame: () => 1
  });
  context.stopMinigameRuntime = noop;
  context.setActiveMinigameCanvas = noop;
  context.focusMinigameCanvas = noop;
  context.renderDewCatchFrame = noop;
  context.renderSporePopFrame = noop;
  context.renderCompostSortFrame = noop;
  context.renderRhythmHumFrame = noop;

  const base = {
    seed: 884422,
    startedAt: 1000,
    until: 19000,
    habitatTags: { moisture: 2, shelter: 3, music: 3 },
    score: 0,
    caught: [],
    missed: [],
    expired: [],
    expiredNotes: [],
    mistakes: 0,
    combo: 0,
    bestCombo: 0
  };
  const cases = [
    ['dewCatch', 'startDewCatchRuntime', 'buildDewCatchDrops', (item) => item.kind === 'leaf' ? 0 : Number(item.points) || 1],
    ['sporePop', 'startSporePopRuntime', 'buildSporePopSpores', (item) => Number(item.points) || 1],
    ['compostSort', 'startCompostSortRuntime', 'buildCompostSortPieces', (item) => item.good ? Number(item.points) || 1 : 1],
    ['rhythmHum', 'startRhythmHumRuntime', 'buildRhythmHumChart', () => 3]
  ];

  cases.forEach(([id, startName, buildName, points]) => {
    const session = { ...base, id };
    const decisions = context[buildName](session);
    context.runtime.state.minigames.active = session;
    context[startName](session);
    const active = context.runtime.minigame.session;
    const expectedCeiling = decisions.reduce((total, item) => total + points(item), 0);
    assert(active.decisionCount === decisions.length, `${id} should expose ${decisions.length} generated decisions`);
    assert(active.seedCeiling === expectedCeiling, `${id} should expose exact seed ceiling ${expectedCeiling}, got ${active.seedCeiling}`);
  });
});

test('spore and compost targets resolve exactly once', () => {
  const context = createContext();
  context.scheduleMinigameRuntimePersist = () => {};
  context.updateMinigameHud = () => {};
  context.pushMinigameFloater = () => {};
  context.triggerEffect = () => {};

  const sporeSession = makeSession('sporePop');
  const spores = [
    { id: 'spore-a', kind: 'spore', points: 1 },
    { id: 'spore-b', kind: 'spore', points: 1 },
    { id: 'spore-c', kind: 'spore', points: 1 }
  ];
  context.runtime.state = { minigames: { active: sporeSession } };
  context.runtime.minigame = { session: sporeSession, spores, bursts: [], floaters: [], animationFrame: 0 };
  context.expireSporePopTarget(spores[0], 100);
  context.expireSporePopTarget(spores[0], 101);
  context.scoreSporePopTarget(spores[1], 10, 10, 102);
  context.scoreSporePopTarget(spores[1], 10, 10, 103);
  assert(sporeSession.resolvedCount === 2, `expected two resolved spores, got ${sporeSession.resolvedCount}`);
  assert(sporeSession.correctCount === 1 && sporeSession.expiredCount === 1 && sporeSession.mistakes === 1, 'spore counters must classify hit and expiry once');

  const compostSession = makeSession('compostSort');
  const pieces = [
    { id: 'good', good: true, kind: 'crumb', points: 1 },
    { id: 'bad', good: false, kind: 'stone', points: 0 },
    { id: 'late', good: true, kind: 'leaf', points: 1 }
  ];
  context.runtime.state = { minigames: { active: compostSession } };
  context.runtime.minigame = { session: compostSession, pieces, dragging: null, pulses: [], floaters: [], animationFrame: 0 };
  context.finishCompostSortDrag(pieces[0], 'compost', 10, 10, 200);
  context.finishCompostSortDrag(pieces[0], 'compost', 10, 10, 201);
  context.finishCompostSortDrag(pieces[1], 'compost', 10, 10, 202);
  context.expireCompostSortPiece(pieces[2], 203);
  context.expireCompostSortPiece(pieces[2], 204);
  assert(compostSession.resolvedCount === 3, `expected three resolved compost pieces, got ${compostSession.resolvedCount}`);
  assert(compostSession.correctCount === 1 && compostSession.expiredCount === 1 && compostSession.mistakes === 2, 'compost counters must classify correct, wrong, and expired once');
  assert(compostSession.inputCount === 2, `duplicate classification must not add input, got ${compostSession.inputCount}`);
});

test('blank pointer and keyboard actions share the same mistake contract', () => {
  const context = createContext();
  const canvas = {
    width: 240,
    height: 144,
    focus() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 240, height: 144 })
  };
  context.getRuntimeNow = () => 5000;
  context.isCurrentMinigameInputAllowed = () => true;
  context.shouldHandleMinigameKeydown = () => true;
  context.updateMinigameHud = () => {};
  context.scheduleMinigameRuntimePersist = () => {};
  context.pushMinigameFloater = () => {};

  const sporeSession = Object.assign(makeSession('sporePop'), { startedAt: 1000, until: 19000 });
  context.dom.sporePopCanvas = canvas;
  context.runtime.state = { minigames: { active: sporeSession } };
  context.runtime.minigame = { session: sporeSession, spores: [], bursts: [], floaters: [], keyboardTargetIndex: 0 };
  context.handleSporePopPointer({
    clientX: 120,
    clientY: 72,
    preventDefault() {}
  });
  context.handleSporePopKeydown({
    key: 'Enter',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    isComposing: false,
    repeat: false,
    preventDefault() {}
  });
  assert(sporeSession.inputCount === 2 && sporeSession.mistakes === 2,
    `spore blank actions should match, got inputs=${sporeSession.inputCount} mistakes=${sporeSession.mistakes}`);

  const compostSession = Object.assign(makeSession('compostSort'), { startedAt: 1000, until: 23000 });
  context.dom.compostSortCanvas = canvas;
  context.runtime.state = { minigames: { active: compostSession } };
  context.runtime.minigame = { session: compostSession, pieces: [], dragging: null, pulses: [], floaters: [], keyboardPieceIndex: 0 };
  context.handleCompostSortPointer({
    type: 'pointerdown',
    clientX: 120,
    clientY: 72,
    preventDefault() {},
    currentTarget: {}
  });
  context.handleCompostSortKeydown({
    key: 'c',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    isComposing: false,
    repeat: false,
    preventDefault() {}
  });
  assert(compostSession.inputCount === 2 && compostSession.mistakes === 2,
    `compost blank actions should match, got inputs=${compostSession.inputCount} mistakes=${compostSession.mistakes}`);
});

test('spatial keyboard navigation preserves target identity without counting a play action', () => {
  const spatialContext = createContext();
  const canvas = { width: 240, height: 144 };
  spatialContext.dom.sporePopCanvas = canvas;
  spatialContext.dom.compostSortCanvas = canvas;
  const spatialSession = Object.assign(makeSession('sporePop'), { startedAt: 1000, until: 19000 });
  spatialContext.runtime.minigame = {
    session: spatialSession,
    spores: [
      { id: 'right', x: 200, y: 40, driftX: 0, driftY: 0, start: 0, speed: 1, phase: 0 },
      { id: 'left', x: 20, y: 40, driftX: 0, driftY: 0, start: 0, speed: 1, phase: 0 }
    ]
  };
  assert(spatialContext.getVisibleSporePopTargets(1000).map((item) => item.spore.id).join(',') === 'left,right', 'spore keyboard targets should follow screen x order');

  const compostSpatialSession = Object.assign(makeSession('compostSort'), { startedAt: 1000, until: 19000 });
  spatialContext.runtime.minigame = {
    session: compostSpatialSession,
    pieces: [
      { id: 'right', x: 200, lane: 0, start: 0, speed: 1, variant: 0 },
      { id: 'left', x: 20, lane: 0, start: 0, speed: 1, variant: 0 }
    ]
  };
  assert(spatialContext.getVisibleKeyboardCompostPieces(1000).map((item) => item.piece.id).join(',') === 'left,right', 'compost keyboard targets should follow screen x order');

  const context = createContext();
  context.dom.sporePopCanvas = canvas;
  context.dom.compostSortCanvas = canvas;
  context.getRuntimeNow = () => 5000;
  context.isCurrentMinigameInputAllowed = () => true;
  context.shouldHandleMinigameKeydown = () => true;
  context.positiveModulo = (value, size) => (value % size + size) % size;
  context.updateMinigameHud = () => {};
  context.scheduleMinigameRuntimePersist = () => {};

  const makeKeyEvent = (key) => ({
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    isComposing: false,
    repeat: false,
    preventDefault() {}
  });
  const sporeSession = Object.assign(makeSession('sporePop'), { startedAt: 1000, until: 19000 });
  const spores = ['a', 'b', 'c'].map((id, index) => ({ id, kind: 'spore', points: 1, x: index * 20 }));
  context.runtime.state = { minigames: { active: sporeSession } };
  context.runtime.minigame = {
    session: sporeSession,
    spores,
    bursts: [],
    floaters: [],
    keyboardTargetId: 'b',
    keyboardTargetIndex: 0
  };
  context.getVisibleSporePopTargets = () => spores.map((spore, index) => ({ spore, position: { x: index * 20, y: 20 } }));
  context.handleSporePopKeydown(makeKeyEvent('ArrowRight'));
  assert(context.runtime.minigame.keyboardTargetId === 'c' && sporeSession.inputCount === 0, 'spore arrows should move from the selected id without engagement');
  context.handleSporePopKeydown(makeKeyEvent('Enter'));
  assert(sporeSession.inputCount === 1 && sporeSession.caught[0] === 'c', 'spore activation should count exactly one intentional action');

  const compostSession = Object.assign(makeSession('compostSort'), { startedAt: 1000, until: 23000 });
  const pieces = ['a', 'b', 'c'].map((id, index) => ({ id, good: true, kind: 'leaf', points: 1, size: 8, x: index * 20 }));
  context.runtime.state = { minigames: { active: compostSession } };
  context.runtime.minigame = {
    session: compostSession,
    pieces,
    dragging: null,
    pulses: [],
    floaters: [],
    keyboardPieceId: 'b',
    keyboardPieceIndex: 2
  };
  context.getVisibleKeyboardCompostPieces = () => pieces.map((piece, index) => ({ piece, position: { x: index * 20, y: 20 } }));
  context.handleCompostSortKeydown(makeKeyEvent('ArrowLeft'));
  assert(context.runtime.minigame.keyboardPieceId === 'a' && compostSession.inputCount === 0, 'compost arrows should move from the selected id without engagement');
  context.handleCompostSortKeydown(makeKeyEvent('c'));
  assert(compostSession.inputCount === 1 && compostSession.caught[0] === 'a', 'compost classification should count exactly one intentional action');
});

test('wall-clock timeout settles every remaining standard decision before finish', () => {
  const context = createContext();
  const canvas = { width: 240, height: 144 };
  Object.assign(context.dom, {
    sporePopCanvas: canvas,
    compostSortCanvas: canvas,
    rhythmHumCanvas: canvas
  });
  context.getRuntimeNow = () => 20000;
  context.updateMinigameHud = () => {};
  context.scheduleMinigameRuntimePersist = () => {};
  const finishes = [];
  context.handleMinigameEnd = (reason) => {
    const session = context.runtime.minigame.session;
    finishes.push({ reason, id: session.id, resolved: session.resolvedCount, expired: session.expiredCount });
  };

  const sporeSession = Object.assign(makeSession('sporePop'), { startedAt: 1000, until: 19000, decisionCount: 3 });
  context.runtime.state = { minigames: { active: sporeSession } };
  context.runtime.minigame = {
    session: sporeSession,
    spores: ['a', 'b', 'c'].map((id) => ({ id, kind: 'spore' })),
    bursts: [],
    floaters: []
  };
  context.renderSporePopFrame();

  const compostSession = Object.assign(makeSession('compostSort'), { startedAt: 1000, until: 19000, decisionCount: 3 });
  context.runtime.state = { minigames: { active: compostSession } };
  context.runtime.minigame = {
    session: compostSession,
    pieces: ['a', 'b', 'c'].map((id) => ({ id, kind: 'leaf' })),
    dragging: { id: 'c' },
    pulses: [],
    floaters: []
  };
  context.renderCompostSortFrame();

  const rhythmSession = Object.assign(makeSession('rhythmHum'), {
    startedAt: 1000,
    until: 19000,
    decisionCount: 3,
    rhythmJudgments: [null, null, null],
    expiredNotes: []
  });
  context.runtime.state = { minigames: { active: rhythmSession } };
  context.runtime.minigame = {
    session: rhythmSession,
    chart: ['left', 'down', 'right'].map((lane, index) => ({ id: 'note-' + index, lane, hitAt: 2000 + index * 1000 })),
    pattern: ['left', 'down', 'right'],
    pulses: [],
    floaters: [],
    animationFrame: 0
  };
  context.renderRhythmHumFrame();

  assert(finishes.length === 3 && finishes.every((finish) => finish.reason === 'timeout'), 'each overdue frame should finish through timeout');
  assert(finishes.every((finish) => finish.resolved === 3 && finish.expired === 3), `timeouts should carry complete expiry metrics: ${JSON.stringify(finishes)}`);
});

test('dew targets resolve exactly once across catches and expiries', () => {
  const context = createContext();
  context.scheduleMinigameRuntimePersist = () => {};
  context.updateMinigameHud = () => {};
  context.pushMinigameFloater = () => {};
  context.triggerEffect = () => {};
  context.dom.dewCatchCanvas = { width: 240, height: 144 };

  const session = makeSession('dewCatch');
  session.missed = [];
  const drops = [
    { id: 'dew-hit', kind: 'dew', points: 1 },
    { id: 'leaf-hit', kind: 'leaf', points: 0 },
    { id: 'dew-late', kind: 'heavy', points: 2 },
    { id: 'leaf-pass', kind: 'leaf', points: 0 }
  ];
  context.runtime.state = { minigames: { active: session } };
  context.runtime.minigame = {
    session,
    drops,
    bucket: { x: 120, targetX: 120, width: 40, height: 24, catchPulseUntil: 0 },
    splashes: [],
    floaters: [],
    animationFrame: 0
  };
  context.catchDewDrop(drops[0], { x: 100, y: 100 }, 100);
  context.catchDewDrop(drops[0], { x: 100, y: 100 }, 101);
  context.catchDewDrop(drops[1], { x: 110, y: 100 }, 102);
  context.markDewDropMissed(drops[2], 103);
  context.markDewDropMissed(drops[2], 104);
  context.markDewDropMissed(drops[3], 105);
  assert(session.resolvedCount === 4, `expected four resolved dew targets, got ${session.resolvedCount}`);
  assert(session.correctCount === 2 && session.expiredCount === 1 && session.mistakes === 2, 'dew counters must classify positive catches, hazards, and expiries once');
});

test('rhythm notes resolve once and completion requests the shared finish path', () => {
  const context = createContext();
  let timerCallback = null;
  let finishReason = '';
  context.window.setTimeout = (callback) => {
    timerCallback = callback;
    return 17;
  };
  context.handleMinigameEnd = (reason) => {
    finishReason = reason;
  };
  context.scheduleMinigameRuntimePersist = () => {};
  context.updateMinigameHud = () => {};
  context.pushMinigameFloater = () => {};

  const session = makeSession('rhythmHum');
  session.rhythmJudgments = [null, null];
  session.expiredNotes = [];
  const chart = [
    { id: 'note-0', lane: 'left', hitAt: 100, travelMs: 1000 },
    { id: 'note-1', lane: 'right', hitAt: 200, travelMs: 1000 }
  ];
  context.runtime.state = { minigames: { active: session } };
  context.runtime.minigame = { session, chart, pattern: ['left', 'right'], pulses: [], floaters: [], animationFrame: 0 };
  context.resolveRhythmHumNote(0, 'perfect', 3, 100, 'left', 0, '+3', true);
  context.resolveRhythmHumNote(0, 'perfect', 3, 101, 'left', 1, '+3', true);
  context.resolveRhythmHumNote(1, 'miss', 0, 600, 'right', 400, '', true, 'expired');
  assert(session.resolvedCount === 2 && session.correctCount === 1 && session.expiredCount === 1, 'rhythm counters must resolve hit and expiry once');
  assert(typeof timerCallback === 'function', 'last resolved note must schedule auto-finish');
  timerCallback();
  assert(finishReason === 'completed', `auto-finish must use completed finish path, got ${finishReason}`);
});

test('short visibility loss pauses clocks while a long loss aborts', () => {
  const context = createContext();
  let now = 21000;
  let abortReason = '';
  let persistCalls = 0;
  let flushCalls = 0;
  context.getRuntimeNow = () => now;
  context.persistRuntimeState = () => { persistCalls += 1; };
  context.flushMinigameRuntimePersist = () => { flushCalls += 1; return true; };
  context.handleMinigameEnd = (reason) => { abortReason = reason; };
  context.document.visibilityState = 'hidden';
  const session = Object.assign(makeSession('sporePop'), {
    startedAt: 1000,
    until: 19000,
    ownerLeaseUntil: 50000,
    metrics: { phaseStartedAt: 2000, phaseUntil: 5000 }
  });
  context.runtime.state = { minigames: { active: { ...session } } };
  context.runtime.minigame = {
    session,
    targets: [{ appearsAt: 4000, expiresAt: 5000 }],
    chart: [{ hitAt: 6000 }]
  };
  context.handleMinigameVisibilityChange();
  assert(session.hiddenAt === now && context.runtime.state.minigames.active.hiddenAt === now, 'hidden state must record its timestamp in runtime and persisted state');
  assert(flushCalls === 1, 'hidden state must flush the active session immediately');

  session.hiddenAt = 1000;
  context.runtime.state.minigames.active.hiddenAt = 1000;
  context.document.visibilityState = 'visible';
  context.handleMinigameVisibilityChange();
  assert(session.startedAt === 21000 && session.until === 39000, 'short hidden interval must shift the session clock');
  assert(session.metrics.phaseStartedAt === 22000 && session.metrics.phaseUntil === 25000,
    'short hidden interval must also shift phase clocks used by Memory Garden');
  assert(session.ownerLeaseUntil === 70000, 'short hidden interval must preserve the exclusive ownership grace');
  assert(context.runtime.minigame.targets[0].appearsAt === 24000 && context.runtime.minigame.chart[0].hitAt === 26000, 'short hidden interval must shift target clocks');
  assert(persistCalls === 1 && !abortReason, 'short hidden interval must persist without aborting');

  now = 80000;
  session.hiddenAt = 40000;
  context.runtime.state.minigames.active.hiddenAt = 40000;
  context.handleMinigameVisibilityChange();
  assert(abortReason === 'abort', 'more than 30 seconds hidden must abort the round');
});

test('sensory cues are emitted directly and rhythm metronome cues do not repeat', () => {
  const context = createContext();
  const cues = [];
  context.playMinigameSensoryCue = (cue, detail) => {
    cues.push({ cue, detail });
  };
  context.emitStandardMinigameSensoryCue('rare', { outcome: 'correct' });
  assert(cues.length === 1 && cues[0].cue === 'rare' && cues[0].detail.outcome === 'correct', 'direct sensory API must receive semantic cue details');

  context.runtime.minigame = {
    metronomeCueIndex: -1,
    chart: [
      { id: 'note-0', lane: 'left', hitAt: 100 },
      { id: 'note-1', lane: 'right', hitAt: 200 }
    ]
  };
  context.emitRhythmHumMetronomeCue(100);
  context.emitRhythmHumMetronomeCue(150);
  assert(cues.length === 2, `metronome crossing must emit once, got ${cues.length - 1} emissions`);
  assert(cues[1].cue === 'confirm' && cues[1].detail.type === 'metronome' && cues[1].detail.lane === 'left', 'metronome cue must identify its lane');
});

test('HUD setters and reduced-motion cues stay stable when values do not change', () => {
  const context = createContext();
  let writes = 0;
  let value = '';
  const node = {};
  Object.defineProperty(node, 'textContent', {
    get: () => value,
    set: (next) => {
      writes += 1;
      value = next;
    }
  });
  context.dom.minigameScore = node;
  context.setMinigameHudText('Score', '3 punkty');
  context.setMinigameHudText('Score', '3 punkty');
  assert(writes === 1, `identical HUD text must write once, got ${writes}`);
  context.runtime.reducedMotion = true;
  assert(context.getMinigameVisualPulse(100, 120, 0) === context.getMinigameVisualPulse(900, 120, 0), 'reduced-motion cue must be static');
});

for (const [name, callback] of tests) {
  try {
    callback();
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

function createContext() {
  const context = {
    console,
    Math,
    Date,
    rules: {
      minigames: {
        dewCatch: { dropCount: 24 },
        sporePop: { targetCount: 20, telegraphMs: 520 },
        compostSort: { pieceCount: 18 },
        rhythmHum: {
          durationMs: 18000,
          beatCount: 8,
          noteLeadMs: 1750,
          beatIntervalMs: 1250,
          missWindowMs: 360,
          mobileForgivenessWindowMs: 45
        }
      }
    },
    runtime: { state: { minigames: { active: null } }, minigame: null, reducedMotion: false },
    dom: { rhythmHumCanvas: { width: 240, height: 144 } },
    document: { visibilityState: 'visible' },
    window: {
      setTimeout: () => 1,
      clearTimeout() {},
      cancelAnimationFrame() {},
      matchMedia: () => ({ matches: false })
    },
    getRuntimeNow: () => 1000,
    persistRuntimeState() {},
    handleMinigameEnd() {},
    pushMinigameFloater() {},
    triggerEffect() {}
  };
  vm.createContext(context);
  [
    'ClientMinigameDewCatch.html',
    'ClientMinigameSporePop.html',
    'ClientMinigameCompostSort.html',
    'ClientMinigameRhythmHum.html'
  ].forEach((file) => {
    vm.runInContext(readFileSync(path.join(rootDir, file), 'utf8'), context, { filename: file });
  });
  return context;
}

function makeSession(id) {
  return {
    id,
    score: 0,
    caught: [],
    expired: [],
    mistakes: 0,
    combo: 0,
    bestCombo: 0,
    resolvedCount: 0,
    correctCount: 0,
    expiredCount: 0,
    inputCount: 0
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
