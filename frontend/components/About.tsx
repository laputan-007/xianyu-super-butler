import React, { useEffect, useState } from 'react';
import { Info, Megaphone, RefreshCw, ExternalLink, Send, Loader2 } from 'lucide-react';
import { getAnnouncement, testQmsgChannel } from '../services/api';
import { notify } from '../services/feedback';
import { AnnouncementPayload } from '../types';
import { EmptyState, PageHeader } from './ui';

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

const About: React.FC = () => {
  const [data, setData] = useState<AnnouncementPayload | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async (force = false) => {
    setLoading(true);
    try {
      setData(await getAnnouncement(force));
    } catch {
      // 拉取失败时保留上一次内容，页面不至于空白
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const announcements = data?.announcements || [];

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

      <section className="section-panel">
        <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
          <Megaphone className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-bold text-gray-800">历史公告</span>
          <span className="text-xs text-gray-400">{announcements.length} 条</span>
        </div>

        {announcements.length > 0 ? (
          <div className="divide-y divide-gray-100">
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
            description="配置更新源后，发布方的公告会显示在这里。"
            icon={Megaphone}
          />
        )}
      </section>
    </div>
  );
};

export default About;
