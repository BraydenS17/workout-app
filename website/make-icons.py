#!/usr/bin/env python3
"""Generate PNG app icons (purple background + white dumbbell) with no deps."""
import zlib, struct

BG = (108, 99, 255)   # --accent
FG = (255, 255, 255)

def in_rect(x, y, x0, y0, x1, y1):
    return x0 <= x < x1 and y0 <= y < y1

def dumbbell(x, y, s):
    """Return True if pixel (x,y) is part of the white dumbbell at size s."""
    fx, fy = x / s, y / s
    rects = [
        (0.30, 0.455, 0.70, 0.545),  # bar
        (0.24, 0.36, 0.30, 0.64),    # left inner plate
        (0.18, 0.40, 0.24, 0.60),    # left outer plate
        (0.70, 0.36, 0.76, 0.64),    # right inner plate
        (0.76, 0.40, 0.82, 0.60),    # right outer plate
    ]
    return any(in_rect(fx, fy, *r) for r in rects)

def make(size, path):
    raw = bytearray()
    for y in range(size):
        raw.append(0)  # filter type 0 for each scanline
        for x in range(size):
            r, g, b = FG if dumbbell(x, y, size) else BG
            raw += bytes((r, g, b))
    def chunk(tag, data):
        c = tag + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xffffffff)
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)  # 8-bit RGB
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + \
          chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)
    print("wrote", path, size, "x", size)

for sz, name in [(180, "icon-180.png"), (192, "icon-192.png"), (512, "icon-512.png")]:
    make(sz, name)
