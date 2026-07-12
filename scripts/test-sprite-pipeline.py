#!/usr/bin/env python3
"""Focused deterministic contracts for the sprite pipeline v2 helpers."""

from __future__ import annotations

import importlib.util
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    builder = load_module("sprite_builder", ROOT / "scripts" / "build-imagegen-sprites.py")
    consistency = load_module("sprite_consistency", ROOT / "scripts" / "audit-sprite-consistency.py")
    frame_quality = load_module("sprite_frame_quality", ROOT / "scripts" / "audit-sprite-frame-quality.py")
    sprite_layout = load_module("sprite_layout_contract", ROOT / "scripts" / "sprite_layout.py")

    test_body_bottom_offset(builder)
    test_optional_authored_sequence(builder)
    test_edge_connected_chroma_cleanup(builder)
    test_unique_frame_contract(frame_quality)
    test_relative_gaze_anchor(consistency)
    test_external_legacy_sheet(sprite_layout)
    print("Sprite pipeline contracts OK.")


def test_body_bottom_offset(builder) -> None:
    original = builder.znajdz_bbox_korpusu_postaci
    builder.znajdz_bbox_korpusu_postaci = lambda _image, _stage: (2, 3, 12, 23)
    try:
        _x, y = builder.policz_pozycje_postaci(Image.new("RGBA", (20, 30)), "adult", (3, 7), 100)
    finally:
        builder.znajdz_bbox_korpusu_postaci = original
    assert_equal(y, 84, "body_bottom_target must retain offsetY")


def test_optional_authored_sequence(builder) -> None:
    original_raw = builder.RAW_DIR
    with tempfile.TemporaryDirectory() as temporary:
        builder.RAW_DIR = Path(temporary)
        try:
            assert_equal(
                builder.znajdz_sciezki_klatkowych_atlasow("states", "idle", 4),
                None,
                "missing authored state should use fallback",
            )
            state_dir = builder.RAW_DIR / "states" / "idle"
            state_dir.mkdir(parents=True)
            (state_dir / "frame_01_atlas.png").touch()
            try:
                builder.znajdz_sciezki_klatkowych_atlasow("states", "idle", 4)
            except FileNotFoundError:
                pass
            else:
                raise AssertionError("partial authored state must not silently mix with fallback")
            for index in range(2, 5):
                (state_dir / f"frame_{index:02d}_atlas.png").touch()
            paths = builder.znajdz_sciezki_klatkowych_atlasow("states", "idle", 4)
            assert_equal(len(paths or []), 4, "complete authored state should be selected")
        finally:
            builder.RAW_DIR = original_raw


def test_edge_connected_chroma_cleanup(builder) -> None:
    source = Image.new("RGBA", (20, 20), (255, 0, 255, 255))
    draw = ImageDraw.Draw(source)
    draw.rectangle((5, 5, 14, 14), fill=(92, 144, 74, 255))
    source.putpixel((5, 10), (184, 18, 158, 255))
    source.putpixel((10, 10), (184, 18, 158, 255))
    cleaned = builder.usun_chroma_key(source)

    assert_equal(cleaned.getpixel((0, 0)), (0, 0, 0, 0), "border matte should become normalized transparency")
    assert cleaned.getpixel((5, 10))[:3] != (184, 18, 158), "exterior fringe should be despilled"
    assert_equal(cleaned.getpixel((10, 10))[:3], (184, 18, 158), "interior intentional purple should survive")

    transparent = Image.new("RGBA", (4, 4), (255, 0, 255, 0))
    normalized = builder.oczysc_przezroczyste_krawedzie(transparent)
    assert all(pixel == (0, 0, 0, 0) for pixel in normalized.get_flattened_data()), "alpha0 RGB must be zero"

    bright_core = Image.new("RGBA", (15, 15), (0, 0, 0, 0))
    bright_draw = ImageDraw.Draw(bright_core)
    bright_draw.rectangle((4, 4, 10, 10), fill=(105, 60, 130, 255))
    bright_core.putpixel((4, 7), (255, 0, 255, 255))
    bright_core.putpixel((7, 7), (255, 0, 255, 255))
    sanitized = builder.oczysc_jasny_rdzen_chroma_na_krawedzi(bright_core)
    assert sanitized.getpixel((4, 7))[:3] != (255, 0, 255), "bright edge core should be despilled"
    assert_equal(sanitized.getpixel((7, 7))[:3], (255, 0, 255), "protected interior magenta should survive")
    assert_equal(sanitized.getpixel((4, 4))[:3], (105, 60, 130), "plum outline should remain unchanged")


def test_unique_frame_contract(frame_quality) -> None:
    colors = [(index * 17, index * 11, index * 7, 255) for index in range(5)]
    frames = [Image.new("RGBA", (4, 4), colors[index]) for index in [0, 1, 1, 2, 3, 4, 4, 0]]
    report = frame_quality.analyze_frames(frames)
    assert_equal(report.unique_frames, 5, "8-frame v2 gate should count exact decoded frames")
    assert_equal(report.adjacent_duplicates, [(1, 2), (5, 6)], "adjacent duplicates should be reported")
    assert report.wrap_duplicate, "last-to-first duplicate should be reported"
    assert not report.below_unique_gate, "5/8 unique frames should satisfy the v2 minimum"

    hidden_red = Image.new("RGBA", (2, 2), (255, 0, 0, 0))
    hidden_blue = Image.new("RGBA", (2, 2), (0, 0, 255, 0))
    hidden_report = frame_quality.analyze_frames([hidden_red, hidden_blue])
    assert_equal(hidden_report.unique_frames, 1, "transparent RGB must not fake visual uniqueness")


def test_relative_gaze_anchor(consistency) -> None:
    class BboxBuilder:
        @staticmethod
        def znajdz_bbox_widocznego_korpusu_w_kadrze(frame):
            return frame.getchannel("A").getbbox()

    with tempfile.TemporaryDirectory() as temporary:
        idle_path = Path(temporary) / "idle.png"
        shifted_path = Path(temporary) / "shifted.png"
        make_eye_fixture(0).save(idle_path)
        make_eye_fixture(2).save(shifted_path)
        idle = consistency.read_relative_eye_centers(idle_path, "adult", BboxBuilder())
        shifted = consistency.read_relative_eye_centers(shifted_path, "adult", BboxBuilder())
        assert_equal(len(idle), 2, "fixture should expose both eyes")
        for idle_eye, shifted_eye in zip(idle, shifted):
            assert abs(idle_eye[0] - shifted_eye[0]) < 0.01
            assert abs(idle_eye[1] - shifted_eye[1]) < 0.01


def make_eye_fixture(dx: int) -> Image.Image:
    image = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rectangle((170 + dx, 250, 340 + dx, 450), fill=(210, 184, 132, 255))
    draw.rectangle((204 + dx, 298, 214 + dx, 308), fill=(32, 30, 28, 255))
    draw.rectangle((292 + dx, 298, 302 + dx, 308), fill=(32, 30, 28, 255))
    return image


def test_external_legacy_sheet(sprite_layout) -> None:
    with tempfile.TemporaryDirectory() as temporary:
        fixture_path = Path(temporary) / "legacy_sheet.png"
        sheet = Image.new("RGBA", (1024, 512), (0, 0, 0, 0))
        ImageDraw.Draw(sheet).rectangle((32, 40, 96, 120), fill=(220, 170, 90, 255))
        ImageDraw.Draw(sheet).rectangle((512 + 48, 56, 512 + 112, 136), fill=(90, 160, 220, 255))
        sheet.save(fixture_path)

        assert_equal(sprite_layout.asset_key(fixture_path), None, "external fixture must not get a runtime layout key")
        frames = sprite_layout.load_canvas_frames(fixture_path)
        assert_equal(len(frames), 2, "external full-frame fixture should use the legacy frame contract")
        assert_equal(frames[0].size, (512, 512), "legacy fixture frame should retain canvas dimensions")
        assert_equal(frames[0].getpixel((64, 80)), (220, 170, 90, 255), "first legacy frame should be reconstructed")
        assert_equal(frames[1].getpixel((80, 96)), (90, 160, 220, 255), "second legacy frame should be reconstructed")


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot import {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def assert_equal(actual, expected, message: str) -> None:
    if actual != expected:
        raise AssertionError(f"{message}: expected {expected!r}, got {actual!r}")


if __name__ == "__main__":
    main()
