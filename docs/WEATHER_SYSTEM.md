# System Pogody

Stan na 2026-05-15. Dokument jest praktyczna sciagawka dla implementacji i balansu pogody w Pieczargotchi. Nie jest planem refaktoru.

## Cel Systemu

Pogoda ma byc czytelna w scenie i lagodnie wplywac na rytm opieki. Nie jest tylko dekoracja, ale nie moze przejmowac petli gry ani automatycznie karac gracza care mistakes.

Glowne zasady:

- gameplayowe reguly pogody sa deterministyczne i testowalne,
- balans statow zostaje w `GameRules.gs` i `ClientCore.html`,
- renderer czyta gotowe pola sceny, ale nie tworzy zasad rozgrywki,
- debug moze wymuszac pogode, ale tryb `auto` ma trzymac sie realnych danych,
- lokalny fallback ma byc ladny i bezpieczny, nawet bez geolokalizacji albo sieci.

## Przeplyw Danych

- `ClientWeather.html` pobiera lokalizacje, odpytuje Open-Meteo i buduje `weatherScene`.
- Fallback lokalizacji to Katowice; fallback pogody to lokalna pogodna scena z realnym rytmem dnia.
- Open-Meteo dostarcza m.in. temperature, wilgotnosc, punkt rosy, opad, deszcz, przelotne opady, snieg, grubosc sniegu, zachmurzenie warstwowe, cisnienie, widzialnosc, VPD, ET0, wilgotnosc/temperature gleby oraz wiatr i porywy.
- `ClientCore.html` klasyfikuje warunki i wylicza pola immersji: typ deszczu, Beaufort, potencjal mgly, mokrosc podloza, pokrywe sniezna, formy chmur, trend cisnienia, nadchodzaca pogode, potencjal teczy i profil zycia sceny.
- `ClientState.html` naklada tylko lagodne delty statow z `calculateWeatherStatDeltas`.
- `ClientScene.html` sklada warstwy: niebo, ciala niebieskie, tecza, chmury, opad/wiatr, podloze, zycie sceny i foreground.

## Warunki I Symulacje

| System | Dane wejsciowe | Efekt |
| --- | --- | --- |
| Klasyfikacja pogody | WMO `weather_code`, opad, snieg, zachmurzenie | `clear`, `cloudy`, `rain`, `storm`, `snow`, `fog` |
| Rytm dnia | sunrise/sunset, lokalna data, fallback astronomiczny | fazy dnia, ton nieba, widocznosc slonca/ksiezyca/gwiazd |
| Zachmurzenie | cloud cover total/low/mid/high | gestosc nieba, zaslanianie slonca, ksiezyca i gwiazd |
| Formy chmur | warstwy chmur, opad, mgla | cirrus, cirrostratus, altocumulus, altostratus, stratus, stratocumulus, nimbostratus, cumulonimbus |
| Wiatr | predkosc, kierunek, porywy | ruch chmur, kat deszczu, dryf sniegu, pasma porywow, mgla, trawa, owady |
| Deszcz | rain, showers, precipitation | drizzle/light/moderate/heavy/violent, steady/showers/storm |
| Burza | WMO thunderstorm, deszcz, wiatr, porywy | ciemniejsze niebo, mocny opad, blyski, stres dla Pieczarki |
| Snieg | snowfall, snow depth, temperatura, wiatr | `powder`, `wet`, `blowing`, pokrywa sniezna i bielsze podloze |
| Mgla | wilgotnosc, punkt rosy, widzialnosc, niski wiatr, low cloud | warstwy mgly, slabszy kontrast i miekksze podloze |
| Mokrosc podloza | deszcz, wilgotnosc, mgla, temperatura, VPD, ET0 | mokra trawa, krawedzie wody, kaluze, pozniejsze wysychanie |
| Tecza | krople, niedawny deszcz, okno slonca, niska pozycja slonca | pierwotny luk, czasem wtorny luk i ciemniejszy pas miedzy nimi |
| Zycie sceny | sezon, pora dnia, temperatura, wiatr, opad, wilgotnosc | motyle, male owady latajace, robaczki naziemne, swietliki |
| Zjawiska nieba | data, lokalizacja, noc, zachmurzenie, opad, Kp NOAA/fallback | meteory, roje meteorow, komety, zorza, odkrycia w kolekcji |

## Wplyw Na Gameplay

Pogoda modyfikuje staty lagodnie i z limitem czasu, zeby aktualny warunek pogodowy nie symulowal calej dlugiej nieobecnosci.

| Warunek | Staty | Regula |
| --- | --- | --- |
| Deszcz | `hydration` w gore | mocniej przy wyzszej intensywnosci i realnym opadzie |
| Burza | `hydration` w gore, `happiness` i `cleanliness` w dol | nawadnia, ale stresuje i brudzi scene |
| Snieg | `hydration` lekko w gore | wolniejszy, delikatny efekt wilgoci |
| Wysoka wilgotnosc | `hydration` lekko w gore | wspiera utrzymanie wilgoci |
| Silny wiatr | `hydration` w dol | wysusza podloze |
| Upal | `hydration` w dol | wysusza przez temperature odczuwalna lub realna |

Aktualne wartosci balansu sa w `GameRules.gs` pod `weatherBalance`:

- `maxElapsedHours: 2`,
- `rainHydrationPerHour: 8`,
- `stormHydrationPerHour: 5`,
- `snowHydrationPerHour: 1.5`,
- `highHumidityHydrationPerHour: 1.2`,
- `windDryingPerHour: -3`,
- `heatDryingPerHour: -2`,
- `stormHappinessPerHour: -2`,
- `stormCleanlinessPerHour: -1.5`.

Pogoda nie tworzy obecnie care mistakes sama z siebie. Moze pogorszyc lub poprawic warunki, ale attention/care mistakes pozostaja reakcja na potrzeby i decyzje gracza.

## Zaleznosci Srodowiskowe

- Chmury przesuwaja sie z wiatrem i moga wychodzic poza ekran; nowe sloty pojawiaja sie poza kadrem zamiast nagle znikac na scenie.
- Slonce, ksiezyc i gwiazdy sa przygaszane przez zachmurzenie; slonce moze przebijac sie przez chmury przy sprzyjajacym oknie.
- Deszcz przechyla sie zgodnie z wektorem wiatru; przy mocniejszym deszczu dochodza warstwy "sheet rain".
- Snieg dryfuje wolniej i mocniej reaguje na wiatr przy stylu `blowing`; cieplejszy snieg jest mokry i ciezszy.
- Mgla jest gestsza przy wysokim potencjale mgly i dryfuje z lekkim wiatrem.
- Podloze pamieta mokrosc i snieg jako stan renderera, dzieki czemu kaluze i snieg nie przeskakuja natychmiast po zmianie pogody.
- Trawa ugina sie od wiatru, deszczu, burzy i sniegu; w sniegu jest nizsza i mniej widoczna.
- Robaczki naziemne wchodza z krawedzi albo z wysokiej trawy i znikaja przez krawedz/trawy, bez naglego despawnu na oczach gracza.
- Swietliki maja stale liczony tor lotu rowniez wtedy, gdy aktualnie nie swieca; renderuje sie tylko emisja swiatla, ale pozycja nie resetuje sie przy przygaszeniu.
- Meteory i komety sa rzadkimi zdarzeniami nocnymi, wygaszanymi przez chmury, opad i dzien; wymuszanie debug sluzy tylko do QA.
- Roje meteorow maja okna sezonowe: Perseidy, Geminidy, Kwadrantydy, Orionidy i Leonidy.
- Zorza korzysta z live Kp NOAA, kiedy fetch jest dostepny; bez live danych dziala deterministyczny fallback dla wysokich szerokosci geograficznych, nocy i przejrzystego nieba.
- Pierwsze zaobserwowanie specjalnego zjawiska zapisuje kolekcje odkryc w stanie gry.

## Zycie Sceny

Zycie sceny jest proceduralne i zalezne od pogody, ale nie jest zapisywane w stanie gry.

| Stworzenia | Kiedy rosnie aktywnosc | Kiedy spada aktywnosc | Ruch |
| --- | --- | --- | --- |
| Motyle | cieply dzien, sezon wiosna-lato, slonce lub dobra pogoda | deszcz, burza, snieg, zimno, noc, mocny wiatr | nieregularny, gladki tor lotu z losowymi zmianami kierunku |
| Male latajace owady | cieple warunki, dzien lub okolice aktywnosci swietlikow | opad, zimno, wiatr, snieg | krotkie przeloty z lekkim jitterem i wiatrem |
| Robaczki naziemne | cieplo, sezon, brak ostrego opadu | snieg, burza, silny deszcz, zimno | przechadzanie z krawedzi albo z trawy, z fade-in/fade-out |
| Swietliki | cieple, wilgotne wieczory/noce, okolice wysokiej trawy | opad, snieg, burza, zimno, bardzo slaba wilgotnosc | spokojny dryf gora-dol i na boki, pulsowanie swiatla |

## Zjawiska Nieba

`ClientCoreSky.html` i `src/core/sky.ts` licza profil zjawisk bez losowosci runtime zalegajacej w rendererze. Ten sam czas, lokalizacja i pogoda daja ten sam wynik, a renderer tylko rysuje canvasowe warstwy.

- Spadajace gwiazdy sa krotkimi, pojedynczymi smugami. Poza rojami sa bardzo rzadkie.
- Kometa jest jeszcze rzadsza, wolniejsza i ma dluzszy ogon.
- Roje meteorow zwiekszaja szanse na meteory w znanych oknach sezonowych, ale nadal nie robia ciaglego deszczu gwiazd.
- Zorza jest niska, pasmowa i rysowana za gwiazdami/chmurami jako segmenty pixel-art, nie jako gladki gradient.
- `discoveries.sky` przechowuje pierwsze odkrycie, ostatni czas i licznik; migracja stanu to v8.
- Debug ma `Zjawisko nieba`, a capture wspiera `PIECZARGOTCHI_DEBUG_SKY_EFFECT`.

## Tecza

Tecza jest liczona z kilku bramek:

- musi byc dzien i sensowne okno slonca,
- musi byc woda w powietrzu: aktualny deszcz, przelotne opady albo niedawny deszcz z ostatnich godzin,
- mgla, snieg i noc wygaszaja efekt,
- burza moze dac slaby potencjal, ale nie powinna robic czystej, intensywnej teczy,
- niski kat slonca daje wieksza i czytelniejsza tecze,
- przy mocnym potencjale mozliwy jest drugi, slabszy luk z odwrocona kolejnoscia kolorow i ciemniejszym pasem miedzy lukami.

Renderer ustawia srodek luku po stronie przeciwnej do slonca w ekranowej projekcji. To jest uproszczenie obserwatora na stalej scenie, ale trzyma najwazniejsza zasade: tecza pojawia sie po przeciwnej stronie od zrodla swiatla.

## Co Jest Zgodne Z Rzeczywistoscia

- Open-Meteo daje pola, ktore faktycznie pasuja do takiej symulacji: WMO code, opad, showers, snow depth, warstwy chmur, widzialnosc, VPD, ET0, wiatr, porywy i soil moisture.
- Klasyfikacja WMO dobrze rozdziela mgle, drizzle, rain, showers, snow i thunderstorm.
- Beaufort jest sensowna skala do mapowania predkosci wiatru na obserwowalne efekty w scenie.
- Mgla zalezy od wilgotnosci, punktu rosy, widzialnosci, chmur, pory dnia i wiatru; zbyt silny wiatr miesza powietrze i utrudnia mgle.
- Chmury deszczowe i burzowe sa przypisane do nimbostratus/cumulonimbus, a niskie stratusy wspieraja mgle i ponure niebo.
- ET0/VPD, temperatura, wiatr i wilgotnosc sa dobrymi sygnalami wysychania podloza.
- Motyle realnie zaleza od temperatury, promieniowania slonecznego i wiatru; deszcz jest dla nich niekorzystny.
- Swietliki lubia cieple, wilgotne siedliska i wysoka trawe, a ich aktywnosc jest nocna lub zmierzchowa.
- Tecza wymaga kropli wody przed obserwatorem i slonca za obserwatorem; wysoka pozycja slonca zmniejsza widoczny luk.
- Widocznosc zorzy zalezy od geomagnetycznej aktywnosci Kp, szerokosci geograficznej, ciemnosci i zachmurzenia.
- Perseidy i inne roje meteorow maja sezonowe okna aktywnosci, a nie rowna czestotliwosc przez caly rok.

## Uproszczenia Gry

- Scena nie zna prawdziwego horyzontu, przeszkod terenowych ani wysokosci obserwatora.
- Chmury sa proceduralnymi slotami canvasu, nie modelem atmosfery.
- Mokrosc i snieg na podlozu sa pamiecia renderera, nie pelnym modelem gleby.
- Teczowy luk uzywa ekranowej projekcji 2D i stalego horyzontu.
- Owady sa lokalna animacja, a nie symulacja populacji.
- Debug override moze tworzyc warunki, ktore w realnej meteorologii bylyby rzadkie, ale sa potrzebne do QA.

## Co Warto Dodac Pozniej

- Rosa i szron jako nocne/poranne efekty przy wysokiej wilgotnosci, niskiej temperaturze i slabym wietrze.
- Lepsze wysychanie podloza przez ET0, VPD, wiatr, temperature i naslonecznienie, z wolniejszym powrotem po deszczu.
- Czytelniejszy stan "po deszczu, przejasnia sie" jako najlepszy moment dla teczy.
- Fogbow jako bardzo blady, rzadki wariant przy mgle i niskim sloncu.
- Sezonowa kondycja trawy: bardziej soczysta po wilgotnych dniach, przygaszona przy suszy/upale, przygnieciona sniegiem.
- Delikatne promienie slonca przez dziury w chmurach, szczegolnie rano i wieczorem.
- Oddalony blysk/grzmot jako efekt atmosferyczny burzy, bez fizyki trafien.
- Opcjonalny komunikat gameplayowy o nadchodzacej zmianie pogody na bazie trendu cisnienia i forecast hours.
- Rozszerzyc katalog odkryc o halo ksiezycowe, fogbow, szron/rose i migracje ptakow/owadow jako bardzo rzadkie scenki sezonowe.

## Czego Nie Warto Symulowac Teraz

- CFD albo realna dynamika chmur. Koszt duzy, efekt w pixel-art canvasie maly.
- Wolumetryczna mgla i fizyczne rozpraszanie swiatla. Canvas 2D wystarcza dla czytelnosci.
- Radar/nowcasting opadu. Wymaga osobnych zrodel danych i komplikuje deployment Apps Script.
- Pelna hydrologia gleby, drenaz, retencja i bilans wodny warstw podloza. Dla gry wystarczy surface wetness plus stat `hydration`.
- Fizyka piorunow, trafienia i realne ryzyko burzowe. To zmieniloby klimat gry i mogloby frustrowac.
- Symulacja populacji owadow. Dla immersji wystarczy profil aktywnosci i proceduralne wejscia/wyjscia.
- Dokladne modele optyki atmosferycznej per piksel. Tecza, fogbow i halo powinny byc stylizowanymi warstwami.

## Zrodla Researchu

- Open-Meteo Forecast API: https://open-meteo.com/en/docs
- Met Office, rainbows: https://weather.metoffice.gov.uk/learn-about/weather/optical-effects/rainbows
- Met Office, fog: https://weather.metoffice.gov.uk/learn-about/weather/types-of-weather/fog
- NOAA/NWS, Beaufort Wind Scale: https://www.weather.gov/boi/beaufort
- NOAA/NESDIS, cloud types: https://www.nesdis.noaa.gov/about/k-12-education/atmosphere/types-of-clouds
- NOAA/NWS, evapotranspiration/FRET: https://www.weather.gov/cae/fretinfo.html
- PubMed, butterfly activity and weather: https://pubmed.ncbi.nlm.nih.gov/28308692/
- Firefly.org, firefly habitat: https://www.firefly.org/firefly-habitat.html
- Washington State University, butterflies and rain: https://askdruniverse.wsu.edu/2017/12/18/butterflies-go-rains/
- NOAA SWPC, Planetary K-index: https://www.swpc.noaa.gov/products/planetary-k-index
- NOAA SWPC, tips for viewing aurora: https://www.swpc.noaa.gov/content/tips-viewing-aurora
- NASA, Perseids: https://science.nasa.gov/solar-system/meteors-meteorites/perseids
