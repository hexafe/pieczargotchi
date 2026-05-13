# Lista Sprite'ow Etapow Wzrostu

Data: 2026-05-10

Ten dokument jest kontraktem dla sprite'ow etapow wzrostu. Najwazniejsza zasada: nie skalujemy calego sprite'a jako sceny. Trawa/mech zostaje wspolna i stabilna, a roznica wieku ma byc widoczna w samej Pieczarce. Zrodlem postaci, stanow i akcji sa atlasy z wbudowanego image generatora.

## Wymagane Etapy

| Etap | Prog wzrostu | Wymagany wyglad | Status |
| --- | ---: | --- | --- |
| `spore` | `0` | maly kremowy zalazek pieczarki w tej samej trawie; krotki trzonek i mini kapelusz typu button/pin; bez liscia, czupryny i kwadratowej doniczki | kompletny wygenerowany atlas `spore_full_generated_atlas.png` + stabilny builder |
| `baby` | `12` | mala pieczarka, nizszy kapelusz i twarz nizej w trawie | wygenerowane |
| `young` | `35` | mloda pieczarka, wyraznie wieksza od `baby`, ale nie dorosla | wygenerowane |
| `adult` | `70` | dojrzala pieczarka zgodna stylem z `assets/awake.png` | wygenerowane |
| `legendary` | `100` | dojrzala pieczarka z pelerynka superbohatera pieczarkowego | wygenerowane |

## Wymagane Stany Dla Kazdego Etapu

Kazdy etap ma osobny sheet w `assets/stages/<etap>/`:

- `idle_sheet.png` - domyslne czuwanie.
- `sleep_sheet.png` - sen tego samego etapu, bez skoku rozmiaru.
- `wake_sheet.png` - krotkie `O_O` po wybudzeniu.
- `happy_sheet.png` - zadowolenie.
- `excellent_sheet.png` - bardzo dobra opieka.
- `tired_sheet.png` - senna, slabsza postawa.
- `dry_sheet.png` - potrzeba wilgoci.
- `hungry_sheet.png` - brak skladnikow odzywczych.
- `dirty_sheet.png` - balagan w grzadce.
- `sick_sheet.png` - choroba lub oslabienie.
- `critical_sheet.png` - pilna potrzeba.

Aktualny stan repo: `5 etapow x 11 stanow = 55` sheetow stage.

## Wymagane Aktywnosci Per Etap

Aktywnosci maja osobne sheety dla kazdego etapu w `assets/activities/<etap>/`:

- `hydrate_sheet.png`
- `feed_sheet.png`
- `clean_sheet.png`
- `play_sheet.png`
- `instrument_sheet.png`
- `sing_sheet.png`
- `spores_sheet.png`
- `harvest_sheet.png`

Aktualny stan repo: `5 etapow x 8 aktywnosci = 40` sheetow stage-specific oraz `8` fallbackow kompatybilnosci w `assets/activities/`. Manifest runtime uzywa wariantow stage-specific; fallbacki sa nadal walidowane jako powierzchnia kompatybilnosci, ale nie sa ladowane przez manifest.

`hydrate_sheet.png` jest skladany specjalnie: postac zachowuje rozmiar etapu jak w stanie bazowym, a lekka mgielka kropli wody jest osobna warstwa nad kapeluszem/zawiazkiem. Nie wolno skalowac calej sceny podlewania razem z woda, bo zmniejsza to Pieczarke.

## Efekty Pomocnicze

Efekty sa w `assets/effects/` i nie zastepuja animacji postaci:

- `drops_sheet.png`
- `sparkle_sheet.png`
- `dust_sheet.png`
- `notes_sheet.png`
- `spore_cloud_sheet.png`

Aktualny stan repo: `5` sheetow efektow z imagegenowego atlasu. Sa walidowane razem z runtime PNG, ale pozostaja opcjonalnymi assetami pomocniczymi poza aktualnym manifestem.

## Kontrola Jakosci

- `adult` porownujemy wizualnie z `assets/awake.png`; ma wygladac jak ta sama dorosla Pieczarka.
- `spore`, `baby`, `young`, `adult` i `legendary` musza miec ta sama baze trawy.
- Roznica miedzy etapami ma wynikac z sylwetki Pieczarki, nie ze skalowania calej sceny.
- `sleep`, `wake` i `idle` w jednym etapie musza trzymac ten sam rozmiar i srodek.
- `spore` musi bazowac na kompletnych wygenerowanych sprite'ach z atlasu, bez wklejania twarzy z innego etapu i bez nakladania osobnego kapelusza w builderze.
- `sleep` dla `spore` musi miec zamkniete oczy z wygenerowanego sprite'a i nie powinien miec wklejonych `Z` w PNG; `zZz` rysuje runtime przez anchor etapu, zeby nie duplikowac efektu przy malym zarodku.
- `wake` dla `spore` musi miec wygenerowana zaskoczona mine `O_O`.
- `instrument` i `sing` dla `spore` musza miec osobna wygenerowana mine/rekwizyt, nie tylko zwykly idle z nutkami.
- `instrument` nie moze przewijac kolejnych instrumentow w klatkach sheetu; instrument jest losowany raz przy akcji i trzymany stabilnie do konca animacji.
- `legendary` ma miec pelerynke widoczna w canvasie, ale nie moze zaslaniac twarzy.
- aktywnosc wywolana na danym etapie musi renderowac sprite tego samego etapu, bez przeskoku na dorosla Pieczarke.

## Komendy Weryfikacyjne

```sh
python3 -m py_compile scripts/generate-pixel-assets.py
python3 scripts/build-imagegen-sprites.py
node scripts/validate-assets.mjs
python3 scripts/audit-spore-sprites.py
python3 scripts/audit-sprite-consistency.py
PIECZARGOTCHI_CAPTURE_VIEWPORT=1 PIECZARGOTCHI_CAPTURE_STAGES=1 PIECZARGOTCHI_CAPTURE_ACTIVITIES=1 node scripts/capture-app-render.mjs http://127.0.0.1:8092/ /tmp/pieczargotchi-stage-app
```

Ostatni capture z lokalnej appki potwierdzil, ze `spore`, `baby`, `young`, `adult` i `legendary` renderuja rozne sylwetki przy niezmienionej bazie trawy, a akcje maja wariant zgodny z aktywnym etapem.
