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

type RealtimeStatus = (connected: boolean) => void;
type RealtimeEventHandler = (event: ChatMessageEvent) => void;

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

/** 建立实时事件连接，返回断开函数。onStatus(false) 只反映连接掉线。 */
export const connectRealtimeEvents = (
  onEvent: RealtimeEventHandler,
  onStatus: RealtimeStatus
): (() => void) => {
  let closed = false;
  let attempt = 0;
  let source: EventSource | null = null;
  let retryTimer = 0;

  const scheduleReconnect = () => {
    if (closed) return;
    const delay = RECONNECT_BACKOFF_S[Math.min(attempt, RECONNECT_BACKOFF_S.length - 1)];
    attempt += 1;
    retryTimer = window.setTimeout(() => void connect(), delay * 1000);
  };

  const connect = async () => {
    if (closed) return;
    try {
      const ticket = await requestTicket();
      if (closed) return;
      source = new EventSource(`/events?ticket=${encodeURIComponent(ticket)}`);
      source.addEventListener('chat_message', (raw) => {
        try {
          const event = JSON.parse((raw as MessageEvent).data) as ChatMessageEvent;
          if (event && event.chat_id && event.cookie_id) onEvent(event);
        } catch {
          // 坏帧直接丢弃，等轮询对账
        }
      });
      source.onopen = () => {
        attempt = 0;
        onStatus(true);
      };
      source.onerror = () => {
        source?.close();
        source = null;
        onStatus(false);
        scheduleReconnect();
      };
    } catch {
      // 换票失败（未登录/服务不可用），退避后重试
      onStatus(false);
      scheduleReconnect();
    }
  };

  void connect();
  return () => {
    closed = true;
    window.clearTimeout(retryTimer);
    source?.close();
    source = null;
  };
};
