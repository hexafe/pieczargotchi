const PIECZARGOTCHI_APP_TITLE = 'Pieczargotchi';
const PIECZARGOTCHI_STORAGE_KEY = 'pieczargotchi_state_v2';
const PIECZARGOTCHI_STATE_VERSION = 8;
const PIECZARGOTCHI_CANVAS_SIZE = 512;

const PIECZARGOTCHI_RUNTIME_OPTIONS = {
  debugEnabled: false,
  exposeRuntime: false,
  assetMode: 'critical'
};

// Publiczny web app pozostaje bez Drive OAuth scope; wlaczenie Drive wymaga
// osobnej weryfikacji OAuth i dodania odpowiednich scope w appsscript.json.
const PIECZARGOTCHI_DRIVE_ASSETS_ENABLED = false;
const PIECZARGOTCHI_ASSET_DRIVE_FOLDER_ID = '';
const PIECZARGOTCHI_ASSET_DRIVE_FOLDER_PROPERTY = 'PIECZARGOTCHI_ASSET_DRIVE_FOLDER_ID';

const PIECZARGOTCHI_ASSET_FILE_IDS = {
  // Lokalny podglad uzywa fallbacku assets/... . Folder Drive moze uzupelnic ID po fileName.
  'environment.grassPatch': ''
};

function getConfiguredAssetDriveFolderId() {
  if (!PIECZARGOTCHI_DRIVE_ASSETS_ENABLED) {
    return '';
  }

  const committedFolderId = String(PIECZARGOTCHI_ASSET_DRIVE_FOLDER_ID || '').trim();
  if (committedFolderId) {
    return committedFolderId;
  }

  if (typeof PropertiesService === 'undefined' || typeof PropertiesService.getScriptProperties !== 'function') {
    return '';
  }

  const scriptProperties = PropertiesService.getScriptProperties();
  if (!scriptProperties || typeof scriptProperties.getProperty !== 'function') {
    return '';
  }

  return String(scriptProperties.getProperty(PIECZARGOTCHI_ASSET_DRIVE_FOLDER_PROPERTY) || '').trim();
}

function getStaticAppConfig() {
  const assets = getRuntimeAssetManifest();
  const assetDriveFolderId = getConfiguredAssetDriveFolderId();

  return {
    appTitle: PIECZARGOTCHI_APP_TITLE,
    storageKey: PIECZARGOTCHI_STORAGE_KEY,
    stateVersion: PIECZARGOTCHI_STATE_VERSION,
    canvasSize: PIECZARGOTCHI_CANVAS_SIZE,
    runtime: Object.assign({}, PIECZARGOTCHI_RUNTIME_OPTIONS),
    assetDriveFolderConfigured: Boolean(assetDriveFolderId),
    assets: assets.map(function(asset) {
      return Object.assign({}, asset, { hasFileId: Boolean(asset.fileId) });
    }),
    animations: getAnimationManifest()
  };
}
