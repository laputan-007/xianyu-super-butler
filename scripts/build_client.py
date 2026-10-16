# -*- coding: utf-8 -*-
"""Windows 客户端一键打包脚本（版本管理 + 打包 + 组装发行目录）。

用法（在仓库根目录，用项目 venv 的 Python 执行）：
    .venv/Scripts/python.exe scripts/build_client.py [--skip-frontend]

步骤：
1. 版本戳：把构建时间与 git 提交号写进 app/version.py（构建后还原源码）；
2. 前端构建（npm run build，--skip-frontend 可跳过）；
3. 图标：frontend/public/logo.png 转 packaging/app.ico（Pillow）；
4. PyInstaller 按 packaging/xianyu_butler.spec 打包（onedir）；
5. 组装 dist/鱼小铺/：version.txt（read_dist_version 运行时读取）+ 使用说明；
6. Playwright Chromium 装进发行目录的 _internal/browsers（随包分发）；
7. 产出 dist/鱼小铺-<版本>-win64.zip。

前置依赖：venv 里需有 pyinstaller（脚本会自动安装）、Node.js（签名 JS 运行时，
仅运行期需要）。
"""
import argparse
import datetime
import os
import re
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VERSION_FILE = ROOT / 'app' / 'version.py'
DIST = ROOT / 'dist'
APP_DIR_NAME = '鱼小铺'


def read_version() -> str:
    text = VERSION_FILE.read_text(encoding='utf-8')
    m = re.search(r"APP_VERSION\s*=\s*'([^']+)'", text)
    if not m:
        raise SystemExit('app/version.py 里找不到 APP_VERSION')
    return m.group(1)


def git_commit() -> str:
    try:
        return subprocess.run(
            ['git', 'rev-parse', 'HEAD'], cwd=ROOT,
            capture_output=True, text=True, check=True,
        ).stdout.strip()
    except Exception:
        return ''


def stamp_version(build_time: str, commit: str) -> str:
    """把构建信息写进 app/version.py，返回原始内容用于构建后还原。"""
    original = VERSION_FILE.read_text(encoding='utf-8')
    stamped = re.sub(r"BUILD_TIME = ''", f"BUILD_TIME = '{build_time}'", original)
    stamped = re.sub(r"GIT_COMMIT = ''", f"GIT_COMMIT = '{commit}'", stamped)
    VERSION_FILE.write_text(stamped, encoding='utf-8', newline='\n')
    return original


def restore_version(original: str) -> None:
    VERSION_FILE.write_text(original, encoding='utf-8', newline='\n')


def run(cmd, cwd=ROOT, **kwargs):
    print(f'+ {" ".join(str(c) for c in cmd)}')
    subprocess.run([str(c) for c in cmd], cwd=str(cwd), check=True, **kwargs)


def build_frontend(skip: bool) -> None:
    if skip:
        print('跳过前端构建（--skip-frontend）')
        return
    npm = shutil.which('npm') or 'npm.cmd'
    run([npm, 'run', 'build'], cwd=ROOT / 'frontend')


def make_icon() -> None:
    logo = ROOT / 'frontend' / 'public' / 'logo.png'
    ico = ROOT / 'packaging' / 'app.ico'
    if not logo.exists():
        print('未找到 logo.png，跳过图标')
        return
    from PIL import Image
    img = Image.open(logo).convert('RGBA')
    img.save(str(ico), sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
    print(f'图标已生成: {ico.name}')


def ensure_pyinstaller() -> None:
    try:
        import PyInstaller  # noqa: F401
    except ImportError:
        run([sys.executable, '-m', 'pip', 'install', 'pyinstaller'])


def run_pyinstaller() -> None:
    run([
        sys.executable, '-m', 'PyInstaller',
        '--noconfirm',
        '--distpath', str(DIST),
        '--workpath', str(DIST / '_build'),
        str(ROOT / 'packaging' / 'xianyu_butler.spec'),
    ])


def assemble(version: str, build_time: str, commit: str) -> Path:
    app_dir = DIST / APP_DIR_NAME
    # version.txt：运行期 read_dist_version() 读取，升级只换发行包不动源码常量
    (app_dir / 'version.txt').write_text(
        f'{version}\n# built {build_time}\n# git {commit}\n',
        encoding='utf-8', newline='\n',
    )
    (app_dir / '使用说明.txt').write_text(README_CN, encoding='utf-8', newline='\n')
    return app_dir


def install_browsers(app_dir: Path) -> None:
    """把 Playwright Chromium 装进发行目录（随包分发，双击即用）。

    装到 exe 旁的 playwright/ 目录——这是 Start.py 里 _check_and_install_playwright
    预检函数认可的布局（playwright/chromium-*/chrome-win/chrome.exe），
    与运行期 PLAYWRIGHT_BROWSERS_PATH 指向保持一致。
    """
    env = dict(os.environ)
    env['PLAYWRIGHT_BROWSERS_PATH'] = str(app_dir / 'playwright')
    print('+ python -m playwright install chromium（装进发行目录）')
    subprocess.run(
        [sys.executable, '-m', 'playwright', 'install', 'chromium'],
        cwd=str(ROOT), env=env, check=True,
    )


def make_zip(app_dir: Path, version: str) -> Path:
    zip_path = DIST / f'鱼小铺-{version}-win64'
    archive = shutil.make_archive(str(zip_path), 'zip', root_dir=str(DIST), base_dir=APP_DIR_NAME)
    return Path(archive)


def main() -> None:
    parser = argparse.ArgumentParser(description='鱼小铺 Windows 客户端打包')
    parser.add_argument('--skip-frontend', action='store_true', help='跳过前端构建')
    args = parser.parse_args()

    version = read_version()
    build_time = datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
    commit = git_commit()
    print(f'== 鱼小铺 v{version} 打包开始（git {commit[:8] or "无"}）==')

    if DIST.exists():
        shutil.rmtree(DIST / '_build', ignore_errors=True)
        shutil.rmtree(DIST / APP_DIR_NAME, ignore_errors=True)

    original = stamp_version(build_time, commit)
    try:
        build_frontend(args.skip_frontend)
        make_icon()
        ensure_pyinstaller()
        run_pyinstaller()
    finally:
        restore_version(original)

    app_dir = assemble(version, build_time, commit)
    install_browsers(app_dir)
    archive = make_zip(app_dir, version)

    size_mb = archive.stat().st_size / 1024 / 1024
    print(f'== 打包完成 ==\n发行目录: {app_dir}\n压缩包: {archive}（{size_mb:.1f} MB）')


README_CN = """鱼小铺 - Windows 客户端（单机版）

【启动】
双击「鱼小铺.exe」，会弹出「鱼小铺」桌面窗口（就是管理后台界面），
窗口关闭即退出程序。也可以用普通浏览器访问 http://127.0.0.1:18099/ 。

【首次登录】
默认管理员账号 admin，默认密码 admin123（请在设置页立即修改）。

【环境要求】
- 需要安装 Node.js（消息签名计算用，https://nodejs.org 下载 LTS 版安装即可）
- 浏览器内核已内置在 _internal/browsers，无需另外安装
- 杀毒软件误报时请将本目录加入信任区

【数据与升级】
- data/（数据库）、browser_data/、logs/ 都生成在 exe 同目录，升级时
  删除旧程序文件、解压新包覆盖即可，数据不受影响
- version.txt 记录当前发行版本，勿删除

【常见问题】
- 端口冲突：默认端口 18099（可用环境变量 API_PORT 覆盖）
- 闪退：查看 logs/ 目录下最新日志定位原因
"""


if __name__ == '__main__':
    main()
