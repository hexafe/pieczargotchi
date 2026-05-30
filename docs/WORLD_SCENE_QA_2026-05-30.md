# World Scene QA - 2026-05-30

Wersja aplikacji: `0.1.27`
Zakres: świat, pogoda, trawa, życie sceny, animacje etapów, aktywności, zasoby
graficzne i ścieżki zapasowe.

## Wynik

QA wykryło jeden problem w narzędziu mobilnego capture: `capture-life-motion`
potrafił złapać pomiar zanim adaptive dock akcji zakończył przełączenie po
resize/observer eventach. Naprawa dodaje krótkie oczekiwanie na aktywny mobilny
dock przed asercjami viewportu.

Dodatkowo wczytywanie zasobów graficznych dostało dodatkową próbę statycznego
`assets/...` po pustym albo nieudanym odczycie Drive data URL. Cloudflare static
pozostaje główną ścieżką podglądu. Apps Script bez skonfigurowanych grafik z
Drive nadal może pokazać mechanizm zastępczy, jeżeli host nie serwuje plików
`assets/...`; przed wizualnym wydaniem Apps Script trzeba skonfigurować Drive
folder/ID albo jawnie zaakceptować mechanizm zastępczy canvasu.

## Uruchomione Gate'y

| Obszar | Komenda | Wynik |
| --- | --- | --- |
| Asset manifest | `node scripts/validate-assets.mjs` | OK; `253` arkusze PNG, `1` asset środowiska |
| Pogoda | `node scripts/test-weather-precip-motion.mjs` | OK |
| Trawa | `node scripts/test-grass-wind-motion.mjs` | OK |
| Niebo | `node scripts/test-celestial-position.mjs` | OK |
| Paleta sceny | `node scripts/test-scene-palette.mjs` | OK |
| Sprite baseline | `python3 scripts/audit-sprite-consistency.py` | OK; tylko miękkie ostrzeżenia driftu |
| Zarodek | `python3 scripts/audit-spore-sprites.py` | OK |
| Aktywności | `python3 scripts/audit-activity-sprite-motion.py` | OK |
| Glinty | `python3 scripts/audit-glint-sprites.py` | OK |

## Browser Capture

| Obszar | Komenda | Wynik |
| --- | --- | --- |
| Weather matrix | `PIECZARGOTCHI_CAPTURE_LIFE_PROFILE=1 node scripts/capture-weather-matrix.mjs http://127.0.0.1:8092/ /tmp/pieczargotchi-world-scene-0.1.26-weather` | OK; `38` scenariuszy |
| Etapy i aktywności | `PIECZARGOTCHI_CAPTURE_STAGES=1 PIECZARGOTCHI_CAPTURE_ACTIVITIES=1 node scripts/capture-app-render.mjs http://127.0.0.1:8092/ /tmp/pieczargotchi-world-scene-0.1.26-animations` | OK; dostępne aktywności zwracają oczekiwane klucze animacji |
| Życie sceny | `node scripts/capture-life-motion.mjs /tmp/pieczargotchi-world-scene-0.1.26-life` | Pierwszy przebieg wykrył mobilny timing docka |
| Życie sceny po poprawce | `node scripts/capture-life-motion.mjs /tmp/pieczargotchi-world-scene-0.1.27-life` | OK; pełny przebieg zakończony |

Przykładowe artefakty:

- `/tmp/pieczargotchi-world-scene-0.1.26-weather-clear-noon-cloud0-wind0-viewport-1194x891.png`
- `/tmp/pieczargotchi-world-scene-0.1.26-weather-clear-high-pressure-crisp-awake.png`
- `/tmp/pieczargotchi-world-scene-0.1.26-animations-stage-legendary.png`
- `/tmp/pieczargotchi-world-scene-0.1.26-animations-activity-adult-spores.png`
- `/tmp/pieczargotchi-world-scene-0.1.26-life/mobile-summer-life-frame1-viewport-390x844.png`
- `/tmp/pieczargotchi-mobile-frame2-repro-viewport-390x844.png`
- `/tmp/pieczargotchi-world-scene-0.1.27-life/mobile-summer-life-frame2-viewport-390x844.png`

## Notatki Wizualne

- Weather matrix objęła przejścia dnia, profile chmur, deszcz, śnieg, burzę,
  mgłę, halo, fogbow, rosę, szron, steam, heat haze, Perseidy i aurorę.
- Metryki trawy raportowały pełne pokrycie dolnej krawędzi i boków w
  scenariuszach pogodowych.
- Ambient life pokazało pszczoły, motyle, świetliki, ćmy, nietoperze, kwiaty
  i crawlery z warstwami przód/tył oraz różnymi trasami.
- Capture aktywności potwierdził, że `feed`, `instrument`, `sing`, `spores`
  i `harvest` używają sprite-owned animacji, bez canvasowego instrumentu albo
  nut nakładanych na arkusz.
- Ostrzeżenia driftu z `validate-assets` są miękkie i dotyczą głównie ruchu
  zamierzonego w `play`, `harvest`, `spores`, `legendary/excellent` oraz
  efektach cząsteczkowych.

## Dalsze Ryzyka

- Wizualne wydanie Apps Script wymaga osobnego kontrolnego uruchomienia z
  grafikami z Drive albo świadomej decyzji, że mechanizm zastępczy canvasu jest
  akceptowany.
- Warto dodać osobne mobilne one-off captures dla burzy, śniegu, mgły, aurory
  i nocnych świetlików, bo domyślny matrix ma tylko jeden mobilny scenariusz
  ambient life.
- Liczby zasobów graficznych w starszych dokumentach powinny być traktowane jako
  historyczne; bieżąca walidacja to `253` arkusze PNG i `246` zasobów czasu
  działania w manifeście.
