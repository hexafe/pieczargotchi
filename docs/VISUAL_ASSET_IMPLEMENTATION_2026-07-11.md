# Visual Asset Implementation - 2026-07-11

Release target: `0.1.49`

State target: `18`

Delivery targets: Cloudflare static build and Google Apps Script web app

This is the implementation checkpoint for the graphics audit follow-through. It records what is present in the worktree, how the new asset contracts fit together, which focused checks were actually run during the documentation pass, and what still blocks release. It is not a substitute for a terminal green `npm run qa` or browser capture evidence.

## Implemented architecture

### Body-only runtime sprites

Stage, activity, easter-egg, and effect builders still compose logical frames in a `512x512` coordinate system, but character PNGs no longer bake the grass layer into every frame. `scripts/build-imagegen-sprites.py` uses the shared grass mask only to calculate a consistent visible-body baseline, then returns a transparent body-only frame.

This removes the old triple-grass composition: grass inside the character sheet, the raster environment patch, and procedural foreground blades. The care scene now owns one grass system:

- `assets/environment/grass_patch.png` supplies the shared raster base;
- `ClientSceneGround.html` supplies wind-, wetness-, snow-, quality-, and stage-aware procedural detail;
- the center clearing protects the mushroom face and body;
- decorations render before the final light foreground occluder so they remain rooted without disappearing.

### Tight and deduplicated atlases

`scripts/optimize-runtime-sprite-atlases.py` processes the full logical sheets after generation. For each sheet it:

1. computes one alpha-union bounding box across every logical frame;
2. crops all frames to that same box, preserving animation alignment;
3. stores only unique physical frames;
4. writes the optimized horizontal PNG;
5. regenerates `SpriteLayout.gs`.

The runtime contract distinguishes logical animation from physical storage:

| Field | Contract |
| --- | --- |
| `frameCount` | Number of logical animation frames used by timing and selection. |
| `frameWidth`, `frameHeight` | Physical tight-frame dimensions in the PNG. |
| `drawX`, `drawY` | Position of the tight frame in the original logical `512x512` canvas. |
| `pivotX`, `pivotY` | Stable motion pivot derived from the logical placement. |
| `storedFrameCount` | Number of unique physical frames stored in the PNG. |
| `frameSequence` | Logical-frame to physical-frame mapping. |
| `bakedGrass` | `false` for the new body-only runtime sheets. |

`AnimationConfig.gs` exposes this metadata in the runtime manifest. `ClientAnimation.html` and `ClientSprites.html` select the mapped physical frame and draw it at its original size and `drawX`/`drawY`; they do not stretch a tight crop to the full canvas. `scripts/sprite_layout.py` reconstructs full logical frames for Python audits, so QA evaluates the same composition the renderer sees.

`SpriteLayout.gs` is generated output and is included in both Apps Script packaging checks and the Cloudflare static build. It must not be edited manually.

### Arena art and stable visual identity

The arena no longer reuses a grass-backed care-stage sprite or a generic purple opponent. `scripts/generate-battle-assets.py` deterministically produces:

- `assets/battle/arena_background.png` - one `512x512` fighting plane;
- `assets/battle/player_legendary_sheet.png` - `playerLegendary`;
- `assets/battle/opponents/sproutling_sheet.png` - `sproutling`;
- `assets/battle/opponents/windcap_sheet.png` - `windcap`;
- `assets/battle/opponents/eldercap_sheet.png` - `eldercap`.

Each fighter sheet is RGBA `1024x256`: four body-only `256x256` poses ordered as `idle`, `attack`, `guard`, and `hurt`. Transparent pixels must have zero RGB, and the lower band must remain free of baked grass.

`GameRules.gs` assigns one stable `visualId` to each opponent tier. `ClientCoreBattle.html` carries that identity through opponent creation and active-battle normalization, while `ClientBattleScene.html` maps it to a manifest key, selects the four pose frames, and warms the arena plus all fighter assets. Legacy active opponents without `visualId` are inferred from the saved Polish opponent name.

State v18 is the release boundary for this persisted visual identity contract. The migration must preserve v17 care, progress, inventory, journal, minigame, and battle data while normalizing `player.visualId` and `opponent.visualId`.

### Source provenance

`assets/source/imagegen/PROVENANCE.json` records three collections:

- legacy image-generator atlases, whose exact historical model/date remain explicitly unknown;
- runtime sprite v2, a deterministic rebuild from curated source cutouts followed by tight-atlas optimization;
- battle body-only v1, a deterministic derivative of curated idle cutouts.

Generated runtime PNGs do not pretend to have been created by a new model invocation. Their provenance points to the builder, postprocess, and source collection. Any future image-generation pass must add or update provenance before its derived PNGs are accepted.

## Rebuild contract

Run from the repository root:

```sh
python3 scripts/build-imagegen-sprites.py
python3 scripts/generate-immersion-assets.py
python3 scripts/optimize-runtime-sprite-atlases.py
python3 scripts/generate-battle-assets.py
```

The order matters. The first two commands create full logical sheets; the optimizer replaces them with tight/dedup atlases and regenerates `SpriteLayout.gs`. The battle generator owns its separate 256px contract.

Do not run the full-sheet builder and commit its output without running the optimizer. Do not hand-edit a tight PNG as if it were a full `512x512` frame. Do not reintroduce root-level activity copies or fake instrument variants; the gameplay keys intentionally alias the real per-stage `instrument_sheet.png` until distinct art exists.

## Verification completed on 2026-07-11

The integrated worktree has the following green deterministic evidence:

- `python3 scripts/optimize-runtime-sprite-atlases.py --check` - 225 PNGs, 515.4 MiB decoded footprint, 1,289 stored frames for 1,560 logical frames, and 17.4% physical-frame deduplication;
- `python3 scripts/generate-battle-assets.py --check` - the arena background and four fighter sheets reproduce from the curated source cutouts;
- `node scripts/validate-assets.mjs` - 225 animation sheets, one environment asset, five additional assets, and all 251 runtime-manifest entries pass;
- `python3 scripts/audit-sprite-chroma.py --strict` - 226 PNGs, zero findings, zero rewrites;
- `python3 scripts/audit-sprite-consistency.py`, `audit-spore-sprites.py`, `audit-activity-sprite-motion.py`, and `audit-glint-sprites.py` - stage/body alignment, spore proportions, visible activity motion, and glint-shape contracts pass;
- animation render/timing, battle visual, condition overlay, journal polaroid, scene composition, grass, weather, palette, celestial, runtime, persistence, asset-service, state-migration, minigame-balance, Polish-copy, and Cloudflare static-build tests pass;
- core gameplay tests pass in the local timezone, `TZ=UTC`, and `TZ=Europe/Warsaw`, including the v17-to-v18 active-battle migration;
- `python3 scripts/audit-sprite-frame-quality.py` completes in advisory mode with 104 findings and 271 duplicate logical slots out of 1,560;
- `git diff --check` is clean.

Bright edge-connected chroma cleanup is now part of the deterministic builder/optimizer path. It preserves intentional interior purple art and avoids a separate list of hand-edited runtime PNGs.

Visual inspection also caught a real QA-path regression: the local preview rendered two or three complete tight-atlas frames across the top of the care canvas. The production Cloudflare builder already loaded `SpriteLayout.gs`, but `dev-server.mjs` did not, so its generated config silently fell back to legacy `512x512` baked-grass metadata while serving the new cropped PNGs. The server now loads `SpriteLayout.gs`; a pure local-preview test checks all animation/asset mappings without opening a port, its security/config test asserts the critical served layout contract, and every browser capture verifies the active image's natural dimensions against `frameWidth`, `frameHeight`, and `storedFrameCount` before accepting a screenshot.

The invalid care-scene captures are not release evidence. A fresh browser smoke and desktop/mobile stage, activity, immersion, journal, weather, and Arena capture pass must still be recorded after the preview fix. The final local `npm run qa` also remains pending because the current sandbox denied the git-spawning deployment check and a new local server/Chromium session. No external Apps Script gate or deployment has been performed.

## Release closeout for 0.1.49 / state v18

Before deployment:

1. Rerun `node scripts/test-dev-server-security.mjs` and `npm run qa` outside the restricted sandbox to terminal success.
2. Capture the stage/activity/immersion/weather matrix plus journal and desktop/390x844 Arena views through the corrected local preview. Confirm one correctly placed mushroom, no stretching, grass wall, chroma fringe, loading silhouette, or mobile dock collision.
3. Review the 104 advisory frame-quality findings in motion; improve art only where a repeated logical frame reads as unintended stillness. The current high-priority review targets are spore feed/instrument holds and weak gaze changes.
4. Publish assets under the immutable `/releases/0.1.49/assets/` path.
5. Configure `PIECZARGOTCHI_ASSET_BASE_URL_0_1_49` for the Apps Script test deployment and run `npm run qa:apps-script-release` against the public `/exec` URL.

The release is complete only when these steps are evidenced. The presence of generated assets or focused green contracts alone is not a release certificate.
