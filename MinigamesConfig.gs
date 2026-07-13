function getMinigamesConfig() {
  const baseMinigames = {
    dewCatch: {
      id: 'dewCatch',
      label: 'Łapanie rosy',
      difficultyProfile: 'cozy',
      practiceAllowed: true,
      interactionKind: 'catch',
      durationMs: 20000,
      dropCount: 24,
      mobileForgivenessPx: 6,
      cooldownMs: 25 * 60000,
      masteryTarget: 32,
      scoreTargetCasual: 18,
      scoreTargetMastery: 32,
      perfectTarget: 36,
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
      difficultyProfile: 'cozy',
      practiceAllowed: true,
      interactionKind: 'tap',
      durationMs: 18000,
      targetCount: 20,
      telegraphMs: 520,
      pointerForgivenessPx: 8,
      cooldownMs: 30 * 60000,
      masteryTarget: 30,
      scoreTargetCasual: 18,
      scoreTargetMastery: 30,
      perfectTarget: 34,
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
      difficultyProfile: 'cozy',
      practiceAllowed: true,
      interactionKind: 'sort',
      durationMs: 22000,
      pieceCount: 18,
      pointerForgivenessPx: 10,
      cooldownMs: 28 * 60000,
      masteryTarget: 23,
      scoreTargetCasual: 14,
      scoreTargetMastery: 23,
      perfectTarget: 27,
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
      difficultyProfile: 'cozy',
      practiceAllowed: true,
      interactionKind: 'rhythm',
      durationMs: 18000,
      beatCount: 8,
      noteLeadMs: 1750,
      beatIntervalMs: 1250,
      perfectWindowMs: 90,
      goodWindowMs: 155,
      okWindowMs: 235,
      missWindowMs: 360,
      rhythmVisualOffsetMs: 0,
      mobileForgivenessWindowMs: 45,
      cooldownMs: 24 * 60000,
      masteryTarget: 24,
      scoreTargetCasual: 14,
      scoreTargetMastery: 24,
      perfectTarget: 27,
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
  const legendaryMinigames = typeof getLegendaryMinigamesConfig === 'function'
    ? getLegendaryMinigamesConfig()
    : {};
  return Object.assign({}, baseMinigames, legendaryMinigames);
}
