# Audyt Sprite'ów - 2026-05-10

Zakres: sprawdzenie rozjazdu skali między snem, przebudzeniem i stanem czuwania oraz kontrola położenia twarzy w realnym renderingu aplikacji.

## Objaw

- Wcześniejsza wersja mieszała założenia etapów: raz startem miał być `Maluch`, raz `Zarodnik`.
- Po decyzji produktowej startem gry ma być `Zarodnik`, a kolejne etapy mają mieć inne sylwetki bez skalowania całej sceny.
- Generator rysował oczy i usta stałym rozmiarem, więc mały etap dostawał twarz o proporcjach większej Pieczarki.
- Efekt w appce: sen wyglądał jak mała forma, a po obudzeniu twarz wyglądała jak doklejona lub z innego sprite'a.

## Weryfikacja Przed Poprawką

Użyte komendy:

```sh
node scripts/validate-assets.mjs
node scripts/capture-app-render.mjs http://127.0.0.1:8091/ /tmp/pieczargotchi-before-canvas
```

Wynik:

- walidacja PNG przechodziła, ale była zbyt ogólna dla problemu skali,
- canvas `wake` i `awake` pokazywały za duże oczy względem małej sylwetki.

## Poprawki

- `GameRules.gs`: `growth: 0` pokazuje `Zarodnik`, `growth: 12` pokazuje `Maluch`, dalej `Młoda`, `Dorosła` i `Legendarna`.
- `StateModel.gs`: domyślny etap nowej gry to `spore`.
- `scripts/generate-pixel-assets.py`: pozycja twarzy jest liczona z realnego bounding boxa źródłowego sprite'a, skali etapu i pozycji w kadrze.
- `scripts/generate-pixel-assets.py`: elementy twarzy mają `faceScale`, więc `Zarodnik` nie dostaje oczu w rozmiarze `Malucha`.
- `scripts/generate-pixel-assets.py`: generator składa wspólną warstwę trawy z osobną sylwetką etapu, zamiast skalować całą scenę.
- zasoby zostały ponownie wygenerowane.
- Dodano `scripts/audit-sprite-consistency.py`, który mierzy rozmiar, środek i dryf klatek dla `sleep`, `wake` i `idle`.

## Weryfikacja Po Poprawce

Użyte komendy:

```sh
python3 -m py_compile scripts/generate-pixel-assets.py
python3 scripts/generate-pixel-assets.py
node scripts/validate-assets.mjs
python3 scripts/audit-sprite-consistency.py
node scripts/capture-app-render.mjs http://127.0.0.1:8091/ /tmp/pieczargotchi-after-canvas
```

Wynik:

- `validate-assets` przechodzi dla 68 PNG,
- składnia klienta, Apps Script i dev-servera przechodzi,
- `sleep`, `wake` i `awake` w appce mają teraz ten sam etap i tę samą skalę startową,
- capture etapów potwierdza osobne sylwetki: `spore`, `baby`, `young`, `adult`, `legendary`,
- twarz `wake` i `awake` siedzi na sylwetce aktywnego etapu, bez przesunięcia względem sprite'a.

## Pozostałe Drobne Ryzyka

- Walidator nadal wypisuje miękkie ostrzeżenia o celowym ruchu cząstek i kilku mocniejszych animacjach (`critical`, `wake`, `sick`, efekty).
- To nie blokuje obecnego renderingu, ale przy ręcznym dopieszczaniu zasobów warto zmniejszyć drift w `critical` i `sleep`.
