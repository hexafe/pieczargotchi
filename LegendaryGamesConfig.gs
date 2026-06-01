function getLegendaryGamesConfig() {
  return {
    unlockStage: 'legendary',
    dailyProjectPointCap: 6,
    games: getLegendaryMinigamesConfig()
  };
}

function getLegendaryMinigamesConfig() {
  return {
    sporeTrail: {
      id: 'sporeTrail',
      label: 'Szlak Zarodników',
      durationMs: 45000,
      difficultyProfile: 'cozy',
      interactionKind: 'orderedTrail',
      cooldownMs: 6 * 60 * 60000,
      masteryTarget: 18,
      scoreTargetCasual: 12,
      scoreTargetMastery: 18,
      perfectTarget: 22,
      targetCount: 18,
      requiresStage: 'legendary',
      legendary: true,
      projectPoints: 3,
      seasonPoints: 2,
      scoreLabelForms: ['trop', 'tropy', 'tropów'],
      prompt: 'Wybierz świecące ślady i poprowadź zarodniki przez pogodę.',
      memento: { id: 'memento-spore-trail-map', label: 'Mapa szlaku zarodników' },
      rewards: {
        sporesPerPoint: 0.06,
        sporesMax: 1
      }
    },
    myceliumLeague: {
      id: 'myceliumLeague',
      label: 'Liga Grzybni',
      durationMs: 50000,
      difficultyProfile: 'cozy',
      interactionKind: 'stance',
      cooldownMs: 2 * 60 * 60000,
      masteryTarget: 24,
      scoreTargetCasual: 14,
      scoreTargetMastery: 24,
      perfectTarget: 28,
      targetCount: 16,
      requiresStage: 'legendary',
      legendary: true,
      projectPoints: 2,
      seasonPoints: 3,
      scoreLabelForms: ['punkt', 'punkty', 'punktów'],
      prompt: 'Czytaj aurę rywala i trafiaj właściwy znak ruchu.',
      memento: { id: 'memento-mycelium-league-badge', label: 'Odznaka ligi grzybni' },
      rewards: {
        sporesPerPoint: 0.05,
        sporesMax: 2
      }
    },
    memoryGarden: {
      id: 'memoryGarden',
      label: 'Ogród Pamiątek',
      durationMs: 42000,
      difficultyProfile: 'cozy',
      interactionKind: 'memory',
      cooldownMs: 12 * 60 * 60000,
      masteryTarget: 15,
      scoreTargetCasual: 9,
      scoreTargetMastery: 15,
      perfectTarget: 18,
      targetCount: 12,
      requiresStage: 'legendary',
      legendary: true,
      projectPoints: 3,
      seasonPoints: 2,
      scoreLabelForms: ['układ', 'układy', 'układów'],
      prompt: 'Układaj rozświetlone pamiątki, zanim zgasną w mchu.',
      memento: { id: 'memento-memory-garden-frame', label: 'Ramka ogrodu pamiątek' },
      rewards: {
        sporesPerPoint: 0.04,
        sporesMax: 1,
        substratePerPoint: 0.03,
        substrateMax: 1
      }
    }
  };
}
