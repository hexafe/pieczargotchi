const PIECZARGOTCHI_ANIMATION_STAGES = ['spore', 'baby', 'young', 'adult', 'legendary'];
const PIECZARGOTCHI_ANIMATION_DEFAULT_CANVAS_SIZE = 512;

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
    state: 'idle_fidget',
    frameCount: 8,
    frameDurationsMs: [260, 220, 180, 160, 200, 240, 320, 420],
    loop: false,
    priority: 31
  },
  {
    state: 'idle_fidget_sway',
    frameCount: 8,
    frameDurationsMs: [280, 220, 180, 160, 190, 240, 320, 460],
    loop: false,
    priority: 31
  },
  {
    state: 'idle_fidget_shift',
    frameCount: 8,
    frameDurationsMs: [240, 200, 180, 180, 220, 260, 320, 440],
    loop: false,
    priority: 31
  },
  {
    state: 'idle_look_left',
    frameCount: 8,
    frameDurationsMs: [260, 240, 220, 220, 260, 300, 360, 460],
    loop: false,
    priority: 31
  },
  {
    state: 'idle_look_right',
    frameCount: 8,
    frameDurationsMs: [260, 240, 220, 220, 260, 300, 360, 460],
    loop: false,
    priority: 31
  },
  {
    state: 'ponder',
    frameCount: 10,
    frameDurationsMs: [260, 220, 190, 180, 180, 220, 260, 300, 340, 420],
    loop: false,
    priority: 32
  },
  {
    state: 'ponder_up',
    frameCount: 10,
    frameDurationsMs: [280, 240, 200, 180, 180, 220, 260, 300, 360, 460],
    loop: false,
    priority: 32
  },
  {
    state: 'ponder_side',
    frameCount: 10,
    frameDurationsMs: [260, 220, 200, 190, 190, 230, 280, 320, 360, 440],
    loop: false,
    priority: 32
  },
  {
    state: 'ponder_breath',
    frameCount: 10,
    frameDurationsMs: [300, 260, 220, 200, 200, 240, 280, 340, 400, 500],
    loop: false,
    priority: 32
  },
  {
    state: 'watch_cursor_left',
    frameCount: 8,
    frameDurationsMs: [120, 120, 140, 160, 190, 230, 280, 340],
    loop: false,
    priority: 58
  },
  {
    state: 'watch_cursor_right',
    frameCount: 8,
    frameDurationsMs: [120, 120, 140, 160, 190, 230, 280, 340],
    loop: false,
    priority: 58
  },
  {
    state: 'watch_cursor_up_left',
    frameCount: 8,
    frameDurationsMs: [130, 120, 140, 160, 200, 240, 300, 360],
    loop: false,
    priority: 58
  },
  {
    state: 'watch_cursor_up_right',
    frameCount: 8,
    frameDurationsMs: [130, 120, 140, 160, 200, 240, 300, 360],
    loop: false,
    priority: 58
  },
  {
    state: 'follow_cursor_fast',
    frameCount: 8,
    frameDurationsMs: [90, 90, 110, 130, 160, 210, 280, 360],
    loop: false,
    priority: 59
  },
  {
    state: 'follow_cursor_after',
    frameCount: 8,
    frameDurationsMs: [160, 160, 180, 200, 240, 300, 360, 440],
    loop: false,
    priority: 57
  },
  {
    state: 'watch_butterfly',
    frameCount: 10,
    frameDurationsMs: [160, 150, 140, 140, 160, 190, 220, 260, 300, 360],
    loop: false,
    priority: 57
  },
  {
    state: 'watch_firefly',
    frameCount: 12,
    frameDurationsMs: [180, 160, 140, 130, 130, 150, 170, 190, 220, 260, 320, 420],
    loop: false,
    priority: 56
  },
  {
    state: 'watch_crawler',
    frameCount: 10,
    frameDurationsMs: [170, 150, 150, 160, 180, 210, 240, 280, 320, 380],
    loop: false,
    priority: 55
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
    frameCount: 8,
    frameDurationsMs: [70, 80, 90, 100, 130, 150, 180, 240],
    loop: true,
    bodyMotion: false,
    stageOverrides: {
      spore: {
        frameDurationsMs: [160, 180, 200, 240, 280, 320, 360, 420],
        loop: false
      }
    },
    priority: 100
  },
  {
    key: 'activity.feed',
    activity: 'feed',
    fileName: 'activities/feed_sheet.png',
    frameCount: 8,
    frameDurationsMs: [60, 65, 70, 78, 86, 108, 140, 210],
    loop: true,
    bodyMotion: false,
    stageOverrides: {
      spore: {
        frameDurationsMs: [150, 170, 200, 230, 270, 320, 390, 480],
        loop: false
      }
    },
    priority: 100
  },
  {
    key: 'activity.clean',
    activity: 'clean',
    fileName: 'activities/clean_sheet.png',
    frameCount: 8,
    frameDurationsMs: [65, 75, 65, 75, 80, 105, 145, 210],
    loop: true,
    bodyMotion: false,
    stageOverrides: {
      spore: {
        frameDurationsMs: [150, 180, 210, 230, 260, 320, 390, 480],
        loop: false
      }
    },
    priority: 100
  },
  {
    key: 'activity.play',
    activity: 'play',
    fileName: 'activities/play_sheet.png',
    frameCount: 8,
    frameDurationsMs: [70, 80, 88, 96, 104, 126, 160, 230],
    loop: true,
    bodyMotion: false,
    stageOverrides: {
      spore: {
        frameDurationsMs: [140, 170, 210, 250, 300, 360, 430, 520],
        loop: false
      }
    },
    priority: 100
  },
  {
    key: 'activity.instrument',
    activity: 'instrument',
    fileName: 'activities/instrument_sheet.png',
    frameCount: 8,
    frameDurationsMs: [95, 110, 118, 126, 118, 132, 170, 250],
    loop: true,
    bodyMotion: false,
    stageOverrides: {
      spore: {
        frameDurationsMs: [160, 180, 210, 240, 280, 340, 400, 500],
        loop: false
      }
    },
    priority: 100
  },
  {
    key: 'activity.instrument_bell',
    activity: 'instrument_bell',
    fileName: 'activities/instrument_bell_sheet.png',
    frameCount: 8,
    frameDurationsMs: [95, 110, 118, 126, 118, 132, 170, 250],
    loop: true,
    bodyMotion: false,
    stageOverrides: {
      spore: {
        frameDurationsMs: [160, 180, 210, 240, 280, 340, 400, 500],
        loop: false
      }
    },
    priority: 100
  },
  {
    key: 'activity.instrument_flute',
    activity: 'instrument_flute',
    fileName: 'activities/instrument_flute_sheet.png',
    frameCount: 8,
    frameDurationsMs: [95, 110, 118, 126, 118, 132, 170, 250],
    loop: true,
    bodyMotion: false,
    stageOverrides: {
      spore: {
        frameDurationsMs: [160, 180, 210, 240, 280, 340, 400, 500],
        loop: false
      }
    },
    priority: 100
  },
  {
    key: 'activity.instrument_drum',
    activity: 'instrument_drum',
    fileName: 'activities/instrument_drum_sheet.png',
    frameCount: 8,
    frameDurationsMs: [95, 110, 118, 126, 118, 132, 170, 250],
    loop: true,
    bodyMotion: false,
    stageOverrides: {
      spore: {
        frameDurationsMs: [160, 180, 210, 240, 280, 340, 400, 500],
        loop: false
      }
    },
    priority: 100
  },
  {
    key: 'activity.instrument_rare',
    activity: 'instrument_rare',
    fileName: 'activities/instrument_rare_sheet.png',
    frameCount: 8,
    frameDurationsMs: [95, 110, 118, 126, 118, 132, 170, 250],
    loop: true,
    bodyMotion: false,
    stageOverrides: {
      spore: {
        frameDurationsMs: [160, 180, 210, 240, 280, 340, 400, 500],
        loop: false
      }
    },
    priority: 100
  },
  {
    key: 'activity.sing',
    activity: 'sing',
    fileName: 'activities/sing_sheet.png',
    frameCount: 8,
    frameDurationsMs: [90, 105, 118, 130, 118, 138, 176, 260],
    loop: true,
    bodyMotion: false,
    stageOverrides: {
      spore: {
        frameDurationsMs: [160, 190, 220, 250, 300, 350, 420, 500],
        loop: false
      }
    },
    priority: 100
  },
  {
    key: 'activity.spores',
    activity: 'spores',
    fileName: 'activities/spores_sheet.png',
    frameCount: 8,
    frameDurationsMs: [90, 105, 130, 155, 170, 190, 230, 320],
    loop: true,
    bodyMotion: false,
    stageOverrides: {
      spore: {
        frameDurationsMs: [150, 180, 220, 270, 330, 400, 480, 370],
        loop: false
      }
    },
    priority: 100,
    minStage: 'adult'
  },
  {
    key: 'activity.harvest',
    activity: 'harvest',
    fileName: 'activities/harvest_sheet.png',
    frameCount: 8,
    frameDurationsMs: [90, 105, 130, 150, 165, 190, 230, 320],
    loop: true,
    bodyMotion: false,
    stageOverrides: {
      spore: {
        frameDurationsMs: [150, 180, 220, 260, 320, 390, 470, 410],
        loop: false
      }
    },
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
  const canvasSize = getPieczargotchiAnimationCanvasSize_();

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
      width: canvasSize * 4,
      height: canvasSize,
      frames: 4
    };
  })).concat(PIECZARGOTCHI_ENVIRONMENT_ASSETS.map(function(asset) {
    return Object.assign({}, asset, {
      width: asset.width || canvasSize,
      fileId: PIECZARGOTCHI_ASSET_FILE_IDS[asset.key] || ''
    });
  }));
}

function buildStageAnimationEntry(stage, animation) {
  const canvasSize = getPieczargotchiAnimationCanvasSize_();

  return {
    key: stage + '.' + animation.state,
    kind: 'stage',
    stage: stage,
    state: animation.state,
    need: animation.need || null,
    fileName: 'stages/' + stage + '/' + animation.state + '_sheet.png',
    frameCount: animation.frameCount,
    frameWidth: canvasSize,
    frameHeight: canvasSize,
    frameDurationsMs: animation.frameDurationsMs.slice(),
    loop: animation.loop,
    priority: animation.priority,
    required: stage === 'spore' && (animation.state === 'idle' || animation.state === 'sleep' || animation.state === 'wake')
  };
}

function buildActivityAnimationEntry(stage, animation) {
  const canvasSize = getPieczargotchiAnimationCanvasSize_();
  const stageOverride = getActivityStageOverride_(stage, animation);
  const frameDurationsMs = stageOverride.frameDurationsMs || animation.frameDurationsMs;
  const loop = typeof stageOverride.loop === 'boolean' ? stageOverride.loop : animation.loop;

  return {
    key: stage + '.activity.' + animation.activity,
    kind: 'activity',
    stage: stage,
    activity: animation.activity,
    minStage: animation.minStage || null,
    fileName: 'activities/' + stage + '/' + animation.activity + '_sheet.png',
    frameCount: animation.frameCount,
    frameWidth: canvasSize,
    frameHeight: canvasSize,
    frameDurationsMs: frameDurationsMs.slice(),
    loop: loop,
    bodyMotion: animation.bodyMotion !== false,
    priority: animation.priority,
    required: false
  };
}

function getActivityStageOverride_(stage, animation) {
  if (!animation.stageOverrides || !animation.stageOverrides[stage]) {
    return {};
  }

  return animation.stageOverrides[stage];
}

function buildEasterEggAnimationEntry(stage, animation) {
  const canvasSize = getPieczargotchiAnimationCanvasSize_();

  return {
    key: stage + '.easter.' + animation.state,
    kind: 'easterEgg',
    stage: stage,
    state: animation.state,
    fileName: 'easter-eggs/' + stage + '/' + animation.state + '_sheet.png',
    frameCount: animation.frameCount,
    frameWidth: canvasSize,
    frameHeight: canvasSize,
    frameDurationsMs: animation.frameDurationsMs.slice(),
    loop: animation.loop,
    priority: animation.priority,
    required: false
  };
}

function getPieczargotchiAnimationCanvasSize_() {
  if (typeof PIECZARGOTCHI_CANVAS_SIZE === 'number' && PIECZARGOTCHI_CANVAS_SIZE > 0) {
    return PIECZARGOTCHI_CANVAS_SIZE;
  }

  return PIECZARGOTCHI_ANIMATION_DEFAULT_CANVAS_SIZE;
}
