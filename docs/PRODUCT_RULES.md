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

Pogoda nie powinna jeszcze automatycznie robić care mistakes. Najpierw ma być miękkim modyfikatorem balansu.

Wizualnie pogoda musi używać tych samych pól, które trafiają do balansu. Zachmurzenie może zasłaniać słońce, księżyc i gwiazdy. Kierunek i siła wiatru wpływają na kąt deszczu, dryf śniegu, porywy, mgłę, chmury i trawę; chwilowe porywy mogą rosnąć i cichnąć, ale średnia siła ma pozostać zgodna z aktualną pogodą.

Rzadkie easter eggi mogą zmieniać komunikat i neutralny sprite, ale nie mogą przykrywać pilnych potrzeb, aktywności ani snu.

## Attention I Care Mistakes

Attention call jest ważniejszy niż sam niski pasek:

- niski stat uruchamia attention call,
- zignorowana potrzeba zapisuje care mistake,
- care mistakes powinny wpływać na ewolucję i długoterminowy charakter Pieczarki,
- naprawiona potrzeba czyści attention i daje krótką reakcję.

## Wzrost I Ewolucja

Wzrost nie powinien być tylko zegarem. Docelowo powinien brać pod uwagę:

- care mistakes według kategorii,
- regularność snu,
- czystość i jakość podłoża,
- ulubione i zaniedbane akcje,
- stabilność wilgoci,
- muzykę/zabawę jako styl opieki.

## Zasady Implementacyjne

- Najpierw kontrakt i test, potem efekt wizualny.
- Każdy nowy system dostaje docelowy partial lub core helper.
- Zmiany w balansie mają trafiać do `GameRules.gs` albo `ClientCore.html`, nie bezpośrednio w pętlę renderującą.
- Renderer może czytać stan, ale nie powinien mutować zasad rozgrywki.
- Debug menu może wymuszać wartości, ale tryb `auto` musi zachowywać realne dane.
