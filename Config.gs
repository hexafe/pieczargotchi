const PIECZARGOTCHI_APP_TITLE = 'Pieczargotchi';
const PIECZARGOTCHI_STORAGE_KEY = 'pieczargotchi_state_v2';
const PIECZARGOTCHI_STATE_VERSION = 7;
const PIECZARGOTCHI_CANVAS_SIZE = 512;

const PIECZARGOTCHI_RUNTIME_OPTIONS = {
  debugEnabled: false,
  exposeRuntime: false,
  assetMode: 'full'
};

const PIECZARGOTCHI_ASSET_FILE_IDS = {
  // Local preview uses assets/... fallback. Fill Drive file IDs before Apps Script deployment.
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
    assets: assets.map(function(asset) {
      return Object.assign({}, asset, { hasFileId: Boolean(asset.fileId) });
    }),
    animations: getAnimationManifest()
  };
}
