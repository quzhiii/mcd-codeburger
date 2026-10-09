#!/usr/bin/env python
"""
把生图结果处理成可直接上网页的资产。

做四件事：
  1. 去白底：从四边做连通域漫水填充，只删「和边框连在一起的白色」，
     不会伤到面包上的高光（高光被角色本身包围，和边框不连通）。
  2. 裁到内容外接框，再补成正方形，四周留一点安全边距。
  3. 缩到 512 / 256 两档。
  4. 顺便导出 WebP，用来对比体积。
     「PNG 放大糊」通常不是格式问题，是尺寸问题，所以尺寸给足就行。

产物：docs/art/chatgpt-v1/out/<id>.png / <id>@256.png / <id>.webp
运行：python scripts/prep-art.py
"""

import json
import sys
from collections import deque
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFilter
except ImportError:
    print('需要 Pillow：pip install Pillow', file=sys.stderr)
    raise

SRC = Path('docs/art/chatgpt-v1')
OUT = SRC / 'out'

# 判定「背景白」的门槛：亮且几乎无彩
WHITE_MIN = 236
SAT_MAX = 22

# 去底后四周留的安全边距（占画布边长比例）
PADDING = 0.04

# 小尺寸专用底盘：让主色在 48px 以下也能辨认
PLATE_SIZE = 256
PLATE_ALPHA = 0.20
PLATE_TARGET_LUM = 0.42  # 主色太浅时先压暗到这个亮度，保证八块底盘视觉重量一致


def hex_to_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def luminance(rgb):
    def lin(c):
        c = c / 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (lin(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def plate_color(hex_str, deep_hex):
    """把主色压到统一的视觉重量。浅色直接按亮度反比压暗，深色原样保留。"""
    rgb = hex_to_rgb(hex_str)
    lum = luminance(rgb)
    if lum <= PLATE_TARGET_LUM:
        return rgb
    # 往深色搭档的方向拉，保持色相不乱跑
    deep = hex_to_rgb(deep_hex)
    t = min(1.0, (lum - PLATE_TARGET_LUM) / max(lum, 1e-6) * 1.8)
    return tuple(int(round(rgb[i] * (1 - t) + deep[i] * t)) for i in range(3))


def draw_plate(draw, size, rgb):
    """画一个圆形底盘。 """
    a = int(255 * PLATE_ALPHA)
    r = size / 2
    cx = cy = size / 2
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=rgb + (a,))


def load_meta():
    meta_path = SRC / 'meta.json'
    if not meta_path.exists():
        print(f'缺少 {meta_path}，请先跑 npm run art:meta', file=sys.stderr)
        return {}
    return json.loads(meta_path.read_text(encoding='utf-8'))


def is_white(px):
    r, g, b = px[0], px[1], px[2]
    return min(r, g, b) >= WHITE_MIN and (max(r, g, b) - min(r, g, b)) <= SAT_MAX


def build_bg_mask(img):
    """从四边漫水填充，得到「背景」掩码（255 = 背景）"""
    w, h = img.size
    px = img.load()
    mask = Image.new('L', (w, h), 0)
    mpx = mask.load()
    q = deque()
    seen = bytearray(w * h)

    def push(x, y):
        if 0 <= x < w and 0 <= y < h and not seen[y * w + x] and is_white(px[x, y]):
            seen[y * w + x] = 1
            q.append((x, y))

    for x in range(w):
        push(x, 0)
        push(x, h - 1)
    for y in range(h):
        push(0, y)
        push(w - 1, y)

    while q:
        x, y = q.popleft()
        mpx[x, y] = 255
        push(x + 1, y)
        push(x - 1, y)
        push(x, y + 1)
        push(x, y - 1)

    return mask


def process(src_path: Path, out_stem: str, meta: dict):
    img = Image.open(src_path).convert('RGB')
    w, h = img.size

    bg = build_bg_mask(img)

    # 边缘羽化：轻微模糊，避免锯齿硬边
    bg = bg.filter(ImageFilter.GaussianBlur(1.1))

    alpha = Image.eval(bg, lambda v: 255 - v)
    out = img.convert('RGBA')
    out.putalpha(alpha)

    # 裁到内容外接框
    bbox = out.getbbox()
    if bbox:
        out = out.crop(bbox)

    # 补成正方形 + 边距
    side = max(out.size)
    side = int(side * (1 + PADDING * 2))
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.paste(out, ((side - out.width) // 2, (side - out.height) // 2), out)
    out = canvas

    OUT.mkdir(parents=True, exist_ok=True)
    big = out.resize((512, 512), Image.LANCZOS)
    small = out.resize((PLATE_SIZE, PLATE_SIZE), Image.LANCZOS)
    big.save(OUT / f'{out_stem}.png')
    small.save(OUT / f'{out_stem}@256.png')
    big.save(OUT / f'{out_stem}.webp', quality=88, method=6)

    # 小尺寸专用：给角色垫一块主色底盘，解决「缩到 40px 就分不清」的问题
    info = meta.get(out_stem[3:], {})
    if info:
        rgb = plate_color(info.get('color', '#e23b26'), info.get('deep', '#B22A19'))
        plate = Image.new('RGBA', (PLATE_SIZE, PLATE_SIZE), (0, 0, 0, 0))
        draw_plate(ImageDraw.Draw(plate), PLATE_SIZE, rgb)
        plate.alpha_composite(small)
        plate.save(OUT / f'{out_stem}@256-plated.png')

    # 统计：去掉了多少像素，用来判断这张图有没有残留白边
    removed = sum(1 for p in big.convert('RGBA').get_flattened_data() if p[3] < 8)
    return {
        'src': src_path.name,
        'src_size': (w, h),
        'png_kb': (OUT / f'{out_stem}.png').stat().st_size / 1024,
        'webp_kb': (OUT / f'{out_stem}.webp').stat().st_size / 1024,
        'transparent_pct': removed / (512 * 512) * 100,
    }


def main():
    files = sorted(p for p in SRC.glob('*.jpg'))
    if not files:
        print('docs/art/chatgpt-v1/ 下没有 jpg', file=sys.stderr)
        return 1
    meta = load_meta()
    print(f'{"文件":<26}{"原始":<12}{"PNG":>9}{"WebP":>9}{"透明占比":>10}')
    for f in files:
        r = process(f, f.stem, meta)
        print(
            f'{r["src"]:<26}{str(r["src_size"]):<12}'
            f'{r["png_kb"]:>8.0f}K{r["webp_kb"]:>8.0f}K{r["transparent_pct"]:>9.1f}%'
        )
    OUT.mkdir(parents=True, exist_ok=True)
    total_png = sum(p.stat().st_size for p in OUT.glob('*.png')) / 1024
    total_webp = sum(p.stat().st_size for p in OUT.glob('*.webp')) / 1024
    print(f'\n产物目录：{OUT}')
    print(f'PNG 合计 {total_png:.0f}K，WebP 与 PNG 混存合计 {total_webp:.0f}K（WebP 只出了一档取样）')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
