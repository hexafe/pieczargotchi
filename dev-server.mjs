import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const port = Number.parseInt(process.env.PORT || process.argv[2] || '8080', 10);

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
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

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

server.listen(port, '127.0.0.1', () => {
  console.log(`Podgląd Pieczargotchi: http://127.0.0.1:${port}/`);
});

async function renderPreviewHtml() {
  const clientConfigJson = JSON.stringify(buildClientConfig()).replace(/<\/script/gi, '<\\/script');
  return renderTemplate('Index.html', { clientConfigJson });
}

function renderTemplate(fileName, values) {
  return readTextSync(fileName)
    .replace(/<\?=\s*PIECZARGOTCHI_APP_TITLE\s*\?>/g, 'Pieczargotchi')
    .replace(/<\?!=\s*clientConfigJson\s*\?>/g, values.clientConfigJson)
    .replace(/<\?!=\s*include\('([^']+)'\);\s*\?>/g, function(_match, partialName) {
      return renderTemplate(partialName + '.html', values);
    });
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
    'AnimationConfig.gs',
    'StateModel.gs',
    'GameRules.gs',
    'Actions.gs',
    'AssetService.gs'
  ].forEach((fileName) => {
    vm.runInContext(readTextSync(fileName), context, { filename: fileName });
  });

  return context.getClientConfig();
}

async function serveStatic(urlPathname, response) {
  const decodedPath = decodeURIComponent(urlPathname.replace(/^\/+/, ''));
  const requestedPath = path.normalize(decodedPath);

  if (requestedPath.startsWith('..') || path.isAbsolute(requestedPath)) {
    send(response, 403, 'Dostęp zabroniony', contentTypes['.txt']);
    return;
  }

  const filePath = path.join(rootDir, requestedPath);

  if (!existsSync(filePath)) {
    send(response, 404, 'Nie znaleziono', contentTypes['.txt']);
    return;
  }

  const data = await readFile(filePath);
  send(response, 200, data, contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
}

function readTextSync(fileName) {
  return readFileSync(path.join(rootDir, fileName), 'utf8');
}

function send(response, status, body, contentType) {
  response.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store'
  });
  response.end(body);
}
