# Lista Sprite'ow Etapow Wzrostu

Data: 2026-05-10

Ten dokument jest kontraktem dla sprite'ow etapów wzrostu. Najważniejsza zasada: nie skalujemy calego sprite'a jako sceny. Trawa/mech zostaje wspolna i stabilna, a różnica wieku ma być widoczna w samej Pieczarce. Źródlem postaci, stanów i akcji są atlasy z wbudowanego image generatora.

## Wymagane Etapy

| Etap | Prog wzrostu | Wymagany wyglad | Status |
| --- | ---: | --- | --- |
| `spore` | `0` | maly kremowy zalazek pieczarki w tej samej trawie; krótki trzonek i mini kapelusz typu button/pin; bez liscia, czupryny i kwadratowej doniczki | kompletny wygenerowany atlas `spore_full_generated_atlas.png` + stabilny builder |
| `baby` | `12` | mala pieczarka, nizszy kapelusz i twarz nizej w trawie | wygenerowane |
| `young` | `35` | mloda pieczarka, wyraznie wieksza od `baby`, ale nie dorosla | wygenerowane |
| `adult` | `70` | dojrzala pieczarka zgodna stylem z `assets/awake.png` | wygenerowane |
| `legendary` | `100` | dojrzala pieczarka z pelerynka superbohatera pieczarkowego | wygenerowane |

## Wymagane Stany Dla Każdego Etapu

Każdy etap ma osobny arkusz animacji w `assets/stages/<etap>/`:

- `idle_sheet.png` - domyslne czuwanie.
- `sleep_sheet.png` - sen tego samego etapu, bez skoku rozmiaru.
- `wake_sheet.png` - krótka reakcja po wybudzeniu, renderowana jako sprite danego etapu bez canvasowej doklejki twarzy.
- `happy_sheet.png` - zadowolenie.
- `excellent_sheet.png` - bardzo dobra opieka.
- `tired_sheet.png` - senna, slabsza postawa.
- `dry_sheet.png` - potrzeba wilgoci.
- `hungry_sheet.png` - brak składnikow odzywczych.
- `dirty_sheet.png` - bałagan w grządkce.
- `sick_sheet.png` - choroba lub osłabienie.
- `critical_sheet.png` - pilna potrzeba.

Aktualny stan repo: `5 etapów x 11 stanów = 55` arkuszy animacji stage.

## Wymagane Aktywności Per Etap

Aktywności mają osobne arkusze animacji dla każdego etapu w `assets/activities/<etap>/`:

- `hydrate_sheet.png`
- `feed_sheet.png`
- `clean_sheet.png`
- `play_sheet.png`
- `instrument_sheet.png`
- `sing_sheet.png`
- `spores_sheet.png`
- `harvest_sheet.png`

Aktualny stan repo: `5 etapów x 8 aktywności = 40` arkuszy animacji osobnych dla etapu oraz `8` mechanizmów zastępczych kompatybilności w `assets/activities/`. Manifest czasu działania używa wariantów osobnych dla etapu; mechanizmy zastępcze są nadal walidowane jako powierzchnia kompatybilności, ale nie są ładowane przez manifest.

`hydrate_sheet.png` jest składany specjalnie: postać zachowuje rozmiar etapu jak w stanie bazowym, a lekka mgiełka kropli wody jest osobną warstwą nad kapeluszem/zawiązkiem. Nie wolno skalować całej sceny podlewania razem z wodą, bo zmniejsza to Pieczarkę.

## Efekty Pomocnicze

Efekty są w `assets/effects/` i nie zastępują animacji postaci:

- `drops_sheet.png`
- `sparkle_sheet.png`
- `dust_sheet.png`
- `notes_sheet.png`
- `spore_cloud_sheet.png`

Aktualny stan repo: `5` arkuszy animacji efektów z atlasu generatora obrazów. Są walidowane razem z plikami PNG używanymi podczas działania, ale pozostają opcjonalnymi zasobami pomocniczymi poza aktualnym manifestem.

## Kontrola Jakości

- `adult` porównujemy wizualnie z `assets/awake.png`; ma wyglądać jak ta sama dorosła Pieczarka.
- `spore`, `baby`, `young`, `adult` i `legendary` muszą mieć tę samą bazę trawy.
- Różnica między etapami ma wynikać z sylwetki Pieczarki, nie ze skalowania całej sceny.
- `sleep`, `wake` i `idle` w jednym etapie muszą trzymać ten sam rozmiar i środek.
- `spore` musi bazować na kompletnych wygenerowanych sprite'ach z atlasu, bez wklejania twarzy z innego etapu i bez nakładania osobnego kapelusza w builderze.
- `sleep` dla `spore` musi mieć zamknięte oczy z wygenerowanego sprite'a i nie powinien mieć wklejonych `Z` w PNG; `zZz` rysuje czas działania przez anchor etapu, żeby nie duplikować efektu przy małym zarodku.
- `wake` dla `spore` musi mieć wygenerowaną zaskoczoną minę i nie może polegać na canvasowej doklejce twarzy.
- `instrument` i `sing` dla `spore` muszą mieć osobną wygenerowaną minę/rekwizyt, nie tylko zwykły idle z nutkami.
- `instrument` nie może przewijać kolejnych instrumentów w klatkach arkusza; instrument jest losowany raz przy akcji i trzymany stabilnie do końca animacji.
- `legendary` ma mieć pelerynkę widoczną w canvasie, ale nie może zasłaniać twarzy.
- aktywność wywołana na danym etapie musi renderować sprite tego samego etapu, bez przeskoku na dorosłą Pieczarkę.

## Komendy Weryfikacyjne

```sh
python3 -m py_compile scripts/generate-pixel-assets.py
python3 scripts/build-imagegen-sprites.py
node scripts/validate-assets.mjs
python3 scripts/audit-spore-sprites.py
python3 scripts/audit-sprite-consistency.py
PIECZARGOTCHI_CAPTURE_VIEWPORT=1 PIECZARGOTCHI_CAPTURE_STAGES=1 PIECZARGOTCHI_CAPTURE_ACTIVITIES=1 node scripts/capture-app-render.mjs http://127.0.0.1:8092/ /tmp/pieczargotchi-stage-app
```

Ostatni capture z lokalnej appki potwierdził, że `spore`, `baby`, `young`, `adult` i `legendary` renderują różne sylwetki przy niezmienionej bazie trawy, a akcje mają wariant zgodny z aktywnym etapem.
