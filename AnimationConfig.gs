const PIECZARGOTCHI_ANIMATION_STAGES = ['spore', 'baby', 'young', 'adult', 'legendary'];

const PIECZARGOTCHI_STAGE_ANIMATIONS = [
  {
    state: 'idle',
    frameCount: 4,
    frameDurationsMs: [420, 420, 520, 260],
    loop: true,
    priority: 10
  },
  {
    state: 'sleep',
    frameCount: 4,
    frameDurationsMs: [333, 333, 333, 333],
    loop: true,
    priority: 20
  },
  {
    state: 'wake',
    frameCount: 4,
    frameDurationsMs: [120, 180, 240, 420],
    loop: false,
    priority: 90
  },
  {
    state: 'happy',
    frameCount: 4,
    frameDurationsMs: [120, 120, 180, 360],
    loop: true,
    priority: 35
  },
  {
    state: 'excellent',
    frameCount: 4,
    frameDurationsMs: [160, 180, 220, 360],
    loop: true,
    priority: 40
  },
  {
    state: 'curious',
    frameCount: 4,
    frameDurationsMs: [180, 220, 320, 420],
    loop: true,
    priority: 34
  },
  {
    state: 'sun',
    frameCount: 4,
    frameDurationsMs: [220, 260, 320, 420],
    loop: true,
    priority: 32
  },
  {
    state: 'rain',
    frameCount: 16,
    frameDurationsMs: [260, 220, 180, 150, 130, 120, 115, 110, 105, 105, 110, 130, 160, 210, 280, 340],
    loop: true,
    priority: 36
  },
  {
    state: 'stargaze',
    frameCount: 4,
    frameDurationsMs: [260, 360, 420, 520],
    loop: true,
    priority: 33
  },
  {
    state: 'snow',
    frameCount: 4,
    frameDurationsMs: [240, 320, 380, 440],
    loop: true,
    priority: 37
  },
  {
    state: 'tired',
    frameCount: 4,
    frameDurationsMs: [520, 520, 700, 520],
    loop: true,
    priority: 45
  },
  {
    state: 'dry',
    frameCount: 4,
    frameDurationsMs: [360, 420, 520, 420],
    loop: true,
    priority: 55,
    need: 'hydration'
  },
  {
    state: 'hungry',
    frameCount: 4,
    frameDurationsMs: [360, 420, 520, 420],
    loop: true,
    priority: 55,
    need: 'nutrients'
  },
  {
    state: 'dirty',
    frameCount: 4,
    frameDurationsMs: [360, 420, 520, 420],
    loop: true,
    priority: 55,
    need: 'cleanliness'
  },
  {
    state: 'sick',
    frameCount: 4,
    frameDurationsMs: [420, 420, 520, 420],
    loop: true,
    priority: 60,
    need: 'health'
  },
  {
    state: 'critical',
    frameCount: 4,
    frameDurationsMs: [120, 120, 160, 120],
    loop: true,
    priority: 70
  }
];

const PIECZARGOTCHI_ACTIVITY_ANIMATIONS = [
  {
    key: 'activity.hydrate',
    activity: 'hydrate',
    fileName: 'activities/hydrate_sheet.png',
    frameCount: 4,
    frameDurationsMs: [80, 120, 180, 260],
    loop: false,
    priority: 100
  },
  {
    key: 'activity.feed',
    activity: 'feed',
    fileName: 'activities/feed_sheet.png',
    frameCount: 4,
    frameDurationsMs: [80, 120, 180, 260],
    loop: false,
    priority: 100
  },
  {
    key: 'activity.clean',
    activity: 'clean',
    fileName: 'activities/clean_sheet.png',
    frameCount: 4,
    frameDurationsMs: [80, 120, 180, 260],
    loop: false,
    priority: 100
  },
  {
    key: 'activity.play',
    activity: 'play',
    fileName: 'activities/play_sheet.png',
    frameCount: 4,
    frameDurationsMs: [80, 120, 180, 260],
    loop: false,
    priority: 100
  },
  {
    key: 'activity.instrument',
    activity: 'instrument',
    fileName: 'activities/instrument_sheet.png',
    frameCount: 4,
    frameDurationsMs: [100, 140, 180, 300],
    loop: false,
    priority: 100
  },
  {
    key: 'activity.sing',
    activity: 'sing',
    fileName: 'activities/sing_sheet.png',
    frameCount: 4,
    frameDurationsMs: [100, 140, 180, 300],
    loop: false,
    priority: 100
  },
  {
    key: 'activity.spores',
    activity: 'spores',
    fileName: 'activities/spores_sheet.png',
    frameCount: 4,
    frameDurationsMs: [100, 160, 220, 360],
    loop: false,
    priority: 100,
    minStage: 'adult'
  },
  {
    key: 'activity.harvest',
    activity: 'harvest',
    fileName: 'activities/harvest_sheet.png',
    frameCount: 4,
    frameDurationsMs: [100, 160, 220, 360],
    loop: false,
    priority: 100
  }
];

const PIECZARGOTCHI_EASTER_EGG_ANIMATIONS = [
  {
    state: 'neutral',
    frameCount: 4,
    frameDurationsMs: [420, 420, 520, 260],
    loop: true,
    priority: 42
  },
  {
    state: 'neutral_rain',
    frameCount: 4,
    frameDurationsMs: [420, 420, 520, 260],
    loop: true,
    priority: 43
  }
];

const PIECZARGOTCHI_ENVIRONMENT_ASSETS = [
  {
    key: 'environment.grassPatch',
    kind: 'environment',
    fileName: 'environment/grass_patch.png',
    width: PIECZARGOTCHI_CANVAS_SIZE,
    height: 158,
    frames: 1,
    required: false
  }
];

const PIECZARGOTCHI_EFFECT_ASSETS = [
  {
    key: 'effect.drops',
    fileName: 'effects/drops_sheet.png'
  },
  {
    key: 'effect.sparkle',
    fileName: 'effects/sparkle_sheet.png'
  },
  {
    key: 'effect.dust',
    fileName: 'effects/dust_sheet.png'
  },
  {
    key: 'effect.notes',
    fileName: 'effects/notes_sheet.png'
  },
  {
    key: 'effect.sporeCloud',
    fileName: 'effects/spore_cloud_sheet.png'
  }
];

function getAnimationManifest() {
  const entries = [];

  PIECZARGOTCHI_ANIMATION_STAGES.forEach(function(stage) {
    PIECZARGOTCHI_STAGE_ANIMATIONS.forEach(function(animation) {
      entries.push(buildStageAnimationEntry(stage, animation));
    });
  });

  PIECZARGOTCHI_ANIMATION_STAGES.forEach(function(stage) {
    PIECZARGOTCHI_ACTIVITY_ANIMATIONS.forEach(function(animation) {
      entries.push(buildActivityAnimationEntry(stage, animation));
    });
  });

  PIECZARGOTCHI_ANIMATION_STAGES.forEach(function(stage) {
    PIECZARGOTCHI_EASTER_EGG_ANIMATIONS.forEach(function(animation) {
      entries.push(buildEasterEggAnimationEntry(stage, animation));
    });
  });

  return entries;
}

function getRuntimeAssetManifest() {
  return getAnimationManifest().map(function(animation) {
    return {
      key: animation.key,
      fileName: animation.fileName,
      fileId: PIECZARGOTCHI_ASSET_FILE_IDS[animation.key] || '',
      required: animation.required,
      width: animation.frameWidth * animation.frameCount,
      height: animation.frameHeight,
      frames: animation.frameCount
    };
  }).concat(PIECZARGOTCHI_EFFECT_ASSETS.map(function(asset) {
    return {
      key: asset.key,
      kind: 'effect',
      fileName: asset.fileName,
      fileId: PIECZARGOTCHI_ASSET_FILE_IDS[asset.key] || '',
      required: false,
      width: PIECZARGOTCHI_CANVAS_SIZE * 4,
      height: PIECZARGOTCHI_CANVAS_SIZE,
      frames: 4
    };
  })).concat(PIECZARGOTCHI_ENVIRONMENT_ASSETS.map(function(asset) {
    return Object.assign({}, asset, {
      fileId: PIECZARGOTCHI_ASSET_FILE_IDS[asset.key] || ''
    });
  }));
}

function buildStageAnimationEntry(stage, animation) {
  return {
    key: stage + '.' + animation.state,
    kind: 'stage',
    stage: stage,
    state: animation.state,
    need: animation.need || null,
    fileName: 'stages/' + stage + '/' + animation.state + '_sheet.png',
    frameCount: animation.frameCount,
    frameWidth: PIECZARGOTCHI_CANVAS_SIZE,
    frameHeight: PIECZARGOTCHI_CANVAS_SIZE,
    frameDurationsMs: animation.frameDurationsMs.slice(),
    loop: animation.loop,
    priority: animation.priority,
    required: stage === 'spore' && (animation.state === 'idle' || animation.state === 'sleep' || animation.state === 'wake')
  };
}

function buildActivityAnimationEntry(stage, animation) {
  return {
    key: stage + '.activity.' + animation.activity,
    kind: 'activity',
    stage: stage,
    activity: animation.activity,
    minStage: null,
    fileName: 'activities/' + stage + '/' + animation.activity + '_sheet.png',
    frameCount: animation.frameCount,
    frameWidth: PIECZARGOTCHI_CANVAS_SIZE,
    frameHeight: PIECZARGOTCHI_CANVAS_SIZE,
    frameDurationsMs: animation.frameDurationsMs.slice(),
    loop: animation.loop,
    priority: animation.priority,
    required: false
  };
}

function buildEasterEggAnimationEntry(stage, animation) {
  return {
    key: stage + '.easter.' + animation.state,
    kind: 'easterEgg',
    stage: stage,
    state: animation.state,
    fileName: 'easter-eggs/' + stage + '/' + animation.state + '_sheet.png',
    frameCount: animation.frameCount,
    frameWidth: PIECZARGOTCHI_CANVAS_SIZE,
    frameHeight: PIECZARGOTCHI_CANVAS_SIZE,
    frameDurationsMs: animation.frameDurationsMs.slice(),
    loop: animation.loop,
    priority: animation.priority,
    required: false
  };
}
