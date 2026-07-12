import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const scriptPath = fileURLToPath(import.meta.url);
const rootDir = path.dirname(path.dirname(scriptPath));
const outputDirectoryName = getOutputDirectoryName();
const distDir = path.join(rootDir, outputDirectoryName);
const assetOutputDir = path.join(distDir, 'assets');

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  await main();
}

async function main() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  const artifacts = buildCloudflareStaticArtifacts();

  await writeFile(path.join(distDir, 'index.html'), artifacts.indexHtml, 'utf8');
  await writeFile(path.join(distDir, 'config.js'), artifacts.configBundle, 'utf8');
  await writeFile(path.join(distDir, 'core.js'), artifacts.coreBundle, 'utf8');
  await writeFile(path.join(distDir, 'client.js'), artifacts.clientBundle, 'utf8');
  await copyRuntimeAssets(artifacts.config.assets || []);

  console.log(`Cloudflare static build complete: ${path.relative(rootDir, distDir)}`);
}

function buildCloudflareStaticArtifacts() {
  const config = buildClientConfig();
  config.assetVersions = buildAssetVersionMap(config.assets);
  const coreBundle = renderScriptBundle('ClientCore.html');
  const clientBundle = renderScriptBundle('Client.html');
  config.build = buildStaticBuildMetadata(config, coreBundle, clientBundle);
  const configBundle = renderConfigBundle(config);
  const versions = {
    config: getBundleVersion(configBundle),
    core: getBundleVersion(coreBundle),
    client: getBundleVersion(clientBundle)
  };
  const indexHtml = renderCloudflareHtml(versions, config.assetVersions);
  return {
    config,
    configBundle,
    coreBundle,
    clientBundle,
    indexHtml,
    versions
  };
}

function renderCloudflareHtml(versions, assetVersions) {
  return addCloudflarePreloads(renderTemplate('Index.html')
    .replace(/^\s*<base target="_top">\s*$/m, '')
    .replace(/<script src="\?bundle=config(?:&amp;v=[^"]+)?"><\/script>/g, `<script src="config.js?v=${versions.config}"></script>`)
    .replace(/<script src="\?bundle=core(?:&amp;v=[^"]+)?"><\/script>/g, `<script src="core.js?v=${versions.core}"></script>`)
    .replace(/<script src="\?bundle=client(?:&amp;v=[^"]+)?"><\/script>/g, `<script src="client.js?v=${versions.client}"></script>`), assetVersions);
}

function addCloudflarePreloads(html, assetVersions) {
  if (!html.includes('</head>')) {
    return html;
  }

  const preloadAssets = [
    'environment/grass_patch.png',
    'stages/spore/sleep_sheet.png',
    'stages/spore/idle_sheet.png',
    'stages/spore/wake_sheet.png'
  ];
  const preload = preloadAssets.map((fileName, index) => {
    const version = assetVersions && assetVersions[fileName];
    const href = `assets/${fileName}${version ? `?v=${version}` : ''}`;
    const priority = index === 0 ? ' fetchpriority="high"' : '';
    return `    <link rel="preload" href="${href}" as="image" type="image/png"${priority}>`;
  }).join('\n') + '\n';

  if (preloadAssets.some((fileName) => html.includes(`assets/${fileName}`))) {
    return html;
  }

  return html.replace('</head>', `${preload}  </head>`);
}

function renderTemplate(fileName) {
  return readTextSync(fileName)
    .replace(/<\?=\s*PIECZARGOTCHI_APP_TITLE\s*\?>/g, 'Pieczargotchi')
    .replace(/<\?=\s*PIECZARGOTCHI_APP_VERSION\s*\?>/g, getPackageVersion() || '0.0.0')
    .replace(/<\?!=\s*include\('([^']+)'\);\s*\?>/g, function(_match, partialName) {
      return renderTemplate(partialName + '.html');
    });
}

function renderScriptBundle(fileName) {
  return stripScriptTag(renderTemplate(fileName));
}

function renderConfigBundle(config) {
  const clientConfigJson = JSON.stringify(config).replace(/<\/script/gi, '<\\/script');
  return `window.PIECZARGOTCHI_CONFIG = ${clientConfigJson};\n`;
}

function getBundleVersion(content) {
  return createHash('sha256').update(String(content || '')).digest('hex').slice(0, 12);
}

function buildAssetVersionMap(assets) {
  const versions = {};
  for (const fileName of collectStaticAssetFiles(assets)) {
    versions[fileName] = getFileVersion(path.join(rootDir, 'assets', fileName));
  }
  return versions;
}

function collectStaticAssetFiles(assets) {
  const manifest = Array.isArray(assets) ? assets : buildClientConfig().assets;
  return Array.from(new Set(manifest.map((asset) => normalizeManifestAssetPath(asset.fileName)))).sort();
}

function normalizeManifestAssetPath(fileName) {
  const normalized = String(fileName || '').replace(/\\/g, '/').replace(/^assets\//, '').replace(/^\/+/, '');
  if (!normalized || normalized.split('/').includes('..') || !/\.(png|webp|jpg|jpeg|gif|svg)$/i.test(normalized)) {
    throw new Error(`Niebezpieczna lub nieobsługiwana ścieżka assetu w manifeście: ${JSON.stringify(fileName)}`);
  }
  return normalized;
}

function getFileVersion(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex').slice(0, 12);
}

function buildStaticBuildMetadata(config, coreBundle, clientBundle) {
  const packageVersion = getPackageVersion();
  const version = packageVersion || config.appVersion || '0.0.0';
  const sourceHash = getBundleVersion([
    version,
    JSON.stringify(config),
    coreBundle,
    clientBundle
  ].join('\n'));
  const revision = getBuildRevision();
  const id = sourceHash.slice(0, 7);

  return {
    version,
    id,
    label: `v${version}+${id}`,
    sourceHash,
    revision
  };
}

function getPackageVersion() {
  try {
    const packageJson = JSON.parse(readTextSync('package.json'));
    return String(packageJson.version || '').trim();
  } catch (_error) {
    return '';
  }
}

function getBuildRevision() {
  const envRevision = [
    process.env.CF_PAGES_COMMIT_SHA,
    process.env.CLOUDFLARE_COMMIT_SHA,
    process.env.GITHUB_SHA
  ].map((value) => String(value || '').trim()).find(Boolean);

  if (envRevision) {
    return envRevision.slice(0, 12);
  }

  return '';
}

function stripScriptTag(content) {
  return String(content || '')
    .replace(/^\s*<script[^>]*>\s*/i, '')
    .replace(/\s*<\/script>\s*$/i, '');
}

function buildClientConfig() {
  assertSafeDebugBuildFlags();
  const context = {
    console,
    Object,
    Utilities: {
      base64Encode() {
        return '';
      }
    },
    DriveApp: {
      getFileById(fileId) {
        throw new Error(`Grafika Drive ${fileId} nie jest dostępna w buildzie Cloudflare.`);
      },
      getFolderById(folderId) {
        throw new Error(`Folder Drive ${folderId} nie jest dostępny w buildzie Cloudflare.`);
      }
    }
  };

  vm.createContext(context);

  [
    'Config.gs',
    'SpriteLayout.gs',
    'AnimationConfig.gs',
    'StateModel.gs',
    'MinigamesConfig.gs',
    'LegendaryGamesConfig.gs',
    'EvolutionRules.gs',
    'DecorationStore.gs',
    'SyncService.gs',
    'GameRules.gs',
    'Actions.gs',
    'AssetService.gs'
  ].forEach((fileName) => {
    vm.runInContext(readTextSync(fileName), context, { filename: fileName });
  });

  const config = context.getClientConfig();
  const debugEnabled = process.env.PIECZARGOTCHI_CLOUDFLARE_DEBUG === '1';
  const assetMode = getCloudflareAssetMode();
  config.runtime = {
    ...(config.runtime || {}),
    debugEnabled,
    exposeRuntime: debugEnabled || process.env.PIECZARGOTCHI_CLOUDFLARE_EXPOSE_RUNTIME === '1',
    assetMode
  };
  config.assetBaseUrl = '';
  config.assetData = {};
  return config;
}

function getCloudflareAssetMode() {
  const mode = String(process.env.PIECZARGOTCHI_CLOUDFLARE_ASSET_MODE || 'critical').trim();
  if (!['critical', 'full'].includes(mode)) {
    throw new Error(`Nieobsługiwany tryb assetów Cloudflare: ${JSON.stringify(mode)}`);
  }
  if (outputDirectoryName === 'dist' && mode !== 'critical') {
    throw new Error('Produkcyjny dist musi używać PIECZARGOTCHI_CLOUDFLARE_ASSET_MODE=critical. Tryb full jest dozwolony tylko w dist-debug.');
  }
  return mode;
}

function assertSafeDebugBuildFlags() {
  const debugRequested = process.env.PIECZARGOTCHI_CLOUDFLARE_DEBUG === '1'
    || process.env.PIECZARGOTCHI_CLOUDFLARE_EXPOSE_RUNTIME === '1';
  const debugOutputAllowed = outputDirectoryName === 'dist-debug'
    && process.env.PIECZARGOTCHI_ALLOW_DEBUG_BUILD === '1';
  if (debugRequested && !debugOutputAllowed) {
    throw new Error('Build z debug/exposeRuntime jest dozwolony wyłącznie w osobnym dist-debug przez npm run build:debug.');
  }
  if (process.env.PIECZARGOTCHI_PRODUCTION_BUILD === '1' && (debugRequested || outputDirectoryName !== 'dist')) {
    throw new Error('Produkcyjny build nie może zawierać debug/exposeRuntime ani używać alternatywnego outputu.');
  }
}

function getOutputDirectoryName() {
  const name = String(process.env.PIECZARGOTCHI_BUILD_OUTPUT_DIR || 'dist').trim();
  if (name !== 'dist' && name !== 'dist-debug') {
    throw new Error(`Nieobsługiwany katalog build output: ${JSON.stringify(name)}`);
  }
  return name;
}

async function copyRuntimeAssets(assets) {
  const fileNames = collectStaticAssetFiles(assets);
  const missing = [];

  for (const fileName of fileNames) {
    const sourcePath = path.join(rootDir, 'assets', fileName);
    if (!existsSync(sourcePath)) {
      missing.push(fileName);
      continue;
    }

    const targetPath = path.join(assetOutputDir, fileName);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await copyFile(sourcePath, targetPath);
  }

  if (missing.length) {
    throw new Error(`Brakuje assetów wymaganych przez manifest: ${missing.join(', ')}`);
  }
}

function readTextSync(fileName) {
  return readFileSync(path.join(rootDir, fileName), 'utf8');
}

export {
  main as buildCloudflareStatic,
  buildAssetVersionMap,
  buildCloudflareStaticArtifacts,
  collectStaticAssetFiles,
  getBundleVersion
};
