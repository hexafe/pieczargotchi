import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const python = process.platform === 'win32' ? 'python' : 'python3';
const verifiedBuildOnly = process.argv.includes('--verified-build');
const scriptFiles = readdirSync(path.join(rootDir, 'scripts'), { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => `scripts/${entry.name}`)
  .sort();
const mjsFiles = scriptFiles.filter((fileName) => fileName.endsWith('.mjs'));
const pythonFiles = scriptFiles.filter((fileName) => fileName.endsWith('.py'));
const checks = [
  ...mjsFiles.map(nodeCheck),
  node('scripts/test-apps-script-release-gate.mjs'),
  node('scripts/test-asset-validation-contracts.mjs'),
  node('scripts/test-deploy-guard.mjs'),
  node('scripts/check-client-syntax.mjs'),
  node('scripts/test-animation-render-contracts.mjs'),
  node('scripts/test-animation-timing-contracts.mjs'),
  node('scripts/test-local-preview-config.mjs'),
  node('scripts/test-battle-visual-contracts.mjs'),
  node('scripts/test-condition-overlay-render-contracts.mjs'),
  node('scripts/test-journal-polaroid-render-contracts.mjs'),
  node('scripts/test-scene-render-contracts.mjs'),
  node('scripts/test-ui-flow-contracts.mjs'),
  node('scripts/test-standard-minigame-experience.mjs'),
  node('scripts/test-legendary-minigames-redesign.mjs'),
  node('scripts/test-minigame-sensory-recap.mjs'),
  node('scripts/check-deployment-readiness.mjs'),
  node('scripts/test-client-core.mjs'),
  node('scripts/test-client-core.mjs', { TZ: 'UTC' }, 'core rules (UTC)'),
  node('scripts/test-client-core.mjs', { TZ: 'Europe/Warsaw' }, 'core rules (Europe/Warsaw)'),
  node('scripts/test-runtime-gameplay-regressions.mjs'),
  node('scripts/test-state-persistence.mjs'),
  node('scripts/test-asset-service.mjs'),
  node('scripts/test-celestial-position.mjs'),
  node('scripts/test-scene-palette.mjs'),
  node('scripts/test-weather-precip-motion.mjs'),
  node('scripts/test-weather-client-resilience.mjs'),
  node('scripts/test-grass-wind-motion.mjs'),
  node('scripts/audit-polish-copy.mjs'),
  node('scripts/validate-assets.mjs'),
  node('scripts/build-cloudflare-static.mjs'),
  node('scripts/simulate-minigame-balance.mjs'),
  node('scripts/test-cloudflare-static-build.mjs'),
  node('scripts/generate-asset-inventory.mjs')
];

if (!verifiedBuildOnly) {
  checks.splice(checks.length - 4, 0,
    ...pythonFiles.map(pythonCheck),
    node('scripts/test-dev-server-security.mjs'),
    command(python, ['-c', 'from PIL import Image; print("Pillow QA dependency OK")'], {}, 'Pillow dependency'),
    command(python, ['scripts/test-sprite-pipeline.py']),
    command(python, ['scripts/generate-battle-assets.py', '--check']),
    command(python, ['scripts/optimize-runtime-sprite-atlases.py', '--check']),
    command(python, ['scripts/generate-instrument-variant-assets.py']),
    command(python, ['scripts/audit-sprite-consistency.py']),
    command(python, ['scripts/audit-spore-sprites.py']),
    command(python, ['scripts/audit-activity-sprite-motion.py']),
    command(python, ['scripts/audit-glint-sprites.py']),
    command(python, ['scripts/audit-sprite-frame-quality.py']),
    command(python, ['scripts/audit-sprite-chroma.py', '--strict'])
  );
  checks.push(
    node('scripts/test-browser-smoke.mjs'),
    node('scripts/test-ui-viewport-contracts.mjs')
  );
}

for (const check of checks) {
  console.log(`\n[qa] ${check.label}`);
  await run(check);
}

console.log(`\n${verifiedBuildOnly ? 'Verified build' : 'QA'} passed: ${checks.length} deterministic checks.`);

function node(fileName, env = {}, label = fileName) {
  return command(process.execPath, [fileName], env, label);
}

function nodeCheck(fileName) {
  return command(process.execPath, ['--check', fileName], {}, `syntax ${fileName}`);
}

function pythonCheck(fileName) {
  const sourceCheck = [
    'from pathlib import Path',
    'import sys',
    'source = Path(sys.argv[1]).read_text(encoding="utf-8")',
    'compile(source, sys.argv[1], "exec")'
  ].join('; ');
  return command(python, ['-c', sourceCheck, fileName], {}, `syntax ${fileName}`);
}

function command(executable, args, env = {}, label = `${executable} ${args.join(' ')}`) {
  return { executable, args, env, label };
}

function run(check) {
  return new Promise((resolve, reject) => {
    const child = spawn(check.executable, check.args, {
      cwd: rootDir,
      env: { ...process.env, ...check.env },
      stdio: 'inherit'
    });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${check.label} failed (${signal || `exit ${code}`}).`));
    });
  });
}
