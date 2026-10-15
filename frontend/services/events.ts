import { post } from '../lib/request';

// SSE 实时事件：EventSource 带不了 Authorization 头，先调已登录接口换
// 一次性票据，再用票据建连。票据单次有效且短时效 —— EventSource 自带的
// 断线重连会拿着同一 URL 反复打 401，因此这里手动管理重连：断开即关流、
// 重新换票、按退避梯度重建。

export interface ChatMessageEvent {
  type: 'chat_message';
  cookie_id: string;
  chat_id: string;
  is_self: boolean;
  sender_user_id: string;
  sender_nick: string;
  /** 摘要级内容：文本为原文，图片/语音等富媒体为 [图片] 之类的占位符 */
  content: string;
  /** 毫秒时间戳 */
  time: number;
}

/** 通知渠道派发事件（新消息触发钉钉/飞书/Bark/邮件等通知时推送）。 */
export interface NotificationEvent {
  type: 'notification';
  cookie_id: string;
  title: string;
  content: string;
  /** 毫秒时间戳 */
  time: number;
}

type RealtimeStatus = (connected: boolean) => void;
type AnyEventHandler = (event: Record<string, unknown>) => void;

const RECONNECT_BACKOFF_S = [1, 2, 5, 10, 20];

const requestTicket = async (): Promise<string> => {
  const response = await post<{ success: boolean; data?: { ticket?: string } }>(
    '/events/ticket',
    {}
  );
  const ticket = response.data?.ticket;
  if (!ticket) throw new Error('票据签发失败');
  return ticket;
};

// ---------------- 共享单例连接 ----------------
// 页面里多个组件（消息中心、顶栏通知铃铛……）都订阅实时事件，各自开一条
// EventSource 既浪费连接也让服务端多排一条队列。这里维护一条共享连接，
// 按事件类型分发到各订阅者；最后一个订阅者退订时才真正断流。

interface SharedConnection {
  source: EventSource | null;
  attempt: number;
  retryTimer: number;
  /** 事件类型 → 订阅者集合 */
  subscribers: Map<string, Set<AnyEventHandler>>;
  /** 当前连接上已绑定监听的事件类型（防同类型重复绑定导致回调翻倍） */
  boundTypes: Set<string>;
  statusListeners: Set<RealtimeStatus>;
}

let shared: SharedConnection | null = null;

// ---------------- 传输级去重 ----------------
// 账号循环重连重放时，同一条消息会被后端重复投递（消息中心靠轮询对账兜底，
// 但铃铛没有对账层）。在分发前按内容指纹在短窗口内去重，所有订阅者共同受益。
// 没有可靠字段的事件直接放行——宁可重复，不可丢消息。
const DEDUP_WINDOW_MS = 5000;
const recentEventFingerprints = new Map<string, number>();

const eventFingerprint = (type: string, event: Record<string, unknown>): string | null => {
  switch (type) {
    case 'chat_message':
      if (!event.cookie_id || !event.chat_id || event.time === undefined) return null;
      return `${type}|${event.cookie_id}|${event.chat_id}|${event.is_self}|${event.content}|${event.time}`;
    case 'notification':
      if (!event.cookie_id || event.time === undefined) return null;
      return `${type}|${event.cookie_id}|${event.title}|${event.content}|${event.time}`;
    case 'announcement':
      if (event.id === undefined) return null;
      return `${type}|${event.id}`;
    default:
      return null;
  }
};

const isDuplicateEvent = (type: string, event: Record<string, unknown>): boolean => {
  const fingerprint = eventFingerprint(type, event);
  if (fingerprint === null) return false;
  const now = Date.now();
  // 顺手清理过期项，避免长期运行累积
  if (recentEventFingerprints.size > 256) {
    for (const [key, seenAt] of recentEventFingerprints) {
      if (now - seenAt > DEDUP_WINDOW_MS) recentEventFingerprints.delete(key);
    }
  }
  const seenAt = recentEventFingerprints.get(fingerprint);
  if (seenAt !== undefined && now - seenAt < DEDUP_WINDOW_MS) return true;
  recentEventFingerprints.set(fingerprint, now);
  return false;
};

const bindType = (source: EventSource, type: string) => {
  if (shared?.boundTypes.has(type)) return;
  shared?.boundTypes.add(type);
  source.addEventListener(type, (raw) => {
    try {
      const event = JSON.parse((raw as MessageEvent).data) as Record<string, unknown>;
      if (isDuplicateEvent(type, event)) return;
      const handlers = shared?.subscribers.get(type);
      if (handlers) for (const handler of handlers) handler(event);
    } catch {
      // 坏帧直接丢弃，等轮询对账
    }
  });
};

const ensureConnection = (): SharedConnection => {
  if (shared) return shared;
  shared = {
    source: null,
    attempt: 0,
    retryTimer: 0,
    subscribers: new Map(),
    boundTypes: new Set(),
    statusListeners: new Set(),
  };

  const scheduleReconnect = () => {
    if (!shared) return;
    const delay = RECONNECT_BACKOFF_S[Math.min(shared.attempt, RECONNECT_BACKOFF_S.length - 1)];
    shared.attempt += 1;
    shared.retryTimer = window.setTimeout(() => void connect(), delay * 1000);
  };

  const connect = async () => {
    if (!shared) return;
    try {
      const ticket = await requestTicket();
      if (!shared) return;
      const source = new EventSource(`/events?ticket=${encodeURIComponent(ticket)}`);
      shared.source = source;
      // 按当前订阅表全量绑定具名事件（新连接，重置已绑定记录）
      shared.boundTypes = new Set();
      for (const [type] of shared.subscribers) bindType(source, type);
      source.onopen = () => {
        if (!shared) return;
        shared.attempt = 0;
        for (const listener of shared.statusListeners) listener(true);
      };
      source.onerror = () => {
        if (!shared) return;
        source.close();
        shared.source = null;
        for (const listener of shared.statusListeners) listener(false);
        scheduleReconnect();
      };
    } catch {
      // 换票失败（未登录/服务不可用），退避后重试
      if (!shared) return;
      for (const listener of shared.statusListeners) listener(false);
      scheduleReconnect();
    }
  };

  void connect();
  return shared;
};

const dropConnectionIfIdle = () => {
  if (!shared) return;
  const hasSubscribers = [...shared.subscribers.values()].some(set => set.size > 0);
  if (hasSubscribers || shared.statusListeners.size > 0) return;
  window.clearTimeout(shared.retryTimer);
  shared.source?.close();
  shared = null;
};

/** 订阅某类实时事件，返回退订函数。 */
export const subscribeRealtimeEvent = (
  type: string,
  handler: AnyEventHandler
): (() => void) => {
  const conn = ensureConnection();
  let set = conn.subscribers.get(type);
  if (!set) {
    set = new Set();
    conn.subscribers.set(type, set);
  }
  set.add(handler);
  // 新类型在已建立的连接上补绑（重连时 ensureConnection 已全量绑定）
  if (conn.source) bindType(conn.source, type);
  return () => {
    const current = shared;
    if (!current) return;
    const handlers = current.subscribers.get(type);
    if (!handlers) return;
    handlers.delete(handler);
    if (handlers.size === 0) current.subscribers.delete(type);
    dropConnectionIfIdle();
  };
};

/** 订阅连接状态（多订阅者共享同一条连接）。 */
export const subscribeRealtimeStatus = (listener: RealtimeStatus): (() => void) => {
  const conn = ensureConnection();
  conn.statusListeners.add(listener);
  return () => {
    shared?.statusListeners.delete(listener);
    dropConnectionIfIdle();
  };
};

/** 兼容旧签名：订阅 chat_message + 连接状态，返回断开函数（消息中心在用）。 */
export const connectRealtimeEvents = (
  onEvent: (event: ChatMessageEvent) => void,
  onStatus: RealtimeStatus
): (() => void) => {
  const offEvent = subscribeRealtimeEvent('chat_message', event => {
    if (event && event.chat_id && event.cookie_id) onEvent(event as unknown as ChatMessageEvent);
  });
  const offStatus = subscribeRealtimeStatus(onStatus);
  return () => {
    offEvent();
    offStatus();
  };
};
