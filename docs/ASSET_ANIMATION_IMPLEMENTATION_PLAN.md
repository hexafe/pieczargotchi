# Plan Implementacji Assetów I Animacji

Data: 2026-05-09

Cel: przygotować pełny system grafik dla wszystkich etapów wzrostu Pieczarki oraz dodatkowych animacji aktywności, potrzeb i reakcji. Ten dokument jest planem kolejnych prac implementacyjnych, nie opisem obecnego MVP.

## Zasady Bazowe

- Wszystkie teksty widoczne dla gracza oraz komentarze w nowych plikach mają być po polsku.
- Każda klatka runtime ma format `512x512`.
- Każdy sheet składa się z klatek `512x512` ułożonych poziomo.
- Treść każdej klatki musi być wycentrowana. Renderer nie może naprawiać driftu per-klatkowym offsetem.
- Główne pozy, miny i etapy wzrostu mają pochodzić z PNG. JavaScript może rysować tylko efekty tymczasowe: krople, nutki, pył, błysk, alarm, myśli, zarodniki.
- Każdy sheet musi mieć manifest: nazwa, etap, aktywność, liczba klatek, czas klatek, pętla, priorytet, akcja wyzwalająca.
- Najpierw robimy mało animacji, ale bardzo spójnych. Dopiero potem rozszerzamy warianty.

## Docelowa Struktura Plików

```text
assets/
  stages/
    spore/
      idle_sheet.png
      sleep_sheet.png
      wake_sheet.png
      happy_sheet.png
      tired_sheet.png
      dry_sheet.png
      hungry_sheet.png
      dirty_sheet.png
      sick_sheet.png
      critical_sheet.png
    baby/
      ...
    young/
      ...
    adult/
      ...
    legendary/
      ...
  activities/
    hydrate_sheet.png
    feed_sheet.png
    clean_sheet.png
    play_sheet.png
    instrument_sheet.png
    sing_sheet.png
    spores_sheet.png
    harvest_sheet.png
  effects/
    drops_sheet.png
    sparkle_sheet.png
    dust_sheet.png
    notes_sheet.png
    spore_cloud_sheet.png
  source/
    prompts/
    working/
    exports/
```

Na czas przejściowy można utrzymać obecne pliki:

- `assets/awake.png`
- `assets/sleeping_sheet.png`

Po wdrożeniu manifestu powinny zostać zastąpione przez:

- `assets/stages/baby/idle_sheet.png`
- `assets/stages/baby/sleep_sheet.png`

## Etapy Wzrostu

### 1. Zarodnik

Charakter: mały, delikatny, bardziej roślina niż postać.

Sylwetka:

- mały zarodnik lub mini-kiełek w mchu,
- brak pełnego kapelusza,
- subtelne pulsowanie zamiast klasycznej twarzy.

Wymagane animacje:

- `idle_sheet.png`: 4 klatki, wolne pulsowanie.
- `sleep_sheet.png`: 4 klatki, niemal nieruchomy zarodnik, małe `Z`.
- `wake_sheet.png`: 3 klatki, szybkie drgnięcie po przebudzeniu.
- `dry_sheet.png`: 4 klatki, lekko przygaszony mech.
- `hungry_sheet.png`: 4 klatki, zarodnik przechyla się ku podłożu.
- `happy_sheet.png`: 4 klatki, drobny błysk.

Nie potrzebuje jeszcze:

- pełnego śpiewu,
- instrumentu,
- zarodnikowania.

### 2. Maluch

Charakter: obecna Pieczarka, miękka i czytelna.

Sylwetka:

- obecny kapelusz i trawa jako punkt odniesienia stylu,
- małe oczy, prosta mina,
- dużo ekspresji przez kapelusz i policzki.

Wymagane animacje:

- `idle_sheet.png`: 4 klatki, oddech, mrugnięcie, lekkie patrzenie.
- `sleep_sheet.png`: obecny `sleeping_sheet.png` po przeniesieniu.
- `wake_sheet.png`: 3-4 klatki, `O_O`, potem powrót do idle.
- `happy_sheet.png`: 4 klatki, policzki, mały podskok kapelusza.
- `tired_sheet.png`: 4 klatki, półprzymknięte oczy i opadający kapelusz.
- `dry_sheet.png`: 4 klatki, zwiędły mech i przygaszona mina.
- `hungry_sheet.png`: 4 klatki, patrzy na kompost/podłoże.
- `dirty_sheet.png`: 4 klatki, pyłki/brud blisko mchu.
- `sick_sheet.png`: 4 klatki, blady odcień i lekki chwiej.
- `critical_sheet.png`: 4 klatki, wyraźny alarm ciała, bez przesadnego chaosu.

### 3. Młoda

Charakter: bardziej ciekawska, żywsza, gotowa do aktywności.

Sylwetka:

- większy trzon,
- kapelusz trochę wyższy,
- trawa może być bogatsza,
- oczy nadal małe i spójne z Maluchem.

Wymagane animacje:

- wszystkie animacje Malucha,
- `play_sheet.png`: energiczne kołysanie,
- `instrument_sheet.png`: słuchanie/kiwanie,
- `sing_sheet.png`: otwarte usta i nutki.

### 4. Dorosła

Charakter: stabilna, opiekuńcza, gotowa do plonów.

Sylwetka:

- pełniejszy kapelusz,
- bogatsza grządka,
- drobne kwiaty lub elementy grzybni,
- większy zakres reakcji.

Wymagane animacje:

- pełny zestaw potrzeb i reakcji,
- `spores_sheet.png`: wyrzut zarodników,
- `harvest_sheet.png`: grzybnia dojrzewa i daje plon,
- `excellent_sheet.png`: stan bardzo dobrej opieki.

### 5. Legendarna

Charakter: nagroda za długą dobrą opiekę, bardziej magiczna, ale nadal pieczarkowa.

Sylwetka:

- większy kapelusz z subtelnym połyskiem,
- bogata grządka,
- więcej drobnych światełek i zarodników,
- nie przesadzić z efektem, żeby nie odejść od pikselowej prostoty.

Wymagane animacje:

- pełny zestaw Dorosłej,
- `legendary_idle_sheet.png`: spokojny połysk i żyjąca grzybnia,
- `legendary_spores_sheet.png`: specjalny plon,
- `legendary_sleep_sheet.png`: spokojny, „królewski” sen.

## Macierz Animacji

| Animacja | Zarodnik | Maluch | Młoda | Dorosła | Legendarna | Priorytet |
| --- | --- | --- | --- | --- | --- | --- |
| idle | tak | tak | tak | tak | tak | P0 |
| sleep | tak | tak | tak | tak | tak | P0 |
| wake | tak | tak | tak | tak | tak | P0 |
| happy | tak | tak | tak | tak | tak | P1 |
| tired | nie | tak | tak | tak | tak | P1 |
| dry | tak | tak | tak | tak | tak | P1 |
| hungry | tak | tak | tak | tak | tak | P1 |
| dirty | nie | tak | tak | tak | tak | P1 |
| sick | nie | tak | tak | tak | tak | P1 |
| critical | nie | tak | tak | tak | tak | P1 |
| hydrate reaction | tak | tak | tak | tak | tak | P2 |
| feed reaction | tak | tak | tak | tak | tak | P2 |
| clean reaction | nie | tak | tak | tak | tak | P2 |
| play reaction | nie | tak | tak | tak | tak | P2 |
| instrument | nie | nie | tak | tak | tak | P3 |
| sing | nie | tak | tak | tak | tak | P3 |
| spores | nie | nie | nie | tak | tak | P3 |
| harvest | nie | nie | tak | tak | tak | P3 |

## Priorytety Produkcji

### P0 - Fundament

Cel: zastąpić obecne pojedyncze grafiki manifestem animacji dla etapów.

Assety:

- `baby/idle_sheet.png`
- `baby/sleep_sheet.png`
- `baby/wake_sheet.png`
- `spore/idle_sheet.png`
- `spore/sleep_sheet.png`
- `young/idle_sheet.png`
- `adult/idle_sheet.png`
- `legendary/idle_sheet.png`

Kod:

- `AnimationConfig.gs` z manifestem.
- `getAnimationManifest()` w konfiguracji klienta.
- `loadAnimationAssets()` po stronie klienta.
- `selectAnimation(state, now)` z fallbackiem do obecnych grafik.
- Debugowy podpis aktywnej animacji tylko w trybie lokalnym.

Akceptacja:

- aplikacja wybiera idle/sleep/wake według etapu wzrostu,
- brak offsetów per-klatka,
- każda klatka przechodzi walidację środka,
- lokalny podgląd nadal działa bez Drive ID.

### P1 - Potrzeby I Stany Krytyczne

Cel: Pieczarka ma komunikować potrzeby przede wszystkim animacją.

Assety:

- `*/dry_sheet.png`
- `*/hungry_sheet.png`
- `*/dirty_sheet.png`
- `*/tired_sheet.png`
- `*/sick_sheet.png`
- `*/critical_sheet.png`

Kod:

- mapowanie `need -> animationKey`,
- różne animacje dla `mild` i `critical`,
- timer attention call podbija priorytet animacji,
- po naprawieniu potrzeby przejście do animacji reakcji.

Akceptacja:

- sucha, głodna, brudna, senna i chora Pieczarka wyglądają różnie,
- krytyczna potrzeba jest natychmiast widoczna bez czytania panelu,
- senność nie wyświetla attention call, kiedy Pieczarka już śpi.

### P2 - Reakcje Na Opiekę

Cel: każde kliknięcie ma dawać krótką, przyjemną odpowiedź.

Assety:

- `activities/hydrate_sheet.png`
- `activities/feed_sheet.png`
- `activities/clean_sheet.png`
- `activities/play_sheet.png`
- `activities/harvest_sheet.png`

Kod:

- kolejka `reactionQueue`,
- animacje jednorazowe z priorytetem nad idle,
- po zakończeniu reakcja wraca do najlepszego stanu idle/potrzeby,
- plon grzybni odpala `harvest_sheet.png`.

Akceptacja:

- zroszenie pokazuje krople i ożywienie mchu,
- karmienie pokazuje reakcję na kompost,
- sprzątanie usuwa pył/brud,
- zabawa daje mały podskok/serduszka,
- plon zarodników jest czytelny i satysfakcjonujący.

### P3 - Aktywności I Osobowość

Cel: Pieczarka ma robić rzeczy, a nie tylko reagować na potrzeby.

Assety:

- `activities/instrument_sheet.png`
- `activities/sing_sheet.png`
- `activities/spores_sheet.png`
- warianty dla Młodej, Dorosłej i Legendarnej.

Kod:

- `currentActivity` wybiera animację,
- instrument ma wariant losowy,
- śpiew ma własny ruch ust,
- zarodnikowanie wymaga etapu Dorosła lub Legendarna.

Akceptacja:

- muzyka i śpiew wyglądają inaczej,
- Dorosła i Legendarna mają osobne zarodnikowanie,
- aktywności nadal respektują energię i cooldowny.

## Standard Sheetów

### Nazewnictwo

```text
assets/stages/{stage}/{animation}_sheet.png
assets/activities/{activity}_sheet.png
assets/effects/{effect}_sheet.png
```

Dozwolone `stage`:

- `spore`
- `baby`
- `young`
- `adult`
- `legendary`

Dozwolone `animation`:

- `idle`
- `sleep`
- `wake`
- `happy`
- `tired`
- `dry`
- `hungry`
- `dirty`
- `sick`
- `critical`
- `excellent`

### Czasy Klatek

Nie używać jednego FPS dla wszystkiego, jeżeli animacja potrzebuje charakteru.

Rekomendacje:

- idle: `420, 420, 520, 260 ms`
- sleep: `333, 333, 333, 333 ms`
- wake: `120, 180, 240, 420 ms`
- happy: `120, 120, 180, 360 ms`
- tired: `520, 520, 700, 520 ms`
- critical: `120, 120, 160, 120 ms`
- action reaction: `80, 120, 180, 260 ms`

Manifest powinien wspierać `frameDurationsMs`, a nie tylko `fps`.

## Pipeline Produkcji Assetów

### Krok 1 - Sprite Bible

Utworzyć `docs/SPRITE_BIBLE.md` z:

- paletą kolorów,
- grubością outline,
- pozycją kapelusza/trzonu,
- punktami twarzy,
- zasadami trawy/mchu,
- przykładami poprawnych i błędnych klatek,
- opisem każdej fazy wzrostu.

### Krok 2 - Generowanie Lub Rysowanie Baz

Dla każdego etapu:

1. stworzyć jedną bazową klatkę idle,
2. porównać z `baby/idle`,
3. poprawić proporcje,
4. dopiero potem tworzyć animacje.

Nie generować od razu całych sheetów dla wszystkich stanów bez kontroli stylu. To prowadzi do driftu i niespójnej Pieczarki.

### Krok 3 - Cięcie I Składanie Sheetów

Docelowe skrypty:

- `scripts/split-sheet.mjs`
- `scripts/build-sheet.mjs`
- `scripts/validate-assets.mjs`
- `scripts/compare-frame-centers.mjs`

Walidacja:

- wymiar sheetu to `512 * frameCount` na `512`,
- każda klatka ma alpha,
- bounding box każdej klatki mieści się w tolerancji środka,
- różnica środka między klatkami nie przekracza 2 px,
- asset istnieje w manifeście albo jest oznaczony jako eksperymentalny.

### Krok 4 - Manifest Animacji

Przykład:

```javascript
{
  key: "baby.idle",
  stage: "baby",
  state: "idle",
  fileName: "assets/stages/baby/idle_sheet.png",
  frameCount: 4,
  frameWidth: 512,
  frameHeight: 512,
  frameDurationsMs: [420, 420, 520, 260],
  loop: true,
  priority: 10
}
```

### Krok 5 - Podpięcie Renderera

Zmiany w kliencie:

- zastąpić `drawAwakeSprite()` i `drawSleepingSprite()` generycznym `drawAnimationFrame()`,
- dodać `runtime.animations`,
- dodać `runtime.currentAnimation`,
- dodać `selectAnimation(state, now)`,
- zachować efekty canvasowe jako warstwę nad PNG.

## Podział Zadań I Modele

### Zadanie A - Sprite Bible I Kontrakt Assetów

Model: GPT-5.5 jako główny integrator.

Zakres:

- opisać styl Pieczarki,
- ustalić paletę, proporcje i punkty twarzy,
- przenieść obecne decyzje o centrowaniu do `docs/SPRITE_BIBLE.md`,
- zdefiniować wymogi dla wszystkich etapów wzrostu.

Dlaczego ten model: zadanie wymaga decyzji produktowych, spójności wizualnej i kontroli nad długoterminową architekturą assetów.

### Zadanie B - Walidacja I Narzędzia Assetów

Model: gpt-5.3-codex jako worker kodowy, z główną integracją w GPT-5.5.

Zakres:

- dodać `scripts/validate-assets.mjs`,
- dodać helpery do cięcia i składania sheetów,
- mierzyć bounding box, środek klatki i tolerancję driftu,
- zapewnić czytelne błędy po polsku.

Dlaczego ten model: zadanie jest techniczne, izolowane i dobrze pasuje do kodowego workera z jasnym zakresem plików.

### Zadanie C - Manifest Animacji I Renderer

Model: GPT-5.5 jako główny integrator.

Zakres:

- dodać `AnimationConfig.gs`,
- podpiąć manifest do konfiguracji klienta,
- zastąpić specjalne ścieżki `awake/sleeping` generycznym renderowaniem animacji,
- utrzymać lokalny preview i fallbacki bez Drive ID.

Dlaczego ten model: zmiana dotyka kontraktu Apps Script, klienta i runtime fallbacków, więc powinna zostać scalona ostrożnie.

### Zadanie D - Produkcja Assetów P0

Model: GPT-5.5 dla kierunku artystycznego, imagegen tylko do generowania lub przerabiania bitmap, gpt-5.4-mini do szybkiej kontroli listy wymagań.

Zakres:

- stworzyć `baby/idle`, `baby/sleep`, `baby/wake`,
- stworzyć bazowe `spore/idle`, `young/idle`, `adult/idle`, `legendary/idle`,
- walidować środki klatek po każdym sheecie,
- porównywać nowe etapy z obecnym stylem Malucha.

Dlaczego ten zestaw: assety wymagają kontroli stylu, ale checklisty i porównania można oddzielić od głównej integracji.

### Zadanie E - Produkcja Assetów P1/P2/P3

Model: GPT-5.5 dla priorytetów i integracji, imagegen dla bitmap, gpt-5.4-mini jako read-only recenzent kompletności.

Zakres:

- P1: potrzeby i stany krytyczne,
- P2: reakcje na opiekę,
- P3: muzyka, śpiew, zarodniki i plony,
- po każdej grupie uruchomić walidację assetów i lokalny preview.

Dlaczego ten zestaw: duża liczba assetów grozi dryfem stylu, więc każda paczka powinna mieć osobną kontrolę kompletności.

## Kolejność Najbliższych Implementacji

### Sesja 1 - Fundament Assetów

1. Utworzyć `docs/SPRITE_BIBLE.md`.
2. Utworzyć katalogi `assets/stages/...`.
3. Przenieść obecne `awake.png` i `sleeping_sheet.png` do `assets/stages/baby/`.
4. Dodać skrypt walidacji assetów.
5. Dodać minimalny `AnimationConfig.gs`.
6. Renderer nadal ma wyglądać tak samo jak teraz.

### Sesja 2 - Pierwsze Etapy Wzrostu

1. Stworzyć bazowe idle dla `spore`, `young`, `adult`, `legendary`.
2. Dodać fallback: jeżeli brak animacji stanu, użyj `stage.idle`.
3. Podpiąć wybór grafiki po `state.stage`.
4. Dodać lokalny debug aktywnego etapu i animacji.

### Sesja 3 - Potrzeby

1. Stworzyć `baby/dry`, `baby/hungry`, `baby/dirty`, `baby/tired`, `baby/sick`.
2. Podpiąć wybór animacji po `attention.activeNeed`.
3. Dodać wariant `critical`.
4. Usunąć część canvasowych zastępników, jeżeli PNG są gotowe.

### Sesja 4 - Reakcje Akcji

1. Stworzyć reakcje `hydrate`, `feed`, `clean`, `play`.
2. Dodać queue jednorazowych animacji.
3. Dodać animację plonu grzybni.
4. Zbalansować długość reakcji, żeby UI było szybkie.

### Sesja 5 - Muzyka, Śpiew, Zarodniki

1. Stworzyć `instrument`, `sing`, `spores`.
2. Dodać różne nutki/tempo dla instrumentów.
3. Dorosła i Legendarna dostają lepsze zarodnikowanie.
4. Sprawdzić, czy efekty nie zasłaniają twarzy.

## Kryteria Gotowości

Plan assetów można uznać za gotowy do implementacji, gdy:

- istnieje Sprite Bible,
- istnieje manifest animacji,
- każdy nowy asset przechodzi walidację wymiaru i środka,
- Maluch ma pełny zestaw P0/P1,
- każdy etap wzrostu ma przynajmniej idle i sleep,
- renderer potrafi przełączać animacje bez specjalnych wyjątków dla pojedynczych plików,
- lokalny podgląd pokazuje aktywny etap i animację,
- cała widoczna treść pozostaje po polsku.

## Status Implementacji - 2026-05-09

- [x] Utworzono `docs/SPRITE_BIBLE.md`.
- [x] Dodano `AnimationConfig.gs` z manifestem animacji runtime.
- [x] Wygenerowano 5 etapów wzrostu: `spore`, `baby`, `young`, `adult`, `legendary`.
- [x] Każdy etap ma 11 sheetów: `idle`, `sleep`, `wake`, `happy`, `excellent`, `tired`, `dry`, `hungry`, `dirty`, `sick`, `critical`.
- [x] Dodano 8 sheetów aktywności: `hydrate`, `feed`, `clean`, `play`, `instrument`, `sing`, `spores`, `harvest`.
- [x] Dodano 5 opcjonalnych sheetów efektów: `drops`, `sparkle`, `dust`, `notes`, `spore_cloud`.
- [x] Dodano generator roboczych assetów: `scripts/generate-pixel-assets.py`.
- [x] Dodano walidator wymiarów, formatu i centrowania: `scripts/validate-assets.mjs`.
- [x] Renderer wybiera animacje z manifestu zamiast specjalnych ścieżek `awake`/`sleeping`.
- [x] Lokalny preview serwuje nową strukturę assetów z `assets/stages`, `assets/activities` i `assets/effects`.

Do dalszego doszlifowania:

- [ ] zmniejszyć miękki drift w `critical`, `wake`, `sick`, `sleep` i części efektów,
- [ ] zdecydować, kiedy usunąć lub zarchiwizować legacy `assets/awake.png` i `assets/sleeping_sheet.png`,
- [ ] przepiąć efekty PNG do runtime, jeżeli canvasowe efekty przestaną wystarczać.

## Audyt Skali Sprite'ów - 2026-05-10

- [x] Zweryfikowano realny rendering przez headless Chromium i lokalny preview.
- [x] Ustalono docelowy start gry: `growth: 0` pokazuje `Zarodnik`, a `Maluch` zaczyna się od `growth: 12`.
- [x] Naprawiono generator twarzy: oczy, usta i rumieńce skalują się względem etapu.
- [x] Przebudowano generator stage'ów: trawa jest wspólną warstwą, a różnice wzrostu siedzą w samej Pieczarce.
- [x] Dodano docelową listę sprite'ów etapów: `docs/STAGE_SPRITE_REQUIREMENTS.md`.
- [x] Dodano `scripts/audit-sprite-consistency.py` do kontroli spójności `sleep`, `wake` i `idle`.
- [x] Pełny zapis audytu: `docs/SPRITE_AUDIT_2026-05-10.md`.

## Pass Imagegenowy Sprite'ów - 2026-05-10

- [x] Wygenerowano atlasy imagegen dla 11 stanów stage, 8 akcji i 5 efektów pomocniczych.
- [x] Dodano `scripts/build-imagegen-sprites.py`, który tnie atlasy, usuwa chroma-key i buduje runtime sheety.
- [x] `scripts/generate-pixel-assets.py` deleguje do imagegenowego buildera, gdy istnieją źródła w `assets/source/imagegen/raw/`.
- [x] Aktywności są stage-specific: `assets/activities/<stage>/<activity>_sheet.png`.
- [x] `AnimationConfig.gs` generuje klucze `stage.activity.action`, a `Client.html` szuka aktywności najpierw dla aktywnego etapu.
- [x] Walidacja przechodzi dla `108` PNG.
- [x] Capture aplikacji potwierdza, że akcje nie przeskakują na dorosłą Pieczarkę.

## Ryzyka

- Generowanie całych sheetów naraz może dać niespójne proporcje między klatkami.
- Zbyt dużo animacji w pierwszym kroku spowolni integrację.
- Krytyczne animacje mogą być zbyt hałaśliwe i męczyć użytkownika.
- Etapy wzrostu mogą stracić rozpoznawalność, jeżeli każdy etap będzie rysowany w innym stylu.
- Canvasowe efekty i PNG mogą się dublować, jeżeli nie ustalimy priorytetu warstw.

## Decyzje Do Podjęcia Przed Produkcją Grafik

- Czy bazowe grafiki robimy ręcznie, generujemy, czy hybrydowo?
- `spore` jest faktycznym pierwszym etapem nowej gry.
- Czy Legendarna Pieczarka ma być osobnym etapem wzrostu, czy nagrodowym stanem Dorosłej?
- Czy każdy etap ma mieć osobne `sleep_sheet.png`, czy część etapów może używać jednego sleep fallbacku?
- Assety aktywności są osobne dla każdego etapu.
