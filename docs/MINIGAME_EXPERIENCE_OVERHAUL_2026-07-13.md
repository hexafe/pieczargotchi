# Przebudowa doświadczenia minigier — 2026-07-13

Wersja aplikacji: `0.1.55`
Wersja stanu: `20`

## Umowa z graczem

- Siedem minigier korzysta z jednego deterministycznego kontraktu sesji i
  wyniku.
- Rozgrywki z nagrodami zachowują skonfigurowany czas odnowienia. W czasie
  oczekiwania ta sama karta pozwala ćwiczyć bez wpływu na ekonomię, rekordy,
  cele dzienne, projekty, punkty sezonowe, pamiątki i czas odnowienia.
- Ręczne wyjście przerywa rozgrywkę zamiast jej punktowanego zakończenia. Nie
  przyznaje niczego ani nie uruchamia cooldownu, ale zmienia ujawnione ziarno
  kolejnej próby nagradzanej, więc nie można wielokrotnie podglądać tej samej
  planszy. Bezczynne wygaśnięcie bez wejścia gracza nadal zachowuje ziarno.
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
- Szlak Zarodników składa się z ośmiu decyzji. Pewny szlak zawsze daje dwa
  punkty, a deterministyczny skrót zależny od ziarna i pogody jest jawnie
  otwarty za trzy punkty albo zamknięty z karą jednego punktu. Sufit wyniku
  odpowiada najlepszemu poprawnemu wyborowi w każdej decyzji.
- Liga Grzybni obejmuje dwanaście wymian: obrona kontruje atak, skupienie
  kontruje obronę, a atak kontruje skupienie. Pierwsze trzy wymiany uczą
  odpowiedzi, późniejsze pokazują już tylko ruch rywala.
- Ogród Pamiątek ma cztery rundy podglądu, ukrycia i odtworzenia sekwencji o
  długościach `3/4/5/6` na siatce `3x3`. Strzałki zatrzymują się na krawędzi,
  a klawisze `1–9` wybierają pola bezpośrednio.
- Wyniki ważone są prezentowane jako punkty. Podsumowanie zestawia wynik z
  dokładnym sufitem konkretnej planszy i pokazuje procent jej potencjału;
  tematyczne nazwy pozostają w instrukcjach i informacji zwrotnej.

## Audyt responsywności i ciągłości sesji — 2026-07-15

- Podczas aktywnej rundy katalogi i ustawienia przygotowawcze ustępują miejsca
  planszy. Canvas, HUD, postęp i przycisk przerwania pozostają razem oraz są
  automatycznie ustawiane w widocznym obszarze panelu, także przy `740x360`.
- Instrukcje i stan semantyczny pozostają dostępne dla technologii
  asystujących, choć ich wizualne karty są kompaktowane po odliczaniu. Po
  zakończeniu fokus wraca do widocznego podsumowania lub przycisku powtórki.
- Krótki landscape korzysta z własnego scrolla sceny: komunikat jest widoczny,
  a rytm dnia i plan pozostają osiągalne bez nakładania się na canvas.
- Jawny reload zachowuje sesyjny identyfikator właściciela i natychmiast wznawia
  aktywną rundę, natomiast nowa, sklonowana lub odtworzona z historii karta
  dostaje nowego właściciela zgodnie z Navigation Timing. Każdy dokument ma
  ponadto osobny identyfikator dzierżawy zapisu, więc CAS nie pozwala dwóm
  kartom równocześnie zapisywać jako jeden proces.
- Automatyczne złapanie lub wygaśnięcie obiektów bez świadomego wejścia gracza
  nie zużywa nagradzanej próby, ziarna ani czasu odnowienia. Skoki zegara przed
  końcem rundy rozliczają wszystkie pozostałe decyzje dokładnie raz.
- Metryki legendarnych rund przechodzą przez produkcyjną ścieżkę postępu, a
  przerwanie i zakończenie odzyskują fokus również po ponownym renderze listy.

## Informacja zwrotna, dostępność i bezpieczne przerwania

- Opis przed startem pokazuje maksymalny czas, sterowanie, oczekiwane nagrody i różnicę
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
- Wydanie `0.1.55` nie zmienia wersji zapisu. Nowe szczegóły rund mieszczą się
  w istniejącej, skalarnej mapie metryk aktywnej sesji.
- Zapisy starsze niż wersja 19 izolują aktywną sesję starej minigry, zamiast
  rozliczać ją według nowych zasad wypłat. Ukończona historia, ekwipunek,
  rekordy, czasy odnowienia, albumy i klucz pamięci
  `pieczargotchi_state_v2` pozostają zachowane.

## Kryteria odbioru

- Kontrola balansu rzeczywistych generatorów działa na deterministycznych
  ziarnach i osiągalnych profilach siedlisk. Każda bezbłędna rozgrywka musi
  osiągać próg zaliczenia, a każda wygenerowana decyzja musi być osiągalna.
- Testy skupione obejmują izolację przerwania, bezczynnej rundy i treningu, poprawność okien
  wejścia, ukończenie pełnej rundy, zgodność klawiatury i wskaźnika, fazy gier
  legendarnych, migrację, zastępcze sygnały zmysłowe oraz responsywne sterowanie
  podsumowaniem.
- Brama viewportów uruchamia wszystkie siedem minigier na referencyjnym
  desktopie, małym telefonie, krótkim landscape i po obu stronach krytycznego
  breakpointu. Wymaga pełnej widoczności canvasu, HUD-u i przerwania, braku
  poziomego overflow oraz prawidłowego ukrycia i przywrócenia katalogu legend.
- Kanoniczną bramą wydania pozostaje `npm run qa`, po której następują budowa
  statyczna Cloudflare i deterministyczne zrzuty przeglądarkowe wszystkich
  siedmiu minigier.
