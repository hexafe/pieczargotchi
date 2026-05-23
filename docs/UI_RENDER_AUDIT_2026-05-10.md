# Audyt UI I Renderingu - 2026-05-10

Zakres: poprawki po screenshotcie aplikacji w widoku desktopowym okolo `1194x891`.

## Poprawione Problemy

- Usunieto gorny tekst `Pikselowa uprawa grzybni` z headera.
- Skrocono etykiety akcji i naprawiono grid przyciskow, zeby panel `Opieka` nie lamal slow po 2-3 litery.
- Usunieto debugowy checkerboard z tla `canvas-wrap`.
- Usunieto kafelkowy wzor rysowany w `drawStageBackground()`.
- Zmniejszono i oczyszczono zarodnik po generator obrazów, bez kwadratowej doniczki i bez magentowych obwodek.
- Zageszczono layout desktopowy: mniejszy canvas, krotsze odstepy, nizsze przyciski i kompaktowy dziennik.

## Walidacja

Uzyte komendy:

```sh
python3 scripts/build-imagegen-sprites.py
node scripts/validate-assets.mjs
python3 scripts/audit-sprite-consistency.py
PIECZARGOTCHI_CAPTURE_VIEWPORT=1 PIECZARGOTCHI_CAPTURE_STAGES=1 PIECZARGOTCHI_CAPTURE_ACTIVITIES=1 node scripts/capture-app-render.mjs http://127.0.0.1:8092/ /tmp/pieczargotchi-ui-final
```

Wyniki:

- `validate-assets`: OK dla `108` PNG.
- `audit-sprite-consistency`: OK, `sleep`, `wake` i `idle` trzymaja rozmiar w każdym etapie.
- test magenty: `exact_ff00ff=0`, `magenta_like_visible=0` dla `108` PNG używane podczas działania.
- screenshot viewportu: `/tmp/pieczargotchi-ui-final-viewport-1194x891.png`.
- layout w capture: panel boczny `374x817`, canvas `572x572`, viewport `1194x891`.
- asercje animacji: wszystkie testowane akcje renderują klucze `stage.activity.action`, np. `spore.activity.hydrate`, `baby.activity.feed`, `young.activity.play`, bez przeskoku na `adult`.

## Pozostawione Świadomie

- Globalne tło strony nadal ma bardzo delikatną kratkę dekoracyjną. Usunięty został checkerboard z obszaru sceny/canvasu, bo to wyglądało jak błąd przezroczystości.
- Efekty cząsteczkowe nadal mają miękkie ostrzeżenia driftu w walidatorze. To jest oczekiwany ruch efektów, nie drift postaci.
