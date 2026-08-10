from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw

FRAME_WIDTH = 192
FRAME_HEIGHT = 208
STATE_ORDER = [
    "idle",
    "thinking",
    "typing",
    "working",
    "approval",
    "waiting_input",
    "success",
    "error",
    "quota_low",
    "quota_empty",
    "offline",
    "sleep",
]


def opened(path: str | Path) -> Image.Image:
    image = Image.open(path)
    image.load()
    return image


def verify(paths: Iterable[str]) -> None:
    for path in paths:
        with Image.open(path) as image:
            image.verify()


def crop_alpha(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    bounds = rgba.getchannel("A").getbbox()
    if bounds is None:
        raise ValueError("Input image contains no visible pixels")
    return rgba.crop(bounds)


def pixel_fit(image: Image.Image, floating: bool, fit_scale: float = 1.0) -> Image.Image:
    if fit_scale <= 0 or fit_scale > 1:
        raise ValueError("Fit scale must be greater than 0 and no greater than 1")
    subject = crop_alpha(image)
    max_width = round(168 * fit_scale)
    max_height = round((176 if floating else 190) * fit_scale)
    scale = min(max_width / subject.width, max_height / subject.height, 1.0)
    width = max(1, round(subject.width * scale))
    height = max(1, round(subject.height * scale))
    return subject.resize((width, height), Image.Resampling.NEAREST)


def motion(
    state: str, index: int, frames: int
) -> tuple[int, int, float, float, float]:
    progress = index / max(1, frames - 1)
    phase = 2 * math.pi * progress
    sine = math.sin(phase)
    cosine = math.cos(phase)
    envelope = math.sin(math.pi * progress)
    lift = envelope * envelope
    if state == "idle":
        breath = (1 - cosine) / 2
        return (
            round(sine),
            round(-2 * breath),
            0.35 * sine,
            1.0 + 0.006 * breath,
            1.0 + 0.015 * breath,
        )
    if state == "thinking":
        return round(2 * sine), -round((1 - cosine) / 2), 1.4 * sine, 1.0, 1.0
    if state == "typing":
        beat = math.sin(4 * math.pi * progress)
        impact = abs(beat)
        return (
            round(1.5 * beat),
            -round(1.5 * impact),
            0.4 * beat,
            1.0 + 0.01 * impact,
            1.0 - 0.008 * impact,
        )
    if state == "working":
        beat = math.sin(4 * math.pi * progress)
        drive = (1 - math.cos(4 * math.pi * progress)) / 2
        return (
            round(2 * beat),
            -round(2 * drive),
            0.9 * beat,
            1.0 + 0.012 * drive,
            1.0 - 0.01 * drive,
        )
    if state == "approval":
        return round(sine), -round(4 * lift), -1.5 * sine, 1.0 + 0.015 * lift, 1.0 - 0.012 * lift
    if state == "waiting_input":
        hover = (1 - cosine) / 2
        return round(sine), -round(2 * hover), 0.5 * sine, 1.0, 1.0 + 0.008 * hover
    if state == "success":
        return (
            round(3 * sine),
            -round(34 * lift),
            -2.5 * sine,
            1.0 - 0.025 * lift,
            1.0 + 0.04 * lift,
        )
    if state == "error":
        shake = math.sin(6 * math.pi * progress) * envelope
        return (
            round(4 * shake),
            round(7 * lift),
            1.2 * shake,
            1.0 + 0.02 * abs(shake),
            1.0 - 0.025 * envelope,
        )
    if state == "quota_low":
        tremble = math.sin(8 * math.pi * progress) * envelope
        return (
            round(2 * tremble),
            round(3 * lift),
            0.7 * tremble,
            1.0 + 0.01 * abs(tremble),
            1.0 - 0.018 * envelope,
        )
    if state == "quota_empty":
        return 0, round(5 * lift), 0.5 * sine, 1.0 + 0.015 * lift, 1.0 - 0.035 * lift
    if state == "offline":
        return 0, round(2 * lift), 0.0, 1.0 - 0.01 * lift, 1.0 - 0.02 * lift
    if state == "sleep":
        breath = (1 - cosine) / 2
        return (
            round(sine),
            -round(breath),
            0.25 * sine,
            1.0 + 0.012 * breath,
            1.0 + 0.018 * breath,
        )
    raise ValueError(f"Unsupported state: {state}")


def transform_subject(
    subject: Image.Image, angle: float, scale_x: float, scale_y: float
) -> Image.Image:
    width = max(1, round(subject.width * scale_x))
    height = max(1, round(subject.height * scale_y))
    transformed = subject.resize((width, height), Image.Resampling.NEAREST)
    if abs(angle) >= 0.01:
        transformed = transformed.rotate(
            angle,
            resample=Image.Resampling.NEAREST,
            expand=True,
            fillcolor=(0, 0, 0, 0),
        )
    return transformed


def strip_subjects(
    image: Image.Image, floating: bool, fit_scale: float
) -> list[Image.Image]:
    if image.height != FRAME_HEIGHT or image.width % FRAME_WIDTH != 0:
        raise ValueError(
            f"Animation-strip input must be N*{FRAME_WIDTH} by {FRAME_HEIGHT}, got {image.width}x{image.height}"
        )
    frame_count = image.width // FRAME_WIDTH
    if frame_count < 2:
        raise ValueError("Animation-strip input must contain at least two frames")
    subjects = []
    for index in range(frame_count):
        frame = image.crop(
            (index * FRAME_WIDTH, 0, (index + 1) * FRAME_WIDTH, FRAME_HEIGHT)
        )
        try:
            subjects.append(pixel_fit(frame, floating, fit_scale))
        except ValueError as error:
            raise ValueError(
                f"Animation-strip input frame {index} contains no visible subject"
            ) from error
    return subjects


def clamped(value: int, minimum: int, maximum: int) -> int:
    return max(minimum, min(maximum, value))


def pixel_star(draw: ImageDraw.ImageDraw, x: int, y: int, color: tuple[int, int, int, int]) -> None:
    x = clamped(x, 5, FRAME_WIDTH - 6)
    y = clamped(y, 5, FRAME_HEIGHT - 6)
    draw.rectangle((x - 1, y - 4, x + 1, y + 4), fill=color)
    draw.rectangle((x - 4, y - 1, x + 4, y + 1), fill=color)
    draw.point((x - 2, y - 2), fill=color)
    draw.point((x + 2, y - 2), fill=color)
    draw.point((x - 2, y + 2), fill=color)
    draw.point((x + 2, y + 2), fill=color)


def add_state_accents(
    frame: Image.Image,
    state: str,
    index: int,
    frames: int,
    subject_bounds: tuple[int, int, int, int],
) -> None:
    if index == 0 or index == frames - 1 or state == "idle":
        return
    left, top, right, bottom = subject_bounds
    draw = ImageDraw.Draw(frame)
    progress = index / max(1, frames - 1)
    envelope = math.sin(math.pi * progress)
    side = -1 if index % 2 else 1
    center_x = (left + right) // 2

    if state == "thinking":
        color = (143, 232, 255, 255)
        for offset in range(1 + round(envelope)):
            x = clamped(right + 7 + offset * 5, 5, FRAME_WIDTH - 6)
            y = clamped(top + 20 - offset * 6, 5, FRAME_HEIGHT - 6)
            draw.rectangle((x - 1, y - 1, x + 1, y + 1), fill=color)
    elif state in {"typing", "working"}:
        color = (236, 249, 255, 255) if state == "typing" else (111, 222, 255, 255)
        x = clamped(center_x + side * max(8, (right - left) // 5), 7, FRAME_WIDTH - 8)
        y = clamped(bottom - max(10, (bottom - top) // 4), 7, FRAME_HEIGHT - 8)
        draw.line((x - side * 5, y - 3, x, y), fill=color, width=2)
        draw.line((x - side * 4, y + 4, x, y + 2), fill=color, width=2)
    elif state == "approval":
        pixel_star(draw, right + 10, top + 18, (255, 217, 71, 255))
    elif state == "waiting_input":
        color = (102, 226, 255, 255)
        x = clamped(right + 8, 5, FRAME_WIDTH - 6)
        for dot in range(1 + round(envelope * 2)):
            y = clamped(top + 14 + dot * 6, 5, FRAME_HEIGHT - 6)
            draw.rectangle((x - 1, y - 1, x + 1, y + 1), fill=color)
    elif state == "success":
        pixel_star(draw, left - 9, top + 18 + (index % 2) * 6, (255, 231, 91, 255))
        if envelope > 0.75:
            pixel_star(draw, right + 9, top + 30, (135, 240, 255, 255))
    elif state == "error":
        color = (255, 84, 72, 255)
        x = clamped((left - 8) if side < 0 else (right + 8), 7, FRAME_WIDTH - 8)
        y = clamped(top + 18, 7, FRAME_HEIGHT - 12)
        draw.line((x - 3, y - 5, x + 1, y, x - 2, y + 6), fill=color, width=2)
    elif state == "quota_low":
        color = (255, 181, 59, 255)
        x = clamped(right + 8, 5, FRAME_WIDTH - 6)
        y = clamped(top + 22, 5, FRAME_HEIGHT - 10)
        draw.rectangle((x - 1, y - 4, x + 1, y + 1), fill=color)
        draw.rectangle((x - 1, y + 5, x + 1, y + 7), fill=color)
    elif state == "quota_empty":
        color = (181, 194, 210, 255)
        for puff in range(1 + round(envelope)):
            x = clamped(right + 7 + puff * 5, 5, FRAME_WIDTH - 6)
            y = clamped(top + (right - left) // 4 - puff * 3, 5, FRAME_HEIGHT - 6)
            draw.ellipse((x - 2, y - 1, x + 2, y + 1), fill=color)
    elif state == "offline":
        color = (104, 137, 165, 255)
        x = clamped(right + 7, 5, FRAME_WIDTH - 6)
        y = clamped(top + 18, 5, FRAME_HEIGHT - 6)
        draw.rectangle((x - 2, y - 2, x + 2, y + 2), fill=color)
    elif state == "sleep":
        color = (144, 218, 255, 255)
        bubble_x = clamped(right + 7 + round(5 * envelope), 5, FRAME_WIDTH - 7)
        bubble_y = clamped(top + 26 - round(12 * envelope), 5, FRAME_HEIGHT - 7)
        draw.ellipse((bubble_x - 3, bubble_y - 3, bubble_x + 3, bubble_y + 3), outline=color, width=2)


def grid_subjects(
    image: Image.Image,
    columns: int,
    rows: int,
    row: int | None,
    floating: bool,
    fit_scale: float,
) -> list[Image.Image]:
    if columns < 2 or rows < 1:
        raise ValueError("Keyframe grid must contain at least two columns and one row")
    if row is not None and (row < 0 or row >= rows):
        raise ValueError(f"Keyframe grid row {row} is outside 0..{rows - 1}")
    subjects = []
    selected_rows = range(rows) if row is None else [row]
    for selected_row in selected_rows:
        top = round(selected_row * image.height / rows)
        bottom = round((selected_row + 1) * image.height / rows)
        for column in range(columns):
            left = round(column * image.width / columns)
            right = round((column + 1) * image.width / columns)
            cell = image.crop(
                (
                    left,
                    top,
                    right,
                    bottom,
                )
            )
            try:
                subjects.append(pixel_fit(cell, floating, fit_scale))
            except ValueError as error:
                raise ValueError(
                    f"Keyframe grid cell row {selected_row}, column {column} contains no visible subject"
                ) from error
    return subjects


def loop_keyframe_indices(keyframe_count: int, frames: int) -> list[int]:
    if keyframe_count < 2:
        raise ValueError("At least two keyframes are required")
    if frames < 2:
        raise ValueError("At least two output frames are required")
    return [
        round(index * (keyframe_count - 1) / (frames - 1))
        for index in range(frames)
    ]


def make_strip(
    input_path: str,
    output_path: str,
    state: str,
    frames: int,
    floating: bool,
    grid_columns: int | None = None,
    grid_rows: int | None = None,
    grid_row: int | None = None,
    fit_scale: float = 1.0,
    input_is_strip: bool = False,
) -> None:
    image = opened(input_path).convert("RGBA")
    grid_dimensions = (grid_columns, grid_rows)
    if any(value is not None for value in grid_dimensions) and not all(
        value is not None for value in grid_dimensions
    ):
        raise ValueError("Grid columns and rows must be supplied together")
    if grid_row is not None and grid_columns is None:
        raise ValueError("Grid row requires grid columns and rows")
    if input_is_strip and grid_columns is not None:
        raise ValueError("Animation-strip input cannot also use keyframe-grid options")
    if input_is_strip:
        subjects = strip_subjects(image, floating, fit_scale)
    elif grid_columns is not None and grid_rows is not None:
        subjects = grid_subjects(
            image, grid_columns, grid_rows, grid_row, floating, fit_scale
        )
    else:
        subjects = [pixel_fit(image, floating, fit_scale)]
    sequence = loop_keyframe_indices(len(subjects), frames) if len(subjects) > 1 else [0] * frames
    strip = Image.new("RGBA", (FRAME_WIDTH * frames, FRAME_HEIGHT), (0, 0, 0, 0))
    for index in range(frames):
        subject = subjects[sequence[index]]
        base_center_y = 108 if floating else 196 - subject.height // 2
        dx, dy, angle, scale_x, scale_y = motion(state, index, frames)
        frame_subject = transform_subject(subject, angle, scale_x, scale_y)
        center_x = FRAME_WIDTH // 2 + dx
        center_y = base_center_y + dy
        frame_x = center_x - frame_subject.width // 2
        y = center_y - frame_subject.height // 2
        frame = Image.new("RGBA", (FRAME_WIDTH, FRAME_HEIGHT), (0, 0, 0, 0))
        frame.alpha_composite(frame_subject, (frame_x, y))
        add_state_accents(
            frame,
            state,
            index,
            frames,
            (frame_x, y, frame_x + frame_subject.width, y + frame_subject.height),
        )
        strip.alpha_composite(frame, (index * FRAME_WIDTH, 0))
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    strip.save(output_path, "WEBP", lossless=True, method=6, exact=True)


def source_strip(atlas_path: str, output_path: str, row: int, frames: int) -> None:
    atlas = opened(atlas_path).convert("RGBA")
    if atlas.size != (1536, 1872):
        raise ValueError(f"Source atlas must be 1536x1872, got {atlas.size[0]}x{atlas.size[1]}")
    source_frames = []
    for index in range(8):
        frame = atlas.crop(
            (
                index * FRAME_WIDTH,
                row * FRAME_HEIGHT,
                (index + 1) * FRAME_WIDTH,
                (row + 1) * FRAME_HEIGHT,
            )
        )
        if frame.getchannel("A").getbbox() is not None:
            source_frames.append(frame)
    if not source_frames:
        raise ValueError(f"Source atlas row {row} contains no visible frames")
    bounds = [frame.getchannel("A").getbbox() for frame in source_frames]
    visible_bounds = [bound for bound in bounds if bound is not None]
    margin = 2
    global_left = min(bound[0] for bound in visible_bounds)
    global_top = min(bound[1] for bound in visible_bounds)
    global_right = max(bound[2] for bound in visible_bounds)
    global_bottom = max(bound[3] for bound in visible_bounds)
    shift_x = max(0, margin - global_left)
    shift_y = max(0, margin - global_top)
    if global_right + shift_x > FRAME_WIDTH - margin:
        shift_x += FRAME_WIDTH - margin - (global_right + shift_x)
    if global_bottom + shift_y > FRAME_HEIGHT - margin:
        shift_y += FRAME_HEIGHT - margin - (global_bottom + shift_y)
    if shift_x or shift_y:
        normalized = []
        for frame in source_frames:
            canvas = Image.new("RGBA", (FRAME_WIDTH, FRAME_HEIGHT), (0, 0, 0, 0))
            canvas.alpha_composite(frame, (shift_x, shift_y))
            normalized.append(canvas)
        source_frames = normalized
    if frames == 1:
        selected = [source_frames[0]]
    else:
        forward_count = max(2, math.ceil(frames / 2))
        stable_forward = source_frames[:forward_count]
        while len(stable_forward) < forward_count:
            stable_forward.append(stable_forward[-1])
        selected = (stable_forward + list(reversed(stable_forward)))[:frames]
    strip = Image.new("RGBA", (FRAME_WIDTH * frames, FRAME_HEIGHT), (0, 0, 0, 0))
    for index, frame in enumerate(selected):
        strip.alpha_composite(frame, (index * FRAME_WIDTH, 0))
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    strip.save(output_path, "WEBP", lossless=True, method=6, exact=True)


def first_frame(strip_path: str, output_path: str) -> None:
    strip = opened(strip_path).convert("RGBA")
    frame = strip.crop((0, 0, FRAME_WIDTH, FRAME_HEIGHT))
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    frame.save(output_path, "WEBP", lossless=True, method=6, exact=True)


def reference(atlas_path: str, preview_path: str, output_path: str) -> None:
    atlas = opened(atlas_path).convert("RGBA")
    frames = [
        atlas.crop((column * FRAME_WIDTH, 0, (column + 1) * FRAME_WIDTH, FRAME_HEIGHT))
        for column in range(6)
    ]
    preview = opened(preview_path).convert("RGBA")
    preview.seek(0)
    preview = preview.copy()
    preview.thumbnail((FRAME_WIDTH, FRAME_HEIGHT), Image.Resampling.NEAREST)
    sheet = Image.new("RGBA", (FRAME_WIDTH * 3, FRAME_HEIGHT * 2), (0, 0, 0, 0))
    for index, frame in enumerate(frames[:5]):
        sheet.alpha_composite(frame, ((index % 3) * FRAME_WIDTH, (index // 3) * FRAME_HEIGHT))
    x = 2 * FRAME_WIDTH + (FRAME_WIDTH - preview.width) // 2
    y = FRAME_HEIGHT + (FRAME_HEIGHT - preview.height) // 2
    sheet.alpha_composite(preview, (x, y))
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_path, "PNG")


def contact_sheet(directory: str, output_path: str) -> None:
    root = Path(directory)
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    cell_width, cell_height = 240, 248
    sheet = Image.new("RGBA", (cell_width * 4, cell_height * 3), (24, 28, 36, 255))
    draw = ImageDraw.Draw(sheet)
    for index, state in enumerate(STATE_ORDER):
        animation = manifest["animations"][state]
        strip = opened(root / animation["sprite"]).convert("RGBA")
        frame = strip.crop((0, 0, FRAME_WIDTH, FRAME_HEIGHT))
        column, row = index % 4, index // 4
        x = column * cell_width + (cell_width - FRAME_WIDTH) // 2
        y = row * cell_height + 22
        sheet.alpha_composite(frame, (x, y))
        draw.text((column * cell_width + 8, row * cell_height + 5), state, fill=(240, 244, 252, 255))
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_path, "PNG")


def atlas_contact(atlas_path: str, output_path: str) -> None:
    atlas = opened(atlas_path).convert("RGBA")
    if atlas.size != (1536, 1872):
        raise ValueError(f"Source atlas must be 1536x1872, got {atlas.size[0]}x{atlas.size[1]}")
    cell_width, cell_height = 224, 236
    sheet = Image.new("RGBA", (cell_width * 3, cell_height * 3), (24, 28, 36, 255))
    draw = ImageDraw.Draw(sheet)
    for row in range(9):
        frame = atlas.crop((0, row * FRAME_HEIGHT, FRAME_WIDTH, (row + 1) * FRAME_HEIGHT))
        column, grid_row = row % 3, row // 3
        x = column * cell_width + (cell_width - FRAME_WIDTH) // 2
        y = grid_row * cell_height + 24
        sheet.alpha_composite(frame, (x, y))
        draw.text((column * cell_width + 8, grid_row * cell_height + 6), f"source row {row}", fill=(240, 244, 252, 255))
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_path, "PNG")


def animated_preview(directory: str, output_path: str) -> None:
    root = Path(directory)
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    output_frames: list[Image.Image] = []
    durations: list[int] = []
    for state in STATE_ORDER:
        animation = manifest["animations"][state]
        strip = opened(root / animation["sprite"]).convert("RGBA")
        for index in range(animation["frames"]):
            output_frames.append(
                strip.crop((index * FRAME_WIDTH, 0, (index + 1) * FRAME_WIDTH, FRAME_HEIGHT))
            )
            durations.append(round(1000 / animation["fps"]))
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    output_frames[0].save(
        output_path,
        "WEBP",
        save_all=True,
        append_images=output_frames[1:],
        duration=durations,
        loop=0,
        lossless=True,
        method=6,
        exact=True,
    )


def animated_board(directory: str, output_path: str) -> None:
    root = Path(directory)
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    board_fps = 6
    board_seconds = 12
    cell_width, cell_height = 160, 180
    output_frames: list[Image.Image] = []
    strips = {
        state: opened(root / manifest["animations"][state]["sprite"]).convert("RGBA")
        for state in STATE_ORDER
    }
    for board_index in range(board_fps * board_seconds):
        board = Image.new("RGBA", (cell_width * 4, cell_height * 3), (24, 28, 36, 255))
        draw = ImageDraw.Draw(board)
        elapsed = board_index / board_fps
        for state_index, state in enumerate(STATE_ORDER):
            animation = manifest["animations"][state]
            source_index = math.floor(elapsed * animation["fps"]) % animation["frames"]
            frame = strips[state].crop(
                (
                    source_index * FRAME_WIDTH,
                    0,
                    (source_index + 1) * FRAME_WIDTH,
                    FRAME_HEIGHT,
                )
            )
            frame.thumbnail((144, 148), Image.Resampling.NEAREST)
            column, row = state_index % 4, state_index // 4
            x = column * cell_width + (cell_width - frame.width) // 2
            y = row * cell_height + 25 + (148 - frame.height) // 2
            board.alpha_composite(frame, (x, y))
            draw.text(
                (column * cell_width + 7, row * cell_height + 6),
                state,
                fill=(240, 244, 252, 255),
            )
        output_frames.append(board)
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    output_frames[0].save(
        output_path,
        "WEBP",
        save_all=True,
        append_images=output_frames[1:],
        duration=round(1000 / board_fps),
        loop=0,
        lossless=True,
        method=4,
        exact=True,
    )


def alpha_stats(input_path: str) -> dict[str, float | int]:
    image = opened(input_path).convert("RGBA")
    alpha = image.getchannel("A")
    visible = sum(1 for value in alpha.getdata() if value > 0)
    total = image.width * image.height
    corners = [alpha.getpixel((0, 0)), alpha.getpixel((image.width - 1, 0)), alpha.getpixel((0, image.height - 1)), alpha.getpixel((image.width - 1, image.height - 1))]
    if any(corners):
        raise ValueError("Transparent key-pose validation failed: one or more corners are opaque")
    if visible < total * 0.01 or visible > total * 0.8:
        raise ValueError(f"Visible subject coverage {visible / total:.3f} is implausible")
    return {"width": image.width, "height": image.height, "visiblePixels": visible, "coverage": visible / total}


def grid_alpha_stats(input_path: str, columns: int, rows: int) -> dict[str, object]:
    image = opened(input_path).convert("RGBA")
    if columns < 2 or rows < 1:
        raise ValueError("Alpha grid must contain at least two columns and one row")
    cells = []
    for row in range(rows):
        top = round(row * image.height / rows)
        bottom = round((row + 1) * image.height / rows)
        for column in range(columns):
            left = round(column * image.width / columns)
            right = round((column + 1) * image.width / columns)
            cell = image.crop(
                (
                    left,
                    top,
                    right,
                    bottom,
                )
            )
            alpha = cell.getchannel("A")
            visible = sum(1 for value in alpha.getdata() if value > 0)
            total = cell.width * cell.height
            corners = [
                alpha.getpixel((0, 0)),
                alpha.getpixel((cell.width - 1, 0)),
                alpha.getpixel((0, cell.height - 1)),
                alpha.getpixel((cell.width - 1, cell.height - 1)),
            ]
            coverage = visible / total
            if any(corners):
                raise ValueError(
                    f"Alpha grid cell row {row}, column {column} has an opaque corner"
                )
            if coverage < 0.005 or coverage > 0.8:
                raise ValueError(
                    f"Alpha grid cell row {row}, column {column} coverage {coverage:.3f} is implausible"
                )
            cells.append(
                {
                    "row": row,
                    "column": column,
                    "visiblePixels": visible,
                    "coverage": coverage,
                }
            )
    return {
        "width": image.width,
        "height": image.height,
        "columns": columns,
        "rows": rows,
        "cells": cells,
    }


def strip_stats(input_path: str, frames: int) -> dict[str, object]:
    image = opened(input_path).convert("RGBA")
    expected_size = (FRAME_WIDTH * frames, FRAME_HEIGHT)
    if image.size != expected_size:
        raise ValueError(
            f"Animation strip must be {expected_size[0]}x{expected_size[1]}, got {image.width}x{image.height}"
        )
    frame_images = [
        image.crop((index * FRAME_WIDTH, 0, (index + 1) * FRAME_WIDTH, FRAME_HEIGHT))
        for index in range(frames)
    ]
    frame_hashes = [hashlib.sha256(frame.tobytes()).hexdigest() for frame in frame_images]
    centers: list[tuple[float, float]] = []
    widths: list[int] = []
    blank_frames = 0
    edge_touches = 0
    for frame in frame_images:
        bounds = frame.getchannel("A").getbbox()
        if bounds is None:
            blank_frames += 1
            continue
        left, top, right, bottom = bounds
        widths.append(right - left)
        centers.append(((left + right) / 2, (top + bottom) / 2))
        if left == 0 or top == 0 or right == FRAME_WIDTH or bottom == FRAME_HEIGHT:
            edge_touches += 1
    center_steps = [
        math.dist(centers[index - 1], centers[index])
        for index in range(1, len(centers))
    ]
    first_pixels = list(frame_images[0].getdata())
    last_pixels = list(frame_images[-1].getdata())
    return {
        "width": image.width,
        "height": image.height,
        "frames": frames,
        "blankFrames": blank_frames,
        "edgeTouches": edge_touches,
        "uniqueFrameCount": len(set(frame_hashes)),
        "maxSubjectWidth": max(widths, default=0),
        "maxCenterStep": round(max(center_steps, default=0), 2),
        "loopCenterDelta": (
            round(math.dist(centers[0], centers[-1]), 2) if centers else None
        ),
        "loopPixelDifference": sum(
            1 for first, last in zip(first_pixels, last_pixels) if first != last
        ),
    }


def analyze_package(directory: str) -> dict[str, object]:
    root = Path(directory)
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    states: dict[str, object] = {}
    for state in STATE_ORDER:
        animation = manifest["animations"][state]
        strip = opened(root / animation["sprite"]).convert("RGBA")
        frame_results = []
        frame_images: list[Image.Image] = []
        centers: list[tuple[float, float]] = []
        baselines: list[int] = []
        for index in range(animation["frames"]):
            frame = strip.crop((index * FRAME_WIDTH, 0, (index + 1) * FRAME_WIDTH, FRAME_HEIGHT))
            frame_images.append(frame)
            bounds = frame.getchannel("A").getbbox()
            if bounds is None:
                frame_results.append({"index": index, "blank": True})
                continue
            left, top, right, bottom = bounds
            center = ((left + right) / 2, (top + bottom) / 2)
            centers.append(center)
            baselines.append(bottom)
            frame_results.append(
                {
                    "index": index,
                    "blank": False,
                    "bounds": [left, top, right, bottom],
                    "center": [round(center[0], 2), round(center[1], 2)],
                    "touchesEdge": left == 0 or top == 0 or right == FRAME_WIDTH or bottom == FRAME_HEIGHT,
                }
            )
        center_steps = [
            math.dist(centers[index - 1], centers[index]) for index in range(1, len(centers))
        ]
        frame_hashes = {
            hashlib.sha256(frame.tobytes()).hexdigest() for frame in frame_images
        }
        loop_pixel_difference = sum(
            1
            for first, last in zip(
                frame_images[0].getdata(), frame_images[-1].getdata()
            )
            if first != last
        )
        states[state] = {
            "frames": animation["frames"],
            "fps": animation["fps"],
            "blankFrames": sum(1 for frame in frame_results if frame["blank"]),
            "edgeTouches": sum(1 for frame in frame_results if frame.get("touchesEdge")),
            "centerDriftX": round(max((center[0] for center in centers), default=0) - min((center[0] for center in centers), default=0), 2),
            "centerDriftY": round(max((center[1] for center in centers), default=0) - min((center[1] for center in centers), default=0), 2),
            "maxCenterStep": round(max(center_steps, default=0), 2),
            "loopCenterDelta": round(math.dist(centers[0], centers[-1]), 2) if centers else None,
            "loopPixelDifference": loop_pixel_difference,
            "uniqueFrameCount": len(frame_hashes),
            "baselineDrift": max(baselines, default=0) - min(baselines, default=0),
            "framesDetail": frame_results,
        }
    return {"id": manifest["id"], "states": states}


def main() -> None:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    verify_parser = subparsers.add_parser("verify")
    verify_parser.add_argument("--input", action="append", required=True)
    reference_parser = subparsers.add_parser("reference")
    reference_parser.add_argument("--atlas", required=True)
    reference_parser.add_argument("--preview", required=True)
    reference_parser.add_argument("--out", required=True)
    strip_parser = subparsers.add_parser("strip")
    strip_parser.add_argument("--input", required=True)
    strip_parser.add_argument("--out", required=True)
    strip_parser.add_argument("--state", choices=STATE_ORDER, required=True)
    strip_parser.add_argument("--frames", type=int, required=True)
    strip_parser.add_argument("--floating", action="store_true")
    strip_parser.add_argument("--grid-columns", type=int)
    strip_parser.add_argument("--grid-rows", type=int)
    strip_parser.add_argument("--grid-row", type=int)
    strip_parser.add_argument("--fit-scale", type=float, default=1.0)
    strip_parser.add_argument("--input-is-strip", action="store_true")
    source_parser = subparsers.add_parser("source-strip")
    source_parser.add_argument("--atlas", required=True)
    source_parser.add_argument("--out", required=True)
    source_parser.add_argument("--row", type=int, default=0)
    source_parser.add_argument("--frames", type=int, required=True)
    first_parser = subparsers.add_parser("first-frame")
    first_parser.add_argument("--input", required=True)
    first_parser.add_argument("--out", required=True)
    contact_parser = subparsers.add_parser("contact-sheet")
    contact_parser.add_argument("--directory", required=True)
    contact_parser.add_argument("--out", required=True)
    atlas_parser = subparsers.add_parser("atlas-contact")
    atlas_parser.add_argument("--atlas", required=True)
    atlas_parser.add_argument("--out", required=True)
    preview_parser = subparsers.add_parser("animated-preview")
    preview_parser.add_argument("--directory", required=True)
    preview_parser.add_argument("--out", required=True)
    board_parser = subparsers.add_parser("animated-board")
    board_parser.add_argument("--directory", required=True)
    board_parser.add_argument("--out", required=True)
    alpha_parser = subparsers.add_parser("alpha-stats")
    alpha_parser.add_argument("--input", required=True)
    grid_alpha_parser = subparsers.add_parser("grid-alpha-stats")
    grid_alpha_parser.add_argument("--input", required=True)
    grid_alpha_parser.add_argument("--columns", type=int, required=True)
    grid_alpha_parser.add_argument("--rows", type=int, required=True)
    strip_stats_parser = subparsers.add_parser("strip-stats")
    strip_stats_parser.add_argument("--input", required=True)
    strip_stats_parser.add_argument("--frames", type=int, required=True)
    analyze_parser = subparsers.add_parser("analyze-package")
    analyze_parser.add_argument("--directory", required=True)
    arguments = parser.parse_args()
    if arguments.command == "verify":
        verify(arguments.input)
    elif arguments.command == "reference":
        reference(arguments.atlas, arguments.preview, arguments.out)
    elif arguments.command == "strip":
        make_strip(
            arguments.input,
            arguments.out,
            arguments.state,
            arguments.frames,
            arguments.floating,
            arguments.grid_columns,
            arguments.grid_rows,
            arguments.grid_row,
            arguments.fit_scale,
            arguments.input_is_strip,
        )
    elif arguments.command == "source-strip":
        source_strip(arguments.atlas, arguments.out, arguments.row, arguments.frames)
    elif arguments.command == "first-frame":
        first_frame(arguments.input, arguments.out)
    elif arguments.command == "contact-sheet":
        contact_sheet(arguments.directory, arguments.out)
    elif arguments.command == "atlas-contact":
        atlas_contact(arguments.atlas, arguments.out)
    elif arguments.command == "animated-preview":
        animated_preview(arguments.directory, arguments.out)
    elif arguments.command == "animated-board":
        animated_board(arguments.directory, arguments.out)
    elif arguments.command == "alpha-stats":
        print(json.dumps(alpha_stats(arguments.input), indent=2))
    elif arguments.command == "grid-alpha-stats":
        print(
            json.dumps(
                grid_alpha_stats(arguments.input, arguments.columns, arguments.rows),
                indent=2,
            )
        )
    elif arguments.command == "strip-stats":
        print(json.dumps(strip_stats(arguments.input, arguments.frames), indent=2))
    elif arguments.command == "analyze-package":
        print(json.dumps(analyze_package(arguments.directory), indent=2))


if __name__ == "__main__":
    main()
