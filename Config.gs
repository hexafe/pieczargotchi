const PIECZARGOTCHI_APP_TITLE = 'Pieczargotchi';
const PIECZARGOTCHI_APP_VERSION = '0.1.50';
const PIECZARGOTCHI_STORAGE_KEY = 'pieczargotchi_state_v2';
const PIECZARGOTCHI_STATE_VERSION = 18;
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
// Publiczny, niezmienny katalog PNG konkretnego wydania jest preferowany dla
// Apps Script, np. https://host/releases/0.1.50/assets/. Host musi zachowywać
// poprzednie katalogi. Adres można ustawić bez zmiany repo przez Script Properties.
const PIECZARGOTCHI_ASSET_BASE_URL = '';
const PIECZARGOTCHI_ASSET_BASE_URL_PROPERTY_PREFIX = 'PIECZARGOTCHI_ASSET_BASE_URL_';

const PIECZARGOTCHI_ASSET_FILE_IDS = {
  // Lokalny podglad uzywa fallbacku assets/... . Folder Drive moze uzupelnic ID po fileName.
  'environment.grassPatch': ''
};

function getConfiguredAssetDriveFolderId_() {
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

function getConfiguredAssetBaseUrl_() {
  const committedBaseUrl = normalizeAssetBaseUrl_(PIECZARGOTCHI_ASSET_BASE_URL);
  if (committedBaseUrl) {
    return committedBaseUrl;
  }

  if (typeof PropertiesService === 'undefined' || typeof PropertiesService.getScriptProperties !== 'function') {
    return '';
  }

  const scriptProperties = PropertiesService.getScriptProperties();
  if (!scriptProperties || typeof scriptProperties.getProperty !== 'function') {
    return '';
  }

  return normalizeAssetBaseUrl_(scriptProperties.getProperty(getAssetBaseUrlPropertyName_()));
}

function getAssetBaseUrlPropertyName_() {
  return PIECZARGOTCHI_ASSET_BASE_URL_PROPERTY_PREFIX
    + String(PIECZARGOTCHI_APP_VERSION).replace(/[^0-9A-Za-z]+/g, '_');
}

function normalizeAssetBaseUrl_(value) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return '';
  }
  if (!/^https:\/\//i.test(normalized)) {
    throw new Error('PIECZARGOTCHI_ASSET_BASE_URL musi używać HTTPS.');
  }
  if (/^https:\/\/[^/]*@/i.test(normalized) || /[?#]/.test(normalized)) {
    throw new Error('PIECZARGOTCHI_ASSET_BASE_URL nie może zawierać danych logowania, query ani fragmentu.');
  }
  const escapedVersion = String(PIECZARGOTCHI_APP_VERSION).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!(new RegExp('/v?' + escapedVersion + '(?:/|$)')).test(normalized)) {
    throw new Error('PIECZARGOTCHI_ASSET_BASE_URL musi wskazywać niezmienny katalog wydania ' + PIECZARGOTCHI_APP_VERSION + '.');
  }

  return normalized.replace(/\/+$/, '') + '/';
}

function getStaticAppConfig() {
  const assets = getRuntimeAssetManifest_();
  const assetDriveFolderId = getConfiguredAssetDriveFolderId_();
  const assetBaseUrl = getConfiguredAssetBaseUrl_();

  return {
    appTitle: PIECZARGOTCHI_APP_TITLE,
    appVersion: PIECZARGOTCHI_APP_VERSION,
    build: {
      version: PIECZARGOTCHI_APP_VERSION,
      id: 'apps-script',
      label: 'v' + PIECZARGOTCHI_APP_VERSION
    },
    storageKey: PIECZARGOTCHI_STORAGE_KEY,
    stateVersion: PIECZARGOTCHI_STATE_VERSION,
    canvasSize: PIECZARGOTCHI_CANVAS_SIZE,
    runtime: Object.assign({}, PIECZARGOTCHI_RUNTIME_OPTIONS),
    assetBaseUrl: assetBaseUrl,
    assetVersion: PIECZARGOTCHI_APP_VERSION,
    assetDriveFolderConfigured: Boolean(assetDriveFolderId),
    assets: assets.map(function(asset) {
      const publicAsset = Object.assign({}, asset, { hasFileId: Boolean(asset.fileId) });
      delete publicAsset.fileId;
      return publicAsset;
    }),
    animations: getAnimationManifest()
  };
}
