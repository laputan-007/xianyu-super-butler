# -*- coding: utf-8 -*-
"""版本信息单一来源。

客户端版本号在这里维护，announcement 的 local_version、/health 接口都从这里取。
打包脚本（scripts/build_client.py）会在构建时回写 BUILD_TIME 与 GIT_COMMIT，
源码里这两个字段保持空值——运行未打包的源码时版本摘要就只有版本号。
"""
import re

APP_VERSION = '3.3.1'
BUILD_TIME = ''
GIT_COMMIT = ''


def get_version_summary() -> str:
    """版本摘要（供 /health 与日志输出）。"""
    parts = [f'v{APP_VERSION}']
    if BUILD_TIME:
        parts.append(f'built {BUILD_TIME}')
    if GIT_COMMIT:
        parts.append(f'git {GIT_COMMIT[:8]}')
    return ' / '.join(parts)


def read_dist_version() -> str:
    """读取 exe 旁边的 version.txt（打包脚本写入），没有则回落 APP_VERSION。

    这样升级包只需替换程序目录里的文件，version.txt 跟着发行包走，
    不用动源码里的常量。
    """
    try:
        import os
        import sys
        base = os.path.dirname(sys.executable) if getattr(sys, 'frozen', False) else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        path = os.path.join(base, 'version.txt')
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f:
                m = re.search(r'([0-9][0-9A-Za-z.\-_]*)', f.read())
                if m:
                    return m.group(1)
    except Exception:
        pass
    return APP_VERSION
