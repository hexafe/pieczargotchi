import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const tests = [];

test('default state keeps world audio opt-in and initializes replay clues', () => {
  const context = {
    PIECZARGOTCHI_STATE_VERSION: 22,
    PIECZARGOTCHI_STORAGE_KEY: 'test_state'
  };
  vm.createContext(context);
  vm.runInContext(read('StateModel.gs'), context, { filename: 'StateModel.gs' });
  const state = plain(context.createDefaultStateTemplate());

  assert(state.preferences.world.audioMode === 'off', 'world audio must default to off');
  assert(state.preferences.world.motionMode === 'system', 'motion must respect the operating system by default');
  assert(state.preferences.world.stormFlashesEnabled, 'storm flashes should remain available until the user disables them');
  assert(!state.preferences.world.batterySaver, 'battery saver must remain opt-in');
  assert(state.preferences.world.ambientVolume === 40, 'default ambient volume should be bounded and quiet');
  assert(Array.isArray(state.journal.clues) && state.journal.clues.length === 0, 'new saves must initialize an empty clue trail');
});

test('v22 migration preserves valid preferences and journal history while filling new shapes', () => {
  const core = createCoreContext().PieczargotchiCore;
  const now = Date.parse('2026-07-15T08:00:00.000Z');
  const migrated = plain(core.migrateStateVersion({
    version: 21,
    legacyMarker: { keep: true },
    stats: { health: 88 },
    preferences: {
      minigames: { audioEnabled: false },
      world: {
        motionMode: 'gentle',
        stormFlashesEnabled: false,
        batterySaver: true,
        audioMode: 'cues',
        ambientVolume: 77
      }
    },
    journal: {
      entries: [{ id: 'environment:dew', type: 'environment', label: 'Rosa', at: '2026-07-14T06:00:00.000Z' }]
    }
  }, 22, {}, now));

  assert(migrated.version === 22, `expected v22, got ${migrated.version}`);
  assert(migrated.legacyMarker.keep, 'unrelated save fields must survive migration');
  assert(migrated.preferences.world.motionMode === 'gentle', 'valid motion preference must survive migration');
  assert(migrated.preferences.world.audioMode === 'cues' && migrated.preferences.world.ambientVolume === 77,
    'valid audio preferences must survive migration');
  assert(!migrated.preferences.world.stormFlashesEnabled && migrated.preferences.world.batterySaver,
    'valid boolean preferences must survive migration');
  assert(migrated.journal.entries[0].label === 'Rosa', 'existing journal entries must survive migration');
  assert(Array.isArray(migrated.journal.clues) && migrated.journal.clues.length === 0,
    'legacy journals must receive an empty clue list');
});

test('world preference normalization rejects invalid modes and clamps volume', () => {
  const core = createCoreContext().PieczargotchiCore;
  const normalized = plain(core.normalizeProgressionState({
    preferences: {
      keepMe: 'yes',
      world: {
        motionMode: 'warp',
        stormFlashesEnabled: false,
        batterySaver: 'yes',
        audioMode: 'always',
        ambientVolume: 240
      }
    }
  }, {}, [], Date.parse('2026-07-15T08:00:00.000Z')));

  assert(normalized.preferences.keepMe === 'yes', 'unrelated preference namespaces must survive normalization');
  assert(normalized.preferences.world.motionMode === 'system', 'unknown motion mode must fall back to system');
  assert(normalized.preferences.world.audioMode === 'off', 'unknown audio mode must fall back to off');
  assert(normalized.preferences.world.ambientVolume === 100, 'ambient volume must clamp to 100');
  assert(!normalized.preferences.world.stormFlashesEnabled && normalized.preferences.world.batterySaver,
    'boolean sensory preferences must normalize predictably');
});

test('journal clues are sanitized, capped, and enhance only locked discovery hints', () => {
  const core = createCoreContext().PieczargotchiCore;
  const clues = Array.from({ length: 30 }, (_, index) => ({
    id: `clue:2026-07-${String(index + 1).padStart(2, '0')}:discovery-${index}`,
    discoveryId: index === 0 ? 'moonHalo' : `discovery-${index}`,
    type: 'environment',
    route: index % 2 ? 'nearMiss' : 'morningTrace',
    dateKey: `2026-07-${String(index + 1).padStart(2, '0')}`,
    at: `2026-07-${String(Math.min(28, index + 1)).padStart(2, '0')}T06:00:00.000Z`,
    level: index === 0 ? 2 : 1,
    hint: index === 0 ? 'Poranek zachował srebrny krąg.' : `Trop ${index}`,
    intensity: 2
  })).concat([{ id: '', discoveryId: '__proto__', dateKey: 'bad', hint: '' }]);
  const normalized = plain(core.normalizeWorldJournal({ entries: [], clues }));
  const journal = plain(core.getWorldJournal({
    discoveries: { sky: {}, environment: {}, instruments: {}, calendar: {} },
    journal: { entries: [], clues: [clues[0]] }
  }, {}));
  const environment = journal.groups.find((group) => group.id === 'environment');
  const moonHalo = environment.items.find((item) => item.id === 'moonHalo');

  assert(normalized.clues.length === 24, `expected clue cap 24, got ${normalized.clues.length}`);
  assert(normalized.clues.every((clue) => clue.intensity <= 1 && clue.level >= 1 && clue.level <= 3),
    'clue scalar fields must be bounded');
  assert(moonHalo && !moonHalo.discovered, 'clue target must remain locked');
  assert(moonHalo.clueLevel === 2 && moonHalo.hint === 'Poranek zachował srebrny krąg.',
    'latest clue level must replace only the generic locked hint');

  const discoveredJournal = plain(core.getWorldJournal({
    discoveries: {
      sky: {},
      environment: { moonHalo: { id: 'moonHalo', label: 'Halo księżycowe', firstSeenAt: '2026-07-15T22:00:00.000Z', count: 1 } },
      instruments: {},
      calendar: {}
    },
    journal: { entries: [], clues: [clues[0]] }
  }, {}));
  const discoveredHalo = discoveredJournal.groups.find((group) => group.id === 'environment').items
    .find((item) => item.id === 'moonHalo');
  assert(discoveredHalo.discovered && discoveredHalo.clue === null && discoveredHalo.clueLevel === 0,
    'completed discoveries must not keep a locked clue overlay');

  const consolidated = plain(core.normalizeWorldJournal({ entries: [], clues: [{
    id: 'old', discoveryId: 'moonHalo', type: 'environment', route: 'nearMiss',
    dateKey: '2026-07-14', at: '2026-07-14T08:00:00.000Z', level: 3, hint: 'Pełny trop.', intensity: 0.3
  }, {
    id: 'new', discoveryId: 'moonHalo', type: 'environment', route: 'morningTrace',
    dateKey: '2026-07-15', at: '2026-07-15T08:00:00.000Z', level: 1, hint: 'Słabszy trop.', intensity: 0.6
  }] }));
  assert(consolidated.clues.length === 1 && consolidated.clues[0].level === 3,
    'normalization must consolidate duplicate discovery clues without losing the highest level');
  assert(consolidated.clues[0].dateKey === '2026-07-15' && consolidated.clues[0].hint === 'Pełny trop.',
    'consolidated clue must preserve the latest daily marker and highest-level hint');
});

test('morning trace route is deterministic and does not unlock a discovery', () => {
  const core = createCoreContext().PieczargotchiCore;
  const now = new Date(2026, 6, 15, 7, 30, 0).getTime();
  const scene = getMorningScene();
  const first = plain(core.calculateAmbientPhenomena(scene, now, now));
  const second = plain(core.calculateAmbientPhenomena(scene, now, now));

  assert(first.morningTraces.length >= 1, 'morning must expose a trace route for night-only discoveries');
  assert(first.morningTraces.some((candidate) => candidate.type === 'sky'),
    'morning route must include night-only sky discoveries, not only ground phenomena');
  assert(JSON.stringify(first.morningTraces) === JSON.stringify(second.morningTraces),
    'morning trace ordering and hints must be deterministic');
  assert(first.discoveries.length === 0, 'morning traces must not masquerade as current discoveries');
  assert(first.morningTraces.every((candidate) => candidate.route === 'morningTrace' && candidate.hints.length === 3),
    'morning traces must carry progressive non-reward hints');
});

test('visible near-misses create the daytime clue route without granting the phenomenon', () => {
  const now = new Date(2026, 6, 15, 11, 0, 0).getTime();
  const scene = getNearMissScene();
  const context = createWorldContext({ scene });
  const profile = plain(context.PieczargotchiCore.calculateAmbientPhenomena(scene, now, now));
  const result = plain(context.recordWorldReplayClue(now, scene));

  assert(profile.morningTraces.length === 0, 'daytime near-miss must not use the morning route');
  assert(profile.nearMisses.some((candidate) => candidate.discoveryId === 'clearingAfterRain'),
    'fixture must stay close to the clearing-after-rain threshold');
  assert(result.added && result.route === 'nearMiss' && result.discoveryId === 'clearingAfterRain',
    'strongest visible near-miss must create a deterministic clue');
  assert(!context.runtime.state.discoveries.environment.clearingAfterRain,
    'near-miss clue must not unlock the actual discovery');
});

test('clue selection respects separate sky and environment discovery namespaces', () => {
  const context = createWorldContext({ scene: getMorningScene() });
  const state = context.runtime.state;
  state.discoveries.sky.aurora = { id: 'aurora' };
  const profile = {
    morningTraces: [{
      discoveryId: 'aurora', type: 'sky', route: 'morningTrace', intensity: 0.9
    }, {
      discoveryId: 'moonHalo', type: 'environment', route: 'morningTrace', intensity: 0.7
    }],
    nearMisses: []
  };

  let selected = plain(context.selectWorldClueRouteCandidates(profile, state, []));
  assert(selected.length === 1 && selected[0].discoveryId === 'moonHalo',
    'an unlocked sky discovery must not leak through the environment discovery map');

  state.discoveries.environment.moonHalo = { id: 'moonHalo' };
  selected = plain(context.selectWorldClueRouteCandidates(profile, state, []));
  assert(selected.length === 0, 'unlocked discoveries in both namespaces must be excluded from clues');
});

test('replay clues add once per local day, advance next day, and never grant rewards', () => {
  const firstNow = new Date(2026, 6, 15, 7, 30, 0).getTime();
  const sameDay = new Date(2026, 6, 15, 9, 15, 0).getTime();
  const nextDay = new Date(2026, 6, 16, 7, 30, 0).getTime();
  const context = createWorldContext({ scene: getMorningScene() });
  const protectedBefore = JSON.stringify({
    stats: context.runtime.state.stats,
    inventory: context.runtime.state.inventory,
    discoveries: context.runtime.state.discoveries
  });

  const first = plain(context.recordWorldReplayClue(firstNow, getMorningScene()));
  const duplicate = plain(context.recordWorldReplayClue(sameDay, getMorningScene()));
  const following = plain(context.recordWorldReplayClue(nextDay, getMorningScene()));
  const protectedAfter = JSON.stringify({
    stats: context.runtime.state.stats,
    inventory: context.runtime.state.inventory,
    discoveries: context.runtime.state.discoveries
  });

  assert(first.added && first.route === 'morningTrace' && first.level === 1, 'first morning must add one level-one trace');
  assert(!duplicate.added && duplicate.reason === 'dailyLimit', 'same local day must not add a second clue');
  assert(following.added && following.dateKey !== first.dateKey, 'next local day must reset the global clue limit');
  assert(following.discoveryId === first.discoveryId && following.level === 2,
    'next-day deterministic selection must progress the existing clue before starting another');
  assert(context.runtime.state.journal.clues.length === 1, 'progress must update one durable clue record per discovery');
  assert(context.runtime.state.journal.clues[0].level === 2, 'durable clue record must retain the highest level');
  assert(context.persistCalls === 2, `only successful clues should persist, got ${context.persistCalls}`);
  assert(protectedAfter === protectedBefore, 'clues must not mutate stats, inventory, or discoveries');

  const replayContext = createWorldContext({ scene: getMorningScene() });
  const repeatedFirst = plain(replayContext.recordWorldReplayClue(firstNow, getMorningScene()));
  assert(repeatedFirst.discoveryId === first.discoveryId && repeatedFirst.hint === first.hint,
    'same save, scene, and day must select the same clue');
});

test('world audio stays gesture-gated, crossfades for two seconds, and mutes immediately', async () => {
  const audioHarness = createFakeAudioHarness();
  const context = createWorldContext({
    audioContext: audioHarness.AudioContext,
    scene: getMorningScene()
  });

  const selected = plain(context.updateWorldPreference('audio', 'atmosphere'));
  assert(selected.preferences.audioMode === 'atmosphere', 'audio preference should update without capability coupling');
  assert(audioHarness.constructed === 0, 'AudioContext must not be created without an explicit user gesture');

  const unlocked = await context.unlockWorldAudioFromGesture();
  assert(unlocked && audioHarness.constructed === 1, 'explicit gesture must create and resume one AudioContext');
  const sensory = context.runtime.worldSensory;
  assert(sensory.audio.voices.length === 1, 'atmosphere mode must start one procedural noise voice');
  assert(audioHarness.instances[0].bufferSources.length === 1, 'one unlock must not build duplicate ambience voices');

  const previousVoice = sensory.audio.voices[0];
  context.runtime.weatherScene = Object.assign({}, getMorningScene(), {
    condition: 'rain',
    rainIntensity: 0.8,
    precipitation: 5
  });
  assert(context.refreshWorldAudioAmbience(true), 'weather change must build the next ambience voice');
  const fadeOut = previousVoice.gain.gain.calls.find((call) => call.type === 'linear' && call.value === 0);
  assert(fadeOut && Math.abs(fadeOut.at - 2) < 0.0001, 'old ambience must fade out over exactly two seconds');

  context.updateWorldPreference('audio', 'cues', { userGesture: true });
  if (sensory.audio.unlockPromise) {
    await sensory.audio.unlockPromise;
  }
  assert(sensory.audio.voices.length === 0 && sensory.audio.retiringVoices.length === 0,
    'cues mode must stop both current and crossfading ambience voices');
  assert(audioHarness.instances[0].bufferSources.every((source) => source.stopped),
    'cues mode must immediately stop every procedural noise source');

  context.updateWorldPreference('audio', 'atmosphere', { userGesture: true });
  if (sensory.audio.unlockPromise) {
    await sensory.audio.unlockPromise;
  }
  assert(sensory.audio.voices.length === 1, 'returning to atmosphere must create one fresh voice');

  context.updateWorldPreference('audio', 'off');
  const master = sensory.audio.masterGain.gain;
  const immediateMute = master.calls.findLast((call) => call.type === 'set');
  assert(immediateMute && immediateMute.value === 0 && immediateMute.at === 0, 'off mode must mute the master gain immediately');
  assert(audioHarness.instances[0].suspendCalls >= 1, 'off mode must suspend the context');
  assert(sensory.audio.voices.length === 0, 'off mode must stop active ambience voices');
});

test('motion and battery setters resync quality, while hidden refresh performs zero sensory work', () => {
  const context = createWorldContext({ scene: getMorningScene() });
  let motionSyncs = 0;
  let qualityResets = 0;
  let renderRequests = 0;
  let profileCalculations = 0;
  const calculate = context.PieczargotchiCore.calculateAmbientPhenomena;
  context.runtime.sceneRenderQuality = { tier: 'balanced' };
  context.runtime.sceneFrameSnapshot = { frameNow: 1 };
  context.syncRuntimeMotionMode = function() { motionSyncs += 1; return 'still'; };
  context.resetSceneQualityGovernorWindows = function() { qualityResets += 1; };
  context.requestRuntimeRender = function() { renderRequests += 1; };
  context.PieczargotchiCore.calculateAmbientPhenomena = function(...args) {
    profileCalculations += 1;
    return calculate(...args);
  };

  context.updateWorldPreference('motion', 'still');
  context.updateWorldPreference('battery', true);
  assert(motionSyncs === 2 && qualityResets === 2 && renderRequests === 2,
    'motion and battery changes must resync runtime motion, quality windows, and rendering');
  assert(context.runtime.sceneFrameSnapshot === null, 'quality-affecting preferences must invalidate the cached frame snapshot');

  context.document.hidden = true;
  context.refreshWorldSensoryRuntime();
  assert(profileCalculations === 0, 'hidden periodic refresh must skip clue and ambience profile work');
});

test('exclusive and foreign sessions block sensory mutations before state or persistence changes', () => {
  const context = createWorldContext({ scene: getMorningScene() });
  const before = JSON.stringify(context.runtime.state);
  context.getExclusiveGameplaySession = function() {
    return { kind: 'minigame', phase: 'active', id: 'dewCatch' };
  };

  const preference = plain(context.updateWorldPreference('motion', 'still'));
  const clue = plain(context.recordWorldReplayClue(new Date(2026, 6, 15, 7, 30, 0).getTime(), getMorningScene()));
  assert(!preference.ok && preference.reason === 'exclusiveSession', 'local exclusive session must reject world settings');
  assert(!clue.added && clue.reason === 'exclusiveSession', 'local exclusive session must reject timer-driven clues');
  assert(JSON.stringify(context.runtime.state) === before && context.persistCalls === 0,
    'local exclusive guard must leave state byte-equivalent and perform zero persistence');

  context.getExclusiveGameplaySession = function() { return null; };
  context.isRuntimeMutationBlocked = function() { return true; };
  const foreignPreference = plain(context.updateWorldPreference('battery', true));
  const foreignClue = plain(context.recordWorldReplayClue(new Date(2026, 6, 16, 7, 30, 0).getTime(), getMorningScene()));
  assert(foreignPreference.reason === 'runtimeBlocked' && foreignClue.reason === 'runtimeBlocked',
    'foreign/read-only runtime guard must reject both mutation paths');
  assert(JSON.stringify(context.runtime.state) === before && context.persistCalls === 0,
    'foreign guard must also stop before in-memory mutation');
});

test('missing Web Audio capability remains silent and non-blocking', async () => {
  const context = createWorldContext({ scene: getMorningScene() });
  context.updateWorldPreference('audio', 'cues');
  const unlocked = await context.unlockWorldAudioFromGesture();
  const cue = await context.playWorldSensoryCue('confirm');
  assert(unlocked === false && cue === false, 'missing Web Audio must resolve false instead of throwing');
});

test('a trusted world cue can unlock a restored audio preference', async () => {
  const audioHarness = createFakeAudioHarness();
  const context = createWorldContext({
    audioContext: audioHarness.AudioContext,
    scene: getMorningScene()
  });
  context.updateWorldPreference('audio', 'cues');

  const played = await context.playWorldSensoryCue('focus', { userGesture: true });
  assert(played && audioHarness.constructed === 1, 'trusted cue should create one context for a restored cues preference');
  assert(audioHarness.instances[0].resumeCalls === 1, 'trusted cue should explicitly resume a suspended context');
});

test('restored atmosphere unlocks once on the next trusted ordinary gesture', async () => {
  const audioHarness = createFakeAudioHarness();
  const context = createWorldContext({
    audioContext: audioHarness.AudioContext,
    scene: getMorningScene()
  });
  context.runtime.state.preferences.world.audioMode = 'atmosphere';
  context.initWorldSensoryManager();
  assert(context.runtime.worldSensory.audio.activationBound, 'restored audio should arm a one-shot activation listener');

  context.document.dispatchEvent({ type: 'click', isTrusted: false });
  await Promise.resolve();
  assert(audioHarness.constructed === 0, 'synthetic events must not unlock Web Audio');

  context.document.dispatchEvent({ type: 'pointerdown', isTrusted: true });
  const pendingUnlock = context.runtime.worldSensory.audio.unlockPromise;
  assert(pendingUnlock && typeof pendingUnlock.then === 'function', 'trusted activation should expose the in-flight unlock');
  await pendingUnlock;
  assert(audioHarness.constructed === 1, 'one trusted ordinary gesture should unlock restored audio');
  assert(context.runtime.worldSensory.audio.voices.length === 1, 'restored atmosphere should start one ambience voice');
  assert(audioHarness.instances[0].bufferSources.length === 1, 'concurrent gesture listeners must share one unlock promise and one voice');
  assert(!context.runtime.worldSensory.audio.activationBound, 'successful unlock must remove one-shot listeners');

  context.document.dispatchEvent({ type: 'click', isTrusted: true });
  await Promise.resolve();
  assert(audioHarness.constructed === 1, 'later gestures must not build duplicate audio contexts');
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

function createCoreContext(base = {}) {
  const context = Object.assign({ console, Date, Math, JSON }, base);
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(renderTemplate('ClientCore.html')
    .replace(/^<script>\s*/, '')
    .replace(/\s*<\/script>\s*$/, ''), context, { filename: 'ClientCore.html' });
  return context;
}

function createWorldContext(options = {}) {
  const listeners = new Map();
  const pendingTimers = [];
  const document = {
    hidden: false,
    addEventListener(type, callback) {
      const list = listeners.get(type) || [];
      list.push(callback);
      listeners.set(type, list);
    },
    removeEventListener(type, callback) {
      const list = listeners.get(type) || [];
      listeners.set(type, list.filter((item) => item !== callback));
    },
    dispatchEvent(event) {
      (listeners.get(event.type) || []).forEach((callback) => callback(event));
      return true;
    },
    querySelectorAll() { return []; }
  };
  const context = createCoreContext({
    document,
    runtime: {
      state: createReplayState(),
      weatherScene: options.scene || getMorningScene()
    },
    CustomEvent: class CustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    },
    AudioContext: options.audioContext,
    webkitAudioContext: null,
    setTimeout(callback, delay) {
      const timer = { callback, delay, active: true };
      pendingTimers.push(timer);
      return timer;
    },
    clearTimeout(timer) {
      if (timer) timer.active = false;
    },
    setInterval(callback, delay) {
      return { callback, delay, interval: true };
    },
    clearInterval() {},
    isRuntimeReadOnly() { return false; },
    getRuntimeNow() { return Date.now(); },
    getRuntimeDate() { return new Date(); }
  });
  context.persistCalls = 0;
  context.persistRuntimeState = function() {
    context.persistCalls += 1;
    return { ok: true };
  };
  context.getCurrentWeatherScene = function() {
    return context.runtime.weatherScene;
  };
  vm.runInContext(read('ClientWorldAudio.html'), context, { filename: 'ClientWorldAudio.html' });
  context.__pendingTimers = pendingTimers;
  return context;
}

function createReplayState() {
  return {
    version: 22,
    stats: { hydration: 70, nutrients: 70, energy: 80, happiness: 60, cleanliness: 80, health: 100, growth: 40 },
    inventory: { water: 3, compost: 2, spores: 5 },
    preferences: {
      world: {
        motionMode: 'system',
        stormFlashesEnabled: true,
        batterySaver: false,
        audioMode: 'off',
        ambientVolume: 40
      }
    },
    discoveries: { sky: {}, environment: {}, instruments: {}, calendar: {} },
    journal: { entries: [], clues: [] }
  };
}

function getMorningScene() {
  return {
    condition: 'clear',
    dayPhase: 'morning',
    dayTone: 'dawnGold',
    isDay: true,
    temperature: 14,
    humidity: 54,
    precipitation: 0,
    rain: 0,
    snowfall: 0,
    rainIntensity: 0,
    stormIntensity: 0,
    windLevel: 0.12,
    windSpeed: 7,
    cloudCover: 18,
    cloudCoverLow: 8,
    cloudCoverMid: 12,
    cloudCoverHigh: 22,
    visibility: 12000,
    surfaceWetnessTarget: 0.08
  };
}

function getNearMissScene() {
  return {
    condition: 'cloudy',
    dayPhase: 'noon',
    isDay: true,
    temperature: -3,
    humidity: 50,
    precipitation: 0,
    rain: 0,
    snowfall: 0,
    windLevel: 0.08,
    cloudCover: 50,
    cloudCoverLow: 20,
    cloudCoverMid: 30,
    cloudCoverHigh: 50,
    visibility: 12000,
    surfaceWetnessTarget: 5 / 12
  };
}

function createFakeAudioHarness() {
  const harness = { constructed: 0, instances: [] };

  class FakeAudioParam {
    constructor(value = 0) {
      this.value = value;
      this.calls = [];
    }
    cancelScheduledValues(at) { this.calls.push({ type: 'cancel', at }); }
    setValueAtTime(value, at) { this.value = value; this.calls.push({ type: 'set', value, at }); }
    linearRampToValueAtTime(value, at) { this.value = value; this.calls.push({ type: 'linear', value, at }); }
    exponentialRampToValueAtTime(value, at) { this.value = value; this.calls.push({ type: 'exponential', value, at }); }
  }

  class FakeNode {
    constructor() { this.connections = []; this.disconnected = false; }
    connect(node) { this.connections.push(node); return node; }
    disconnect() { this.disconnected = true; }
  }

  class FakeSource extends FakeNode {
    constructor() { super(); this.started = false; this.stopped = false; this.loop = false; this.buffer = null; }
    start() { this.started = true; }
    stop() { this.stopped = true; }
  }

  class FakeContext {
    constructor() {
      harness.constructed += 1;
      harness.instances.push(this);
      this.sampleRate = 8000;
      this.currentTime = 0;
      this.state = 'suspended';
      this.destination = new FakeNode();
      this.suspendCalls = 0;
      this.resumeCalls = 0;
      this.bufferSources = [];
    }
    createGain() { const node = new FakeNode(); node.gain = new FakeAudioParam(); return node; }
    createBiquadFilter() {
      const node = new FakeNode();
      node.type = 'lowpass';
      node.frequency = new FakeAudioParam();
      node.Q = new FakeAudioParam();
      return node;
    }
    createBufferSource() { const source = new FakeSource(); this.bufferSources.push(source); return source; }
    createOscillator() {
      const node = new FakeSource();
      node.type = 'sine';
      node.frequency = new FakeAudioParam();
      return node;
    }
    createBuffer(_channels, length) {
      const data = new Float32Array(length);
      return { getChannelData() { return data; } };
    }
    resume() { this.resumeCalls += 1; this.state = 'running'; return Promise.resolve(); }
    suspend() { this.suspendCalls += 1; this.state = 'suspended'; return Promise.resolve(); }
  }

  harness.AudioContext = FakeContext;
  return harness;
}

function renderTemplate(fileName) {
  const content = read(fileName);
  return content.replace(/<\?!=\s*include\('([^']+)'\);\s*\?>/g, (_match, partialName) => {
    return renderTemplate(partialName + '.html');
  });
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
