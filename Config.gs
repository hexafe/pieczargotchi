const PIECZARGOTCHI_APP_TITLE = 'Pieczargotchi';
const PIECZARGOTCHI_STORAGE_KEY = 'pieczargotchi_state_v2';
const PIECZARGOTCHI_STATE_VERSION = 2;
const PIECZARGOTCHI_CANVAS_SIZE = 512;

const PIECZARGOTCHI_ASSET_FILE_IDS = {
};

function getStaticAppConfig() {
  const assets = getRuntimeAssetManifest();

  return {
    appTitle: PIECZARGOTCHI_APP_TITLE,
    storageKey: PIECZARGOTCHI_STORAGE_KEY,
    stateVersion: PIECZARGOTCHI_STATE_VERSION,
    canvasSize: PIECZARGOTCHI_CANVAS_SIZE,
    assets: assets.map(function(asset) {
      return Object.assign({}, asset, { hasFileId: Boolean(asset.fileId) });
    }),
    animations: getAnimationManifest()
  };
}
