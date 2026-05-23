function getClientConfig() {
  const config = getStaticAppConfig();

  config.state = getStateModelConfig();
  config.rules = getGameRulesConfig();
  config.actions = getActionDefinitions();
  config.assetData = getInitialAssetDataUrls_(config.assets, config.runtime);

  return config;
}

function getAssetDataUrl(assetKey) {
  const key = String(assetKey || '');
  if (!key) {
    return createMissingAssetDataRecord_('', '', false, 'Brak klucza grafiki.');
  }

  const asset = getRuntimeAssetManifest().filter(function(item) {
    return item.key === key;
  })[0];
  if (!asset) {
    return createMissingAssetDataRecord_(key, '', false, 'Nieznana grafika runtime.');
  }

  const assetData = getAssetDataUrls([key]);
  return assetData[key] || createMissingAssetDataRecord_(asset.key, asset.fileName, asset.required, 'Nie znaleziono grafiki runtime.');
}

function getAssetDataUrls(assetKeys) {
  const requestedKeys = normalizeAssetKeyFilter_(assetKeys);
  const assets = getRuntimeAssetManifest().filter(function(asset) {
    return !requestedKeys || requestedKeys[asset.key];
  });
  const folderLookup = getAssetDriveFileIdsFromFolder_(assets);

  return assets.reduce(function(result, asset) {
    const folderFileId = folderLookup.fileIds[asset.key] || '';
    const fileId = asset.fileId || folderFileId;
    const source = asset.fileId ? 'manual' : (folderFileId ? 'folder' : null);

    result[asset.key] = createAssetDataRecord_(asset, fileId, source, folderLookup);

    if (!fileId) {
      return result;
    }

    try {
      result[asset.key].dataUrl = fileToDataUrl(fileId);
      result[asset.key].status = 'loaded';
      result[asset.key].error = null;
    } catch (error) {
      result[asset.key].status = 'error';
      result[asset.key].error = error && error.message ? error.message : String(error);
    }

    return result;
  }, {});
}

function getInitialAssetDataUrls_(assets, runtimeOptions) {
  return getAssetDataUrls(getInitialAssetManifest_(assets, runtimeOptions).map(function(asset) {
    return asset.key;
  }));
}

function getInitialAssetManifest_(assets, runtimeOptions) {
  const manifest = Array.isArray(assets) ? assets : getRuntimeAssetManifest();
  const assetMode = runtimeOptions && runtimeOptions.assetMode;

  if (assetMode !== 'critical') {
    return manifest;
  }

  return manifest.filter(function(asset) {
    return asset.required || asset.kind === 'environment';
  });
}

function normalizeAssetKeyFilter_(assetKeys) {
  if (!Array.isArray(assetKeys)) {
    return null;
  }

  return assetKeys.reduce(function(result, key) {
    const normalized = String(key || '').trim();
    if (normalized) {
      result[normalized] = true;
    }
    return result;
  }, {});
}

function createAssetDataRecord_(asset, fileId, source, folderLookup) {
  return {
    fileName: asset.fileName,
    required: asset.required,
    dataUrl: null,
    source: source,
    status: fileId ? 'unloaded' : 'missingFileId',
    error: fileId ? null : getMissingAssetFileIdMessage_(folderLookup)
  };
}

function createMissingAssetDataRecord_(key, fileName, required, error) {
  return {
    key: key,
    fileName: fileName,
    required: Boolean(required),
    dataUrl: null,
    source: null,
    status: 'missingFileId',
    error: error
  };
}

function getAssetDriveFileIdsFromFolder_(assets) {
  const fileIds = {};
  const assetDriveFolderId = getConfiguredAssetDriveFolderId();

  if (!assetDriveFolderId) {
    return { fileIds: fileIds, error: null };
  }

  if (typeof DriveApp === 'undefined' || typeof DriveApp.getFolderById !== 'function') {
    return {
      fileIds: fileIds,
      error: 'DriveApp.getFolderById nie jest dostępne w tym środowisku.'
    };
  }

  try {
    const index = buildDriveFolderAssetIndex_(DriveApp.getFolderById(assetDriveFolderId));

    assets.forEach(function(asset) {
      if (asset.fileId) {
        return;
      }

      const normalizedFileName = normalizeAssetFileName_(asset.fileName);
      const baseName = getAssetBaseName_(normalizedFileName);
      const matchedFileId = index.byPath[normalizedFileName] || index.byName[baseName] || '';

      if (matchedFileId) {
        fileIds[asset.key] = matchedFileId;
      }
    });

    return { fileIds: fileIds, error: null };
  } catch (error) {
    return {
      fileIds: fileIds,
      error: error && error.message ? error.message : String(error)
    };
  }
}

function buildDriveFolderAssetIndex_(rootFolder) {
  const index = {
    byPath: {},
    byName: {},
    duplicateNames: {}
  };

  scanDriveAssetFolder_(rootFolder, '', index, {});

  Object.keys(index.duplicateNames).forEach(function(fileName) {
    delete index.byName[fileName];
  });

  return index;
}

function scanDriveAssetFolder_(folder, pathPrefix, index, visitedFolders) {
  const folderId = typeof folder.getId === 'function' ? folder.getId() : '';

  if (folderId && visitedFolders[folderId]) {
    return;
  }
  if (folderId) {
    visitedFolders[folderId] = true;
  }

  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    const fileName = file.getName();
    const normalizedPath = normalizeAssetFileName_(pathPrefix + fileName);

    index.byPath[normalizedPath] = file.getId();
    if (index.byName[fileName]) {
      index.duplicateNames[fileName] = true;
    } else {
      index.byName[fileName] = file.getId();
    }
  }

  const folders = folder.getFolders();
  while (folders.hasNext()) {
    const childFolder = folders.next();
    const childPathPrefix = pathPrefix + childFolder.getName() + '/';
    scanDriveAssetFolder_(childFolder, childPathPrefix, index, visitedFolders);
  }
}

function normalizeAssetFileName_(fileName) {
  return String(fileName || '').replace(/\\/g, '/').replace(/^assets\//, '').replace(/^\/+/, '');
}

function getAssetBaseName_(fileName) {
  const parts = normalizeAssetFileName_(fileName).split('/');
  return parts[parts.length - 1] || '';
}

function getMissingAssetFileIdMessage_(folderLookup) {
  if (folderLookup.error) {
    return 'Nie udało się odczytać folderu Drive z grafikami: ' + folderLookup.error;
  }
  if (getConfiguredAssetDriveFolderId()) {
    return 'Nie znaleziono pliku w folderze Drive po ścieżce z manifestu.';
  }
  return 'ID pliku Drive nie jest ustawione.';
}

function fileToDataUrl(fileId) {
  if (!fileId) {
    return null;
  }
  if (!PIECZARGOTCHI_DRIVE_ASSETS_ENABLED) {
    throw new Error('Ładowanie grafik z Drive jest wyłączone dla publicznego wdrożenia.');
  }

  const file = DriveApp.getFileById(fileId);
  const blob = file.getBlob();
  const contentType = blob.getContentType() || 'image/png';
  const encoded = Utilities.base64Encode(blob.getBytes());

  return 'data:' + contentType + ';base64,' + encoded;
}
