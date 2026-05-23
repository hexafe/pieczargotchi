# System Pogody

Stan na 2026-05-20. Dokument jest praktyczną ściągawką dla implementacji i balansu pogody w Pieczargotchi. Nie jest planem refaktoru.

## Cel Systemu

Pogoda ma być czytelna w scenie i łagodnie wpływać na rytm opieki. Nie jest tylko dekoracją, ale nie może przejmować pętli gry ani automatycznie karać gracza za błędy opieki.

Główne zasady:

- gameplayowe reguły pogody są deterministyczne i testowalne,
- balans statów zostaje w `GameRules.gs` i `ClientCore.html`,
- renderer czyta gotowe pola sceny, ale nie tworzy zasad rozgrywki,
- debug może wymuszać pogodę, ale tryb `auto` ma trzymać się realnych danych,
- lokalny tryb zapasowy ma być ładny i bezpieczny, nawet bez geolokalizacji albo sieci.

## Przepływ Danych

- `ClientWeather.html` pobiera lokalizację, odpytuje Open-Meteo i buduje `weatherScene`.
- tryb zapasowy lokalizacji to Katowice; tryb zapasowy pogody to lokalna pogodna scena z realnym rytmem dnia.
- Open-Meteo dostarcza m.in. temperaturę, wilgotność, punkt rosy, opad, deszcz, przelotne opady, śnieg, grubość śniegu, zachmurzenie warstwowe, ciśnienie, widzialność, VPD, ET0, wilgotność/temperaturę gleby oraz wiatr i porywy.
- `ClientCore.html` klasyfikuje warunki i wylicza pola immersji: typ deszczu, Beaufort, potencjał mgły, mokrość podłoża, pokrywę śnieżną, formy chmur, trend ciśnienia, nadchodzącą pogodę, potencjał tęczy i profil życia sceny.
- `ClientState.html` nakłada tylko łagodne delty statów z `calculateWeatherStatDeltas`.
- `ClientScene.html` składa warstwy: niebo, ciała niebieskie, tęcza, chmury, opad/wiatr, podłoże, życie sceny i foreground.

## Warunki I Symulacje

| System | Dane wejściowe | Efekt |
| --- | --- | --- |
| Klasyfikacja pogody | WMO `weather_code`, opad, śnieg, zachmurzenie | `clear`, `cloudy`, `rain`, `storm`, `snow`, `fog` |
| Rytm dnia | sunrise/sunset, lokalna data, tryb zapasowy astronomiczny | fazy dnia, ton nieba, widoczność słońca/księżyca/gwiazd |
| Zachmurzenie | cloud cover total/low/mid/high | gęstość nieba, zasłanianie słońca, księżyca i gwiazd |
| Formy chmur | warstwy chmur, opad, mgła | cirrus, cirrostratus, altocumulus, altostratus, stratus, stratocumulus, nimbostratus, cumulonimbus |
| Wiatr | prędkość, kierunek, porywy | ruch chmur, kąt deszczu, dryf śniegu, pasma porywów, mgła, trawa, owady |
| Deszcz | rain, showers, precipitation | drizzle/light/moderate/heavy/violent, steady/showers/storm |
| Burza | WMO thunderstorm, deszcz, wiatr, porywy | ciemniejsze niebo, mocny opad, błyski, stres dla Pieczarki |
| Śnieg | snowfall, snow depth, temperatura, wiatr | `powder`, `wet`, `blowing`, pokrywa śnieżna i bielsze podłoże |
| Mgła | wilgotność, punkt rosy, widzialność, niski wiatr, low cloud | warstwy mgły, słabszy kontrast i miększe podłoże |
| Mokrość podłoża | deszcz, wilgotność, mgła, temperatura, VPD, ET0 | mokra trawa, krawędzie wody, kałuże, późniejsze wysychanie |
| Tęcza | krople, niedawny deszcz, okno słońca, niska pozycja słońca | pierwotny łuk, czasem wtórny łuk i ciemniejszy pas między nimi |
| Życie sceny | sezon, pora dnia, temperatura, wiatr, opad, wilgotność | motyle, małe owady latające, robaczki naziemne, świetliki |
| Zjawiska nieba | data, lokalizacja, noc, zachmurzenie, opad, Kp NOAA/tryb zapasowy | meteory, roje meteorów, komety, zorza, odkrycia w kolekcji |
| Zjawiska środowiskowe | pora dnia, wilgotność, temperatura, wiatr, mokrość, zachmurzenie, mgła | rosa, szron, fogbow, halo, promienie, parowanie, drżenie powietrza |

## Wpływ Na Gameplay

Pogoda modyfikuje staty łagodnie i z limitem czasu, żeby aktualny warunek pogodowy nie symulował całej długiej nieobecności.

| Warunek | Staty | Reguła |
| --- | --- | --- |
| Deszcz | `hydration` w górę | mocniej przy wyższej intensywności i realnym opadzie |
| Burza | `hydration` w górę, `happiness` i `cleanliness` w dół | nawadnia, ale stresuje i brudzi scenę |
| Śnieg | `hydration` lekko w górę | wolniejszy, delikatny efekt wilgoci |
| Wysoka wilgotność | `hydration` lekko w górę | wspiera utrzymanie wilgoci |
| Silny wiatr | `hydration` w dół | wysusza podłoże |
| Upał | `hydration` w dół | wysusza przez temperaturę odczuwalną lub realną |

Aktualne wartości balansu są w `GameRules.gs` pod `weatherBalance`:

- `maxElapsedHours: 2`,
- `rainHydrationPerHour: 8`,
- `stormHydrationPerHour: 5`,
- `snowHydrationPerHour: 1.5`,
- `highHumidityHydrationPerHour: 1.2`,
- `windDryingPerHour: -3`,
- `heatDryingPerHour: -2`,
- `stormHappinessPerHour: -2`,
- `stormCleanlinessPerHour: -1.5`.

Pogoda nie tworzy obecnie błędów opieki sama z siebie. Może pogorszyć lub poprawić warunki, ale attention/błędy opieki pozostają reakcją na potrzeby i decyzje gracza.

## Zależności Środowiskowe

- Chmury przesuwają się z wiatrem i mogą wychodzić poza ekran; nowe sloty pojawiają się poza kadrem zamiast nagle znikać na scenie.
- Chmury mają profile formy, nie tylko gęstość: wysokie cirrus/cirrostratus są cienkie i smużyste, altocumulus składa się z drobnych kęp, stratus/altostratus są warstwowe, nimbostratus jest cięższy i ma subtelne kurtyny opadu, a cumulonimbus tworzy wyższą wieżę z kowadłem.
- Sloty chmur mają cykl życia `birth -> mature -> dissolve`; zmieniają alfę, szerokość, wysokość, krawędzie i mikrosegmenty, żeby formowanie i rozpad nie wyglądały jak nagły pop-in/pop-out.
- Profil chmury niesie optyczną grubość i ciężar wizualny. Te wartości powinny sterować zaciemnieniem, przerwami dla promieni, widocznością ciał niebieskich i subtelnym nastrojem sceny, ale nie gameplayem.
- Słońce, księżyc i gwiazdy są przygaszane przez zachmurzenie; słońce może przebijać się przez chmury przy sprzyjającym oknie.
- Deszcz przechyla się zgodnie z wektorem wiatru; przy mocniejszym deszczu dochodzą warstwy arkusza animacji `rain`.
- Śnieg dryfuje wolniej i mocniej reaguje na wiatr przy stylu `blowing`; cieplejszy śnieg jest mokry i cięższy.
- Mgła jest gęstsza przy wysokim potencjale mgły i dryfuje z lekkim wiatrem.
- Podłoże pamięta mokrość i śnieg jako stan renderera, dzięki czemu kałuże i śnieg nie przeskakują natychmiast po zmianie pogody.
- Trawa ugina się od wiatru, deszczu, burzy i śniegu; w śniegu jest niższa i mniej widoczna.
- Robaczki naziemne wchodzą z krawędzi albo z wysokiej trawy i znikają przez krawędź/trawę, bez nagłego despawnu na oczach gracza.
- Świetliki mają stale liczony tor lotu również wtedy, gdy aktualnie nie świecą; renderuje się tylko emisja światła, ale pozycja nie resetuje się przy przygaszeniu.
- Meteory i komety są rzadkimi zdarzeniami nocnymi, wygaszanymi przez chmury, opad i dzień; wymuszanie debug służy tylko do QA.
- Roje meteorów mają okna sezonowe: Perseidy, Geminidy, Kwadrantydy, Orionidy i Leonidy.
- Zorza korzysta z live Kp NOAA, kiedy fetch jest dostępny; bez live danych działa deterministyczny tryb zapasowy dla wysokich szerokości geograficznych, nocy i przejrzystego nieba.
- Rosa, szron, fogbow, halo księżycowe, promienie przez chmury, parowanie po deszczu, drżenie powietrza i przejaśnienie po deszczu są liczone deterministycznie z profilu sceny, a renderer tylko rysuje warstwy.
- Pierwsze zaobserwowanie specjalnego zjawiska zapisuje kolekcję odkryć w stanie gry.

## Życie Sceny

Życie sceny jest proceduralne i zależne od pogody, ale nie jest zapisywane w stanie gry.

| Stworzenia | Kiedy rośnie aktywność | Kiedy spada aktywność | Ruch |
| --- | --- | --- | --- |
| Motyle | ciepły dzień, sezon wiosna-lato, słońce lub dobra pogoda | deszcz, burza, śnieg, zimno, noc, mocny wiatr | nieregularny, gładki tor lotu z losowymi zmianami kierunku |
| Małe latające owady | ciepłe warunki, dzień lub okolice aktywności świetlików | opad, zimno, wiatr, śnieg | krótkie przeloty z lekkim jitterem i wiatrem |
| Robaczki naziemne | ciepło, sezon, brak ostrego opadu | śnieg, burza, silny deszcz, zimno | przechadzanie z krawędzi albo z trawy, z fade-in/fade-out |
| Świetliki | ciepłe, wilgotne wieczory/noce, okolice wysokiej trawy | opad, śnieg, burza, zimno, bardzo słaba wilgotność | spokojny dryf góra-dół i na boki, pulsowanie światła |

## Zjawiska Nieba

`ClientCoreSky.html` i `src/core/sky.ts` liczą profil zjawisk bez losowości czasu działania zalegającej w rendererze. Ten sam czas, lokalizacja i pogoda dają ten sam wynik, a renderer tylko rysuje canvasowe warstwy.

- Spadające gwiazdy są krótkimi, pojedynczymi smugami. Poza rojami są bardzo rzadkie.
- Kometa jest jeszcze rzadsza, wolniejsza i ma dłuższy ogon.
- Roje meteorów zwiększają szanse na meteory w znanych oknach sezonowych, ale nadal nie robią ciągłego deszczu gwiazd.
- Zorza jest niska, pasmowa i rysowana za gwiazdami/chmurami jako segmenty pixel-art, nie jako gładki gradient.
- `discoveries.sky` przechowuje pierwsze odkrycie, ostatni czas i licznik nieba; `discoveries.environment` robi to samo dla efektów środowiskowych. Migracja stanu to v9.
- Debug ma `Zjawisko nieba`, a capture wspiera `PIECZARGOTCHI_DEBUG_SKY_EFFECT`.

## Zjawiska Środowiskowe

`ClientCorePhenomena.html` liczy profil efektów środowiskowych bez losowości czasu działania renderera. Ten sam czas, pogoda i lokalizacja dają ten sam zestaw efektów oraz odkryć.

- Rosa pojawia się głównie rano przy wysokiej wilgotności, słabym wietrze, braku opadu i wilgotnym podłożu.
- Szron jest porannym wariantem zimna, wilgoci i ciszy; nie powinien wyglądać jak zwykła rosa.
- Fogbow jest bladym łukiem przy mgle, niskim słońcu i bez ciężkiego opadu.
- Halo księżycowe wymaga nocy, chmur wysokich/cienkich i braku opadu.
- Promienie słońca pojawiają się przy niskim słońcu, przerwach w chmurach i bez ciężkiego opadu.
- Parowanie po deszczu wymaga mokrego podłoża, ciepła i spokojniejszego powietrza.
- Drżenie powietrza jest subtelne i dotyczy suchego, gorącego południa.
- Przejaśnienie po deszczu dodaje drobne błyski w trawie, kiedy podłoże jest jeszcze mokre, a niebo zaczyna się otwierać.

Capture wspiera scenariusze `phenomena-*` oraz dodatkowe override'y warstw chmur: `PIECZARGOTCHI_DEBUG_CLOUD_LOW`, `PIECZARGOTCHI_DEBUG_CLOUD_MID` i `PIECZARGOTCHI_DEBUG_CLOUD_HIGH`.

## Tęcza

Tęcza jest liczona z kilku bramek:

- musi być dzień i sensowne okno słońca,
- musi być woda w powietrzu: aktualny deszcz, przelotne opady albo niedawny deszcz z ostatnich godzin,
- mgła, śnieg i noc wygaszają efekt,
- burza może dać słaby potencjał, ale nie powinna robić czystej, intensywnej tęczy,
- niski kąt słońca daje większą i czytelniejszą tęczę,
- przy mocnym potencjale możliwy jest drugi, słabszy łuk z odwróconą kolejnością kolorów i ciemniejszym pasem między łukami.

Renderer ustawia środek łuku po stronie przeciwnej do słońca w ekranowej projekcji. To jest uproszczenie obserwatora na stałej scenie, ale trzyma najważniejszą zasadę: tęcza pojawia się po przeciwnej stronie od źródła światła.

## Co Jest Zgodne Z Rzeczywistością

- Open-Meteo daje pola, które faktycznie pasują do takiej symulacji: WMO code, opad, showers, snow depth, warstwy chmur, widzialność, VPD, ET0, wiatr, porywy i soil moisture.
- Klasyfikacja WMO dobrze rozdziela mgłę, drizzle, rain, showers, snow i thunderstorm.
- Beaufort jest sensowną skalą do mapowania prędkości wiatru na obserwowalne efekty w scenie.
- Mgła zależy od wilgotności, punktu rosy, widzialności, chmur, pory dnia i wiatru; zbyt silny wiatr miesza powietrze i utrudnia mgłę.
- Chmury deszczowe i burzowe są przypisane do nimbostratus/cumulonimbus, a niskie stratusy wspierają mgłę i ponure niebo.
- ET0/VPD, temperatura, wiatr i wilgotność są dobrymi sygnałami wysychania podłoża.
- Motyle realnie zależą od temperatury, promieniowania słonecznego i wiatru; deszcz jest dla nich niekorzystny.
- Świetliki lubią ciepłe, wilgotne siedliska i wysoką trawę, a ich aktywność jest nocna lub zmierzchowa.
- Tęcza wymaga kropli wody przed obserwatorem i słońca za obserwatorem; wysoka pozycja słońca zmniejsza widoczny łuk.
- Widoczność zorzy zależy od geomagnetycznej aktywności Kp, szerokości geograficznej, ciemności i zachmurzenia.
- Perseidy i inne roje meteorów mają sezonowe okna aktywności, a nie równą częstotliwość przez cały rok.

## Uproszczenia Gry

- Scena nie zna prawdziwego horyzontu, przeszkód terenowych ani wysokości obserwatora.
- Chmury są proceduralnymi slotami canvasu, nie modelem atmosfery.
- Mokrość i śnieg na podłożu są pamięcią renderera, nie pełnym modelem gleby.
- Tęczowy łuk używa ekranowej projekcji 2D i stałego horyzontu.
- Owady są lokalną animacją, a nie symulacją populacji.
- Debug override może tworzyć warunki, które w realnej meteorologii byłyby rzadkie, ale są potrzebne do QA.

## Co Warto Dodać Później

- Lepsze wysychanie podłoża przez ET0, VPD, wiatr, temperaturę i nasłonecznienie, z wolniejszym powrotem po deszczu.
- Sezonowa kondycja trawy: bardziej soczysta po wilgotnych dniach, przygaszona przy suszy/upale, przygnieciona śniegiem.
- Oddalony błysk/grzmot jako efekt atmosferyczny burzy, bez fizyki trafień.
- Opcjonalny komunikat gameplayowy o nadchodzącej zmianie pogody na bazie trendu ciśnienia i forecast hours.
- Rozszerzyć katalog odkryć o migracje ptaków/owadów jako bardzo rzadkie scenki sezonowe.

## Czego Nie Warto Symulować Teraz

- CFD albo realna dynamika chmur. Koszt duży, efekt w pixel-art canvasie mały.
- Wolumetryczna mgła i fizyczne rozpraszanie światła. Canvas 2D wystarcza dla czytelności.
- Radar/nowcasting opadu. Wymaga osobnych źródeł danych i komplikuje deployment Apps Script.
- Pełna hydrologia gleby, drenaż, retencja i bilans wodny warstw podłoża. Dla gry wystarczy surface wetness plus stat `hydration`.
- Fizyka piorunów, trafienia i realne ryzyko burzowe. To zmieniłoby klimat gry i mogłoby frustrować.
- Symulacja populacji owadów. Dla immersji wystarczy profil aktywności i proceduralne wejścia/wyjścia.
- Dokładne modele optyki atmosferycznej per piksel. Tęcza, fogbow i halo powinny być stylizowanymi warstwami.

## Źródła Researchu

- Open-Meteo Forecast API: https://open-meteo.com/en/docs
- Met Office, rainbows: https://weather.metoffice.gov.uk/learn-about/weather/optical-effects/rainbows
- Met Office, fog: https://weather.metoffice.gov.uk/learn-about/weather/types-of-weather/fog
- NOAA/NWS, Beaufort Wind Scale: https://www.weather.gov/boi/beaufort
- NOAA/NESDIS, cloud types: https://www.nesdis.noaa.gov/about/k-12-education/atmosphere/types-of-clouds
- NOAA/NWS, evapotranspiration/FRET: https://www.weather.gov/cae/fretinfo.html
- PubMed, butterfly activity and weather: https://pubmed.ncbi.nlm.nih.gov/28308692/
- Firefly.org: https://www.firefly.org/firefly-habitat.html
- Washington State University, butterflies and rain: https://askdruniverse.wsu.edu/2017/12/18/butterflies-go-rains/
- NOAA SWPC, Planetary K-index: https://www.swpc.noaa.gov/products/planetary-k-index
- NOAA SWPC, tips for viewing aurora: https://www.swpc.noaa.gov/content/tips-viewing-aurora
- NASA, Perseids: https://science.nasa.gov/solar-system/meteors-meteorites/perseids
