# -*- coding: utf-8 -*-
"""鱼小铺抖音竖屏渲染器（1080x1920, 9:16）：
- 钩子/结尾卡：渐变底 + 产品 logo + 大字文案
- 功能段：真实界面截图（模糊底 + 圆角前景 + Ken Burns 运镜 + 鼠标点击演示）
  + 顶部章节条 + 底部烧录大字幕（随配音 cue 切换）+ 进度条
输出 H.264 MP4。用 skill .venv 运行。"""
import json
import math
import os

import av
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

BASE = os.path.dirname(os.path.abspath(__file__))
W, H = 1080, 1920
FPS = 30
SHOTS = os.path.join(BASE, "shots")

ACCENT = (255, 170, 40)
WHITE = (245, 245, 245)


def ease(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def load_font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


FBOLD = load_font("C:/Windows/Fonts/msyhbd.ttc", 68)
FBOLD_SM = load_font("C:/Windows/Fonts/msyhbd.ttc", 46)
FCAP = load_font("C:/Windows/Fonts/msyhbd.ttc", 54)
FCHIP = load_font("C:/Windows/Fonts/msyh.ttc", 30)

CLICKS = {
    "seg-01": [],
    "seg-02": [(469, 239)],
    "seg-03": [(1826, 109)],
    "seg-04": [(1731, 109), (1226, 452)],
    "seg-05": [(1840, 109)],
    "seg-06": [(1485, 109)],
    "seg-07": [(630, 966)],
    "seg-08": [(1833, 109)],
    "seg-09": [(1825, 125), (1617, 492)],
    "seg-10": [(1825, 109)],
    "seg-11": [(1567, 28)],
}

FG_W, FG_H, FG_X, FG_Y = 1000, 563, 40, 340   # 前景截图位置


def build_gradient():
    img = Image.new("RGB", (W, H))
    top, bottom = (30, 32, 40), (16, 17, 22)
    for y in range(H):
        k = y / H
        img.paste(tuple(int(top[i] + (bottom[i] - top[i]) * k) for i in range(3)),
                  [0, y, W, y + 1])
    d = ImageDraw.Draw(img, "RGBA")
    d.ellipse([W - 420, -260, W + 260, 420], fill=(255, 170, 40, 26))
    d.ellipse([-300, H - 500, 320, H + 120], fill=(90, 135, 210, 22))
    return img


GRADIENT = build_gradient()
LOGO = Image.open(os.path.join(BASE, "logo.png")).convert("RGBA")

# 前景圆角掩码与阴影（全局静态尺寸，只算一次）
def build_round_mask(w, h, r):
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], radius=r, fill=255)
    return m

ROUND_MASK = build_round_mask(FG_W, FG_H, 24)
SHADOW = Image.new("RGBA", (FG_W + 60, FG_H + 60), (0, 0, 0, 0))
ImageDraw.Draw(SHADOW).rounded_rectangle([30, 30, FG_W + 30, FG_H + 30], radius=24, fill=(0, 0, 0, 150))
SHADOW = SHADOW.filter(ImageFilter.GaussianBlur(18))


def cover_blur(shot_path):
    """截图 → 竖屏铺满模糊底（每段一次）。"""
    img = Image.open(shot_path).convert("RGB")
    scale = H / img.height
    big = img.resize((int(img.width * scale), H), Image.BILINEAR)
    x0 = (big.width - W) // 2
    bg = big.crop((x0, 0, x0 + W, H)).filter(ImageFilter.GaussianBlur(38))
    d = ImageDraw.Draw(bg, "RGBA")
    d.rectangle([0, 0, W, H], fill=(10, 10, 14, 130))
    return bg


class Seg:
    def __init__(self, meta, index):
        self.seg_id = meta["segId"]
        self.kind = meta["type"]
        self.chapter = meta["chapter"]
        self.lines = meta.get("lines")
        self.start = meta["start"]
        self.dur = meta["dur"]
        self.cues = meta["cues"]
        self.index = index
        self.targets = CLICKS.get(self.seg_id, [])
        self.blur_bg = None
        if self.kind == "ui":
            self.img = Image.open(os.path.join(SHOTS, meta["shot"])).convert("RGB")
            self.blur_bg = cover_blur(os.path.join(SHOTS, meta["shot"]))

    # ── 钩子/结尾卡 ──
    def card_frame(self, lt):
        frame = GRADIENT.copy()
        d = ImageDraw.Draw(frame, "RGBA")
        alpha = int(255 * ease(lt / 0.6))
        if self.kind == "outro":
            logo = LOGO.resize((230, 230), Image.LANCZOS)
            frame.paste(logo, ((W - 230) // 2, 560), logo)
            y = 880
            for text, accent in self.lines:
                f = FBOLD_SM if not accent else load_font("C:/Windows/Fonts/msyhbd.ttc", 56)
                tw = d.textlength(text, font=f)
                d.text(((W - tw) / 2, y), text, font=f,
                       fill=(*ACCENT, alpha) if accent else (*WHITE, alpha))
                y += 96
            d.text((W / 2 - 90, y + 60), "", font=FCHIP)
        else:
            logo = LOGO.resize((96, 96), Image.LANCZOS)
            frame.paste(logo, ((W - 96) // 2, 150), logo)
            d.text((W / 2 - 62, 258), "鱼小铺", font=FCHIP, fill=(*WHITE, alpha))
            y = 820
            for text, accent in self.lines:
                f = FBOLD
                tw = d.textlength(text, font=f)
                d.text(((W - tw) / 2, y), text, font=f,
                       fill=(*ACCENT, alpha) if accent else (*WHITE, alpha))
                y += 128
        return frame

    # ── UI 段 ──
    def view_box(self, lt):
        z = 1.0 + 0.16 * ease(lt / max(0.1, self.dur - 1.5))
        vw, vh = 1920 / z, 1080 / z
        if self.targets:
            tx, ty = self.targets[0]
        else:
            tx, ty = 960, 540
        drift = ease(lt / max(0.1, self.dur - 1.5))
        cx = 960 + (tx - 960) * 0.36 * drift
        cy = 540 + (ty - 540) * 0.36 * drift
        cx = max(vw / 2, min(1920 - vw / 2, cx))
        cy = max(vh / 2, min(1080 - vh / 2, cy))
        x0, y0 = int(round(cx - vw / 2)), int(round(cy - vh / 2))
        return x0, y0, x0 + int(round(vw)), y0 + int(round(vh))

    def cursor_pos(self, lt):
        if not self.targets or lt < 0.8:
            return None
        clicks = [(self.dur * 0.42, *self.targets[0])]
        if len(self.targets) > 1:
            clicks.append((self.dur * 0.74, *self.targets[1]))
        pts = [(0.8, 1750, 990)]
        for ct, cx, cy in clicks:
            pts.append((ct - 0.5, cx, cy))
        for i in range(len(pts) - 1):
            t0, x0, y0 = pts[i]
            t1, x1, y1 = pts[i + 1]
            if lt <= t1:
                k = ease((lt - t0) / max(0.01, t1 - t0))
                return (x0 + (x1 - x0) * k, y0 + (y1 - y0) * k)
        return (pts[-1][1], pts[-1][2])

    def current_caption(self, lt):
        for cue in self.cues:
            if cue["start"] <= lt <= cue["end"] + 0.5:
                return cue["text"]
        return None

    def ui_frame(self, lt):
        frame = self.blur_bg.copy()
        box = self.view_box(lt)
        bw, bh = box[2] - box[0], box[3] - box[1]
        fg = self.img.crop(box).resize((FG_W, FG_H), Image.BILINEAR).convert("RGBA")

        overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        od = ImageDraw.Draw(overlay)

        # 阴影 + 圆角前景
        overlay.alpha_composite(SHADOW, (FG_X - 30, FG_Y - 30))
        fg.putalpha(ROUND_MASK)
        overlay.alpha_composite(fg, (FG_X, FG_Y))

        def to_view(sx, sy):
            return (FG_X + (sx - box[0]) * FG_W / bw, FG_Y + (sy - box[1]) * FG_H / bh)

        # 点击涟漪
        if self.targets:
            clicks = [(self.dur * 0.42, *self.targets[0])]
            if len(self.targets) > 1:
                clicks.append((self.dur * 0.74, *self.targets[1]))
            for ct, cx, cy in clicks:
                dt = lt - ct
                if 0 <= dt <= 0.65:
                    k = dt / 0.65
                    r = 12 + 46 * ease(k)
                    a = int(220 * (1 - k))
                    vx, vy = to_view(cx, cy)
                    od.ellipse([vx - r, vy - r, vx + r, vy + r], outline=(255, 150, 40, a), width=5)
                    if dt < 0.12:
                        od.ellipse([vx - 8, vy - 8, vx + 8, vy + 8], fill=(255, 255, 255, 210))

        # 顶部章节条
        chip_alpha = int(220 * ease(lt / 0.45))
        label = f"{self.index:02d} · {self.chapter}"
        tw = od.textlength(label, font=FCHIP)
        x0, y0 = 40, 220
        od.rounded_rectangle([x0, y0, x0 + tw + 46, y0 + 48], radius=10,
                             fill=(20, 20, 26, chip_alpha))
        od.rectangle([x0 + 14, y0 + 11, x0 + 19, y0 + 37], fill=(255, 170, 40, chip_alpha))
        od.text((x0 + 30, y0 + 10), label, font=FCHIP, fill=(255, 255, 255, chip_alpha))

        # 底部烧录大字幕（随 cue 切换）
        cap = self.current_caption(lt)
        if cap:
            cap_alpha = 245
            l1, l2 = wrap_caption(cap)
            y = 1500 if l2 else 1546
            for line in (l1, l2):
                if not line:
                    continue
                tw = od.textlength(line, font=FCAP)
                cx0, cy0 = (W - tw) / 2, y
                od.rounded_rectangle([cx0 - 26, cy0 - 12, cx0 + tw + 26, cy0 + 74],
                                     radius=14, fill=(12, 12, 16, 165))
                od.text((cx0, cy0), line, font=FCAP, fill=(255, 255, 255, cap_alpha),
                        stroke_width=4, stroke_fill=(8, 8, 10))
                y += 100

        frame = Image.alpha_composite(frame.convert("RGBA"), overlay).convert("RGB")

        # 鼠标光标
        cpos = self.cursor_pos(lt)
        if cpos is not None:
            vx, vy = to_view(*cpos)
            vx = min(max(vx, 2), W - 22)
            vy = min(max(vy, 2), H - 32)
            d2 = ImageDraw.Draw(frame)
            s = 1.5
            pts = [(0, 0), (0, 16), (4, 12.4), (6.7, 18), (9.2, 16.5), (6.8, 10.9), (11.4, 9.6)]
            d2.polygon([(vx + x * s, vy + y * s) for x, y in pts],
                       outline=(20, 20, 24), fill=(255, 255, 255), width=2)
        return frame


def cap_start_of(cues, text):
    for c in cues:
        if c["text"] == text:
            return c["start"]
    return 0.0


def wrap_caption(text):
    if len(text) <= 16:
        return text, None
    cut = len(text) // 2
    for i in range(min(6, len(text) - cut)):
        if cut + i < len(text) and text[cut + i] in "，。；：、？！":
            cut = cut + i + 1
            break
    else:
        for j in range(min(6, cut)):
            if text[cut - j - 1] in "，。；：、？！":
                cut = cut - j
                break
    return text[:cut], text[cut:]


def main():
    with open(os.path.join(BASE, "vertical_timeline.json"), encoding="utf-8") as f:
        tl = json.load(f)
    total, trans = tl["total"], tl["trans"]
    segs = [Seg(m, i + 1) for i, m in enumerate(tl["segments"])]

    out_path = os.path.join(BASE, "douyin-vertical-raw.mp4")
    container = av.open(out_path, mode="w")
    stream = container.add_stream("h264", rate=FPS)
    stream.width, stream.height = W, H
    stream.pix_fmt = "yuv420p"
    stream.options = {"crf": "21", "preset": "medium"}

    n_frames = int(round(total * FPS))
    print(f"渲染 {n_frames} 帧（{total:.1f}s）...")
    for fi in range(n_frames):
        t = fi / FPS
        i = 0
        for k, s in enumerate(segs):
            if s.start <= t < s.start + s.dur:
                i = k
                break
        else:
            i = len(segs) - 1
        seg = segs[i]
        lt = t - seg.start
        frame = seg.card_frame(lt) if seg.kind in ("card", "outro") else seg.ui_frame(lt)

        if i + 1 < len(segs) and t >= segs[i + 1].start:
            a = ease(min(1.0, (t - segs[i + 1].start) / trans))
            nxt = segs[i + 1]
            lt2 = t - nxt.start
            nxt_frame = nxt.card_frame(lt2) if nxt.kind in ("card", "outro") else nxt.ui_frame(lt2)
            frame = Image.blend(frame, nxt_frame, a)

        d = ImageDraw.Draw(frame)
        d.rectangle([0, H - 6, W, H], fill=(255, 255, 255))
        d.rectangle([0, H - 6, int(W * t / total), H], fill=ACCENT)
        for s in segs[1:]:
            x = int(W * s.start / total)
            d.rectangle([x, H - 6, x + 2, H], fill=(16, 16, 20))

        arr = np.asarray(frame, dtype=np.uint8)
        for pkt in stream.encode(av.VideoFrame.from_ndarray(arr, format="rgb24")):
            container.mux(pkt)
        if fi % 600 == 0:
            print(f"  {fi}/{n_frames} ({t:.0f}s)")

    for pkt in stream.encode(None):
        container.mux(pkt)
    container.close()
    print(f"OK -> {out_path} ({os.path.getsize(out_path)/1048576:.1f} MB)")


if __name__ == "__main__":
    main()
