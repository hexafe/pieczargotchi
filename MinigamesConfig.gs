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
    }
  };
}
