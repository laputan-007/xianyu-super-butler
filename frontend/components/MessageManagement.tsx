import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BellRing,
  Image,
  Inbox,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  Smile,
  Zap,
  Trash2,
  UserRound,
} from 'lucide-react';

import {
  AccountDetail,
  ChatAccount,
  ChatConversation,
  ChatMessage,
  Item,
  MessageFilter,
  MessageFilterType,
  QuickPhrase,
} from '../types';
import { renderRichText } from '../lib/emojiMap';
import {
  batchCreateMessageFilters,
  batchDeleteMessageFilters,
  deleteMessageFilter,
  getAccountDetails,
  getChatAccounts,
  getChatConversations,
  getChatMessages,
  getItems,
  getMessageFilters,
  getQuickPhrases,
  sendChatImage,
  sendChatMessage,
  uploadImage,
  useQuickPhrase,
  toggleMessageFilter,
} from '../services/api';
import { confirmAction, notify } from '../services/feedback';
import { connectRealtimeEvents, ChatMessageEvent } from '../services/events';
import { EmptyState, SectionHeader } from './ui';

type View = 'messages' | 'filters';
type MobilePane = 'list' | 'chat';

// 轮询间隔。会话列表与消息都要经 WebSocket 透传到闲鱼，频率过高会把账号
// 打到限流（429 flow controled）。消息轮询用自适应：会话活跃（近 45 秒
// 有发送/切换/收到新消息）时 3 秒一轮保证即时性，空闲后退回 10 秒。
const CONVERSATION_POLL_MS = 10000;
const MESSAGE_FAST_POLL_MS = 3000;
const MESSAGE_IDLE_POLL_MS = 10000;
const ACTIVITY_WINDOW_MS = 45000;
// 本地乐观消息的保留窗口：服务端历史回显通常在一两秒内跟上，超过 30 秒
// 仍没对上就视为发送异常，直接交给服务端列表
const LOCAL_MESSAGE_TTL_S = 30;
// 回显模糊匹配窗口（毫秒）：放宽到 90 秒以吸收客户端与服务端的时钟偏差。
// 命中还需同向同内容，窗口偏大最坏只是误吞一条重发的相同文本，有 TTL 兜底
const ECHO_MATCH_WINDOW_MS = 90_000;
// SSE 在线时的对账轮询间隔：消息由推送即时上屏，轮询只负责权威纠正。
// 每次轮询都会经账号 WebSocket 透传到闲鱼，放慢直接降低 429 限流风险
const SSE_MESSAGE_RECONCILE_MS = 30_000;
const SSE_CONVERSATION_POLL_MS = 60_000;
// 推送内容是摘要级，占位符上屏没有意义，交给随后的历史刷新渲染真身
const PUSH_PLACEHOLDERS = new Set([
  '[图片]', '[语音]', '[视频]', '[卡片消息]', '[链接]', '[位置]', '[系统消息]',
]);
// 表情面板：常用表情 + 生意场景高频符号
const EMOJI_CHOICES = [
  '😀', '😄', '😊', '🥰', '😘', '😜', '🤗', '😎',
  '🙏', '👍', '👌', '💪', '🤝', '✅', '❤️', '🎉',
  '💰', '🧧', '📦', '🚚', '⭐', '🔥', '😢', '😅',
];
const READ_WATERMARKS_STORAGE_KEY = 'xianyu-message-read-watermarks-v2';
const MAX_READ_WATERMARKS = 500;

type ReadWatermark = {
  lastMessageTime: number;
  lastMessageSummary: string;
  unreadCount: number;
};

type ReadWatermarks = Record<string, ReadWatermark>;

const readWatermarkKey = (accountId: string, cid: string) => `${accountId}\u0000${cid}`;

const loadReadWatermarks = (): ReadWatermarks => {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(READ_WATERMARKS_STORAGE_KEY) || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
        const watermark = value as Partial<ReadWatermark>;
        return Number.isFinite(watermark.lastMessageTime)
          && typeof watermark.lastMessageSummary === 'string'
          && Number.isFinite(watermark.unreadCount);
      })
    ) as ReadWatermarks;
  } catch {
    return {};
  }
};

const saveReadWatermarks = (watermarks: ReadWatermarks) => {
  if (typeof window === 'undefined') return;
  try {
    const recentEntries = Object.entries(watermarks)
      .sort(([, left], [, right]) => right.lastMessageTime - left.lastMessageTime)
      .slice(0, MAX_READ_WATERMARKS);
    window.localStorage.setItem(
      READ_WATERMARKS_STORAGE_KEY,
      JSON.stringify(Object.fromEntries(recentEntries))
    );
  } catch {
    // 隐私模式或存储空间不足时，仍保留当前页面内的已读状态。
  }
};

const isCoveredByReadWatermark = (
  watermark: ReadWatermark | undefined,
  conversation: ChatConversation
) => {
  if (!watermark) return false;
  const lastMessageTime = Number(conversation.lastMessageTime) || 0;
  const lastMessageSummary = String(conversation.lastMessageSummary || '');
  const unreadCount = Number(conversation.unreadCount) || 0;
  return lastMessageTime < watermark.lastMessageTime
    || (
      lastMessageTime === watermark.lastMessageTime
      && lastMessageSummary === watermark.lastMessageSummary
      && unreadCount <= watermark.unreadCount
    );
};

interface MessageManagementProps {
  isActive?: boolean;
  /** 顶栏「管理的账号」选中值：切换后会话列表的账号筛选跟随 */
  syncedAccountId?: string;
  /** 本页手动切换会话账号时回写全局（与顶栏双向联动） */
  onSyncedAccountChange?: (id: string) => void;
}

const normalizeImageUrl = (value?: string) => {
  if (!value) return '';
  return value.startsWith('//') ? `https:${value}` : value;
};

const formatTimestamp = (value?: number) => {
  if (!value) return '';
  const timestamp = value < 1_000_000_000_000 ? value * 1000 : value;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
};

// 服务端消息时间存在秒/毫秒两种口径，合并与排序前统一归一成毫秒；
// 本地乐观消息直接用 Date.now()，去重比较才有共同语言
const toMs = (value?: number) => {
  const raw = Number(value) || 0;
  return raw > 0 && raw < 1_000_000_000_000 ? raw * 1000 : raw;
};

// 本地乐观消息（local-）与 SSE 推送消息（push-）都是临时占位：历史接口
// 的权威记录一到就让位。两者共用同一套合并/去重/过期规则
const isEphemeralMessage = (message: ChatMessage) =>
  message.messageId.startsWith('local-') || message.messageId.startsWith('push-');

// 把未回显的本地消息插回服务端列表。锚点（发送时刻会话里最后一条服务端
// 消息）命中的，插在锚点之后——买家在回显窗口内的后续回复就排在它下面；
// 锚点丢失（超出拉取窗口）或发送时还没有历史的，退化为按时间插入。
// 全程不重排服务端列表：服务端顺序是权威，createAt 缺失（归一为 0）的
// 系统消息按时间排会被顶到最顶上
const mergeLocalMessages = (
  serverMessages: ChatMessage[],
  localMessages: ChatMessage[]
): ChatMessage[] => {
  const buckets = new Map<string, ChatMessage[]>();
  const unanchored: ChatMessage[] = [];
  for (const local of localMessages) {
    const anchorId = local.anchorId || '';
    const anchored = Boolean(anchorId)
      && serverMessages.some((server) => server.messageId === anchorId);
    if (!anchored) {
      unanchored.push(local);
      continue;
    }
    const bucket = buckets.get(anchorId);
    if (bucket) bucket.push(local);
    else buckets.set(anchorId, [local]);
  }
  const merged: ChatMessage[] = [];
  for (const server of serverMessages) {
    merged.push(server);
    for (const local of buckets.get(server.messageId) || []) merged.push(local);
  }
  for (const local of unanchored) {
    // 插到「最后一条时间不晚于本地消息」的元素之后（含已放置的本地消息，
    // 它们按创建顺序处理、时间递增，这样才能接在其后而不是插到其前面）；
    // 所有服务端消息都更新则排最前
    let insertAt = 0;
    for (let index = 0; index < merged.length; index += 1) {
      if ((merged[index].time || 0) <= (local.time || 0)) insertAt = index + 1;
    }
    merged.splice(insertAt, 0, local);
  }
  return merged;
};

const formatDateTime = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
};

const accountName = (account?: ChatAccount) =>
  account?.displayName || account?.accountId || '未选择账号';

// 买家占位头像的色板：与站点主题协调。按用户 ID 哈希取色，
// 同一买家在会话列表和聊天气泡里、每次刷新都是同一颜色。
const AVATAR_PALETTE = [
  '#8c7900', '#0f704b', '#2a5f92', '#945800',
  '#6b5a8a', '#b45309', '#3f7a5c', '#7c4d5e',
];

const avatarColorFor = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
};

const filterTypeLabel: Record<MessageFilterType, string> = {
  skip_reply: '跳过自动回复',
  skip_notify: '跳过外部通知',
};

const MessageManagement: React.FC<MessageManagementProps> = ({ isActive = true, syncedAccountId, onSyncedAccountChange }) => {
  const [view, setView] = useState<View>('messages');
  const [mobilePane, setMobilePane] = useState<MobilePane>('list');
  const [accounts, setAccounts] = useState<ChatAccount[]>([]);
  const [accountDetails, setAccountDetails] = useState<AccountDetail[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [activeAccountId, setActiveAccountId] = useState('');
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  // SSE 实时推送在线状态：在线时消息靠推送上屏，轮询降频为对账模式
  const [sseOnline, setSseOnline] = useState(false);
  // 按图片地址记录加载失败的头像，避免反复请求同一个取不到的外部地址
  const [failedAvatars, setFailedAvatars] = useState<Set<string>>(new Set());
  const [activeCid, setActiveCid] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [query, setQuery] = useState('');
  const [searchInputUnlocked, setSearchInputUnlocked] = useState(false);
  const [searchInputName] = useState(
    () => `conversation-filter-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [draft, setDraft] = useState('');
  // 快捷短语：人工客服常用话术
  const [quickPhrases, setQuickPhrases] = useState<QuickPhrase[]>([]);
  const [showPhrases, setShowPhrases] = useState(false);
  // 表情面板与图片发送
  const [showEmoji, setShowEmoji] = useState(false);
  // 表情面板：在线图片直发（表情包/网络图 URL，不经本地上传）
  const [emojiImageUrl, setEmojiImageUrl] = useState('');

  const sendOnlineImage = async () => {
    const url = emojiImageUrl.trim();
    if (!url || !activeConversation || !activeAccountId || imageSending) return;
    if (!/^https?:\/\//.test(url)) {
      notify('请输入以 http(s) 开头的图片地址', 'warning');
      return;
    }
    setImageSending(true);
    try {
      const conversation = activeConversation;
      await sendChatImage(activeAccountId, {
        cid: conversation.cid,
        to_user_id: conversation.otherUserId,
        image_url: url,
      });
      lastActivityRef.current = Date.now();
      // 乐观上屏：与本地选图发送同款占位，随后服务端历史接管
      setMessages((current) => {
        if (activeCidRef.current !== conversation.cid) return current;
        return [...current, {
          messageId: `local-img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          anchorId: '',
          senderId: activeAccountId,
          senderName: '我',
          isSelf: true,
          type: 'image' as const,
          text: '',
          images: [url],
          time: Date.now(),
        }];
      });
      setEmojiImageUrl('');
      notify('图片已发送', 'success');
      window.setTimeout(() => {
        void loadMessages(true);
        void loadConversations(true);
      }, 1500);
    } catch (error) {
      notify(`图片发送失败：${(error as Error).message}`, 'error');
    } finally {
      setImageSending(false);
    }
  };
  const [imageSending, setImageSending] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  // 消息轮询的活跃标记：发送/切换会话/收到新消息都会刷新它
  const lastActivityRef = useRef(Date.now());
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // 聊天滚动容器与尾部跟踪：轮询每轮都会替换消息数组引用，若照搬旧逻辑
  // 无差别 scrollIntoView，正在往上翻历史的用户会每 3 秒被拽回底部
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const lastTailIdRef = useRef('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchInputTouchedRef = useRef(false);
  const activeCidRef = useRef('');
  const readWatermarksRef = useRef<ReadWatermarks>(loadReadWatermarks());
  // SSE 事件回调在连接建立时闭包固化，事件到来时要读「最新值」只能走引用
  const activeAccountIdRef = useRef('');
  const conversationsRef = useRef<ChatConversation[]>([]);
  const loadMessagesRef = useRef<((silent?: boolean) => Promise<void>) | null>(null);
  const loadConversationsRef = useRef<((silent?: boolean) => Promise<void>) | null>(null);
  const pushRefreshTimerRef = useRef(0);

  const [filters, setFilters] = useState<MessageFilter[]>([]);
  const [filtersLoading, setFiltersLoading] = useState(true);
  const [filterAccount, setFilterAccount] = useState('');
  const [filterType, setFilterType] = useState<MessageFilterType | ''>('');
  const [newAccount, setNewAccount] = useState('');
  const [newType, setNewType] = useState<MessageFilterType>('skip_reply');
  const [newKeywords, setNewKeywords] = useState('');
  const [selectedFilterIds, setSelectedFilterIds] = useState<number[]>([]);
  const [savingFilters, setSavingFilters] = useState(false);

  // 顶栏切换「管理的账号」后，会话查看账号与过滤规则的账号筛选一起跟随
  useEffect(() => {
    if (!syncedAccountId) return;
    setActiveAccountId((current) => (current === syncedAccountId ? current : syncedAccountId));
    setFilterAccount((current) => (current === syncedAccountId ? current : syncedAccountId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncedAccountId]);

  const activeAccount = accounts.find((account) => account.accountId === activeAccountId);
  const activeConversation = conversations.find((conversation) => conversation.cid === activeCid);

  const itemMap = useMemo(
    () => new Map(items.map((item) => [`${item.cookie_id}:${item.item_id}`, item])),
    [items]
  );

  const activeItem = activeConversation?.itemId
    ? itemMap.get(`${activeAccountId}:${activeConversation.itemId}`)
    : undefined;

  const visibleConversations = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return conversations;
    return conversations.filter((conversation) =>
      [
        conversation.otherUserName,
        conversation.otherUserId,
        conversation.itemTitle,
        conversation.itemId,
        conversation.lastMessageSummary,
      ].some((value) => String(value || '').toLocaleLowerCase().includes(normalized))
    );
  }, [conversations, query]);

  const selectedAllFilters = filters.length > 0
    && filters.every((filter) => selectedFilterIds.includes(filter.id));

  const rememberConversationRead = (conversation: ChatConversation) => {
    if (!activeAccountIdRef.current || !conversation.cid) return;
    const key = readWatermarkKey(activeAccountIdRef.current, conversation.cid);
    const nextWatermark: ReadWatermark = {
      lastMessageTime: Number(conversation.lastMessageTime) || 0,
      lastMessageSummary: String(conversation.lastMessageSummary || ''),
      unreadCount: Number(conversation.unreadCount) || 0,
    };
    const previous = readWatermarksRef.current[key];
    if (
      previous
      && (
        previous.lastMessageTime > nextWatermark.lastMessageTime
        || (
          previous.lastMessageTime === nextWatermark.lastMessageTime
          && previous.lastMessageSummary === nextWatermark.lastMessageSummary
          && previous.unreadCount >= nextWatermark.unreadCount
        )
      )
    ) {
      return;
    }
    readWatermarksRef.current[key] = nextWatermark;
    saveReadWatermarks(readWatermarksRef.current);
  };

  const openConversation = (conversation: ChatConversation) => {
    rememberConversationRead(conversation);
    activeCidRef.current = conversation.cid;
    // 切换即清空旧会话消息：乐观合并以当前列表为基准，带着 A 会话的本地
    // 消息去合并 B 会话会把消息串进错误的聊天里
    setMessages([]);
    setMessagesLoading(true);
    setConversations((current) => current.map((item) => (
      item.cid === conversation.cid ? { ...item, unreadCount: 0 } : item
    )));
    setActiveCid(conversation.cid);
    setMobilePane('chat');
  };

  const loadAccounts = async () => {
    setAccountsLoading(true);
    try {
      const data = await getChatAccounts();
      setAccounts(data);
      setActiveAccountId((current) => {
        if (current && data.some((account) => account.accountId === current)) return current;
        // 顶栏已有选中账号时优先跟随
        if (syncedAccountId && data.some((account) => account.accountId === syncedAccountId)) {
          return syncedAccountId;
        }
        return data.find((account) => account.connected)?.accountId || data[0]?.accountId || '';
      });
    } catch (error) {
      notify(`加载消息账号失败：${(error as Error).message}`, 'error');
    } finally {
      setAccountsLoading(false);
    }
  };

  const loadConversations = async (silent = false) => {
    if (!activeAccountId) {
      setConversations([]);
      return;
    }
    if (!silent) setConversationsLoading(true);
    try {
      const result = await getChatConversations(activeAccountId);
      const incoming = result.conversations || [];
      const currentCid = activeCidRef.current;
      const nextCid = incoming.some((conversation) => conversation.cid === currentCid)
        ? currentCid
        : incoming[0]?.cid || '';
      const normalized = incoming.map((conversation) => {
        const isOpen = isActive
          && conversation.cid === nextCid
          && (
            mobilePane === 'chat'
            || window.matchMedia('(min-width: 1024px)').matches
          );
        const watermark = readWatermarksRef.current[
          readWatermarkKey(activeAccountId, conversation.cid)
        ];
        if (isOpen) rememberConversationRead(conversation);
        return isOpen || isCoveredByReadWatermark(watermark, conversation)
          ? { ...conversation, unreadCount: 0 }
          : conversation;
      });
      setConversations(normalized);
      setActiveCid((current) => {
        // 用户已经选了会话就不要动它。会话列表是定时刷新的，一旦某次刷新
        // 因限流或数据不全而没带上当前会话，这里就会把用户强行切回第一条 ——
        // 表现为「点第二个及之后的对话，消息区一片空白」。
        const next = current && incoming.some((conversation) => conversation.cid === current)
          ? current
          : incoming[0]?.cid || '';
        activeCidRef.current = next;
        return next;
      });
    } catch (error) {
      if (!silent) notify(`加载会话失败：${(error as Error).message}`, 'error');
    } finally {
      if (!silent) setConversationsLoading(false);
    }
  };

  const loadMessages = async (silent = false) => {
    if (!activeAccountId || !activeCid) {
      setMessages([]);
      return;
    }
    // 记住本次请求针对的会话：响应回来时会话可能已被切换，过期数据要丢弃
    const requestCid = activeCid;
    if (activeCidRef.current !== requestCid) return;
    if (!silent) setMessagesLoading(true);
    try {
      const result = await getChatMessages(activeAccountId, requestCid);
      if (activeCidRef.current !== requestCid) return;
      const serverMessages = ((result.messages || []) as ChatMessage[]).map((message) => ({
        ...message,
        time: toMs(message.time),
      }));
      // 收到新消息（列表尾部有变化）时刷新活跃标记，让轮询保持快档
      setMessages((current) => {
        // 竞态防御：请求期间用户切换了会话，不能把旧会话数据写进当前视图
        if (activeCidRef.current !== requestCid) return current;
        const serverLast = serverMessages[serverMessages.length - 1];
        const currentLast = current[current.length - 1];
        if (serverLast && currentLast && serverLast.messageId !== currentLast.messageId) {
          lastActivityRef.current = Date.now();
        }
        // 合并本地乐观消息：服务端历史回显有延迟，短时间内保留本地已发的
        // 文本/图片，待服务端出现对应记录（权威 ID 或同向同内容且时间接近）
        // 后让位。按锚点插回原位而不是拼在尾部——否则回显窗口内买家的
        // 新回复会渲染在「自己刚发的消息」上方，表现为顺序错乱
        const nowMs = Date.now();
        const localPending = current.filter((message) => {
          if (!isEphemeralMessage(message)) return false;
          if (nowMs - (message.time || 0) > LOCAL_MESSAGE_TTL_S * 1000) return false;
          const duplicated = serverMessages.some((server) => {
            if (message.serverMessageId && server.messageId === message.serverMessageId) return true;
            if (server.isSelf !== message.isSelf) return false;
            if (Math.abs((server.time || 0) - (message.time || 0)) >= ECHO_MATCH_WINDOW_MS) return false;
            return message.type === 'image' ? server.type === 'image' : server.text === message.text;
          });
          return !duplicated;
        });
        if (localPending.length === 0) return serverMessages;
        return mergeLocalMessages(serverMessages, localPending);
      });
    } catch (error) {
      if (!silent) notify(`加载聊天记录失败：${(error as Error).message}`, 'error');
    } finally {
      if (!silent) setMessagesLoading(false);
    }
  };

  const loadFilters = async () => {
    setFiltersLoading(true);
    try {
      const data = await getMessageFilters({
        cookie_id: filterAccount || undefined,
        filter_type: filterType || undefined,
      });
      setFilters(data);
      setSelectedFilterIds((current) =>
        current.filter((id) => data.some((filter) => filter.id === id))
      );
    } catch (error) {
      notify(`加载过滤规则失败：${(error as Error).message}`, 'error');
    } finally {
      setFiltersLoading(false);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      const detailsRequest = getAccountDetails()
        .then((data) => {
          setAccountDetails(data);
          setNewAccount(data[0]?.id || '');
        })
        .catch((error) => notify(`加载账号资料失败：${(error as Error).message}`, 'error'));
      const itemsRequest = getItems()
        .then(setItems)
        .catch((error) => notify(`加载商品资料失败：${(error as Error).message}`, 'error'));
      await Promise.all([loadAccounts(), detailsRequest, itemsRequest, loadFilters()]);
    };
    void initialize();
  }, []);

  useEffect(() => {
    activeCidRef.current = '';
    setActiveCid('');
    setMessages([]);
    setMobilePane('list');
    if (isActive) void loadConversations();
  }, [isActive, activeAccountId]);

  useEffect(() => {
    // 会话/账号切换（含会话列表刷新导致的自动回退）：旧消息连同未回显的
    // 本地乐观消息一并清空，防止跨会话串消息
    setMessages([]);
    if (isActive) {
      setMessagesLoading(true);
      void loadMessages();
    }
  }, [isActive, activeAccountId, activeCid]);

  useEffect(() => {
    if (!isActive || view !== 'messages' || !activeAccountId) return undefined;
    void loadConversations(true);
    // SSE 在线时消息靠推送即时上屏，会话列表只需 60 秒慢速对账；掉线回到
    // 10 秒。原来 3 秒刷一次，每条请求都要经 WebSocket 转发到闲鱼，多开
    // 几个标签页就会把账号打到 429（flow controled），表现为消息加载失败。
    const interval = sseOnline ? SSE_CONVERSATION_POLL_MS : CONVERSATION_POLL_MS;
    const timer = window.setInterval(() => void loadConversations(true), interval);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, view, activeAccountId, mobilePane, sseOnline]);

  useEffect(() => {
    if (!isActive || view !== 'messages' || !activeAccountId || !activeCid) return undefined;
    // 会话切换即视为活跃，先快轮询
    lastActivityRef.current = Date.now();
    // 自适应轮询：SSE 在线时推送负责即时性，轮询退化为 30 秒权威对账；
    // 掉线回到「活跃（近 45 秒有发送/切换/新消息）3 秒、空闲 10 秒」。
    // 用自排程 setTimeout 而不是固定 interval，每轮按最新状态定间隔。
    let timer = 0;
    const tick = () => {
      void loadMessages(true);
      let delay: number;
      if (sseOnline) {
        delay = SSE_MESSAGE_RECONCILE_MS;
      } else {
        const fast = Date.now() - lastActivityRef.current < ACTIVITY_WINDOW_MS;
        delay = fast ? MESSAGE_FAST_POLL_MS : MESSAGE_IDLE_POLL_MS;
      }
      timer = window.setTimeout(tick, delay);
    };
    timer = window.setTimeout(tick, sseOnline ? SSE_MESSAGE_RECONCILE_MS : MESSAGE_FAST_POLL_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, view, activeAccountId, activeCid, sseOnline]);

  // 各类「最新值」引用：SSE 回调在连接建立时闭包固化，事件到来时要从
  // 引用读当前账号/会话/函数，而不是过期的闭包值
  useEffect(() => {
    activeAccountIdRef.current = activeAccountId;
    conversationsRef.current = conversations;
    loadMessagesRef.current = loadMessages;
    loadConversationsRef.current = loadConversations;
  });

  const schedulePushRefresh = () => {
    // 推送即时上屏后防抖拉一次权威历史：补图片真身、修正顺序与未读数
    window.clearTimeout(pushRefreshTimerRef.current);
    pushRefreshTimerRef.current = window.setTimeout(() => {
      void loadMessagesRef.current?.(true);
    }, 1500);
  };

  const handleChatMessageEvent = (event: ChatMessageEvent) => {
    if (event.cookie_id !== activeAccountIdRef.current) return;
    const conversationsNow = conversationsRef.current;
    const index = conversationsNow.findIndex((row) => row.cid === event.chat_id);
    if (index === -1) {
      // 新会话还没在列表里（买家首次来信），拉一次列表补上
      void loadConversationsRef.current?.(true);
      return;
    }
    const conversation = conversationsNow[index];
    const updated: ChatConversation = {
      ...conversation,
      lastMessageSummary: event.content || conversation.lastMessageSummary,
      lastMessageTime: event.time,
      unreadCount: event.is_self || event.chat_id === activeCidRef.current
        ? conversation.unreadCount
        : conversation.unreadCount + 1,
    };
    setConversations((current) => {
      const at = current.findIndex((row) => row.cid === event.chat_id);
      if (at === -1) return current;
      const next = [...current];
      const merged = { ...current[at], ...updated };
      next.splice(at, 1);
      next.unshift(merged);
      return next;
    });
    // 引用手动同步：连续多条事件到达时（重放/快速对话）不等重渲染也能读到
    // 最新行，否则每条都会把上一条刚更新的摘要盖回去
    conversationsRef.current = [
      updated,
      ...conversationsNow.slice(0, index),
      ...conversationsNow.slice(index + 1),
    ];
    // 当前打开的会话：文本即时上屏（与本地乐观/已推送的孪生去重），随后
    // 防抖拉权威历史；占位符内容不上屏，等历史刷新渲染真身
    if (event.chat_id !== activeCidRef.current) return;
    lastActivityRef.current = Date.now();
    rememberConversationRead(updated);
    if (!PUSH_PLACEHOLDERS.has(event.content)) {
      setMessages((current) => {
        if (activeCidRef.current !== event.chat_id) return current;
        const twin = current.some((message) =>
          isEphemeralMessage(message)
          && message.isSelf === event.is_self
          && message.text === event.content
          && Math.abs((message.time || 0) - (event.time || 0)) < ECHO_MATCH_WINDOW_MS
        );
        if (twin) return current;
        return [...current, {
          messageId: `push-${event.time}-${Math.random().toString(36).slice(2, 6)}`,
          senderId: event.is_self ? event.cookie_id : event.sender_user_id,
          senderName: event.is_self ? '我' : (event.sender_nick || ''),
          isSelf: event.is_self,
          type: 'text' as const,
          text: event.content,
          images: [],
          time: toMs(event.time),
        }];
      });
    }
    schedulePushRefresh();
  };

  // SSE 连接生命周期：随页面激活/离开建断；断线重连由 events.ts 内部按
  // 退避梯度管理，这里只负责在（重）连成功后立即对账一次，补齐断线窗口
  // 错过的消息
  useEffect(() => {
    if (!isActive || view !== 'messages') return undefined;
    const disconnect = connectRealtimeEvents(handleChatMessageEvent, (connected) => {
      setSseOnline(connected);
      if (connected) {
        void loadConversationsRef.current?.(true);
        void loadMessagesRef.current?.(true);
      }
    });
    return () => {
      disconnect();
      setSseOnline(false);
      window.clearTimeout(pushRefreshTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, view]);

  useEffect(() => {
    const tail = messages[messages.length - 1];
    if (!tail) return;
    // 只在尾部真的变了（新消息/切换会话/自己的乐观消息）才考虑滚动，
    // 纯轮询刷新（内容没变）不打扰用户
    if (tail.messageId === lastTailIdRef.current) return;
    lastTailIdRef.current = tail.messageId;
    // 自己刚发出的消息无条件滚到底；收到的消息只在用户本就贴近底部时跟随
    if (tail.isSelf) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    const container = messagesScrollRef.current;
    const nearBottom = !container
      || container.scrollHeight - container.scrollTop - container.clientHeight < 160;
    if (nearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    // Chromium 和部分密码管理器会无视 autocomplete="off"，把本站保存的
    // 管理员用户名灌进页面上的第一个文本框。只清理用户尚未触碰过的值，
    // 避免定时器误删用户真正输入的搜索词。
    const clearUnexpectedAutofill = () => {
      if (searchInputTouchedRef.current || !searchInputRef.current) return;
      searchInputRef.current.value = '';
      setQuery('');
    };
    clearUnexpectedAutofill();
    const timers = [100, 500, 1500].map((delay) => (
      window.setTimeout(clearUnexpectedAutofill, delay)
    ));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  useEffect(() => {
    getQuickPhrases()
      .then(setQuickPhrases)
      .catch(() => setQuickPhrases([]));
  }, []);

  // 插入短语到输入框而不是直接发送，方便先改再发
  const insertPhrase = (phrase: QuickPhrase) => {
    setDraft(current => (current ? `${current}${phrase.content}` : phrase.content));
    setShowPhrases(false);
    void useQuickPhrase(phrase.id).catch(() => undefined);
  };

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || !activeConversation || !activeAccountId || sending) return;
    const conversation = activeConversation;
    setSending(true);
    try {
      const result = await sendChatMessage(activeAccountId, {
        cid: conversation.cid,
        to_user_id: conversation.otherUserId,
        text,
      });
      setDraft('');
      lastActivityRef.current = Date.now();
      // 乐观追加：立即上屏不等服务端历史（历史回显有延迟，原来要等下一轮
      // 10 秒轮询才能看见自己发的消息）。记录锚点（当前最后一条服务端消息）
      // 和发送接口返回的权威 messageId，loadMessages 合并时按锚点把这条
      // 插回正确位置、按权威 ID 精确去重。ID 一律带 local- 前缀——曾经直接
      // 采用服务端 ID，导致合并把它当服务端消息提前丢掉，消息闪没再闪回
      setMessages((current) => {
        if (activeCidRef.current !== conversation.cid) return current;
        const anchorId = [...current].reverse().find(
          (message) => !isEphemeralMessage(message)
        )?.messageId || '';
        return [...current, {
          messageId: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          serverMessageId: result.data?.messageId || '',
          anchorId,
          senderId: activeAccountId,
          senderName: '我',
          isSelf: true,
          type: 'text' as const,
          text,
          images: [],
          time: Date.now(),
        }];
      });
      notify('消息已发送', 'success');
      // 稍等服务端历史跟上后回填权威列表（会话摘要/排序一并刷新）
      window.setTimeout(() => {
        void loadMessages(true);
        void loadConversations(true);
      }, 1500);
    } catch (error) {
      notify(`发送失败：${(error as Error).message}`, 'error');
    } finally {
      setSending(false);
    }
  };

  const insertEmoji = (emoji: string) => {
    setDraft((current) => current + emoji);
    setShowEmoji(false);
  };

  const handleImagePick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // 允许连续选择同一张图：选完即清空 value
    event.target.value = '';
    if (!file || !activeConversation || !activeAccountId || imageSending) return;
    if (!file.type.startsWith('image/')) {
      notify('请选择图片文件', 'warning');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notify('图片不能超过 5MB', 'warning');
      return;
    }
    setImageSending(true);
    try {
      const conversation = activeConversation;
      const uploaded = await uploadImage(file);
      const imageUrl = uploaded.image_url;
      if (!imageUrl) throw new Error(uploaded.message || '图片上传失败');
      await sendChatImage(activeAccountId, {
        cid: conversation.cid,
        to_user_id: conversation.otherUserId,
        image_url: imageUrl,
      });
      lastActivityRef.current = Date.now();
      // 乐观追加：本地路径先上屏（买家收到的是 CDN 地址），锚点定位与
      // 文本消息一致，随后由服务端历史接管
      setMessages((current) => {
        if (activeCidRef.current !== conversation.cid) return current;
        const anchorId = [...current].reverse().find(
          (message) => !isEphemeralMessage(message)
        )?.messageId || '';
        return [...current, {
          messageId: `local-img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          anchorId,
          senderId: activeAccountId,
          senderName: '我',
          isSelf: true,
          type: 'image' as const,
          text: '',
          images: [imageUrl],
          time: Date.now(),
        }];
      });
      notify('图片已发送', 'success');
      window.setTimeout(() => {
        void loadMessages(true);
        void loadConversations(true);
      }, 1500);
    } catch (error) {
      notify(`图片发送失败：${(error as Error).message}`, 'error');
    } finally {
      setImageSending(false);
    }
  };

  const createFilters = async () => {
    const keywords = newKeywords.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    if (!newAccount || keywords.length === 0) {
      notify('请选择账号并填写至少一个关键词', 'warning');
      return;
    }
    setSavingFilters(true);
    try {
      const result = await batchCreateMessageFilters({
        cookie_id: newAccount,
        filter_type: newType,
        keywords,
      });
      setNewKeywords('');
      await loadFilters();
      notify(`新增 ${result.created} 条，跳过重复 ${result.skipped} 条`, 'success');
    } catch (error) {
      notify(`新增规则失败：${(error as Error).message}`, 'error');
    } finally {
      setSavingFilters(false);
    }
  };

  const removeFilter = async (filter: MessageFilter) => {
    if (!await confirmAction(`删除过滤关键词“${filter.keyword}”？`)) return;
    try {
      await deleteMessageFilter(filter.id);
      await loadFilters();
      notify('规则已删除', 'success');
    } catch (error) {
      notify(`删除失败：${(error as Error).message}`, 'error');
    }
  };

  const removeSelectedFilters = async () => {
    if (
      selectedFilterIds.length === 0
      || !await confirmAction(`删除选中的 ${selectedFilterIds.length} 条规则？`)
    ) return;
    try {
      await batchDeleteMessageFilters(selectedFilterIds);
      setSelectedFilterIds([]);
      await loadFilters();
      notify('所选规则已删除', 'success');
    } catch (error) {
      notify(`批量删除失败：${(error as Error).message}`, 'error');
    }
  };

  const renderAvatar = (url: string | undefined, label: string, className: string, seed?: string) => {
    const normalized = normalizeImageUrl(url);
    const placeholder = (
      <div
        className={`${className} flex items-center justify-center text-sm font-bold text-white`}
        style={{ backgroundColor: avatarColorFor(String(seed || label || '').trim()) }}
      >
        {label.trim().slice(0, 1) || <UserRound className="h-4 w-4" />}
      </div>
    );
    // 平台真给了头像（alicdn）就直连；加载失败时回落到本地彩色首字母，
    // 不再依赖 DiceBear 之类的外部生成服务——国内连不通只会得到一片灰块。
    return normalized && !failedAvatars.has(normalized) ? (
      <img
        src={normalized}
        alt=""
        className={`${className} object-cover`}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailedAvatars((previous) => new Set(previous).add(normalized))}
      />
    ) : (
      placeholder
    );
  };

  const renderMessages = () => (
    <div className="grid h-full min-h-0 overflow-hidden bg-[var(--surface)] lg:grid-cols-[356px_minmax(0,1fr)]">
      <aside className={`${mobilePane === 'chat' ? 'hidden lg:flex' : 'flex'} min-h-0 flex-col border-b border-[var(--border)] lg:border-b-0 lg:border-r`}>
        <div className="flex h-[68px] shrink-0 items-center gap-3 border-b border-[var(--border)] px-4">
          <select
            value={activeAccountId}
            onChange={(event) => { setActiveAccountId(event.target.value); if (event.target.value) onSyncedAccountChange?.(event.target.value); }}
            aria-label="消息账号"
            className="h-10 min-w-0 flex-1 rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm font-bold text-[var(--text)] outline-none focus:border-[var(--brand)]"
          >
            {accounts.length === 0 && <option value="">暂无账号</option>}
            {accounts.map((account) => (
              <option key={account.accountId} value={account.accountId}>
                {account.connected ? '在线' : '离线'} · {accountName(account)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void Promise.all([loadAccounts(), loadConversations()])}
            title="刷新账号和会话"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-[var(--surface-hover)]"
          >
            <RefreshCw className={`h-4 w-4 ${
              accountsLoading || conversationsLoading ? 'animate-spin' : ''
            }`} />
          </button>
          <button
            type="button"
            onClick={() => setView('filters')}
            title="消息过滤规则"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-[var(--surface-hover)]"
          >
            <Settings2 className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-[var(--border)] p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-soft)]" />
            <input
              ref={searchInputRef}
              type="search"
              name={searchInputName}
              autoComplete="new-password"
              autoCorrect="off"
              spellCheck={false}
              aria-label="搜索联系人、商品或消息"
              data-lpignore="true"
              data-1p-ignore="true"
              data-bwignore="true"
              readOnly={!searchInputUnlocked}
              value={query}
              onFocus={() => {
                searchInputTouchedRef.current = true;
                setSearchInputUnlocked(true);
              }}
              onBlur={() => {
                searchInputTouchedRef.current = false;
                setSearchInputUnlocked(false);
              }}
              onChange={(event) => {
                if (!searchInputTouchedRef.current) {
                  event.currentTarget.value = '';
                  setQuery('');
                  return;
                }
                setQuery(event.target.value);
              }}
              placeholder="搜索联系人、商品或消息"
              className="h-9 w-full rounded-md bg-[var(--surface-subtle)] pl-9 pr-3 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-soft)] focus:ring-2 focus:ring-[var(--brand)]"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {conversationsLoading && conversations.length === 0 && (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-brand-700" />
            </div>
          )}
          {visibleConversations.map((conversation) => {
            const selected = conversation.cid === activeCid;
            const title = conversation.otherUserName || `闲鱼用户 ${conversation.otherUserId}`;
            return (
              <button
                key={conversation.cid}
                type="button"
                onClick={() => openConversation(conversation)}
                className={`grid w-full grid-cols-[48px_minmax(0,1fr)_auto] gap-3 px-4 py-3 text-left ${
                  selected ? 'bg-[var(--surface-strong)]' : 'hover:bg-[var(--surface-hover)]'
                }`}
              >
                {renderAvatar(conversation.otherUserAvatar, title, 'h-12 w-12 rounded-full', conversation.otherUserId)}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold text-[var(--text)]">{title}</p>
                    {conversation.unreadCount > 0 && (
                      <span className="min-w-5 rounded-full bg-[var(--unread-badge)] px-1.5 text-center text-[10px] leading-5 text-white">
                        {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-xs text-[var(--text-muted)]">
                    {conversation.lastMessageSummary ? renderRichText(conversation.lastMessageSummary) : '暂无消息'}
                  </p>
                  <p className="mt-1 truncate text-[10px] text-[var(--text-soft)]">
                    {conversation.itemTitle || (conversation.itemId ? `商品 ${conversation.itemId}` : '普通会话')}
                  </p>
                </div>
                <span className="pt-0.5 text-[10px] text-[var(--text-soft)]">
                  {formatTimestamp(conversation.lastMessageTime)}
                </span>
              </button>
            );
          })}
          {!conversationsLoading && visibleConversations.length === 0 && (
            <div className="px-6 py-20 text-center">
              <Inbox className="mx-auto h-9 w-9 text-[var(--text-soft)]" />
              <p className="mt-3 text-sm text-[var(--text-muted)]">
                {activeAccount?.connected ? '暂无会话' : '账号离线，无法读取会话'}
              </p>
            </div>
          )}
        </div>
      </aside>

      <section className={`${mobilePane === 'list' ? 'hidden lg:flex' : 'flex'} min-h-0 min-w-0 flex-col`}>
        {activeConversation ? (
          <>
            <header className="flex h-[68px] shrink-0 items-center justify-between border-b border-[var(--border)] px-5">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMobilePane('list')}
                  className="-ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-md hover:bg-[var(--surface-hover)] lg:hidden"
                  title="返回会话列表"
                  aria-label="返回会话列表"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="min-w-0">
                  <h3 className="truncate text-base font-bold text-[var(--text)]">
                    {activeConversation.otherUserName || `闲鱼用户 ${activeConversation.otherUserId}`}
                  </h3>
                  <p className="mt-0.5 truncate text-xs text-[var(--text-soft)]">
                    {activeConversation.otherUserId}
                  </p>
                </div>
              </div>
              <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${
                activeAccount?.connected ? 'text-emerald-600' : 'text-[#999]'
              }`}>
                <span className={`h-2 w-2 rounded-full ${
                  activeAccount?.connected ? 'bg-emerald-500' : 'bg-[#b8ac8e]'
                }`} />
                {activeAccount?.connected ? '账号在线' : '账号离线'}
              </span>
            </header>

            <div className="flex min-h-[84px] shrink-0 items-center gap-3 border-b border-[var(--border)] px-4 py-3 sm:min-h-[92px] sm:gap-4 sm:px-5">
              {normalizeImageUrl(activeConversation.itemImage || activeItem?.item_image) ? (
                <img
                  src={normalizeImageUrl(activeConversation.itemImage || activeItem?.item_image)}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-md object-cover sm:h-16 sm:w-16"
                />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-[var(--surface-strong)] text-[var(--text-soft)] sm:h-16 sm:w-16">
                  <Package className="h-5 w-5" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[var(--text)]">
                  {activeConversation.itemTitle || activeItem?.item_title || '未关联商品'}
                </p>
                {activeItem?.item_price && (
                  <p className="mt-1 text-base font-extrabold text-[#ff3b30]">
                    <span className="text-xs">¥</span>
                    {String(activeItem.item_price).replace(/^[¥￥]\s*/, '')}
                  </p>
                )}
                <p className="mt-1 truncate text-xs text-[var(--text-soft)]">
                  {activeConversation.itemId ? `商品 ID ${activeConversation.itemId}` : '普通会话'}
                </p>
              </div>
              <span className="hidden rounded-md bg-[var(--brand)] px-4 py-2 text-xs font-bold text-[var(--brand-ink)] sm:inline-flex">
                {accountName(activeAccount)}
              </span>
            </div>

            <div ref={messagesScrollRef} className="min-h-0 flex-1 overflow-y-auto bg-[var(--app-bg)] px-4 py-6 sm:px-8">
              {messagesLoading && messages.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-brand-700" />
                </div>
              ) : (
                <div className="mx-auto max-w-4xl space-y-4">
                  {messages.map((message, index) => {
                    const previous = messages[index - 1];
                    const showTime = !previous || Math.abs(message.time - previous.time) > 300_000;
                    const senderLabel = message.isSelf
                      ? accountName(activeAccount)
                      : activeConversation.otherUserName || activeConversation.otherUserId;
                    // 系统消息（订单状态提醒、语音占位等）没有真实发送方，
                    // 按聊天气泡渲染会假装成买家发言，居中卡片更贴近原生 App
                    const isSystem = message.type === 'system';
                    return (
                      <div key={message.messageId || `${message.time}-${index}`}>
                        {showTime && (
                          <p className="mb-3 text-center text-[11px] text-[var(--text-soft)]">
                            {formatTimestamp(message.time)}
                          </p>
                        )}
                        {isSystem ? (
                          <div className="flex justify-center">
                            <div className="inline-flex max-w-[86%] items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs leading-5 text-[var(--text-muted)] shadow-sm">
                              <BellRing className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-soft)]" />
                              <span className="whitespace-pre-wrap break-words">{message.text}</span>
                            </div>
                          </div>
                        ) : (
                          <div className={`flex items-start gap-3 ${message.isSelf ? 'flex-row-reverse justify-start' : 'justify-start'}`}>
                            {!message.isSelf && renderAvatar(
                              activeConversation.otherUserAvatar,
                              senderLabel,
                              'h-9 w-9 shrink-0 rounded-full',
                              activeConversation.otherUserId
                            )}
                            <div className={`max-w-[76%] rounded-xl px-3.5 py-2.5 text-sm leading-6 ${
                              message.isSelf ? 'bg-[var(--brand)] text-[var(--brand-ink)]' : 'bg-[var(--surface-strong)] text-[var(--text)]'
                            }`}>
                              {message.images.map((url) => (
                                <img
                                  key={url}
                                  src={normalizeImageUrl(url)}
                                  alt="聊天图片"
                                  className="mb-2 max-h-80 max-w-full rounded object-contain last:mb-0"
                                />
                              ))}
                              {message.text && (
                                <p className="whitespace-pre-wrap break-words">{renderRichText(message.text)}</p>
                              )}
                            </div>
                            {message.isSelf && renderAvatar(
                              activeAccount?.avatarUrl,
                              senderLabel,
                              'h-9 w-9 shrink-0 rounded-full',
                              activeAccount?.accountId
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {messages.length === 0 && !messagesLoading && (
                    <p className="py-16 text-center text-sm text-[var(--text-soft)]">暂无聊天记录</p>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <footer className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3 sm:px-5">
              <div className="mb-2 flex items-center gap-4 text-[var(--text-muted)]">
                <div className="relative">
                  <button
                    type="button"
                    title="表情"
                    onClick={() => {
                      setShowEmoji(value => !value);
                      setShowPhrases(false);
                    }}
                    className={`hover:text-[var(--text)] ${showEmoji ? 'text-[var(--text)]' : ''}`}
                    aria-label="插入表情"
                  >
                    <Smile className="h-5 w-5" />
                  </button>
                  {showEmoji && (
                    <div className="absolute bottom-8 left-0 z-20 w-80 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 shadow-lg">
                      <div className="grid grid-cols-8 gap-1">
                        {EMOJI_CHOICES.map(emoji => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => insertEmoji(emoji)}
                            className="rounded-md p-1.5 text-lg leading-none transition-colors hover:bg-[var(--surface-hover)]"
                            aria-label={`插入表情 ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                      <div className="mt-2 border-t border-[var(--border)] pt-2">
                        <p className="px-1 text-[11px] font-bold text-[var(--text-soft)]">在线图片（直接发送给对方）</p>
                        <div className="mt-1.5 flex items-center gap-1.5 px-1">
                          <input
                            value={emojiImageUrl}
                            onChange={event => setEmojiImageUrl(event.target.value)}
                            placeholder="粘贴图片地址 https://..."
                            className="ios-input h-8 min-w-0 flex-1 rounded-md px-2 text-xs"
                            aria-label="在线图片地址"
                          />
                          <button
                            type="button"
                            onClick={() => void sendOnlineImage()}
                            disabled={imageSending || !emojiImageUrl.trim() || !activeAccount?.connected}
                            className="ios-btn-primary flex h-8 shrink-0 items-center gap-1 rounded-md px-2.5 text-xs"
                          >
                            {imageSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Image className="h-3.5 w-3.5" />}
                            发送
                          </button>
                        </div>
                      </div>
                      <p className="mt-1.5 border-t border-[var(--border)] px-1 pt-1.5 text-[11px] text-[var(--text-soft)]">
                        点击表情插入到输入框；图片地址直接作为图片消息发送
                      </p>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  title="发送图片"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={imageSending || !activeAccount?.connected}
                  className="hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="发送图片"
                >
                  {imageSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Image className="h-5 w-5" />}
                </button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={event => void handleImagePick(event)}
                  aria-label="选择图片"
                />
                <div className="relative">
                  <button
                    type="button"
                    title="快捷短语"
                    onClick={() => {
                      setShowPhrases(value => !value);
                      setShowEmoji(false);
                    }}
                    className={`hover:text-[var(--text)] ${showPhrases ? 'text-[var(--text)]' : ''}`}
                  >
                    <Zap className="h-5 w-5" />
                  </button>
                  {showPhrases && (
                    <div className="absolute bottom-8 left-0 z-20 max-h-72 w-80 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 shadow-lg">
                      {quickPhrases.length === 0 ? (
                        <p className="px-2 py-3 text-xs text-gray-500">
                          还没有快捷短语，可在「设置」中添加。
                        </p>
                      ) : (
                        quickPhrases.map(phrase => (
                          <button
                            key={phrase.id}
                            type="button"
                            onClick={() => insertPhrase(phrase)}
                            className="block w-full rounded-md px-2 py-2 text-left hover:bg-[var(--surface-hover)]"
                          >
                            <span className="block text-xs font-semibold text-[var(--text)]">
                              [{phrase.category}] {phrase.title}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-gray-500">
                              {phrase.content}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-end gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-2 transition-colors focus-within:border-[var(--border-brand)] sm:gap-2.5 sm:p-2.5">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void sendMessage();
                    }
                  }}
                  rows={2}
                  placeholder={activeAccount?.connected ? '输入消息，Enter 发送 / Shift+Enter 换行' : '账号离线，暂时无法发送'}
                  disabled={!activeAccount?.connected}
                  className="min-h-[44px] min-w-0 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-6 text-[var(--text)] outline-none placeholder:text-[var(--text-soft)] disabled:cursor-not-allowed sm:min-h-[52px]"
                />
                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={!draft.trim() || sending || !activeAccount?.connected}
                  className="flex h-9 shrink-0 items-center gap-2 rounded-lg bg-[var(--brand)] px-4 text-sm font-bold text-[var(--brand-ink)] shadow-sm transition-all hover:bg-[var(--brand-hover)] hover:shadow-brand disabled:cursor-not-allowed disabled:bg-[var(--surface-strong)] disabled:text-[var(--text-soft)] disabled:shadow-none sm:px-5"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  发送
                </button>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <Inbox className="h-12 w-12 text-[var(--text-soft)]" />
            <p className="mt-4 text-sm font-bold text-[var(--text-muted)]">选择一条会话查看消息</p>
            <p className="mt-1 text-xs text-[var(--text-soft)]">会话和聊天记录直接来自当前闲鱼账号</p>
          </div>
        )}
      </section>
    </div>
  );

  const renderFilters = () => (
    <div className="h-full overflow-y-auto bg-[var(--app-bg)] p-4 sm:p-6 lg:p-8">
      <div className="page-stack mx-auto max-w-[1320px]">
        <header className="page-header">
          <div>
            <h1 className="page-title">消息过滤规则</h1>
            <p className="page-description">集中管理无需自动回复或无需外部通知的消息关键词。</p>
          </div>
          <button
            type="button"
            onClick={() => setView('messages')}
            className="ios-btn-secondary flex items-center gap-2 rounded-md px-4 py-2.5 text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            返回消息
          </button>
        </header>

        <section className="section-panel">
          <SectionHeader
            title="批量添加规则"
            description="每行填写一个关键词，重复内容会自动跳过。"
            icon={Plus}
          />
          <div className="grid gap-3 p-4 lg:grid-cols-[220px_180px_minmax(240px,1fr)_auto]">
            <select
              value={newAccount}
              onChange={(event) => setNewAccount(event.target.value)}
              className="ios-input rounded-md px-3 py-2.5 text-sm"
            >
              <option value="">选择账号</option>
              {accountDetails.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.nickname || account.remark || account.id}
                </option>
              ))}
            </select>
            <select
              value={newType}
              onChange={(event) => setNewType(event.target.value as MessageFilterType)}
              className="ios-input rounded-md px-3 py-2.5 text-sm"
            >
              <option value="skip_reply">跳过自动回复</option>
              <option value="skip_notify">跳过外部通知</option>
            </select>
            <textarea
              value={newKeywords}
              onChange={(event) => setNewKeywords(event.target.value)}
              rows={2}
              placeholder={'每行一个关键词，例如：\n系统通知'}
              className="ios-input min-h-20 resize-y rounded-md px-3 py-2.5 text-sm"
            />
            <button
              type="button"
              onClick={() => void createFilters()}
              disabled={savingFilters}
              className="ios-btn-primary flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm disabled:opacity-50"
            >
              {savingFilters ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              批量添加
            </button>
          </div>
        </section>

        <section className="section-panel">
          <SectionHeader
            title="现有规则"
            description={`当前筛选共 ${filters.length} 条`}
            icon={Settings2}
          />
          <div className="toolbar rounded-none border-x-0 border-t-0 shadow-none">
            <div className="toolbar__group">
            <select
              value={filterAccount}
              onChange={(event) => setFilterAccount(event.target.value)}
              className="ios-input rounded-md px-3 py-2.5 text-sm sm:min-w-52"
            >
              <option value="">全部账号</option>
              {accountDetails.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.nickname || account.remark || account.id}
                </option>
              ))}
            </select>
            <select
              value={filterType}
              onChange={(event) => setFilterType(event.target.value as MessageFilterType | '')}
              className="ios-input rounded-md px-3 py-2.5 text-sm sm:min-w-44"
            >
              <option value="">全部用途</option>
              <option value="skip_reply">跳过自动回复</option>
              <option value="skip_notify">跳过外部通知</option>
            </select>
            <button
              type="button"
              onClick={() => void loadFilters()}
              className="ios-btn-secondary flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm"
            >
              <RefreshCw className={`h-4 w-4 ${filtersLoading ? 'animate-spin' : ''}`} />
              查询
            </button>
            </div>
            {selectedFilterIds.length > 0 && (
              <button
                type="button"
                onClick={() => void removeSelectedFilters()}
                className="ios-btn-danger flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm"
              >
                <Trash2 className="h-4 w-4" />
                删除所选
              </button>
            )}
          </div>

          <div className="divide-y divide-[#eeeeee] px-4">
            {filters.length > 0 && (
              <label className="flex items-center gap-3 py-3 text-xs font-bold text-[var(--text-muted)]">
                <input
                  type="checkbox"
                  checked={selectedAllFilters}
                  onChange={(event) =>
                    setSelectedFilterIds(event.target.checked ? filters.map((filter) => filter.id) : [])
                  }
                  className="h-4 w-4 accent-[#f5c400]"
                />
                全选当前列表
              </label>
            )}
            {filters.map((filter) => (
              <div
                key={filter.id}
                className="grid gap-3 py-4 sm:grid-cols-[24px_52px_180px_minmax(0,1fr)_44px] sm:items-center"
              >
                <input
                  type="checkbox"
                  checked={selectedFilterIds.includes(filter.id)}
                  onChange={(event) =>
                    setSelectedFilterIds((current) =>
                      event.target.checked
                        ? [...current, filter.id]
                        : current.filter((id) => id !== filter.id)
                    )
                  }
                  className="h-4 w-4 accent-[#f5c400]"
                />
                <button
                  type="button"
                  role="switch"
                  aria-checked={filter.enabled}
                  onClick={() => void toggleMessageFilter(filter.id).then(loadFilters)}
                  title={filter.enabled ? '停用规则' : '启用规则'}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    filter.enabled ? 'bg-brand-600' : 'bg-gray-300'
                  }`}
                >
                  <span className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                    filter.enabled ? 'translate-x-5' : ''
                  }`} />
                </button>
                <div>
                  <p className="break-all text-sm font-bold text-[var(--text)]">{filter.cookie_id}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{filterTypeLabel[filter.filter_type]}</p>
                </div>
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium text-[var(--text)]">{filter.keyword}</p>
                  <p className="mt-1 text-xs text-[var(--text-soft)]">
                    {formatDateTime(filter.updated_at || filter.created_at)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void removeFilter(filter)}
                  title="删除规则"
                  className="flex h-9 w-9 items-center justify-center rounded-md bg-red-50 text-red-600 hover:bg-red-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {!filtersLoading && filters.length === 0 && (
              <EmptyState compact title="暂无消息过滤规则" description="添加规则后可跳过指定消息的自动回复或外部通知。" icon={Settings2} />
            )}
          </div>
        </section>
      </div>
    </div>
  );

  return view === 'messages' ? renderMessages() : renderFilters();
};

export default MessageManagement;
