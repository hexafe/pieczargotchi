import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const rootDir = path.dirname(path.dirname(scriptPath));

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  await main();
}

async function main() {
  const error = getDeployEnvironmentError(process.env);
  if (error) {
    throw new Error(error);
  }

  const environment = createProductionEnvironment(process.env);
  await run(process.execPath, ['scripts/run-qa.mjs'], environment);

  const wrangler = getWranglerInvocation();
  const command = process.argv.includes('--preview') ? ['versions', 'upload'] : ['deploy'];
  await run(wrangler.executable, [wrangler.entryPath, ...command], environment);
}

function getWranglerInvocation(baseDir = rootDir) {
  const packagePath = path.join(baseDir, 'node_modules', 'wrangler', 'package.json');
  if (!existsSync(packagePath)) {
    throw new Error('Brak przypiętego Wranglera. Uruchom npm ci przed deployem.');
  }

  let packageJson;
  try {
    packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
  } catch (error) {
    throw new Error(`Nie można odczytać pakietu Wrangler: ${error.message}`);
  }
  const relativeEntry = typeof packageJson.bin === 'string'
    ? packageJson.bin
    : packageJson.bin && packageJson.bin.wrangler;
  const entryPath = relativeEntry
    ? path.resolve(path.dirname(packagePath), relativeEntry)
    : '';
  if (!entryPath || !existsSync(entryPath)) {
    throw new Error('Pakiet Wrangler nie zawiera uruchamialnego wpisu bin/wrangler.js. Uruchom ponownie npm ci.');
  }
  return {
    executable: process.execPath,
    entryPath
  };
}

function getDeployEnvironmentError(environment) {
  const forbidden = [
    'PIECZARGOTCHI_CLOUDFLARE_DEBUG',
    'PIECZARGOTCHI_CLOUDFLARE_EXPOSE_RUNTIME',
    'PIECZARGOTCHI_ALLOW_DEBUG_BUILD'
  ].filter((name) => environment[name] === '1');
  const output = String(environment.PIECZARGOTCHI_BUILD_OUTPUT_DIR || 'dist').trim();
  const assetMode = String(environment.PIECZARGOTCHI_CLOUDFLARE_ASSET_MODE || 'critical').trim();
  if (output !== 'dist') {
    forbidden.push('PIECZARGOTCHI_BUILD_OUTPUT_DIR');
  }
  if (assetMode !== 'critical') {
    forbidden.push('PIECZARGOTCHI_CLOUDFLARE_ASSET_MODE');
  }
  return forbidden.length
    ? `Deploy zablokowany przez nieprodukcyjne flagi: ${[...new Set(forbidden)].join(', ')}.`
    : '';
}

function createProductionEnvironment(environment) {
  const result = { ...environment };
  delete result.PIECZARGOTCHI_CLOUDFLARE_DEBUG;
  delete result.PIECZARGOTCHI_CLOUDFLARE_EXPOSE_RUNTIME;
  delete result.PIECZARGOTCHI_ALLOW_DEBUG_BUILD;
  result.PIECZARGOTCHI_BUILD_OUTPUT_DIR = 'dist';
  result.PIECZARGOTCHI_CLOUDFLARE_ASSET_MODE = 'critical';
  result.PIECZARGOTCHI_PRODUCTION_BUILD = '1';
  return result;
}

function run(executable, args, environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: rootDir,
      env: environment,
      stdio: 'inherit'
    });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${path.basename(executable)} ${args.join(' ')} failed (${signal || `exit ${code}`}).`));
      }
    });
  });
}

export { createProductionEnvironment, getDeployEnvironmentError, getWranglerInvocation };
