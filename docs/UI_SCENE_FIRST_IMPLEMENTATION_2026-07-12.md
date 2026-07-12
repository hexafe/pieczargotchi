# Scene-first UI 0.1.50

Data: 2026-07-12

## Wynik

Polish `0.1.50` przebudowuje interfejs wokół sceny Pieczarki, bez zmiany balansu gry i bez migracji zapisu. Widoczna wersja aplikacji oraz `package.json` mają `0.1.50`; format stanu pozostaje na wersji `18`, a klucz przeglądarkowy nadal ma nazwę `pieczargotchi_state_v2`.

Główne cele wydania:

- scena i aktualny nastrój są pierwszym punktem uwagi;
- opieka, gry i grzybnia są trzema jawnymi obszarami roboczymi;
- telefon dostaje pięć podstawowych akcji i kontrolowane `Więcej`, bez zasłaniania sceny;
- minigra pokazuje instrukcję i odliczanie przed rozpoczęciem właściwego czasu;
- modalne operacje na zapisie nie używają `window.confirm` i nie wykonują destrukcyjnej akcji bez podglądu;
- noc, dziennik, arena i sprite'y zachowują jeden język wizualny.

## Architektura UI

### Scena i nawigacja

Topbar zawiera tylko stan czuwania, przełącznik `Opieka / Legendy` po odblokowaniu Areny oraz `Menu`. Główny obszar opieki ma tablistę:

1. `Opieka` — statystyki, recovery checklist i akcje;
2. `Gry` — okazje, katalog minigier i aktywny playfield;
3. `Grzybnia` — progres długiej pętli, zasoby, odkrycia, dekoracje i historia.

Arena ma osobną tablistę `Arena / Wyzwania`. W walce kolejność interfejsu to: start, ruchy, status, trening i log. Canvas pokazuje arenę oraz postacie; mały tekstowy HUD nie jest dublowany wewnątrz grafiki.

Wybrana zakładka, rozwinięcie `Więcej`, aktywny modal i ostatni stabilny fokus należą wyłącznie do lokalnego stanu interfejsu. Nie trafiają do zapisu gry.

### Mobilny tray

Dla bezpiecznych viewportów do `640px` akcje opieki tworzą dolny tray:

- pięć podstawowych akcji;
- szósta kontrolka `Więcej` otwierająca pozostałe akcje nad trayem;
- podczas snu tylko akcja obudzenia;
- podczas kuracji tylko nawadnianie, karmienie, czyszczenie i kuracja.

W bardzo małym lub za niskim obszarze roboczym, między innymi `320x568`, pasek akcji wraca do normalnego przepływu dokumentu. Dzięki temu nie zasłania sceny, komunikatu ani zakładek. Wysokość wersji przyklejonej jest mierzona podczas działania i zasila `--action-tray-height` razem z `safe-area-inset-bottom`.

### Breakpointy

Kanoniczny test przeglądarkowy obejmuje 14 profili:

| Klasa | Viewporty |
| --- | --- |
| Desktop | `1440x900`, `1194x891`, `1024x600`, `900x600` |
| Krótki landscape | `844x390`, `740x360` |
| Tablet | `768x1024` |
| Telefon | `390x844`, `360x800`, `320x568` |
| Granice layoutu | `640x500`, `641x500`, `645x700`, `646x500` |

Zakres `641–880px` i wysokość do `700px` zachowuje dwie kolumny ze scrollowanym panelem bocznym. Canvas jest ograniczony do `512px` na dużych ekranach, `320px` na typowym telefonie, `288px` poniżej `380px` i `256px` poniżej `340px`.

## Minigry i zapis

Nowy launch flow jest wspólny dla minigier opieki:

1. właściwa zakładka i playfield zostają ujawnione;
2. finalna geometria modułu jest wyznaczana po dwóch klatkach layoutu;
3. cały moduł trafia do viewportu, a canvas otrzymuje fokus bez dodatkowego przewijania;
4. widoczna instrukcja odlicza `3–2–1`;
5. dopiero po odliczaniu rozpoczyna się pełny czas gry.

`startedAt` może leżeć w przyszłości, dlatego countdown przeżywa reload. `until` jest przesuwane o ten sam czas i nie skraca rundy. Aktywna minigra blokuje przejście do niepowiązanego widoku; przycisk powrotu prowadzi bezpośrednio do jej playfieldu.

Zmiany wyniku są grupowane co `250ms`, a `visibilitychange` natychmiast opróżnia bieżący zapis sesji. Przy końcu rundy oczekujący debounce i ogólny retry zostają anulowane; wynik oraz zamknięcie sesji zapisuje następnie jeden wyłączny CAS. Migawka porównawcza powstaje po wyczyszczeniu kolejki i przed wyliczeniem wyniku, więc żaden konkurencyjny zapis aktywnej sesji nie może podbić `saveRevision` ani wywołać fałszywego `stateChanged`. Dane przeglądarkowego testu są wstrzykiwane przed startem dokumentu, aby poprzednia instancja aplikacji nie mogła odnowić dzierżawy aktywnej sesji podczas przeładowania.

## Menu, backup i bezpieczeństwo operacji

`Menu`, reset, import, zmiana imienia i pamiątka dziennika korzystają z natywnych elementów `dialog`. Kontroler:

- ustawia fokus wewnątrz modalu;
- zamyka dialog przez jego jawne kontrolki i przywraca wcześniejszy fokus;
- utrzymuje informację o aktywnym modalu wyłącznie w lokalnym stanie interfejsu.

Import ma trzy fazy: parsowanie, podgląd i jawne potwierdzenie. Podgląd pokazuje nazwę, etap, wersję źródła oraz czas eksportu. Sam wybór pliku nie zastępuje żywego stanu. Reset i import są blokowane podczas aktywnej sesji wyłącznej.

## Dostępność

- Zakładki mają role `tablist/tab/tabpanel`, roving tabindex oraz obsługę strzałek, `Home` i `End`.
- Statystyki używają semantycznych progressbarów.
- Zmiany statusu trafiają do odpowiednich live regionów; zwykłe informacje są krótsze niż komunikaty assertive.
- Fokus ma wspólny, kontrastowy ring; wspierane są `forced-colors` i `prefers-contrast`.
- Kontrolki mają co najmniej `44px`, a akcje opieki i ruchy Areny co najmniej `48px`.
- Zablokowane, lecz edukacyjne akcje pozostają fokusowalne przez `aria-disabled` i podają przyczynę niedostępności.
- Link `Przejdź do sceny i opieki` pozwala ominąć topbar.
- Widoczne teksty pozostają po polsku, a wybrane imię zastępuje wyłącznie jawny token `{name}`.

## Rendering i grafika

Ambient grade pokrywa cały canvas po scenie, Pieczarce, trawie i opadach. Emisyjne reakcje są rysowane później, dzięki czemu noc nie tworzy prostokątnego szwu, a gwiazdy, zorza i subtelne błyski pozostają czytelne.

Dziennik używa wspólnej palety sceny, aliasów etapów, chmur, nieba i grass occlusion. Pamiątka jest natywnym modalem, a snapshot nie zależy od aktualnego etapu Pieczarki.

Arena wykorzystuje osobne body-only PNG. Animacja tury przechodzi przez `attack → impact → hurt → idle`; interfejs tekstowy pozostaje poza canvasem.

W `0.1.50` deterministycznie odświeżono:

- 35 arkuszy fidget/cursor dla pięciu etapów;
- 280 logicznych klatek tych reakcji;
- `spore/feed` i `spore/instrument` z celem `8/8` różnych klatek;
- tight-atlas metadata w `SpriteLayout.gs`.

Nie był potrzebny nowy modelowo wygenerowany zasób bitmapowy. Istniejące kuratorowane źródła i wycinki dawały lepszą kontrolę bazowej linii postaci, kierunku patrzenia oraz idempotencji generatora.

## Weryfikacja

Kontrakty wydania obejmują:

```sh
npm run qa:viewports
npm run qa:browser
npm run qa
python3 scripts/optimize-runtime-sprite-atlases.py --check
python3 scripts/generate-battle-assets.py --check
python3 scripts/audit-sprite-frame-quality.py
python3 scripts/audit-sprite-chroma.py --strict
```

Browser flow wykonuje prawdziwe akcje użytkownika: nadanie imienia, pobudkę, przejście do `Gry`, start rosy, odliczanie, pełny timer, zakończenie rundy i otwarcie `Menu`. Capture Areny dodatkowo wymaga dwóch kolumn ruchów, celu dotykowego `48px`, braku uciętych etykiet oraz poprawnej kolejności statusu i logu.

`dist/` pozostaje artefaktem lokalnym i nie jest commitowany. Build Cloudflare i Apps Script korzystają z tego samego zestawu źródłowych partiali UI.
