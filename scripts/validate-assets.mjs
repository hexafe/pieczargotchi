import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const katalogGlowny = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const katalogiAssetow = [
  path.join(katalogGlowny, 'assets', 'stages'),
  path.join(katalogGlowny, 'assets', 'activities'),
  path.join(katalogGlowny, 'assets', 'easter-eggs'),
  path.join(katalogGlowny, 'assets', 'effects')
];
const rozmiarKlatki = 512;
const przezroczystoscProgu = 8;

const pliki = katalogiAssetow.flatMap(zbierzPng);
const bledy = [];
const ostrzezenia = [];

if (!pliki.length) {
  bledy.push('Nie znaleziono assetów PNG w assets/stages, assets/activities ani assets/effects.');
}

pliki.forEach((plik) => {
  try {
    sprawdzPlik(plik);
  } catch (error) {
    bledy.push(`${path.relative(katalogGlowny, plik)}: ${error.message}`);
  }
});

ostrzezenia.forEach((tekst) => {
  console.warn(`Uwaga: ${tekst}`);
});

if (bledy.length) {
  console.error('Walidacja assetów nie powiodła się:');
  bledy.forEach((tekst) => console.error(`- ${tekst}`));
  process.exit(1);
}

console.log(`Walidacja assetów OK: ${pliki.length} plików PNG.`);

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

function sprawdzPlik(plik) {
  const obraz = wczytajPng(plik);

  if (obraz.height !== rozmiarKlatki) {
    throw new Error(`wysokość ${obraz.height}px, oczekiwano ${rozmiarKlatki}px`);
  }

  if (obraz.width % rozmiarKlatki !== 0) {
    throw new Error(`szerokość ${obraz.width}px nie jest wielokrotnością ${rozmiarKlatki}px`);
  }

  const liczbaKlatek = obraz.width / rozmiarKlatki;
  if (liczbaKlatek < 1 || liczbaKlatek > 12) {
    throw new Error(`podejrzana liczba klatek: ${liczbaKlatek}`);
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
