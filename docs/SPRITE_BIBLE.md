# Sprite Bible Pieczargotchi

Data: 2026-07-15

Ten dokument opisuje praktyczne zasady przygotowywania i utrzymywania sprite'ów dla aktualnej paczki zasobów Pieczargotchi. Punktem odniesienia są:

- `docs/ASSET_ANIMATION_IMPLEMENTATION_PLAN.md`
- bieżąca struktura `assets/stages/`
- bieżąca struktura `assets/activities/`

To nie jest wishlist. To jest instrukcja robocza dla obecnych i kolejnych arkuszy animacji runtime. Aktualny kontrakt rozdziela logiczną klatkę 512x512 od fizycznego, ciasno przyciętego PNG.

## 1. Aktualny zakres zasobów

### Etapy wzrostu

Aktualnie repo zawiera 5 etapów wzrostu:

- `spore`
- `baby`
- `young`
- `adult`
- `legendary`

Każdy etap ma komplet 34 arkuszy animacji stanów:

- `idle_sheet.png`
- `sleep_sheet.png`
- `wake_sheet.png`
- `happy_sheet.png`
- `excellent_sheet.png`
- `curious_sheet.png`
- `idle_fidget_sheet.png`
- `idle_fidget_sway_sheet.png`
- `idle_fidget_shift_sheet.png`
- `idle_look_left_sheet.png`
- `idle_look_right_sheet.png`
- `ponder_sheet.png`
- `ponder_up_sheet.png`
- `ponder_side_sheet.png`
- `ponder_breath_sheet.png`
- `watch_cursor_left_sheet.png`
- `watch_cursor_right_sheet.png`
- `watch_cursor_up_left_sheet.png`
- `watch_cursor_up_right_sheet.png`
- `follow_cursor_fast_sheet.png`
- `follow_cursor_after_sheet.png`
- `sun_sheet.png`
- `rain_sheet.png`
- `stargaze_sheet.png`
- `snow_sheet.png`
- `watch_butterfly_sheet.png`
- `watch_firefly_sheet.png`
- `watch_crawler_sheet.png`
- `tired_sheet.png`
- `dry_sheet.png`
- `hungry_sheet.png`
- `dirty_sheet.png`
- `sick_sheet.png`
- `critical_sheet.png`

### Aktywności

Aktualnie repo zawiera 8 arkuszy animacji aktywności:

- `hydrate_sheet.png`
- `feed_sheet.png`
- `clean_sheet.png`
- `play_sheet.png`
- `instrument_sheet.png`
- `sing_sheet.png`
- `spores_sheet.png`
- `harvest_sheet.png`

Manifest uruchomieniowy używa wyłącznie wariantów `assets/activities/<stage>/...`. Dawne kopie głównego poziomu `assets/activities/*.png` oraz udawane warianty `instrument_*_sheet.png` nie należą do paczki runtime.

Polish 0.1.50 utrzymuje pełny cel ruchu `8/8` dla aktywności. W szczególności `spore/feed_sheet.png` i `spore/instrument_sheet.png` mają osiem widocznie różnych klatek, a nie powieloną pozę rozciągniętą przez timing. Ten sam release odświeża siedem rodzin fidget/cursor (`idle_fidget`, `idle_fidget_sway`, `idle_fidget_shift`, `watch_cursor_left`, `watch_cursor_right`, `watch_cursor_up_left`, `watch_cursor_up_right`) dla wszystkich pięciu etapów, czyli 35 sheetów i 280 logicznych klatek.

### Efekty pomocnicze

Aktualnie repo zawiera 5 arkuszy animacji efektów pomocniczych ładowanych przez czas działania:

- `drops_sheet.png`
- `sparkle_sheet.png`
- `dust_sheet.png`
- `notes_sheet.png`
- `spore_cloud_sheet.png`

Efekty są walidowane razem z arkuszami animacji i ładowane przez manifest uruchomieniowy jako warstwy `effect.*`.

### Arena

Arena ma osobną, body-only paczkę, niezależną od stage sheetów sceny opieki:

- `assets/battle/arena_background.png` - wspólna plansza `512x512`;
- `assets/battle/player_legendary_sheet.png` - gracz `playerLegendary`;
- `assets/battle/opponents/sproutling_sheet.png` - `visualId: sproutling`;
- `assets/battle/opponents/windcap_sheet.png` - `visualId: windcap`;
- `assets/battle/opponents/eldercap_sheet.png` - `visualId: eldercap`.

Każdy arkusz postaci areny ma cztery fizyczne klatki `256x256` w kolejności `idle`, `attack`, `guard`, `hurt`, czyli cały PNG ma `1024x256`. Nie wolno podstawiać stage sheetu z trawą ani zmieniać `visualId` bez migracji istniejącego aktywnego zapisu walki.

## 2. Format techniczny

Te zasady są obowiązkowe dla wszystkich nowych arkuszy animacji.

- Logiczna klatka sceny ma układ współrzędnych `512x512`, ale fizyczny PNG przechowuje tylko wspólny alpha-union potrzebny dla danego sheetu.
- `SpriteLayout.gs` jest generowanym źródłem prawdy dla `frameWidth`, `frameHeight`, `drawX`, `drawY`, `pivotX`, `pivotY`, `storedFrameCount`, `frameSequence` i `bakedGrass`.
- `frameCount` pozostaje liczbą klatek logicznych. `storedFrameCount` może być mniejszy, gdy identyczne klatki są deduplikowane, a `frameSequence` mapuje każdą klatkę logiczną na właściwą klatkę fizyczną.
- Renderer odtwarza tight crop w oryginalnym miejscu przez `drawX`/`drawY`; nie skaluje go do pełnych `512x512` i nie centruje ponownie.
- Większość sekwencji ma logiczne `4` klatki; aktywności i krótkie reakcje używają `8`, warianty `ponder` oraz część ambientu `10`, `watch_firefly` `12`, a `rain` `16`.
- Format pliku to `PNG RGBA`; każdy piksel z `alpha=0` musi mieć także `RGB=0`, a magentowy matte nie może zostać na krawędziach.
- Stage, activity, easter-egg i effect sheety są body-only (`bakedGrass: false`). Trawa nie może wrócić do ich fizycznych klatek.
- Arena jest świadomym wyjątkiem rozmiarowym: cztery klatki `256x256`, bez `SpriteLayout.gs`, z kontraktem opisanym wyżej.

Wniosek praktyczny: liczba klatek logicznych musi zgadzać się z `AnimationConfig.gs`, a fizyczny rozmiar PNG z wygenerowanym `SpriteLayout.gs`. Po przebudowie pełnych 512x512 sheetów zawsze uruchamiamy optimizer; nie poprawiamy metadata ręcznie.

## 3. Styl i paleta

Aktualne zasoby trzymają spójny kierunek wizualny. Nowe prace powinny go kontynuować.

### Styl bazowy

- Pixel art z miękkim modelowaniem bryły, bez fotorealizmu.
- Silna czytelność sylwetki już z pierwszej klatki.
- Jedna postać w stabilnym logicznym kadrze; wspólna trawa sceny osadza ją w podłożu dopiero podczas renderowania.
- Mimika jest prosta: oczy, usta, policzki i kąt kapelusza robią większość ekspresji.
- Ruch jest mały i kontrolowany. Idle ma wyglądać jak oddech, mrugnięcie albo lekki puls, a nie jak ciągłe skakanie.
- Efekt "legendary" ma być subtelny: drobne błyski i bogatsza forma, bez odchodzenia od tego samego bohatera.

### Paleta bazowa

Nie kopiujemy kolorów mechanicznie pipetą z jednego pliku, ale trzymamy te same rodziny barw:

- kapelusz: ciepłe kremy, jasne beże, delikatne złamane żółcie,
- blaszki i cień pod kapeluszem: średnie i ciemne brązy,
- twarz/trzon: jasny beż lub łagodny brzoskwiniowy odcień,
- policzki: oszczędny róż lub łososiowy akcent,
- trawa/mech: żywe, ale naturalne zielenie z ciemniejszą podstawą,
- kwiatki i połysk: małe, jasne akcenty o niskim ciężarze wizualnym.

### Czego unikać

- zimnych sinych szarości jako dominującego cienia,
- neonowych zieleni i przesyconych żółci,
- grubych, czarnych obrysów wokół całej postaci,
- dużych efektów specjalnych zasłaniających sylwetkę,
- zmiany stylu między etapami tak dużej, że wygląda to jak inna gra.

## 4. Sylwetka i centrowanie

Najważniejsza zasada produkcyjna: postać ma być stabilna między klatkami.

### Kotwice wizualne

- Środek postaci trzymamy blisko środka logicznego pola `512x512`; tight crop nie zmienia tej współrzędnej.
- Dolna kotwica ciała powinna siedzieć na podobnej wysokości we wszystkich klatkach danego sheetu. Nie używamy masy trawy jako części sprite'a.
- Największa masa kapelusza nie może w jednej klatce odpływać w lewo lub w prawo względem reszty sekwencji.
- Oczy, usta i twarz mogą się zmieniać, ale rdzeń sylwetki ma pozostać stabilny.

### Jak rozumieć centrowanie

- Dopuszczalny jest ruch animacyjny wewnątrz klatki.
- Niedopuszczalny jest "drift", czyli wrażenie, że cały sprite przesuwa się po canvasie, bo każda klatka została wyeksportowana trochę inaczej.
- Jeśli efekt wymaga ruchu bocznego, najpierw rusza się część ciała lub rekwizyt, a nie cała baza postaci.

## 5. Etapy wzrostu

Każdy etap musi wyglądać jak ta sama Pieczargotchi, tylko w innym wieku i statusie.

Nie skalujemy całej sceny między etapami. Trawa/mech jest wspólną warstwą sceny i kotwicą wizualną, a różnice wzrostu muszą wynikać z samej sylwetki Pieczarki: zarodnika, małej pieczarki, młodej pieczarki, dorosłej pieczarki i legendarnej pieczarki z pelerynką.

### `spore`

- start gry przy `growth: 0`,
- mały kremowy zalążek pieczarki w mchu: krótki trzonek, mini kapelusz typu button/pin; bez listka, czupryny i jajowatej bryły,
- kapelusz zarodka musi być częścią wygenerowanego sprite'a, bez osobnej nakładki w builderze,
- ta sama stage-aware polana i warstwa trawy sceny co w pozostałych etapach,
- prostsza sylwetka i najmniej detalu,
- ekspresja bardziej delikatna niż u starszych etapów.
- aktywności zarodnika mają być spokojniejsze niż u starszych etapów: mikrodrift, brak szybkiego naprzemiennego skakania lewo/prawo i brak długich jasnych poziomych pasów w rekwizytach.

### `baby`

- start od `growth: 12`,
- mała pieczarka, wyraźnie mniejsza od dorosłej,
- proporcje najbardziej "maskotkowe",
- miękki, czytelny kapelusz i prosta mimika,
- zakres ruchu mały, ale wyraźny.

### `young`

- większa sylwetka i pewniejsza postawa,
- więcej przestrzeni na aktywność,
- dalej ten sam język kształtów i ta sama twarz.

### `adult`

- pełniejszy kapelusz,
- punkt odniesienia: `assets/awake.png`,
- stabilna, spokojna obecność,
- lepsza czytelność reakcji i stanów,
- ta sama wspólna warstwa trawy, bez dodatkowego skalowania całej sceny.

### `legendary`

- dorosła forma z pelerynką superbohatera pieczarkowego,
- dodatkowe drobne błyski lub świetliki,
- nie zmieniamy bohatera w "magiczną kulę efektów",
- priorytetem nadal jest czytelna pieczarka, nie aura.

## 6. Zestaw animacji stage'owych

Aktualny kontrakt stage'owy to 34 arkusze animacji na etap:

| arkusz animacji | Rola |
| --- | --- |
| `idle_sheet.png` | stan bazowy, oddech, mrugnięcie, mikrożycie |
| `sleep_sheet.png` | sen, spowolnienie, zamknięta ekspresja |
| `wake_sheet.png` | wejście z uśpienia do czuwania |
| `happy_sheet.png` | pozytywna reakcja, zadowolenie |
| `excellent_sheet.png` | bardzo dobra opieka, połysk, stan nagrody |
| `curious_sheet.png` | reakcja na obecność kursora, tapnięcie albo szelest przy Pieczarce |
| `idle_fidget_sheet.png` | bezczynne wiercenie się, krótka zmiana postawy i powrót do spokoju |
| `idle_fidget_sway_sheet.png` | spokojny boczny kołys i mikrooddech, wariant bezczynności |
| `idle_fidget_shift_sheet.png` | krótka zmiana ciężaru ciała i powrót do bazowej pozy |
| `idle_look_left_sheet.png` | leniwe rozejrzenie się w lewo bez bodźca z kursora |
| `idle_look_right_sheet.png` | leniwe rozejrzenie się w prawo bez bodźca z kursora |
| `ponder_sheet.png` | ciche zastanowienie się w spokojnej scenie |
| `ponder_up_sheet.png` | zamyślenie z lekkim spójrzeniem ku górze |
| `ponder_side_sheet.png` | zamyślenie z bocznym spójrzeniem i spokojnym powrotem |
| `ponder_breath_sheet.png` | wolniejszy wariant ponder oparty o oddech i minimalny ruch |
| `watch_cursor_left_sheet.png` | Pieczarka śledzi kursor po lewej stronie twarzy |
| `watch_cursor_right_sheet.png` | Pieczarka śledzi kursor po prawej stronie twarzy |
| `watch_cursor_up_left_sheet.png` | Pieczarka patrzy za kursorem nad lewą częścią kapelusza |
| `watch_cursor_up_right_sheet.png` | Pieczarka patrzy za kursorem nad prawą częścią kapelusza |
| `follow_cursor_fast_sheet.png` | szybka reakcja na przelot kursora blisko postaci |
| `follow_cursor_after_sheet.png` | krótkie dopatrzenie za kursorem po wyjściu z okolicy postaci |
| `sun_sheet.png` | spokojna reakcja na słoneczne okno pogodowe |
| `rain_sheet.png` | zwykła reakcja na deszcz/storm foreground; 16-klatkowy cykl większych kropli spływających po kapeluszu i spadających na ziemię; nie używa wariantu `neutral_rain`, parasolki ani miny `:|` |
| `stargaze_sheet.png` | nocna reakcja na gwiazdy i konstelacje |
| `snow_sheet.png` | reakcja na śnieg i chłód |
| `watch_butterfly_sheet.png` | Pieczarka śledzi motyla albo drobny ruch przy kapeluszu |
| `watch_firefly_sheet.png` | nocna reakcja na świetliki bez doklejania obcych efektów do ciała |
| `watch_crawler_sheet.png` | spójrzenie w wysoką trawę na robaczka lub żuka |
| `tired_sheet.png` | senność i opadanie energii |
| `dry_sheet.png` | przesuszenie, spadek świeżości |
| `hungry_sheet.png` | głód, brak zasobów |
| `dirty_sheet.png` | zabrudzenie, kurz, bałagan |
| `sick_sheet.png` | choroba lub osłabienie |
| `critical_sheet.png` | stan alarmowy, wysoki priorytet wizualny |

### Zasady ekspresji stanów

- `idle` ma być najspokojniejszy i najczystszy wizualnie.
- `sleep` oraz `wake` mają czytać się bez tekstu i bez ikon interfejsu.
- `happy` podnosi energię, ale nie rozwala sylwetki.
- `excellent` jest mocniejsze niż `happy`, ale nie może zasłonić twarzy błyskami; połysk ma pochodzić z animowanego PNG, bez statycznych gwiazdek z atlasu i bez canvasowych plusów.
- `curious`, warianty `idle_fidget`, warianty `idle_look`, warianty `ponder`, reakcje kursora, `sun`, `rain`, `stargaze`, `snow`, `watch_butterfly`, `watch_firefly` i `watch_crawler` są reakcjami immersyjnymi. Nie zmieniają statystyk, nie zastępują potrzeb i nie mogą maskować `critical`, `sick`, kuracji ani game over.
- `rain` jest normalną reakcją pogodową Pieczargotchi. Deszczowa Iwoniasta Pieczarka z parasolką pozostaje wyłącznie easter eggiem `assets/easter-eggs/<stage>/neutral_rain_sheet.png`.
- `tired`, `dry`, `hungry`, `dirty`, `sick` muszą różnić się od siebie charakterem, nie tylko kolorem.
- `critical` ma być najmocniejszym sygnałem ostrzegawczym, ale wciąż czytelnym w skali całej planszy.

## 7. Zestaw animacji aktywności

Aktywności są osobne dla etapu. Ten sam typ akcji musi mieć osobny arkusz animacji dla każdego etapu, żeby akcja na `spore`, `baby` albo `young` nie przeskakiwała wizualnie na dorosłą Pieczarkę.

| arkusz animacji | Znaczenie praktyczne |
| --- | --- |
| `assets/activities/<stage>/hydrate_sheet.png` | reakcja na podlanie lub nawodnienie |
| `assets/activities/<stage>/feed_sheet.png` | reakcja na karmienie |
| `assets/activities/<stage>/clean_sheet.png` | reakcja na czyszczenie |
| `assets/activities/<stage>/play_sheet.png` | zabawa i ruch |
| `assets/activities/<stage>/instrument_sheet.png` | kontakt z instrumentem lub słuchanie |
| klucz `instrument_bell` | wybór dzwonków/kalimby; obecnie aliasuje używany arkusz `instrument_sheet.png` |
| klucz `instrument_flute` | wybór fletu/syntezatora; obecnie aliasuje używany arkusz `instrument_sheet.png` |
| klucz `instrument_drum` | wybór bębenków/rytmu; obecnie aliasuje używany arkusz `instrument_sheet.png` |
| klucz `instrument_rare` | rzadkie odkrycie; obecnie aliasuje używany arkusz `instrument_sheet.png` |
| `assets/activities/<stage>/sing_sheet.png` | śpiew, wokal, nutki |
| `assets/activities/<stage>/spores_sheet.png` | emisja zarodników |
| `assets/activities/<stage>/harvest_sheet.png` | plon, zbiór lub dojrzałość |

### Zasady dla aktywności

Warianty instrumentów mają odrębne klucze gameplay/logów, ale nie udają odrębnej grafiki. Dopóki nie powstanie prawdziwy, ręcznie zweryfikowany art, manifest kieruje wszystkie cztery klucze na etapowy `instrument_sheet.png`; osobnych `instrument_*_sheet.png` nie przechowujemy w paczce aplikacji.

- Aktywność dalej pokazuje tę samą postać i ten sam etap, a nie osobny minigame sprite.
- Aktywność jest sprite-first: podstawowy gest, mimika i rekwizyt należą do `8` klatek logicznych dla danego etapu, zamiast do canvasowego retuszu postaci. Tight/dedup PNG może fizycznie przechowywać mniej klatek.
- Rekwizyty i efekty są dodatkiem, nie nowym środkiem ciężkości.
- `hydrate` nie skaluje całego cutoutu razem z wodą. Postać jest składana w rozmiarze etapu, a lekka mgiełka kropli jest nakładana nad nią jako osobna warstwa.
- `clean` nie ma bake'ować trwałej brudnej warstwy na postaci. Niska `cleanliness` pozostaje wyborem renderera jako dirt cue / stan `dirty`, a aktywność `clean` pokazuje czyszczenie i połysk.
- `spores` dla śpiącego lub małego zarodka nie może mieszać się z animacją snu; sen `spore` walidujemy osobno jako ciało PNG, a chmurki zarodników i `zZz` są osobnymi efektami/warstwami czas działania.
- `spore` używa wolniejszego one-shot timingu z holdem ostatniej klatki, żeby mała sylwetka nie wyglądała nerwowo przy krótkich pętlach.
- Jeśli pojawia się obiekt pomocniczy, jego skala nie powinna dominować nad Pieczargotchi.
- Aktywność ma pozostać czytelna także wtedy, gdy użytkownik widzi tylko jedną klatkę lub skrócony fragment sekwencji.

## 8. Efekty pomocnicze

Efekty z `assets/effects/` nie zastępują animacji postaci. To małe warstwy pomocnicze używane przez akcje, minigry i drobne reakcje środowiskowe.

| arkusz animacji | Znaczenie praktyczne |
| --- | --- |
| `drops_sheet.png` | krople wody |
| `sparkle_sheet.png` | połysk, sukces, doskonała opieka |
| `dust_sheet.png` | kurz, sprzątanie, bałagan |
| `notes_sheet.png` | muzyka i śpiew |
| `spore_cloud_sheet.png` | chmurka zarodników |

Efekty mogą mieć większy dryf niż postać, bo są ruchem cząstek. Nadal muszą mieścić się w `512x512` per klatka i nie mogą wymuszać przesuwania głównego sprite'a.

## 9. generator obrazów vs canvas

Reguła produkcyjna dla immersji:

- PNG/generator obrazów: body-only sylwetka Pieczarki, oczy, usta, kapelusz, akcesoria dotykające postaci, parasolka/liść/osłona, duże reakcje mimiczne i osobne dla etapu stany.
- Canvas: opady, wiatr, ruch trawy, gwiazdy, promienie, mokrość, śnieg na ziemi, cursor ripple, szelest, motyle, świetliki, żuki i małe cząstki.
- czas działania nie maluje nowej mimiki po głównym PNG. Jeśli reakcja wymaga twarzy, dostaje własny arkusz animacji w `assets/stages/<stage>/`.
- `feed`, `instrument` i `sing` są sprite-owned: renderer nie może dorysowywać im dodatkowych ust, instrumentów ani muzycznych rekwizytów na canvasie.
- `assets/environment/grass_patch.png` oraz lekka trawa proceduralna są jedynym wspólnym systemem zieleni sceny. Stage-aware clearing utrzymuje twarz i korpus czytelne; dekoracje są osadzane przed lekkim foreground occluderem, żeby nie wyglądały jak naklejone ani nie ginęły w zaroślach.
- `assets/journal/polaroid_props_atlas.png` jest osobnym atlasem nieruchomych rekwizytów zdjęć. Nie zastępuje sprite-owned rekwizytów aktywności na głównej scenie i jest rysowany wyłącznie wewnątrz odbitki dziennika.
- Dynamiczny cień głównej Pieczarki jest pikselową warstwą gruntu, nie częścią PNG. Kolejność pozostaje: grunt i powierzchnia, cień, body-only sprite, dekoracje oraz trawa foreground. Cień nie może używać blur ani podążać za oddechowym bobbingiem sprite'a.

## 10. Rytm animacji

Plan implementacyjny mówi o manifeście z liczbą klatek, timingiem, pętlą i priorytetem. Dla aktualnej paczki warto trzymać się tych zasad:

- `idle`, `sleep`, `tired`, `dry`, `hungry`, `dirty`, `sick`:
  wolniejszy rytm i mała amplituda ruchu.
- `wake`, `happy`, `clean`, `feed`, `hydrate`, `play`, `sing`, `spores`, `harvest`:
  szybsza czytelna reakcja wejścia, potem powrót do spokoju. Aktywności mają `8` klatek logicznych, więc timing powinien wykorzystać dodatkowe pozy na gest i wyciszenie, nie na przypadkowy drift; deduplikacja fizyczna nie zmienia timingu.
- `critical`:
  najmocniejsza czytelność, ale nie migotanie powodujące chaos.
- warianty `idle_fidget`, warianty `ponder`, reakcje kursora, `watch_butterfly`, `watch_firefly`, `watch_crawler`:
  dłuższy oddech sceny i małe przesunięcia ciała, bez skakania po baseline albo zmiany bohatera w inny wariant graficzny.
- reakcje kursora:
  kierunek oczu i przechył muszą zgadzać się z nazwą sheetu; nie wolno zastępować ruchu luźnymi pikselami, plusami ani sztucznym śladem obok sylwetki.

Jeżeli arkusz animacji ma tylko 4 klatki, różnicę rytmu osiągamy timingiem i intensywnością pozy, nie dokładaniem losowych mikro-ruchów.

## 11. Walidacja przed wrzutką

Nowy arkusz animacji nie powinien trafiać do czas działania bez tej listy kontrolnej.

### Walidacja techniczna

- plik jest w `PNG RGBA`,
- fizyczny rozmiar sheetu zgadza się z `frameWidth * storedFrameCount` na `frameHeight` w manifeście i `SpriteLayout.gs`,
- `frameCount` zgadza się z `AnimationConfig.gs`, a `frameSequence` pokrywa każdą klatkę logiczną poprawnym indeksem fizycznym,
- dopracowane aktywności osobne dla etapu mają `8` klatek logicznych i osobny plik dla każdego etapu,
- tło jest przezroczyste,
- piksele `alpha=0` mają wyzerowane kanały RGB, a krawędź nie ma chroma spill,
- `bakedGrass` pozostaje `false` dla stage, activity, easter-egg i effect sheetów,
- nazwa pliku trzyma obowiązujący wzorzec,
- plik trafia do właściwego katalogu: `assets/stages/<stage>/`, `assets/activities/<stage>/` albo `assets/effects/`.

### Walidacja wizualna

- środek masy sprite'a nie pływa między klatkami,
- dolna kotwica ciała nie skacze pionowo, a wspólna trawa sceny nie jest zapisana w sprite'cie,
- oczy, usta i dodatki nie zmieniają stylu między klatkami,
- czytelność działa na pełnym sheetcie i na pojedynczej klatce,
- stan można odróżnić bez podpisu tekstowego.
- `spore/sleep_sheet.png` nie zawiera wklejonych `zZz` ani chmury zarodników; ciało śpiącego zarodka, glyphy snu i efekt zarodników pozostają trzema oddzielnymi rzeczami.
- Brud wynikający z niskiej `cleanliness` jest czytelny jako wybór renderera albo stan `dirty`, bez niszczenia bazowej czystości arkuszy animacji aktywności.

### Walidacja produktowa

- nowy arkusz animacji wnosi czytelną różnicę względem istniejących stanów,
- aktywność albo potrzeba jest zrozumiała bez tutoriala,
- etap wzrostu jest rozpoznawalny, ale nadal należy do tej samej rodziny postaci.

### Minimalny gate techniczny

```sh
python3 scripts/optimize-runtime-sprite-atlases.py --check
python3 scripts/generate-battle-assets.py --check
node scripts/test-animation-render-contracts.mjs
node scripts/test-battle-visual-contracts.mjs
node scripts/test-grass-wind-motion.mjs
node scripts/validate-assets.mjs
python3 scripts/audit-sprite-frame-quality.py --regression-gate
python3 scripts/audit-sprite-chroma.py --strict
python3 scripts/audit-activity-sprite-motion.py
python3 scripts/audit-glint-sprites.py
```

`audit-sprite-frame-quality.py` nadal pokazuje historyczne advisory findings, ale `--regression-gate` chroni bieżący baseline: 202 duplikowane sloty i 69 findings nie mogą wzrosnąć, a każdy PNG zmieniony w working tree albo bieżącym commicie musi sam przejść reguły strict. Dzięki temu stary dług jest jawny, lecz nowa grafika nie może go powiększać. Błędy generatora, layoutu, manifestu, chroma, alpha albo body-only pozostają blockerami. Przed wydaniem dochodzi pełne `npm run qa` oraz browser capture sceny opieki, pogody, aktywności i areny; sam test Node nie potwierdza kompozycji wizualnej.

## 12. Co robić przy nowych arkuszach animacji

### Gdy dodajesz nowy arkusz animacji do istniejącego etapu

1. Zacznij od źródłowego wycinka lub pełnego 512x512 arkusza najbliższej stylistycznie animacji z tego samego etapu; nie edytuj tight PNG jak zwykłego pełnego sheetu.
2. Zachowaj ten sam logiczny canvas, baseline i środek masy.
3. Zmień najpierw ekspresję i detal reakcji, dopiero potem dodatki.
4. Sprawdź sekwencję klatka po klatce obok `idle_sheet.png`.
5. Upewnij się, że nowy stan nie wygląda jak przemalowany `happy` albo `sick`.
6. Przebuduj cały źródłowy zestaw, uruchom `scripts/optimize-runtime-sprite-atlases.py`, a potem sprawdź wygenerowany wpis w `SpriteLayout.gs`.

### Gdy dodajesz nowy arkusz animacji aktywności

1. Weź za bazę najbliższą aktywność z `assets/activities/<stage>/`.
2. Najpierw ustal, czy akcja potrzebuje rekwizytu, efektu czy tylko zmiany mimiki.
3. Ogranicz liczbę ruchomych elementów do minimum potrzebnego dla czytelności.
4. Zadbaj, żeby rekwizyt nie wypychał postaci z centrum.
5. Zaktualizuj manifest: nazwa, liczba klatek logicznych, timing, pętla, priorytet i akcja wyzwalająca; fizyczny layout wygeneruje optimizer.

### Gdy dodajesz nowy typ stanu do wszystkich etapów

1. Najpierw doprecyzuj nazwę i semantykę w planie implementacyjnym.
2. Ustal, czy nowy stan jest osobne dla etapu, globalny czy tylko activity-specific.
3. Przygotuj najpierw jedną referencyjną wersję, najlepiej `baby` albo `adult`.
4. Dopiero po zatwierdzeniu kierunku przenieś stan na resztę etapów.
5. Nie wprowadzaj nowego nazewnictwa równolegle do starego bez świadomej zmiany kontraktu.

## 13. Minimalne zasady spójności między arkuszami animacji

- Ten sam etap powinien mieć ten sam język oczu, ust, policzków i cienia.
- Sprite'y nie zawierają własnej trawy/mchu; cała paczka korzysta ze wspólnego podłoża i foreground occludera sceny.
- Połysk kapelusza musi siedzieć w tej samej rodzinie światła.
- `legendary` może dodać błysk, ale `spore` nie może przez to wyglądać jak inny system zasobów.
- Aktywności nie mogą zrywać z bazową perspektywą i skalą sceny.

## 14. Sygnały, że arkusz animacji trzeba poprawić

- postać "teleportuje się" między klatkami,
- dolna kotwica ciała faluje przypadkiem albo w PNG wróciła baked grass,
- rekwizyt zasłania twarz,
- stan jest czytelny tylko po kolorze,
- `critical` wygląda tylko jak bardziej czerwony `sick`,
- `wake` i `happy` są nie do odróżnienia,
- etap wzrostu traci podobieństwo do pozostałych etapów.

## 15. Krótka definicja jakości

Dobry arkusz animacji Pieczargotchi:

- wygląda jak część tej samej paczki,
- mieści się w fizycznym rozmiarze opisanym przez manifest i `SpriteLayout.gs`,
- wraca przez `drawX`/`drawY` do poprawnej pozycji na logicznym canvasie,
- nie zawiera własnej warstwy trawy,
- komunikuje stan albo aktywność bez podpisu,
- nie robi bałaganu większego niż korzyść z animacji.
