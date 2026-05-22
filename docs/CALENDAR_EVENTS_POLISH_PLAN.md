# Calendar Events Polish Plan

Build slice: `0.1.4`

## Implemented Baseline

The game now has a deterministic `Święta świata` calendar layer:

- fixed-date and seasonal event catalog in `ClientCoreCalendar.html`;
- `discoveries.calendar` in save-state normalization and world journal rendering;
- purchasable `Kalendarz grzybni` decoration for 12 spores;
- checklist UI in `Dziennik świata`, unlocked by owning the calendar decoration;
- subtle canvas accents for selected active events;
- static build and core tests covering calendar dates, journal integration, and unlock behavior.

The dates are intentionally local-date based, matching the existing daily rhythm logic rather than UTC cutovers.

## Source Anchors

Use these as the canonical baseline before adding more event dates:

- UN International Tea Day: 21 May, https://www.un.org/en/observances/tea-day
- UN World Bee Day: 20 May, https://www.un.org/en/observances/bee-day
- UNESCO/CBD International Day for Biological Diversity: 22 May, https://www.unesco.org/en/days/biological-diversity-day and https://www.cbd.int/idb/default.shtml
- UN World Wildlife Day: 3 March, https://www.un.org/en/observances/world-wildlife-day/background
- UNEP International Day of Forests: 21 March, https://www.unep.org/events/un-day/international-day-forests
- UN-Water World Water Day: 22 March, https://www.unwater.org/our-work/world-water-day
- UN International Mother Earth Day: 22 April, https://www.un.org/en/observances/earth-day/background
- UNEP/UN World Migratory Bird Day: second Saturdays of May and October, https://www.un.org/en/observances/world-migratory-bird-day and https://www.unep.org/events/un-day/world-migratory-bird-day
- UN International Asteroid Day: 30 June, https://www.un.org/en/observances/asteroid-day
- UN International Moon Day: 20 July, https://www.un.org/en/observances/international-moon-day
- UN World Space Week: 4-10 October, https://www.un.org/en/observances/world-space-week-0
- FAO World Soil Day: 5 December, https://www.fao.org/world-soil-day/en/

`Dzień Grzyba` is deliberately marked as an informal game-flavored event for 15 October, so it can be adjusted later if we choose a different Polish or international mushroom observance.

## Sprite And Animation Roadmap

### Tea Day

- Special idle sheet for each stage: mushroom with tiny cup, steam drifting in 6-8 frames.
- Activity variant: calm sip, happy blush, steam briefly forming a heart or spore swirl.
- Polaroid variant: mushroom looking peaceful with cup near grass.

### World Bee Day

- Bee-specific flowers in foreground grass, with bees landing, wiggling, and leaving.
- Rare bee visit discovery: a larger solitary bee appears once, pauses near flower, then exits.
- Stage reaction sheet: curious/happy mushroom tracking a bee near the cap.

### Biodiversity Day

- Multi-layer grass flourish: tiny leaves, petals, crawler silhouettes, fireflies/moths depending on hour.
- Special "living patch" animation: grass foreground gently parts and closes around the mushroom base.
- Polaroid variant: mushroom wide-eyed, surrounded by different small life forms.

### Water Day

- More visible dew and droplet glints on grass, with tiny runoff near the cap if the mushroom was hydrated.
- Special hydrate action bonus animation: drops fall slower and bead on the cap before sliding off.

### Forest Day / Earth Day / Soil Day

- Forest Day: drifting leaf motes and a darker, cooler green palette accent.
- Earth Day: soft ground pulse around the patch, no loud particles.
- Soil Day: mycelium threads glowing under foreground grass, visible only in short pulses.

### Space Events

- Asteroid Day: one rare slow asteroid silhouette at dusk/night, not a constant meteor shower.
- Moon Day: silver grass rim light and a more prominent moon halo if weather allows.
- Space Week: tiny observatory/telescope prop as a rare calendar-shop item.
- Perseid Nights: richer meteor shower logic tied into existing sky discoveries, not duplicate spam.

### Mushroom Day

- Full celebration sheet for each growth stage: proud cap pose, spore confetti, tiny polish/glint animation.
- Rare one-day cosmetic: "świąteczny kapelusz" palette accent, optional and non-permanent.
- Log text variants using the chosen mushroom name.

## Gameplay Tuning Ideas

- Calendar ownership could add a tiny discovery bonus: one extra clue in locked journal cards, but no daily chore pressure.
- First time seeing an event can grant a small spore reward only once per event, capped to avoid farming yearly reloads.
- Event reminders should appear in return recap if the player missed a calendar day, but never punish absence.
- Calendar checklist completion tiers could unlock decorative frames for polaroids instead of stat power.
- Some events should require the right local scene conditions for the special effect, while the checklist still marks the date.

## Asset Generation Queue

1. Tea Day cup and steam sheets for `spore`, `baby`, `young`, `adult`, `legendary`.
2. Bee landing loop and flower interaction sprites.
3. Biodiversity foreground overlays: leaf motes, petal glints, tiny crawler silhouettes.
4. Soil/mycelium undergrass pulse overlay.
5. Mushroom Day stage celebration sheets.
6. Calendar-specific polaroid scenes, one per event family.

## QA Gates For Next Iteration

- Add browser capture mode for forced `PIECZARGOTCHI_DEBUG_CALENDAR_EVENT=<id>`.
- Capture at least Tea Day, Bee Day, Biodiversity Day, Soil Day, Space Week.
- Confirm calendar checklist remains unlocked after buying more than three decorations.
- Confirm active event discovery logs only once per event, while yearly count increments.
- Confirm mobile side panel can scroll checklist without clipping minigames or decorations.
