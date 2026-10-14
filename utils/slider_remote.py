#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""远程过滑块节点（服务化解耦设计，参考 xianyu-auto-reply-my 的架构）。

把"过滑块"从主服务里解耦成可独立部署的能力，两种角色：

1. 客户端（本机是主服务）：滑块策略选 remote 时，把 punish 链接委托给
   远程节点求解 —— 典型场景是 NAS/容器跑主服务（无头环境通过率低），
   一台 Windows 桌面机专职过滑块（真实桌面 + 硬件注入）。
   solve_via_remote() 发 POST，成功返回节点回收的 Cookie 字典。

2. 服务端（本机是滑块节点）：暴露 POST /api/slider/solve 供其他部署
   调用，秘钥鉴权（系统设置 slider_service_secret_key，留空即未启用）。
   调用方可以只给 punish 链接；链接过期时凭传入的 Cookie 重取新鲜链接
   （复用 manual_captcha 的 _fetch_live_verification_url）。

安全边界：跨机传输的内容是 punish 链接与（调用方自愿开启时的）账号
Cookie —— 秘钥配错等于把账号交给对方，务必只在可信网络/可信节点间使用。
"""

import asyncio
import concurrent.futures
from typing import Optional

from loguru import logger


def _get_setting(key: str, default: str = '') -> str:
    try:
        from app.db_manager import db_manager
        return (db_manager.get_system_setting(key) or default).strip()
    except Exception:
        return default


def get_remote_config() -> dict:
    """读取「作为客户端」的远程节点配置。"""
    return {
        'url': _get_setting('slider_remote_url').rstrip('/'),
        'secret_key': _get_setting('slider_remote_secret_key'),
        'pass_cookies': _get_setting('slider_remote_pass_cookies', 'false').lower() == 'true',
    }


async def solve_via_remote(url: str, cookies_str: str = '', timeout: float = 150.0) -> dict:
    """委托远程节点过滑块。

    Returns:
        {"success": bool, "message": str, "data": {"cookies": {...}}}
        cookies 为节点浏览器回收的原始 Cookie 字典（含 x5sec 等），
        形状与本地 XianyuSliderStealth.run 的返回一致，调用方用同一套
        合并逻辑写回即可。
    """
    import aiohttp

    cfg = get_remote_config()
    if not cfg['url']:
        return {'success': False, 'message': '未配置远程过滑块节点地址'}

    payload = {
        'secret_key': cfg['secret_key'],
        'url': url,
        'browser_timeout': 60,
    }
    if cfg['pass_cookies'] and cookies_str:
        payload['cookies'] = cookies_str

    endpoint = f"{cfg['url']}/api/slider/solve"
    try:
        # 过滑块含浏览器启动与最多 3 次拖动重试，全程可达数十秒，
        # 用独立会话放宽超时，避免撞上全局客户端的短超时
        async with aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=timeout)
        ) as session:
            async with session.post(endpoint, json=payload) as resp:
                return await resp.json(content_type=None)
    except asyncio.TimeoutError:
        logger.error(f"远程过滑块超时（{timeout:.0f}s）: {endpoint}")
        return {'success': False, 'message': f'远程节点超时（{timeout:.0f}秒）'}
    except Exception as exc:
        logger.error(f"远程过滑块请求失败: {endpoint} {exc}")
        return {'success': False, 'message': f'远程节点请求失败: {exc}'}


async def run_slider_solve_service(
    secret_key: str,
    url: str = '',
    cookies: str = '',
    account_id: str = '',
    browser_timeout: int = 60,
) -> dict:
    """服务端执行一次过滑块（由 reply_server 的 /api/slider/solve 调用）。

    鉴权成功后：链接缺失/过期时凭 Cookie 重取新鲜 punish 链接，然后
    在线程池里跑本地滑块（遵循本机配置的 hardware/hardware_idle/cdp
    通道）。返回结构与 solve_via_remote 一致。
    """
    from utils.xianyu_slider_stealth import XianyuSliderStealth

    expected = _get_setting('slider_service_secret_key')
    if not expected:
        return {'success': False, 'message': '本机未启用对外过滑块服务（未设置服务秘钥）'}
    if secret_key != expected:
        logger.warning(f"对外过滑块调用秘钥错误（account_id={account_id}）")
        return {'success': False, 'message': '秘钥错误'}

    # 链接缺失时凭 Cookie 重取；x5secdata 约 1 小时失效，节点端排队
    # 久了也会过期 —— 重取成功与否由 _fetch_live_verification_url 决定
    verification_url: Optional[str] = (url or '').strip() or None
    if not verification_url and cookies:
        try:
            from utils.manual_captcha import _fetch_live_verification_url
            verification_url = await _fetch_live_verification_url(
                account_id or 'remote_service', cookies
            )
        except Exception as exc:
            logger.warning(f"重取新鲜惩罚链接失败: {exc}")
    if not verification_url:
        return {'success': False, 'message': '缺少 punish 链接且无法凭 Cookie 重取'}

    browser_timeout = max(20, min(180, int(browser_timeout)))
    tag = account_id or 'external'
    logger.info(f"【{tag}】对外过滑块服务开始: {verification_url[:80]}...")

    slider = XianyuSliderStealth(
        user_id=f'remote_{tag}',
        enable_learning=False,
        headless=False,
    )
    loop = asyncio.get_event_loop()
    try:
        with concurrent.futures.ThreadPoolExecutor() as executor:
            success, cookies_dict = await loop.run_in_executor(
                executor,
                slider.run,
                verification_url,
                cookies or None,
            )
    except Exception as exc:
        logger.error(f"【{tag}】对外过滑块执行异常: {exc}")
        return {'success': False, 'message': f'执行异常: {exc}'}

    if success and cookies_dict:
        logger.info(f"【{tag}】对外过滑块成功，回收 {len(cookies_dict)} 个Cookie")
        return {'success': True, 'data': {'cookies': cookies_dict}}
    logger.warning(f"【{tag}】对外过滑块失败")
    return {'success': False, 'message': '求解失败（详见节点日志）'}
