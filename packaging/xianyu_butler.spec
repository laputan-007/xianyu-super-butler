# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller 打包配置：鱼小铺 Windows 客户端（onedir 目录式）。

由 scripts/build_client.py 驱动（先构建前端、打版本戳、转图标），约定：
- 从仓库根目录执行 PyInstaller，本 spec 里的相对路径均以仓库根为基准；
- datas 落在 _internal/ 下：与运行期的 PROJECT_ROOT / JS 路径解析天然对齐
  （app/config.py 的 PROJECT_ROOT、xianyu_utils 的 get_js_path 在冻结模式下
  都解析到 _internal）；
- app.reply_server 以 hiddenimports 显式收录：Start.py 里 uvicorn 按字符串
  "app.reply_server:app" 导入，静态分析抓不到。
"""
import os
from pathlib import Path

ROOT = Path(SPECPATH).parent

datas = [
    (str(ROOT / 'static'), 'static'),           # 前端构建产物 + 签名 JS（xianyu_js_version_2.js）
    (str(ROOT / 'global_config.yml'), '.'),     # 全局配置模板（PROJECT_ROOT 解析到 _internal）
]

# Playwright 的 node driver（driver/node.exe + package/cli.js）必须显式收进包——
# PyInstaller 常规分析收不到它，缺失时 chromium.launch 报 WinError 2
# （官方打包文档的做法）。driver 位置以构建环境实际安装的 playwright 为准。
try:
    import playwright as _pw
    datas.append((str(Path(_pw.__file__).resolve().parent / 'driver'), 'playwright/driver'))
except ImportError:
    pass

# Anaconda/conda 底座的 venv：_ssl 依赖的 OpenSSL DLL 在 Library/bin 下，
# PyInstaller 的常规 hook 覆盖不到，手动收进包（python.org 官方发行版不需要）。
import sys as _sys
_binaries = []
if 'conda' in _sys.version.lower() or 'Anaconda' in _sys.prefix:
    _conda_bin = Path(_sys.base_prefix) / 'Library' / 'bin'
    for _dll in ('libssl-3-x64.dll', 'libcrypto-3-x64.dll', 'libffi-8.dll'):
        _p = _conda_bin / _dll
        if _p.exists():
            _binaries.append((str(_p), '.'))


icon_path = str(ROOT / 'packaging' / 'app.ico')
if not os.path.exists(icon_path):
    icon_path = None

a = Analysis(
    [str(ROOT / 'Start.py')],
    pathex=[str(ROOT)],
    binaries=_binaries,
    datas=datas,
    hiddenimports=[
        'app.reply_server',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter', 'pytest', 'pip', 'setuptools', 'wheel',
        'tests', 'docs', 'scripts', 'packaging', 'deploy',
    ],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='鱼小铺',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,       # 桌面窗口形态：pywebview 原生窗口承载界面，无控制台黑窗
    icon=icon_path,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name='鱼小铺',
)
