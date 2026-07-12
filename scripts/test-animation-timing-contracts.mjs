import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';


const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const configSource = readFileSync(path.join(rootDir, 'AnimationConfig.gs'), 'utf8');
const configContext = {};
vm.createContext(configContext);
vm.runInContext(
  `${configSource}\nglobalThis.__activityAnimations = PIECZARGOTCHI_ACTIVITY_ANIMATIONS;`,
  configContext,
  { filename: 'AnimationConfig.gs' }
);

test('activity animation cycles match the 2400ms gameplay action seam', () => {
  for (const animation of configContext.__activityAnimations) {
    const defaultCycle = sum(animation.frameDurationsMs);
    assert(defaultCycle === 1200, `${animation.activity}: expected 1200ms default cycle, got ${defaultCycle}`);
    assert(animation.loop === true, `${animation.activity}: non-spore activity should loop`);
    assert(animation.frameDurationsMs.length === animation.frameCount, `${animation.activity}: default timing/frame mismatch`);

    const spore = animation.stageOverrides && animation.stageOverrides.spore;
    assert(spore, `${animation.activity}: expected a spore timing override`);
    const sporeCycle = sum(spore.frameDurationsMs);
    assert(sporeCycle === 2400, `${animation.activity}: expected 2400ms spore one-shot, got ${sporeCycle}`);
    assert(spore.loop === false, `${animation.activity}: spore activity should be one-shot`);
    assert(spore.frameDurationsMs.length === animation.frameCount, `${animation.activity}: spore timing/frame mismatch`);
  }
});

test('immersion durations round up to the next complete animation cycle', () => {
  const source = readFileSync(path.join(rootDir, 'ClientInteraction.html'), 'utf8');
  const align = evaluateFunction(source, 'getImmersionSeamAlignedDurationMs', {
    runtime: { state: { stage: 'adult' } },
    animationsByKey: new Map([
      ['adult.follow_cursor_fast', {
        frameCount: 4,
        frameDurationsMs: [200, 300, 400, 500]
      }]
    ])
  });

  assert(align({ state: 'follow_cursor_fast', durationMs: 980 }) === 1400, 'short reaction should play one full cycle');
  assert(align({ state: 'follow_cursor_fast', durationMs: 1700 }) === 2800, 'long reaction should end on the next cycle seam');
  assert(align({ state: 'missing', durationMs: 980 }) === 980, 'missing metadata should preserve the requested fallback');
});

test('immersion activation stores requested timing but exposes the seam-aligned duration', () => {
  const source = readFileSync(path.join(rootDir, 'ClientInteraction.html'), 'utf8');
  const context = {
    runtime: { state: { stage: 'adult' } },
    animationsByKey: new Map([
      ['adult.watch_cursor_left', {
        frameCount: 4,
        frameDurationsMs: [250, 250, 250, 250]
      }]
    ])
  };
  const align = evaluateFunction(source, 'getImmersionSeamAlignedDurationMs', context);
  const activate = evaluateFunction(source, 'activateImmersionCandidate', Object.assign({
    getImmersionSeamAlignedDurationMs: align
  }, context));
  const active = activate({ state: 'watch_cursor_left', durationMs: 1150 }, 5000);
  assert(active.requestedDurationMs === 1150, 'expected requested duration to remain inspectable');
  assert(active.durationMs === 2000 && active.until === 7000, 'expected activation to end on a complete cycle seam');
});

function evaluateFunction(source, name, context) {
  const declaration = extractFunction(source, name);
  return vm.runInNewContext(`(${declaration})`, context, { filename: `${name}.js` });
}

function extractFunction(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  if (start < 0) {
    throw new Error(`Missing ${marker}`);
  }
  const brace = source.indexOf('{', start);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = '';
      }
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }
  throw new Error(`Unclosed function ${name}`);
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function test(name, callback) {
  try {
    callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}
