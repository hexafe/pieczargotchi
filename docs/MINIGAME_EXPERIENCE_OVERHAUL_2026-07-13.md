# Przebudowa doświadczenia minigier — 2026-07-13

Wersja aplikacji: `0.1.53`
Wersja stanu: `20`

## Umowa z graczem

- Siedem minigier korzysta z jednego deterministycznego kontraktu sesji i
  wyniku.
- Rozgrywki z nagrodami zachowują skonfigurowany czas odnowienia. W czasie
  oczekiwania ta sama karta pozwala ćwiczyć bez wpływu na ekonomię, rekordy,
  cele dzienne, projekty, punkty sezonowe, pamiątki i czas odnowienia.
- Ręczne wyjście przerywa rozgrywkę zamiast jej punktowanego zakończenia. Nie
  przyznaje niczego i zachowuje oczekujące ziarno losowania nagród, więc
  anulowanie nie pozwala ponownie losować korzystnej planszy.
- Wynik obejmuje punkty, maksymalny wynik dla ziarna, liczby wejść i
  rozstrzygnięć, pokrycie, celność, poziom wyniku, nagrody, stan rekordu, czas
  odnowienia i odblokowane elementy.
- Zaliczenie wymaga osiągnięcia przystępnego celu oraz odpowiedniego pokrycia.
  Mistrzostwo zależy od znormalizowanego pokrycia, celności i maksymalnego
  wyniku dla ziarna. Wynik doskonały oznacza rozstrzygnięcie całej rozgrywki
  bez błędu; rzadkie cele podnoszą wynik, ale nie warunkują doskonałości.

## Pętle rozgrywki

- Łapanie rosy, Pękanie zarodników, Sortowanie kompostu i Rytmiczne nucenie
  rozliczają każdą wygenerowaną decyzję dokładnie raz, traktują wygasłe cele
  jako chybienia i kończą się po rozstrzygnięciu całej planszy. Wszystkie cele
  mieszczą się w rzeczywistym czasie sesji.
- Pękanie zarodników rozkłada cele na całą aktywną rundę. Rytmiczne nucenie
  dopasowuje grywalną sekwencję do dostępnego czasu i nie pozostawia martwej
  końcówki po ostatniej nucie.
- Szlak Zarodników składa się z ośmiu bezpiecznych lub ryzykownych decyzji,
  których warunki kształtuje pogoda.
- Liga Grzybni obejmuje dwanaście zapowiadanych wymian: obrona kontruje atak,
  skupienie kontruje obronę, a atak kontruje skupienie.
- Ogród Pamiątek ma cztery rundy podglądu, ukrycia i odtworzenia sekwencji o
  długościach `3/4/5/6` na siatce `3x3`.

## Informacja zwrotna, dostępność i bezpieczne przerwania

- Opis przed startem pokazuje czas, sterowanie, oczekiwane nagrody i różnicę
  między rozgrywką z nagrodami a treningiem.
- Trwałe podsumowanie pokazuje miary umiejętności, nagrody, rekordy,
  odblokowane elementy, czas odnowienia i możliwość powtórki treningowej.
- Opcjonalne sygnały dźwiękowe i wibracje dostępne na zgodnych urządzeniach
  uruchamiają się dopiero po geście gracza. Informacja wizualna pozostaje pełna
  po wyłączeniu dźwięku i wibracji.
- Opis semantyczny sceny ogłasza istotne zmiany celu lub fazy zamiast każdej
  klatki animacji. Ograniczenie ruchu usuwa ruch tła bez pogorszenia precyzji
  czasowej, a kolory wymuszone zachowują dodatkowe symbole i kształty.
- Ukrycie strony na maksymalnie 30 sekund wstrzymuje i przesuwa aktywny
  harmonogram. Dłuższe pozostawienie gry w tle bezpiecznie przerywa sesję bez
  nagród i czasu odnowienia.
- Zapisy panelu są buforowane, utrwalanie stanu minigry jest opóźnione i
  łączone, a zakończenie zapisuje ostateczny stan dokładnie raz.

## Trwałość stanu i migracja

- Wersja 19 wprowadziła tryb sesji, miary wyniku i oczekujące ziarna losowania
  nagród. Wersja 20 dodaje ustawienia doznań i dostępności oraz rozdziela
  najlepszy wynik Ligi Grzybni od najlepszej serii zwycięstw.
- Zapisy starsze niż wersja 19 izolują aktywną sesję starej minigry, zamiast
  rozliczać ją według nowych zasad wypłat. Ukończona historia, ekwipunek,
  rekordy, czasy odnowienia, albumy i klucz pamięci
  `pieczargotchi_state_v2` pozostają zachowane.

## Kryteria odbioru

- Kontrola balansu rzeczywistych generatorów działa na deterministycznych
  ziarnach i osiągalnych profilach siedlisk. Każda bezbłędna rozgrywka musi
  osiągać próg zaliczenia, a każda wygenerowana decyzja musi być osiągalna.
- Testy skupione obejmują izolację przerwania i treningu, poprawność okien
  wejścia, ukończenie pełnej rundy, zgodność klawiatury i wskaźnika, fazy gier
  legendarnych, migrację, zastępcze sygnały zmysłowe oraz responsywne sterowanie
  podsumowaniem.
- Kanoniczną bramą wydania pozostaje `npm run qa`, po której następują budowa
  statyczna Cloudflare i deterministyczne zrzuty przeglądarkowe wszystkich
  siedmiu minigier.
