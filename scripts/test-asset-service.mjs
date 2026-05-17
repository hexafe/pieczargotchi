import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const context = createAssetServiceContext({
  folderIdSource: 'constant',
  manualGrassId: 'manual-grass'
});

test('Drive folder lookup resolves manifest paths and keeps manual overrides', () => {
  const assetData = context.getAssetDataUrls();

  assert(assetData['spore.idle'].status === 'loaded', 'spore idle should load from recursive Drive folder path');
  assert(assetData['spore.idle'].source === 'folder', `expected folder source, got ${assetData['spore.idle'].source}`);
  assert(assetData['spore.idle'].dataUrl === 'data:image/png;base64,encoded-drive-spore-idle', 'unexpected spore idle data URL');

  assert(assetData['adult.idle'].status === 'loaded', 'adult idle should load despite duplicate idle_sheet.png basename');
  assert(assetData['adult.idle'].source === 'folder', `expected folder source, got ${assetData['adult.idle'].source}`);
  assert(assetData['adult.idle'].dataUrl === 'data:image/png;base64,encoded-drive-adult-idle', 'unexpected adult idle data URL');

  assert(assetData['effect.drops'].status === 'loaded', 'effect drops should load from Drive folder');
  assert(assetData['effect.drops'].source === 'folder', `expected folder source, got ${assetData['effect.drops'].source}`);

  assert(assetData['environment.grassPatch'].status === 'loaded', 'manual environment override should load');
  assert(assetData['environment.grassPatch'].source === 'manual', `expected manual source, got ${assetData['environment.grassPatch'].source}`);
  assert(assetData['environment.grassPatch'].dataUrl === 'data:image/png;base64,encoded-manual-grass', 'unexpected manual override data URL');
});

test('Drive folder lookup can use local-only Apps Script property', () => {
  const propertyContext = createAssetServiceContext({
    folderIdSource: 'scriptProperty',
    manualGrassId: 'manual-grass'
  });
  const staticConfig = propertyContext.getStaticAppConfig();
  const assetData = propertyContext.getAssetDataUrls();

  assert(staticConfig.assetDriveFolderConfigured === true, 'script property folder should mark asset folder mode configured');
  assert(propertyContext.getConfiguredAssetDriveFolderId() === 'root-folder', 'script property should provide the folder ID');
  assert(assetData['spore.idle'].status === 'loaded', 'spore idle should load from script property Drive folder');
  assert(assetData['spore.idle'].source === 'folder', `expected folder source, got ${assetData['spore.idle'].source}`);
});

test('critical initial asset data keeps the first Apps Script payload small', () => {
  const initialAssetData = context.getInitialAssetDataUrls_(context.getRuntimeAssetManifest(), { assetMode: 'critical' });
  const keys = Object.keys(initialAssetData);

  assert(initialAssetData['spore.idle'].status === 'loaded', 'critical payload should include required spore idle');
  assert(initialAssetData['environment.grassPatch'].status === 'loaded', 'critical payload should include environment assets');
  assert(!initialAssetData['adult.idle'], 'critical payload should not inline adult idle');
  assert(!initialAssetData['effect.drops'], 'critical payload should not inline effect drops');
  assert(keys.length < 10, `critical payload should stay small, got ${keys.length} records`);
});

test('single asset data lookup supports lazy client loading', () => {
  const drops = context.getAssetDataUrl('effect.drops');
  const unknown = context.getAssetDataUrl('missing.asset');

  assert(drops.status === 'loaded', 'lazy effect lookup should load effect drops');
  assert(drops.source === 'folder', `expected folder source, got ${drops.source}`);
  assert(drops.dataUrl === 'data:image/png;base64,encoded-drive-drops', 'unexpected lazy effect data URL');
  assert(unknown.status === 'missingFileId', 'unknown lazy lookup should return a missing record');
});

function createAssetServiceContext(options) {
  const testContext = {
    console,
    Object,
    Utilities: {
      base64Encode(bytes) {
        return `encoded-${Array.from(bytes).join('-')}`;
      }
    },
    DriveApp: createDriveAppMock()
  };

  if (options.folderIdSource === 'scriptProperty') {
    testContext.PropertiesService = {
      getScriptProperties() {
        return {
          getProperty(name) {
            return name === 'PIECZARGOTCHI_ASSET_DRIVE_FOLDER_ID' ? 'root-folder' : '';
          }
        };
      }
    };
  }

  vm.createContext(testContext);

  for (const fileName of ['Config.gs', 'AnimationConfig.gs', 'AssetService.gs']) {
    vm.runInContext(readText(fileName, options), testContext, { filename: fileName });
  }

  return testContext;
}

function readText(fileName, options) {
  let text = readFileSync(path.join(rootDir, fileName), 'utf8');
  if (fileName === 'Config.gs') {
    if (options.folderIdSource === 'constant') {
      text = text.replace("const PIECZARGOTCHI_ASSET_DRIVE_FOLDER_ID = '';", "const PIECZARGOTCHI_ASSET_DRIVE_FOLDER_ID = 'root-folder';");
    }
    text = text.replace("'environment.grassPatch': ''", `'environment.grassPatch': '${options.manualGrassId}'`);
  }
  return text;
}

function createDriveAppMock() {
  const files = new Map();
  const rootFolder = folder('root-folder', 'assets', [], [
    folder('folder-stages', 'stages', [], [
      folder('folder-spore', 'spore', [
        file('drive-spore-idle', 'idle_sheet.png')
      ]),
      folder('folder-adult', 'adult', [
        file('drive-adult-idle', 'idle_sheet.png')
      ])
    ]),
    folder('folder-effects', 'effects', [
      file('drive-drops', 'drops_sheet.png')
    ])
  ]);
  files.set('manual-grass', file('manual-grass', 'grass_patch.png'));

  return {
    getFolderById(folderId) {
      if (folderId !== 'root-folder') {
        throw new Error(`Nieznany folder testowy: ${folderId}`);
      }
      return rootFolder;
    },
    getFileById(fileId) {
      const foundFile = files.get(fileId);
      if (!foundFile) {
        throw new Error(`Nieznany plik testowy: ${fileId}`);
      }
      return foundFile;
    }
  };

  function folder(id, name, folderFiles = [], childFolders = []) {
    for (const item of folderFiles) {
      files.set(item.getId(), item);
    }
    for (const child of childFolders) {
      collectFiles(child);
    }
    return {
      getId: () => id,
      getName: () => name,
      getFiles: () => iterator(folderFiles),
      getFolders: () => iterator(childFolders)
    };
  }

  function collectFiles(currentFolder) {
    const folderFiles = currentFolder.getFiles();
    while (folderFiles.hasNext()) {
      const item = folderFiles.next();
      files.set(item.getId(), item);
    }
    const childFolders = currentFolder.getFolders();
    while (childFolders.hasNext()) {
      collectFiles(childFolders.next());
    }
  }
}

function file(id, name) {
  return {
    getId: () => id,
    getName: () => name,
    getBlob: () => ({
      getContentType: () => 'image/png',
      getBytes: () => [id]
    })
  };
}

function iterator(items) {
  let index = 0;
  return {
    hasNext: () => index < items.length,
    next: () => items[index++]
  };
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
