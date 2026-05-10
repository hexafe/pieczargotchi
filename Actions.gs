function getActionDefinitions() {
  return [
    {
      id: 'hydrate',
      label: 'Zroś',
      shortcut: 'N',
      icon: 'H2O',
      cooldownSeconds: 20,
      awakeOnly: true,
      effectType: 'water',
      animationType: 'hydrate',
      stats: { hydration: 22, happiness: 2 },
      log: 'Świeże krople wsiąkły w mech.'
    },
    {
      id: 'feed',
      label: 'Nakarm',
      shortcut: 'A',
      icon: 'NPK',
      cooldownSeconds: 30,
      awakeOnly: true,
      effectType: 'hearts',
      animationType: 'feed',
      stats: { nutrients: 24, cleanliness: -4, growth: 1.5 },
      flag: 'firstFeedDone',
      log: 'Pieczarka chrupnęła porcję dobrego kompostu.'
    },
    {
      id: 'clean',
      label: 'Wyczyść',
      shortcut: 'W',
      icon: 'CZ',
      cooldownSeconds: 25,
      awakeOnly: true,
      effectType: 'clean',
      animationType: 'clean',
      stats: { cleanliness: 28, happiness: 3 },
      log: 'Grządka znowu wygląda schludnie.'
    },
    {
      id: 'play',
      label: 'Pobaw',
      shortcut: 'P',
      icon: 'GRA',
      cooldownSeconds: 40,
      awakeOnly: true,
      effectType: 'hearts',
      animationType: 'play',
      stats: { happiness: 20, energy: -10, cleanliness: -4, growth: 1 },
      log: 'Krótka zabawa rozkołysała kapelusz.'
    },
    {
      id: 'instrument',
      label: 'Muzyka',
      shortcut: 'I',
      icon: 'MUZ',
      cooldownSeconds: 45,
      awakeOnly: true,
      effectType: 'music',
      animationType: 'instrument',
      stats: { happiness: 15, energy: -6, growth: 1 },
      flag: 'firstInstrumentDone',
      log: 'Pieczarka sprawdziła nowy instrument.'
    },
    {
      id: 'sing',
      label: 'Śpiew',
      shortcut: 'S',
      icon: 'ŚP',
      cooldownSeconds: 55,
      awakeOnly: true,
      effectType: 'music',
      animationType: 'sing',
      stats: { happiness: 18, energy: -8, growth: 1.2 },
      flag: 'firstSingDone',
      log: 'Z grządki popłynęła miękka pieczarkowa melodia.'
    },
    {
      id: 'sleepWake',
      label: 'Sen',
      shortcut: 'U',
      icon: 'Zz',
      cooldownSeconds: 8,
      awakeOnly: false,
      effectType: 'wake',
      animationType: 'wake',
      stats: {},
      log: 'Pieczarka zmieniła rytm dnia.'
    },
    {
      id: 'spores',
      label: 'Zarodniki',
      shortcut: 'Z',
      icon: 'ZAR',
      cooldownSeconds: 90,
      awakeOnly: true,
      requiresStage: 'adult',
      effectType: 'spores',
      animationType: 'spores',
      stats: { happiness: 8, energy: -14 },
      coins: 2,
      log: 'Jasna chmurka zarodników uniosła się nad grządką.'
    }
  ];
}
