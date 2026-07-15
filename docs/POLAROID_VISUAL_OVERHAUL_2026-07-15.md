# Journal Polaroid Visual Overhaul

Date: 2026-07-15
Release target: `0.1.60`
State contract: v22, unchanged

## Outcome

Journal keepsakes now use one coherent rendering system for both the album and
the full polaroid. The old three-band CSS approximation is gone. A photo is
considered ready only after the real mushroom atlas and shared raster grass are
both available and visibly composed.

The overhaul covers all catalog scene identifiers, all five growth stages,
desktop and small mobile layouts, keyboard/touch interaction, explicit asset
failure states, and bounded album rendering cost.

## Rendering Contract

The 192x192 logical photo is rendered to a 384x384 modal backing store. Its
depth order is stable:

1. continuous sky palette and subtle texture;
2. one celestial owner, clouds, and background weather;
3. horizon and ground;
4. scene phenomenon and recognizable event props;
5. the captured mushroom body, positioned from tight-atlas layout metadata;
6. shared raster grass with a stage- and subject-aware central clearance;
7. foreground precipitation and restrained film patina.

The renderer registry explicitly covers every `photoScene` emitted by the sky,
environment, calendar, and instrument catalogs. Intentional aliases such as meteor
showers remain shared; non-aliased scenes keep distinct motifs. Recipes that
own the moon or sun suppress the baseline celestial pass so bodies are never
double-drawn.

The mushroom composition does not scale an arbitrary reaction crop as if all
pixels were body art. It preserves the logical body placement represented by
`drawX` and `drawY`, which keeps large reaction marks from shrinking or
shifting spores and other small stages. Grass may cover only the bottom few
pixels of the subject baseline. A procedural grass substitute is a degraded
state, never a successful photo.

## Album And Modal

Discovered entries contain real canvases produced by the same renderer as the
modal. Locked clues live in a separate compact grid with a semantic "Do
odkrycia" heading, so they cannot stretch real polaroid rows. Full-card tilt is
removed; desktop thumbnails retain only a restrained paper variation and lose
it for touch or reduced motion.

The album is deferred until the Polish `Grzybnia` workspace opens. Offscreen canvases
start with a 1x1 backing store and hydrate through `IntersectionObserver` only
near the visible scrollport. This prevents a full discovered catalog from
decoding many atlases and reserving several MiB of canvas memory at app boot.

The modal uses native `dialog`, `figure`, `figcaption`, dynamic canvas text,
named frame-tier copy, a 44x44 close target, and one possible scrolling surface:
the inner sheet. The close control stays fixed outside that surface. Long notes
live under native `details`, whose summary participates in the focus trap.

## Failure And Loading States

- Loading uses a neutral developing-photo treatment instead of fake grass or a
  procedural mushroom.
- Missing mushroom or raster grass reports an explicit degraded/error state.
- `data-photo-state`, subject, grass, raster, scene, and frame diagnostics are
  exposed to local capture QA.
- The album renderer caches/de-duplicates asset work and redraws only connected
  canvases that still belong to the requested discovery.

## Acceptance Evidence

Focused contracts require:

- every catalog scene to have a recipe;
- coherent layer order and single celestial ownership;
- real-layout stage/reaction composition across all five stages;
- raster-grass clearance with no meaningful body occlusion;
- real grass plus subject before `ready`;
- focus access to the details summary;
- deferred/lazy thumbnails and semantic locked-clue structure;
- browser capture to reject blank, repeated, loading, clipped, overlapping, or
  multi-scroll polaroids.

Representative browser QA covers desktop 1194x891, mobile 390x844, and compact
320x568 views, including aurora, dew, instruments, Tea Day, Soil Day, and Space
Week. Asset-failure capture remains part of the journal path.

## Release Notes

This slice changes no save fields and therefore keeps state v22. The visible
build number moves together in `Config.gs`, `package.json`, and the generated
asset inventory. `dist/` remains generated and untracked.
