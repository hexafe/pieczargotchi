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
      mildThreshold: 40,
      criticalThreshold: 20,
      deadlineMs: 90 * 60000,
      criticalDeadlineMs: 35 * 60000,
      repeatedMistakeCooldownMs: 3 * 60 * 60000,
      penalties: {
        mild: {
          health: -2,
          happiness: -1,
          patchQuality: -2
        },
        critical: {
          health: -6,
          happiness: -4,
          patchQuality: -5
        }
      },
      perNeed: {
        hydration: {
          mildThreshold: 42,
          criticalThreshold: 22,
          deadlineMs: 75 * 60000,
          criticalDeadlineMs: 30 * 60000
        },
        nutrients: {
          mildThreshold: 40,
          criticalThreshold: 20,
          deadlineMs: 90 * 60000,
          criticalDeadlineMs: 35 * 60000
        },
        happiness: {
          mildThreshold: 38,
          criticalThreshold: 18,
          deadlineMs: 100 * 60000,
          criticalDeadlineMs: 40 * 60000
        },
        cleanliness: {
          mildThreshold: 34,
          criticalThreshold: 16,
          deadlineMs: 120 * 60000,
          criticalDeadlineMs: 50 * 60000
        },
        energy: {
          mildThreshold: 30,
          criticalThreshold: 12,
          deadlineMs: 120 * 60000,
          criticalDeadlineMs: 50 * 60000
        },
        health: {
          mildThreshold: 45,
          criticalThreshold: 25,
          deadlineMs: 45 * 60000,
          criticalDeadlineMs: 20 * 60000
        }
      }
    },
    needDefinitions: {
      hydration: {
        category: 'physical',
        actionId: 'hydrate',
        title: 'Chce wilgoci',
        mildMessage: 'Mech robi się suchy. Pieczarka zerka na krople wody.',
        criticalMessage: 'Podłoże jest przesuszone. Pieczarka potrzebuje zroszenia teraz.'
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
        criticalMessage: 'Grzybnia jest brudna. To zaczyna szkodzić zdrowiu.'
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
      { id: 'baby', label: 'Maluch', growth: 8 },
      { id: 'young', label: 'Młoda', growth: 28 },
      { id: 'adult', label: 'Dorosła', growth: 62 },
      { id: 'legendary', label: 'Legendarna', growth: 100 }
    ],
    decayPerHour: {
      awake: {
        hydration: -3.8,
        nutrients: -3.1,
        energy: -4.2,
        happiness: -2.4,
        cleanliness: -1.35
      },
      sleeping: {
        hydration: -1.2,
        nutrients: -1,
        energy: 8.5,
        happiness: -0.45,
        cleanliness: -0.45
      },
      quietSleeping: {
        hydration: -0.6,
        nutrients: -0.5,
        energy: 8,
        happiness: -0.2,
        cleanliness: -0.25
      },
      quietAwake: {
        hydration: -1,
        nutrients: -0.8,
        energy: 3,
        happiness: -0.4,
        cleanliness: -0.35
      }
    },
    healthPerHour: {
      poorConditions: -4,
      goodConditions: 2
    },
    recovery: {
      triggerHealth: 0,
      manualHealthThreshold: 45,
      durationMs: 6 * 60 * 60000,
      extensionMs: 2 * 60 * 60000,
      recentCareMs: 2.5 * 60 * 60000,
      startHealth: 8,
      completeHealth: 28,
      extensionPenalty: {
        happiness: -3,
        patchQuality: -4
      },
      careMinimums: {
        hydration: 28,
        nutrients: 28,
        cleanliness: 28
      },
      careActionIds: ['hydrate', 'feed', 'clean', 'mossRest'],
      blockedActionIds: ['sleepWake', 'play', 'instrument', 'sing', 'spores']
    },
    growthPerHour: {
      awakeHealthy: 0.6,
      sleepingHealthy: 0.18,
      quietDrowsyHealthy: 0.08
    },
    patchPerHour: {
      cleanHealthy: 0.9,
      neglected: -3
    },
    careRhythm: {
      profile: 'normal',
      quietStartMinute: 22 * 60 + 30,
      quietEndMinute: 7 * 60,
      morningGraceMs: 45 * 60000,
      offlineCapHours: 24,
      dailyGrowthCap: 8.5
    },
    weatherBalance: {
      maxElapsedHours: 3,
      rainHydrationPerHour: 3.2,
      stormHydrationPerHour: 2,
      snowHydrationPerHour: 0.7,
      highHumidityHydrationPerHour: 0.6,
      windDryingPerHour: -1.4,
      heatDryingPerHour: -1.2,
      stormHappinessPerHour: -1,
      stormCleanlinessPerHour: -0.8
    },
    minigames: getMinigamesConfig(),
    evolution: getEvolutionRulesConfig(),
    decorations: getDecorationCatalog(),
    battle: {
      unlockStage: 'legendary',
      trainingCost: 1,
      trainingCaps: {
        strength: 20,
        defense: 20,
        speed: 20,
        focus: 20
      },
      victoryRewards: {
        spores: 2,
        wins: 1,
        trophies: 1
      },
      defeatRewards: {
        losses: 1
      },
      moveCatalog: [
        {
          id: 'sporeJab',
          label: 'Zarodnikowy cios',
          staminaCost: 8,
          power: 14,
          accuracy: 0.94,
          stat: 'strength'
        },
        {
          id: 'capGuard',
          label: 'Osłona kapelusza',
          staminaCost: 6,
          power: 4,
          accuracy: 1,
          stat: 'defense',
          guard: 0.35
        },
        {
          id: 'myceliumFeint',
          label: 'Myk grzybni',
          staminaCost: 10,
          power: 10,
          accuracy: 0.9,
          stat: 'speed',
          statusEffect: {
            target: 'opponent',
            type: 'slow',
            turns: 2,
            value: 3
          }
        },
        {
          id: 'focusBloom',
          label: 'Skupiony rozkwit',
          staminaCost: 12,
          power: 18,
          accuracy: 0.82,
          stat: 'focus',
          selfEffect: {
            type: 'stamina',
            value: 4
          }
        }
      ],
      opponentCatalog: [
        {
          id: 'sproutling',
          name: 'Kiełek areny',
          rank: 1,
          strategy: 'balanced',
          weights: {
            sporeJab: 4,
            capGuard: 2,
            myceliumFeint: 2,
            focusBloom: 1
          }
        },
        {
          id: 'windcap',
          name: 'Wiatrokapelusz',
          rank: 2,
          strategy: 'speed',
          weights: {
            sporeJab: 2,
            capGuard: 1,
            myceliumFeint: 5,
            focusBloom: 2
          }
        },
        {
          id: 'eldercap',
          name: 'Starszy Kapelusz',
          rank: 3,
          strategy: 'defensive',
          weights: {
            sporeJab: 2,
            capGuard: 4,
            myceliumFeint: 1,
            focusBloom: 3
          }
        }
      ]
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
