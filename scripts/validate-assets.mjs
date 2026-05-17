import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const katalogGlowny = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const katalogiSheetow = [
  path.join(katalogGlowny, 'assets', 'stages'),
  path.join(katalogGlowny, 'assets', 'activities'),
  path.join(katalogGlowny, 'assets', 'easter-eggs'),
  path.join(katalogGlowny, 'assets', 'effects')
];
const katalogiSrodowiska = [
  path.join(katalogGlowny, 'assets', 'environment')
];
const rozmiarKlatki = 512;
const domyslnaLiczbaKlatek = 4;
const przezroczystoscProgu = 8;
const progOstrzezeniaKrawedzi = 64;
const progArtefaktowKrawedzi = 384;

const plikiSheetow = katalogiSheetow.flatMap(zbierzPng);
const plikiSrodowiska = katalogiSrodowiska.flatMap(zbierzPng);
const manifest = wczytajManifestRuntime();
const manifestByFile = new Map(manifest.map((asset) => [asset.fileName, asset]));
const manifestFiles = new Set(manifest.map((asset) => asset.fileName));
const validatedFiles = new Set(
  plikiSheetow.concat(plikiSrodowiska).map((plik) => path.relative(path.join(katalogGlowny, 'assets'), plik))
);
const bledy = [];
const ostrzezenia = [];

if (!plikiSheetow.length) {
  bledy.push('Nie znaleziono assetów PNG w assets/stages, assets/activities ani assets/effects.');
}

plikiSheetow.forEach((plik) => {
  try {
    sprawdzSheet(plik);
  } catch (error) {
    bledy.push(`${path.relative(katalogGlowny, plik)}: ${error.message}`);
  }
});

plikiSrodowiska.forEach((plik) => {
  try {
    sprawdzAssetSrodowiska(plik);
  } catch (error) {
    bledy.push(`${path.relative(katalogGlowny, plik)}: ${error.message}`);
  }
});

sprawdzManifestRuntime();

ostrzezenia.forEach((tekst) => {
  console.warn(`Uwaga: ${tekst}`);
});

if (bledy.length) {
  console.error('Walidacja assetów nie powiodła się:');
  bledy.forEach((tekst) => console.error(`- ${tekst}`));
  process.exit(1);
}

console.log(`Walidacja assetów OK: ${plikiSheetow.length} sheetów PNG, ${plikiSrodowiska.length} assetów środowiska.`);
console.log(`Manifest runtime: ${manifest.length} assetów; walidacja widzi ${validatedFiles.size} plików PNG.`);

function zbierzPng(katalog) {
  if (!existsSync(katalog)) {
    return [];
  }

  return readdirSync(katalog)
    .flatMap((nazwa) => {
      const pelnaSciezka = path.join(katalog, nazwa);
      if (statSync(pelnaSciezka).isDirectory()) {
        return zbierzPng(pelnaSciezka);
      }

      return nazwa.endsWith('.png') ? [pelnaSciezka] : [];
    })
    .sort();
}

function sprawdzSheet(plik) {
  const obraz = wczytajPng(plik);
  const wzglednaSciezka = path.relative(path.join(katalogGlowny, 'assets'), plik);
  const oczekiwanaLiczbaKlatek = odczytajOczekiwanaLiczbeKlatek(wzglednaSciezka);

  if (obraz.height !== rozmiarKlatki) {
    throw new Error(`wysokość ${obraz.height}px, oczekiwano ${rozmiarKlatki}px`);
  }

  if (obraz.width !== rozmiarKlatki * oczekiwanaLiczbaKlatek) {
    throw new Error(`szerokość ${obraz.width}px, oczekiwano ${rozmiarKlatki * oczekiwanaLiczbaKlatek}px`);
  }

  const liczbaKlatek = obraz.width / rozmiarKlatki;
  if (liczbaKlatek !== oczekiwanaLiczbaKlatek) {
    throw new Error(`liczba klatek ${liczbaKlatek}, oczekiwano ${oczekiwanaLiczbaKlatek}`);
  }

  const magenta = policzNieprzezroczystaMagente(obraz);
  if (magenta > 0) {
    throw new Error(`sheet ma ${magenta} nieprzezroczystych pikseli chroma-key`);
  }

  const czyEfekt = plik.includes(`${path.sep}effects${path.sep}`);
  const czyAktywnosc = plik.includes(`${path.sep}activities${path.sep}`);
  const czyZarodnik = plik.includes(`${path.sep}spore${path.sep}`);
  const tolerancjaDriftu = czyEfekt ? 48 : czyAktywnosc ? 24 : 12;
  const tolerancjaCentrumX = czyEfekt ? 112 : czyAktywnosc ? 42 : 42;
  const tolerancjaCentrumY = czyEfekt ? 112 : czyZarodnik ? 165 : czyAktywnosc ? 125 : 125;
  const centra = [];

  for (let klatka = 0; klatka < liczbaKlatek; klatka += 1) {
    const bbox = policzBoundingBox(obraz, klatka);
    if (!bbox) {
      throw new Error(`klatka ${klatka + 1} jest pusta`);
    }

    const centrumX = (bbox.minX + bbox.maxX + 1) / 2 - klatka * rozmiarKlatki;
    const centrumY = (bbox.minY + bbox.maxY + 1) / 2;
    centra.push({ x: centrumX, y: centrumY });

    if (Math.abs(centrumX - 256) > tolerancjaCentrumX || Math.abs(centrumY - 256) > tolerancjaCentrumY) {
      throw new Error(
        `klatka ${klatka + 1} ma centrum ${centrumX.toFixed(1)},${centrumY.toFixed(1)} poza tolerancją`
      );
    }

    const krawedzie = policzArtefaktyKrawedzi(obraz, klatka);
    if (krawedzie > progArtefaktowKrawedzi) {
      throw new Error(`klatka ${klatka + 1} ma ${krawedzie} nieprzezroczystych pikseli na krawędziach`);
    }

    if (krawedzie > progOstrzezeniaKrawedzi) {
      ostrzezenia.push(`${path.relative(katalogGlowny, plik)} klatka ${klatka + 1} ma ${krawedzie} pikseli na krawędziach`);
    }
  }

  const pierwsze = centra[0];
  centra.forEach((centrum, indeks) => {
    const drift = Math.hypot(centrum.x - pierwsze.x, centrum.y - pierwsze.y);
    if (drift > tolerancjaDriftu) {
      throw new Error(`klatka ${indeks + 1} dryfuje o ${drift.toFixed(1)}px względem pierwszej`);
    }

    if (drift > 2) {
      ostrzezenia.push(`${path.relative(katalogGlowny, plik)} klatka ${indeks + 1} ma miękki drift ${drift.toFixed(1)}px`);
    }
  });
}

function odczytajOczekiwanaLiczbeKlatek(wzglednaSciezka) {
  const asset = manifestByFile.get(wzglednaSciezka);
  const frames = Number(asset && asset.frames);
  if (Number.isFinite(frames) && frames > 0) {
    return frames;
  }

  return domyslnaLiczbaKlatek;
}

function sprawdzAssetSrodowiska(plik) {
  const obraz = wczytajPng(plik);
  if (obraz.width !== rozmiarKlatki) {
    throw new Error(`szerokość ${obraz.width}px, oczekiwano ${rozmiarKlatki}px`);
  }

  if (path.basename(plik) === 'grass_patch.png' && obraz.height !== 158) {
    throw new Error(`wysokość ${obraz.height}px, oczekiwano 158px dla grass_patch.png`);
  }

  if (path.basename(plik) !== 'grass_patch.png' && (obraz.height < 96 || obraz.height > 220)) {
    throw new Error(`wysokość ${obraz.height}px poza zakresem assetu środowiska`);
  }

  const bbox = policzBoundingBoxDlaObrazu(obraz);
  if (!bbox) {
    throw new Error('asset środowiska jest pusty');
  }

  if (bbox.minX <= 0 || bbox.maxX >= obraz.width - 1 || bbox.minY <= 0 || bbox.maxY >= obraz.height - 1) {
    throw new Error(`asset środowiska dotyka krawędzi alpha ${JSON.stringify(bbox)}`);
  }

  const magenta = policzNieprzezroczystaMagente(obraz);
  if (magenta > 0) {
    throw new Error(`asset środowiska ma ${magenta} nieprzezroczystych pikseli chroma-key`);
  }
}

function sprawdzManifestRuntime() {
  manifest.forEach((asset) => {
    if (!validatedFiles.has(asset.fileName)) {
      bledy.push(`manifest wskazuje brakujący asset: ${asset.fileName}`);
    }
  });

  const pozaManifestem = Array.from(validatedFiles).filter((plik) => !manifestFiles.has(plik));
  if (pozaManifestem.length) {
    ostrzezenia.push(
      `manifest runtime nie ładuje ${pozaManifestem.length} walidowanych plików: ${pozaManifestem.slice(0, 12).join(', ')}${pozaManifestem.length > 12 ? ', ...' : ''}`
    );
  }
}

function policzBoundingBox(obraz, klatka) {
  const startX = klatka * rozmiarKlatki;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let y = 0; y < obraz.height; y += 1) {
    for (let x = startX; x < startX + rozmiarKlatki; x += 1) {
      const alfa = obraz.pixels[(y * obraz.width + x) * 4 + 3];
      if (alfa <= przezroczystoscProgu) {
        continue;
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (minX === Infinity) {
    return null;
  }

  return { minX, minY, maxX, maxY };
}

function policzBoundingBoxDlaObrazu(obraz) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let y = 0; y < obraz.height; y += 1) {
    for (let x = 0; x < obraz.width; x += 1) {
      const alfa = obraz.pixels[(y * obraz.width + x) * 4 + 3];
      if (alfa <= przezroczystoscProgu) {
        continue;
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (minX === Infinity) {
    return null;
  }

  return { minX, minY, maxX, maxY };
}

function policzNieprzezroczystaMagente(obraz) {
  let count = 0;

  for (let y = 0; y < obraz.height; y += 1) {
    for (let x = 0; x < obraz.width; x += 1) {
      const offset = (y * obraz.width + x) * 4;
      const r = obraz.pixels[offset];
      const g = obraz.pixels[offset + 1];
      const b = obraz.pixels[offset + 2];
      const a = obraz.pixels[offset + 3];
      if (a > przezroczystoscProgu && r > 220 && b > 220 && g < 80) {
        count += 1;
      }
    }
  }

  return count;
}

function policzArtefaktyKrawedzi(obraz, klatka) {
  const startX = klatka * rozmiarKlatki;
  const endX = startX + rozmiarKlatki - 1;
  let count = 0;

  for (let x = startX; x <= endX; x += 1) {
    if (obraz.pixels[x * 4 + 3] > przezroczystoscProgu) {
      count += 1;
    }
    if (obraz.pixels[((obraz.height - 1) * obraz.width + x) * 4 + 3] > przezroczystoscProgu) {
      count += 1;
    }
  }

  for (let y = 0; y < obraz.height; y += 1) {
    if (obraz.pixels[(y * obraz.width + startX) * 4 + 3] > przezroczystoscProgu) {
      count += 1;
    }
    if (obraz.pixels[(y * obraz.width + endX) * 4 + 3] > przezroczystoscProgu) {
      count += 1;
    }
  }

  return count;
}

function wczytajManifestRuntime() {
  const context = {
    Object,
    console
  };
  vm.createContext(context);
  ['Config.gs', 'AnimationConfig.gs'].forEach((plik) => {
    vm.runInContext(readFileSync(path.join(katalogGlowny, plik), 'utf8'), context, { filename: plik });
  });
  return context.getRuntimeAssetManifest();
}

function wczytajPng(plik) {
  const bufor = readFileSync(plik);
  const podpis = bufor.subarray(0, 8).toString('hex');
  if (podpis !== '89504e470d0a1a0a') {
    throw new Error('plik nie ma podpisu PNG');
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];

  while (offset < bufor.length) {
    const length = bufor.readUInt32BE(offset);
    const type = bufor.subarray(offset + 4, offset + 8).toString('ascii');
    const data = bufor.subarray(offset + 8, offset + 8 + length);

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }

    offset += 12 + length;
  }

  if (bitDepth !== 8 || colorType !== 6) {
    throw new Error(`obsługiwane są tylko PNG RGBA 8-bit, otrzymano bitDepth=${bitDepth}, colorType=${colorType}`);
  }

  const dane = inflateSync(Buffer.concat(idat));
  const bajtyNaPiksel = 4;
  const dlugoscLinii = width * bajtyNaPiksel;
  const pixels = Buffer.alloc(width * height * bajtyNaPiksel);
  let wejscie = 0;

  for (let y = 0; y < height; y += 1) {
    const filtr = dane[wejscie];
    wejscie += 1;
    const linia = Buffer.from(dane.subarray(wejscie, wejscie + dlugoscLinii));
    wejscie += dlugoscLinii;
    const poprzednia = y === 0 ? null : pixels.subarray((y - 1) * dlugoscLinii, y * dlugoscLinii);

    odfiltrujLinie(linia, poprzednia, filtr, bajtyNaPiksel);
    linia.copy(pixels, y * dlugoscLinii);
  }

  return { width, height, pixels };
}

function odfiltrujLinie(linia, poprzednia, filtr, bajtyNaPiksel) {
  for (let i = 0; i < linia.length; i += 1) {
    const lewy = i >= bajtyNaPiksel ? linia[i - bajtyNaPiksel] : 0;
    const gora = poprzednia ? poprzednia[i] : 0;
    const lewyGora = poprzednia && i >= bajtyNaPiksel ? poprzednia[i - bajtyNaPiksel] : 0;

    if (filtr === 1) {
      linia[i] = (linia[i] + lewy) & 0xff;
    } else if (filtr === 2) {
      linia[i] = (linia[i] + gora) & 0xff;
    } else if (filtr === 3) {
      linia[i] = (linia[i] + Math.floor((lewy + gora) / 2)) & 0xff;
    } else if (filtr === 4) {
      linia[i] = (linia[i] + paeth(lewy, gora, lewyGora)) & 0xff;
    } else if (filtr !== 0) {
      throw new Error(`nieznany filtr PNG: ${filtr}`);
    }
  }
}

function paeth(lewy, gora, lewyGora) {
  const p = lewy + gora - lewyGora;
  const pa = Math.abs(p - lewy);
  const pb = Math.abs(p - gora);
  const pc = Math.abs(p - lewyGora);

  if (pa <= pb && pa <= pc) {
    return lewy;
  }

  if (pb <= pc) {
    return gora;
  }

  return lewyGora;
}
