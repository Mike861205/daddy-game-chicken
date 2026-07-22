"""Remove a baked white/light-gray checkerboard from game PNG assets.

Only background-colored pixels connected to the image border are removed, so
white details enclosed by the product outline remain intact.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


def is_background_pixel(pixel: tuple[int, int, int, int]) -> int:
    red, green, blue, alpha = pixel
    brightest = max(red, green, blue)
    darkest = min(red, green, blue)
    return 255 if alpha < 8 or (darkest >= 218 and brightest - darkest <= 18) else 0


def remove_background(path: Path) -> tuple[int, int, int] | None:
    source = Image.open(path).convert("RGBA")
    width, height = source.size

    if source.getchannel("A").getextrema()[0] < 255:
        source.close()
        return None

    candidate = Image.new("L", source.size)
    pixels = source.get_flattened_data()
    candidate.putdata(is_background_pixel(pixel) for pixel in pixels)

    flooded = candidate.copy()
    draw = ImageDraw.Draw(flooded)
    seeds = {
        (0, 0),
        (width - 1, 0),
        (0, height - 1),
        (width - 1, height - 1),
        (width // 2, 0),
        (width // 2, height - 1),
        (0, height // 2),
        (width - 1, height // 2),
    }
    for seed in seeds:
        if flooded.getpixel(seed) == 255:
            ImageDraw.floodfill(flooded, seed, 128, thresh=0)

    subject_mask = flooded.point(lambda value: 0 if value == 128 else 255)
    # Contract by one pixel before feathering to eliminate the baked white rim.
    subject_mask = subject_mask.filter(ImageFilter.MinFilter(3))
    alpha = subject_mask.filter(ImageFilter.GaussianBlur(0.65))

    cleaned = source.copy()
    cleaned.putalpha(alpha)
    cleaned.save(path, format="PNG", optimize=True)

    alpha_values = alpha.histogram()
    transparent = sum(alpha_values[:8])
    partial = sum(alpha_values[8:248])
    opaque = sum(alpha_values[248:])
    source.close()
    cleaned.close()
    return transparent, partial, opaque


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("directory", type=Path)
    parser.add_argument("--exclude", action="append", default=[])
    args = parser.parse_args()

    excluded = set(args.exclude)
    for path in sorted(args.directory.glob("*.png")):
        if path.name in excluded:
            continue
        result = remove_background(path)
        if result is None:
            print(f"{path.name}: ya tenía transparencia, sin cambios", flush=True)
            continue
        transparent, partial, opaque = result
        print(
            f"{path.name}: transparent={transparent}, "
            f"edge={partial}, subject={opaque}",
            flush=True,
        )


if __name__ == "__main__":
    main()
