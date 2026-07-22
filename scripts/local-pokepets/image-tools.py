from __future__ import annotations

import argparse
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


def pixel_fit(image: Image.Image, floating: bool) -> Image.Image:
    subject = crop_alpha(image)
    max_width = 168
    max_height = 176 if floating else 190
    scale = min(max_width / subject.width, max_height / subject.height, 1.0)
    width = max(1, round(subject.width * scale))
    height = max(1, round(subject.height * scale))
    return subject.resize((width, height), Image.Resampling.NEAREST)


def motion(state: str, index: int, frames: int) -> tuple[int, int, float, float]:
    phase = 2 * math.pi * index / frames
    sine = math.sin(phase)
    cosine = math.cos(phase)
    if state == "idle":
        return 0, round(-1.5 * sine), 0.0, 1.0 + 0.008 * sine
    if state == "thinking":
        return round(sine), 0, 1.25 * sine, 1.0
    if state == "typing":
        return (-1 if index % 2 else 1), (-1 if index % 4 in (1, 2) else 0), 0.0, 1.0
    if state == "working":
        return round(0.8 * sine), round(-0.8 * abs(sine)), 0.5 * sine, 1.0
    if state == "approval":
        return 0, round(-2 * max(0, sine)), -0.8 * sine, 1.0
    if state == "waiting_input":
        return 0, round(-0.7 * sine), 0.3 * sine, 1.0
    if state == "success":
        jump = [0, -10, -25, -38, -25, -10, 0, 0][index * 8 // frames]
        return round(2 * sine), jump, -2.0 * sine, 1.0
    if state == "error":
        return 0, round(2 * (1 - cosine)), 0.6 * sine, 1.0 - 0.018 * abs(sine)
    if state == "quota_low":
        return (-1 if index % 2 else 1), round(abs(sine)), 0.7 * sine, 1.0
    if state == "quota_empty":
        return 0, round(1.5 * (1 - cosine)), 0.4 * sine, 1.0 - 0.012 * abs(sine)
    if state == "offline":
        return 0, (1 if index == frames // 2 else 0), 0.0, 1.0
    if state == "sleep":
        return 0, round(-1.0 * sine), 0.0, 1.0 + 0.006 * sine
    raise ValueError(f"Unsupported state: {state}")


def transform_subject(subject: Image.Image, angle: float, scale_y: float) -> Image.Image:
    height = max(1, round(subject.height * scale_y))
    transformed = subject.resize((subject.width, height), Image.Resampling.NEAREST)
    if abs(angle) >= 0.01:
        transformed = transformed.rotate(
            angle,
            resample=Image.Resampling.NEAREST,
            expand=True,
            fillcolor=(0, 0, 0, 0),
        )
    return transformed


def make_strip(input_path: str, output_path: str, state: str, frames: int, floating: bool) -> None:
    subject = pixel_fit(opened(input_path), floating)
    strip = Image.new("RGBA", (FRAME_WIDTH * frames, FRAME_HEIGHT), (0, 0, 0, 0))
    base_center_y = 108 if floating else 196 - subject.height // 2
    for index in range(frames):
        dx, dy, angle, scale_y = motion(state, index, frames)
        frame_subject = transform_subject(subject, angle, scale_y)
        center_x = FRAME_WIDTH // 2 + dx
        center_y = base_center_y + dy
        x = index * FRAME_WIDTH + center_x - frame_subject.width // 2
        y = center_y - frame_subject.height // 2
        strip.alpha_composite(frame_subject, (x, y))
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    strip.save(output_path, "WEBP", lossless=True, method=6)


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
    strip.save(output_path, "WEBP", lossless=True, method=6)


def first_frame(strip_path: str, output_path: str) -> None:
    strip = opened(strip_path).convert("RGBA")
    frame = strip.crop((0, 0, FRAME_WIDTH, FRAME_HEIGHT))
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    frame.save(output_path, "WEBP", lossless=True, method=6)


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


def analyze_package(directory: str) -> dict[str, object]:
    root = Path(directory)
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    states: dict[str, object] = {}
    for state in STATE_ORDER:
        animation = manifest["animations"][state]
        strip = opened(root / animation["sprite"]).convert("RGBA")
        frame_results = []
        centers: list[tuple[float, float]] = []
        baselines: list[int] = []
        for index in range(animation["frames"]):
            frame = strip.crop((index * FRAME_WIDTH, 0, (index + 1) * FRAME_WIDTH, FRAME_HEIGHT))
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
        states[state] = {
            "frames": animation["frames"],
            "fps": animation["fps"],
            "blankFrames": sum(1 for frame in frame_results if frame["blank"]),
            "edgeTouches": sum(1 for frame in frame_results if frame.get("touchesEdge")),
            "centerDriftX": round(max((center[0] for center in centers), default=0) - min((center[0] for center in centers), default=0), 2),
            "centerDriftY": round(max((center[1] for center in centers), default=0) - min((center[1] for center in centers), default=0), 2),
            "maxCenterStep": round(max(center_steps, default=0), 2),
            "loopCenterDelta": round(math.dist(centers[0], centers[-1]), 2) if centers else None,
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
    alpha_parser = subparsers.add_parser("alpha-stats")
    alpha_parser.add_argument("--input", required=True)
    analyze_parser = subparsers.add_parser("analyze-package")
    analyze_parser.add_argument("--directory", required=True)
    arguments = parser.parse_args()
    if arguments.command == "verify":
        verify(arguments.input)
    elif arguments.command == "reference":
        reference(arguments.atlas, arguments.preview, arguments.out)
    elif arguments.command == "strip":
        make_strip(arguments.input, arguments.out, arguments.state, arguments.frames, arguments.floating)
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
    elif arguments.command == "alpha-stats":
        print(json.dumps(alpha_stats(arguments.input), indent=2))
    elif arguments.command == "analyze-package":
        print(json.dumps(analyze_package(arguments.directory), indent=2))


if __name__ == "__main__":
    main()
