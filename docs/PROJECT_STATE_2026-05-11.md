# Stan Projektu - 2026-05-11

Ten checkpoint jest historyczny. Aktualny stan projektu po Arenie i ruchomym życiu sceny jest w `docs/PROJECT_STATE_2026-05-13.md`.

## Status

Pieczargotchi ma działający MVP lokalny i Apps Script: manifest animacji, lokalny preview, PNG runtime, lokalny debug menu, pogodę z lokalizacji, walidację assetów i podstawowe checki CI.

Najważniejsza decyzja z tego checkpointu: dalszy rozwój ma chronić czytelność, maintainability i scalability. Nowe funkcje powinny trafiać do osobnych partiali lub testowalnego core, a nie powiększać jednego pliku klienta.

## Aktualna Architektura

- `Client.html` jest cienkim agregatorem partiali.
- `ClientCore.html` zawiera małe czyste funkcje, które można testować przez Node.
- `ClientBoot.html` trzyma konfigurację, runtime i podstawowe bindowanie.
- `ClientDebug.html` trzyma menu developerskie.
- `ClientRuntime.html` trzyma asset loading, timery i render loop.
- `ClientWeather.html` trzyma geolokalizację, Open-Meteo, dzień/noc, słońce i normalizację sceny pogody.
- `ClientState.html` trzyma stan, migrację, decay, attention i wzrost.
- `ClientActions.html` trzyma obsługę akcji.
- `ClientUi.html` trzyma render panelu i komunikatów.
- `ClientBattleScene.html` trzyma osobny renderer lokalnej Areny.
- `ClientAnimation.html` trzyma wybór animacji.
- `ClientScene.html` jest cienkim orkiestratorem sceny.
- `ClientScenePalette.html` trzyma palety dnia/pogody i pasy nieba.
- `ClientSceneCelestial.html` trzyma słońce, księżyc, gwiazdy, konstelacje i matematykę astronomiczną.
- `ClientSceneWeather.html` trzyma chmury, wiatr, deszcz, burzę, śnieg, mgłę i współdzielone weather utility.
- `ClientSceneLife.html` trzyma motyle, małe owady, robaczki naziemne i świetliki poruszające się zgodnie z profilem pory roku, pogody i pory dnia.
- `ClientSceneGround.html` trzyma podłoże, bazowy grass patch i trawę reagującą na wiatr.
- `ClientSprites.html` trzyma rysowanie sprite fallbacków, overlayów i efektów.
- State ma wersję `3`; zapis nadal używa klucza `pieczargotchi_state_v2`, a osobny subtree `battle` obsługuje lokalną Arenę.
- `Config.gs` ma runtime flags: `debugEnabled`, `exposeRuntime`, `assetMode`. Produkcyjnie debug i `window.__pieczargotchiRuntime` są wyłączone, a lokalny preview włącza je w `dev-server.mjs`.
- Wizualna pogoda używa znormalizowanych pól sceny: zachmurzenie zasłania ciała niebieskie, deszcz i śnieg reagują na kierunek/siłę wiatru, chmury dryfują wolniej według średniego wiatru, a wiatr ma porywy i okresy uspokojenia wokół średniej z danych pogodowych.
- Runtime PNG mają wspólną frontową trawę składaną w `scripts/build-imagegen-sprites.py`; wszystkie stadia są za tą samą niższą trawą.
- Scena ma osobny wygenerowany asset `assets/environment/grass_patch.png` jako bazowy trawnik pod Pieczarką, a pojedyncze wyższe źdźbła są warstwą canvasową reagującą na wiatr.
- Rzadki dzienny easter egg `:|` jest deterministyczny per zapis i data; debug menu pozwala wymusić wariant zadowolony, gniewny albo Iwoniaście, a runtime używa osobnych neutralnych sprite sheetów. Gdy wariant Iwoniaście występuje podczas deszczu lub burzy, wybierany jest osobny wyrenderowany sprite sheet z fioletową parasolką.

## Decyzje Balansu

- Deszcz aktywnie zwiększa wilgoć.
- Burza również zwiększa wilgoć, ale kosztuje radość i czystość.
- Śnieg daje mały bonus wilgoci.
- Silny wiatr i upał osuszają.
- Efekt pogody jest ograniczony czasowo, żeby po długiej przerwie jedna aktualna prognoza nie przepisała wielu godzin historii gry.
- Debug menu pozwala wymusić pogodę, zachmurzenie, opad, siłę wiatru, kierunek wiatru, lokalizację obserwatora, fazę księżyca i konstelację, żeby testować sceny bez czekania na realne warunki.
- Boot czeka na pierwszą scenę pogodową przed naliczeniem offline decay, więc balans pogody i pierwsze renderowanie korzystają z tej samej sceny.

## Arena

- Lokalna Arena v1 jest zaimplementowana z osobnym przełącznikiem `Opieka / Arena`, UI, rendererem canvasowym i logiem walki.
- Arena odblokowuje się dopiero na etapie `legendary`.
- Statystyki walki nie mieszają się z `state.stats`; żyją w `state.battle`, a care stats są tylko snapshotem wejściowym na starcie walki.
- Move catalog jest w `GameRules.gs` pod `battle.moveCatalog`, nie w `Actions.gs`.
- Testowalny core ma deterministyczny reducer tury, seeded RNG, trening z capem i rozliczanie nagród.

## Walidacja

Podstawowe lokalne checki:

```sh
node scripts/check-client-syntax.mjs
node scripts/test-client-core.mjs
env TZ=UTC node scripts/test-client-core.mjs
node scripts/validate-assets.mjs
python3 scripts/audit-sprite-consistency.py
python3 scripts/audit-spore-sprites.py
bash scripts/run-local-linux.sh --check-only
node scripts/capture-life-motion.mjs
node dev-server.mjs 8092
```

Z uruchomionym preview na porcie 8092:

```sh
node scripts/capture-weather-matrix.mjs http://127.0.0.1:8092/ /tmp/pieczargotchi-weather-matrix
```

CI uruchamia syntax checki, test core, walidację PNG, audyt spójności sprite i bootstrap lokalnego preview.

## Dług Techniczny

- Scena jest już rozbita na partiale; nowe systemy renderowania powinny dostawać osobny partial, a nie wracać do monolitu.
- Testy obejmują core balansu pogody, ambient life profile, cooldowny, attention edge cases, wybór animacji, migrację v2 -> v3 i battle reducer. Dalsze testy powinny rosnąć przy backup/import, minigrach i ewolucji.
- Dokumenty historyczne opisują pełną drogę dojścia, ale bieżący stan należy czytać z `docs/PROJECT_STATE_2026-05-13.md`, README i `docs/PRODUCT_RULES.md`.
- Trzeba zdecydować, czy `assets/source/imagegen/cutouts/` ma zostać śledzonym źródłem diagnostycznym, czy generowanym artefaktem.
