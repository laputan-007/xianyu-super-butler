"""SendInput vs CDP 拖动的事件特征对比测试（真实 Chrome，有头）。

核心验证点：SendInput 注入的 pointermove 是否携带 getCoalescedEvents()
子事件（>1），而 CDP 派发的是否为 0/1 —— 这是硬件级注入提升滑块
通过率的物理基础。
"""
import time
import random
import json
from playwright.sync_api import sync_playwright
from utils import win32_input

TEST_URL = 'file:///D:/qye/workspace_2026/custome-project/xianyu-super-butler/slider_input_test.html'


def make_trajectory(distance, points=60, total_seconds=1.0):
    """简版拟人轨迹：smoothstep 包络 + 垂直微颤。"""
    tr = []
    for i in range(points):
        p = i / (points - 1)
        ease = p * p * p * (p * (p * 6 - 15) + 10)
        tr.append((distance * ease, random.uniform(-2, 2),
                   total_seconds / points + random.uniform(0, 0.002)))
    return tr


with sync_playwright() as p:
    context = p.chromium.launch_persistent_context(
        'browser_data/slider_input_test',
        channel='chrome', headless=False,
        args=['--start-maximized', '--no-first-run', '--disable-popup-blocking'],
        no_viewport=True,
    )
    page = context.pages[0] if context.pages else context.new_page()
    page.goto(TEST_URL)
    page.wait_for_load_state()
    time.sleep(0.5)

    box = page.locator('#btn').bounding_box()
    start_x = box['x'] + box['width'] / 2
    start_y = box['y'] + box['height'] / 2
    distance = 250

    # ---- 基线：CDP 拖动（现有通道） ----
    page.mouse.move(start_x, start_y)
    time.sleep(0.2)
    page.mouse.down()
    for x, y, d in make_trajectory(distance):
        page.mouse.move(start_x + x, start_y + y)
        time.sleep(d)
    time.sleep(0.15)
    page.mouse.up()
    time.sleep(0.3)

    # ---- SendInput 拖动：三档注入率对比 ----
    geo = page.evaluate(win32_input.WINDOW_GEOMETRY_JS)
    mapper = win32_input.ScreenMapper(geo)
    hwnd = win32_input.find_chrome_window(geo.get('title') or '')
    assert hwnd, '找不到测试窗口'
    win32_input.force_foreground(hwnd)
    time.sleep(0.3)
    print('映射自校验:', mapper.verify())
    vs = win32_input.get_virtual_screen()
    print('光标静止等待:', win32_input.wait_cursor_stable(timeout=3.0))

    def make_move_page(sub_steps, gap_ms):
        def move_page(x, y):
            px, py = mapper.page_to_screen(x, y)
            prev = getattr(move_page, '_last', None)
            if prev is not None:
                dx, dy = px - prev[0], py - prev[1]
                if dx or dy:
                    for k in range(1, sub_steps):
                        win32_input.mouse_move_to(prev[0] + dx * k // sub_steps, prev[1] + dy * k // sub_steps, vs)
                        time.sleep(gap_ms / 1000.0)
            win32_input.mouse_move_to(px, py, vs)
            move_page._last = (px, py)
        return move_page

    profiles = [(4, 3), (8, 1), (16, 0.5)]
    for sub_steps, gap_ms in profiles:
        move_page = make_move_page(sub_steps, gap_ms)
        move_page(start_x, start_y)
        time.sleep(0.2)
        win32_input.mouse_left_down()
        time.sleep(0.1)
        for x, y, d in make_trajectory(distance):
            move_page(start_x + x, start_y + y)
            time.sleep(d)
        time.sleep(0.15)
        win32_input.mouse_left_up()
        time.sleep(0.3)
        win32_input.wait_cursor_stable(timeout=3.0)

    stats = page.evaluate('() => window.dragStats')
    context.close()

print('\n===== 拖动事件统计（第1条=CDP基线，之后=SendInput 三档注入率） =====')
labels = ['CDP 基线', 'SendInput 4子步x3ms(~250Hz)', 'SendInput 8子步x1ms(~800Hz)', 'SendInput 16子步x0.5ms(~1600Hz)']
for i, s in enumerate(stats):
    avg = s['coalescedTotal'] / s['moves'] if s['moves'] else 0
    label = labels[i] if i < len(labels) else f'extra {i}'
    print(f"[{i}] {label}")
    print(f"    moves={s['moves']} 子事件均值={avg:.2f} 最大={s['coalescedMax']}")
    print(f"    采样: {s['coalescedSamples'][:16]}")
    print(f"    位移: endDX={s['endDX']:.0f}px (应为250)")
