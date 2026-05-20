function getStateModelConfig() {
  return {
    version: PIECZARGOTCHI_STATE_VERSION,
    storageKey: PIECZARGOTCHI_STORAGE_KEY,
    defaultState: createDefaultStateTemplate(),
    statOrder: [
      'hydration',
      'nutrients',
      'energy',
      'happiness',
      'cleanliness',
      'health',
      'growth'
    ],
    inventoryOrder: ['water', 'compost', 'toys', 'substrate', 'spores']
  };
}

function createDefaultStateTemplate() {
  return {
    version: PIECZARGOTCHI_STATE_VERSION,
    playerId: null,
    mushroomName: 'Pieczarka',
    createdAt: null,
    lastUpdatedAt: null,
    mode: 'sleeping',
    stage: 'spore',
    currentActivity: null,
    lastRandomInstrument: null,
    stats: {
      hydration: 70,
      nutrients: 70,
      energy: 80,
      happiness: 60,
      cleanliness: 80,
      health: 100,
      growth: 0
    },
    inventory: {
      water: 3,
      compost: 2,
      toys: 1,
      substrate: 1,
      spores: 0
    },
    history: {
      actionsPerformed: {},
      modeMs: {
        awake: 0,
        sleeping: 0
      },
      statSamples: {
        count: 0,
        hydration: 0,
        nutrients: 0,
        energy: 0,
        happiness: 0,
        cleanliness: 0,
        health: 0
      },
      attention: {
        handled: 0,
        missed: 0
      },
      dailyGrowth: {
        dateKey: null,
        earned: 0
      },
      minigames: {}
    },
    patch: {
      quality: 72,
      mycelium: 0,
      harvests: 0,
      careStreak: 0
    },
    attention: {
      activeNeed: null,
      severity: null,
      startedAt: null,
      deadlineAt: null,
      lastMistakeAt: null,
      pausedUntil: null,
      quietSuppressed: false
    },
    recovery: {
      active: false,
      startedAt: null,
      until: null,
      lastCareAt: null,
      missedCare: 0,
      reason: null,
      endedAt: null
    },
    gameOver: {
      active: false,
      reason: null,
      at: null,
      survivedDays: 0,
      stage: null,
      recoveryMissedCare: 0
    },
    careMistakes: {
      physical: 0,
      mental: 0,
      environment: 0,
      rest: 0
    },
    battle: {
      version: 1,
      mode: 'idle',
      unlockedAt: null,
      training: {
        strength: 0,
        defense: 0,
        speed: 0,
        focus: 0
      },
      activeBattle: null,
      rewards: {
        wins: 0,
        losses: 0,
        trophies: 0
      },
      log: []
    },
    evolution: {
      variant: null,
      decidedAt: null,
      reason: null
    },
    minigames: {
      active: null,
      lastResult: null
    },
    decorations: {
      owned: [],
      active: []
    },
    discoveries: {
      sky: {},
      environment: {}
    },
    coins: 0,
    cooldowns: {
      hydrate: 0,
      feed: 0,
      clean: 0,
      play: 0,
      instrument: 0,
      sing: 0,
      sleepWake: 0,
      mossRest: 0,
      spores: 0
    },
    flags: {
      tutorialDone: false,
      firstWakeDone: false,
      firstFeedDone: false,
      firstInstrumentDone: false,
      firstSingDone: false
    },
    log: []
  };
}
