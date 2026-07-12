import { readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildCloudflareStaticArtifacts, collectStaticAssetFiles } from './build-cloudflare-static.mjs';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputPath = path.join(rootDir, 'docs', 'ASSET_INVENTORY.md');
const artifacts = buildCloudflareStaticArtifacts();
const files = collectStaticAssetFiles(artifacts.config.assets);
const rows = new Map();
const assetByFile = new Map();
for (const asset of artifacts.config.assets) {
  if (!assetByFile.has(asset.fileName)) {
    assetByFile.set(asset.fileName, asset);
  }
}

for (const fileName of files) {
  const category = fileName.split('/')[0] || 'root';
  const current = rows.get(category) || { count: 0, bytes: 0, decodedBytes: 0 };
  const asset = assetByFile.get(fileName) || {};
  current.count += 1;
  current.bytes += statSync(path.join(rootDir, 'assets', fileName)).size;
  current.decodedBytes += Math.max(0, Number(asset.width) || 0) * Math.max(0, Number(asset.height) || 0) * 4;
  rows.set(category, current);
}

const totalBytes = files.reduce((sum, fileName) => sum + statSync(path.join(rootDir, 'assets', fileName)).size, 0);
const totalDecodedBytes = [...rows.values()].reduce((sum, row) => sum + row.decodedBytes, 0);
const requiredCount = artifacts.config.assets.filter((asset) => asset.required).length;
const initialCriticalCount = artifacts.config.assets.filter((asset) => asset.required || asset.kind === 'environment').length;
const markdown = [
  '# Inwentarz plików aplikacji',
  '',
  `Wygenerowano z \`AnimationConfig.gs\` dla widocznej wersji \`${artifacts.config.appVersion}\`. Nie zmieniaj liczb ręcznie; uruchom \`npm run docs:assets\`.`,
  '',
  `- Wpisy manifestu: ${artifacts.config.assets.length}`,
  `- Unikalne pliki aplikacji: ${files.length}`,
  `- Wymagane pliki: ${requiredCount}`,
  `- Pliki początkowego trybu krytycznego: ${initialCriticalCount}`,
  `- Rozmiar skompresowanych plików aplikacji: ${formatBytes(totalBytes)}`,
  `- Teoretyczny koszt pełnego dekodowania RGBA: ${formatBytes(totalDecodedBytes)}`,
  '- Wykluczone z aplikacji i `dist/`: `assets/source/`, `assets/reference/` oraz każdy plik zgodności spoza manifestu.',
  '',
  '| Kategoria | Pliki | Rozmiar skompresowany | Dekodowane RGBA |',
  '| --- | ---: | ---: | ---: |',
  ...[...rows.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([category, row]) => (
    `| ${category} | ${row.count} | ${formatBytes(row.bytes)} | ${formatBytes(row.decodedBytes)} |`
  )),
  ''
].join('\n');

if (process.argv.includes('--write')) {
  writeFileSync(outputPath, markdown, 'utf8');
  console.log(`Updated ${path.relative(rootDir, outputPath)}.`);
} else {
  const current = readFileSync(outputPath, 'utf8');
  if (current !== markdown) {
    throw new Error('docs/ASSET_INVENTORY.md is stale. Run npm run docs:assets after manifest or asset changes.');
  }
  console.log('Inwentarz plików aplikacji jest aktualny.');
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}
