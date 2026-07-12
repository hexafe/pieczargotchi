#!/usr/bin/env python3
"""Reports exact duplicate sprite frames; strict mode gates newly authored art."""

from __future__ import annotations

import argparse
import hashlib
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

from sprite_layout import load_canvas_frames


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
FRAME_SIZE = 512
ASSET_DIRS = ["stages", "activities", "easter-eggs", "effects"]
MIN_UNIQUE_FRAMES = {4: 3, 8: 5, 10: 7, 12: 8, 16: 12}


@dataclass(frozen=True)
class FrameQuality:
    frame_count: int
    unique_frames: int
    adjacent_duplicates: list[tuple[int, int]]
    wrap_duplicate: bool

    @property
    def minimum_unique_frames(self) -> int | None:
        return MIN_UNIQUE_FRAMES.get(self.frame_count)

    @property
    def below_unique_gate(self) -> bool:
        minimum = self.minimum_unique_frames
        return minimum is not None and self.unique_frames < minimum


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--strict",
        action="store_true",
        help="fail on low uniqueness or exact adjacent/wrap duplicates; legacy default is advisory",
    )
    parser.add_argument(
        "--asset",
        action="append",
        help="audit only one asset path relative to assets/ (repeatable)",
    )
    args = parser.parse_args()
    if args.asset:
        paths = []
        for value in args.asset:
            path = (ASSETS / value).resolve()
            if ASSETS.resolve() not in path.parents or not path.exists():
                raise SystemExit(f"Unsupported sprite asset: {value}")
            paths.append(path)
        paths = sorted(set(paths))
    else:
        paths = sorted(
            path
            for directory in ASSET_DIRS
            for path in (ASSETS / directory).rglob("*.png")
        )
    findings: list[str] = []
    decoded_frames = 0
    duplicate_slots = 0

    for path in paths:
        quality = analyze_sheet(path)
        if quality is None:
            continue
        decoded_frames += quality.frame_count
        duplicate_slots += quality.frame_count - quality.unique_frames
        details = describe_findings(quality)
        if not details:
            continue
        findings.extend(details)
        print(f"{path.relative_to(ROOT)}: {'; '.join(details)}")

    duplicate_ratio = duplicate_slots / decoded_frames if decoded_frames else 0
    mode = "strict" if args.strict else "advisory"
    print(
        f"Sprite frame quality ({mode}): {len(paths)} PNG, {decoded_frames} frames, "
        f"{duplicate_slots} duplicate slots ({duplicate_ratio:.1%}), {len(findings)} findings."
    )
    if args.strict and findings:
        raise SystemExit(1)


def analyze_sheet(path: Path) -> FrameQuality | None:
    try:
        frames = load_canvas_frames(path)
    except ValueError:
        return None
    return analyze_frames(frames)


def analyze_frames(frames: list[Image.Image]) -> FrameQuality:
    signatures = [visual_frame_signature(frame) for frame in frames]
    return FrameQuality(
        frame_count=len(frames),
        unique_frames=len(set(signatures)),
        adjacent_duplicates=[
            (index, index + 1)
            for index in range(max(0, len(signatures) - 1))
            if signatures[index] == signatures[index + 1]
        ],
        wrap_duplicate=len(signatures) > 1 and signatures[-1] == signatures[0],
    )


def visual_frame_signature(frame: Image.Image) -> bytes:
    canonical = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    canonical.alpha_composite(frame.convert("RGBA"))
    return hashlib.sha256(canonical.tobytes()).digest()


def describe_findings(quality: FrameQuality) -> list[str]:
    findings: list[str] = []
    if quality.below_unique_gate:
        findings.append(
            f"unique={quality.unique_frames}/{quality.frame_count}, expected>={quality.minimum_unique_frames}"
        )
    if quality.adjacent_duplicates:
        pairs = ",".join(f"{left + 1}-{right + 1}" for left, right in quality.adjacent_duplicates)
        findings.append(f"adjacent={pairs}")
    if quality.wrap_duplicate:
        findings.append(f"wrap={quality.frame_count}-1")
    return findings


if __name__ == "__main__":
    main()
