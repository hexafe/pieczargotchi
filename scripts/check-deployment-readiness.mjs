import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const failures = [];
const warnings = [];

const requiredSourceFiles = [
  'Code.gs',
  'Config.gs',
  'AnimationConfig.gs',
  'AssetService.gs',
  'StateModel.gs',
  'GameRules.gs',
  'MinigamesConfig.gs',
  'EvolutionRules.gs',
  'DecorationStore.gs',
  'SyncService.gs',
  'Actions.gs',
  'Index.html',
  'Styles.html',
  'Client.html',
  'ClientCore.html',
  'ClientCoreWeather.html',
  'ClientCoreLife.html',
  'ClientCoreCare.html',
  'ClientCoreBattle.html',
  'ClientCoreShared.html',
  'ClientCoreImmersion.html',
  'ClientCoreProgression.html',
  'ClientCoreMinigames.html',
  'ClientCoreExports.html',
  'ClientBoot.html',
  'ClientDebug.html',
  'ClientRuntime.html',
  'ClientWeather.html',
  'ClientState.html',
  'ClientActions.html',
  'ClientMinigameDewCatch.html',
  'ClientMinigameSporePop.html',
  'ClientBackup.html',
  'ClientUi.html',
  'ClientBattleScene.html',
  'ClientInteraction.html',
  'ClientAnimation.html',
  'ClientScene.html',
  'ClientScenePalette.html',
  'ClientSceneCelestial.html',
  'ClientSceneRainbow.html',
  'ClientSceneWeather.html',
  'ClientSceneWeatherClouds.html',
  'ClientSceneWeatherPrecip.html',
  'ClientSceneWeatherSurface.html',
  'ClientSceneWeatherShared.html',
  'ClientSceneLife.html',
  'ClientSceneGround.html',
  'ClientSprites.html',
  'appsscript.json'
];

const expectedCoreIncludes = [
  'ClientCoreWeather',
  'ClientCoreLife',
  'ClientCoreCare',
  'ClientCoreBattle',
  'ClientCoreShared',
  'ClientCoreImmersion',
  'ClientCoreProgression',
  'ClientCoreMinigames',
  'ClientCoreExports'
];

const expectedClientIncludes = [
  'ClientBoot',
  'ClientDebug',
  'ClientRuntime',
  'ClientWeather',
  'ClientState',
  'ClientActions',
  'ClientMinigameDewCatch',
  'ClientMinigameSporePop',
  'ClientBackup',
  'ClientUi',
  'ClientBattleScene',
  'ClientInteraction',
  'ClientAnimation',
  'ClientScene',
  'ClientScenePalette',
  'ClientSceneCelestial',
  'ClientSceneRainbow',
  'ClientSceneWeather',
  'ClientSceneLife',
  'ClientSceneGround',
  'ClientSprites'
];

const expectedWeatherIncludes = [
  'ClientSceneWeatherClouds',
  'ClientSceneWeatherPrecip',
  'ClientSceneWeatherSurface',
  'ClientSceneWeatherShared'
];

main();

function main() {
  checkRequiredFiles();
  checkAppsScriptManifest();
  checkHtmlIncludes();
  checkAppsScriptLoadOrderSafety();
  checkStaticConfig();
  checkLocalPreviewConfig();
  checkAssetFallbackContract();
  checkClaspLocalOnlyContract();
  checkTrackedSecretLeaks();
  report();
}

function checkRequiredFiles() {
  for (const fileName of requiredSourceFiles) {
    if (!existsSync(resolveRoot(fileName))) {
      fail(`Missing required Apps Script source file: ${fileName}`);
    }
  }
}

function checkAppsScriptManifest() {
  const manifest = readJson('appsscript.json');
  if (!manifest) {
    return;
  }

  if (manifest.runtimeVersion !== 'V8') {
    fail(`appsscript.json runtimeVersion should be V8, got ${JSON.stringify(manifest.runtimeVersion)}`);
  }
  if (!Array.isArray(manifest.oauthScopes)) {
    fail('appsscript.json must set oauthScopes explicitly for the public web app.');
  } else if (manifest.oauthScopes.some((scope) => String(scope).includes('/auth/drive'))) {
    fail('Public appsscript.json must not request Drive OAuth scopes unless OAuth verification is handled.');
  }
  if (!manifest.webapp) {
    fail('appsscript.json is missing webapp config.');
    return;
  }
  if (manifest.webapp.access !== 'ANYONE_ANONYMOUS') {
    fail(`webapp.access should be ANYONE_ANONYMOUS for a public web app, got ${JSON.stringify(manifest.webapp.access)}`);
  }
  if (manifest.webapp.executeAs !== 'USER_DEPLOYING') {
    fail(`webapp.executeAs should be USER_DEPLOYING, got ${JSON.stringify(manifest.webapp.executeAs)}`);
  }
}

function checkHtmlIncludes() {
  const indexHtml = readText('Index.html');
  for (const includeName of ['Styles']) {
    if (!indexHtml.includes(`include('${includeName}')`)) {
      fail(`Index.html does not include ${includeName}.`);
    }
  }
  if (!indexHtml.includes('?bundle=config') || !indexHtml.includes('?bundle=core') || !indexHtml.includes('?bundle=client')) {
    fail('Index.html must load config, ClientCore, and Client through Apps Script bundle endpoints.');
  }
  if (!indexHtml.includes('__pieczargotchiBootSeen') || !indexHtml.includes('Awaryjny watchdog sceny')) {
    fail('Index.html is missing the Apps Script startup watchdog fallback.');
  }

  const coreIncludes = readIncludes('ClientCore.html');
  const duplicateCoreIncludes = coreIncludes.filter((item, index) => coreIncludes.indexOf(item) !== index);
  for (const includeName of expectedCoreIncludes) {
    if (!coreIncludes.includes(includeName)) {
      fail(`ClientCore.html does not include ${includeName}.`);
    }
  }
  if (duplicateCoreIncludes.length) {
    fail(`ClientCore.html has duplicate includes: ${[...new Set(duplicateCoreIncludes)].join(', ')}`);
  }

  const includes = readIncludes('Client.html');
  const duplicates = includes.filter((item, index) => includes.indexOf(item) !== index);
  for (const includeName of expectedClientIncludes) {
    if (!includes.includes(includeName)) {
      fail(`Client.html does not include ${includeName}.`);
    }
  }
  if (duplicates.length) {
    fail(`Client.html has duplicate includes: ${[...new Set(duplicates)].join(', ')}`);
  }

  const weatherIncludes = readIncludes('ClientSceneWeather.html');
  const duplicateWeatherIncludes = weatherIncludes.filter((item, index) => weatherIncludes.indexOf(item) !== index);
  for (const includeName of expectedWeatherIncludes) {
    if (!weatherIncludes.includes(includeName)) {
      fail(`ClientSceneWeather.html does not include ${includeName}.`);
    }
  }
  if (duplicateWeatherIncludes.length) {
    fail(`ClientSceneWeather.html has duplicate includes: ${[...new Set(duplicateWeatherIncludes)].join(', ')}`);
  }

  const codeGs = readText('Code.gs');
  if (!codeGs.includes('serveClientConfigScript_') || !codeGs.includes('serveClientBundle_') || !codeGs.includes('ContentService.MimeType.JAVASCRIPT')) {
    fail('Code.gs must serve config and client bundles as JavaScript ContentService outputs.');
  }
  if (!codeGs.includes("parameters.smoke === '1'") || !codeGs.includes('serveDeploymentSmokePage_')) {
    fail('Code.gs must expose the minimal ?smoke=1 Apps Script deployment diagnostic.');
  }
  if (!codeGs.includes('window.PIECZARGOTCHI_CONFIG')) {
    fail('Code.gs config bundle must assign window.PIECZARGOTCHI_CONFIG.');
  }
  if (codeGs.includes('setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)')) {
    fail('Code.gs should not force ALLOWALL for the public Apps Script surface.');
  }

  const devServer = readText('dev-server.mjs');
  if (!devServer.includes("url.searchParams.get('smoke') === '1'") || !devServer.includes('renderDeploymentSmokeHtml')) {
    fail('dev-server.mjs must mirror the ?smoke=1 deployment diagnostic.');
  }
}

function readIncludes(fileName) {
  return [...readText(fileName).matchAll(/include\('([^']+)'\)/g)].map((match) => match[1]);
}

function checkAppsScriptLoadOrderSafety() {
  const context = createAppsScriptVmContext({
    DriveApp: {
      getFileById(fileId) {
        throw new Error(`DriveApp unavailable during Apps Script load-order check for ${fileId}.`);
      }
    }
  });

  const serverFiles = requiredSourceFiles
    .filter((fileName) => fileName.endsWith('.gs'))
    .sort((left, right) => left.localeCompare(right));

  for (const fileName of serverFiles) {
    try {
      vm.runInContext(readText(fileName), context, { filename: fileName });
    } catch (error) {
      fail(`${fileName} has an Apps Script load-order unsafe top-level reference: ${error.message}`);
      return;
    }
  }

  try {
    const config = context.getClientConfig();
    if (!config || !Array.isArray(config.assets) || !config.assets.length) {
      fail('Apps Script load-order check produced an empty client config.');
    }
  } catch (error) {
    fail(`getClientConfig() failed after Apps Script load-order check: ${error.message}`);
  }
}

function checkStaticConfig() {
  const config = loadStaticConfig();
  if (!config) {
    return;
  }

  if (config.storageKey !== 'pieczargotchi_state_v2') {
    fail(`Unexpected storage key: ${config.storageKey}`);
  }
  if (config.stateVersion !== 8) {
    fail(`Unexpected state version: ${config.stateVersion}`);
  }
  if (!config.runtime || config.runtime.debugEnabled !== false) {
    fail('Production runtime debugEnabled must be false.');
  }
  if (!config.runtime || config.runtime.exposeRuntime !== false) {
    fail('Production runtime exposeRuntime must be false.');
  }
  if (!config.runtime || config.runtime.assetMode !== 'critical') {
    fail(`Production runtime assetMode should be critical, got ${config.runtime && config.runtime.assetMode}`);
  }
  if (!readText('Config.gs').includes('PIECZARGOTCHI_DRIVE_ASSETS_ENABLED = false')) {
    fail('Public Config.gs must keep PIECZARGOTCHI_DRIVE_ASSETS_ENABLED disabled unless Drive OAuth scopes are deliberately restored.');
  }

  const assets = Array.isArray(config.assets) ? config.assets : [];
  if (assets.length < 100) {
    fail(`Runtime asset manifest looks incomplete: ${assets.length} assets.`);
  }
  for (const key of ['spore.idle', 'spore.sleep', 'spore.wake', 'environment.grassPatch']) {
    if (!assets.some((asset) => asset.key === key)) {
      fail(`Runtime asset manifest is missing ${key}.`);
    }
  }

  const configuredIds = assets.filter((asset) => asset.hasFileId).map((asset) => asset.key);
  const folderMode = Boolean(config.assetDriveFolderConfigured);
  checkAssetDriveFolderConfig(folderMode);

  if (configuredIds.length) {
    warn(`Config.gs contains ${configuredIds.length} committed Drive asset ID(s): ${configuredIds.slice(0, 6).join(', ')}`);
    if (folderMode) {
      warn('Drive asset folder mode is configured; committed per-asset IDs will override folder lookup for those keys.');
    }
  } else if (folderMode) {
    warn('Drive asset folder mode is configured; Apps Script deployment should resolve asset IDs from manifest fileName values.');
  } else {
    warn('No Drive asset IDs or Drive asset folder are configured; deployed Apps Script smoke should verify canvas fallback rendering.');
  }
}

function checkAssetDriveFolderConfig(folderMode) {
  const configText = readText('Config.gs');
  const match = configText.match(/PIECZARGOTCHI_ASSET_DRIVE_FOLDER_ID\s*=\s*(['"])(.*?)\1/);
  const folderId = match ? match[2].trim() : '';

  if (!match) {
    fail('Config.gs is missing PIECZARGOTCHI_ASSET_DRIVE_FOLDER_ID.');
    return;
  }
  if (folderMode !== Boolean(folderId)) {
    fail('getStaticAppConfig() assetDriveFolderConfigured does not match PIECZARGOTCHI_ASSET_DRIVE_FOLDER_ID.');
  }
  if (!folderId) {
    if (!configText.includes("PIECZARGOTCHI_ASSET_DRIVE_FOLDER_PROPERTY = 'PIECZARGOTCHI_ASSET_DRIVE_FOLDER_ID'")) {
      fail('Config.gs must support the PIECZARGOTCHI_ASSET_DRIVE_FOLDER_ID script property for local-only Drive folder IDs.');
    }
    return;
  }
  if (/^https?:\/\//.test(folderId)) {
    fail('PIECZARGOTCHI_ASSET_DRIVE_FOLDER_ID must be a folder ID, not a Drive URL.');
  }
  if (/\s/.test(folderId)) {
    fail('PIECZARGOTCHI_ASSET_DRIVE_FOLDER_ID must not contain whitespace.');
  }
  if (folderId === '...' || folderId.toLowerCase() === 'folderid') {
    fail('PIECZARGOTCHI_ASSET_DRIVE_FOLDER_ID still contains a placeholder value.');
  }
}

function checkLocalPreviewConfig() {
  const context = createAppsScriptVmContext({
    Utilities: {
      base64Encode() {
        return '';
      }
    },
    DriveApp: {
      getFileById(fileId) {
        throw new Error(`DriveApp unavailable during local preview config check for ${fileId}.`);
      }
    }
  });

  const files = [
    'Config.gs',
    'AnimationConfig.gs',
    'StateModel.gs',
    'MinigamesConfig.gs',
    'EvolutionRules.gs',
    'DecorationStore.gs',
    'SyncService.gs',
    'GameRules.gs',
    'Actions.gs',
    'AssetService.gs'
  ];

  for (const fileName of files) {
    try {
      vm.runInContext(readText(fileName), context, { filename: fileName });
    } catch (error) {
      fail(`${fileName} could not be evaluated for local preview config: ${error.message}`);
      return;
    }
  }

  try {
    const config = context.getClientConfig();
    if (!config.rules || !config.rules.minigames || !config.rules.minigames.dewCatch || !config.rules.minigames.sporePop) {
      fail('Local preview config is missing configured minigames.');
    }
    if (!config.rules || !config.rules.evolution || !config.rules.evolution.variants) {
      fail('Local preview config is missing evolution variants.');
    }
    if (!Array.isArray(config.rules && config.rules.decorations) || !config.rules.decorations.length) {
      fail('Local preview config is missing decorations.');
    }
    const initialAssetDataKeys = Object.keys(config.assetData || {});
    if (config.runtime && config.runtime.assetMode === 'critical' && initialAssetDataKeys.length > 20) {
      fail(`Initial Apps Script asset payload is too large for critical mode: ${initialAssetDataKeys.length} asset records.`);
    }
    checkDebugAnimationCoverage(config);
  } catch (error) {
    fail(`getClientConfig() failed for local preview config: ${error.message}`);
  }
}

function checkDebugAnimationCoverage(config) {
  const boot = readText('ClientBoot.html');
  const optionBlock = boot.match(/const debugAnimationOptions = \[([\s\S]*?)\n  \];/);
  if (!optionBlock) {
    fail('ClientBoot.html is missing debugAnimationOptions.');
    return;
  }

  const debugIds = new Set([...optionBlock[1].matchAll(/id:\s*'([^']+)'/g)].map((match) => match[1]));
  const stageStates = new Set((config.animations || [])
    .filter((animation) => animation.kind === 'stage')
    .map((animation) => `state.${animation.state}`));
  const missing = [...stageStates].filter((id) => !debugIds.has(id)).sort();

  if (missing.length) {
    fail(`Debug animation selector is missing stage animations: ${missing.join(', ')}`);
  }
}

function checkAssetFallbackContract() {
  const runtime = readText('ClientRuntime.html');
  const sprites = readText('ClientSprites.html');
  const assetService = readText('AssetService.gs');

  if (!runtime.includes("candidates.push('assets/' + asset.fileName)")) {
    fail('ClientRuntime.html no longer tries local assets as a browser fallback candidate.');
  }
  if (!runtime.includes('Aktywne grafiki zapasowe')) {
    fail('ClientRuntime.html no longer reports fallback graphics status.');
  }
  if (!sprites.includes('drawFallbackMushroom')) {
    fail('ClientSprites.html no longer exposes fallback mushroom rendering.');
  }
  if (!assetService.includes('missingFileId')) {
    fail('AssetService.gs no longer marks missing Drive IDs for the client.');
  }
  if (!assetService.includes('getAssetDriveFileIdsFromFolder_')) {
    fail('AssetService.gs no longer supports Drive folder asset lookup.');
  }
}

function checkClaspLocalOnlyContract() {
  const gitignore = readText('.gitignore');
  if (!gitignore.split(/\r?\n/).includes('.clasp.json')) {
    fail('.gitignore must keep .clasp.json local-only.');
  }

  const tracked = gitLsFiles();
  if (tracked.includes('.clasp.json')) {
    fail('.clasp.json is tracked; remove it from Git before deployment work.');
  }

  if (existsSync(resolveRoot('.clasp.json'))) {
    const claspConfig = readJson('.clasp.json');
    if (!claspConfig || typeof claspConfig.scriptId !== 'string' || !claspConfig.scriptId.trim()) {
      fail('Local .clasp.json exists but does not contain a scriptId.');
    } else {
      warn('Local .clasp.json is present and ignored; verify it points at a test Apps Script project before pushing.');
    }
  } else {
    warn('No local .clasp.json found; run a test-project clasp bind/create before real clasp push.');
  }
}

function checkTrackedSecretLeaks() {
  const tracked = gitLsFiles();
  const suspectPatterns = [
    { name: 'Google Drive URL', pattern: /https:\/\/drive\.google\.com\/[^\s)"]+/ },
    { name: 'Apps Script URL', pattern: /https:\/\/script\.google\.com\/[^\s)"]+/ },
    { name: 'clasp scriptId field', pattern: /"scriptId"\s*:/ },
    { name: 'Google API key shape', pattern: /AIza[0-9A-Za-z_-]{20,}/ }
  ];

  for (const fileName of tracked) {
    if (!isTextFile(fileName) || !existsSync(resolveRoot(fileName))) {
      continue;
    }
    const text = readText(fileName);
    for (const item of suspectPatterns) {
      if (item.pattern.test(text)) {
        fail(`Potential secret or private deployment value in ${fileName}: ${item.name}`);
      }
    }
  }
}

function loadStaticConfig() {
  const context = createAppsScriptVmContext({
    Utilities: {
      base64Encode() {
        return '';
      }
    },
    DriveApp: {
      getFileById(fileId) {
        throw new Error(`DriveApp unavailable during readiness check for ${fileId}.`);
      }
    }
  });

  for (const fileName of ['Config.gs', 'AnimationConfig.gs']) {
    try {
      vm.runInContext(readText(fileName), context, { filename: fileName });
    } catch (error) {
      fail(`${fileName} could not be evaluated for deployment readiness: ${error.message}`);
      return null;
    }
  }

  try {
    return context.getStaticAppConfig();
  } catch (error) {
    fail(`getStaticAppConfig() failed: ${error.message}`);
    return null;
  }
}

function createAppsScriptVmContext(overrides = {}) {
  const context = Object.assign({
    console,
    Object,
    HtmlService: {
      createTemplateFromFile() {
        return {
          evaluate() {
            return {
              getContent() {
                return '';
              },
              setTitle() {
                return this;
              },
              setXFrameOptionsMode() {
                return this;
              },
              addMetaTag() {
                return this;
              }
            };
          }
        };
      },
      XFrameOptionsMode: {
        ALLOWALL: 'ALLOWALL'
      }
    },
    Utilities: {
      base64Encode() {
        return '';
      }
    }
  }, overrides);

  vm.createContext(context);
  return context;
}

function readJson(fileName) {
  try {
    return JSON.parse(readText(fileName));
  } catch (error) {
    fail(`${fileName} is not valid JSON: ${error.message}`);
    return null;
  }
}

function gitLsFiles() {
  try {
    return execFileSync('git', ['ls-files'], {
      cwd: rootDir,
      encoding: 'utf8'
    }).split(/\r?\n/).filter(Boolean);
  } catch (error) {
    warn(`Could not inspect tracked files with git ls-files: ${error.message}`);
    return [];
  }
}

function isTextFile(fileName) {
  return /\.(gs|html|mjs|js|json|md|yml|yaml|sh|ps1|txt|gitignore)$/i.test(fileName)
    || fileName === '.gitignore';
}

function report() {
  for (const warning of warnings) {
    console.warn(`warn - ${warning}`);
  }
  if (failures.length) {
    for (const failure of failures) {
      console.error(`fail - ${failure}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log('Deployment readiness check passed.');
}

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function readText(fileName) {
  return readFileSync(resolveRoot(fileName), 'utf8');
}

function resolveRoot(fileName) {
  return path.join(rootDir, fileName);
}
