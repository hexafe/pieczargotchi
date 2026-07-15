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
      durationMs: 34000,
      difficultyProfile: 'cozy',
      interactionKind: 'branchingTrail',
      cooldownMs: 6 * 60 * 60000,
      masteryTarget: 16,
      scoreTargetCasual: 12,
      scoreTargetMastery: 16,
      perfectTarget: 24,
      targetCount: 8,
      decisionCount: 8,
      decisionLeadMs: 900,
      decisionIntervalMs: 4100,
      decisionWindowMs: 2900,
      safeChoicePoints: 2,
      riskyChoicePoints: 3,
      riskyClosedPenaltyPoints: 1,
      riskyOpenChanceByWeather: {
        clear: 0.78,
        cloudy: 0.68,
        wind: 0.58,
        fog: 0.45,
        rain: 0.36,
        snow: 0.28,
        storm: 0.16
      },
      requiresStage: 'legendary',
      legendary: true,
      projectPoints: 3,
      seasonPoints: 2,
      scoreLabelForms: ['punkt', 'punkty', 'punktów'],
      prompt: 'Podejmij osiem decyzji: pewny szlak albo ryzykowny skrót dopasowany do pogody.',
      memento: { id: 'memento-spore-trail-map', label: 'Mapa szlaku zarodników' },
      rewards: {
        sporesPerPoint: 0.06,
        sporesMax: 1
      }
    },
    myceliumLeague: {
      id: 'myceliumLeague',
      label: 'Liga Grzybni',
      durationMs: 39500,
      difficultyProfile: 'cozy',
      interactionKind: 'telegraphedCounter',
      cooldownMs: 2 * 60 * 60000,
      masteryTarget: 20,
      scoreTargetCasual: 14,
      scoreTargetMastery: 20,
      perfectTarget: 30,
      targetCount: 12,
      exchangeCount: 12,
      exchangeLeadMs: 1000,
      exchangeIntervalMs: 3100,
      exchangeWindowMs: 2300,
      exchangePoints: 2,
      guidedExchangeCount: 3,
      counterCycle: {
        strike: 'guard',
        guard: 'focus',
        focus: 'strike'
      },
      requiresStage: 'legendary',
      legendary: true,
      projectPoints: 2,
      seasonPoints: 3,
      scoreLabelForms: ['punkt', 'punkty', 'punktów'],
      prompt: 'Czytaj ruch rywala i kontruj: atak osłoną, osłonę skupieniem, a skupienie atakiem.',
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
      interactionKind: 'previewRecall',
      cooldownMs: 12 * 60 * 60000,
      masteryTarget: 15,
      scoreTargetCasual: 9,
      scoreTargetMastery: 15,
      perfectTarget: 22,
      targetCount: 18,
      gridSize: 3,
      sequenceLengths: [3, 4, 5, 6],
      previewStepMs: 450,
      previewHoldMs: 500,
      hideMs: 500,
      recallPerStepMs: 1200,
      recallGraceMs: 1200,
      roundGapMs: 600,
      requiresStage: 'legendary',
      legendary: true,
      projectPoints: 3,
      seasonPoints: 2,
      scoreLabelForms: ['punkt', 'punkty', 'punktów'],
      prompt: 'Zapamiętaj cztery sekwencje 3/4/5/6 na siatce 3×3, poczekaj aż zgasną i odtwórz je.',
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
