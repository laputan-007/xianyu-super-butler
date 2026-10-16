# -*- coding: utf-8 -*-
"""鱼小铺功能介绍视频：PIL 绘制 6 幕白板线稿图（1920x1080, 2x 超采样抗锯齿）。
视觉规范：暖米黄纸底 #F5EBD7、深灰草图线、红/橙/蓝少量点缀、无文字。"""
import math
import random
from PIL import Image, ImageDraw

random.seed(20261016)

W, H = 1920, 1080
SS = 2
BG = (245, 235, 215)          # #F5EBD7
INK = (74, 72, 68)            # 深灰草图线
RED = (192, 80, 77)
RED_W = (236, 196, 192)       # 淡红洗色
ORANGE = (227, 155, 59)
ORANGE_W = (244, 214, 168)
BLUE = (90, 135, 176)
BLUE_W = (198, 218, 238)

BASE = r"D:\qye\workspace_2026\custome-project\xianyu-super-butler\assets\whiteboard\yuxiaopu-intro"


# ───────────────── 基础手绘原语（坐标统一 ×SS 超采样 + 抖动）─────────────────
def J(pts, amp=1.5, seg=12):
    """把 1920x1080 坐标系的多段线缩放到超采样画布并加抖动。"""
    pts = [(x * SS, y * SS) for x, y in pts]
    amp, seg = amp * SS, seg * SS
    out = []
    for i in range(len(pts) - 1):
        x1, y1 = pts[i]
        x2, y2 = pts[i + 1]
        d = math.hypot(x2 - x1, y2 - y1)
        n = max(1, int(d / seg))
        for k in range(n + 1):
            t = k / n
            jx = random.uniform(-amp, amp) if 0 < k < n else 0
            jy = random.uniform(-amp, amp) if 0 < k < n else 0
            out.append((x1 + (x2 - x1) * t + jx, y1 + (y2 - y1) * t + jy))
    return out


def L(d, pts, w=5, c=INK, amp=1.5):
    d.line(J(pts, amp), fill=c, width=int(w * SS), joint="curve")


def E(d, cx, cy, rx, ry, w=5, c=INK, fill=None, amp=1.3):
    pts = [(cx + rx * math.cos(2 * math.pi * i / 72),
            cy + ry * math.sin(2 * math.pi * i / 72)) for i in range(73)]
    pts = J(pts, amp)
    pts[-1] = pts[0]
    if fill:
        d.polygon(pts, fill=fill)
    d.line(pts, fill=c, width=int(w * SS), joint="curve")


def ARC(d, cx, cy, rx, ry, a0, a1, w=5, c=INK, amp=1.2):
    n = max(8, int(abs(a1 - a0) / 0.12))
    pts = [(cx + rx * math.cos(a0 + (a1 - a0) * i / n),
            cy + ry * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]
    d.line(J(pts, amp), fill=c, width=int(w * SS), joint="curve")


def RR(d, x0, y0, x1, y1, r=18, w=5, c=INK, fill=None):
    pts = []

    def arc(cx, cy, a0, a1):
        for i in range(9):
            a = a0 + (a1 - a0) * i / 8
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))

    arc(x0 + r, y0 + r, math.pi, 1.5 * math.pi)
    arc(x1 - r, y0 + r, 1.5 * math.pi, 2 * math.pi)
    arc(x1 - r, y1 - r, 0, 0.5 * math.pi)
    arc(x0 + r, y1 - r, 0.5 * math.pi, math.pi)
    pts.append(pts[0])
    pts = J(pts, 1.0)
    if fill:
        d.polygon(pts, fill=fill)
    d.line(pts, fill=c, width=int(w * SS), joint="curve")


def RECT(d, x0, y0, x1, y1, fill=None):
    d.rectangle([x0 * SS, y0 * SS, x1 * SS, y1 * SS], fill=fill)


def POLY(d, pts, fill=None, w=5, c=INK, amp=1.0):
    pts = J(list(pts), amp)
    if fill:
        d.polygon(pts, fill=fill)
    d.line(pts + [pts[0]], fill=c, width=int(w * SS), joint="curve")


def ARROW(d, x0, y0, x1, y1, w=5, c=INK):
    L(d, [(x0, y0), (x1, y1)], w, c)
    a = math.atan2(y1 - y0, x1 - x0)
    for da in (2.65, -2.65):
        L(d, [(x1, y1), (x1 + 30 * math.cos(a + da), y1 + 30 * math.sin(a + da))], w, c)


def STAR5(d, cx, cy, r, w=4, c=ORANGE, fill=None):
    pts = []
    for i in range(10):
        a = -math.pi / 2 + math.pi * i / 5
        rr = r if i % 2 == 0 else r * 0.45
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    POLY(d, pts, fill or ORANGE_W, w, c)


def SPARK(d, cx, cy, r, c=ORANGE, fill=None):
    pts = []
    for i in range(8):
        a = math.pi / 4 * i
        rr = r if i % 2 == 0 else r * 0.26
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    POLY(d, pts, fill or ORANGE_W, 4, c)


def HEART(d, cx, cy, s, w=5, c=RED, fill=None):
    pts = []
    for i in range(41):
        t = 2 * math.pi * i / 40
        x = 16 * math.sin(t) ** 3
        y = -(13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t))
        pts.append((cx + x * s / 16, cy + y * s / 16))
    POLY(d, pts, fill or RED_W, w, c)


def FLOWER(d, cx, cy, r, w=4, c=RED):
    for i in range(6):
        a = 2 * math.pi * i / 6
        E(d, cx + r * 0.72 * math.cos(a), cy + r * 0.72 * math.sin(a),
          r * 0.5, r * 0.42, w, c, RED_W)
    E(d, cx, cy, r * 0.32, r * 0.32, w, ORANGE, ORANGE_W)


def GEAR(d, cx, cy, r, w=5, c=INK, teeth=8):
    E(d, cx, cy, r * 0.74, r * 0.74, w, c)
    E(d, cx, cy, r * 0.22, r * 0.22, w, c, None)
    for i in range(teeth):
        a = 2 * math.pi * i / teeth
        L(d, [(cx + r * 0.72 * math.cos(a), cy + r * 0.72 * math.sin(a)),
              (cx + r * 1.0 * math.cos(a), cy + r * 1.0 * math.sin(a))], int(w * 2.2), c, amp=0.5)


def CHECK(d, pts, w=7, c=BLUE):
    L(d, pts, w, c)


def BOLT(d, cx, cy, s, w=5, c=ORANGE):
    POLY(d, [(cx - s * 0.28, cy - s), (cx + s * 0.25, cy - s * 0.15),
             (cx - s * 0.02, cy - s * 0.1), (cx + s * 0.3, cy + s),
             (cx - s * 0.22, cy + s * 0.1), (cx + s * 0.02, cy + s * 0.05)],
         ORANGE_W, w, c)


def ZIG(d, x0, y0, w_total, c=INK, w=4):
    pts = []
    x, up = x0, True
    while x < x0 + w_total:
        pts.append((x, y0 + (-7 if up else 7)))
        x += 16
        up = not up
    L(d, pts, w, c, amp=0.8)


def BUBBLE(d, cx, cy, rx, ry, w=5, c=INK):
    E(d, cx, cy, rx, ry, w, c)
    L(d, [(cx - rx * 0.35, cy + ry * 0.72), (cx - rx * 0.5, cy + ry * 1.3),
          (cx - rx * 0.05, cy + ry * 0.88)], w, c)


def PHONE(d, x, y, w_, h_, w=5, c=INK):
    RR(d, x, y, x + w_, y + h_, 24, w, c)
    RR(d, x + 14, y + 44, x + w_ - 14, y + h_ - 16, 10, 4, c)
    L(d, [(x + w_ / 2 - 12, y + 20), (x + w_ / 2 + 12, y + 20)], 4, c)
    E(d, x + w_ / 2, y + h_ - 36 + 18, 6, 6, 3, c)


def TOGGLE(d, cx, cy, on=False, w=5):
    w_, h_ = 78, 36
    RR(d, cx - w_ / 2, cy - h_ / 2, cx + w_ / 2, cy + h_ / 2, h_ / 2, w,
       INK, BLUE_W if on else None)
    kx = cx + (w_ / 2 - h_ / 2 - 3) if on else cx - (w_ / 2 - h_ / 2 - 3)
    E(d, kx, cy, 12, 12, 4, INK, BLUE if on else None)


def FISH(d, cx, cy, s, w=5, c=BLUE, fill=BLUE_W):
    # 朝右的简笔鱼（吉祥物）
    E(d, cx, cy, s * 1.5, s * 0.85, w, c, fill)
    POLY(d, [(cx - s * 1.4, cy), (cx - s * 2.1, cy - s * 0.7),
             (cx - s * 1.95, cy + s * 0.02), (cx - s * 2.1, cy + s * 0.7)], fill, w, c)
    ARC(d, cx + s * 0.15, cy - s * 0.55, s * 0.5, s * 0.35, -0.35, 0.75, 4, c)
    ARC(d, cx + s * 0.1, cy + s * 0.5, s * 0.45, s * 0.3, 3.6, 4.6, 4, c)
    E(d, cx + s * 0.75, cy - s * 0.16, s * 0.11, s * 0.11, 4, INK, INK)
    ARC(d, cx + s * 0.95, cy + s * 0.12, s * 0.32, s * 0.3, 0.3, 2.6, 4, INK)


def PERSON(d, hx, hy, r, w=5):
    E(d, hx, hy, r, r, w, INK)
    # 头发速写
    ARC(d, hx, hy - r * 0.2, r * 0.9, r * 0.75, math.pi * 1.15, math.pi * 1.85, 4, INK)
    # 眼睛（烦恼的斜点）
    L(d, [(hx - r * 0.45, hy - r * 0.1), (hx - r * 0.18, hy - r * 0.02)], 4, INK)
    L(d, [(hx + r * 0.18, hy - r * 0.02), (hx + r * 0.45, hy - r * 0.1)], 4, INK)
    ARC(d, hx, hy + r * 0.45, r * 0.3, r * 0.22, math.pi * 1.15, math.pi * 1.85, 4, INK)


def QR(d, x0, y0, size, w=5):
    n = 6
    cell = size / n
    RR(d, x0, y0, x0 + size, y0 + size, 10, w, INK)
    # 随机数据格
    for r in range(n):
        for c_ in range(n):
            if random.random() < 0.38:
                RECT(d, x0 + 6 + c_ * cell + 3, y0 + 6 + r * cell + 3,
                     x0 + 6 + (c_ + 1) * cell - 4, y0 + 6 + (r + 1) * cell - 4, INK)
    # 三个定位角
    for (px, py) in ((x0 + 12, y0 + 12), (x0 + size - 58, y0 + 12), (x0 + 12, y0 + size - 58)):
        RR(d, px, py, px + 46, py + 46, 8, 4, INK)
        RECT(d, px + 14, py + 14, px + 32, py + 32, INK)


# ───────────────── 画布 ─────────────────
def new_canvas():
    img = Image.new("RGB", (W * SS, H * SS), BG)
    return img, ImageDraw.Draw(img)


def save(img, name):
    img = img.resize((W, H), Image.LANCZOS)
    img.save(f"{BASE}\\{name}.png")
    print(f"saved {name}.png")


# ═══════════════ 幕 1：痛点开场 ═══════════════
def scene1():
    img, d = new_canvas()
    # ── el1 深夜台灯下忙乱的卖家（x270-930, y200-860）
    # 月亮与星星（夜晚）
    E(d, 360, 268, 52, 52, 5, INK)
    E(d, 388, 252, 40, 40, 5, BG, BG)     # 月牙遮挡
    E(d, 342, 262, 46, 46, 4, INK, None)  # 外缘补线
    E(d, 392, 250, 34, 34, 5, BG, BG)
    SPARK(d, 700, 240, 20)
    SPARK(d, 820, 320, 14)
    # 书桌
    L(d, [(340, 700), (880, 700)], 6)
    L(d, [(380, 700), (380, 845)], 6)
    L(d, [(840, 700), (840, 845)], 6)
    # 台灯：桌右伸出
    L(d, [(830, 700), (830, 440)], 5)
    L(d, [(830, 440), (755, 385)], 5)
    POLY(d, [(720, 385), (800, 385), (780, 330), (740, 330)], ORANGE_W, 5, INK)
    for i, dx in enumerate((-28, 0, 28)):
        L(d, [(760 + dx, 395), (760 + dx * 1.3, 445)], 3, ORANGE)
    # 人（头部 + 烦恼表情）
    PERSON(d, 615, 430, 62)
    # 身体与举起的手臂（抓头）
    L(d, [(615, 492), (615, 560)], 6)
    L(d, [(575, 545), (510, 505), (540, 452)], 5)
    L(d, [(655, 545), (702, 500), (668, 450)], 5)
    L(d, [(540, 560), (540, 620), (480, 620)], 5)   # 椅背
    L(d, [(690, 560), (690, 620), (750, 620)], 5)
    # 桌上散乱纸堆
    L(d, [(380, 690), (470, 690)], 4)
    L(d, [(392, 676), (460, 676)], 4)
    # ── el2 三台手机（x1060-1800, y300-905）
    PHONE(d, 1065, 400, 170, 320)
    PHONE(d, 1435, 450, 170, 320)
    PHONE(d, 1250, 620, 170, 290)
    for (px, py) in ((1150, 540), (1520, 590), (1335, 760)):
        E(d, px, py, 9, 9, 4, INK, INK)  # 手机按键
    # 担忧小脸（中间手机屏幕内）
    L(d, [(1300, 710), (1290, 702)], 4, INK)
    L(d, [(1340, 710), (1350, 702)], 4, INK)
    ARC(d, 1320, 760, 18, 14, math.pi * 1.1, math.pi * 1.9, 4, INK)
    # ── el3 订单卡与卡密卡（x140-560, y880-1060）
    RR(d, 170, 900, 340, 1010, 12, 5, INK, ORANGE_W)
    E(d, 226, 955, 20, 20, 4, INK)               # 卡密钥匙：环
    L(d, [(246, 955), (310, 955)], 5)            # 钥匙柄
    L(d, [(292, 955), (292, 968)], 4)
    L(d, [(308, 955), (308, 972)], 4)
    RR(d, 360, 920, 480, 1030, 12, 5, INK, None)  # 第二张卡：购物车
    POLY(d, [(388, 950), (460, 950), (452, 990), (394, 990)], None, 4, INK)
    E(d, 402, 1002, 6, 6, 3, INK)
    E(d, 440, 1002, 6, 6, 3, INK)
    L(d, [(460, 950), (472, 938), (460, 930)], 4, INK)
    # ── el4 密集消息气泡（x1060-1800, y90-290）
    BUBBLE(d, 1180, 160, 105, 62)
    ZIG(d, 1120, 160, 120)
    BUBBLE(d, 1460, 200, 105, 62)
    ZIG(d, 1400, 200, 120)
    BUBBLE(d, 1620, 130, 88, 52)
    E(d, 1620, 130, 60, 34, 3, INK, RED_W)   # 内嵌红色惊叹色块（无文字）
    SPARK(d, 1740, 90, 16, RED)
    # ── el5 自动化齿轮徽章（x1100-1290, y910-1075）
    GEAR(d, 1195, 992, 66)
    CHECK(d, [(1165, 995), (1185, 1018), (1228, 960)], 6, BLUE)
    SPARK(d, 1258, 936, 14, BLUE)
    save(img, "scene-01-pain")


# ═══════════════ 幕 2：多账号管理 ═══════════════
def scene2():
    img, d = new_canvas()
    # ── el1 中央后台显示器（x730-1190, y340-820）
    RR(d, 760, 400, 1160, 700, 16, 6, INK, BLUE_W)
    RR(d, 778, 418, 1142, 682, 10, 4, INK)
    L(d, [(960, 700), (960, 745)], 6)
    L(d, [(890, 752), (1030, 752)], 6)
    FISH(d, 905, 500, 36)                       # 屏内品牌小鱼
    L(d, [(830, 590), (1080, 590)], 4, INK)
    L(d, [(860, 630), (1050, 630)], 4, INK)
    L(d, [(890, 660), (1010, 660)], 4, INK)
    # ── el2 二维码（x1380-1700, y110-420）
    QR(d, 1400, 130, 260)
    L(d, [(1440, 410), (1462, 372)], 4, INK)
    L(d, [(1450, 415), (1472, 380)], 4, INK)   # 扫码线
    # ── el3 左侧手机 + 连线（x110-755, y250-1000）
    PHONE(d, 150, 320, 150, 250)
    PHONE(d, 180, 640, 150, 250)
    L(d, [(330, 440), (720, 520)], 4, BLUE)
    L(d, [(360, 770), (700, 620)], 4, BLUE)
    # ── el4 右侧手机 + 连线（x1150-1800, y470-1050）
    PHONE(d, 1450, 500, 150, 250)
    PHONE(d, 1310, 780, 150, 250)
    L(d, [(1450, 560), (1195, 560)], 4, BLUE)
    L(d, [(1390, 830), (1200, 660)], 4, BLUE)
    # ── el5 策略开关面板（x660-1240, y880-1060）
    RR(d, 680, 900, 1220, 1040, 14, 5, INK)
    TOGGLE(d, 760, 970, True)
    TOGGLE(d, 950, 970, False)
    TOGGLE(d, 1140, 970, True)
    # ── el6 吉祥物小鱼（x830-1170, y40-340）
    FISH(d, 990, 180, 78)
    E(d, 1110, 120, 9, 9, 3, INK, INK)
    E(d, 1130, 90, 6, 6, 3, INK, INK)
    E(d, 1146, 66, 4, 4, 3, INK, INK)
    SPARK(d, 870, 100, 18, ORANGE)
    save(img, "scene-02-accounts")


# ═══════════════ 幕 3：自动发货与买家互动 ═══════════════
def scene3():
    img, d = new_canvas()
    # ── el1 传送带（x110-1800, y690-890）
    L(d, [(140, 700), (1780, 700)], 6)
    L(d, [(140, 820), (1780, 820)], 6)
    for rx in (250, 480, 710, 940, 1170, 1400, 1630):
        E(d, rx, 760, 26, 26, 4, INK)
    L(d, [(180, 820), (180, 872)], 5)
    L(d, [(1740, 820), (1740, 872)], 5)
    # ── el2 订单卡（x160-360, y390-680）
    RR(d, 170, 470, 350, 650, 12, 5, INK, ORANGE_W)
    POLY(d, [(215, 520), (300, 520), (290, 580), (222, 580)], None, 4, INK)
    E(d, 232, 595, 7, 7, 3, INK)
    E(d, 272, 595, 7, 7, 3, INK)
    L(d, [(300, 520), (315, 505), (300, 496)], 4, INK)
    L(d, [(200, 620), (320, 620)], 4, INK)
    # ── el3 卡密卡（x420-620, y390-680）
    RR(d, 430, 470, 610, 650, 12, 5, INK, ORANGE_W)
    E(d, 478, 530, 22, 22, 4, INK)
    L(d, [(500, 530), (585, 530)], 5)
    L(d, [(562, 530), (562, 545)], 4)
    L(d, [(585, 530), (585, 550)], 4)
    ARROW(d, 620, 560, 660, 560, 5, ORANGE)
    # ── el4 多规格标签（x680-900, y380-680）
    POLY(d, [(700, 500), (820, 505), (828, 610), (705, 615)], ORANGE_W, 5, INK)
    E(d, 726, 530, 8, 8, 4, INK)
    for i in range(3):
        E(d, 760, 550 + i * 22, 7, 7, 3, INK, BLUE if i == 1 else None)
    POLY(d, [(760, 540), (872, 548), (880, 648), (764, 652)], None, 5, INK)
    E(d, 786, 572, 8, 8, 4, INK)
    for i in range(3):
        E(d, 820, 592 + i * 22, 7, 7, 3, INK, i == 2 and BLUE or None)
    # ── el5 风险闸门（x940-1160, y380-680）
    POLY(d, [(1000, 400), (1100, 400), (1120, 530), (1050, 660),
             (980, 530), (990, 400)], None, 6, INK)     # 盾牌轮廓
    POLY(d, [(1012, 412), (1088, 412), (1104, 525), (1050, 634),
             (996, 525), (1002, 412)], RED_W, 4, INK)
    BOLT(d, 1050, 515, 62, 5, ORANGE)
    L(d, [(1050, 660), (1050, 689)], 4, INK)
    # ── el6 确认收货（x1180-1400, y390-680）
    E(d, 1290, 535, 100, 100, 6, INK)
    E(d, 1290, 535, 84, 84, 4, INK, BLUE_W)
    CHECK(d, [(1240, 540), (1272, 578), (1338, 488)], 8, BLUE)
    L(d, [(1290, 635), (1290, 689)], 4, INK)
    # ── el7 好评三连（x1440-1800, y340-680）
    STAR5(d, 1585, 435, 52, 5, ORANGE, ORANGE_W)
    HEART(d, 1720, 470, 56, 5, RED, RED_W)
    FLOWER(d, 1560, 595, 52)
    E(d, 1715, 620, 40, 28, 5, INK)                       # 致谢信封
    POLY(d, [(1675, 596), (1715, 622), (1755, 596)], None, 4, INK)
    # ── el8 自动化徽章（x130-510, y100-350）
    E(d, 300, 225, 100, 100, 6, INK, ORANGE_W)
    BOLT(d, 300, 225, 58, 6, ORANGE)
    SPARK(d, 432, 160, 22, ORANGE)
    SPARK(d, 445, 285, 16, BLUE)
    L(d, [(398, 196), (418, 172)], 4, INK)
    save(img, "scene-03-autoship")


# ═══════════════ 幕 4：智能回复 ═══════════════
def scene4():
    img, d = new_canvas()
    # ── el1 买家与消息气泡（x100-600, y170-730）
    E(d, 250, 380, 58, 58, 5, INK)
    ARC(d, 250, 371, 52, 44, math.pi * 1.15, math.pi * 1.85, 4, INK)   # 头发
    E(d, 232, 372, 5, 5, 3, INK, INK)
    E(d, 268, 372, 5, 5, 3, INK, INK)
    E(d, 250, 400, 8, 8, 3, INK)   # 说话的圆嘴
    ARC(d, 180, 520, 90, 60, math.pi * 0.05, math.pi * 0.95, 5, INK)   # 肩膀
    ARC(d, 320, 520, 90, 60, math.pi * 0.05, math.pi * 0.95, 5, INK)
    BUBBLE(d, 455, 255, 115, 78)
    L(d, [(390, 320), (340, 345), (310, 340)], 5, INK)                 # 气泡尾巴
    ZIG(d, 395, 240, 120)
    ZIG(d, 395, 272, 90)
    # ── el2 关键词路牌（x660-980, y260-780）
    L(d, [(820, 430), (820, 758)], 6)
    POLY(d, [(760, 758), (880, 758), (895, 786), (745, 786)], None, 5, INK)
    POLY(d, [(690, 350), (950, 350), (975, 392), (665, 392)], BLUE_W, 5, INK)  # 箭头牌
    POLY(d, [(950, 350), (985, 371), (950, 392)], None, 5, INK)
    for i, bx in enumerate((710, 790, 870)):
        RR(d, bx, 358, bx + 54, 384, 6, 3, INK, i == 0 and ORANGE_W or None)
        E(d, bx + 16, 371, 4, 4, 2, INK, INK)
    L(d, [(710, 404), (930, 404)], 4, INK)
    # ── el3 AI 机器人（x1050-1450, y230-760）
    L(d, [(1250, 300), (1250, 252)], 5, INK)
    E(d, 1250, 240, 12, 12, 4, INK, RED)       # 天线红点
    RR(d, 1110, 300, 1390, 520, 28, 6, INK, None)
    RR(d, 1128, 318, 1372, 502, 18, 4, INK, BLUE_W)
    E(d, 1195, 400, 24, 24, 5, INK, None)
    E(d, 1195, 400, 9, 9, 4, INK, BLUE)
    E(d, 1305, 400, 24, 24, 5, INK, None)
    E(d, 1305, 400, 9, 9, 4, INK, BLUE)
    ARC(d, 1250, 440, 52, 36, 0.3, 2.8, 5, INK)              # 微笑
    RR(d, 1078, 385, 1108, 435, 8, 4, INK)                   # 左耳
    RR(d, 1392, 385, 1422, 435, 8, 4, INK)                   # 右耳
    RR(d, 1150, 545, 1350, 705, 18, 6, INK, None)            # 身体
    E(d, 1200, 600, 14, 14, 4, INK, ORANGE)
    E(d, 1300, 600, 14, 14, 4, INK, ORANGE)
    L(d, [(1150, 650), (1350, 650)], 4, INK)
    L(d, [(1150, 560), (1075, 560)], 5, INK)                 # 手臂
    L(d, [(1350, 560), (1435, 560)], 5, INK)
    SPARK(d, 1425, 320, 20, ORANGE)
    SPARK(d, 1090, 250, 14, BLUE)
    # ── el4 底线护栏（x640-1480, y800-1020）
    L(d, [(680, 920), (1440, 920)], 7, INK)
    L(d, [(680, 940), (1440, 940)], 5, INK)
    for px in (740, 980, 1220, 1400):
        L(d, [(px, 920), (px, 842)], 5, INK)
        E(d, px, 832, 10, 10, 4, INK)
    POLY(d, [(1400, 842), (1468, 862), (1400, 882)], RED_W, 4, RED)  # 旗
    E(d, 870, 930, 20, 20, 5, INK, BLUE_W)                   # 底价滑块
    E(d, 870, 930, 7, 7, 3, INK, BLUE)
    # ── el5 场景提示词卡片（x1450-1810, y110-760）
    RR(d, 1490, 150, 1780, 395, 14, 5, INK, ORANGE_W)
    L(d, [(1520, 190), (1750, 190)], 4, INK)
    BUBBLE(d, 1560, 250, 58, 36)                             # 商品问答卡：气泡图标
    ZIG(d, 1522, 250, 70, INK, 3)
    L(d, [(1520, 320), (1650, 320)], 4, INK)
    L(d, [(1520, 350), (1620, 350)], 4, INK)
    RR(d, 1490, 445, 1780, 690, 14, 5, INK, BLUE_W)
    L(d, [(1520, 485), (1750, 485)], 4, INK)
    POLY(d, [(1540, 560), (1610, 560), (1604, 615), (1546, 615)], None, 4, INK)  # 价签
    E(d, 1575, 560, 7, 7, 3, INK)
    E(d, 1580, 590, 6, 6, 3, INK, RED)
    L(d, [(1640, 565), (1750, 565)], 4, INK)
    L(d, [(1640, 595), (1720, 595)], 4, INK)
    save(img, "scene-04-aireply")


# ═══════════════ 幕 5：经营看板 ═══════════════
def scene5():
    img, d = new_canvas()
    # ── el1 商品盒堆（x100-540, y280-730）
    RR(d, 140, 500, 320, 720, 8, 5, INK, ORANGE_W)
    L(d, [(140, 560), (320, 560)], 4, INK)
    L(d, [(230, 500), (230, 560)], 4, INK)
    RR(d, 180, 300, 360, 500, 8, 5, INK, ORANGE_W)
    L(d, [(180, 360), (360, 360)], 4, INK)
    L(d, [(270, 300), (270, 360)], 4, INK)
    RR(d, 340, 560, 510, 720, 8, 5, INK, None)
    L(d, [(340, 620), (510, 620)], 4, INK)
    # ── el2 素材库柜 + 吸入箭头（x520-880, y300-730）
    ARROW(d, 528, 460, 590, 440, 5, BLUE)
    RR(d, 580, 330, 860, 700, 10, 5, INK)
    L(d, [(580, 510), (860, 510)], 4, INK)
    E(d, 720, 420, 26, 20, 4, INK)                 # 抽屉拉手
    RR(d, 600, 540, 840, 690, 8, 5, INK, BLUE_W)   # 拉开的抽屉
    E(d, 720, 615, 26, 18, 4, INK)
    E(d, 680, 590, 8, 8, 3, INK, ORANGE)           # 抽屉内小物件
    E(d, 730, 630, 8, 8, 3, INK, RED)
    E(d, 770, 590, 8, 8, 3, INK, BLUE)
    # ── el3 擦亮星光 + 上下架箭头（x920-1190, y230-600）
    RR(d, 960, 430, 1110, 565, 8, 5, INK, ORANGE_W)   # 待擦亮的商品
    L(d, [(960, 480), (1110, 480)], 4, INK)
    SPARK(d, 1035, 300, 34, ORANGE)
    SPARK(d, 955, 360, 22, ORANGE)
    SPARK(d, 1120, 250, 18, BLUE)
    SPARK(d, 1105, 370, 14, RED)
    ARROW(d, 1135, 460, 1170, 420, 4, BLUE)
    ARROW(d, 1135, 540, 1170, 580, 4, BLUE)
    # ── el4 经营看板（x1200-1830, y210-780）
    RR(d, 1230, 240, 1800, 750, 14, 6, INK)
    L(d, [(1230, 310), (1800, 310)], 4, INK)
    L(d, [(1290, 660), (1660, 660)], 4, INK)      # 坐标轴
    L(d, [(1290, 660), (1290, 380)], 4, INK)
    POLY(d, [(1310, 660), (1370, 660), (1370, 500), (1310, 500)], BLUE_W, 0, BLUE)   # 柱1
    POLY(d, [(1400, 660), (1465, 660), (1465, 420), (1400, 420)], ORANGE_W, 0, ORANGE)
    POLY(d, [(1495, 660), (1555, 660), (1555, 545), (1495, 545)], RED_W, 0, RED)
    L(d, [(1600, 640), (1650, 555), (1690, 590), (1740, 470)], 5, BLUE)              # 上升折线
    E(d, 1650, 555, 7, 7, 3, INK, INK)
    E(d, 1740, 470, 7, 7, 3, INK, INK)
    ARROW(d, 1740, 472, 1775, 430, 4, BLUE)
    RR(d, 1660, 350, 1790, 420, 8, 4, INK, ORANGE_W)                                  # 指标小卡
    L(d, [(1685, 375), (1750, 375)], 4, INK)
    L(d, [(1685, 400), (1730, 400)], 4, INK)
    # ── el5 打开网页看数据（x500-1450, y790-1070）
    E(d, 560, 930, 48, 48, 5, INK)                # 历史时钟
    L(d, [(560, 930), (560, 900)], 4, INK)
    L(d, [(560, 930), (582, 940)], 4, INK)
    ARROW(d, 616, 930, 680, 930, 5, BLUE)
    RR(d, 690, 840, 1370, 1020, 12, 6, INK, BLUE_W)   # 笔记本屏幕
    L(d, [(1030, 1020), (1030, 1042)], 5, INK)
    L(d, [(950, 1048), (1110, 1048)], 5, INK)
    L(d, [(740, 950), (830, 905), (900, 925), (980, 875), (1060, 890), (1140, 845)], 4, BLUE)
    E(d, 830, 905, 5, 5, 3, INK, INK)
    E(d, 980, 875, 5, 5, 3, INK, INK)
    E(d, 1140, 845, 5, 5, 3, INK, INK)
    L(d, [(740, 980), (1180, 980)], 4, INK)
    L(d, [(740, 990), (890, 990)], 4, INK)
    save(img, "scene-05-dashboard")


# ═══════════════ 幕 6：架构与收尾 ═══════════════
def scene6():
    img, d = new_canvas()
    # ── el1 服务器 + 循环（x150-640, y190-760）
    RR(d, 220, 300, 480, 720, 12, 6, INK)
    for i in range(4):
        yy = 340 + i * 92
        L(d, [(238, yy), (462, yy)], 4, INK)
        L(d, [(238, yy + 30), (440, yy + 30)], 3, INK)
        E(d, 445, yy + 15, 6, 6, 3, INK, (BLUE, ORANGE, RED, BLUE)[i])
    ARC(d, 545, 490, 92, 92, -0.5, 4.9, 5, INK)     # 循环环
    ARROW(d, 545 + 92 * math.cos(-0.5), 490 + 92 * math.sin(-0.5),
          545 + 92 * math.cos(0.05), 490 + 92 * math.sin(0.05), 5, BLUE)
    E(d, 545, 490, 24, 24, 4, INK, BLUE_W)
    L(d, [(545, 490), (545, 472)], 4, INK)
    L(d, [(545, 490), (558, 498)], 4, INK)
    # ── el2 账号队列（x670-1280, y200-440）
    for i, cx in enumerate((740, 900, 1060, 1220)):
        PHONE(d, cx - 35, 240, 70, 160, 4)
        CHECK(d, [(cx - 14, 320), (cx - 4, 332), (cx + 16, 300)], 5, BLUE)
        if i < 3:
            L(d, [(cx + 42, 320), (cx + 118, 320)], 3, INK)
    # ── el3 Docker 集装箱（x670-1280, y520-910）
    RR(d, 720, 560, 1240, 880, 10, 6, INK, ORANGE_W)
    for i in range(1, 6):
        L(d, [(720 + i * 86, 570), (720 + i * 86, 870)], 3, INK)
    RR(d, 890, 660, 1070, 780, 10, 4, INK, BG)      # 集装箱上的小鱼标牌
    FISH(d, 980, 715, 28)
    L(d, [(780, 545), (780, 560)], 4, INK)
    L(d, [(1180, 545), (1180, 560)], 4, INK)
    # ── el4 命令行窗口（x1320-1810, y210-580）
    RR(d, 1350, 250, 1790, 540, 12, 6, INK)
    L(d, [(1350, 312), (1790, 312)], 4, INK)
    E(d, 1382, 281, 9, 9, 3, INK, RED)
    E(d, 1412, 281, 9, 9, 3, INK, ORANGE)
    E(d, 1442, 281, 9, 9, 3, INK, BLUE)
    L(d, [(1390, 360), (1520, 360)], 4, INK)
    L(d, [(1390, 410), (1670, 410)], 4, INK)
    L(d, [(1390, 460), (1440, 460)], 6, INK)
    L(d, [(1460, 435), (1460, 485)], 6, BLUE)       # 光标
    # ── el5 吉祥物小鱼（x150-580, y770-1060）
    FISH(d, 340, 940, 82)
    E(d, 470, 800, 13, 13, 3, INK, INK)
    E(d, 498, 775, 9, 9, 3, INK, INK)
    E(d, 520, 756, 6, 6, 3, INK, INK)
    SPARK(d, 545, 830, 16, ORANGE)
    # ── el6 启动火箭与旗（x1330-1800, y620-1060）
    POLY(d, [(1520, 860), (1520, 720), (1552, 660), (1584, 720), (1584, 860)],
         None, 6, INK)                              # 箭身
    POLY(d, [(1520, 860), (1492, 905), (1520, 880)], BLUE_W, 5, BLUE)   # 尾翼
    POLY(d, [(1584, 860), (1612, 905), (1584, 880)], RED_W, 5, RED)
    POLY(d, [(1540, 740), (1564, 740), (1552, 772)], ORANGE_W, 4, ORANGE)
    L(d, [(1540, 880), (1520, 940)], 4, ORANGE)    # 尾焰
    L(d, [(1552, 890), (1552, 950)], 4, ORANGE)
    L(d, [(1566, 880), (1588, 940)], 4, ORANGE)
    SPARK(d, 1440, 660, 22, BLUE)
    SPARK(d, 1760, 700, 16, ORANGE)
    L(d, [(1650, 860), (1650, 985)], 5, INK)       # 旗杆
    POLY(d, [(1650, 862), (1740, 890), (1650, 918)], RED_W, 5, RED)
    ARROW(d, 1730, 1000, 1760, 900, 5, BLUE)
    save(img, "scene-06-outro")


if __name__ == "__main__":
    scene1()
    scene2()
    scene3()
    scene4()
    scene5()
    scene6()
    print("all scenes drawn")
