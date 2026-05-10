function getGameRulesConfig() {
  return {
    canvasSize: PIECZARGOTCHI_CANVAS_SIZE,
    sleepingFrameCount: 4,
    sleepingFps: 3,
    maxLogEntries: 8,
    tickMs: 60000,
    cooldownTickMs: 1000,
    wakeSurpriseMs: 1800,
    activityMs: 2400,
    attention: {
      mildThreshold: 45,
      criticalThreshold: 25,
      deadlineMs: 180000,
      criticalDeadlineMs: 90000,
      repeatedMistakeCooldownMs: 900000
    },
    needDefinitions: {
      hydration: {
        category: 'physical',
        actionId: 'hydrate',
        title: 'Chce wilgoci',
        mildMessage: 'Mech robi się suchy. Pieczarka zerka na krople wody.',
        criticalMessage: 'Grządka jest przesuszona. Pieczarka potrzebuje zroszenia teraz.'
      },
      nutrients: {
        category: 'physical',
        actionId: 'feed',
        title: 'Głodne podłoże',
        mildMessage: 'Podłoże traci siłę. Przyda się kompost.',
        criticalMessage: 'Podłoże jest prawie puste. Pieczarka przestaje rosnąć.'
      },
      happiness: {
        category: 'mental',
        actionId: 'play',
        title: 'Nudzi się',
        mildMessage: 'Pieczarka patrzy w bok i czeka na zabawę.',
        criticalMessage: 'Pieczarka bardzo się nudzi. Potrzebuje uwagi.'
      },
      cleanliness: {
        category: 'environment',
        actionId: 'clean',
        title: 'Bałagan',
        mildMessage: 'W mchu zbiera się bałagan.',
        criticalMessage: 'Grządka jest brudna. To zaczyna szkodzić zdrowiu.'
      },
      energy: {
        category: 'rest',
        actionId: 'sleepWake',
        title: 'Senność',
        mildMessage: 'Kapelusz opada. Pieczarka myśli o drzemce.',
        criticalMessage: 'Pieczarka ledwo trzyma oczka otwarte. Czas spać.'
      },
      health: {
        category: 'physical',
        actionId: 'hydrate',
        title: 'Niedomaga',
        mildMessage: 'Pieczarka wygląda słabiej niż zwykle.',
        criticalMessage: 'Pieczarka choruje. Potrzebuje spokojnej opieki.'
      }
    },
    statBounds: {
      min: 0,
      max: 100
    },
    stageThresholds: [
      { id: 'spore', label: 'Zarodnik', growth: 0 },
      { id: 'baby', label: 'Maluch', growth: 12 },
      { id: 'young', label: 'Młoda', growth: 35 },
      { id: 'adult', label: 'Dorosła', growth: 70 },
      { id: 'legendary', label: 'Legendarna', growth: 100 }
    ],
    decayPerHour: {
      awake: {
        hydration: -5,
        nutrients: -4,
        energy: -6,
        happiness: -3,
        cleanliness: -2
      },
      sleeping: {
        hydration: -2,
        nutrients: -2,
        energy: 10,
        happiness: -1,
        cleanliness: -1
      }
    },
    healthPerHour: {
      poorConditions: -10,
      goodConditions: 4
    },
    growthPerHour: {
      awakeHealthy: 3,
      sleepingHealthy: 1.25
    },
    patchPerHour: {
      cleanHealthy: 2,
      neglected: -6
    },
    instruments: [
      'mała kalimba',
      'kieszonkowy syntezator',
      'mchowy flet',
      'słoikowe bębenki',
      'dzwonki zarodnikowe',
      'deszczowe cymbałki'
    ]
  };
}
