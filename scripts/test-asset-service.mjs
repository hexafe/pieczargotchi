import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const context = {
  console,
  Object,
  Utilities: {
    base64Encode(bytes) {
      return `encoded-${Array.from(bytes).join('-')}`;
    }
  },
  DriveApp: createDriveAppMock()
};

vm.createContext(context);

for (const fileName of ['Config.gs', 'AnimationConfig.gs', 'AssetService.gs']) {
  vm.runInContext(readText(fileName), context, { filename: fileName });
}

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

function readText(fileName) {
  let text = readFileSync(path.join(rootDir, fileName), 'utf8');
  if (fileName === 'Config.gs') {
    text = text
      .replace("const PIECZARGOTCHI_ASSET_DRIVE_FOLDER_ID = '';", "const PIECZARGOTCHI_ASSET_DRIVE_FOLDER_ID = 'root-folder';")
      .replace("'environment.grassPatch': ''", "'environment.grassPatch': 'manual-grass'");
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
