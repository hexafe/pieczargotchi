import { copyFile, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const distDir = path.join(rootDir, 'dist');
const assetOutputDir = path.join(distDir, 'assets');

await main();

async function main() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  const config = buildClientConfig();
  const indexHtml = renderCloudflareHtml();

  await writeFile(path.join(distDir, 'index.html'), indexHtml, 'utf8');
  await writeFile(path.join(distDir, 'config.js'), renderConfigBundle(config), 'utf8');
  await writeFile(path.join(distDir, 'core.js'), renderScriptBundle('ClientCore.html'), 'utf8');
  await writeFile(path.join(distDir, 'client.js'), renderScriptBundle('Client.html'), 'utf8');
  await copyRuntimeAssets(config.assets || []);

  console.log(`Cloudflare static build complete: ${path.relative(rootDir, distDir)}`);
}

function renderCloudflareHtml() {
  return addCloudflarePreloads(renderTemplate('Index.html')
    .replace(/^\s*<base target="_top">\s*$/m, '')
    .replace(/<script src="\?bundle=config"><\/script>/g, '<script src="config.js"></script>')
    .replace(/<script src="\?bundle=core"><\/script>/g, '<script src="core.js"></script>')
    .replace(/<script src="\?bundle=client"><\/script>/g, '<script src="client.js"></script>'));
}

function addCloudflarePreloads(html) {
  const preload = '    <link rel="preload" href="assets/environment/grass_patch.png" as="image" type="image/png" fetchpriority="high">\n';
  if (html.includes('assets/environment/grass_patch.png') || !html.includes('</head>')) {
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
