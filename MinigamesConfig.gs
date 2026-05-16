function getMinigamesConfig() {
  return {
    dewCatch: {
      id: 'dewCatch',
      label: 'Łapanie rosy',
      durationMs: 20000,
      dropCount: 18,
      cooldownMs: 60000,
      rewards: {
        hydrationBase: 4,
        hydrationPerCatch: 2,
        hydrationMax: 18,
        happinessPerCatch: 1,
        happinessMax: 6
      }
    },
    sporePop: {
      id: 'sporePop',
      label: 'Pękanie zarodników',
      durationMs: 18000,
      targetCount: 20,
      cooldownMs: 75000,
      rewards: {
        happinessBase: 2,
        happinessPerPop: 1,
        happinessMax: 14,
        sporesPerPop: 0.22,
        sporesMax: 4
      }
    }
  };
}
