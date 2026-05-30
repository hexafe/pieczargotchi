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
  ['stages/spore/sleep_sheet.png', 'stages/spore/idle_sheet.png', 'stages/spore/wake_sheet.png'].forEach((fileName) => {
    const version = distConfig.assetVersions[fileName];
    assert(version, `${fileName} should have a content version`);
    assert(indexHtml.includes(`assets/${fileName}?v=${version}`), `${fileName} should be preloaded with a versioned URL`);
  });
  assert(clientJs.includes('function getStaticAssetUrl('), 'static client should append asset versions at runtime');
  assert(clientJs.includes('function addStaticAssetCandidate('), 'client should preserve a static asset fallback after data URL lookups');
  assert(clientJs.includes('addStaticAssetCandidate(candidates, asset);'), 'client should try static assets after missing Drive data URLs');
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
  assert(/^[a-f0-9]{7}$/.test(distConfig.build.id), 'static build id should be a short source hash');
  assert(distConfig.build.label === `v${distConfig.build.version}+${distConfig.build.id}`, 'static build label should combine version and build id');
});

test('world journal exposes hover notes and polaroid keepsakes', () => {
  assert(indexHtml.includes('data-journal-tooltip'), 'static HTML should include the journal tooltip');
  assert(indexHtml.includes('data-journal-polaroid'), 'static HTML should include the journal polaroid');
  assert(indexHtml.includes('data-calendar-checklist'), 'static HTML should include the purchasable calendar checklist');
  assert(clientJs.includes('function bindWorldJournalInteractions()'), 'static client should bind journal interactions');
  assert(clientJs.includes('function drawWorldJournalPolaroidScene('), 'static client should render journal polaroid scenes');
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
  assert(coreJs.includes('conditionNote'), 'core journal entries should expose condition notes');
  assert(coreJs.includes('sourceType'), 'core calendar entries should expose source category ids');
  assert(coreJs.includes('sourceLabel'), 'core calendar entries should expose source category labels');
  assert(coreJs.includes('calendarFrameTiers'), 'core calendar should derive cosmetic frame tiers');
  assert(clientJs.includes('calendar-checklist__reward'), 'static client should render calendar cosmetic frame progress');
  assert(clientJs.includes('drawJournalMissingAssetMarker'), 'journal polaroids should mark missing sprites without procedural fallback art');
});

test('capture tooling can force calendar event screenshots', () => {
  const captureScript = readFileSync(path.join(rootDir, 'scripts', 'capture-app-render.mjs'), 'utf8');
  assert(captureScript.includes('PIECZARGOTCHI_DEBUG_CALENDAR_EVENT'), 'capture script should accept a forced calendar event id');
  assert(captureScript.includes('PIECZARGOTCHI_CAPTURE_CALENDAR_MATRIX'), 'capture script should expose calendar screenshot matrix mode');
  assert(captureScript.includes('PIECZARGOTCHI_CAPTURE_CALENDAR_CHECKLIST'), 'capture script should expose calendar checklist viewport mode');
  assert(captureScript.includes('PIECZARGOTCHI_CAPTURE_JOURNAL_DISCOVERY'), 'capture script should allow forced journal discovery screenshots');
  assert(captureScript.includes('polaroidInViewport'), 'capture script should assert journal polaroid viewport geometry');
  assert(captureScript.includes('calendarCaptureSamples'), 'capture script should define calendar matrix samples');
  assert(captureScript.includes('getCalendarEventCaptureTimestamp'), 'capture script should map event ids to deterministic dates');
});

test('dew catch minigame uses bucket catching instead of click-to-collect drops', () => {
  assert(clientJs.includes('function drawDewBucket('), 'dew catch should render a pixel-art bucket');
  assert(clientJs.includes('function canDewBucketCatchDrop('), 'dew catch should score through bucket/drop collision');
  assert(clientJs.includes('function drawDewGrassLayer('), 'dew catch should render layered grass');
  assert(clientJs.includes('function drawDewDrop('), 'dew catch should render custom pixel-art drops');
  assert(clientJs.includes('missed'), 'dew catch should track missed drops so they do not respawn');
  assert(!clientJs.includes('Math.abs(drop.x - x) <= radius && Math.abs(dropY - y) <= radius'), 'dew catch should not use click-to-collect hit testing');
});

test('static build includes habitat minigames and evolution identity polish', () => {
  assert(indexHtml.includes('data-minigame-start="compostSort"'), 'static HTML should expose compost sort');
  assert(indexHtml.includes('data-minigame-start="rhythmHum"'), 'static HTML should expose rhythm hum');
  assert(clientJs.includes('function startCompostSortRuntime('), 'static client should include compost runtime');
  assert(clientJs.includes('function startRhythmHumRuntime('), 'static client should include rhythm runtime');
  assert(clientJs.includes('function drawSporePopBursts('), 'spore pop should render pixel burst feedback');
  assert(clientJs.includes('function drawRhythmPatternRail('), 'rhythm hum should render the visible pattern rail');
  assert(clientJs.includes("kind === 'glint'"), 'dew catch should include rare glint drops');
  assert(clientJs.includes("piece.kind === 'mycelium'"), 'compost sort should include rare mycelium pieces');
  assert(clientJs.includes('function drawEvolutionIdentityOverlay('), 'static client should render evolution identity accents');
  assert(clientJs.includes("type: 'wake_surprise'"), 'wake should use the sprite-backed wake surprise activity');
  assert(!clientJs.includes('function drawWakeSurpriseFace('), 'static client should not draw a canvas wake face overlay');
  assert(distConfig.rules.minigames.compostSort, 'static config should expose compost sort rules');
  assert(distConfig.rules.minigames.rhythmHum, 'static config should expose rhythm hum rules');
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
