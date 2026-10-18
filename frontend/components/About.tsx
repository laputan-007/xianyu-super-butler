import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Info, Megaphone, RefreshCw, ExternalLink, Send, Loader2, Trash2, Monitor, FolderOpen, RotateCw } from 'lucide-react';
import { getAnnouncement, getAnnouncementHistory, deleteAnnouncement, testQmsgChannel, getStorageLocation, setStorageLocation, resetStorageLocation } from '../services/api';
import type { StorageLocationInfo } from '../services/api';
import { notify } from '../services/feedback';
import { AnnouncementItem, AnnouncementPayload } from '../types';
import { EmptyState, PageHeader } from './ui';
import { useDesktopShell } from './DesktopTitleBar';
import type { PyWebViewBridge } from './DesktopTitleBar';

// 本地已发布公告：带数据库自增 ID，超管可删除；公告源条目没有 localId
type LocalAnnouncementItem = AnnouncementItem & { localId: number };
type HistoryItem = AnnouncementItem & { localId?: number };

// 历史公告滚动区最多显示的条数
const HISTORY_MAX_VISIBLE = 5;

// 与 README「交流与反馈」保持同一个群；mqqapi 协议在装有 QQ 的设备上

const levelStyles: Record<string, string> = {
  info: 'border-blue-200 bg-blue-50 text-blue-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-red-200 bg-red-50 text-red-700',
};

const levelLabels: Record<string, string> = {
  info: '通知',
  warning: '注意',
  danger: '重要',
};

const About: React.FC<{ isAdmin?: boolean }> = ({ isAdmin = false }) => {
  const [data, setData] = useState<AnnouncementPayload | null>(null);
  const [localHistory, setLocalHistory] = useState<LocalAnnouncementItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = async (force = false) => {
    setLoading(true);
    try {
      // 公告源与本地已发布历史并行拉取，失败互不影响
      const [payload, history] = await Promise.all([
        getAnnouncement(force).catch(() => null),
        getAnnouncementHistory().catch(() => null),
      ]);
      if (payload) setData(payload);
      if (history?.data) {
        setLocalHistory(history.data.map(item => ({
          id: `local-${item.id}`,
          localId: item.id,
          title: item.title,
          content: item.content,
          level: (['info', 'warning', 'danger'].includes(item.level) ? item.level : 'info') as AnnouncementItem['level'],
          published_at: item.published_at,
        })));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  // 超管删除已发布公告：本地记录移除，所有用户的历史公告列表不再显示
  const handleDelete = async (localId: number) => {
    if (deletingId !== null) return;
    if (!window.confirm('删除该公告？删除后所有用户的历史公告里都不再显示。')) return;
    setDeletingId(localId);
    try {
      const res = await deleteAnnouncement(localId);
      notify(res.message || '公告已删除', 'success');
      setLocalHistory(current => current.filter(item => item.localId !== localId));
    } catch (error) {
      notify(error instanceof Error ? error.message : '删除失败', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  // 历史公告 = 本地已发布记录 + 公告源内容，按发布时间新→旧
  const announcements: HistoryItem[] = [
    ...localHistory,
    ...(data?.announcements || []),
  ].sort((a, b) => (b.published_at || '').localeCompare(a.published_at || ''));

  // 最多显示 5 条：条目高度不固定（内容行数不同），渲染后量出第 6 条
  // 顶边（即第 5 条底边）作为滚动区实际高度，其余滚动查看
  const listRef = useRef<HTMLDivElement>(null);
  const [listMaxHeight, setListMaxHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const sixth = el.children[HISTORY_MAX_VISIBLE] as HTMLElement | undefined;
    setListMaxHeight(sixth ? sixth.offsetTop : el.scrollHeight);
  }, [announcements]);

  // Qmsg 测试：向已配置的 Qmsg 渠道发一条真实消息；未配置时后端返回引导提示。
  // 可输入自定义文字（留空用默认文案）
  const [qmsgTesting, setQmsgTesting] = useState(false);
  const [qmsgTestText, setQmsgTestText] = useState('');
  const handleQmsgTest = async () => {
    if (qmsgTesting) return;
    setQmsgTesting(true);
    try {
      const res = await testQmsgChannel(qmsgTestText.trim() || undefined);
      notify(res.message || '测试消息已发送', 'success');
    } catch (error) {
      notify(error instanceof Error ? error.message : '测试失败', 'error');
    } finally {
      setQmsgTesting(false);
    }
  };

  // ========== 桌面客户端（pywebview 壳内才渲染） ==========
  const shellActive = useDesktopShell();
  const desktopBridge = () => (window as PyWebViewBridge).pywebview?.api;
  const [storage, setStorage] = useState<StorageLocationInfo | null>(null);
  const [needRestart, setNeedRestart] = useState(false);
  const [shortcutBusy, setShortcutBusy] = useState(false);
  const [storageBusy, setStorageBusy] = useState(false);

  useEffect(() => {
    if (!shellActive || !isAdmin) return;
    void getStorageLocation().then(setStorage).catch(() => {});
  }, [shellActive, isAdmin]);

  // 在桌面创建「鱼小铺.lnk」（客户端本地完成，不走后端）
  const handleCreateShortcut = async () => {
    const api = desktopBridge();
    if (!api?.create_desktop_shortcut || shortcutBusy) return;
    setShortcutBusy(true);
    try {
      const res = await api.create_desktop_shortcut();
      if (res?.success) notify('桌面快捷方式已创建', 'success');
      else notify(res?.message || '创建失败', 'error');
    } catch {
      notify('创建失败', 'error');
    } finally {
      setShortcutBusy(false);
    }
  };

  // 选择新存储目录：弹系统目录选择框 → 写入标记（重启后生效并自动迁移）
  const handleSelectDir = async () => {
    const api = desktopBridge();
    if (!api?.select_storage_dir || storageBusy) return;
    const picked = await api.select_storage_dir().catch(() => null);
    if (!picked?.success || !picked.path) return; // 取消选择，静默
    setStorageBusy(true);
    try {
      const res = await setStorageLocation(picked.path);
      if (res.warning) notify(res.warning, 'warning');
      notify(res.message || '已记录新存储路径', 'success');
      setNeedRestart(true);
      if (storage) setStorage({ ...storage, root: res.root, custom: true });
    } catch (error) {
      notify(error instanceof Error ? error.message : '设置失败', 'error');
    } finally {
      setStorageBusy(false);
    }
  };

  // 恢复默认（exe 同目录）：重启后数据自动迁回，不会丢
  const handleResetDir = async () => {
    if (storageBusy) return;
    if (!window.confirm('恢复默认存储路径？重启客户端后数据将自动迁回 exe 同目录。')) return;
    setStorageBusy(true);
    try {
      const res = await resetStorageLocation();
      notify(res.message || '已恢复默认存储路径', 'success');
      if (res.need_restart) setNeedRestart(true);
    } catch (error) {
      notify(error instanceof Error ? error.message : '操作失败', 'error');
    } finally {
      setStorageBusy(false);
    }
  };

  const handleRestart = () => desktopBridge()?.restart?.();
  const handleOpenDir = () => void desktopBridge()?.open_data_dir?.();

  return (
    <div className="page-stack animate-fade-in">
      <PageHeader
        title="关于"
        description="查看当前版本、检查更新、获取联系方式与查看历史公告。"
        icon={Info}
        actions={(
          <button
            type="button"
            onClick={() => load(true)}
            disabled={loading}
            className="ios-btn-secondary flex items-center gap-2 rounded-md px-4 py-2 text-sm disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? '正在检查' : '检查更新'}
          </button>
        )}
      />

      <section className="section-panel p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-md border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500">当前版本</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {data?.local_version || '—'}
            </p>
          </div>

          <div className="rounded-md border border-[var(--border-brand)] bg-[var(--brand-soft)] p-4">
            <p className="text-xs font-semibold text-[var(--brand-text)]">QQ 机器人推送 · Qmsg</p>
            <a
              href="https://qmsg.zendee.cn"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1.5 text-lg font-bold text-[var(--text)] hover:underline"
            >
              qmsg.zendee.cn
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            </a>
            <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
              在 Qmsg 控制台扫码加机器人好友并完成绑定后，把 KEY 填入
              「通知与日志 → 通知渠道」的 Qmsg 渠道，新消息提醒、系统公告与版本更新
              就会实时推送到你的 QQ。邮件通知同理，配置 SMTP 渠道即可。
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                value={qmsgTestText}
                onChange={event => setQmsgTestText(event.target.value)}
                placeholder="自定义测试文字（留空用默认文案）"
                className="ios-input h-9 min-w-0 flex-1 rounded-md px-3 text-xs sm:max-w-56"
                aria-label="测试消息文字"
              />
              <button
                type="button"
                onClick={() => void handleQmsgTest()}
                disabled={qmsgTesting}
                className="ios-btn-primary h-9 inline-flex shrink-0 items-center gap-2 rounded-md px-3 text-xs"
              >
                {qmsgTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {qmsgTesting ? '发送中' : '发送测试消息'}
              </button>
            </div>
          </div>
        </div>

        {!data?.source_configured && (
          <p className="mt-4 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
            公告与更新检查已关闭。在「系统设置 → 公告与更新」里开启后，
            这里会显示公告并自动检查新版本。
          </p>
        )}

        {data?.error && (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            拉取公告失败：{data.error}
          </p>
        )}
      </section>

      {shellActive && (
        <section className="section-panel p-4">
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-bold text-gray-800">桌面客户端</span>
          </div>

          <div className="mt-3 rounded-md border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-500">桌面快捷方式</p>
            <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
              在桌面创建「鱼小铺」快捷方式，双击即可启动客户端，无需进安装目录找 exe。
            </p>
            <button
              type="button"
              onClick={() => void handleCreateShortcut()}
              disabled={shortcutBusy}
              className="ios-btn-secondary mt-3 inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs disabled:opacity-50"
            >
              {shortcutBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
              {shortcutBusy ? '创建中' : '创建桌面快捷方式'}
            </button>
          </div>

          {isAdmin && (
            <div className="mt-3 rounded-md border border-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-500">数据存储路径</p>
              <p className="mt-1 break-all rounded bg-gray-50 px-2 py-1.5 font-mono text-xs text-gray-700">
                {storage?.root || '正在读取…'}
              </p>
              <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                数据库、日志、账号浏览器配置都存在这个目录。切到其他磁盘后，升级覆盖程序目录不影响数据。
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleSelectDir()}
                  disabled={storageBusy}
                  className="ios-btn-secondary inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  选择目录…
                </button>
                <button
                  type="button"
                  onClick={handleOpenDir}
                  className="ios-btn-secondary inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  打开数据目录
                </button>
                {storage?.custom && (
                  <button
                    type="button"
                    onClick={() => void handleResetDir()}
                    disabled={storageBusy}
                    className="ios-btn-secondary rounded-md px-3 py-1.5 text-xs disabled:opacity-50"
                  >
                    恢复默认
                  </button>
                )}
              </div>
              {needRestart && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <span>存储路径已修改，重启客户端后生效（数据将自动迁移到新目录）。</span>
                  <button
                    type="button"
                    onClick={handleRestart}
                    className="ios-btn-primary inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                    立即重启
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <section className="section-panel">
        <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
          <Megaphone className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-bold text-gray-800">历史公告</span>
          <span className="text-xs text-gray-400">{announcements.length} 条</span>
        </div>

        {announcements.length > 0 ? (
          <div
            ref={listRef}
            className="relative divide-y divide-gray-100 overflow-y-auto"
            style={listMaxHeight !== null ? { maxHeight: listMaxHeight } : undefined}
          >
            {announcements.map(item => (
              <article key={item.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded border px-2 py-0.5 text-[10px] font-bold ${levelStyles[item.level] || levelStyles.info}`}>
                    {levelLabels[item.level] || '通知'}
                  </span>
                  {item.title && (
                    <h3 className="text-sm font-bold text-gray-900">{item.title}</h3>
                  )}
                  {item.published_at && (
                    <span className="text-xs text-gray-400">{item.published_at}</span>
                  )}
                  {isAdmin && item.localId !== undefined && (
                    <button
                      type="button"
                      onClick={() => void handleDelete(item.localId!)}
                      disabled={deletingId === item.localId}
                      title="删除该公告"
                      aria-label="删除该公告"
                      className="ml-auto flex h-6 w-6 items-center justify-center rounded text-gray-400 opacity-50 transition-colors hover:bg-red-50 hover:text-red-600 hover:opacity-100 disabled:opacity-30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                  {item.content}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="暂无公告"
            description="在「系统设置 → 发布公告」发布后，历史记录会保留在这里。"
            icon={Megaphone}
          />
        )}
      </section>
    </div>
  );
};

export default About;
