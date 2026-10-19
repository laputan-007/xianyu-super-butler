# -*- coding: utf-8 -*-
"""软件更新服务：检查 Gitee/GitHub 最新发行版并在应用内拉取更新。

数据源双备份：Gitee API（国内直连快）与 GitHub API（单文件直下，匿名 60 次/时够用），
任一可用即出结果；两边都挂时返回错误让前端提示。

更新安装（apply_update）在后台线程里：
下载资产（GitHub 单 exe 或 Gitee 分卷）→ 分卷合并 → 启动 Inno 安装向导
（同 AppId 原地升级，端口 port.txt 与数据目录自动保留）→ 延迟退出应用。
"""
import os
import re
import subprocess
import threading
import time
from typing import Any, Dict, List, Optional

import requests

from app.announcement import get_local_version

GITEE_API = 'https://gitee.com/api/v5/repos/is-it-day-and-night/xianyu-super-butler/releases/latest'
GITHUB_API = 'https://api.github.com/repos/laputan-007/xianyu-super-butler/releases/latest'
UA = 'yuxiaopu-updater/1.0'

# 下载/安装状态（前端轮询）
_state: Dict[str, Any] = {
    'phase': 'idle',        # idle | downloading | merging | launching | error
    'downloaded': 0,
    'total': 0,
    'latest_version': '',
    'source': '',
    'error': '',
}
_state_lock = threading.Lock()


def get_state() -> Dict[str, Any]:
    with _state_lock:
        return dict(_state)


def _set_state(**kwargs) -> None:
    with _state_lock:
        _state.update(kwargs)


def _version_tuple(value: str):
    parts = []
    for chunk in str(value or '').strip().lstrip('vV').split('.'):
        digits = ''.join(ch for ch in chunk if ch.isdigit())
        parts.append(int(digits) if digits else 0)
    return tuple(parts) if parts else (0,)


def _parse_tag_version(tag: str) -> str:
    """'v3.3.4' → '3.3.4'（保留数字段，忽略后缀如 -beta）。"""
    m = re.match(r'^[vV]?(\d+(?:\.\d+){0,3})', str(tag or '').strip())
    return m.group(1) if m else ''


def _fetch_gitee() -> Optional[Dict[str, Any]]:
    try:
        token = (os.getenv('GITEE_TOKEN') or '').strip()
        r = requests.get(GITEE_API, params={'access_token': token} if token else None,
                         headers={'User-Agent': UA}, timeout=10)
        if r.status_code != 200:
            return None
        d = r.json()
    except Exception:
        return None
    assets = []
    for a in d.get('assets', []) or []:
        name = str(a.get('name') or '')
        url = str(a.get('browser_download_url') or '')
        if name and url and name.startswith('setup.exe.') and not name.endswith('.bat'):
            assets.append({'name': name, 'url': url, 'size': int(a.get('size') or 0)})
    assets.sort(key=lambda x: x['name'])
    version = _parse_tag_version(d.get('tag_name', ''))
    if not version or not assets:
        return None
    return {
        'source': 'gitee',
        'latest_version': version,
        'release_url': d.get('html_url') or '',
        'published_at': d.get('created_at') or '',
        'assets': assets,
        'merge': len(assets) > 1,   # Gitee 是分卷，需要合并
    }


def _fetch_github() -> Optional[Dict[str, Any]]:
    try:
        import urllib3
        urllib3.disable_warnings()
        r = requests.get(GITHUB_API, headers={'User-Agent': UA}, timeout=10,
                          verify=False)  # 部分内网环境根证书不全；GitHub 公开资产下载可容忍
        if r.status_code != 200:
            return None
        d = r.json()
    except Exception:
        return None
    assets = []
    for a in d.get('assets', []) or []:
        name = str(a.get('name') or '')
        url = str(a.get('browser_download_url') or '')
        if name and url and name.endswith('.exe'):
            assets.append({'name': name, 'url': url, 'size': int(a.get('size') or 0)})
    version = _parse_tag_version(d.get('tag_name', ''))
    if not version or not assets:
        return None
    return {
        'source': 'github',
        'latest_version': version,
        'release_url': d.get('html_url') or '',
        'published_at': d.get('published_at') or '',
        'assets': assets,
        'merge': False,       # GitHub 单文件直下
    }


def check_update() -> Dict[str, Any]:
    """查询最新发行版。Gitee 优先（国内），GitHub 兜底；返回含 has_update。"""
    local = get_local_version()
    info = _fetch_gitee() or _fetch_github()
    if info is None:
        return {'local_version': local, 'error': 'Gitee 与 GitHub 均不可达或未返回有效发行版，请稍后重试'}
    info['local_version'] = local
    info['has_update'] = _version_tuple(info['latest_version']) > _version_tuple(local)
    return info


def _download_to(url: str, path: str) -> int:
    """流式下载到文件，实时累计进度；返回字节数。"""
    import urllib3
    urllib3.disable_warnings()
    with requests.get(url, headers={'User-Agent': UA}, stream=True, timeout=(15, 60),
                      verify=False) as r:
        r.raise_for_status()
        done = 0
        with open(path, 'wb') as f:
            for chunk in r.iter_content(chunk_size=1024 * 256):
                if chunk:
                    f.write(chunk)
                    done += len(chunk)
                    _set_state(downloaded=_state['downloaded'] + len(chunk))
    return done


def _apply_worker(plan: Dict[str, Any], target_dir: str) -> None:
    """后台线程：下载（必要时合并分卷）→ 启动安装向导 → 延迟退出应用。"""
    try:
        os.makedirs(target_dir, exist_ok=True)
        # 清掉上一次的下载残留，避免把旧卷拼进新包
        for stale in os.listdir(target_dir):
            if stale.startswith(('setup.exe.', 'yuxiaopu-', '鱼小铺-')):
                try:
                    os.remove(os.path.join(target_dir, stale))
                except OSError:
                    pass

        parts = []
        total = sum(a['size'] for a in plan['assets'])
        _set_state(phase='downloading', downloaded=0, total=total,
                   latest_version=plan['latest_version'], source=plan['source'], error='')
        for asset in plan['assets']:
            part_path = os.path.join(target_dir, asset['name'])
            _download_to(asset['url'], part_path)
            parts.append(part_path)

        final_path = os.path.join(target_dir, f"yuxiaopu-{plan['latest_version']}-setup.exe")
        if plan.get('merge'):
            _set_state(phase='merging')
            with open(final_path, 'wb') as out:
                for part in parts:
                    with open(part, 'rb') as pf:
                        while True:
                            chunk = pf.read(1024 * 1024)
                            if not chunk:
                                break
                            out.write(chunk)
        else:
            os.replace(parts[0], final_path)

        _set_state(phase='launching')
        # 安装向导启动：同 AppId 原地升级，port.txt 与数据目录自动保留
        subprocess.Popen([final_path], cwd=target_dir, close_fds=True)
        time.sleep(2)
        os._exit(0)
    except Exception as exc:  # noqa: BLE001 —— 后台线程必须兜底，否则进度永远停在 downloading
        _set_state(phase='error', error=str(exc)[:300])


def apply_update(plan: Dict[str, Any]) -> bool:
    """开始下载并安装更新。已在进行中时拒绝重复触发。"""
    with _state_lock:
        if _state['phase'] in ('downloading', 'merging', 'launching'):
            return False
    target_dir = os.path.join(os.getcwd(), 'update_cache')
    threading.Thread(target=_apply_worker, args=(plan, target_dir),
                     name='updater', daemon=True).start()
    return True
