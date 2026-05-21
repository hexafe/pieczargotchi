#!/usr/bin/env python3
"""Audit stage-specific activity sheets for non-static sprite motion."""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageChops


ROOT = Path(__file__).resolve().parents[1]
ANIMATION_CONFIG = ROOT / "AnimationConfig.gs"
ACTIVITIES_DIR = ROOT / "assets" / "activities"
STAGES_DIR = ROOT / "assets" / "stages"

EXPECTED_STAGES = ["spore", "baby", "young", "adult", "legendary"]
EXPECTED_ACTIVITIES = ["hydrate", "feed", "clean", "play", "instrument", "sing", "spores", "harvest"]
DEFAULT_FRAME_SIZE = 512

VISIBLE_ALPHA_THRESHOLD = 8
PIXEL_DIFF_THRESHOLD = 8
MIN_ADJACENT_CHANGED_PIXELS = 96
MIN_ADJACENT_CHANNEL_DELTA = 80_000
SPORE_SLEEP_EDGE_GUARD_PX = 12
MAX_SPORE_SLEEP_EDGE_PIXELS = 96
MAX_SPORE_BRIGHT_RUN_PX = 120
MAX_SPORE_CORE_BBOX_DRIFT_PX = 10.0
MIN_SPORE_ACTIVITY_DURATION_MS = 1800
MAX_SPORE_ACTIVITY_DURATION_MS = 2600
SPORE_CORE_ACTIVITIES = {"hydrate", "feed", "clean", "play", "instrument", "sing"}


@dataclass(frozen=True)
class ActivityTiming:
    frame_durations_ms: list[int]
    loop: bool

    @property
    def total_ms(self) -> int:
        return sum(self.frame_durations_ms)


@dataclass(frozen=True)
class AnimationConfig:
    frame_size: int
    stages: list[str]
    activity_frame_counts: dict[str, int]
    spore_activity_timings: dict[str, ActivityTiming]
    stage_frame_counts: dict[str, int]
    warnings: list[str]


@dataclass(frozen=True)
class MotionReport:
    changed_pixels: list[int]
    channel_deltas: list[int]
    alpha_mass_drift: float
    bbox_center_drift: float

    @property
    def max_changed_pixels(self) -> int:
        return max(self.changed_pixels, default=0)

    @property
    def max_channel_delta(self) -> int:
        return max(self.channel_deltas, default=0)

    @property
    def effectively_static(self) -> bool:
        return (
            self.max_changed_pixels < MIN_ADJACENT_CHANGED_PIXELS
            and self.max_channel_delta < MIN_ADJACENT_CHANNEL_DELTA
        )


@dataclass(frozen=True)
class BrightRun:
    frame_index: int
    y: int
    x_start: int
    x_end: int

    @property
    def length(self) -> int:
        return self.x_end - self.x_start + 1


def main() -> None:
    config = read_animation_config()
    failures: list[str] = []

    print("[activity sprite motion audit]")
    print(f"config={ANIMATION_CONFIG.relative_to(ROOT)} frame={config.frame_size}px")
    for warning in config.warnings:
        print(f"warning: {warning}")

    validate_config(config, failures)

    for stage in EXPECTED_STAGES:
        print(f"\n[{stage}]")
        for activity in EXPECTED_ACTIVITIES:
            frame_count = config.activity_frame_counts.get(activity, 4)
            path = ACTIVITIES_DIR / stage / f"{activity}_sheet.png"
            audit_activity_sheet(path, stage, activity, frame_count, config.frame_size, failures)

    audit_spore_sleep_split(config, failures)

    if failures:
        print("\nActivity sprite motion audit found problems:")
        for failure in failures:
            print(f"- {failure}")
        raise SystemExit(1)

    print("\nActivity sprite motion audit OK: activity sheets have valid dimensions and visible frame-to-frame motion.")


def read_animation_config() -> AnimationConfig:
    warnings: list[str] = []
    try:
        text = ANIMATION_CONFIG.read_text(encoding="utf-8")
    except OSError as exc:
        return AnimationConfig(
            frame_size=DEFAULT_FRAME_SIZE,
            stages=EXPECTED_STAGES[:],
            activity_frame_counts={activity: 4 for activity in EXPECTED_ACTIVITIES},
            spore_activity_timings={},
            stage_frame_counts={"sleep": 4},
            warnings=[f"could not read AnimationConfig.gs ({exc}); using fallback frame contract"],
        )

    frame_size = parse_int_const(text, "PIECZARGOTCHI_ANIMATION_DEFAULT_CANVAS_SIZE")
    if frame_size is None:
        frame_size = DEFAULT_FRAME_SIZE
        warnings.append("could not parse PIECZARGOTCHI_ANIMATION_DEFAULT_CANVAS_SIZE; using 512")

    stages = parse_string_list_const(text, "PIECZARGOTCHI_ANIMATION_STAGES")
    if not stages:
        stages = EXPECTED_STAGES[:]
        warnings.append("could not parse PIECZARGOTCHI_ANIMATION_STAGES; using expected stage list")

    activity_frame_counts = parse_animation_frame_counts(text, "PIECZARGOTCHI_ACTIVITY_ANIMATIONS", "activity")
    if not activity_frame_counts:
        activity_frame_counts = {activity: 4 for activity in EXPECTED_ACTIVITIES}
        warnings.append("could not parse PIECZARGOTCHI_ACTIVITY_ANIMATIONS; using 4 frames per activity")

    spore_activity_timings = parse_spore_activity_timings(text)
    if not spore_activity_timings:
        warnings.append("could not parse spore activity timing overrides")

    stage_frame_counts = parse_animation_frame_counts(text, "PIECZARGOTCHI_STAGE_ANIMATIONS", "state")
    if not stage_frame_counts:
        stage_frame_counts = {"sleep": 4}
        warnings.append("could not parse PIECZARGOTCHI_STAGE_ANIMATIONS; using 4 sleep frames")

    return AnimationConfig(
        frame_size=frame_size,
        stages=stages,
        activity_frame_counts=activity_frame_counts,
        spore_activity_timings=spore_activity_timings,
        stage_frame_counts=stage_frame_counts,
        warnings=warnings,
    )


def parse_int_const(text: str, name: str) -> int | None:
    match = re.search(rf"const\s+{re.escape(name)}\s*=\s*(\d+)\s*;", text)
    return int(match.group(1)) if match else None


def parse_string_list_const(text: str, name: str) -> list[str]:
    match = re.search(rf"const\s+{re.escape(name)}\s*=\s*\[(.*?)\]\s*;", text, flags=re.S)
    if not match:
        return []
    return re.findall(r"'([^']+)'", match.group(1))


def parse_animation_frame_counts(text: str, array_name: str, key_name: str) -> dict[str, int]:
    section = extract_js_array(text, array_name)
    if not section:
        return {}

    frame_counts: dict[str, int] = {}
    for block in iter_js_object_blocks(section):
        key_match = re.search(rf"{re.escape(key_name)}\s*:\s*'([^']+)'", block)
        frame_match = re.search(r"frameCount\s*:\s*(\d+)", block)
        if not key_match or not frame_match:
            continue
        frame_counts[key_match.group(1)] = int(frame_match.group(1))

    return frame_counts


def parse_spore_activity_timings(text: str) -> dict[str, ActivityTiming]:
    section = extract_js_array(text, "PIECZARGOTCHI_ACTIVITY_ANIMATIONS")
    if not section:
        return {}

    timings: dict[str, ActivityTiming] = {}
    for block in iter_js_object_blocks(section):
        key_match = re.search(r"activity\s*:\s*'([^']+)'", block)
        if not key_match:
            continue

        activity = key_match.group(1)
        durations = parse_number_list_property(block, "frameDurationsMs")
        loop = parse_bool_property(block, "loop")
        stage_overrides = extract_js_object_property(block, "stageOverrides")
        spore_override = extract_js_object_property(stage_overrides, "spore") if stage_overrides else ""
        if spore_override:
            durations = parse_number_list_property(spore_override, "frameDurationsMs") or durations
            override_loop = parse_bool_property(spore_override, "loop")
            if override_loop is not None:
                loop = override_loop

        if durations and loop is not None:
            timings[activity] = ActivityTiming(frame_durations_ms=durations, loop=loop)

    return timings


def parse_number_list_property(text: str, name: str) -> list[int]:
    match = re.search(rf"{re.escape(name)}\s*:\s*\[(.*?)\]", text, flags=re.S)
    if not match:
        return []
    return [int(value) for value in re.findall(r"\d+", match.group(1))]


def parse_bool_property(text: str, name: str) -> bool | None:
    match = re.search(rf"{re.escape(name)}\s*:\s*(true|false)", text)
    if not match:
        return None
    return match.group(1) == "true"


def extract_js_object_property(text: str, name: str) -> str:
    match = re.search(rf"{re.escape(name)}\s*:\s*\{{", text)
    if not match:
        return ""
    start = match.end() - 1
    end = find_matching_brace(text, start)
    return text[start + 1:end] if end is not None else ""


def iter_js_object_blocks(section: str) -> list[str]:
    blocks: list[str] = []
    depth = 0
    start: int | None = None
    in_string = False
    escape = False

    for index, char in enumerate(section):
        if in_string:
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == "'":
                in_string = False
            continue

        if char == "'":
            in_string = True
        elif char == "{":
            if depth == 0:
                start = index + 1
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0 and start is not None:
                blocks.append(section[start:index])
                start = None

    return blocks


def find_matching_brace(text: str, start: int) -> int | None:
    depth = 0
    in_string = False
    escape = False

    for index in range(start, len(text)):
        char = text[index]
        if in_string:
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == "'":
                in_string = False
            continue

        if char == "'":
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return index

    return None


def extract_js_array(text: str, name: str) -> str:
    match = re.search(rf"const\s+{re.escape(name)}\s*=\s*\[(.*?)\]\s*;", text, flags=re.S)
    return match.group(1) if match else ""


def validate_config(config: AnimationConfig, failures: list[str]) -> None:
    missing_stages = [stage for stage in EXPECTED_STAGES if stage not in config.stages]
    if missing_stages:
        failures.append(f"AnimationConfig.gs is missing expected stages: {', '.join(missing_stages)}")

    missing_activities = [
        activity for activity in EXPECTED_ACTIVITIES if activity not in config.activity_frame_counts
    ]
    if missing_activities:
        failures.append(f"AnimationConfig.gs is missing expected activity animations: {', '.join(missing_activities)}")

    for activity in EXPECTED_ACTIVITIES:
        timing = config.spore_activity_timings.get(activity)
        if timing is None:
            failures.append(f"AnimationConfig.gs is missing spore timing data for activity.{activity}")
            continue
        if timing.loop:
            failures.append(f"spore.activity.{activity}: should be one-shot/hold, not looped")
        if not (MIN_SPORE_ACTIVITY_DURATION_MS <= timing.total_ms <= MAX_SPORE_ACTIVITY_DURATION_MS):
            failures.append(
                f"spore.activity.{activity}: timing total is {timing.total_ms}ms, expected "
                f"{MIN_SPORE_ACTIVITY_DURATION_MS}-{MAX_SPORE_ACTIVITY_DURATION_MS}ms"
            )


def audit_activity_sheet(
    path: Path,
    stage: str,
    activity: str,
    frame_count: int,
    frame_size: int,
    failures: list[str],
) -> None:
    label = f"{stage}.activity.{activity}"
    if not path.exists():
        failures.append(f"{label}: missing {path.relative_to(ROOT)}")
        print(f"{activity:10s} missing")
        return

    image = Image.open(path)
    expected_size = (frame_count * frame_size, frame_size)
    size_ok = image.size == expected_size
    mode_ok = image.mode == "RGBA"
    actual_frame_count = image.width // frame_size if image.height == frame_size and image.width % frame_size == 0 else 0

    if not size_ok:
        failures.append(f"{label}: size is {image.size[0]}x{image.size[1]}, expected {expected_size[0]}x{expected_size[1]}")
    if not mode_ok:
        failures.append(f"{label}: mode is {image.mode}, expected RGBA")

    rgba = image.convert("RGBA")
    if actual_frame_count >= 2:
        report = measure_adjacent_motion(rgba, actual_frame_count, frame_size)
        changed = "/".join(str(value) for value in report.changed_pixels)
        deltas = "/".join(f"{value / 1000:.1f}k" for value in report.channel_deltas)
        status = "static" if report.effectively_static else "ok"
        frame_label = f"frames={actual_frame_count}"
        if actual_frame_count != frame_count:
            frame_label += f"/expected-{frame_count}"
        print(
            f"{activity:10s} "
            f"{frame_label} size={image.size[0]}x{image.size[1]} "
            f"changed={changed:>14s} delta={deltas:>18s} "
            f"massDrift={report.alpha_mass_drift:4.2f}px "
            f"bboxDrift={report.bbox_center_drift:4.2f}px "
            f"{status}"
        )
        if report.effectively_static:
            failures.append(
                f"{label}: effectively static "
                f"(max changed pixels {report.max_changed_pixels}, max channel delta {report.max_channel_delta})"
            )
        if stage == "spore":
            if activity in SPORE_CORE_ACTIVITIES and report.bbox_center_drift > MAX_SPORE_CORE_BBOX_DRIFT_PX:
                failures.append(
                    f"{label}: bbox center drift is {report.bbox_center_drift:.2f}px, "
                    f"expected <= {MAX_SPORE_CORE_BBOX_DRIFT_PX:.2f}px for calm spore motion"
                )
            bright_runs = find_long_bright_horizontal_runs(rgba, actual_frame_count, frame_size)
            if bright_runs:
                details = ", ".join(
                    f"frame {run.frame_index + 1} y={run.y} x={run.x_start}-{run.x_end} len={run.length}"
                    for run in bright_runs[:3]
                )
                failures.append(
                    f"{label}: suspicious thin bright horizontal streaks ({details})"
                )
    else:
        print(f"{activity:10s} frames=unreadable/expected-{frame_count} size={image.size[0]}x{image.size[1]} invalid-size")


def measure_adjacent_motion(image: Image.Image, frame_count: int, frame_size: int) -> MotionReport:
    frames = [crop_frame(image, index, frame_size) for index in range(frame_count)]
    changed_pixels: list[int] = []
    channel_deltas: list[int] = []

    for left, right in zip(frames, frames[1:]):
        diff = ImageChops.difference(left, right)
        changed, channel_delta = count_visible_diff(diff)
        changed_pixels.append(changed)
        channel_deltas.append(channel_delta)

    alpha_centers = [alpha_mass_center(frame) for frame in frames]
    bbox_centers = [bbox_center(frame) for frame in frames]

    return MotionReport(
        changed_pixels=changed_pixels,
        channel_deltas=channel_deltas,
        alpha_mass_drift=max_distance_from_first(alpha_centers),
        bbox_center_drift=max_distance_from_first(bbox_centers),
    )


def crop_frame(image: Image.Image, index: int, frame_size: int) -> Image.Image:
    left = index * frame_size
    return image.crop((left, 0, left + frame_size, frame_size))


def count_visible_diff(diff: Image.Image) -> tuple[int, int]:
    data = diff.tobytes()
    changed = 0
    channel_delta = 0
    for index in range(0, len(data), 4):
        r = data[index]
        g = data[index + 1]
        b = data[index + 2]
        a = data[index + 3]
        channel_delta += r + g + b + a
        if r > PIXEL_DIFF_THRESHOLD or g > PIXEL_DIFF_THRESHOLD or b > PIXEL_DIFF_THRESHOLD or a > PIXEL_DIFF_THRESHOLD:
            changed += 1
    return changed, channel_delta


def find_long_bright_horizontal_runs(image: Image.Image, frame_count: int, frame_size: int) -> list[BrightRun]:
    runs: list[BrightRun] = []
    for frame_index in range(frame_count):
        frame = crop_frame(image, frame_index, frame_size)
        pixels = frame.load()
        for y in range(frame_size):
            run_start: int | None = None
            for x in range(frame_size):
                if is_suspicious_bright_streak_pixel(pixels[x, y]):
                    if run_start is None:
                        run_start = x
                    continue

                if run_start is not None and x - run_start >= MAX_SPORE_BRIGHT_RUN_PX:
                    runs.append(BrightRun(frame_index, y, run_start, x - 1))
                run_start = None

            if run_start is not None and frame_size - run_start >= MAX_SPORE_BRIGHT_RUN_PX:
                runs.append(BrightRun(frame_index, y, run_start, frame_size - 1))

    return runs


def is_suspicious_bright_streak_pixel(pixel: tuple[int, int, int, int]) -> bool:
    r, g, b, a = pixel
    if a < 160:
        return False
    if r < 235 or g < 228 or b < 205:
        return False
    return max(r, g, b) - min(r, g, b) <= 55


def alpha_mass_center(frame: Image.Image) -> tuple[float, float] | None:
    alpha = frame.getchannel("A")
    data = alpha.tobytes()
    width, height = alpha.size
    total = 0
    sum_x = 0
    sum_y = 0

    for y in range(height):
        row_offset = y * width
        for x in range(width):
            value = data[row_offset + x]
            if value <= VISIBLE_ALPHA_THRESHOLD:
                continue
            total += value
            sum_x += x * value
            sum_y += y * value

    if total == 0:
        return None

    return sum_x / total, sum_y / total


def bbox_center(frame: Image.Image) -> tuple[float, float] | None:
    bbox = frame.getchannel("A").getbbox()
    if bbox is None:
        return None
    return (bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2


def max_distance_from_first(points: list[tuple[float, float] | None]) -> float:
    first = next((point for point in points if point is not None), None)
    if first is None:
        return 0.0
    return max(
        (((point[0] - first[0]) ** 2 + (point[1] - first[1]) ** 2) ** 0.5)
        for point in points
        if point is not None
    )


def audit_spore_sleep_split(config: AnimationConfig, failures: list[str]) -> None:
    frame_count = config.stage_frame_counts.get("sleep", 4)
    frame_size = config.frame_size
    path = STAGES_DIR / "spore" / "sleep_sheet.png"
    label = "spore.sleep"

    print("\n[spore sleep split]")
    if not path.exists():
        failures.append(f"{label}: missing {path.relative_to(ROOT)}")
        print("missing")
        return

    image = Image.open(path).convert("RGBA")
    expected_size = (frame_count * frame_size, frame_size)
    if image.size != expected_size:
        failures.append(f"{label}: size is {image.size[0]}x{image.size[1]}, expected {expected_size[0]}x{expected_size[1]}")
        print(f"size={image.size[0]}x{image.size[1]} invalid-size")
        return

    counts: list[int] = []
    for index in range(frame_count):
        frame = crop_frame(image, index, frame_size)
        counts.append(count_edge_visible_pixels(frame, SPORE_SLEEP_EDGE_GUARD_PX))

    print(
        f"edgeVisible={('/'.join(str(value) for value in counts))} "
        f"guard={SPORE_SLEEP_EDGE_GUARD_PX}px maxAllowed={MAX_SPORE_SLEEP_EDGE_PIXELS}"
    )

    for index, count in enumerate(counts, start=1):
        if count > MAX_SPORE_SLEEP_EDGE_PIXELS:
            failures.append(
                f"{label}: frame {index} has {count} visible pixels near split edges "
                f"(allowed {MAX_SPORE_SLEEP_EDGE_PIXELS})"
            )


def count_edge_visible_pixels(frame: Image.Image, guard_px: int) -> int:
    alpha = frame.getchannel("A")
    data = alpha.tobytes()
    width, height = alpha.size
    total = 0

    for y in range(height):
        row_offset = y * width
        for x in range(guard_px):
            if data[row_offset + x] > VISIBLE_ALPHA_THRESHOLD:
                total += 1
        for x in range(width - guard_px, width):
            if data[row_offset + x] > VISIBLE_ALPHA_THRESHOLD:
                total += 1

    return total


if __name__ == "__main__":
    main()
