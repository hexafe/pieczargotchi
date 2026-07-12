import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const scriptPath = fileURLToPath(import.meta.url);
const rootDir = path.dirname(scriptPath);
const packageVersion = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8')).version;
const port = Number.parseInt(process.env.PORT || process.argv[2] || '8080', 10);
const grassPatchDelayMs = Math.max(0, Number.parseInt(process.env.PIECZARGOTCHI_GRASS_PATCH_DELAY_MS || '0', 10) || 0);

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8'
};

const server = createServer(async (request, response) => {
  try {
    if (!isAllowedHost(request.headers.host)) {
      send(response, 421, 'Niedozwolony nagłówek Host', contentTypes['.txt']);
      return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      send(response, 405, 'Dozwolone są tylko żądania GET i HEAD', contentTypes['.txt']);
      return;
    }

    const url = new URL(request.url || '/', 'http://localhost');

    if (url.searchParams.get('smoke') === '1') {
      send(response, 200, renderDeploymentSmokeHtml(), contentTypes['.html']);
      return;
    }
    if (url.searchParams.get('bundle') === 'config') {
      send(response, 200, renderConfigBundle(), contentTypes['.js']);
      return;
    }
    if (url.searchParams.get('bundle') === 'core') {
      send(response, 200, renderScriptBundle('ClientCore.html'), contentTypes['.js']);
      return;
    }
    if (url.searchParams.get('bundle') === 'client') {
      send(response, 200, renderScriptBundle('Client.html'), contentTypes['.js']);
      return;
    }

    if (url.pathname === '/' || url.pathname === '/index.html') {
      const html = await renderPreviewHtml();
      send(response, 200, html, contentTypes['.html']);
      return;
    }

    await serveStatic(url.pathname, response);
  } catch (error) {
    send(response, 500, String(error && error.stack ? error.stack : error), contentTypes['.txt']);
  }
});

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  server.listen(port, '127.0.0.1', () => {
    const address = server.address();
    const boundPort = address && typeof address === 'object' ? address.port : port;
    console.log(`Podgląd Pieczargotchi: http://127.0.0.1:${boundPort}/`);
  });
}

async function renderPreviewHtml() {
  return renderTemplate('Index.html');
}

function renderDeploymentSmokeHtml() {
  return '<!doctype html><html lang="pl"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<title>Pieczargotchi smoke</title>'
    + '<style>body{margin:0;padding:24px;font:16px sans-serif;background:#e7f0d0;color:#221814}'
    + '.box{display:grid;gap:8px;max-width:420px;padding:18px;border:3px solid #3c2b20;background:#fff8ea}'
    + 'strong{font-size:22px}</style></head>'
    + '<body><div class="box"><strong>Pieczargotchi smoke OK</strong>'
    + '<span>Minimalny HTML Apps Script został wyrenderowany.</span></div></body></html>';
}

function renderTemplate(fileName) {
  return readTextSync(fileName)
    .replace(/<\?=\s*PIECZARGOTCHI_APP_TITLE\s*\?>/g, 'Pieczargotchi')
    .replace(/<\?=\s*PIECZARGOTCHI_APP_VERSION\s*\?>/g, packageVersion)
    .replace(/<\?!=\s*include\('([^']+)'\);\s*\?>/g, function(_match, partialName) {
      return renderTemplate(partialName + '.html');
    });
}

function renderScriptBundle(fileName) {
  return stripScriptTag(renderTemplate(fileName));
}

function renderConfigBundle() {
  const clientConfigJson = JSON.stringify(buildClientConfig()).replace(/<\/script/gi, '<\\/script');
  return `window.PIECZARGOTCHI_CONFIG = ${clientConfigJson};`;
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
        throw new Error(`Grafika Drive ${fileId} nie jest dostępna w lokalnym podglądzie.`);
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
  config.runtime = {
    ...(config.runtime || {}),
    debugEnabled: true,
    exposeRuntime: true,
    assetMode: process.env.PIECZARGOTCHI_ASSET_MODE || 'critical'
  };
  return config;
}

async function serveStatic(urlPathname, response) {
  const decodedPath = decodeURIComponent(urlPathname.replace(/^\/+/, ''));
  const requestedPath = path.normalize(decodedPath);
  const segments = requestedPath.split(path.sep).filter(Boolean);
  const normalizedSegments = segments.map((segment) => segment.toLowerCase());

  if (requestedPath.startsWith('..')
    || path.isAbsolute(requestedPath)
    || normalizedSegments[0] !== 'assets'
    || normalizedSegments.includes('source')
    || normalizedSegments.includes('reference')) {
    send(response, 403, 'Dostęp zabroniony', contentTypes['.txt']);
    return;
  }

  const assetsDir = path.resolve(rootDir, 'assets');
  const filePath = path.resolve(rootDir, requestedPath);
  if (!isPathInside(assetsDir, filePath)) {
    send(response, 403, 'Dostęp zabroniony', contentTypes['.txt']);
    return;
  }

  if (!existsSync(filePath)) {
    send(response, 404, 'Nie znaleziono', contentTypes['.txt']);
    return;
  }

  const realAssetsDir = await realpath(assetsDir);
  const realFilePath = await realpath(filePath);
  if (!isPathInside(realAssetsDir, realFilePath)) {
    send(response, 403, 'Dostęp zabroniony', contentTypes['.txt']);
    return;
  }

  if (requestedPath === path.join('assets', 'environment', 'grass_patch.png') && grassPatchDelayMs > 0) {
    await delay(grassPatchDelayMs);
  }

  const data = await readFile(realFilePath);
  send(response, 200, data, contentTypes[path.extname(realFilePath).toLowerCase()] || 'application/octet-stream');
}

function isPathInside(parentPath, candidatePath) {
  const relativePath = path.relative(parentPath, candidatePath);
  return Boolean(relativePath)
    && relativePath !== '..'
    && !relativePath.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relativePath);
}

function readTextSync(fileName) {
  return readFileSync(path.join(rootDir, fileName), 'utf8');
}

function send(response, status, body, contentType) {
  response.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'no-referrer'
  });
  response.end(body);
}

function isAllowedHost(value) {
  const host = String(value || '').trim().toLowerCase();
  return /^(localhost|127(?:\.\d{1,3}){3})(:\d+)?$/.test(host);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { buildClientConfig };
