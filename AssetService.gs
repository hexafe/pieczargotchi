function getClientConfig() {
  const config = getStaticAppConfig();

  config.state = getStateModelConfig();
  config.rules = getGameRulesConfig();
  config.actions = getActionDefinitions();
  config.assetData = getAssetDataUrls();

  return config;
}

function getAssetDataUrls() {
  const assets = getRuntimeAssetManifest();
  const folderLookup = getAssetDriveFileIdsFromFolder_(assets);

  return assets.reduce(function(result, asset) {
    const folderFileId = folderLookup.fileIds[asset.key] || '';
    const fileId = asset.fileId || folderFileId;
    const source = asset.fileId ? 'manual' : (folderFileId ? 'folder' : null);

    result[asset.key] = {
      fileName: asset.fileName,
      required: asset.required,
      dataUrl: null,
      source: source,
      status: fileId ? 'unloaded' : 'missingFileId',
      error: fileId ? null : getMissingAssetFileIdMessage_(folderLookup)
    };

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

function getAssetDriveFileIdsFromFolder_(assets) {
  const fileIds = {};
  const assetDriveFolderId = getConfiguredAssetDriveFolderId();

  if (!assetDriveFolderId) {
    return { fileIds: fileIds, error: null };
  }

  if (typeof DriveApp === 'undefined' || typeof DriveApp.getFolderById !== 'function') {
    return {
      fileIds: fileIds,
      error: 'DriveApp.getFolderById nie jest dostepne w tym srodowisku.'
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
    return 'Nie udalo sie odczytac folderu Drive z assetami: ' + folderLookup.error;
  }
  if (getConfiguredAssetDriveFolderId()) {
    return 'Nie znaleziono pliku w folderze Drive po sciezce z manifestu.';
  }
  return 'ID pliku Drive nie jest ustawione.';
}

function fileToDataUrl(fileId) {
  if (!fileId) {
    return null;
  }

  const file = DriveApp.getFileById(fileId);
  const blob = file.getBlob();
  const contentType = blob.getContentType() || 'image/png';
  const encoded = Utilities.base64Encode(blob.getBytes());

  return 'data:' + contentType + ';base64,' + encoded;
}
