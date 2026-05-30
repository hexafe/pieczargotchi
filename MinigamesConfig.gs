function getMinigamesConfig() {
  return {
    dewCatch: {
      id: 'dewCatch',
      label: 'Łapanie rosy',
      durationMs: 20000,
      dropCount: 24,
      cooldownMs: 25 * 60000,
      masteryTarget: 32,
      rewards: {
        hydrationBase: 4,
        hydrationPerCatch: 2,
        hydrationMax: 14,
        happinessPerCatch: 0.5,
        happinessMax: 4
      }
    },
    sporePop: {
      id: 'sporePop',
      label: 'Pękanie zarodników',
      durationMs: 18000,
      targetCount: 20,
      cooldownMs: 30 * 60000,
      masteryTarget: 30,
      rewards: {
        happinessBase: 2,
        happinessPerPop: 1,
        happinessMax: 10,
        sporesPerPop: 0.12,
        sporesMax: 2
      }
    },
    compostSort: {
      id: 'compostSort',
      label: 'Sortowanie kompostu',
      durationMs: 22000,
      pieceCount: 18,
      cooldownMs: 28 * 60000,
      masteryTarget: 23,
      rewards: {
        nutrientsBase: 2,
        nutrientsPerPoint: 1.2,
        nutrientsMax: 12,
        cleanlinessBase: 1,
        cleanlinessPerPoint: 0.4,
        cleanlinessMax: 5,
        substratePerPoint: 0.08,
        substrateMax: 1
      }
    },
    rhythmHum: {
      id: 'rhythmHum',
      label: 'Rytmiczne nucenie',
      durationMs: 18000,
      beatCount: 8,
      noteLeadMs: 1600,
      beatIntervalMs: 1150,
      perfectWindowMs: 70,
      goodWindowMs: 125,
      okWindowMs: 190,
      missWindowMs: 260,
      cooldownMs: 24 * 60000,
      masteryTarget: 24,
      rewards: {
        happinessBase: 2,
        happinessPerPoint: 1.1,
        happinessMax: 12,
        energyBase: 0,
        energyPerPoint: 0.25,
        energyMax: 3
      }
    }
  };
}
