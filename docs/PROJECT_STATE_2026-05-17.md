# Stan Projektu - 2026-05-17

## Status

Gałąź `codex-weather-sprite-audit` ma teraz wdrożony slice balansu rozgrywki po researchu Tamagotchi i opinii społeczności. Gra przechodzi z krótkiego, sekundowego mikro-loopa na rytm 2-3 krótkich wejść dziennie, z pełną ochroną nocy i wolniejszą drogą do Legendarnej Pieczarki.

Po slice'ie immersji klient ma też aktywną warstwę reakcji środowiskowych: Pieczarka reaguje wizualnie na kursor/tapnięcie, słońce, deszcz, śnieg, gwiazdy i silny wiatr. Reakcje są wizualne, nie modyfikują statystyk i nie przykrywają stanów opieki, kuracji ani game over.

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

Pełna bramka QA dla tego slice'a pozostaje:

```sh
node scripts/check-client-syntax.mjs
node scripts/check-deployment-readiness.mjs
node scripts/test-client-core.mjs
env TZ=UTC node scripts/test-client-core.mjs
node scripts/test-weather-precip-motion.mjs
node scripts/validate-assets.mjs
python3 -m py_compile scripts/generate-immersion-assets.py
python3 scripts/audit-sprite-consistency.py
python3 scripts/audit-spore-sprites.py
bash scripts/run-local-linux.sh --check-only --validate-assets
PIECZARGOTCHI_CAPTURE_IMMERSION=1 node scripts/capture-app-render.mjs http://127.0.0.1:8092/ /tmp/pieczargotchi-immersion
```
