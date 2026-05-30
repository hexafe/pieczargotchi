# World Scene QA - 2026-05-30

Wersja aplikacji: `0.1.28`
Zakres: świat, pogoda, trawa, życie sceny, animacje etapów, aktywności, zasoby
graficzne i ścieżki zapasowe.

## Wynik

QA wykryło jeden problem w narzędziu mobilnego capture: `capture-life-motion`
potrafił złapać pomiar zanim adaptive dock akcji zakończył przełączenie po
resize/observer eventach. Naprawa dodaje krótkie oczekiwanie na aktywny mobilny
dock przed asercjami viewportu.

Dodatkowe mobilne capture'y wykryły, że wymuszenie lokacji `tromso` działało dla
pozycji ciał niebieskich, ale nie trafiało do profilu zórz w diagnostyce efektów
nieba. Renderer nieba przekazuje teraz debug location do profilu zórz, a pasma
zorzy są czytelniejsze na mobilnym canvasie.

Dodatkowo wczytywanie zasobów graficznych dostało dodatkową próbę statycznego
`assets/...` po pustym albo nieudanym odczycie Drive data URL. Cloudflare static
jest ścieżką wydania i testów ze znajomymi. Apps Script pozostaje
kompatybilnościowym scaffoldem, więc brak skonfigurowanych grafik z Drive nie
blokuje wydania Cloudflare.

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
| Mobile burza | `PIECZARGOTCHI_CAPTURE_VIEWPORT=1 ... PIECZARGOTCHI_DEBUG_WEATHER=storm node scripts/capture-app-render.mjs http://127.0.0.1:8092/ /tmp/pieczargotchi-world-mobile-0.1.28-storm` | OK; dock `390x844`, deszcz i trawa czytelne |
| Mobile śnieg | `PIECZARGOTCHI_CAPTURE_VIEWPORT=1 ... PIECZARGOTCHI_DEBUG_WEATHER=snow node scripts/capture-app-render.mjs http://127.0.0.1:8092/ /tmp/pieczargotchi-world-mobile-0.1.28-snow` | OK; śnieg i snow cover czytelne |
| Mobile mgła | `PIECZARGOTCHI_CAPTURE_VIEWPORT=1 ... PIECZARGOTCHI_DEBUG_WEATHER=fog node scripts/capture-app-render.mjs http://127.0.0.1:8092/ /tmp/pieczargotchi-world-mobile-0.1.28-fog` | OK; mgła nie zasłania grzyba |
| Mobile zorza | `PIECZARGOTCHI_CAPTURE_VIEWPORT=1 ... PIECZARGOTCHI_DEBUG_LOCATION=tromso PIECZARGOTCHI_DEBUG_SKY_EFFECT=aurora node scripts/capture-app-render.mjs http://127.0.0.1:8092/ /tmp/pieczargotchi-world-mobile-0.1.28-aurora-final` | OK po poprawce; diagnostyka używa Tromso |
| Mobile nocne świetliki | `PIECZARGOTCHI_CAPTURE_VIEWPORT=1 ... PIECZARGOTCHI_DEBUG_WEATHER=clear node scripts/capture-app-render.mjs http://127.0.0.1:8092/ /tmp/pieczargotchi-world-mobile-0.1.28-night-fireflies` | OK; świetliki, ćmy i nietoperze aktywne |

Przykładowe artefakty:

- `/tmp/pieczargotchi-world-scene-0.1.26-weather-clear-noon-cloud0-wind0-viewport-1194x891.png`
- `/tmp/pieczargotchi-world-scene-0.1.26-weather-clear-high-pressure-crisp-awake.png`
- `/tmp/pieczargotchi-world-scene-0.1.26-animations-stage-legendary.png`
- `/tmp/pieczargotchi-world-scene-0.1.26-animations-activity-adult-spores.png`
- `/tmp/pieczargotchi-world-scene-0.1.26-life/mobile-summer-life-frame1-viewport-390x844.png`
- `/tmp/pieczargotchi-mobile-frame2-repro-viewport-390x844.png`
- `/tmp/pieczargotchi-world-scene-0.1.27-life/mobile-summer-life-frame2-viewport-390x844.png`
- `/tmp/pieczargotchi-world-mobile-0.1.28-storm-awake.png`
- `/tmp/pieczargotchi-world-mobile-0.1.28-snow-awake.png`
- `/tmp/pieczargotchi-world-mobile-0.1.28-fog-awake.png`
- `/tmp/pieczargotchi-world-mobile-0.1.28-aurora-final-awake.png`
- `/tmp/pieczargotchi-world-mobile-0.1.28-night-fireflies-awake.png`

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
- Mobilne capture'y burzy, śniegu, mgły, zorzy i świetlików utrzymują czytelny
  canvas, stabilny dock `390x844` i pełne pokrycie dolnej krawędzi trawą.

## Dalsze Ryzyka

- Apps Script smoke może być osobnym testem kompatybilności, ale nie jest bramką
  wydania.
- Liczby zasobów graficznych w starszych dokumentach powinny być traktowane jako
  historyczne; bieżąca walidacja to `253` arkusze PNG i `246` zasobów czasu
  działania w manifeście.
