# Sprite Bible Pieczargotchi

Data: 2026-05-09

Ten dokument opisuje praktyczne zasady przygotowywania i utrzymywania sprite'ów dla aktualnej paczki assetów Pieczargotchi. Punktem odniesienia są:

- `docs/ASSET_ANIMATION_IMPLEMENTATION_PLAN.md`
- bieżąca struktura `assets/stages/`
- bieżąca struktura `assets/activities/`

To nie jest wishlist. To jest instrukcja robocza dla obecnych i kolejnych sheetów runtime.

## 1. Aktualny zakres assetów

### Etapy wzrostu

Aktualnie repo zawiera 5 etapów wzrostu:

- `spore`
- `baby`
- `young`
- `adult`
- `legendary`

Każdy etap ma komplet 16 sheetów stanów:

- `idle_sheet.png`
- `sleep_sheet.png`
- `wake_sheet.png`
- `happy_sheet.png`
- `excellent_sheet.png`
- `curious_sheet.png`
- `sun_sheet.png`
- `rain_sheet.png`
- `stargaze_sheet.png`
- `snow_sheet.png`
- `tired_sheet.png`
- `dry_sheet.png`
- `hungry_sheet.png`
- `dirty_sheet.png`
- `sick_sheet.png`
- `critical_sheet.png`

### Aktywności

Aktualnie repo zawiera 8 sheetów aktywności:

- `hydrate_sheet.png`
- `feed_sheet.png`
- `clean_sheet.png`
- `play_sheet.png`
- `instrument_sheet.png`
- `sing_sheet.png`
- `spores_sheet.png`
- `harvest_sheet.png`

W runtime manifest używa wariantów `assets/activities/<stage>/...`; root-level `assets/activities/*.png` zostają tylko fallbackami kompatybilności i są raportowane przez walidator jako pliki poza manifestem.

### Efekty pomocnicze

Aktualnie repo zawiera 5 sheetów efektów pomocniczych ładowanych przez runtime:

- `drops_sheet.png`
- `sparkle_sheet.png`
- `dust_sheet.png`
- `notes_sheet.png`
- `spore_cloud_sheet.png`

Efekty są walidowane razem z sheetami i ładowane przez runtime manifest jako warstwy `effect.*`.

## 2. Format techniczny

Te zasady są obowiązkowe dla wszystkich nowych sheetów.

- Każda klatka runtime ma rozmiar `512x512`.
- Każdy sheet jest układany poziomo.
- Większość sheetów w paczce używa `4` klatek, czyli rozmiaru `2048x512`.
- `rain_sheet.png` jest celowym wyjątkiem: używa `16` klatek, czyli rozmiaru `8192x512`, żeby pokazać narastanie kropli, spływanie po kapeluszu, oderwanie i rozbicie o ziemię.
- Format pliku: `PNG RGBA` z przezroczystym tłem.
- Runtime zakłada, że sprite jest już poprawnie wycentrowany. Renderer nie ma korygować pozycji offsetami per klatka.

Wniosek praktyczny: jeśli nowy plik nie ma liczby klatek zgodnej z `AnimationConfig.gs`, to najpierw trzeba wyjaśnić zmianę kontraktu i zaktualizować manifest, a nie liczyć, że klient to "łyknie".

## 3. Styl i paleta

Aktualne assety trzymają spójny kierunek wizualny. Nowe prace powinny go kontynuować.

### Styl bazowy

- Pixel art z miękkim modelowaniem bryły, bez fotorealizmu.
- Silna czytelność sylwetki już z pierwszej klatki.
- Jedna postać na środku kadru, osadzona w gęstej kępie trawy lub mchu.
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

- Środek postaci trzymamy blisko środka pola `512x512`.
- Linia "ziemi" lub dolna masa trawy powinna siedzieć na podobnej wysokości we wszystkich klatkach danego sheetu.
- Największa masa kapelusza nie może w jednej klatce odpływać w lewo lub w prawo względem reszty sekwencji.
- Oczy, usta i twarz mogą się zmieniać, ale rdzeń sylwetki ma pozostać stabilny.

### Jak rozumieć centrowanie

- Dopuszczalny jest ruch animacyjny wewnątrz klatki.
- Niedopuszczalny jest "drift", czyli wrażenie, że cały sprite przesuwa się po canvasie, bo każda klatka została wyeksportowana trochę inaczej.
- Jeśli efekt wymaga ruchu bocznego, najpierw rusza się część ciała lub rekwizyt, a nie cała baza postaci.

## 5. Etapy wzrostu

Każdy etap musi wyglądać jak ta sama Pieczargotchi, tylko w innym wieku i statusie.

Nie skalujemy całej sceny między etapami. Trawa/mech jest wspólną kotwicą wizualną, a różnice wzrostu muszą wynikać z samej sylwetki Pieczarki: zarodnika, małej pieczarki, młodej pieczarki, dorosłej pieczarki i legendarnej pieczarki z pelerynką.

### `spore`

- start gry przy `growth: 0`,
- mały kremowy zalążek pieczarki w mchu: krótki trzonek, mini kapelusz typu button/pin; bez listka, czupryny i jajowatej bryły,
- kapelusz zarodka musi być częścią wygenerowanego sprite'a, bez osobnej nakładki w builderze,
- ten sam pas trawy co w pozostałych etapach,
- prostsza sylwetka i najmniej detalu,
- ekspresja bardziej delikatna niż u starszych etapów.

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
- ta sama baza trawy, bez dodatkowego skalowania całej sceny.

### `legendary`

- dorosła forma z pelerynką superbohatera pieczarkowego,
- dodatkowe drobne błyski lub świetliki,
- nie zmieniamy bohatera w "magiczną kulę efektów",
- priorytetem nadal jest czytelna pieczarka, nie aura.

## 6. Zestaw animacji stage'owych

Aktualny kontrakt stage'owy to 16 sheetów na etap:

| Sheet | Rola |
| --- | --- |
| `idle_sheet.png` | stan bazowy, oddech, mrugnięcie, mikrożycie |
| `sleep_sheet.png` | sen, spowolnienie, zamknięta ekspresja |
| `wake_sheet.png` | wejście z uśpienia do czuwania |
| `happy_sheet.png` | pozytywna reakcja, zadowolenie |
| `excellent_sheet.png` | bardzo dobra opieka, połysk, stan nagrody |
| `curious_sheet.png` | reakcja na obecność kursora, tapnięcie albo szelest przy Pieczarce |
| `sun_sheet.png` | spokojna reakcja na słoneczne okno pogodowe |
| `rain_sheet.png` | zwykła reakcja na deszcz/storm foreground; 16-klatkowy cykl większych kropli spływających po kapeluszu i spadających na ziemię; nie używa wariantu `neutral_rain`, parasolki ani miny `:|` |
| `stargaze_sheet.png` | nocna reakcja na gwiazdy i konstelacje |
| `snow_sheet.png` | reakcja na śnieg i chłód |
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
- `excellent` jest mocniejsze niż `happy`, ale nie może zasłonić twarzy błyskami.
- `curious`, `sun`, `rain`, `stargaze` i `snow` są reakcjami immersyjnymi. Nie zmieniają statystyk, nie zastępują potrzeb i nie mogą maskować `critical`, `sick`, kuracji ani game over.
- `rain` jest normalną reakcją pogodową Pieczargotchi. Deszczowa Iwoniasta Pieczarka z parasolką pozostaje wyłącznie easter eggiem `assets/easter-eggs/<stage>/neutral_rain_sheet.png`.
- `tired`, `dry`, `hungry`, `dirty`, `sick` muszą różnić się od siebie charakterem, nie tylko kolorem.
- `critical` ma być najmocniejszym sygnałem ostrzegawczym, ale wciąż czytelnym w skali całej planszy.

## 7. Zestaw animacji aktywności

Aktywności są stage-specific. Ten sam typ akcji musi mieć osobny sheet dla każdego etapu, żeby akcja na `spore`, `baby` albo `young` nie przeskakiwała wizualnie na dorosłą Pieczarkę.

| Sheet | Znaczenie praktyczne |
| --- | --- |
| `assets/activities/<stage>/hydrate_sheet.png` | reakcja na podlanie lub nawodnienie |
| `assets/activities/<stage>/feed_sheet.png` | reakcja na karmienie |
| `assets/activities/<stage>/clean_sheet.png` | reakcja na czyszczenie |
| `assets/activities/<stage>/play_sheet.png` | zabawa i ruch |
| `assets/activities/<stage>/instrument_sheet.png` | kontakt z instrumentem lub słuchanie |
| `assets/activities/<stage>/sing_sheet.png` | śpiew, wokal, nutki |
| `assets/activities/<stage>/spores_sheet.png` | emisja zarodników |
| `assets/activities/<stage>/harvest_sheet.png` | plon, zbiór lub dojrzałość |

### Zasady dla aktywności

- Aktywność dalej pokazuje tę samą postać i ten sam etap, a nie osobny minigame sprite.
- Rekwizyty i efekty są dodatkiem, nie nowym środkiem ciężkości.
- `hydrate` nie skaluje całego cutoutu razem z wodą. Postać jest składana w rozmiarze etapu, a lekka mgiełka kropli jest nakładana nad nią jako osobna warstwa.
- Jeśli pojawia się obiekt pomocniczy, jego skala nie powinna dominować nad Pieczargotchi.
- Aktywność ma pozostać czytelna także wtedy, gdy użytkownik widzi tylko jedną klatkę lub skrócony fragment sekwencji.

## 8. Efekty pomocnicze

Efekty z `assets/effects/` nie zastępują animacji postaci. To małe warstwy pomocnicze używane przez akcje, minigry i drobne reakcje środowiskowe.

| Sheet | Znaczenie praktyczne |
| --- | --- |
| `drops_sheet.png` | krople wody |
| `sparkle_sheet.png` | połysk, sukces, doskonała opieka |
| `dust_sheet.png` | kurz, sprzątanie, bałagan |
| `notes_sheet.png` | muzyka i śpiew |
| `spore_cloud_sheet.png` | chmurka zarodników |

Efekty mogą mieć większy dryf niż postać, bo są ruchem cząstek. Nadal muszą mieścić się w `512x512` per klatka i nie mogą wymuszać przesuwania głównego sprite'a.

## 9. Imagegen vs canvas

Reguła produkcyjna dla immersji:

- PNG/imagegen: sylwetka Pieczarki, oczy, usta, kapelusz, akcesoria dotykające postaci, parasolka/liść/osłona, duże reakcje mimiczne i stage-specific stany.
- Canvas: opady, wiatr, ruch trawy, gwiazdy, promienie, mokrość, śnieg na ziemi, cursor ripple, szelest i małe cząstki.
- Runtime nie maluje nowej mimiki po głównym PNG. Jeśli reakcja wymaga twarzy, dostaje własny sheet w `assets/stages/<stage>/`.

## 10. Rytm animacji

Plan implementacyjny mówi o manifeście z liczbą klatek, timingiem, pętlą i priorytetem. Dla aktualnej paczki warto trzymać się tych zasad:

- `idle`, `sleep`, `tired`, `dry`, `hungry`, `dirty`, `sick`:
  wolniejszy rytm i mała amplituda ruchu.
- `wake`, `happy`, `clean`, `feed`, `hydrate`, `play`, `sing`, `spores`, `harvest`:
  szybsza czytelna reakcja wejścia, potem powrót do spokoju.
- `critical`:
  najmocniejsza czytelność, ale nie migotanie powodujące chaos.

Jeżeli sheet ma tylko 4 klatki, różnicę rytmu osiągamy timingiem i intensywnością pozy, nie dokładaniem losowych mikro-ruchów.

## 11. Walidacja przed wrzutką

Nowy sheet nie powinien trafiać do runtime bez tej listy kontrolnej.

### Walidacja techniczna

- plik jest w `PNG RGBA`,
- rozmiar całego sheetu zgadza się z manifestem runtime (`frameCount * 512` na `512`),
- liczba klatek zgadza się z `AnimationConfig.gs` i szerokością pliku,
- tło jest przezroczyste,
- nazwa pliku trzyma obowiązujący wzorzec,
- plik trafia do właściwego katalogu: `assets/stages/<stage>/`, `assets/activities/<stage>/` albo `assets/effects/`.

### Walidacja wizualna

- środek masy sprite'a nie pływa między klatkami,
- dolna baza trawy/mchu nie skacze pionowo,
- oczy, usta i dodatki nie zmieniają stylu między klatkami,
- czytelność działa na pełnym sheetcie i na pojedynczej klatce,
- stan można odróżnić bez podpisu tekstowego.

### Walidacja produktowa

- nowy sheet wnosi czytelną różnicę względem istniejących stanów,
- aktywność albo potrzeba jest zrozumiała bez tutoriala,
- etap wzrostu jest rozpoznawalny, ale nadal należy do tej samej rodziny postaci.

## 12. Co robić przy nowych sheetach

### Gdy dodajesz nowy sheet do istniejącego etapu

1. Zacznij od duplikatu najbliższego stylistycznie sheetu z tego samego etapu.
2. Zachowaj ten sam canvas, marginesy i środek masy.
3. Zmień najpierw ekspresję i detal reakcji, dopiero potem dodatki.
4. Sprawdź sekwencję klatka po klatce obok `idle_sheet.png`.
5. Upewnij się, że nowy stan nie wygląda jak przemalowany `happy` albo `sick`.

### Gdy dodajesz nowy sheet aktywności

1. Weź za bazę najbliższą aktywność z `assets/activities/<stage>/`.
2. Najpierw ustal, czy akcja potrzebuje rekwizytu, efektu czy tylko zmiany mimiki.
3. Ogranicz liczbę ruchomych elementów do minimum potrzebnego dla czytelności.
4. Zadbaj, żeby rekwizyt nie wypychał postaci z centrum.
5. Zostaw miejsce na późniejszy manifest: nazwa, liczba klatek, timing, pętla, priorytet, akcja wyzwalająca.

### Gdy dodajesz nowy typ stanu do wszystkich etapów

1. Najpierw doprecyzuj nazwę i semantykę w planie implementacyjnym.
2. Ustal, czy nowy stan jest stage-specific, globalny czy tylko activity-specific.
3. Przygotuj najpierw jedną referencyjną wersję, najlepiej `baby` albo `adult`.
4. Dopiero po zatwierdzeniu kierunku przenieś stan na resztę etapów.
5. Nie wprowadzaj nowego nazewnictwa równolegle do starego bez świadomej zmiany kontraktu.

## 12. Minimalne zasady spójności między sheetami

- Ten sam etap powinien mieć ten sam język oczu, ust, policzków i cienia.
- Trawa/mech nie może być w jednym pliku miękka i malarska, a w drugim ostra i geometryczna.
- Połysk kapelusza musi siedzieć w tej samej rodzinie światła.
- `legendary` może dodać błysk, ale `spore` nie może przez to wyglądać jak inny system assetów.
- Aktywności nie mogą zrywać z bazową perspektywą i skalą sceny.

## 13. Sygnały, że sheet trzeba poprawić

- postać "teleportuje się" między klatkami,
- dolna krawędź zieleni faluje przypadkiem zamiast animacyjnie,
- rekwizyt zasłania twarz,
- stan jest czytelny tylko po kolorze,
- `critical` wygląda tylko jak bardziej czerwony `sick`,
- `wake` i `happy` są nie do odróżnienia,
- etap wzrostu traci podobieństwo do pozostałych etapów.

## 14. Krótka definicja jakości

Dobry sheet Pieczargotchi:

- wygląda jak część tej samej paczki,
- mieści się w rozmiarze opisanym przez manifest runtime,
- jest wycentrowany bez ręcznych offsetów w runtime,
- komunikuje stan albo aktywność bez podpisu,
- nie robi bałaganu większego niż korzyść z animacji.
