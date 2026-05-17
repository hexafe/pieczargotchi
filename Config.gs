const PIECZARGOTCHI_APP_TITLE = 'Pieczargotchi';
const PIECZARGOTCHI_STORAGE_KEY = 'pieczargotchi_state_v2';
const PIECZARGOTCHI_STATE_VERSION = 7;
const PIECZARGOTCHI_CANVAS_SIZE = 512;

const PIECZARGOTCHI_RUNTIME_OPTIONS = {
  debugEnabled: false,
  exposeRuntime: false,
  assetMode: 'full'
};

const PIECZARGOTCHI_ASSET_DRIVE_FOLDER_ID = '';

const PIECZARGOTCHI_ASSET_FILE_IDS = {
  // Lokalny podglad uzywa fallbacku assets/... . Folder Drive moze uzupelnic ID po fileName.
  'environment.grassPatch': ''
};

function getStaticAppConfig() {
  const assets = getRuntimeAssetManifest();

  return {
    appTitle: PIECZARGOTCHI_APP_TITLE,
    storageKey: PIECZARGOTCHI_STORAGE_KEY,
    stateVersion: PIECZARGOTCHI_STATE_VERSION,
    canvasSize: PIECZARGOTCHI_CANVAS_SIZE,
    runtime: Object.assign({}, PIECZARGOTCHI_RUNTIME_OPTIONS),
    assetDriveFolderConfigured: Boolean(PIECZARGOTCHI_ASSET_DRIVE_FOLDER_ID),
    assets: assets.map(function(asset) {
      return Object.assign({}, asset, { hasFileId: Boolean(asset.fileId) });
    }),
    animations: getAnimationManifest()
  };
}
