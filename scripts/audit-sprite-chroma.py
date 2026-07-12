#!/usr/bin/env python3
"""Audits exterior magenta spill and transparent RGB in runtime sprites."""

from __future__ import annotations

import argparse
import importlib.util
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
BUILDER_PATH = ROOT / "scripts" / "build-imagegen-sprites.py"
RUNTIME_DIRS = ["stages", "activities", "easter-eggs", "effects", "environment"]
@dataclass(frozen=True)
class ChromaReport:
    transparent_rgb_pixels: int
    exterior_spill_pixels: int

    @property
    def clean(self) -> bool:
        return self.transparent_rgb_pixels == 0 and self.exterior_spill_pixels == 0


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="*", type=Path, help="optional PNG paths relative to repository root")
    parser.add_argument("--strict", action="store_true", help="fail on findings; default mode is advisory")
    parser.add_argument(
        "--write",
        action="store_true",
        help="rewrite only explicitly listed files with edge despill and alpha0 RGB normalization",
    )
    args = parser.parse_args()
    if args.write and not args.paths:
        parser.error("--write requires at least one explicit PNG path; bulk rewriting is intentionally disabled")

    paths = resolve_paths(args.paths)
    builder = load_builder() if args.write else None
    findings: list[str] = []
    rewritten = 0

    for path in paths:
        if args.write:
            original = Image.open(path).convert("RGBA")
            cleaned = builder.oczysc_jasny_rdzen_chroma_na_krawedzi(original)
            if cleaned.tobytes() != original.tobytes():
                cleaned.save(path, optimize=True)
                rewritten += 1

        report = analyze_image(Image.open(path).convert("RGBA"))
        if report.clean:
            continue
        detail = (
            f"{path.relative_to(ROOT)}: alpha0-rgb={report.transparent_rgb_pixels}, "
            f"exterior-magenta={report.exterior_spill_pixels}"
        )
        findings.append(detail)
        print(detail)

    mode = "strict" if args.strict else "advisory"
    print(f"Sprite chroma audit ({mode}): {len(paths)} PNG, {len(findings)} findings, {rewritten} rewritten.")
    if args.strict and findings:
        raise SystemExit(1)


def resolve_paths(requested: list[Path]) -> list[Path]:
    if requested:
        paths = [(ROOT / path).resolve() if not path.is_absolute() else path.resolve() for path in requested]
    else:
        paths = sorted(
            path
            for directory in RUNTIME_DIRS
            for path in (ASSETS / directory).rglob("*.png")
        )

    for path in paths:
        if ASSETS.resolve() not in path.parents or path.suffix.lower() != ".png":
            raise ValueError(f"Path outside runtime PNG assets: {path}")
        if not path.exists():
            raise FileNotFoundError(path)
    return sorted(set(paths))


def load_builder():
    spec = importlib.util.spec_from_file_location("pieczargotchi_sprite_builder", BUILDER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot import {BUILDER_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def analyze_image(image: Image.Image) -> ChromaReport:
    rgba = image.convert("RGBA")
    red, green, blue, alpha = rgba.split()
    transparent = alpha.point(lambda value: 255 if value == 0 else 0)
    nonzero_rgb = ImageChops.lighter(ImageChops.lighter(red, green), blue).point(
        lambda value: 255 if value else 0
    )
    transparent_rgb_mask = ImageChops.darker(transparent, nonzero_rgb)
    transparent_rgb = transparent_rgb_mask.histogram()[255]

    alpha_edge = alpha.point(lambda value: 255 if value <= 8 else 0).filter(ImageFilter.MaxFilter(7))
    bright_red = red.point(lambda value: 255 if value >= 230 else 0)
    bright_blue = blue.point(lambda value: 255 if value >= 230 else 0)
    low_green = green.point(lambda value: 255 if value <= 90 else 0)
    balanced_chroma = ImageChops.difference(red, blue).point(lambda value: 255 if value <= 60 else 0)
    opaque = alpha.point(lambda value: 255 if value > 8 else 0)
    spill_mask = ImageChops.darker(alpha_edge, bright_red)
    for constraint in (bright_blue, low_green, balanced_chroma, opaque):
        spill_mask = ImageChops.darker(spill_mask, constraint)
    spill = spill_mask.histogram()[255]
    return ChromaReport(transparent_rgb_pixels=transparent_rgb, exterior_spill_pixels=spill)


if __name__ == "__main__":
    main()
