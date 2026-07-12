#!/usr/bin/env python3
"""Validate legacy instrument variant aliases without generating fake artwork."""

from __future__ import annotations

from pathlib import Path

from sprite_layout import load_canvas_frames


ROOT = Path(__file__).resolve().parents[1]
ACTIVITY_DIR = ROOT / "assets" / "activities"
STAGES = ["spore", "baby", "young", "adult", "legendary"]
VARIANTS = ["instrument_bell", "instrument_flute", "instrument_drum", "instrument_rare"]
FRAME_COUNT = 8


def main() -> None:
    for stage in STAGES:
        source = ACTIVITY_DIR / stage / "instrument_sheet.png"
        source_frames = load_canvas_frames(source)
        if len(source_frames) != FRAME_COUNT:
            raise SystemExit(f"{source} has {len(source_frames)} logical frames instead of {FRAME_COUNT}")
        source_signatures = [frame.tobytes() for frame in source_frames]

        for variant in VARIANTS:
            compatibility_path = ACTIVITY_DIR / stage / f"{variant}_sheet.png"
            if compatibility_path.exists() and [
                frame.tobytes() for frame in load_canvas_frames(compatibility_path)
            ] != source_signatures:
                raise SystemExit(
                    f"{compatibility_path} contains distinct art but runtime aliases it to {source}; "
                    "wire intentional variant art through AnimationConfig.gs before publishing it"
                )

    # The source instrument sheet already owns the prop and expression. Runtime
    # aliases variant keys to it without stacking an extra generated prop over the face.
    print("Instrument variant aliases OK: runtime uses one honest shared visual until distinct art exists.")


if __name__ == "__main__":
    main()
