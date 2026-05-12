# Stan Projektu - 2026-05-11

## Status

Pieczargotchi ma działający MVP lokalny i Apps Script: manifest animacji, lokalny preview, PNG runtime, debug menu, pogodę z lokalizacji, walidację assetów i podstawowe checki CI.

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
- `ClientAnimation.html` trzyma wybór animacji.
- `ClientScene.html` trzyma tło, niebo, pogodę, astronomię i warstwy sceny.
- `ClientSprites.html` trzyma rysowanie sprite fallbacków, overlayów i efektów.
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
- Debug menu pozwala wymusić pogodę, zachmurzenie, opad, siłę wiatru i kierunek wiatru, żeby testować sceny bez czekania na realne warunki.

## Walidacja

Podstawowe lokalne checki:

```sh
node scripts/check-client-syntax.mjs
node scripts/test-client-core.mjs
node scripts/validate-assets.mjs
python3 scripts/audit-sprite-consistency.py
bash scripts/run-local-linux.sh --check-only
```

CI uruchamia syntax checki, test core, walidację PNG i audyt spójności sprite.

## Dług Techniczny

- `ClientScene.html` jest największym partialem i powinien być następnym kandydatem do podziału, jeżeli tło/pogoda/astronomia dalej urosną.
- Testy nadal obejmują głównie core balansu pogody; trzeba dopisać testy migracji stanu, attention, cooldownów i wyboru animacji.
- Dokumenty historyczne opisują pełną drogę dojścia, ale bieżący stan należy czytać z tego pliku, README i `docs/PRODUCT_RULES.md`.
- Trzeba zdecydować, czy `assets/source/imagegen/cutouts/` ma zostać śledzonym źródłem diagnostycznym, czy generowanym artefaktem.
