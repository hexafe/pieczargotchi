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
  'Actions.gs',
  'Index.html',
  'Styles.html',
  'Client.html',
  'ClientCore.html',
  'ClientBoot.html',
  'ClientDebug.html',
  'ClientRuntime.html',
  'ClientWeather.html',
  'ClientState.html',
  'ClientActions.html',
  'ClientUi.html',
  'ClientBattleScene.html',
  'ClientAnimation.html',
  'ClientScene.html',
  'ClientScenePalette.html',
  'ClientSceneCelestial.html',
  'ClientSceneWeather.html',
  'ClientSceneLife.html',
  'ClientSceneGround.html',
  'ClientSprites.html',
  'appsscript.json'
];

const expectedClientIncludes = [
  'ClientBoot',
  'ClientDebug',
  'ClientRuntime',
  'ClientWeather',
  'ClientState',
  'ClientActions',
  'ClientUi',
  'ClientBattleScene',
  'ClientAnimation',
  'ClientScene',
  'ClientScenePalette',
  'ClientSceneCelestial',
  'ClientSceneWeather',
  'ClientSceneLife',
  'ClientSceneGround',
  'ClientSprites'
];

main();

function main() {
  checkRequiredFiles();
  checkAppsScriptManifest();
  checkHtmlIncludes();
  checkStaticConfig();
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
  if (!manifest.webapp) {
    fail('appsscript.json is missing webapp config.');
    return;
  }
  if (manifest.webapp.access !== 'ANYONE') {
    fail(`webapp.access should be ANYONE for the public dry-run web app, got ${JSON.stringify(manifest.webapp.access)}`);
  }
  if (manifest.webapp.executeAs !== 'USER_DEPLOYING') {
    fail(`webapp.executeAs should be USER_DEPLOYING, got ${JSON.stringify(manifest.webapp.executeAs)}`);
  }
}

function checkHtmlIncludes() {
  const indexHtml = readText('Index.html');
  for (const includeName of ['Styles', 'ClientCore', 'Client']) {
    if (!indexHtml.includes(`include('${includeName}')`)) {
      fail(`Index.html does not include ${includeName}.`);
    }
  }
  if (!indexHtml.includes('window.PIECZARGOTCHI_CONFIG')) {
    fail('Index.html does not inject window.PIECZARGOTCHI_CONFIG.');
  }

  const clientHtml = readText('Client.html');
  const includes = [...clientHtml.matchAll(/include\('([^']+)'\)/g)].map((match) => match[1]);
  const duplicates = includes.filter((item, index) => includes.indexOf(item) !== index);
  for (const includeName of expectedClientIncludes) {
    if (!includes.includes(includeName)) {
      fail(`Client.html does not include ${includeName}.`);
    }
  }
  if (duplicates.length) {
    fail(`Client.html has duplicate includes: ${[...new Set(duplicates)].join(', ')}`);
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
  if (config.stateVersion !== 3) {
    fail(`Unexpected state version: ${config.stateVersion}`);
  }
  if (!config.runtime || config.runtime.debugEnabled !== false) {
    fail('Production runtime debugEnabled must be false.');
  }
  if (!config.runtime || config.runtime.exposeRuntime !== false) {
    fail('Production runtime exposeRuntime must be false.');
  }
  if (!config.runtime || config.runtime.assetMode !== 'full') {
    fail(`Production runtime assetMode should be full, got ${config.runtime && config.runtime.assetMode}`);
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
  if (configuredIds.length) {
    warn(`Config.gs contains ${configuredIds.length} committed Drive asset ID(s): ${configuredIds.slice(0, 6).join(', ')}`);
  } else {
    warn('No Drive asset IDs are configured; deployed Apps Script smoke should verify canvas fallback rendering.');
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
  const context = {
    console,
    Object,
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
  };
  vm.createContext(context);

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
