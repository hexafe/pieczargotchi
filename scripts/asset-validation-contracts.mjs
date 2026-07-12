export function normalizeAssetPath(value) {
  return String(value || '').replace(/\\/g, '/');
}

export function countExteriorMagentaSpill(image, alphaThreshold = 8, edgeRadius = 3) {
  const width = Math.max(0, Math.floor(Number(image && image.width) || 0));
  const height = Math.max(0, Math.floor(Number(image && image.height) || 0));
  const pixels = image && image.pixels;
  if (!width || !height || !pixels || pixels.length < width * height * 4) {
    return 0;
  }

  const pixelCount = width * height;
  const exterior = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let head = 0;
  let tail = 0;

  function enqueue(x, y) {
    const index = y * width + x;
    if (exterior[index] || pixels[index * 4 + 3] > alphaThreshold) {
      return;
    }
    exterior[index] = 1;
    queue[tail] = index;
    tail += 1;
  }

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (head < tail) {
    const index = queue[head];
    head += 1;
    const x = index % width;
    const y = Math.floor(index / width);
    for (let nextY = Math.max(0, y - 1); nextY <= Math.min(height - 1, y + 1); nextY += 1) {
      for (let nextX = Math.max(0, x - 1); nextX <= Math.min(width - 1, x + 1); nextX += 1) {
        enqueue(nextX, nextY);
      }
    }
  }

  let count = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const offset = index * 4;
      const r = pixels[offset];
      const g = pixels[offset + 1];
      const b = pixels[offset + 2];
      const a = pixels[offset + 3];
      if (a <= alphaThreshold || !hasVisibleMagentaSpill(r, g, b, a)) {
        continue;
      }

      let touchesExterior = false;
      for (let nextY = Math.max(0, y - edgeRadius); nextY <= Math.min(height - 1, y + edgeRadius) && !touchesExterior; nextY += 1) {
        for (let nextX = Math.max(0, x - edgeRadius); nextX <= Math.min(width - 1, x + edgeRadius); nextX += 1) {
          if (exterior[nextY * width + nextX]) {
            touchesExterior = true;
            break;
          }
        }
      }
      if (touchesExterior) {
        count += 1;
      }
    }
  }

  return count;
}

export function validateManifestContracts(manifest) {
  const errors = [];
  const assetsByKey = new Map();
  const assetsByFile = new Map();

  for (const rawAsset of Array.isArray(manifest) ? manifest : []) {
    const asset = {
      ...rawAsset,
      fileName: normalizeAssetPath(rawAsset && rawAsset.fileName)
    };
    const key = String(asset.key || '').trim();
    const fileName = asset.fileName;

    if (assetsByKey.has(key)) {
      errors.push(`manifest zawiera zduplikowany klucz assetu: ${key || '(pusty)'}`);
    } else {
      assetsByKey.set(key, asset);
    }

    const aliases = assetsByFile.get(fileName) || [];
    const conflictingAlias = aliases.find((candidate) => !hasMatchingFileContract(candidate, asset));
    if (conflictingAlias) {
      errors.push(
        `aliasy pliku ${fileName || '(pusty)'} mają sprzeczny kontrakt: `
        + `${conflictingAlias.key} (${formatFileContract(conflictingAlias)}) i `
        + `${key || '(pusty)'} (${formatFileContract(asset)})`
      );
    }
    aliases.push(asset);
    assetsByFile.set(fileName, aliases);
  }

  return {
    errors,
    manifest: Array.from(assetsByFile.values()).flat(),
    assetsByKey,
    assetsByFile
  };
}

function hasMatchingFileContract(first, second) {
  return ['width', 'height', 'frames'].every((field) => Number(first[field]) === Number(second[field]));
}

function formatFileContract(asset) {
  return `${Number(asset.width)}x${Number(asset.height)}, ${Number(asset.frames)} kl.`;
}

function hasVisibleMagentaSpill(r, g, b, a) {
  // Deliberate plum/purple outlines are part of the game's palette. Only a
  // bright chroma-key core at the exterior alpha edge is a release blocker.
  if (r < 230 || b < 230 || g > 90 || Math.abs(r - b) > 60) {
    return false;
  }

  const alpha = a / 255;
  return [
    [255, 255, 255],
    [83, 132, 68],
    [22, 28, 57]
  ].some((background) => {
    const outR = Math.round(r * alpha + background[0] * (1 - alpha));
    const outG = Math.round(g * alpha + background[1] * (1 - alpha));
    const outB = Math.round(b * alpha + background[2] * (1 - alpha));
    return Math.min(outR, outB) > outG + 22;
  });
}
