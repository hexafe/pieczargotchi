import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const entrypoints = ['ClientCore.html', 'Client.html'];

for (const entrypoint of entrypoints) {
  const html = renderTemplate(entrypoint);
  if (html.includes('<?')) {
    throw new Error(`${entrypoint}: unresolved Apps Script template tag`);
  }

  const scripts = extractScriptBlocks(html);
  if (!scripts.length) {
    throw new Error(`${entrypoint}: no <script> blocks found`);
  }

  scripts.forEach((script, index) => {
    try {
      new Function(script);
    } catch (error) {
      throw new Error(`${entrypoint} script ${index + 1}: ${error.message}`);
    }
  });
}

console.log('Client partial syntax ok');

function renderTemplate(fileName) {
  const content = readFileSync(path.join(rootDir, fileName), 'utf8');
  return content.replace(/<\?!=\s*include\('([^']+)'\);\s*\?>/g, (_match, partialName) => {
    return renderTemplate(partialName + '.html');
  });
}

function extractScriptBlocks(html) {
  const blocks = [];
  const pattern = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match = pattern.exec(html);
  while (match) {
    blocks.push(match[1]);
    match = pattern.exec(html);
  }
  return blocks;
}
