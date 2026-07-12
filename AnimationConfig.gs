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
    frameDurationsMs: [81, 92, 104, 115, 150, 173, 208, 277],
    loop: true,
    bodyMotion: false,
    stageOverrides: {
      spore: {
        frameDurationsMs: [178, 200, 222, 267, 311, 355, 400, 467],
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
    frameDurationsMs: [88, 95, 103, 115, 126, 159, 206, 308],
    loop: true,
    bodyMotion: false,
    stageOverrides: {
      spore: {
        frameDurationsMs: [163, 185, 217, 250, 293, 347, 424, 521],
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
    frameDurationsMs: [95, 110, 95, 110, 117, 154, 212, 307],
    loop: true,
    bodyMotion: false,
    stageOverrides: {
      spore: {
        frameDurationsMs: [162, 194, 227, 249, 281, 346, 422, 519],
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
    frameDurationsMs: [88, 101, 111, 121, 131, 158, 201, 289],
    loop: true,
    bodyMotion: false,
    stageOverrides: {
      spore: {
        frameDurationsMs: [141, 171, 212, 252, 303, 363, 434, 524],
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
    frameDurationsMs: [102, 118, 127, 135, 126, 142, 182, 268],
    loop: true,
    bodyMotion: false,
    stageOverrides: {
      spore: {
        frameDurationsMs: [166, 187, 218, 249, 291, 353, 416, 520],
        loop: false
      }
    },
    priority: 100
  },
  {
    key: 'activity.instrument_bell',
    activity: 'instrument_bell',
    // Wariant zachowuje osobny klucz odkrycia, ale korzysta ze wspólnego
    // sprite-owned arkusza dopóki nie istnieje prawdziwa, odrębna animacja.
    fileName: 'activities/instrument_sheet.png',
    frameCount: 8,
    frameDurationsMs: [102, 118, 127, 135, 126, 142, 182, 268],
    loop: true,
    bodyMotion: false,
    stageOverrides: {
      spore: {
        frameDurationsMs: [166, 187, 218, 249, 291, 353, 416, 520],
        loop: false
      }
    },
    priority: 100
  },
  {
    key: 'activity.instrument_flute',
    activity: 'instrument_flute',
    fileName: 'activities/instrument_sheet.png',
    frameCount: 8,
    frameDurationsMs: [102, 118, 127, 135, 126, 142, 182, 268],
    loop: true,
    bodyMotion: false,
    stageOverrides: {
      spore: {
        frameDurationsMs: [166, 187, 218, 249, 291, 353, 416, 520],
        loop: false
      }
    },
    priority: 100
  },
  {
    key: 'activity.instrument_drum',
    activity: 'instrument_drum',
    fileName: 'activities/instrument_sheet.png',
    frameCount: 8,
    frameDurationsMs: [102, 118, 127, 135, 126, 142, 182, 268],
    loop: true,
    bodyMotion: false,
    stageOverrides: {
      spore: {
        frameDurationsMs: [166, 187, 218, 249, 291, 353, 416, 520],
        loop: false
      }
    },
    priority: 100
  },
  {
    key: 'activity.instrument_rare',
    activity: 'instrument_rare',
    fileName: 'activities/instrument_sheet.png',
    frameCount: 8,
    frameDurationsMs: [102, 118, 127, 135, 126, 142, 182, 268],
    loop: true,
    bodyMotion: false,
    stageOverrides: {
      spore: {
        frameDurationsMs: [166, 187, 218, 249, 291, 353, 416, 520],
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
    frameDurationsMs: [95, 111, 125, 137, 125, 146, 186, 275],
    loop: true,
    bodyMotion: false,
    stageOverrides: {
      spore: {
        frameDurationsMs: [161, 191, 221, 251, 301, 351, 422, 502],
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
    frameDurationsMs: [78, 91, 112, 134, 147, 164, 198, 276],
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
    frameDurationsMs: [78, 91, 113, 131, 144, 165, 200, 278],
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

const PIECZARGOTCHI_BATTLE_ASSETS = [
  {
    key: 'battle.arena.background',
    kind: 'battleEnvironment',
    fileName: 'battle/arena_background.png',
    width: 512,
    height: 512,
    frames: 1,
    required: false
  },
  {
    key: 'battle.player.legendary',
    kind: 'battleSprite',
    fileName: 'battle/player_legendary_sheet.png',
    width: 1024,
    height: 256,
    frames: 4,
    required: false
  },
  {
    key: 'battle.opponent.sproutling',
    kind: 'battleSprite',
    fileName: 'battle/opponents/sproutling_sheet.png',
    width: 1024,
    height: 256,
    frames: 4,
    required: false
  },
  {
    key: 'battle.opponent.windcap',
    kind: 'battleSprite',
    fileName: 'battle/opponents/windcap_sheet.png',
    width: 1024,
    height: 256,
    frames: 4,
    required: false
  },
  {
    key: 'battle.opponent.eldercap',
    kind: 'battleSprite',
    fileName: 'battle/opponents/eldercap_sheet.png',
    width: 1024,
    height: 256,
    frames: 4,
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

function getRuntimeAssetManifest_() {
  const canvasSize = getPieczargotchiAnimationCanvasSize_();

  return getAnimationManifest().map(function(animation) {
    return {
      key: animation.key,
      fileName: animation.fileName,
      fileId: PIECZARGOTCHI_ASSET_FILE_IDS[animation.key] || '',
      required: animation.required,
      width: animation.frameWidth * animation.storedFrameCount,
      height: animation.frameHeight,
      frames: animation.frameCount,
      frameWidth: animation.frameWidth,
      frameHeight: animation.frameHeight,
      drawX: animation.drawX,
      drawY: animation.drawY,
      storedFrameCount: animation.storedFrameCount,
      frameSequence: animation.frameSequence.slice()
    };
  }).concat(PIECZARGOTCHI_EFFECT_ASSETS.map(function(asset) {
    const layout = getAnimationSpriteLayout_(asset.fileName, canvasSize, 4);
    return {
      key: asset.key,
      kind: 'effect',
      fileName: asset.fileName,
      fileId: PIECZARGOTCHI_ASSET_FILE_IDS[asset.key] || '',
      required: false,
      width: layout.frameWidth * layout.storedFrameCount,
      height: layout.frameHeight,
      frames: 4,
      frameWidth: layout.frameWidth,
      frameHeight: layout.frameHeight,
      drawX: layout.drawX,
      drawY: layout.drawY,
      storedFrameCount: layout.storedFrameCount,
      frameSequence: layout.frameSequence.slice()
    };
  })).concat(PIECZARGOTCHI_ENVIRONMENT_ASSETS.map(function(asset) {
    return Object.assign({}, asset, {
      width: asset.width || canvasSize,
      fileId: PIECZARGOTCHI_ASSET_FILE_IDS[asset.key] || ''
    });
  })).concat(PIECZARGOTCHI_BATTLE_ASSETS.map(function(asset) {
    return Object.assign({}, asset, {
      fileId: PIECZARGOTCHI_ASSET_FILE_IDS[asset.key] || ''
    });
  }));
}

function buildStageAnimationEntry(stage, animation) {
  const canvasSize = getPieczargotchiAnimationCanvasSize_();
  const fileName = 'stages/' + stage + '/' + animation.state + '_sheet.png';
  const layout = getAnimationSpriteLayout_(fileName, canvasSize, animation.frameCount);

  return {
    key: stage + '.' + animation.state,
    kind: 'stage',
    stage: stage,
    state: animation.state,
    need: animation.need || null,
    fileName: fileName,
    frameCount: animation.frameCount,
    frameWidth: layout.frameWidth,
    frameHeight: layout.frameHeight,
    drawX: layout.drawX,
    drawY: layout.drawY,
    pivotX: layout.pivotX,
    pivotY: layout.pivotY,
    bakedGrass: layout.bakedGrass,
    storedFrameCount: layout.storedFrameCount,
    frameSequence: layout.frameSequence.slice(),
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
  const activityFileName = String(animation.fileName || ('activities/' + animation.activity + '_sheet.png'))
    .replace(/^activities\//, '');
  const fileName = 'activities/' + stage + '/' + activityFileName;
  const layout = getAnimationSpriteLayout_(fileName, canvasSize, animation.frameCount);

  return {
    key: stage + '.activity.' + animation.activity,
    kind: 'activity',
    stage: stage,
    activity: animation.activity,
    minStage: animation.minStage || null,
    fileName: fileName,
    frameCount: animation.frameCount,
    frameWidth: layout.frameWidth,
    frameHeight: layout.frameHeight,
    drawX: layout.drawX,
    drawY: layout.drawY,
    pivotX: layout.pivotX,
    pivotY: layout.pivotY,
    bakedGrass: layout.bakedGrass,
    storedFrameCount: layout.storedFrameCount,
    frameSequence: layout.frameSequence.slice(),
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
  const fileName = 'easter-eggs/' + stage + '/' + animation.state + '_sheet.png';
  const layout = getAnimationSpriteLayout_(fileName, canvasSize, animation.frameCount);

  return {
    key: stage + '.easter.' + animation.state,
    kind: 'easterEgg',
    stage: stage,
    state: animation.state,
    fileName: fileName,
    frameCount: animation.frameCount,
    frameWidth: layout.frameWidth,
    frameHeight: layout.frameHeight,
    drawX: layout.drawX,
    drawY: layout.drawY,
    pivotX: layout.pivotX,
    pivotY: layout.pivotY,
    bakedGrass: layout.bakedGrass,
    storedFrameCount: layout.storedFrameCount,
    frameSequence: layout.frameSequence.slice(),
    frameDurationsMs: animation.frameDurationsMs.slice(),
    loop: animation.loop,
    priority: animation.priority,
    required: false
  };
}

function getAnimationSpriteLayout_(fileName, canvasSize, expectedFrameCount) {
  const layouts = typeof PIECZARGOTCHI_SPRITE_LAYOUTS !== 'undefined'
    && PIECZARGOTCHI_SPRITE_LAYOUTS
    && typeof PIECZARGOTCHI_SPRITE_LAYOUTS === 'object'
    ? PIECZARGOTCHI_SPRITE_LAYOUTS
    : {};
  const source = layouts[fileName] || {};
  const frameWidth = Math.max(1, Number(source.frameWidth) || canvasSize);
  const frameHeight = Math.max(1, Number(source.frameHeight) || canvasSize);
  const drawX = Number.isFinite(Number(source.drawX)) ? Number(source.drawX) : 0;
  const drawY = Number.isFinite(Number(source.drawY)) ? Number(source.drawY) : 0;
  const logicalFrameCount = Math.max(1, Number(source.frameCount) || Number(expectedFrameCount) || 1);
  const storedFrameCount = Math.max(1, Number(source.storedFrameCount) || logicalFrameCount);
  const sourceSequence = Array.isArray(source.frameSequence) ? source.frameSequence : [];
  const frameSequence = Array.from({ length: logicalFrameCount }, function(_unused, index) {
    const storedIndex = Number(sourceSequence[index]);
    return Number.isInteger(storedIndex) && storedIndex >= 0 && storedIndex < storedFrameCount
      ? storedIndex
      : Math.min(index, storedFrameCount - 1);
  });
  return {
    frameWidth: frameWidth,
    frameHeight: frameHeight,
    drawX: drawX,
    drawY: drawY,
    pivotX: Number.isFinite(Number(source.pivotX)) ? Number(source.pivotX) : drawX + frameWidth / 2,
    pivotY: Number.isFinite(Number(source.pivotY)) ? Number(source.pivotY) : drawY + frameHeight,
    bakedGrass: typeof source.bakedGrass === 'boolean' ? source.bakedGrass : true,
    storedFrameCount: storedFrameCount,
    frameSequence: frameSequence
  };
}

function getPieczargotchiAnimationCanvasSize_() {
  if (typeof PIECZARGOTCHI_CANVAS_SIZE === 'number' && PIECZARGOTCHI_CANVAS_SIZE > 0) {
    return PIECZARGOTCHI_CANVAS_SIZE;
  }

  return PIECZARGOTCHI_ANIMATION_DEFAULT_CANVAS_SIZE;
}
