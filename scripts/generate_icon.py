#!/usr/bin/env python3
"""Generate a 1024x1024 RGBA app icon for PlayableForge using only the
stdlib (no Pillow/numpy available in this environment). Draws a rounded
gradient badge with a simple game-controller glyph, matching the app's
dark/indigo brand.
"""
import struct
import zlib
import math

SIZE = 1024

BG_GRADIENT_A = (99, 102, 241)   # #6366f1 indigo
BG_GRADIENT_B = (79, 70, 229)    # #4f46e5 deep indigo
WHITE = (255, 255, 255)
HOLE = (15, 17, 23)              # #0f1117 base bg (dpad / buttons)

CORNER_RADIUS = 200


def lerp(a, b, t):
    return a + (b - a) * t


def rounded_rect_sdf(x, y, cx, cy, half_w, half_h, r):
    qx = max(abs(x - cx) - (half_w - r), 0)
    qy = max(abs(y - cy) - (half_h - r), 0)
    return math.hypot(qx, qy) - r


def circle_sdf(x, y, cx, cy, radius):
    return math.hypot(x - cx, y - cy) - radius


def main():
    pixels = bytearray(SIZE * SIZE * 4)

    body_half_w, body_half_h, body_r = 360, 140, 140
    body_cx, body_cy = SIZE / 2, SIZE / 2

    dpad_cx, dpad_cy = SIZE / 2 - 190, SIZE / 2
    button_cx, button_cy = SIZE / 2 + 190, SIZE / 2

    for y in range(SIZE):
        for x in range(SIZE):
            idx = (y * SIZE + x) * 4

            # --- rounded canvas mask ---
            canvas_d = rounded_rect_sdf(
                x + 0.5, y + 0.5, SIZE / 2, SIZE / 2, SIZE / 2, SIZE / 2, CORNER_RADIUS
            )
            if canvas_d > 0:
                pixels[idx : idx + 4] = (0, 0, 0, 0)
                continue

            # diagonal gradient background
            t = (x + y) / (2 * SIZE)
            r = int(lerp(BG_GRADIENT_A[0], BG_GRADIENT_B[0], t))
            g = int(lerp(BG_GRADIENT_A[1], BG_GRADIENT_B[1], t))
            b = int(lerp(BG_GRADIENT_A[2], BG_GRADIENT_B[2], t))
            color = (r, g, b, 255)

            # controller body (capsule)
            if rounded_rect_sdf(x, y, body_cx, body_cy, body_half_w, body_half_h, body_r) <= 0:
                color = (*WHITE, 255)

                # dpad cross (hole)
                dpad_v = rounded_rect_sdf(x, y, dpad_cx, dpad_cy, 24, 78, 10)
                dpad_h = rounded_rect_sdf(x, y, dpad_cx, dpad_cy, 78, 24, 10)
                if dpad_v <= 0 or dpad_h <= 0:
                    color = (*HOLE, 255)

                # face buttons (diamond of 4 circles, holes)
                offsets = [(0, -70), (0, 70), (-70, 0), (70, 0)]
                for ox, oy in offsets:
                    if circle_sdf(x, y, button_cx + ox, button_cy + oy, 30) <= 0:
                        color = (*HOLE, 255)
                        break

            pixels[idx : idx + 4] = bytes(color)

    write_png("src-tauri/icons/icon-source.png", SIZE, SIZE, bytes(pixels))
    print("Wrote src-tauri/icons/icon-source.png")


def write_png(path, width, height, rgba_bytes):
    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)

    raw = bytearray()
    stride = width * 4
    for y in range(height):
        raw.append(0)  # filter type: none
        raw.extend(rgba_bytes[y * stride : (y + 1) * stride])

    idat = zlib.compress(bytes(raw), 9)

    with open(path, "wb") as f:
        f.write(sig)
        f.write(chunk(b"IHDR", ihdr))
        f.write(chunk(b"IDAT", idat))
        f.write(chunk(b"IEND", b""))


if __name__ == "__main__":
    main()
