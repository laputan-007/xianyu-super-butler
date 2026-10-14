#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""浏览器实时事件总线（SSE 后端）。

账号任务跑在主事件循环、uvicorn 跑在独立线程的另一个循环。发布端
（XianyuLive.handle_message）在账号循环线程里调用 publish_for_cookie：
解析 cookie 归属的后台用户后，用 call_soon_threadsafe 把事件投到每个
订阅者的循环 —— 跨线程直接 put 会破坏对方循环的内部队列，必须走线程
安全入口。

票据（ticket）：EventSource 无法携带 Authorization 头，长效 token 放
query string 又会落进访问日志。改为：已登录接口先换一张短时效的一次性
票据，EventSource 带票据建连，服务端消费后按票据里的用户绑定订阅流。
"""

import asyncio
import secrets
import threading
import time
from collections import defaultdict
from typing import Any, Callable, Dict, List, Optional, Tuple

TICKET_TTL_S = 30
QUEUE_MAXSIZE = 200


class RealtimeHub:
    """线程安全的用户级事件广播。同一用户多个标签页 = 多条独立订阅。"""

    def __init__(self):
        self._lock = threading.Lock()
        # user_id -> [(loop, queue), ...]
        self._subscribers: Dict[int, List[Tuple[asyncio.AbstractEventLoop, asyncio.Queue]]] = defaultdict(list)
        self._tickets: Dict[str, Tuple[int, float]] = {}

    # -------------------- 票据 --------------------

    def create_ticket(self, user_id: int) -> str:
        token = secrets.token_urlsafe(32)
        with self._lock:
            # 顺手清掉过期未消费的票据，避免长期运行慢慢积累
            if len(self._tickets) > 128:
                now = time.time()
                self._tickets = {
                    key: value for key, value in self._tickets.items()
                    if value[1] > now
                }
            self._tickets[token] = (int(user_id), time.time() + TICKET_TTL_S)
        return token

    def consume_ticket(self, token: str) -> Optional[int]:
        """消费票据，返回其绑定的用户 ID；无效/过期/已用过返回 None。"""
        with self._lock:
            record = self._tickets.pop(token, None)
        if not record:
            return None
        user_id, expires_at = record
        return user_id if expires_at > time.time() else None

    # -------------------- 订阅 --------------------

    def subscribe(self, user_id: int) -> Tuple[asyncio.Queue, Callable[[], None]]:
        """在 uvicorn 循环内调用：注册一条订阅，返回 (队列, 退订函数)。"""
        loop = asyncio.get_running_loop()
        queue: asyncio.Queue = asyncio.Queue(maxsize=QUEUE_MAXSIZE)
        entry = (loop, queue)
        owner = int(user_id)
        with self._lock:
            self._subscribers[owner].append(entry)

        def unsubscribe() -> None:
            with self._lock:
                entries = self._subscribers.get(owner)
                if entries is None:
                    return
                try:
                    entries.remove(entry)
                except ValueError:
                    pass

        return queue, unsubscribe

    # -------------------- 发布 --------------------

    def publish_for_cookie(self, cookie_id: str, event: Dict[str, Any]) -> None:
        """从任意线程调用：把事件推给拥有该账号的后台用户的所有订阅。

        丢一条事件不是错误：前端轮询对账兜底会补上，队列宁可丢旧也不阻塞
        发布方（发布方在账号消息循环里，卡住会拖慢整个账号的自动回复）。
        """
        try:
            from app.db_manager import db_manager
            user_id = db_manager.get_cookie_owner_user_id(cookie_id)
        except Exception:
            return
        if not user_id:
            return
        with self._lock:
            entries = list(self._subscribers.get(int(user_id), []))
        for loop, queue in entries:
            def deliver(target: asyncio.Queue = queue) -> None:
                if target.full():
                    try:
                        target.get_nowait()
                    except asyncio.QueueEmpty:
                        pass
                target.put_nowait(event)
            try:
                loop.call_soon_threadsafe(deliver)
            except RuntimeError:
                # 订阅者所在循环已关闭（服务停止中），跳过
                pass


realtime_hub = RealtimeHub()
