function getMinigamesConfig() {
  return {
    dewCatch: {
      id: 'dewCatch',
      label: 'Łapanie rosy',
      durationMs: 20000,
      dropCount: 24,
      cooldownMs: 25 * 60000,
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
      rewards: {
        happinessBase: 2,
        happinessPerPop: 1,
        happinessMax: 10,
        sporesPerPop: 0.12,
        sporesMax: 2
      }
    }
  };
}
