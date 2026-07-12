import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const rootDir = path.dirname(path.dirname(scriptPath));
const packageVersion = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8')).version;
const criticalAssetKeys = [
  'environment.grassPatch',
  'spore.idle',
  'spore.sleep',
  'spore.wake'
];

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  await main();
}

async function main() {
  const deploymentUrl = validateDeploymentUrl(process.env.PIECZARGOTCHI_APPS_SCRIPT_WEB_APP_URL);
  const configUrl = new URL(deploymentUrl);
  configUrl.searchParams.set('bundle', 'config');
  configUrl.searchParams.set('v', packageVersion);

  const configResponse = await fetchWithTimeout(configUrl, 20000);
  if (!configResponse.ok) {
    throw new Error(`Apps Script config zwrócił HTTP ${configResponse.status}: ${configUrl}`);
  }
  const config = parseClientConfigBundle(await configResponse.text());
  validateReleaseConfig(config, packageVersion);

  const manifest = new Map((config.assets || []).map((asset) => [asset.key, asset]));
  for (const key of criticalAssetKeys) {
    const asset = manifest.get(key);
    if (!asset || !asset.fileName) {
      throw new Error(`Wdrożony manifest nie zawiera krytycznego assetu ${key}.`);
    }
    await verifyPngAsset(config.assetBaseUrl, asset, config.assetVersion || config.appVersion);
  }

  console.log(`Apps Script release gate passed: ${config.appVersion}, ${criticalAssetKeys.length} krytyczne PNG.`);
}

function validateDeploymentUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    throw new Error('Ustaw PIECZARGOTCHI_APPS_SCRIPT_WEB_APP_URL na URL wdrożenia /exec przed release gate.');
  }
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('PIECZARGOTCHI_APPS_SCRIPT_WEB_APP_URL nie jest poprawnym URL-em.');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
    throw new Error('PIECZARGOTCHI_APPS_SCRIPT_WEB_APP_URL musi być publicznym adresem HTTPS bez danych logowania i fragmentu.');
  }
  url.search = '';
  return url;
}

function parseClientConfigBundle(source) {
  const match = String(source || '').match(/^\s*window\.PIECZARGOTCHI_CONFIG\s*=\s*([\s\S]*);\s*$/);
  if (!match) {
    throw new Error('Endpoint ?bundle=config nie zwrócił oczekiwanego bundle klienta.');
  }
  try {
    return JSON.parse(match[1]);
  } catch (error) {
    throw new Error(`Nie można odczytać wdrożonego configu Apps Script: ${error.message}`);
  }
}

function validateReleaseConfig(config, expectedVersion) {
  if (!config || config.appVersion !== expectedVersion || config.assetVersion !== expectedVersion) {
    throw new Error(`Wdrożony config/asset version musi wynosić ${expectedVersion}.`);
  }
  if (!config.runtime || config.runtime.debugEnabled !== false || config.runtime.exposeRuntime !== false || config.runtime.assetMode !== 'critical') {
    throw new Error('Wdrożony Apps Script nie ma produkcyjnych flag runtime.');
  }
  validateImmutableAssetBaseUrl(config.assetBaseUrl, expectedVersion);
  if (!Array.isArray(config.assets) || !config.assets.length) {
    throw new Error('Wdrożony config Apps Script ma pusty manifest assetów.');
  }
  const keys = new Set();
  for (const asset of config.assets) {
    validateRuntimeAssetContract(asset);
    if (keys.has(asset.key)) {
      throw new Error(`Wdrożony manifest zawiera zduplikowany klucz ${asset.key}.`);
    }
    keys.add(asset.key);
  }
}

function validateImmutableAssetBaseUrl(value, version) {
  let url;
  try {
    url = new URL(String(value || ''));
  } catch {
    throw new Error('Wdrożony Apps Script nie ma poprawnego PIECZARGOTCHI_ASSET_BASE_URL.');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('Wdrożony PIECZARGOTCHI_ASSET_BASE_URL musi być publicznym adresem HTTPS bez sekretów i query.');
  }
  const segments = url.pathname.split('/').filter(Boolean).map((segment) => decodeURIComponent(segment));
  if (!segments.includes(version) && !segments.includes(`v${version}`)) {
    throw new Error(`PIECZARGOTCHI_ASSET_BASE_URL musi wskazywać zachowany katalog wydania ${version}.`);
  }
  return url;
}

async function verifyPngAsset(baseUrl, asset, version) {
  const base = validateImmutableAssetBaseUrl(baseUrl, version);
  const fileName = asset && asset.fileName;
  const relativePath = String(fileName || '').replace(/\\/g, '/').replace(/^assets\//, '');
  if (!relativePath || relativePath.split('/').includes('..') || !relativePath.toLowerCase().endsWith('.png')) {
    throw new Error(`Niebezpieczna ścieżka krytycznego PNG: ${JSON.stringify(fileName)}`);
  }
  const encodedPath = relativePath.split('/').map(encodeURIComponent).join('/');
  const assetUrl = new URL(encodedPath, base.href.endsWith('/') ? base.href : `${base.href}/`);
  assetUrl.searchParams.set('v', version);
  const response = await fetchWithTimeout(assetUrl, 20000);
  if (!response.ok) {
    throw new Error(`Krytyczny PNG ${fileName} zwrócił HTTP ${response.status}.`);
  }
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('image/png')) {
    throw new Error(`Krytyczny asset ${fileName} ma MIME ${contentType || 'brak'}, oczekiwano image/png.`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 32 || !pngSignature.every((byte, index) => bytes[index] === byte)) {
    throw new Error(`Krytyczny asset ${fileName} nie jest poprawnym plikiem PNG.`);
  }
  const dimensions = readPngDimensions(bytes);
  if (dimensions.width !== asset.width || dimensions.height !== asset.height) {
    throw new Error(
      `Krytyczny PNG ${fileName} ma ${dimensions.width}x${dimensions.height}, `
      + `a wdrożony manifest oczekuje ${asset.width}x${asset.height}.`
    );
  }
}

function validateRuntimeAssetContract(asset) {
  if (!asset || typeof asset !== 'object') {
    throw new Error('Wdrożony manifest zawiera niepoprawny wpis assetu.');
  }
  const key = String(asset.key || '').trim();
  const fileName = String(asset.fileName || '').replace(/\\/g, '/');
  if (!key || !fileName || fileName.startsWith('/') || fileName.split('/').includes('..') || !fileName.endsWith('.png')) {
    throw new Error(`Wdrożony manifest zawiera niebezpieczny wpis assetu ${key || '(bez klucza)'}.`);
  }
  for (const field of ['width', 'height', 'frames']) {
    if (!Number.isInteger(asset[field]) || asset[field] <= 0) {
      throw new Error(`Asset ${key} ma niepoprawne ${field}.`);
    }
  }

  const isTightSprite = /^(?:stages|activities|easter-eggs|effects)\//.test(fileName);
  if (!isTightSprite) {
    return asset;
  }
  for (const field of ['frameWidth', 'frameHeight', 'storedFrameCount', 'drawX', 'drawY']) {
    if (!Number.isInteger(asset[field])) {
      throw new Error(`Tight atlas ${key} nie ma całkowitego pola ${field}.`);
    }
  }
  if (asset.frameWidth <= 0 || asset.frameHeight <= 0 || asset.storedFrameCount <= 0
    || asset.frameWidth > 512 || asset.frameHeight > 512 || asset.storedFrameCount > asset.frames
    || asset.drawX < 0 || asset.drawY < 0
    || asset.drawX + asset.frameWidth > 512 || asset.drawY + asset.frameHeight > 512) {
    throw new Error(`Tight atlas ${key} ma niespójny układ logicznej klatki.`);
  }
  if (asset.width !== asset.frameWidth * asset.storedFrameCount || asset.height !== asset.frameHeight) {
    throw new Error(`Tight atlas ${key} ma wymiary sprzeczne ze storedFrameCount.`);
  }
  if (!Array.isArray(asset.frameSequence) || asset.frameSequence.length !== asset.frames
    || asset.frameSequence.some((index) => !Number.isInteger(index) || index < 0 || index >= asset.storedFrameCount)) {
    throw new Error(`Tight atlas ${key} ma niepoprawne frameSequence.`);
  }
  if (asset.bakedGrass !== false) {
    throw new Error(`Tight atlas ${key} musi jawnie deklarować bakedGrass=false.`);
  }
  return asset;
}

function readPngDimensions(bytes) {
  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!bytes || bytes.length < 24 || !pngSignature.every((byte, index) => bytes[index] === byte)
    || String.fromCharCode(...bytes.slice(12, 16)) !== 'IHDR') {
    throw new Error('PNG nie zawiera prawidłowego nagłówka IHDR.');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    width: view.getUint32(16),
    height: view.getUint32(20)
  };
}

async function fetchWithTimeout(url, timeoutMs) {
  return fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: 'application/javascript,image/png;q=0.9,*/*;q=0.1' }
  });
}

export {
  parseClientConfigBundle,
  validateDeploymentUrl,
  validateImmutableAssetBaseUrl,
  validateReleaseConfig,
  validateRuntimeAssetContract,
  readPngDimensions
};
