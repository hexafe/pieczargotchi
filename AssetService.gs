function getClientConfig() {
  const config = getStaticAppConfig();

  config.state = getStateModelConfig();
  config.rules = getGameRulesConfig();
  config.actions = getActionDefinitions();
  config.assetData = getAssetDataUrls();

  return config;
}

function getAssetDataUrls() {
  return getRuntimeAssetManifest().reduce(function(result, asset) {
    result[asset.key] = {
      fileName: asset.fileName,
      required: asset.required,
      dataUrl: null,
      status: asset.fileId ? 'unloaded' : 'missingFileId',
      error: asset.fileId ? null : 'ID pliku Drive nie jest ustawione.'
    };

    if (!asset.fileId) {
      return result;
    }

    try {
      result[asset.key].dataUrl = fileToDataUrl(asset.fileId);
      result[asset.key].status = 'loaded';
      result[asset.key].error = null;
    } catch (error) {
      result[asset.key].status = 'error';
      result[asset.key].error = error && error.message ? error.message : String(error);
    }

    return result;
  }, {});
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
