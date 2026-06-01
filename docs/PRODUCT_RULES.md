# Zasady Produktu I Balansu

## Priorytety

1. Pieczarka ma komunikować stan przede wszystkim sceną, animacją i krótkimi sygnałami, nie ścianą tekstu.
2. Panel może mieć liczby, ale nie może zastąpić czytelnej reakcji postaci.
3. Nowe mechaniki muszą mieć jasny wpływ na decyzje gracza.
4. Kod reguł powinien być deterministyczny i testowalny.
5. Funkcje rozgrywki nie mogą być zaszywane w rendererze.

## Pogoda

Pogoda nie jest tylko dekoracją. Ma wpływać na rytm opieki, ale łagodnie:

- deszcz zwiększa `hydration`,
- burza zwiększa `hydration`, ale zmniejsza `happiness` i `cleanliness`,
- śnieg lekko zwiększa `hydration`,
- wysoka wilgotność pomaga utrzymać `hydration`,
- silny wiatr wysusza,
- upał wysusza,
- wpływ pogody ma limit godzinowy, żeby aktualny warunek pogodowy nie symulował całej długiej nieobecności.

Pogoda nie powinna jeszcze automatycznie robić błędy opieki. Najpierw ma być miękkim modyfikatorem balansu.

Wizualnie pogoda musi używać tych samych pól, które trafiają do balansu. Zachmurzenie może zasłaniać słońce, księżyc i gwiazdy. Kierunek i siła wiatru wpływają na kąt deszczu, dryf śniegu, porywy, mgłę, chmury i trawę; chwilowe porywy mogą rosnąć i cichnąć, ale średnia siła ma pozostać zgodna z aktualną pogodą. Trawa sceny ma wygenerowany asset bazowy oraz pojedyncze wyższe źdźbła reagujące na wiatr.

Rzadkie easter eggi mogą zmieniać komunikat i neutralny sprite, ale nie mogą przykrywać pilnych potrzeb, aktywności ani snu. Wariant Iwoniastej Pieczarki podczas deszczu lub burzy używa osobnego wyrenderowanego sprite sheeta z fioletową parasolką.

## Attention I błędy opieki

Attention call jest ważniejszy niż sam niski pasek:

- niski stat uruchamia attention call,
- zignorowana potrzeba zapisuje care mistake,
- błędy opieki powinny wpływać na ewolucję i długoterminowy charakter Pieczarki,
- naprawiona potrzeba czyści attention i daje krótką reakcję.

## Kryzys Zdrowia, Kuracja I Game Over

Pieczargotchi używa `game over`, ale nie przy pierwszym spadku zdrowia do `0`. Pierwsze `0` uruchamia kurację w mchu jako ostatnią szansę:

- kuracja trwa kilka godzin i nie kończy się natychmiast po kliknięciu,
- Pieczarka leży w mchu jak w łóżku, więc nie walczy, nie bawi się i nie gra w minigry,
- gracz nadal musi zraszać, karmić i czyścić grzybnię,
- koniec kuracji wymaga świeżej opieki oraz stabilnej wilgoci, odżywek i czystości,
- zaniedbana kuracja przedłuża się i obniża jakość podłoża,
- po limicie nieudanych okien kuracji stan przechodzi w `gameOver.active`, blokuje akcje i wymaga rozpoczęcia nowej gry.

## Rytm Dnia I Nocy

Balans opieki jest ustawiony pod normalny dzień użytkownika, a nie pod budzik w środku nocy. Research bazowy: oficjalne instrukcje Tamagotchi Connection pokazują klasyczny rytm karmienia, zabawy i leczenia, a społeczność często łagodzi trudność przez sitterów, rodziców albo zmianę zegara, gdy urządzenie koliduje z pracą i snem.

Docelowy rytm `normal`:

- 2-3 krótkie wejścia dziennie utrzymują zdrową Pieczarkę i dobry podłoże,
- 1 wejście dziennie jest przeżywalne, ale daje słabszy podłoże i większe ryzyko błędy opieki,
- noc `22:30-07:00` oraz poranna karencja do `07:45` nie zapisują nowych błędy opieki,
- nocny sen ma osobny łagodny decay, a Pieczarka zostawiona w trybie awake nocą przechodzi w miękkie auto-drzemanie,
- wzrost ma dzienny limit, żeby spam kliknięć nie skracał drogi do legendy.

## Wzrost I Ewolucja

Wzrost nie powinien być tylko zegarem. Docelowo powinien brać pod uwagę:

- błędy opieki według kategorii,
- regułarność snu,
- czystość i jakość podłoża,
- ulubione i zaniedbane akcje,
- stabilność wilgoci,
- muzykę/zabawę jako styl opieki.

## Lokalna Arena

Arena jest osobnym systemem dla Legendarnej Pieczarki, nie rozszerzeniem pasków opieki:

- odblokowanie następuje dopiero przy `state.stage === 'legendary'`,
- dane walki żyją w `state.battle`, nie w `state.stats`,
- care stats mogą wejść do walki tylko jako snapshot modifier na starcie,
- trening i ruchy walki są konfiguracją reguł, nie akcjami opieki,
- reducer walki ma być deterministyczny i oparty o zapisany seed RNG.

## Minigry

Minigry mają działać jako opcjonalne krótkie rytuały kompetencji, a nie
obowiązkowa praca domowa:

- domyślny profil trudności to `cozy mastery`: wejście i średni wynik są łatwe,
  perfekcja wymaga nauki;
- słaby wynik nie obniża care stats i nie psuje dnia;
- każda minigra musi mieć własną decyzję gracza, a nie tylko reskin
  kliknięcia świecącego celu;
- timing, strefy dropu, dobry/zły wybór i następny cel muszą być widoczne na
  canvasie zanim gracz zostanie oceniony;
- replay value ma pochodzić z rekordów, mastery, pamiątek, albumu i dziennych
  rekomendacji bez kar za pominięcie.

## Legendarne Gry

Po osiągnięciu etapu `legendary` gra może mieć dodatkowe aktywności, ale ich
cel jest retencyjny i kosmetyczno-narracyjny, nie opiekuńczo-karny:

- gry legendarne są opcjonalne i nie mają kar za przerwy,
- nie mogą tworzyć nocnych deadline'ów ani obowiązkowych streaków,
- podczas kuracji i po `gameOver.active` są zablokowane tak jak minigry i Arena,
- postęp projektów legendarnych ma dzienny cap, żeby nie zachęcać do grindu,
- wyniki mogą budować album, pamiątki, sezon i projekty, ale nie powinny pompować
  podstawowych statystyk opieki,
- logika celu, wyniku, nagród i limitów mieszka w core/config; renderer canvas
  tylko rysuje symbole, feedback i interakcję.

## Zasady Implementacyjne

- Najpierw kontrakt i test, potem efekt wizualny.
- Każdy nowy system dostaje docelowy partial lub core helper.
- Zmiany w balansie mają trafiać do `GameRules.gs` albo `ClientCore.html`, nie bezpośrednio w pętlę renderującą.
- Renderer może czytać stan, ale nie powinien mutować zasad rozgrywki.
- Debug menu może wymuszać wartości, ale tryb `auto` musi zachowywać realne dane.
