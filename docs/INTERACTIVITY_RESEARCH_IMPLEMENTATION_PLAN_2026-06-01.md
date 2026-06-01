# Plan Interaktywności Świata - 2026-06-01

Wersja aplikacji: `0.1.39`  
Wersja stanu: `16`  
Główny cel podglądu: statyczny build Cloudflare

Ten dokument zbiera research pod następny większy krok: świat ma reagować
częściej i bardziej wiarygodnie na ruch myszy, kliknięcia, dotyk na telefonie,
przeczesywanie trawy oraz zaczepianie drobnych gości sceny. Celem nie jest nowy
obowiązek dla gracza, tylko poczucie, że scena żyje między normalnymi akcjami
opieki.

## Podstawa W Repo

- `ClientInteraction.html` już zbiera pozycję wskaźnika w skali sceny `512x512`,
  poprzedni punkt, prędkość, ostatni ruch i kliknięcie. To jest właściwe miejsce
  na `pointerup`, `pointercancel`, serie kliknięć, dystans przeczesania trawy i
  licznik zaczepień dla celu.
- `ClientCoreImmersion.html` wybiera reakcje w kolejności: wskaźnik, pogoda,
  życie sceny, niebo, bezczynność. Blokady dla snu, odzyskiwania, końca gry,
  aktywności i pilnych potrzeb zostają nienaruszone.
- `ClientAnimation.html` używa reakcji świata tylko wtedy, gdy istnieje pasująca
  animacja dla etapu. Duże emocje pieczarki nadal powinny mieć arkusze animacji
  PNG; canvas może rysować krótkie błyski, ślady, fale, robaczki, żabę i znaki
  zniecierpliwienia.
- `ClientSceneGround.html` ma już lokalne ugięcie trawy od ruchu pieczarki,
  świetlików i wskaźnika. Przeczesywanie trawy powinno rozbudować ten kanał
  zamiast tworzyć osobny system.
- `ClientSceneLife.html` rysuje motyle, ćmy, pszczoły, pełzaki, świetliki i
  gości. Diagnostyka zbiera próbki pozycji, więc można ich używać do trafień
  wskaźnikiem bez przebudowy całego renderera.
- `ClientSceneCelestial.html` zapisuje diagnostykę słońca i księżyca, w tym
  pozycję, rozmiar i widoczność. To wystarczy do bezpiecznego trafiania w
  słońce lub księżyc.
- `StateModel.gs` ma istniejące `discoveries.environment`, dziennik i pamiątki
  gości. Trwałe znaleziska w trawie mogą użyć obecnego kształtu danych bez
  migracji, jeśli dodamy tylko nowe identyfikatory odkryć.

## Kontrakty Produktowe

- Interakcje świata nie mogą być dziennym zadaniem, karą ani źródłem presji.
- Klikanie trawy, nieba albo gości nie daje statów i nie zastępuje opieki.
- Mechaniki nie powinny wymagać zaglądania w nocy. Nocne sekrety są ozdobne i
  opcjonalne.
- Gdy pieczarka ma pilną potrzebę, śpi, jest w odzyskiwaniu albo gra jest
  zakończona, reakcje pieczarki nie powinny przejmować priorytetu.
- Krótkie reakcje sceny mogą nadal działać jako ozdoba, ale nie mogą odblokować
  akcji zablokowanych przez stan gry.
- Trwałe odkrycia mają trafiać do dziennika, polaroidów albo pamiątek, nie do
  surowej mocy gracza.

## Kontrakty Techniczne

- Pierwsze wdrożenie powinno być sesyjne i bez migracji zapisu.
- Nowe trwałe pola stanu wymagają podniesienia `PIECZARGOTCHI_STATE_VERSION`,
  wartości domyślnych, normalizacji, migracji, testów i gotowości wdrożenia.
- Zamiast jednego globalnego czasu odnowienia potrzebne będą krótkie czasy
  odnowienia per cel: pieczarka, trawa, słońce, księżyc, motyle, pełzaki,
  goście.
- Trafienia w życie sceny muszą tolerować brak próbki diagnostycznej, starą
  próbkę i niską widoczność.
- Ścieżki motyli, świetlików i pełzaków należy rozszerzać w logice ruchu, a
  rysowanie zostawić jako prosty pixel-artowy wynik.
- Przechwyty przeglądarkowe powinny sprawdzać diagnostykę i szerokie progi
  widoczności, nie identyczne piksele z pojedynczej klatki.

## Systemy Do Wdrożenia

### 1. Słownik Gestów

Rozszerzyć stan wejścia o:

- `pointerup` i `pointercancel`, żeby dotyk na telefonie nie zostawiał
  zawieszonych reakcji;
- serię kliknięć w krótkim oknie czasu;
- ostatni cel kliknięcia;
- dystans przeciągnięcia po trawie;
- lokalne czasy odnowienia dla celów;
- wspólną ścieżkę dla myszy i dotyku.

Akceptacja: ten sam punkt na canvasie ma dawać tę samą decyzję dla myszy i
dotyku.

### 2. Pieczarka Reaguje Na Gracza

Pierwszy zakres bez nowych arkuszy animacji:

- delikatne kliknięcie w korpus lub kapelusz używa obecnych reakcji patrzenia;
- szybki przelot wskaźnika przy pieczarce uruchamia podążanie wzrokiem;
- powtarzane zaczepianie robi krótką reakcję zniecierpliwienia jako efekt
  nakładany na scenę, bez trwałego wpływu na staty;
- hover przy twarzy może wydłużyć ciekawskie patrzenie, ale nie przykrywa pilnej
  potrzeby.

Większe miny pieczarki należy zostawić na osobny etap z arkuszami animacji dla
każdego etapu wzrostu.

### 3. Przeczesywanie Trawy

Pierwszy pełny slice powinien wejść tutaj:

- przeciąganie po dolnej części sceny wzmacnia lokalne ugięcie trawy;
- po odpowiednim ruchu pojawia się krótki szelest, pyłek, błysk rosy albo
  drobny pełzak;
- rzadziej może wyskoczyć mała żaba jako efekt sceny, z łukiem skoku i krótkim
  czasem odnowienia;
- brak znaleziska nadal powinien wyglądać jak reakcja świata, nie jak porażka.

Wersja pierwsza nie zapisuje nic w stanie gry. Trwałe znaleziska przychodzą
dopiero po ustabilizowaniu gestu.

### 4. Zwierzątka I Goście

Kolejny zakres:

- szybki ruch blisko motyla powoduje krótki odskok trasy i może zwrócić uwagę
  pieczarki;
- tapnięcie blisko pełzaka powoduje schowanie się albo zmianę kierunku;
- świetliki mogą chwilowo zbliżyć się do sporej latarenki lub mocniejszego
  blasku;
- gość sceny może machnąć, cofnąć się, zostawić ślad albo zniknąć, ale nie może
  dublować pamiątki dziennej.

Nowi goście powinni używać istniejącego katalogu odwiedzin i zakotwiczeń sceny.
Żaba najlepiej pasuje do deszczu, mgły, wilgoci i trawy przy kałuży.

### 5. Słońce I Księżyc Z Humorem

Reakcje nieba powinny być lekkie i sesyjne:

- pojedyncze kliknięcie: mrugnięcie;
- dwa kliknięcia w krótkim oknie: zniecierpliwione oczy;
- trzy lub więcej: zła mina na kilka sekund, potem spokojne wygaszenie.

Słońce i księżyc nie zapisują nastroju w stanie gry. Trafienia używają obecnych
pozycji diagnostycznych, progu widoczności i łagodnego marginesu celu. Jeśli
obiekt jest prawie niewidoczny przez pogodę albo poza sceną, kliknięcie nic nie
robi.

### 6. Ukryte Znaleziska

Trwałe odkrycia powinny być deterministyczne:

- ziarno wyboru: gracz, data, cel interakcji i szerokie okno czasu;
- warunki: pora dnia, pogoda, etap, dekoracje, stan sceny i brak pilnej
  potrzeby;
- limit: najwyżej jedno trwałe znalezisko danego typu w sensownym oknie;
- powtórka zwiększa licznik, ale nie tworzy drugiej nagrody.

Pomysły do katalogu:

- kropla rosy w źdźble;
- błyszczący pyłek przy kwiatach;
- ślad małego gościa;
- ukryty kamyczek;
- zapach po deszczu;
- nocny błysk w trawie;
- dzwoneczek mchu;
- czterolistna koniczynka.

## Podział Pracy Na Subagentów

- Wejście i priorytety: `ClientInteraction.html`, `ClientCoreImmersion.html`,
  testy decyzji i blokad.
- Trawa i życie sceny: `ClientSceneGround.html`, `ClientSceneLife.html`,
  diagnostyka próbek i ruchu.
- Niebo: `ClientSceneCelestial.html`, hit-test słońca i księżyca, miny
  nakładane na ciało niebieskie.
- Odkrycia: katalog znalezisk, użycie `discoveries.environment`, dziennik,
  brak migracji w pierwszym wariancie.
- QA: testy deterministyczne, przechwyty desktop/mobile, ścieżka myszy i
  dotyku, progi widoczności.
- Dokumentacja: `docs/NEXT_STEPS.md`, sprite bible tylko wtedy, gdy dochodzą
  nowe arkusze animacji.

## Kolejność Slice'ów

1. Instrumentacja wejścia i przechwytów: wspólne ruchy myszy/dotyku, diagnostyka
   aktywnego celu, testy blokad.
2. Przeczesywanie trawy i delikatne zaczepianie pieczarki bez migracji zapisu.
3. Odskoki motyli, pełzaków i prosty efekt żaby.
4. Zniecierpliwione słońce i księżyc.
5. Trwałe znaleziska w trawie przez istniejące odkrycia środowiskowe.
6. Osobne arkusze animacji dla większych emocji pieczarki, jeśli poprzednie
   slice'y pokażą, że obecne animacje nie wystarczają.

## Kryteria Akceptacji

- Mysz i dotyk uruchamiają ten sam kontrakt dla tych samych współrzędnych sceny.
- Tapnięcie blisko pieczarki jest zużywane raz i nie powtarza się bez nowego
  wejścia.
- Szybki ruch przy pieczarce wybiera reakcję śledzenia kursora.
- Przeczesanie trawy tworzy świeżą lokalną reakcję trawy i wygasa w
  przewidywalnym czasie.
- Motyle, pełzaki i goście nie zmieniają trasy losowo z klatki na klatkę.
- Zła mina słońca albo księżyca pojawia się tylko przy widocznym celu i nie
  zmienia statów.
- Trwałe znaleziska zapisują pierwsze odkrycie raz, a powtórki nie dublują
  wpisu jako nowego.
- Browser capture przechodzi na desktopie i mobilnym widoku bez nakładania się
  UI na scenę.

## Walidacja

Podstawowe bramki po implementacji:

```bash
node scripts/check-client-syntax.mjs
node scripts/test-client-core.mjs
env TZ=UTC node scripts/test-client-core.mjs
node scripts/test-grass-wind-motion.mjs
node scripts/test-celestial-position.mjs
node scripts/test-scene-palette.mjs
node scripts/test-weather-precip-motion.mjs
npm run build
npm run test:cloudflare-static
npm run audit:polish-copy
```

Przechwyty lokalne po uruchomieniu serwera:

```bash
PIECZARGOTCHI_CAPTURE_IMMERSION=1 node scripts/capture-app-render.mjs http://127.0.0.1:8091/ /tmp/pieczargotchi-immersion
PIECZARGOTCHI_CAPTURE_LIFE_PROFILE=1 PIECZARGOTCHI_CAPTURE_GRASS_POINTER=1 node scripts/capture-app-render.mjs http://127.0.0.1:8091/ /tmp/pieczargotchi-grass
PIECZARGOTCHI_VIEWPORT_WIDTH=390 PIECZARGOTCHI_VIEWPORT_HEIGHT=844 PIECZARGOTCHI_EMULATE_MOBILE=1 PIECZARGOTCHI_CAPTURE_VIEWPORT=1 node scripts/capture-app-render.mjs http://127.0.0.1:8091/ /tmp/pieczargotchi-mobile
node scripts/capture-life-motion.mjs /tmp/pieczargotchi-life-motion
```
