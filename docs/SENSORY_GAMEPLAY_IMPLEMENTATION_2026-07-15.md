# Sensory Gameplay Implementation - 2026-07-15

Release target: `0.1.58`

State target: `22`

Ten dokument zamyka plan audytu grafiki, animacji, płynności, immersji, pogody i utrzymania uwagi. Opisuje wdrożony kontrakt, a nie listę życzeń.

## Rezultat Dla Gracza

- Aktywna minigra jest główną powierzchnią rozgrywki, zamiast małym dodatkiem obok pełnej sceny opieki.
- Świat ma czytelny horyzont, środkową polanę i pierwszy plan. Mały `spore` nie ginie w trawie, a pogoda zachowuje głębię.
- Zorza, mgła i błysk burzy mają czytelniejsze kształty oraz bezpieczne ustawienia ruchu/błysków.
- Ambient nie próbuje jednocześnie pokazać wszystkiego. Opieka i wejście gracza mają pierwszeństwo, a fauna dostaje rzadsze okna fokusowe.
- Świat ma opcjonalny proceduralny pejzaż audio bez pobierania zewnętrznych plików. Dźwięk startuje dopiero po geście użytkownika.
- Dziennik może podawać jeden delikatny trop dziennie. Trop nie jest nagrodą i nie da się go farmić przez odświeżanie.

## Kontrakt Działania Aplikacji

Aplikacja mierzy rzeczywisty koszt rysowania sceny w ograniczonym buforze próbek. Sterownik jakości obniża ją po utrzymanym przeciążeniu i podnosi dopiero po dłuższym stabilnym oknie, aby uniknąć migotania poziomów. Profile jakości sterują osobno trawą, opadem, chmurami, fauną, cząstkami i diagnostyką.

Obsługiwane preferencje świata:

| Pole stanu | Wartości | Znaczenie |
| --- | --- | --- |
| `motionMode` | `system`, `full`, `gentle`, `still` | zakres ruchu świata bez zmiany zasad gry |
| `stormFlashesEnabled` | boolean | bezpieczne wyłączenie błysków |
| `batterySaver` | boolean | wymuszenie oszczędniejszego profilu |
| `audioMode` | `off`, `cues`, `atmosphere` | cisza, same sygnały albo pełne tło |
| `ambientVolume` | `0..100` | wspólna głośność sensoryczna (`volume` pozostaje krótkim kluczem eventu UI) |

`visibilitychange` wstrzymuje render, pogodę i audio. Powrót wykonuje jedno uzgodnienie stanu, nie nadrabia serii animowanych klatek. Kiedy aktywna minigra zasłania scenę opieki, `IntersectionObserver` może zatrzymać jej pętlę całkowicie; widoczny podgląd ma tylko niski kontrolny FPS.

## Reżyseria Uwagi

Priorytet sceny to: input i opieka, pilna potrzeba, pogoda/zjawisko, niebo, fauna, idle. Fauna ma deterministyczne okno 25–45 sekund i jest tłumiona przez świeże wejście, aktywność, opad, mgłę, recovery, game over lub pilne staty. Ogranicza to habituację i sprawia, że rzadkie momenty są zauważalne.

Tropy dziennika są progresywne, ale bez spoilerów. System zapisuje maksymalnie jeden nowy trop na dzień globalnie; poranny ślad ma pierwszeństwo, później wybierany jest najsilniejszy near-miss. Poziom tropu jest trwały i nie cofa się po migracji.

## Minigry

Wspólne kontrakty wejścia, kary, combo, timeoutu, pauzy karty i dostępności pozostają deterministyczne. Warstwa prezentacji została rozdzielona:

- `Spore Pop` ma ciemną grzybniową grotę, jasne cele i narożne telegraphy bez statycznych plusów;
- `Compost Sort` ma wyraźne pasy głębi oraz strefy podpisane `ODRZUĆ` i `KOMPOST`, oprócz koloru i symbolu;
- `Rhythm Hum` zachowuje osobne kolory, strzałki, pasma timingowe i semantyczne komunikaty;
- `Dew Catch` zachowuje podgląd lądowania, wielowarstwową trawę i wyraźne typy obiektów;
- gry legendarne wyrównują przewodnik do prawej krawędzi canvasu i centrują etykiety celów, dzięki czemu tekst nie wypada przy zmianie rozmiaru.

## Grafika I Pliki

Nowy horyzont, pogoda i tła minigier są kodem pixel-art canvas, bo potrzebują reakcji na stan, wiatr, porę dnia i ustawienia wydajności. Nie są bitmapami bohatera. Główne stany i aktywności Pieczarki nadal należą do PNG zgodnie ze `SPRITE_BIBLE.md`.

Frame-quality gate zachowuje historyczny baseline 202 duplikowanych slotów / 69 findings, blokuje jego wzrost i wymaga strict-clean od każdego zmienionego PNG. Pełny capture pozostaje obowiązkowy, bo statyczny audyt nie ocenia rytmu i kompozycji.

## Kryteria Wydania

- `npm run qa` kończy się terminalnym sukcesem;
- browser smoke oraz viewport contracts są zielone;
- capture potwierdza scenę clear/night/storm/snow/fog, aktywną minigrę desktop/mobile i ustawienia ruchu;
- wersja widoczna, `package.json` i Cloudflare build są zgodne;
- wypchnięty SHA jest dokładnie SHA sprawdzonego commita;
- GitHub Actions dla tego SHA kończy się terminalnie na zielono.
