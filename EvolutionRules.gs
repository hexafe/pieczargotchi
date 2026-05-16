function getEvolutionRulesConfig() {
  return {
    legendaryGrowth: 100,
    variants: {
      dewcap: 'Rosopieczarka',
      compostcap: 'Kompostopieczarka',
      songcap: 'Śpiewopieczarka',
      wildcap: 'Dzika Pieczarka',
      ghostcap: 'Mglista Pieczarka',
      royalcap: 'Królewska Pieczarka'
    },
    traits: {
      dewcap: {
        title: 'Rytm rosy',
        favoriteAction: 'hydrate',
        message: 'Rosopieczarka łapie spokojny rytm wilgoci.'
      },
      compostcap: {
        title: 'Siła podłoża',
        favoriteAction: 'feed',
        message: 'Kompostopieczarka rośnie najpewniej w żyznym mchu.'
      },
      songcap: {
        title: 'Słuch grzybni',
        favoriteAction: 'sing',
        message: 'Śpiewopieczarka niesie ciche nuty między źdźbłami.'
      },
      wildcap: {
        title: 'Dziki podmuch',
        favoriteAction: 'play',
        message: 'Dzika Pieczarka lubi ruch, wiatr i żywą grzybnię.'
      },
      ghostcap: {
        title: 'Mglista cisza',
        favoriteAction: 'sleepWake',
        message: 'Mglista Pieczarka odzyskuje spokój w długim odpoczynku.'
      },
      royalcap: {
        title: 'Królewska równowaga',
        favoriteAction: 'clean',
        message: 'Królewska Pieczarka dobrze znosi równą, cierpliwą opiekę.'
      }
    }
  };
}

function getEvolutionVariant(history, state) {
  const normalizedHistory = history || {};
  const actions = normalizedHistory.actionsPerformed || {};
  const samples = normalizedHistory.statSamples || {};
  const mistakes = state && state.careMistakes ? state.careMistakes : {};
  const sampleCount = Math.max(1, Number(samples.count) || 0);
  const averageHealth = (Number(samples.health) || 0) / sampleCount;
  const patchQuality = state && state.patch ? Number(state.patch.quality) || 0 : 0;
  const physicalMistakes = (Number(mistakes.physical) || 0) + (Number(mistakes.rest) || 0);
  const totalMistakes = Object.keys(mistakes).reduce(function(total, key) {
    return total + (Number(mistakes[key]) || 0);
  }, 0);
  const musicCare = (Number(actions.instrument) || 0) + (Number(actions.sing) || 0);
  const balancedActions = ['hydrate', 'feed', 'clean', 'play', 'instrument', 'sing'].filter(function(actionId) {
    return (Number(actions[actionId]) || 0) >= 2;
  }).length;

  if (physicalMistakes >= 4 || averageHealth < 52) {
    return { variant: 'ghostcap', reason: 'zbyt wiele trudnych chwil zdrowia i odpoczynku' };
  }
  if (totalMistakes <= 1 && balancedActions >= 5 && patchQuality >= 82) {
    return { variant: 'royalcap', reason: 'bardzo równa, spokojna opieka' };
  }
  if ((Number(actions.hydrate) || 0) >= Math.max(3, (Number(actions.feed) || 0) + 2)) {
    return { variant: 'dewcap', reason: 'najsilniejszy rytm opieki wokół rosy i wilgoci' };
  }
  if ((Number(actions.feed) || 0) >= 4 && patchQuality >= 70 && (Number(mistakes.environment) || 0) <= 1) {
    return { variant: 'compostcap', reason: 'dobre podłoże i regularny kompost' };
  }
  if (musicCare >= Math.max(4, (Number(actions.play) || 0) + 2)) {
    return { variant: 'songcap', reason: 'Pieczarka najczęściej rosła przy muzyce' };
  }
  if ((Number(actions.play) || 0) >= 4) {
    return { variant: 'wildcap', reason: 'dużo zabawy i nieregularna energia' };
  }
  return { variant: 'dewcap', reason: 'spokojna domyślna ścieżka wilgoci' };
}
