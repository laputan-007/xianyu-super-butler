import React, { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, MessageSquareText, Megaphone, X } from 'lucide-react';
import {
  ChatMessageEvent,
  NotificationEvent,
  subscribeRealtimeEvent,
} from '../services/events';
import { getLatestAnnouncement } from '../services/api';

interface BellItem {
  id: string;
  kind: 'message' | 'system' | 'announcement';
  title: string;
  content: string;
  time: number;
  read: boolean;
}

const MAX_ITEMS = 30;
const SEEN_ANNOUNCEMENT_KEY = 'xianyu-seen-announcement-id';

const formatTime = (time: number): string => {
  const date = new Date(time);
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const sameDay = date.toDateString() === now.toDateString();
  const hm = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  if (sameDay) return hm;
  return `${date.getMonth() + 1}/${date.getDate()} ${hm}`;
};

/**
 * 顶栏通知铃铛：SSE 实时接收两类事件——
 * - chat_message：买家新消息（自己发出的不提醒）
 * - notification：通知渠道派发（新消息触发钉钉/飞书/Bark/邮件等）
 * 点击展开最近通知列表，可一键全部已读。
 */
const NotificationBell: React.FC<{ onOpenMessage?: () => void }> = ({ onOpenMessage }) => {
  const [items, setItems] = useState<BellItem[]>([]);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const push = (item: Omit<BellItem, 'id' | 'read'>) => {
      setItems(current => [
        { ...item, id: `${item.time}-${Math.random().toString(36).slice(2, 8)}`, read: false },
        ...current,
      ].slice(0, MAX_ITEMS));
    };

    const offMessage = subscribeRealtimeEvent('chat_message', raw => {
      const event = raw as unknown as ChatMessageEvent;
      if (event.is_self || !event.content) return;
      push({
        kind: 'message',
        title: `${event.sender_nick || '买家'} 发来消息`,
        content: event.content,
        time: event.time || Date.now(),
      });
    });
    const offNotification = subscribeRealtimeEvent('notification', raw => {
      const event = raw as unknown as NotificationEvent;
      push({
        kind: 'system',
        title: event.title || '系统通知',
        content: event.content || '',
        time: event.time || Date.now(),
      });
    });
    // 公告：管理员发布时实时推送（SSE 广播），并记录已见 ID。
    // seen 兜底：登录拉取补推与 SSE 广播可能几乎同时到达（发布发生在登录瞬间），
    // 都按已见 ID 去重，保证同一条公告只进列表一次。
    const offAnnouncement = subscribeRealtimeEvent('announcement', raw => {
      const event = raw as { id?: number; title?: string; content?: string; time?: number };
      if (!event.id) return;
      const seen = Number(localStorage.getItem(SEEN_ANNOUNCEMENT_KEY) || '0');
      if (event.id <= seen) return;
      localStorage.setItem(SEEN_ANNOUNCEMENT_KEY, String(event.id));
      push({
        kind: 'announcement',
        title: event.title || '系统公告',
        content: event.content || '',
        time: event.time || Date.now(),
      });
    });
    return () => {
      offMessage();
      offNotification();
      offAnnouncement();
    };
  }, []);

  // 首次登录/挂载时拉最新一条本地公告：比已见 ID 新就补推一次（离线错过的公告），
  // 同一条只推一次；没有更新则静默。
  useEffect(() => {
    let cancelled = false;
    void getLatestAnnouncement()
      .then(res => {
        if (cancelled || !res.data) return;
        const seenId = Number(localStorage.getItem(SEEN_ANNOUNCEMENT_KEY) || '0');
        if (res.data.id <= seenId) return;
        localStorage.setItem(SEEN_ANNOUNCEMENT_KEY, String(res.data.id));
        setItems(current => [
          {
            id: `announcement-${res.data!.id}`,
            kind: 'announcement' as const,
            title: `公告：${res.data.title}`,
            content: res.data.content,
            time: Date.parse(`${res.data.published_at.replace(' ', 'T')}+08:00`) || Date.now(),
            read: false,
          },
          ...current,
        ].slice(0, MAX_ITEMS));
      })
      .catch(() => {
        // 拉取失败静默（未登录/网络异常），下次挂载再试
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const unread = items.filter(item => !item.read).length;
  // 已读即移除：列表只保留未处理的通知，全部已读 = 清空
  const markAllRead = () => setItems([]);
  const dismissItem = (id: string) => setItems(current => current.filter(item => item.id !== id));
  // 买家消息类通知：点击跳转消息中心并移除本条；系统通知/公告点击仅移除
  const handleItemClick = (item: BellItem) => {
    if (item.kind === 'message') onOpenMessage?.();
    dismissItem(item.id);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        className="relative flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-soft)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
        title="通知（新消息与系统通知）"
        aria-label={`通知${unread ? `（${unread} 条未读）` : ''}`}
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--unread-badge)] px-1 text-[10px] font-black text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="header-popover dropdown-pop-in absolute right-0 top-full z-30 mt-2 w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-soft)]">
              通知{unread > 0 ? ` · ${unread} 条未读` : ''}
            </p>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="flex items-center gap-1 text-[11px] font-bold text-[var(--brand-text)] hover:underline"
              >
                <CheckCheck className="h-3 w-3" />
                全部已读
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && (
              <p className="px-3 py-8 text-center text-xs text-[var(--text-soft)]">
                暂无通知，新消息与系统通知会实时出现在这里
              </p>
            )}
            {items.map(item => (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => handleItemClick(item)}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleItemClick(item);
                  }
                }}
                title={item.kind === 'message' ? '点击前往消息中心' : '点击移除该通知'}
                className="group flex cursor-pointer items-start gap-2.5 border-b border-[var(--border)] px-3 py-2.5 transition-colors last:border-b-0 hover:bg-[var(--surface-hover)]"
              >
                <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                  item.kind === 'message'
                    ? 'bg-[var(--brand-soft)] text-[var(--brand-text)]'
                    : item.kind === 'announcement'
                      ? 'bg-[var(--unread-badge)]/15 text-[var(--unread-badge)]'
                      : 'bg-[var(--surface-strong)] text-[var(--text-muted)]'
                }`}>
                  {item.kind === 'message'
                    ? <MessageSquareText className="h-3.5 w-3.5" />
                    : <Megaphone className="h-3.5 w-3.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[13px] font-bold text-[var(--text)]">{item.title}</span>
                    <span className="shrink-0 text-[10px] text-[var(--text-soft)]">{formatTime(item.time)}</span>
                  </span>
                  {item.content && (
                    <span className="mt-0.5 block line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">
                      {item.content}
                    </span>
                  )}
                </span>
                <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-soft)] opacity-0 transition-opacity group-hover:opacity-60" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
