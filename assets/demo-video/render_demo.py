# -*- coding: utf-8 -*-
"""鱼小铺产品演示视频渲染器：真实界面截图 + Ken Burns 运镜 + 鼠标点击操作演示
+ 段间交叉转场 + 章节字幕条 + 底部进度条。输出 H.264 MP4。用 skill .venv 运行。"""
import json
import math
import os

import av
import numpy as np
from PIL import Image, ImageDraw, ImageFont

BASE = os.path.dirname(os.path.abspath(__file__))
W, H = 1280, 720
FPS = 30
SHOTS = os.path.join(BASE, "shots")
FONT = "C:/Windows/Fonts/msyh.ttc"

ACCENT = (255, 140, 40)
DARK = (24, 24, 28)

# 每段鼠标演示的操作点（1920x1080 源图坐标，来自真实页面测量）
CLICKS = {
    "seg-01": [],
    "seg-02": [(469, 239)],            # 7天内 时间范围
    "seg-03": [(1826, 109)],           # 扫码添加账号
    "seg-04": [(1731, 109), (1226, 452)],  # 同步商品 / 配置自动发货
    "seg-05": [(1840, 109)],           # 添加卡密
    "seg-06": [(1485, 109)],           # 刷新订单
    "seg-07": [(630, 966)],            # 发送图片
    "seg-08": [(1833, 109)],           # 添加关键词
    "seg-09": [(1825, 125), (1617, 492)],  # 保存配置 / 测试回复
    "seg-10": [(1825, 109)],           # 保存设置
    "seg-11": [(1567, 28)],            # 主题色下拉
}


def ease(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def load_font(size):
    try:
        return ImageFont.truetype(FONT, size)
    except OSError:
        return ImageFont.load_default()


FONT_CHIP = load_font(24)
FONT_NUM = load_font(18)


class Segment:
    def __init__(self, meta, index):
        self.seg_id = meta["segId"]
        self.title = meta["title"]
        self.start = meta["start"]
        self.dur = meta["dur"]
        self.index = index
        self.img = Image.open(os.path.join(SHOTS, meta["shot"])).convert("RGB")
        self.targets = CLICKS.get(self.seg_id, [])

    # ── 运镜：视野裁剪框 ──
    def view_box(self, lt):
        z = 1.0 + 0.18 * ease(lt / max(0.1, self.dur - 1.6))
        vw, vh = 1920 / z, 1080 / z
        if self.targets:
            tx, ty = self.targets[0]
            drift = ease(lt / max(0.1, self.dur - 1.6))
        else:
            tx, ty = 960, 540
            drift = ease(lt / max(0.1, self.dur - 1.6)) * 0.5
        cx = 960 + (tx - 960) * 0.38 * drift
        cy = 540 + (ty - 540) * 0.38 * drift
        cx = max(vw / 2, min(1920 - vw / 2, cx))
        cy = max(vh / 2, min(1080 - vh / 2, cy))
        x0, y0 = int(round(cx - vw / 2)), int(round(cy - vh / 2))
        return x0, y0, x0 + int(round(vw)), y0 + int(round(vh))

    # ── 鼠标计划 ──
    def cursor_plan(self, lt):
        """返回 (src_x, src_y, visible) 或 None；clicks=[(t, x, y)]"""
        if not self.targets:
            return None, []
        clicks = []
        c1 = self.dur * 0.42
        clicks.append((c1, *self.targets[0]))
        if len(self.targets) > 1:
            c2 = self.dur * 0.74
            clicks.append((c2, *self.targets[1]))
        return (1750, 990), clicks

    def cursor_pos(self, lt):
        start, clicks = self.cursor_plan(lt)
        if start is None or lt < 0.8:
            return None
        if not clicks:
            return start
        pts = [(0.8, start[0], start[1])]
        for ct, cx, cy in clicks:
            pts.append((ct - 0.5, cx, cy))
        for i in range(len(pts) - 1):
            t0, x0, y0 = pts[i]
            t1, x1, y1 = pts[i + 1]
            if lt <= t1:
                k = ease((lt - t0) / max(0.01, t1 - t0))
                return (x0 + (x1 - x0) * k, y0 + (y1 - y0) * k)
        return (pts[-1][1], pts[-1][2])


def draw_cursor(frame, pos):
    """在视频帧上画白箭头光标（含黑描边）。"""
    px, py = pos
    s = 1.55
    pts = [(0, 0), (0, 17), (4.2, 13.2), (7.2, 19.2), (9.9, 17.6), (7.3, 11.6), (12.3, 10.2)]
    poly = [(px + x * s, py + y * s) for x, y in pts]
    d = ImageDraw.Draw(frame)
    d.polygon(poly, outline=(20, 20, 24), fill=(255, 255, 255), width=2)


def seg_frame(seg, lt):
    box = seg.view_box(lt)
    bw, bh = box[2] - box[0], box[3] - box[1]
    frame = seg.img.crop(box).resize((W, H), Image.BILINEAR)

    # 源坐标 -> 视频坐标
    def to_view(sx, sy):
        return ((sx - box[0]) * W / bw, (sy - box[1]) * H / bh)

    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)

    # 点击涟漪
    _, clicks = seg.cursor_plan(lt)
    for ct, cx, cy in clicks:
        dt = lt - ct
        if 0 <= dt <= 0.65:
            k = dt / 0.65
            r = 12 + 62 * ease(k)
            alpha = int(220 * (1 - k))
            vx, vy = to_view(cx, cy)
            od.ellipse([vx - r, vy - r, vx + r, vy + r], outline=(255, 140, 40, alpha), width=5)
            if dt < 0.12:
                rr = 9
                od.ellipse([vx - rr, vy - rr, vx + rr, vy + rr], fill=(255, 255, 255, 200))

    # 章节字幕条（左下角）
    chip_alpha = int(215 * ease(lt / 0.45))
    label = f"{seg.index:02d} · {seg.title}"
    tw = od.textlength(label, font=FONT_CHIP)
    x0, y0 = 26, H - 62
    od.rounded_rectangle([x0, y0, x0 + tw + 44, y0 + 40], radius=8, fill=(24, 24, 28, chip_alpha))
    od.rectangle([x0 + 12, y0 + 9, x0 + 16, y0 + 31], fill=(255, 140, 40, chip_alpha))
    od.text((x0 + 26, y0 + 8), label, font=FONT_CHIP, fill=(255, 255, 255, chip_alpha))

    frame = Image.alpha_composite(frame.convert("RGBA"), overlay).convert("RGB")

    # 光标
    cpos = seg.cursor_pos(lt)
    if cpos is not None:
        vx, vy = to_view(*cpos)
        vx = min(max(vx, 2), W - 22)
        vy = min(max(vy, 2), H - 32)
        draw_cursor(frame, (vx, vy))
    return frame


def main():
    with open(os.path.join(BASE, "demo_timeline.json"), encoding="utf-8") as f:
        tl = json.load(f)
    total, trans = tl["total"], tl["trans"]
    segs = [Segment(m, i + 1) for i, m in enumerate(tl["segments"])]

    out_path = os.path.join(BASE, "demo-video-raw.mp4")
    container = av.open(out_path, mode="w")
    stream = container.add_stream("h264", rate=FPS)
    stream.width, stream.height = W, H
    stream.pix_fmt = "yuv420p"
    stream.options = {"crf": "20", "preset": "medium"}

    n_frames = int(round(total * FPS))
    print(f"渲染 {n_frames} 帧（{total:.1f}s）...")
    for fi in range(n_frames):
        t = fi / FPS
        # 当前段
        i = 0
        for k, s in enumerate(segs):
            if s.start <= t < s.start + s.dur:
                i = k
                break
        else:
            i = len(segs) - 1
        frame = seg_frame(segs[i], t - segs[i].start)
        # 交叉转场
        if i + 1 < len(segs) and t >= segs[i + 1].start:
            a = min(1.0, (t - segs[i + 1].start) / trans)
            nxt = seg_frame(segs[i + 1], t - segs[i + 1].start)
            frame = Image.blend(frame, nxt, ease(a))

        # 底部进度条
        d = ImageDraw.Draw(frame)
        d.rectangle([0, H - 5, W, H], fill=(255, 255, 255))
        fill_w = int(W * t / total)
        d.rectangle([0, H - 5, fill_w, H], fill=ACCENT)
        for s in segs[1:]:
            x = int(W * s.start / total)
            d.rectangle([x, H - 5, x + 2, H], fill=(24, 24, 28))

        arr = np.asarray(frame, dtype=np.uint8)
        vf = av.VideoFrame.from_ndarray(arr, format="rgb24")
        for pkt in stream.encode(vf):
            container.mux(pkt)
        if fi % 600 == 0:
            print(f"  {fi}/{n_frames}  ({t:.0f}s)")

    for pkt in stream.encode(None):
        container.mux(pkt)
    container.close()
    size_mb = os.path.getsize(out_path) / 1048576
    print(f"OK -> {out_path} ({size_mb:.1f} MB)")


if __name__ == "__main__":
    main()
