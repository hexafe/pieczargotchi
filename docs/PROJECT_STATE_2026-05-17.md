# Stan Projektu - 2026-05-17

## Status

Gałąź `codex-weather-sprite-audit` ma teraz wdrożony slice balansu rozgrywki po researchu Tamagotchi i opinii społeczności. Gra przechodzi z krótkiego, sekundowego mikro-loopa na rytm 2-3 krótkich wejść dziennie, z pełną ochroną nocy i wolniejszą drogą do Legendarnej Pieczarki.

Po slice'ie immersji klient ma też aktywną warstwę reakcji środowiskowych: Pieczarka reaguje wizualnie na kursor/tapnięcie, słońce, deszcz, śnieg, gwiazdy i silny wiatr. Reakcje są wizualne, nie modyfikują statystyk i nie przykrywają stanów opieki, kuracji ani game over.

Najnowszy slice dodaje kolejne warstwy życia sceny: Pieczarka co jakiś czas wierci się albo zamyśla w spokojnych warunkach, śledzi motyle, świetliki i robaczki w trawie, a foreground ma więcej długiej, falującej trawy wyrastającej spod niej. Dekoracje patcha pozostają nad trawą, żeby zakupione przedmioty były widoczne.

Opady foreground są teraz rozłożone po całej szerokości kadru: lekki deszcz, mocny deszcz i śnieg mają deterministyczne pasy po lewej, środku i prawej stronie, więc krople nie skupiają się tylko przy osi Pieczarki.

Najnowszy slice animacji dodaje kierunkowe śledzenie kursora i warianty spokojnej bezczynności. Pieczarka ma osobne sheety `watch_cursor_*`, `follow_cursor_*`, dodatkowe `idle_fidget_*`, `idle_look_*` oraz `ponder_*`; selector immersji wybiera warianty grupami i pamięta ostatni wariant, żeby nie odpalać stale tej samej pozy. Debug/capture potrafią wymusić nowe stany, a testy pokrywają kierunek kursora, szybki przelot i brak natychmiastowego powtarzania idle/ponder.

Deployment assetów dostał tryb folderowy: `PIECZARGOTCHI_ASSET_DRIVE_FOLDER_ID` może wskazywać folder Drive, `AssetService.gs` indeksuje pliki po `fileName` z manifestu, a ręczne wpisy w `PIECZARGOTCHI_ASSET_FILE_IDS` nadal nadpisują pojedyncze wyjątki. Lokalny fallback `assets/...` pozostaje bez zmian.

## Balans Opieki I Kuracja

- `Config.gs` podnosi zapis do wersji `7`; stan ma `history.dailyGrowth`, rozszerzone `attention.pausedUntil` i `attention.quietSuppressed`, `recovery` dla kuracji w mchu oraz terminalny `gameOver`.
- `GameRules.gs` definiuje profil `careRhythm.normal`: noc `22:30-07:00`, karencję do `07:45`, cap offline `24 h` i dzienny limit wzrostu `8.5`.
- `GameRules.gs` definiuje `recovery`: przy zdrowiu `0` startuje kuracja w mchu na kilka godzin, jej koniec wymaga świeżej opieki i stabilnych podstawowych statów, a `maxMissedCare` kończy grę po zbyt długim zaniedbaniu.
- `decayPerHour` ma osobne profile `awake`, `sleeping`, `quietSleeping` i `quietAwake`.
- `ClientCoreCare.html` segmentuje upływ czasu, pauzuje attention w nocy, przesuwa deadline na poranną karencję, obsługuje kurację i formatuje dłuższe cooldowny.
- `ClientState.html` używa segmentów core do naliczania decay, zdrowia, wzrostu i patcha; growth z czasu i akcji respektuje dzienny limit.
- Akcja `Kuracja` (`mossRest`) jest dostępna przy niskim zdrowiu albo w trakcie recovery. Podczas kuracji można dalej zraszać, karmić i czyścić, ale zabawa, muzyka, zarodniki, sen/wake, minigry i arena są zablokowane. Po `gameOver.active` blokowane są wszystkie akcje i UI prowadzi do przycisku `Od nowa`.

## Tempo Gry

- Cooldowny akcji opieki są minutowe, a zarodniki mają cooldown godzinowy.
- Minigry mają cooldowny `25-30 min` i mniejsze, bounded rewards.
- Pogoda jest łagodniejszym modyfikatorem: deszcz pomaga wilgoci, ale nie zastępuje opieki.
- Dekoracje są droższe, żeby gospodarka zarodników nie kończyła się po kilku kliknięciach.
- Ewolucja używa udziału akcji i jakości opieki zamiast bardzo niskich progów absolutnych.

## Walidacja

Nowe testy w `scripts/test-client-core.mjs` obejmują:

- migrację do state v7,
- nocną ochronę attention do końca porannej karencji,
- segmentację czasu na noc i dzień,
- start, przedłużenie, zakończenie i terminalny game over kuracji w mchu,
- blokady akcji podczas kuracji i możliwość dalszej podstawowej opieki,
- zaktualizowaną karę za missed attention,
- utrzymanie wariantów ewolucji po zmianie algorytmu.
- wybór reakcji immersyjnych i blokowanie ich przez potrzeby opieki,
- mapowanie deszczu, śniegu, słońca i gwiazd na dedykowane stany animacji.
- reakcje na ambient life oraz spokojne idle fidget/ponder bez wyprzedzania pogody i pilnych potrzeb.
- rozkład foreground rain/snow po lewej, środku i prawej stronie dla drizzle/light/moderate/heavy/violent oraz stylów śniegu.
- kierunkowe reakcje na kursor, szybki przelot kursora, follow-after oraz brak powtórki ostatniego wariantu idle/ponder.
- deployment checker pilnuje, że tryb folderowy Drive nie używa URL-a, whitespace ani placeholdera.

Pełna bramka QA dla tego slice'a pozostaje:

```sh
node scripts/check-client-syntax.mjs
node scripts/check-deployment-readiness.mjs
node scripts/test-client-core.mjs
node scripts/test-asset-service.mjs
env TZ=UTC node scripts/test-client-core.mjs
node scripts/test-weather-precip-motion.mjs
node scripts/validate-assets.mjs
python3 -m py_compile scripts/generate-immersion-assets.py
python3 scripts/audit-sprite-consistency.py
python3 scripts/audit-spore-sprites.py
bash scripts/run-local-linux.sh --check-only --validate-assets
PIECZARGOTCHI_CAPTURE_IMMERSION=1 node scripts/capture-app-render.mjs http://127.0.0.1:8092/ /tmp/pieczargotchi-immersion
```
