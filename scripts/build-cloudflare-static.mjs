import { copyFile, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const scriptPath = fileURLToPath(import.meta.url);
const rootDir = path.dirname(path.dirname(scriptPath));
const distDir = path.join(rootDir, 'dist');
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
  config.assetVersions = buildAssetVersionMap();
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
    .replace(/<script src="\?bundle=config"><\/script>/g, `<script src="config.js?v=${versions.config}"></script>`)
    .replace(/<script src="\?bundle=core"><\/script>/g, `<script src="core.js?v=${versions.core}"></script>`)
    .replace(/<script src="\?bundle=client"><\/script>/g, `<script src="client.js?v=${versions.client}"></script>`), assetVersions);
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

function buildAssetVersionMap() {
  const versions = {};
  for (const fileName of collectStaticAssetFiles()) {
    versions[fileName] = getFileVersion(path.join(rootDir, 'assets', fileName));
  }
  return versions;
}

function collectStaticAssetFiles() {
  const sourceAssetsDir = path.join(rootDir, 'assets');
  if (!existsSync(sourceAssetsDir)) {
    return [];
  }

  const files = [];
  collectStaticAssetFilesInto(sourceAssetsDir, sourceAssetsDir, files);
  return files.sort();
}

function collectStaticAssetFilesInto(baseDir, sourceDir, files) {
  const entries = readdirSync(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === 'source' || entry.name === 'reference') {
      continue;
    }

    const sourcePath = path.join(sourceDir, entry.name);
    if (entry.isDirectory()) {
      collectStaticAssetFilesInto(baseDir, sourcePath, files);
      continue;
    }

    if (!/\.(png|json|webp|jpg|jpeg|gif|svg)$/i.test(entry.name)) {
      continue;
    }

    files.push(path.relative(baseDir, sourcePath).split(path.sep).join('/'));
  }
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
  config.runtime = {
    ...(config.runtime || {}),
    debugEnabled,
    exposeRuntime: debugEnabled || process.env.PIECZARGOTCHI_CLOUDFLARE_EXPOSE_RUNTIME === '1',
    assetMode: process.env.PIECZARGOTCHI_CLOUDFLARE_ASSET_MODE || 'critical'
  };
  config.assetData = {};
  return config;
}

async function copyRuntimeAssets(assets) {
  const fileNames = Array.from(new Set(assets.map((asset) => String(asset.fileName || '').trim()).filter(Boolean)));
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

  await copyAdditionalStaticAssets();

  if (missing.length) {
    throw new Error(`Brakuje assetów wymaganych przez manifest: ${missing.join(', ')}`);
  }
}

async function copyAdditionalStaticAssets() {
  const sourceAssetsDir = path.join(rootDir, 'assets');
  if (!existsSync(sourceAssetsDir)) {
    return;
  }

  await copyStaticTree(sourceAssetsDir, assetOutputDir);
}

async function copyStaticTree(sourceDir, targetDir) {
  const entries = await readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === 'source' || entry.name === 'reference') {
      continue;
    }

    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await copyStaticTree(sourcePath, targetPath);
      continue;
    }

    if (!/\.(png|json|webp|jpg|jpeg|gif|svg)$/i.test(entry.name)) {
      continue;
    }

    await mkdir(path.dirname(targetPath), { recursive: true });
    await copyFile(sourcePath, targetPath);
  }
}

function readTextSync(fileName) {
  return readFileSync(path.join(rootDir, fileName), 'utf8');
}

export {
  buildAssetVersionMap,
  buildCloudflareStaticArtifacts,
  collectStaticAssetFiles,
  getBundleVersion
};
