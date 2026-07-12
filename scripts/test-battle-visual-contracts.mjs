import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const battleRendererSource = readFileSync(path.join(rootDir, 'ClientBattleScene.html'), 'utf8');
const battleSheets = [
  {
    key: 'battle.player.legendary',
    fileName: 'battle/player_legendary_sheet.png',
    visualId: 'playerLegendary'
  },
  {
    key: 'battle.opponent.sproutling',
    fileName: 'battle/opponents/sproutling_sheet.png',
    visualId: 'sproutling'
  },
  {
    key: 'battle.opponent.windcap',
    fileName: 'battle/opponents/windcap_sheet.png',
    visualId: 'windcap'
  },
  {
    key: 'battle.opponent.eldercap',
    fileName: 'battle/opponents/eldercap_sheet.png',
    visualId: 'eldercap'
  }
];
const arenaAsset = {
  key: 'battle.arena.background',
  fileName: 'battle/arena_background.png'
};
const tests = [];

test('battle sheets are clean RGBA body-only four-frame atlases', () => {
  battleSheets.forEach((asset) => {
    const image = decodeRgbaPng(path.join(rootDir, 'assets', asset.fileName));
    assert(image.width === 1024 && image.height === 256, `${asset.fileName} must be 1024x256`);
    assert(image.bitDepth === 8 && image.colorType === 6, `${asset.fileName} must be 8-bit RGBA`);

    for (let offset = 0; offset < image.pixels.length; offset += 4) {
      const alpha = image.pixels[offset + 3];
      if (alpha === 0) {
        assert(
          image.pixels[offset] === 0 && image.pixels[offset + 1] === 0 && image.pixels[offset + 2] === 0,
          `${asset.fileName} contains color data under alpha=0`
        );
      }
    }

    for (let frame = 0; frame < 4; frame += 1) {
      const stats = inspectBattleFrame(image, frame);
      assert(stats.opaqueCount >= 3000, `${asset.fileName} frame ${frame + 1} has no real character content`);
      assert(stats.transparentCount >= 3000, `${asset.fileName} frame ${frame + 1} is not a body-only cutout`);
      assert(stats.bottomPadding >= 11, `${asset.fileName} frame ${frame + 1} reaches the sheet edge like baked ground`);
      assert(
        stats.lowerGrassLikeCount === 0,
        `${asset.fileName} frame ${frame + 1} contains ${stats.lowerGrassLikeCount} grass-like pixels in its lower band`
      );
    }
  });
});

test('arena background is a single 512x512 RGBA fighting plane', () => {
  const image = decodeRgbaPng(path.join(rootDir, 'assets', arenaAsset.fileName));
  assert(image.width === 512 && image.height === 512, `${arenaAsset.fileName} must be 512x512`);
  assert(image.bitDepth === 8 && image.colorType === 6, `${arenaAsset.fileName} must be 8-bit RGBA`);
});

test('runtime manifest exposes every battle asset with its real dimensions', () => {
  const context = { console, Object };
  vm.createContext(context);
  runFilesInContext(context, ['Config.gs', 'SpriteLayout.gs', 'AnimationConfig.gs']);
  const manifest = context.getRuntimeAssetManifest_();
  const byKey = new Map(Array.from(manifest, (asset) => [asset.key, asset]));

  battleSheets.forEach((asset) => {
    const entry = byKey.get(asset.key);
    assert(entry, `runtime manifest is missing ${asset.key}`);
    assert(entry.fileName === asset.fileName, `${asset.key} must resolve to ${asset.fileName}`);
    assert(entry.width === 1024 && entry.height === 256 && entry.frames === 4, `${asset.key} has a stale sheet contract`);
  });

  const arena = byKey.get(arenaAsset.key);
  assert(arena, `runtime manifest is missing ${arenaAsset.key}`);
  assert(arena.fileName === arenaAsset.fileName, `${arenaAsset.key} must resolve to ${arenaAsset.fileName}`);
  assert(arena.width === 512 && arena.height === 512 && arena.frames === 1, `${arenaAsset.key} has a stale image contract`);
});

test('three configured opponent visualIds survive creation and save normalization', () => {
  const rules = loadGameRules();
  const core = loadClientCore();
  const catalog = Array.from(rules.battle.opponentCatalog || []);
  const visualIds = catalog.map((opponent) => opponent.visualId);
  assert(visualIds.length === 3, `expected three arena opponents, got ${visualIds.length}`);
  assert(new Set(visualIds).size === visualIds.length, `opponent visualIds must be unique: ${visualIds.join(', ')}`);
  assert(
    visualIds.join(',') === 'sproutling,windcap,eldercap',
    `opponent visualId order changed without a matching renderer contract: ${visualIds.join(', ')}`
  );

  visualIds.forEach((expectedVisualId, trophies) => {
    const now = Date.parse('2026-07-11T08:00:00.000Z') + trophies;
    const state = createLegendaryBattleState(core, trophies);
    const started = core.startBattle(state, rules, now, 4100 + trophies);
    assert(started.ok, `battle ${trophies + 1} should start: ${started.reason || 'unknown error'}`);
    assert(
      started.battle.opponent.visualId === expectedVisualId,
      `GameRules -> createBattleOpponent lost ${expectedVisualId}`
    );

    const normalized = core.normalizeBattleState(started.state.battle, now);
    assert(normalized.activeBattle, `${expectedVisualId} battle should survive active-session normalization`);
    assert(
      normalized.activeBattle.opponent.visualId === expectedVisualId,
      `active battle normalization lost ${expectedVisualId}`
    );
  });
});

test('battle renderer maps visualIds, poses, and warmup keys deterministically', async () => {
  const loadedKeys = [];
  const context = {
    console,
    runtime: {
      assets: {},
      battleAssetWarmup: null,
      state: { battle: { activeBattle: null } }
    },
    ensureAssetLoaded(key) {
      loadedKeys.push(key);
      return Promise.resolve(key);
    }
  };
  vm.createContext(context);
  runFilesInContext(context, ['ClientBattleScene.html']);

  battleSheets.forEach((asset) => {
    assert(
      context.getBattleSpriteAssetKey(asset.visualId) === asset.key,
      `${asset.visualId} must map to ${asset.key}`
    );
  });
  assert(context.getBattleSpriteAssetKey('legendary') === 'battle.player.legendary', 'legacy legendary player alias must stay supported');

  const poses = ['idle', 'attack', 'guard', 'hurt'];
  poses.forEach((pose, index) => {
    assert(context.getBattlePoseFrameIndex(pose) === index, `${pose} must use frame ${index}`);
  });
  assert(context.getBattlePoseFrameIndex('unknown') === 0, 'unknown battle poses must safely fall back to idle');
  assert(context.getBattlePose({ events: [] }, 'player') === 'idle', 'empty event list must select idle');
  assert(context.getBattlePose({ events: [{ actor: 'player', type: 'hit' }] }, 'player') === 'attack', 'outgoing hit must select attack');
  assert(context.getBattlePose({ events: [{ actor: 'player', type: 'guard' }] }, 'player') === 'guard', 'guard event must select guard');
  assert(context.getBattlePose({ events: [{ actor: 'opponent', type: 'hit' }] }, 'player') === 'hurt', 'incoming hit must select hurt');

  await context.warmUpBattleAssets();
  const expectedKeys = [arenaAsset.key].concat(battleSheets.map((asset) => asset.key));
  assert(
    loadedKeys.join(',') === expectedKeys.join(','),
    `battle warmup must preload all assets exactly once; got ${loadedKeys.join(', ')}`
  );

  const active = {
    turn: 3,
    mode: 'choosingMove',
    events: [
      { actor: 'player', type: 'hit', moveId: 'sporeJab', damage: 9 },
      { actor: 'opponent', type: 'hit', moveId: 'capGuard', damage: 6 }
    ]
  };
  let presentation = context.getBattlePresentation(active, 1000);
  assert(presentation.phase === 'attack' && presentation.playerPose === 'attack', 'round presentation should start with the first actor attack');
  presentation = context.getBattlePresentation(active, 1200);
  assert(presentation.phase === 'impact' && presentation.opponentPose === 'hurt', 'hit should advance to an explicit impact phase');
  presentation = context.getBattlePresentation(active, 1360);
  assert(presentation.phase === 'hurt' && presentation.opponentPose === 'hurt', 'impact should settle into a readable hurt pose');
  presentation = context.getBattlePresentation(active, 1600);
  assert(presentation.phase === 'idle' && presentation.playerPose === 'idle' && presentation.opponentPose === 'idle', 'each event should return both fighters to idle');
  presentation = context.getBattlePresentation(active, 1720);
  assert(presentation.phase === 'attack' && presentation.opponentPose === 'attack', 'second event should animate independently after the first returns');

  const nextTurn = Object.assign({}, active, { turn: 4, events: [{ actor: 'player', type: 'hit', moveId: 'sporeJab', damage: 7 }] });
  presentation = context.getBattlePresentation(nextTurn, 2100);
  assert(presentation.phase === 'attack' && presentation.startedAt === 2100, 'new turn signature should restart the runtime-only presentation timeline');
  presentation = context.getBattlePresentation(nextTurn, 2300);
  assert(presentation.phase === 'impact' && presentation.opponentPose === 'hurt', 'newest turn should reach impact without replaying prior-turn events');
  presentation = context.getBattlePresentation(nextTurn, 2460);
  assert(presentation.phase === 'hurt' && presentation.opponentPose === 'hurt', 'newest turn should expose its own hurt beat');
  presentation = context.getBattlePresentation(nextTurn, 2700);
  assert(presentation.phase === 'idle' && presentation.playerPose === 'idle' && presentation.opponentPose === 'idle', 'newest turn should settle back to idle');
});

test('battle canvas owns only arena art and presentation, never tiny text HUD', () => {
  assert(!battleRendererSource.includes('fillText('), 'battle renderer must not paint turn or status text into the downscaled canvas');
  assert(!battleRendererSource.includes('drawBattleBars('), 'HP and stamina bars belong to the responsive DOM HUD');
  assert(!battleRendererSource.includes('drawBattleTurnMarker('), 'turn summary belongs to the responsive DOM HUD');
});

test('mobile dock returns to flow when every fixed candidate collides', () => {
  const context = {
    console,
    runtime: { actionButtons: null },
    actions: Array.from({ length: 6 }, () => ({}))
  };
  vm.createContext(context);
  runFilesInContext(context, ['ClientUi.html']);

  const viewport = { left: 0, top: 0, right: 390, bottom: 844, width: 390, height: 844 };
  const canvasRect = { left: 57, top: 128, right: 333, bottom: 404, width: 276, height: 276 };
  const baseLayout = {
    viewport,
    canvasRect,
    stageRect: canvasRect,
    sideRect: null,
    statusRect: null,
    minigamesRect: null
  };
  const bottom = context.getAdaptiveActionDockCandidate('bottom', baseLayout);
  const top = context.getAdaptiveActionDockCandidate('top', baseLayout);
  const blockedLayout = {
    ...baseLayout,
    statusRect: { ...top },
    minigamesRect: { ...bottom }
  };

  assert(!context.isAdaptiveActionDockCandidateUsable(bottom, blockedLayout), 'bottom candidate should be rejected on collision');
  assert(!context.isAdaptiveActionDockCandidateUsable(top, blockedLayout), 'top candidate should be rejected on collision');
  assert(
    context.selectAdaptiveActionDockCandidate(blockedLayout) === null,
    'mobile dock must return to document flow instead of forcing a colliding fallback'
  );
});

test('every canvas minigame loop uses the reduced-motion scheduler', () => {
  const loopFiles = [
    'ClientMinigameDewCatch.html',
    'ClientMinigameSporePop.html',
    'ClientMinigameCompostSort.html',
    'ClientMinigameRhythmHum.html',
    'ClientLegendaryGames.html'
  ];

  loopFiles.forEach((fileName) => {
    const source = readFileSync(path.join(rootDir, fileName), 'utf8');
    const renderFunctions = Array.from(source.matchAll(/function\s+(render[A-Za-z0-9]+Frame)\s*\(/g), (match) => match[1]);
    assert(renderFunctions.length === 1, `${fileName} should expose exactly one canvas render loop`);
    const renderName = renderFunctions[0];
    const scheduledCall = new RegExp(
      `runtime\\.minigame\\.animationFrame\\s*=\\s*scheduleMinigameAnimationFrame\\(\\s*${renderName}\\s*\\)`
    );
    assert(scheduledCall.test(source), `${fileName} must schedule ${renderName} through reduced-motion pacing`);
  });

  const scheduledCallbacks = [];
  const timers = [];
  const context = {
    console,
    runtime: { minigame: {}, reducedMotion: false },
    window: {
      requestAnimationFrame(callback) {
        scheduledCallbacks.push(callback);
        return 41 + scheduledCallbacks.length;
      },
      setTimeout(callback, delay) {
        timers.push({ callback, delay });
        return 91 + timers.length;
      }
    }
  };
  vm.createContext(context);
  runFilesInContext(context, ['ClientMinigameDewCatch.html']);
  const callback = function callback() {};

  const ordinaryFrame = context.scheduleMinigameAnimationFrame(callback);
  assert(ordinaryFrame === 42 && scheduledCallbacks.length === 1, 'ordinary motion should remain requestAnimationFrame-driven');

  context.runtime.reducedMotion = true;
  const reducedFrame = context.scheduleMinigameAnimationFrame(callback);
  assert(reducedFrame === 0, 'reduced motion should not schedule an immediate animation frame');
  assert(timers.length === 1 && timers[0].delay >= 64, 'reduced motion should pace minigame frames with a visible delay');
  assert(context.runtime.minigame.animationTimer === 92, 'reduced-motion timer handle must remain cancellable');
  timers[0].callback();
  assert(scheduledCallbacks.length === 2, 'reduced-motion timer should eventually request one animation frame');
});

const failures = [];
for (const { name, callback } of tests) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    console.error(`  ${error.message}`);
    failures.push({ name, error });
  }
}

if (failures.length) {
  throw new Error(`${failures.length} battle visual contract test(s) failed`);
}

function test(name, callback) {
  tests.push({ name, callback });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function loadClientCore() {
  const script = renderTemplate('ClientCore.html')
    .replace(/^<script>\s*/, '')
    .replace(/\s*<\/script>\s*$/, '');
  const context = { globalThis: {} };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(script, context, { filename: 'ClientCore.html' });
  assert(context.PieczargotchiCore, 'ClientCore.html must expose PieczargotchiCore');
  return context.PieczargotchiCore;
}

function loadGameRules() {
  const context = { console, Object };
  vm.createContext(context);
  runFilesInContext(context, [
    'Config.gs',
    'MinigamesConfig.gs',
    'LegendaryGamesConfig.gs',
    'EvolutionRules.gs',
    'DecorationStore.gs',
    'GameRules.gs'
  ]);
  return context.getGameRulesConfig();
}

function createLegendaryBattleState(core, trophies) {
  const battle = core.createDefaultBattleState();
  battle.rewards.trophies = trophies;
  return {
    stage: 'legendary',
    mushroomName: 'Testowa Pieczarka',
    flags: { nameConfirmed: true },
    stats: {
      hydration: 80,
      nutrients: 80,
      energy: 80,
      happiness: 80,
      cleanliness: 80,
      health: 100,
      growth: 100
    },
    inventory: { spores: 5 },
    coins: 5,
    minigames: { active: null },
    battle
  };
}

function renderTemplate(fileName) {
  const content = readFileSync(path.join(rootDir, fileName), 'utf8');
  return content.replace(/<\?!=\s*include\('([^']+)'\);\s*\?>/g, (_match, partialName) => {
    return renderTemplate(partialName + '.html');
  });
}

function runFilesInContext(context, fileNames) {
  fileNames.forEach((fileName) => {
    vm.runInContext(readFileSync(path.join(rootDir, fileName), 'utf8'), context, { filename: fileName });
  });
}

function inspectBattleFrame(image, frameIndex) {
  const frameLeft = frameIndex * 256;
  let opaqueCount = 0;
  let transparentCount = 0;
  let lowerGrassLikeCount = 0;
  let maximumOpaqueY = -1;

  for (let y = 0; y < 256; y += 1) {
    for (let x = 0; x < 256; x += 1) {
      const offset = (y * image.width + frameLeft + x) * 4;
      const red = image.pixels[offset];
      const green = image.pixels[offset + 1];
      const blue = image.pixels[offset + 2];
      const alpha = image.pixels[offset + 3];
      if (alpha > 8) {
        opaqueCount += 1;
        maximumOpaqueY = Math.max(maximumOpaqueY, y);
        if (y >= 216 && green >= 48 && green > red * 1.15 && green > blue * 1.08) {
          lowerGrassLikeCount += 1;
        }
      } else {
        transparentCount += 1;
      }
    }
  }

  return {
    opaqueCount,
    transparentCount,
    lowerGrassLikeCount,
    bottomPadding: maximumOpaqueY >= 0 ? 255 - maximumOpaqueY : 256
  };
}

function decodeRgbaPng(filePath) {
  const buffer = readFileSync(filePath);
  assert(buffer.subarray(0, 8).toString('hex') === '89504e470d0a1a0a', `${filePath} is not a PNG`);
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }

  assert(width > 0 && height > 0, `${filePath} has no valid IHDR`);
  assert(bitDepth === 8 && colorType === 6, `${filePath} must use 8-bit RGBA pixels`);
  assert(interlace === 0, `${filePath} must use deterministic non-interlaced rows`);
  const inflated = inflateSync(Buffer.concat(idat));
  const bytesPerPixel = 4;
  const rowLength = width * bytesPerPixel;
  const pixels = Buffer.alloc(width * height * bytesPerPixel);
  let inputOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[inputOffset];
    inputOffset += 1;
    const row = Buffer.from(inflated.subarray(inputOffset, inputOffset + rowLength));
    inputOffset += rowLength;
    const previous = y === 0 ? null : pixels.subarray((y - 1) * rowLength, y * rowLength);
    unfilterPngRow(row, previous, filter, bytesPerPixel);
    row.copy(pixels, y * rowLength);
  }

  return { width, height, bitDepth, colorType, pixels };
}

function unfilterPngRow(row, previous, filter, bytesPerPixel) {
  for (let index = 0; index < row.length; index += 1) {
    const left = index >= bytesPerPixel ? row[index - bytesPerPixel] : 0;
    const above = previous ? previous[index] : 0;
    const upperLeft = previous && index >= bytesPerPixel ? previous[index - bytesPerPixel] : 0;
    if (filter === 1) {
      row[index] = (row[index] + left) & 0xff;
    } else if (filter === 2) {
      row[index] = (row[index] + above) & 0xff;
    } else if (filter === 3) {
      row[index] = (row[index] + Math.floor((left + above) / 2)) & 0xff;
    } else if (filter === 4) {
      row[index] = (row[index] + paethPredictor(left, above, upperLeft)) & 0xff;
    } else {
      assert(filter === 0, `unsupported PNG row filter ${filter}`);
    }
  }
}

function paethPredictor(left, above, upperLeft) {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) {
    return left;
  }
  return aboveDistance <= upperLeftDistance ? above : upperLeft;
}
