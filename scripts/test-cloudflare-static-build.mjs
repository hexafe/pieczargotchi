import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import {
  buildCloudflareStaticArtifacts,
  collectStaticAssetFiles,
  getBundleVersion
} from './build-cloudflare-static.mjs';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const distDir = path.join(rootDir, 'dist');

const indexHtml = readDistText('index.html');
const configJs = readDistText('config.js');
const coreJs = readDistText('core.js');
const clientJs = readDistText('client.js');
const expected = buildCloudflareStaticArtifacts();
const distConfig = evaluateConfig(configJs);
const packageJson = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const imagegenSpriteBuilder = readFileSync(path.join(rootDir, 'scripts', 'build-imagegen-sprites.py'), 'utf8');
const instrumentVariantBuilder = readFileSync(path.join(rootDir, 'scripts', 'generate-instrument-variant-assets.py'), 'utf8');

test('Cloudflare static dist matches current source bundles', () => {
  assert(configJs === expected.configBundle, 'dist/config.js is stale; run npm run build');
  assert(coreJs === expected.coreBundle, 'dist/core.js is stale; run npm run build');
  assert(clientJs === expected.clientBundle, 'dist/client.js is stale; run npm run build');
  assert(indexHtml === expected.indexHtml, 'dist/index.html is stale; run npm run build');
});

test('Cloudflare static HTML cache-busts mutable script bundles', () => {
  assertScriptVersion('config', configJs);
  assertScriptVersion('core', coreJs);
  assertScriptVersion('client', clientJs);
  assert(!indexHtml.includes('?bundle='), 'Cloudflare HTML must replace every versioned Apps Script bundle endpoint');
});

test('Cloudflare static asset manifest cache-busts runtime assets', () => {
  const assetFiles = collectStaticAssetFiles();
  assert(assetFiles.length > 0, 'static asset inventory should not be empty');
  assert(Object.keys(distConfig.assetVersions || {}).length === assetFiles.length, 'asset version map should cover every copied static asset');

  for (const fileName of assetFiles) {
    const sourcePath = path.join(rootDir, 'assets', fileName);
    const distPath = path.join(distDir, 'assets', fileName);
    assert(existsSync(distPath), `dist is missing static asset ${fileName}`);
    assert(distConfig.assetVersions[fileName] === getFileVersion(sourcePath), `asset version mismatch for ${fileName}`);
    assert(getFileVersion(distPath) === getFileVersion(sourcePath), `dist asset differs from source asset ${fileName}`);
  }

  const grassVersion = distConfig.assetVersions['environment/grass_patch.png'];
  assert(grassVersion, 'grass patch should have a content version');
  assert(indexHtml.includes(`assets/environment/grass_patch.png?v=${grassVersion}`), 'grass preload should use the versioned asset URL');
  const journalProps = (distConfig.assets || []).find((asset) => asset.key === 'journal.polaroidProps');
  assert(journalProps, 'journal polaroid prop atlas should be present in the runtime manifest');
  assert(journalProps.fileName === 'journal/polaroid_props_atlas.png', 'journal prop atlas should keep its stable runtime path');
  assert(journalProps.width === 384 && journalProps.height === 384 && journalProps.frames === 9,
    'journal prop atlas should expose the 3x3 cell contract');
  assert(distConfig.assetVersions[journalProps.fileName], 'journal prop atlas should have a content version');
  ['stages/spore/sleep_sheet.png', 'stages/spore/idle_sheet.png', 'stages/spore/wake_sheet.png'].forEach((fileName) => {
    const version = distConfig.assetVersions[fileName];
    assert(version, `${fileName} should have a content version`);
    assert(indexHtml.includes(`assets/${fileName}?v=${version}`), `${fileName} should be preloaded with a versioned URL`);
  });
  assert(clientJs.includes('function getStaticAssetUrl('), 'static client should append asset versions at runtime');
  assert(clientJs.includes('function getTrustedAssetBaseUrl('), 'client should validate the optional Apps Script HTTPS asset base');
  assert(clientJs.includes('config.assetVersion'), 'client should cache-bust Apps Script assets with the visible version');
  assert(clientJs.includes('return !getTrustedAssetBaseUrl(config.assetBaseUrl)'), 'public asset hosting should bypass unnecessary Drive RPCs');
  assert(clientJs.includes('function addStaticAssetCandidate('), 'client should preserve a static asset fallback after data URL lookups');
  assert(clientJs.includes('addStaticAssetCandidate(candidates, asset);'), 'client should try static assets after missing Drive data URLs');
  assert(distConfig.assetBaseUrl === '', 'Cloudflare build should keep asset URLs same-origin');
  assert(distConfig.runtime && distConfig.runtime.assetMode === 'critical', 'production dist must keep lazy critical asset loading');
});

test('production Cloudflare build rejects eager full asset mode', () => {
  const previousMode = process.env.PIECZARGOTCHI_CLOUDFLARE_ASSET_MODE;
  process.env.PIECZARGOTCHI_CLOUDFLARE_ASSET_MODE = 'full';
  let rejected = false;
  try {
    buildCloudflareStaticArtifacts();
  } catch (error) {
    rejected = String(error && error.message || error).includes('critical');
  } finally {
    restoreEnv('PIECZARGOTCHI_CLOUDFLARE_ASSET_MODE', previousMode);
  }
  assert(rejected, 'production dist should reject eager full asset loading');
});

test('Cloudflare dist contains only runtime-manifest assets', () => {
  const manifestFiles = new Set(collectStaticAssetFiles());
  for (const legacyFile of ['awake.png', 'sleeping_sheet.png', 'activities/hydrate_sheet.png']) {
    assert(!manifestFiles.has(legacyFile), `${legacyFile} should not be part of the runtime manifest`);
    assert(!existsSync(path.join(distDir, 'assets', legacyFile)), `dist must not copy unmanifested compatibility asset ${legacyFile}`);
  }
});

test('debug Cloudflare builds require an explicit local-only opt-in', () => {
  const previousDebug = process.env.PIECZARGOTCHI_CLOUDFLARE_DEBUG;
  const previousAllow = process.env.PIECZARGOTCHI_ALLOW_DEBUG_BUILD;
  process.env.PIECZARGOTCHI_CLOUDFLARE_DEBUG = '1';
  delete process.env.PIECZARGOTCHI_ALLOW_DEBUG_BUILD;
  let rejected = false;
  try {
    buildCloudflareStaticArtifacts();
  } catch (error) {
    rejected = String(error && error.message || error).includes('dist-debug');
  } finally {
    restoreEnv('PIECZARGOTCHI_CLOUDFLARE_DEBUG', previousDebug);
    restoreEnv('PIECZARGOTCHI_ALLOW_DEBUG_BUILD', previousAllow);
  }
  assert(rejected, 'debug build should fail without explicit local-only opt-in');
});

test('loading and journal paths avoid procedural mushroom fallbacks during normal asset waits', () => {
  assert(clientJs.includes('function drawMushroomLoadPlaceholder('), 'static client should render a neutral pending-scene placeholder');
  assert(clientJs.includes('warmUpCurrentStageAssets();'), 'static client should warm current-stage sprites after state load');
  assert(!clientJs.includes("drawEmergencyCanvasFallback('Ładowanie sceny')"), 'static client should not show the emergency mushroom during normal loading');
  assert(!clientJs.includes("drawFallbackMushroom(ctx, runtime.state && runtime.state.mode"), 'missing animation images should not draw the procedural mushroom');
  assert(clientJs.includes('function queueWorldJournalPolaroidRedraw('), 'journal polaroids should redraw after sprite assets load');
  assert(clientJs.includes('function drawJournalMushroomPendingPlaceholder('), 'journal polaroids should use a neutral placeholder while waiting for sprites');
});

test('reset flow does not depend on browser modals in the static client', () => {
  assert(clientJs.includes('function handleResetButtonClick()'), 'static client should include the reset click handler');
  assert(clientJs.includes('function performGameReset()'), 'static client should include the reset executor');
  assert(!clientJs.includes('window.confirm('), 'static client reset should not depend on window.confirm');
  assert(clientJs.includes('Potwierdź'), 'static client should expose an inline reset confirmation state');
});

test('first-run naming gate is present in the static client', () => {
  assert(indexHtml.includes('data-name-form'), 'static HTML should include the first-run name form');
  assert(indexHtml.includes('data-name-input'), 'static HTML should include the first-run name input');
  assert(clientJs.includes('function handleNameFormSubmit'), 'static client should include the name submit handler');
  assert(clientJs.includes('function renderNameGate'), 'static client should render the name gate');
  assert(clientJs.includes('nameConfirmed'), 'static client should persist name confirmation');
});

test('static build exposes a subtle build version badge', () => {
  assert(indexHtml.includes('data-build-badge'), 'static HTML should include the build badge anchor');
  assert(clientJs.includes('function renderBuildBadge()'), 'static client should render the build badge');
  assert(distConfig.build && distConfig.build.version === packageJson.version, 'static config should expose the package version');
  assert(distConfig.appVersion === packageJson.version, 'static config appVersion should match package version');
  assert(/^[a-f0-9]{7}$/.test(distConfig.build.id), 'static build id should be a short source hash');
  assert(distConfig.build.label === `v${distConfig.build.version}+${distConfig.build.id}`, 'static build label should combine version and build id');
});

test('static client renders a symmetric pixel moon phase mask', () => {
  assert(clientJs.includes('function getMoonCellLight('), 'moon renderer should use the symmetric cell mask');
  assert(clientJs.includes('function getMoonCellGrid('), 'moon renderer should center the pixel-cell grid');
  assert(clientJs.includes('function drawMoonCraters('), 'moon renderer should add subtle pixel craters');
  assert(!clientJs.includes('function isMoonBlockLit('), 'moon renderer should not use the old skew-prone block mask');
});

test('world journal exposes hover notes and polaroid keepsakes', () => {
  assert(indexHtml.includes('data-journal-tooltip'), 'static HTML should include the journal tooltip');
  assert(indexHtml.includes('data-journal-polaroid'), 'static HTML should include the journal polaroid');
  assert(indexHtml.includes('data-calendar-checklist'), 'static HTML should include the purchasable calendar checklist');
  assert(clientJs.includes('function bindWorldJournalInteractions()'), 'static client should bind journal interactions');
  assert(clientJs.includes('function drawWorldJournalPolaroidScene('), 'static client should render journal polaroid scenes');
  assert(clientJs.includes('function drawWorldJournalSnapshotScene('), 'static client should render snapshot-based journal scenes');
  assert(clientJs.includes('data-frame-tier'), 'journal polaroids should expose calendar frame tiers');
  assert(clientJs.includes('function renderCalendarChecklist()'), 'static client should render the event checklist');
  assert(clientJs.includes('function drawCalendarEventForeground('), 'static client should render calendar event accents');
  assert(clientJs.includes('calendarPixelSprites'), 'static client should include the event pixel sprite pack');
  assert(clientJs.includes('function drawCalendarPixelSprite('), 'static client should draw reusable calendar pixel sprites');
  assert(clientJs.includes('function drawJournalSpaceWeek('), 'static client should render a distinct Space Week polaroid scene');
  assert(clientJs.includes('function drawJournalPixelFlower('), 'static client should render distinct event polaroid props');
  assert(clientJs.includes('data-discovery-id'), 'journal discovery cards should expose stable discovery ids');
  assert(coreJs.includes('getCalendarChecklist'), 'core should export the calendar checklist API');
  assert(coreJs.includes('worldBeeDay'), 'core calendar should include World Bee Day');
  assert(coreJs.includes('teaDay'), 'core calendar should include International Tea Day');
  assert(distConfig.rules.decorations.some((item) => item.id === 'myceliumCalendar'), 'static config should expose purchasable calendar decoration');
  assert(coreJs.includes('photoCaption'), 'core journal entries should expose photo captions');
  assert(coreJs.includes('photoSnapshot'), 'core journal discoveries should expose preserved photo snapshots');
  assert(coreJs.includes('buildWorldJournalPhotoSnapshot'), 'core should export journal snapshot capture helpers');
  assert(coreJs.includes('conditionNote'), 'core journal entries should expose condition notes');
  assert(coreJs.includes('sourceType'), 'core calendar entries should expose source category ids');
  assert(coreJs.includes('sourceLabel'), 'core calendar entries should expose source category labels');
  assert(coreJs.includes('calendarFrameTiers'), 'core calendar should derive cosmetic frame tiers');
  assert(clientJs.includes('calendar-checklist__reward'), 'static client should render calendar cosmetic frame progress');
  assert(clientJs.includes('drawJournalMissingAssetMarker'), 'journal polaroids should mark missing sprites without procedural fallback art');
});

test('long-loop grzybnia panel exposes retention controls and pixel visitors', () => {
  assert(indexHtml.includes('data-long-loop-dashboard'), 'static HTML should include the long-loop dashboard');
  assert(indexHtml.includes('panel-block--long-loop'), 'static HTML should include the long-loop panel');
  assert(clientJs.includes('function renderLongLoop()'), 'static client should render the long-loop panel');
  assert(clientJs.includes('function handleHabitatVisitorGreet('), 'static client should bind habitat visitor greeting');
  assert(clientJs.includes('function handleSporeExpeditionStart('), 'static client should start spore expeditions');
  assert(clientJs.includes('function drawLongLoopHabitatVisitor('), 'static client should render pixel habitat visitors');
  assert(coreJs.includes('getLongLoopDashboard'), 'core should export the long-loop dashboard API');
  assert(coreJs.includes('greetHabitatVisitor'), 'core should export habitat visitor greeting');
  assert(coreJs.includes('startSporeExpedition'), 'core should export spore expeditions');
});

test('post-legendary games expose rules, hub, runtime, and capture hooks', () => {
  assert(indexHtml.includes('data-legendary-games'), 'static HTML should include the legendary games hub');
  assert(indexHtml.includes('data-legendary-game-canvas'), 'static HTML should include the legendary game canvas');
  assert(indexHtml.includes('data-legendary-album'), 'static HTML should include the legendary album');
  assert(coreJs.includes('getLegendaryGamesDashboard'), 'core should export the legendary games dashboard API');
  assert(coreJs.includes('normalizeLegendaryGamesState'), 'core should export legendary state normalization');
  assert(clientJs.includes('function startLegendaryGameRuntime('), 'static client should include legendary game runtime');
  assert(clientJs.includes('function handleLegendaryGamePointer('), 'static client should score legendary pointer input');
  assert(clientJs.includes('wrongOrder'), 'legendary trail and memory games should enforce ordered choices');
  assert(clientJs.includes('wrongCounter'), 'league game should score stance counters instead of raw target tapping');
  assert(clientJs.includes('function renderLegendaryGames()'), 'static client should render the legendary hub');
  assert(distConfig.rules.legendaryGames && distConfig.rules.legendaryGames.dailyProjectPointCap === 6, 'static config should expose legendary daily project cap');
  ['sporeTrail', 'myceliumLeague', 'memoryGarden'].forEach((id) => {
    assert(distConfig.rules.minigames[id], `static config should expose ${id}`);
    assert(distConfig.rules.minigames[id].requiresStage === 'legendary', `${id} should be legendary-gated`);
  });
  const captureScript = readFileSync(path.join(rootDir, 'scripts', 'capture-app-render.mjs'), 'utf8');
  assert(captureScript.includes('PIECZARGOTCHI_CAPTURE_LEGENDARY_GAMES'), 'capture script should expose legendary game screenshots');
  assert(captureScript.includes("id: 'sporeTrail'"), 'capture script should include spore trail capture');
  assert(captureScript.includes('state.stats.growth = ${Number(sample.growth) || 70};'), 'configured minigame capture should honor sample growth');
  assert(captureScript.includes("state.stage = state.stats.growth >= 100 ? 'legendary' : 'adult';"), 'configured minigame capture should unlock legendary stage fixtures');
});

test('capture tooling can force calendar event screenshots', () => {
  const captureScript = readFileSync(path.join(rootDir, 'scripts', 'capture-app-render.mjs'), 'utf8');
  assert(captureScript.includes('PIECZARGOTCHI_DEBUG_CALENDAR_EVENT'), 'capture script should accept a forced calendar event id');
  assert(captureScript.includes('PIECZARGOTCHI_CAPTURE_CALENDAR_MATRIX'), 'capture script should expose calendar screenshot matrix mode');
  assert(captureScript.includes('PIECZARGOTCHI_CAPTURE_CALENDAR_CHECKLIST'), 'capture script should expose calendar checklist viewport mode');
  assert(captureScript.includes('PIECZARGOTCHI_CAPTURE_JOURNAL_DISCOVERY'), 'capture script should allow forced journal discovery screenshots');
  assert(captureScript.includes('PIECZARGOTCHI_CAPTURE_MINIGAME_PANEL'), 'capture tooling should verify minigame panel HUD layout');
  assert(captureScript.includes('polaroidInViewport'), 'capture script should assert journal polaroid viewport geometry');
  assert(captureScript.includes('expectedFrameTier'), 'capture script should assert journal polaroid frame tier matches the saved snapshot');
  assert(captureScript.includes('calendarCaptureSamples'), 'capture script should define calendar matrix samples');
  assert(captureScript.includes('getCalendarEventCaptureTimestamp'), 'capture script should map event ids to deterministic dates');
});

test('dew catch minigame uses bucket catching instead of click-to-collect drops', () => {
  assert(clientJs.includes('function drawDewBucket('), 'dew catch should render a pixel-art bucket');
  assert(clientJs.includes('function canDewBucketCatchDrop('), 'dew catch should score through bucket/drop collision');
  assert(clientJs.includes('function drawDewGrassLayer('), 'dew catch should render layered grass');
  assert(clientJs.includes('function drawDewDrop('), 'dew catch should render custom pixel-art drops');
  assert(clientJs.includes('function drawDewCatchLandingPreviews('), 'dew catch should show landing previews for falling drops');
  assert(clientJs.includes('missed'), 'dew catch should track missed drops so they do not respawn');
  assert(!clientJs.includes('Math.abs(drop.x - x) <= radius && Math.abs(dropY - y) <= radius'), 'dew catch should not use click-to-collect hit testing');
});

test('static build includes habitat minigames and evolution identity polish', () => {
  assert(indexHtml.includes('data-minigame-start="compostSort"'), 'static HTML should expose compost sort');
  assert(indexHtml.includes('data-minigame-start="rhythmHum"'), 'static HTML should expose rhythm hum');
  assert(clientJs.includes('function startCompostSortRuntime('), 'static client should include compost runtime');
  assert(clientJs.includes('function startRhythmHumRuntime('), 'static client should include rhythm runtime');
  assert(clientJs.includes('function drawSporePopBursts('), 'spore pop should render pixel burst feedback');
  assert(clientJs.includes('function drawSporePopTelegraph('), 'spore pop should telegraph incoming targets');
  assert(clientJs.includes('function finishCompostSortDrag('), 'compost sort should use a drag/drop sorting loop');
  assert(clientJs.includes('function drawRhythmPatternRail('), 'rhythm hum should render the visible pattern rail');
  assert(clientJs.includes('function drawRhythmHumTimingBands('), 'rhythm hum should render timing windows');
  assert(clientJs.includes('function getRhythmHumTimingCue('), 'rhythm hum should compute press-now cues from timing windows');
  assert(clientJs.includes('RHYTHM_HUM_KEY_TO_LANE'), 'rhythm hum should map keyboard arrows to rhythm lanes');
  assert(clientJs.includes('function handleRhythmHumKeydown('), 'rhythm hum should score keyboard timing input');
  assert(clientJs.includes('scoreRhythmHumLane(lane.id, now)'), 'rhythm hum touch pads should score through the same lane path');
  assert(clientJs.includes('function markRhythmHumMisses('), 'rhythm hum should auto-mark missed notes');
  assert(clientJs.includes('rhythmJudgments'), 'rhythm hum should persist per-note timing judgments');
  assert(coreJs.includes('judgeRhythmInput'), 'core should export rhythm input judgment for tests');
  assert(!clientJs.includes("const pads = ['low', 'mid', 'high']"), 'rhythm hum should not use the old three-click pad pattern');
  assert(indexHtml.includes('data-minigame-combo'), 'static HTML should expose minigame combo HUD');
  assert(indexHtml.includes('data-minigame-progress'), 'static HTML should expose minigame progress HUD');
  assert(indexHtml.includes('data-minigame-mastery="dewCatch"'), 'static HTML should expose mastery labels on minigame cards');
  assert(clientJs.includes('function pushMinigameFloater('), 'static client should render minigame score floaters');
  assert(clientJs.includes("kind === 'glint'"), 'dew catch should include rare glint drops');
  assert(clientJs.includes("piece.kind === 'mycelium'"), 'compost sort should include rare mycelium pieces');
  assert(distConfig.rules.minigames.dewCatch.masteryTarget, 'static config should expose dew mastery target');
  assert(distConfig.rules.minigames.rhythmHum.masteryTarget, 'static config should expose rhythm mastery target');
  assert(clientJs.includes('function drawEvolutionIdentityOverlay('), 'static client should render evolution identity accents');
  assert(clientJs.includes("type: 'wake_surprise'"), 'wake should use the sprite-backed wake surprise activity');
  assert(!clientJs.includes('function drawWakeSurpriseFace('), 'static client should not draw a canvas wake face overlay');
  assert(distConfig.rules.minigames.compostSort, 'static config should expose compost sort rules');
  assert(distConfig.rules.minigames.rhythmHum, 'static config should expose rhythm hum rules');
});

test('capture tooling performs scripted minigame interactions', () => {
  const captureScript = readFileSync(path.join(rootDir, 'scripts', 'capture-app-render.mjs'), 'utf8');
  assert(captureScript.includes('performConfiguredMinigameInteraction'), 'capture script should exercise minigame input paths');
  assert(captureScript.includes("sample.id === 'rhythmHum'"), 'capture script should have a rhythm-specific keyboard smoke');
  assert(captureScript.includes("rhythmInputMode: 'touch'"), 'rhythm capture should exercise touch pad scoring');
  assert(captureScript.includes("new KeyboardEvent('keydown'"), 'rhythm capture should keep keyboard input support');
  assert(captureScript.includes("sample.id === 'compostSort'"), 'capture script should drag a compost piece');
  assert(captureScript.includes("sample.id === 'sporePop'"), 'capture script should tap a spore target');
  assert(captureScript.includes('interactionMinScore'), 'rhythm capture should fail if scripted input does not score');
});

test('sprite-owned activities do not stack canvas visual effects', () => {
  assert(clientJs.includes('function getActionCanvasEffectType(action)'), 'static client should route action effects through getActionCanvasEffectType');
  assert(clientJs.includes('feed: true'), 'feed should be marked as sprite-owned');
  assert(clientJs.includes('instrument: true'), 'instrument should be marked as sprite-owned');
  assert(clientJs.includes('sing: true'), 'sing should be marked as sprite-owned');
  assert(!clientJs.includes('triggerEffect(action.effectType || action.id)'), 'actions should not directly trigger fallback canvas effects');
  assert(!clientJs.includes("music: { color: '#674ea7', shape: 'note' }"), 'music should not map to canvas note particles');
  assert(!clientJs.includes("music: 'effect.notes'"), 'music should not map to canvas note assets');
  assert(!clientJs.includes("shape === 'note'"), 'static client should not draw canvas music-note particles');
  assert(!clientJs.includes("instrument: { color: '#674ea7', shape: 'note' }"), 'instrument should not map to canvas note particles');
  assert(!clientJs.includes("sing: { color: '#674ea7', shape: 'note' }"), 'sing should not map to canvas note particles');
  assert(!clientJs.includes("instrument: 'effect.notes'"), 'instrument should not map to canvas note assets');
  assert(!clientJs.includes("sing: 'effect.notes'"), 'sing should not map to canvas note assets');
  assert(imagegenSpriteBuilder.includes('SPRITE_OWNED_ACTIVITY_DETAILS = {"feed", "instrument", "sing"}'), 'imagegen activity builder should mark feed/instrument/sing as sprite-owned');
  assert(!imagegenSpriteBuilder.includes('elif activity == "feed":\n        narysuj_karmienie'), 'feed sheets should not get generated overlay mouths');
  assert(!imagegenSpriteBuilder.includes('elif activity == "instrument":\n        narysuj_granie'), 'instrument sheets should not get generated overlay props');
  assert(!imagegenSpriteBuilder.includes('elif activity == "sing":\n        narysuj_spiew'), 'sing sheets should not get generated overlay mouths');
  assert(instrumentVariantBuilder.includes('without stacking an extra generated prop over the face'), 'instrument variants should not stack generated props over the source sprite');
});

test('interaction immersion avoids pointer-local overlay markers', () => {
  assert(!clientJs.includes('function drawPointerCuriosity('), 'pointer curiosity should not draw cursor-local frames');
  assert(!clientJs.includes('function drawPointerPesterMarks('), 'pointer pestering should not draw plus marks or target frames');
  assert(!clientJs.includes('function drawPointerGrassRustle('), 'grass brushing should bend existing grass instead of drawing cursor grass strokes');
  assert(!clientJs.includes('function drawAmbientPointerCue('), 'ambient interactions should move creatures instead of drawing click rings');
  assert(!clientJs.includes('function drawCelestialClickPuff('), 'celestial clicks should not draw square hit puffs');
  assert(clientJs.includes('drawnEffects'), 'interaction diagnostics should expose which effects are actually rendered');
});

function assertScriptVersion(name, content) {
  const version = getBundleVersion(content);
  const pattern = new RegExp(`<script src="${name}\\.js\\?v=${version}"></script>`);
  assert(pattern.test(indexHtml), `${name}.js should have a current content version query`);
}

function evaluateConfig(configBundle) {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(configBundle, context, { filename: 'dist/config.js' });
  return context.window.PIECZARGOTCHI_CONFIG || {};
}

function readDistText(fileName) {
  return readFileSync(path.join(distDir, fileName), 'utf8');
}

function getFileVersion(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex').slice(0, 12);
}

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
