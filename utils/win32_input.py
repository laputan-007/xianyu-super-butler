#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Win32 SendInput 硬件级鼠标注入（自动过滑块的高通过率通道）。

CDP 派发的鼠标事件每帧只有一个合成事件，缺少真实硬件鼠标的高频子事件密度
（浏览器通过 PointerEvent.getCoalescedEvents() 把子事件暴露给阿里风控的
采集脚本），这是 CDP 通道自动通过率卡在低位的根本原因。SendInput 把事件
打进操作系统输入栈：浏览器按消息泵速率合并输入流，按轨迹时间轴注入时每帧
天然产生 1-2 个 coalesced 子事件，与真实硬件鼠标在页面层面无法区分；并且
不篡改任何页面 API —— 即使风控侧升级检测，也不构成"伪造遥测"的加重信号。

约束（调用方负责满足，不满足时应回退 CDP 通道）：
- 仅 Windows；浏览器有头、窗口未最小化
- 多显示器：按虚拟桌面归一化，副屏（含负坐标）同样可达
- 拖动期间（约 2-5 秒）本机鼠标被接管
- 任何一步映射/校验失败，公共函数返回 None/False，由调用方回退

DPI 说明：进程默认 DPI 不感知时 GetSystemMetrics/GetCursorPos 返回的是
虚拟化坐标。这里在使用前调用 SetProcessDPIAware 切到物理像素坐标，
与 SendInput 的绝对坐标归一化（主显示器物理分辨率）保持同一坐标系。
"""

import ctypes
import ctypes.wintypes as wintypes
import sys
import time

MOUSEEVENTF_MOVE = 0x0001
MOUSEEVENTF_LEFTDOWN = 0x0002
MOUSEEVENTF_LEFTUP = 0x0004
MOUSEEVENTF_ABSOLUTE = 0x8000
MOUSEEVENTF_VIRTUALDESK = 0x4000

# 虚拟桌面（所有显示器的并集）度量
SM_XVIRTUALSCREEN = 76
SM_YVIRTUALSCREEN = 77
SM_CXVIRTUALSCREEN = 78
SM_CYVIRTUALSCREEN = 79

INPUT_MOUSE = 0
INPUT_KEYBOARD = 1
VK_MENU = 0x12  # Alt 键，前台锁绕过用

WIND32_AVAILABLE = sys.platform == 'win32'

_dpi_aware_done = False


class MOUSEINPUT(ctypes.Structure):
    _fields_ = (
        ("dx", wintypes.LONG),
        ("dy", wintypes.LONG),
        ("mouseData", wintypes.DWORD),
        ("dwFlags", wintypes.DWORD),
        ("time", wintypes.DWORD),
        ("dwExtraInfo", ctypes.POINTER(wintypes.ULONG)),
    )


class KEYBDINPUT(ctypes.Structure):
    _fields_ = (
        ("wVk", wintypes.WORD),
        ("wScan", wintypes.WORD),
        ("dwFlags", wintypes.DWORD),
        ("time", wintypes.DWORD),
        ("dwExtraInfo", ctypes.POINTER(wintypes.ULONG)),
    )


class _INPUTUNION(ctypes.Union):
    _fields_ = (("mi", MOUSEINPUT), ("ki", KEYBDINPUT))


class INPUT(ctypes.Structure):
    _fields_ = (("type", wintypes.DWORD), ("union", _INPUTUNION))


def _user32():
    return ctypes.windll.user32


def ensure_dpi_aware():
    """让本进程的坐标查询（GetCursorPos 等）返回物理像素，只需成功一次。"""
    global _dpi_aware_done
    if _dpi_aware_done or not WIND32_AVAILABLE:
        return
    try:
        _user32().SetProcessDPIAware()
    except Exception:
        pass
    _dpi_aware_done = True


def get_primary_screen_size():
    """主显示器物理分辨率 (宽, 高)，失败返回 None。"""
    if not WIND32_AVAILABLE:
        return None
    ensure_dpi_aware()
    u = _user32()
    w = u.GetSystemMetrics(0)
    h = u.GetSystemMetrics(1)
    if w <= 0 or h <= 0:
        return None
    return (w, h)


def get_virtual_screen():
    """虚拟桌面 (x0, y0, 宽, 高)：所有显示器的并集，坐标可为负。

    多显示器场景下副屏常排在主屏左侧（坐标为负），SendInput 用
    VIRTUALDESK 标志按这块区域归一化，目标坐标允许为负。
    """
    if not WIND32_AVAILABLE:
        return None
    ensure_dpi_aware()
    u = _user32()
    x0 = u.GetSystemMetrics(SM_XVIRTUALSCREEN)
    y0 = u.GetSystemMetrics(SM_YVIRTUALSCREEN)
    w = u.GetSystemMetrics(SM_CXVIRTUALSCREEN)
    h = u.GetSystemMetrics(SM_CYVIRTUALSCREEN)
    if w <= 0 or h <= 0:
        return None
    return (x0, y0, w, h)


def get_cursor_pos():
    """当前光标物理坐标 (x, y)，失败返回 None。"""
    if not WIND32_AVAILABLE:
        return None
    ensure_dpi_aware()
    pt = wintypes.POINT()
    if not _user32().GetCursorPos(ctypes.byref(pt)):
        return None
    return (pt.x, pt.y)


def _send_mouse(flags, dx=0, dy=0):
    mi = MOUSEINPUT(dx=dx, dy=dy, mouseData=0, dwFlags=flags, time=0, dwExtraInfo=None)
    inp = INPUT(type=INPUT_MOUSE)
    inp.union.mi = mi
    return _user32().SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT)) == 1


def _to_normalized(px, py, virtual_screen):
    """物理坐标归一化到 0-65535（覆盖整个虚拟桌面）。

    经验校准结论：系统把 0..65535 线性映射到 [x0, x0+w-1]（末坐标是
    w-1 而非 w，实测 nx=65535 落在 w-1 上），因此分母用 w-1。
    """
    x0, y0, w, h = virtual_screen
    nx = int((px - x0) * 65535 / (w - 1))
    ny = int((py - y0) * 65535 / (h - 1))
    return max(0, min(65535, nx)), max(0, min(65535, ny))


def mouse_move_to(px, py, virtual_screen=None):
    """把光标移动到虚拟桌面物理坐标 (px, py)（副屏坐标可为负）。"""
    if not WIND32_AVAILABLE:
        return False
    if virtual_screen is None:
        virtual_screen = get_virtual_screen()
        if not virtual_screen:
            return False
    nx, ny = _to_normalized(px, py, virtual_screen)
    return _send_mouse(MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK, nx, ny)


def set_cursor_pos(px, py):
    """直接设置光标物理坐标（原生支持多屏负坐标，仅测试/复位用）。"""
    if not WIND32_AVAILABLE:
        return False
    ensure_dpi_aware()
    return bool(_user32().SetCursorPos(int(px), int(py)))


def wait_cursor_stable(timeout: float = 3.0, still_ms: int = 200, jitter_px: int = 3) -> bool:
    """等待用户停止移动真实鼠标。

    硬件鼠标以 ~125Hz 持续上报位置，会实时覆盖注入的绝对坐标 ——
    用户正在动鼠标时注入拖动，轨迹会被打得稀烂。拖动前先等光标
    静止一小段时间；超时则放弃等待（尽力而为）。
    """
    if not WIND32_AVAILABLE:
        return False
    deadline = time.monotonic() + timeout
    last = get_cursor_pos()
    if last is None:
        return False
    still_since = time.monotonic()
    while time.monotonic() < deadline:
        time.sleep(0.05)
        now = get_cursor_pos()
        if now is None:
            return False
        if abs(now[0] - last[0]) > jitter_px or abs(now[1] - last[1]) > jitter_px:
            last = now
            still_since = time.monotonic()
        elif (time.monotonic() - still_since) * 1000 >= still_ms:
            return True
    return False


def mouse_left_down():
    return _send_mouse(MOUSEEVENTF_LEFTDOWN)


def mouse_left_up():
    return _send_mouse(MOUSEEVENTF_LEFTUP)


class ScreenMapper:
    """页面 CSS 坐标 → 主显示器物理坐标。

    依据（Chrome 语义）：
    - window.screenX/screenY 是浏览器窗口外框的位置，单位 CSS 像素
    - 视口原点 = 外框 + 浏览器 UI 偏移（水平为边框一半，垂直为
      标签栏+工具栏高度，用 outerHeight-innerHeight 推出）
    - devicePixelRatio 是"物理像素 / CSS 像素"（含页面缩放因素，
      100% 缩放时等于系统 DPI 缩放系数）
    ElementHandle.bounding_box() 返回的就是视口坐标系下的 CSS 像素，
    因此页面元素坐标可直接加视口原点后乘 dpr 得到屏幕物理坐标。
    """

    def __init__(self, geo: dict):
        self.dpr = float(geo.get("dpr") or 0)
        screen_x = float(geo.get("screenX") or 0)
        screen_y = float(geo.get("screenY") or 0)
        outer_w = float(geo.get("outerW") or 0)
        outer_h = float(geo.get("outerH") or 0)
        inner_w = float(geo.get("innerW") or 0)
        inner_h = float(geo.get("innerH") or 0)

        # 数值合理性粗校验：dpr 异常或 UI 偏移不合理都拒绝，宁回退不乱拖
        if not (0.99 <= self.dpr <= 3.01):
            raise ValueError(f"devicePixelRatio 异常: {self.dpr}")
        chrome_v = outer_h - inner_h
        if not (20 <= chrome_v <= 250):
            raise ValueError(f"浏览器 UI 垂直偏移异常: {chrome_v}")
        if inner_w <= 0 or inner_h <= 0:
            raise ValueError("视口尺寸异常")

        border = max(0.0, outer_w - inner_w) / 2.0
        self._vx_css = screen_x + border
        self._vy_css = screen_y + chrome_v

    def page_to_screen(self, x_css: float, y_css: float):
        """页面（视口坐标系）CSS 像素 → 屏幕物理像素。"""
        return (
            round((self._vx_css + x_css) * self.dpr),
            round((self._vy_css + y_css) * self.dpr),
        )

    def verify(self, tolerance_px: int = 15) -> bool:
        """自校验：移动光标到视口原点附近并读回，验证整条映射链路。

        容差给到 15px：它防的是 DPI/多屏推导错位（误差会是数百像素），
        不是像素级精度；用户正在操作电脑时，读回值可能被真实鼠标的
        硬件报告轻微覆盖，几像素的抖动不代表映射错误。
        """
        target = self.page_to_screen(50, 50)
        if not mouse_move_to(*target):
            return False
        time.sleep(0.02)
        got = get_cursor_pos()
        if got is None:
            return False
        return abs(got[0] - target[0]) <= tolerance_px and abs(got[1] - target[1]) <= tolerance_px


class LASTINPUTINFO(ctypes.Structure):
    _fields_ = (("cbSize", wintypes.UINT), ("dwTime", wintypes.DWORD))


def get_idle_seconds() -> float:
    """用户无输入的时长（秒）。失败返回 -1。

    基于 Win32 GetLastInputInfo：最后一次键盘/鼠标输入距今的时间。
    用于「智能空闲」策略 —— 只在用户离开电脑时才用硬件注入拖滑块，
    避免抢夺正在使用中的鼠标。
    """
    if not WIND32_AVAILABLE:
        return -1.0
    ensure_dpi_aware()
    lii = LASTINPUTINFO()
    lii.cbSize = ctypes.sizeof(LASTINPUTINFO)
    if not _user32().GetLastInputInfo(ctypes.byref(lii)):
        return -1.0
    # GetTickCount 约 49.7 天回绕一次，差值用无符号减法处理（kernel32 提供）
    now = ctypes.c_ulong(ctypes.windll.kernel32.GetTickCount()).value
    elapsed_ms = (now - lii.dwTime) & 0xFFFFFFFF
    return elapsed_ms / 1000.0


def find_chrome_window(page_title: str):
    """按页面标题找到承载它的 Chrome 顶层窗口，返回 hwnd。

    Chrome 主窗口标题 = "<标签页标题> - Google Chrome"。精确匹配
    标题前缀，避免误抓用户自己打开的同类窗口。找不到返回 None。
    """
    if not WIND32_AVAILABLE or not page_title:
        return None
    ensure_dpi_aware()
    u = _user32()
    result = []

    EnumWindowsProc = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

    def on_window(hwnd, _lparam):
        if not u.IsWindowVisible(hwnd):
            return True
        length = u.GetWindowTextLengthW(hwnd)
        if length <= 0:
            return True
        buf = ctypes.create_unicode_buffer(length + 1)
        u.GetWindowTextW(hwnd, buf, length + 1)
        title = buf.value
        if title.startswith(f"{page_title} - Google Chrome"):
            result.append(hwnd)
        return True

    u.EnumWindows(EnumWindowsProc(on_window), 0)
    return result[0] if result else None


def force_foreground(hwnd) -> bool:
    """把目标窗口带到前台并最大化。失败返回 False（调用方回退 CDP）。

    鼠标注入并不要求窗口持有键盘焦点，但要求它在 Z 序最上层 —— 否则
    光标位置命中的是压在上面的其它窗口。SetForegroundWindow 受前台锁
    限制时用一次 Alt 键注入改变输入状态再重试（经典绕过手法）。
    """
    if not WIND32_AVAILABLE or not hwnd:
        return False
    ensure_dpi_aware()
    u = _user32()
    if u.IsIconic(hwnd):
        u.ShowWindow(hwnd, 9)  # SW_RESTORE
    if not u.SetForegroundWindow(hwnd):
        # Alt 键按下并释放，解除前台锁后重试
        for vk_flag in (0x0000, 0x0002):  # 0=down, KEYEVENTF_KEYUP=0x0002
            ki = KEYBDINPUT(wVk=VK_MENU, wScan=0x38, dwFlags=vk_flag, time=0, dwExtraInfo=None)
            inp = INPUT(type=INPUT_KEYBOARD)
            inp.union.ki = ki
            u.SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))
        u.SetForegroundWindow(hwnd)
    return u.GetForegroundWindow() == hwnd


# 页面几何信息采集脚本：一次 evaluate 拿齐映射所需的所有量
WINDOW_GEOMETRY_JS = """() => ({
    screenX: window.screenX,
    screenY: window.screenY,
    outerW: window.outerWidth,
    outerH: window.outerHeight,
    innerW: window.innerWidth,
    innerH: window.innerHeight,
    dpr: window.devicePixelRatio,
    title: document.title,
})"""
