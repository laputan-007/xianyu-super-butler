import React, { useEffect, useRef, useState } from 'react';
import {
  Database,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  Megaphone,
  Palette,
  RefreshCw,
  Save,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  Sun,
  UserRound,
  Zap,
} from 'lucide-react';

import { validatePassword } from '../lib/authValidation';

import {
  changePassword,
  createQuickPhrase,
  deleteQuickPhrase,
  getQuickPhrases,
  getSystemSettings,
  publishAnnouncement,
  sendTestEmail,
  updateQuickPhrase,
  updateSystemSettings,
} from '../services/api';
import { notify } from '../services/feedback';
import { QuickPhrase, SystemSettings } from '../types';
import {
  NoticeBanner,
  PageHeader,
  PageLoading,
  PageTabs,
  SectionHeader,
} from './ui';
import ThemeToggle from './ThemeToggle';
import { BrandPreference, useTheme } from '../theme/ThemeProvider';

type SettingsSection = 'general' | 'ai' | 'email' | 'phrases' | 'notice' | 'appearance';

/** 主题色预设：色块展示色（预设的品牌主色，与 index.css 里的 [data-brand] 块一致） */
const BRAND_OPTIONS: Array<{ value: BrandPreference; label: string; color: string }> = [
  { value: 'yellow', label: '闲鱼黄', color: '#ffe100' },
  { value: 'sky', label: '天蓝', color: '#35a3f7' },
  { value: 'jade', label: '水绿', color: '#14c0a0' },
  { value: 'royal', label: '皇家蓝', color: '#4f7afd' },
  { value: 'coral', label: '珊瑚橙', color: '#ff7043' },
  { value: 'violet', label: '紫罗兰', color: '#8b5cf6' },
  { value: 'rose', label: '玫红', color: '#ef476f' },
];

/**
 * 把后端的开关值转成布尔。
 *
 * 后端统一把开关存成 'true' / 'false' 字符串。直接拿来当布尔用会踩坑：
 * 'false' 本身是 truthy，关掉的开关在界面上仍显示开启；再点一次取反得到的
 * 还是 false，于是开关一旦关闭就再也打不开。
 */
const toBool = (value: unknown, fallback = false): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return fallback;
    return !['false', '0', 'no'].includes(normalized);
  }
  if (value === undefined || value === null) return fallback;
  return Boolean(value);
};

interface SettingToggleProps {
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}

const SettingToggle: React.FC<SettingToggleProps> = ({
  title,
  description,
  checked,
  onChange,
}) => (
  <div className="flex items-center justify-between gap-4 border-b border-gray-100 px-4 py-3 last:border-b-0">
    <div className="min-w-0">
      <p className="text-sm font-bold text-gray-900">{title}</p>
      <p className="mt-1 text-xs leading-5 text-gray-500">{description}</p>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        checked ? 'bg-brand' : 'bg-gray-300'
      }`}
    >
      <span
        className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-5' : ''
        }`}
      />
    </button>
  </div>
);

const SettingStrategy: React.FC<{
  value: string;
  options: Array<{ value: string; title: string; description: string }>;
  onChange: (value: string) => void;
}> = ({ value, options, onChange }) => (
  <div className="border-b border-[var(--border)] px-4 py-3 last:border-b-0">
    <p className="text-sm font-bold text-[var(--text)]">拖动策略</p>
    <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">自动过滑块时模拟鼠标的方式，改动即时生效、无需重启。</p>
    <div className="mt-3 grid gap-2">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
            value === opt.value
              ? 'border-[var(--border-brand)] bg-[var(--brand-soft)]'
              : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]'
          }`}
        >
          <span
            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
              value === opt.value ? 'border-[var(--brand-300)]' : 'border-[var(--border-strong)]'
            }`}
          >
            {value === opt.value && <span className="h-2 w-2 rounded-full bg-[var(--brand)]" />}
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-bold text-[var(--text)]">{opt.title}</span>
            <span className="mt-0.5 block text-[11px] leading-4 text-[var(--text-muted)]">{opt.description}</span>
          </span>
        </button>
      ))}
    </div>
  </div>
);

const Settings: React.FC = () => {
  // 主题色换肤（外观分区）；浅深色切换在 ThemeToggle 内部同样走 useTheme
  const { brand, setBrand } = useTheme();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');
  // 快捷短语：人工客服常用话术
  const [phrases, setPhrases] = useState<QuickPhrase[]>([]);
  const [phraseForm, setPhraseForm] = useState({ category: '默认', title: '', content: '' });

  const loadPhrases = () => {
    getQuickPhrases(true).then(setPhrases).catch(() => setPhrases([]));
  };

  useEffect(() => { loadPhrases(); }, []);

  const handleAddPhrase = async () => {
    if (!phraseForm.title.trim() || !phraseForm.content.trim()) return;
    await createQuickPhrase(phraseForm.title.trim(), phraseForm.content.trim(), phraseForm.category.trim() || '默认');
    setPhraseForm({ category: phraseForm.category, title: '', content: '' });
    loadPhrases();
  };

  const handleTogglePhrase = async (phrase: QuickPhrase) => {
    await updateQuickPhrase(phrase.id, { enabled: !phrase.enabled });
    loadPhrases();
  };

  const handleDeletePhrase = async (id: number) => {
    await deleteQuickPhrase(id);
    loadPhrases();
  };

  const [showApiKey, setShowApiKey] = useState(false);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  // 测试发信：收件地址 + 发送中状态
  const [emailTestTo, setEmailTestTo] = useState('');
  const [emailTesting, setEmailTesting] = useState(false);

  // 修改登录密码。与页面顶部的「保存设置」互不影响：这里改的是当前账号的凭据，
  // 走的是独立接口，成功后立刻生效。
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const handleChangePassword = async () => {
    const { current, next, confirm } = passwordForm;
    if (!current || !next) {
      notify('请填写当前密码和新密码');
      return;
    }
    // 与后端同一套规则/文案（lib/authValidation.ts）
    const [pwOk, pwReason] = validatePassword(next);
    if (!pwOk) {
      notify(pwReason);
      return;
    }
    if (next !== confirm) {
      notify('两次输入的新密码不一致');
      return;
    }
    if (next === current) {
      notify('新密码不能与当前密码相同');
      return;
    }

    setChangingPassword(true);
    try {
      const result = await changePassword(current, next);
      // 后端对「当前密码错误」这类校验失败也返回 200，要看 success 字段
      if (result?.success === false) {
        notify(result.message || '密码修改失败');
        return;
      }
      setPasswordForm({ current: '', next: '', confirm: '' });
      notify('密码已修改，下次登录请使用新密码');
    } catch (error) {
      notify(`密码修改失败：${(error as Error).message}`);
    } finally {
      setChangingPassword(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = () => {
    setLoading(true);
    getSystemSettings().then(setSettings).finally(() => setLoading(false));
  };

  // 公告发布（管理员）：发布后全站在线用户实时收到，离线用户下次登录补推
  const [announcementForm, setAnnouncementForm] = useState({ title: '', content: '', level: 'info' as 'info' | 'warning' | 'danger' });
  const [publishing, setPublishing] = useState(false);

  const publishGuardRef = useRef(false);

  const handlePublishAnnouncement = async () => {
    // 同步守卫防双击：publishing state 在批处理下两次点击都读到 false，会发布两条
    if (publishGuardRef.current) return;
    publishGuardRef.current = true;
    try {
      await doPublishAnnouncement();
    } finally {
      publishGuardRef.current = false;
    }
  };

  const doPublishAnnouncement = async () => {
    if (!announcementForm.title.trim() || !announcementForm.content.trim()) {
      notify('公告标题和内容不能为空', 'warning');
      return;
    }
    setPublishing(true);
    try {
      const res = await publishAnnouncement({
        title: announcementForm.title.trim(),
        content: announcementForm.content.trim(),
        level: announcementForm.level,
      });
      notify(res.message || '公告已发布', 'success');
      setAnnouncementForm({ title: '', content: '', level: 'info' });
    } catch (error) {
      notify(error instanceof Error ? error.message : '发布失败', 'error');
    } finally {
      setPublishing(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await updateSystemSettings(settings);
      notify('系统配置已保存');
    } catch (error) {
      notify(`保存失败：${(error as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  // 用表单当前填写的 SMTP 配置直接发一封测试邮件，不用先保存
  const handleTestEmail = async () => {
    if (!settings) return;
    const to = emailTestTo.trim();
    if (!to) {
      notify('请先填写接收测试邮件的邮箱');
      return;
    }
    setEmailTesting(true);
    try {
      const res = await sendTestEmail({
        to,
        smtp_server: settings.smtp_server || '',
        smtp_port: Number(settings.smtp_port) || 0,
        smtp_user: settings.smtp_user || '',
        smtp_password: settings.smtp_password || '',
        smtp_from: settings.smtp_from || '',
      });
      notify(res.message || (res.success ? '测试邮件已发送' : '发送失败'), res.success ? 'success' : 'error');
    } catch (error) {
      notify(`测试发信失败：${(error as Error).message}`, 'error');
    } finally {
      setEmailTesting(false);
    }
  };

  if (!settings) return <PageLoading label="正在加载系统设置" />;

  return (
    <div className="page-stack animate-fade-in">
      <PageHeader
        title="系统设置"
        description="配置访问安全、商品与订单同步节奏、默认 AI 参数、邮件服务、快捷短语与公告来源等系统级选项。"
        icon={SettingsIcon}
        actions={(
          <>
            <button
              type="button"
              onClick={loadSettings}
              disabled={loading}
              className="ios-btn-secondary flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="ios-btn-primary flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm"
            >
              <Save className="h-4 w-4" />
              {saving ? '保存中' : '保存设置'}
            </button>
          </>
        )}
      />

      <PageTabs
        value={activeSection}
        onChange={setActiveSection}
        ariaLabel="系统设置分区"
        items={[
          { id: 'general', label: '账号与同步', icon: UserRound },
          { id: 'ai', label: '默认 AI 配置', icon: Sparkles },
          { id: 'email', label: '邮件服务', icon: Mail },
          { id: 'phrases', label: '快捷短语', icon: Zap },
          { id: 'notice', label: '公告与更新', icon: Megaphone },
          { id: 'appearance', label: '外观', icon: Palette },
        ]}
      />

      {activeSection === 'appearance' && (
        <div className="grid gap-4 xl:grid-cols-2">
          <section className="section-panel">
            <SectionHeader
              title="显示主题"
              description="浅色、深色或跟随系统外观。"
              icon={Sun}
            />
            <div className="px-4 pb-4">
              <ThemeToggle />
            </div>
          </section>
          <section className="section-panel">
            <SectionHeader
              title="主题色"
              description="全站按钮、强调元素与图表的强调色——风格不变，只换颜色，即时生效。"
              icon={Palette}
            />
            <div className="px-4 pb-4">
              <div className="brand-swatches" role="radiogroup" aria-label="主题色">
                {BRAND_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={brand === option.value}
                    aria-label={`主题色：${option.label}`}
                    title={`${option.label}${option.value === 'yellow' ? '（默认）' : ''}`}
                    onClick={() => setBrand(option.value)}
                    style={{ background: option.color }}
                    className={`brand-swatch ${brand === option.value ? 'brand-swatch--active' : ''}`}
                  />
                ))}
              </div>
              <p className="mt-3 text-xs text-gray-500">
                当前选择保存在本浏览器（localStorage），换设备后需重新选择。
              </p>
            </div>
          </section>
        </div>
      )}

      {activeSection === 'general' && (
        <div className="grid gap-4 xl:grid-cols-2">
          <section className="section-panel">
            <SectionHeader
              title="访问与安全"
              description="控制后台注册入口、登录提示和验证码策略。"
              icon={ShieldCheck}
            />
            <SettingToggle
              title="允许用户注册"
              description="开启后允许新用户从登录页创建管理账号。"
              checked={toBool(settings.registration_enabled, true)}
              onChange={() => setSettings({
                ...settings,
                registration_enabled: !toBool(settings.registration_enabled, true),
              })}
            />
            <SettingToggle
              title="注册邮箱验证"
              description="要求注册时填写邮箱验证码。未配置下方「邮件服务」时请关闭，否则用户收不到验证码、无法完成注册。"
              checked={toBool(settings.email_verification_enabled, true)}
              onChange={() => setSettings({
                ...settings,
                email_verification_enabled: !toBool(settings.email_verification_enabled, true),
              })}
            />
            <SettingToggle
              title="显示默认登录信息"
              description="仅建议在本地调试环境显示默认账号提示。"
              checked={toBool(settings.show_default_login_info, true)}
              onChange={() => setSettings({
                ...settings,
                show_default_login_info: !toBool(settings.show_default_login_info, true),
              })}
            />
            <SettingToggle
              title="登录防爆破验证码"
              description="连续登录失败达阈值后强制图形验证码，防止密码被暴力尝试。"
              checked={toBool(settings.login_captcha_enabled, true)}
              onChange={() => setSettings({
                ...settings,
                login_captcha_enabled: !toBool(settings.login_captcha_enabled, true),
              })}
            />
          </section>

          <section className="section-panel">
            <SectionHeader
              title="修改登录密码"
              description="修改当前登录账号的密码，保存后立即生效。"
              icon={KeyRound}
            />
            <div className="grid gap-4 p-4">
              <label>
                <span className="field-label">当前密码</span>
                <div className="relative">
                  <input
                    type={showPasswordFields ? 'text' : 'password'}
                    value={passwordForm.current}
                    onChange={e => setPasswordForm({ ...passwordForm, current: e.target.value })}
                    autoComplete="current-password"
                    placeholder="请输入当前密码"
                    className="ios-input w-full rounded-md px-3 py-2.5 pr-11 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordFields(!showPasswordFields)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    aria-label={showPasswordFields ? '隐藏密码' : '显示密码'}
                  >
                    {showPasswordFields ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="field-label">新密码</span>
                  <input
                    type={showPasswordFields ? 'text' : 'password'}
                    value={passwordForm.next}
                    onChange={e => setPasswordForm({ ...passwordForm, next: e.target.value })}
                    autoComplete="new-password"
                    placeholder="至少 6 位"
                    className="ios-input w-full rounded-md px-3 py-2.5 text-sm"
                  />
                </label>
                <label>
                  <span className="field-label">确认新密码</span>
                  <input
                    type={showPasswordFields ? 'text' : 'password'}
                    value={passwordForm.confirm}
                    onChange={e => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                    autoComplete="new-password"
                    placeholder="再次输入新密码"
                    className="ios-input w-full rounded-md px-3 py-2.5 text-sm"
                  />
                </label>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleChangePassword()}
                  disabled={changingPassword}
                  className="ios-btn-primary flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm disabled:opacity-60"
                >
                  <KeyRound className="h-4 w-4" />
                  {changingPassword ? '修改中' : '修改密码'}
                </button>
              </div>
            </div>
          </section>

          <section className="section-panel">
            <SectionHeader
              title="滑块与风控"
              description="闲鱼弹出人机验证（滑块）时的自动处理策略。"
              icon={ShieldCheck}
            />
            <SettingToggle
              title="自动过滑块"
              description="开启后账号被风控时自动拉起浏览器拖动滑块。关闭后只记录风控并发通知，请在「账号管理」点人工验证处理。改动即时生效，无需重启。"
              checked={toBool(settings.slider_auto_enabled, true)}
              onChange={() => setSettings({
                ...settings,
                slider_auto_enabled: !toBool(settings.slider_auto_enabled, true),
              })}
            />
            <SettingStrategy
              value={settings.slider_strategy || 'hardware'}
              options={[
                { value: 'hardware', title: '硬件级注入（推荐）', description: '通过率最高。拖动瞬间（约 2-5 秒）会短暂接管本机鼠标并置前浏览器窗口。' },
                { value: 'hardware_idle', title: '智能空闲', description: '只在检测到你已离开电脑（2 分钟无键鼠操作）时才用硬件注入；正在使用时自动改走 CDP 不抢鼠标，空闲后的自动重试会切回硬件通道。' },
                { value: 'remote', title: '远程节点', description: '把滑块委托给另一台机器求解（如 NAS 跑主服务、Windows 桌面专职过滑块）。需在下方配置节点地址；节点失败自动回退本机拖动。' },
                { value: 'cdp', title: 'CDP 模拟', description: '完全不碰本机鼠标，但通过率明显更低。适合服务器无人值守，或任何不想被弹窗打扰的场景。' },
              ]}
              onChange={(v) => setSettings({ ...settings, slider_strategy: v })}
            />
            <div className="grid gap-4 p-4">
              <label>
                <span className="field-label">对外过滑块服务秘钥</span>
                <input
                  type="text"
                  value={settings.slider_service_secret_key || ''}
                  onChange={(event) => setSettings({ ...settings, slider_service_secret_key: event.target.value })}
                  placeholder="留空 = 不对外提供过滑块服务"
                  className="ios-input w-full rounded-md px-3 py-2.5"
                />
                <span className="mt-1 block text-xs text-gray-500">其他部署可通过 POST /api/slider/solve 用此秘钥调用本机过滑块。</span>
              </label>
              <label>
                <span className="field-label">远程过滑块节点地址</span>
                <input
                  type="text"
                  value={settings.slider_remote_url || ''}
                  onChange={(event) => setSettings({ ...settings, slider_remote_url: event.target.value })}
                  placeholder="如 http://192.168.1.10:8080（选「远程节点」策略时必填）"
                  className="ios-input w-full rounded-md px-3 py-2.5"
                />
              </label>
              <label>
                <span className="field-label">远程节点秘钥</span>
                <input
                  type="text"
                  value={settings.slider_remote_secret_key || ''}
                  onChange={(event) => setSettings({ ...settings, slider_remote_secret_key: event.target.value })}
                  placeholder="对方机器设置的「对外过滑块服务秘钥」"
                  className="ios-input w-full rounded-md px-3 py-2.5"
                />
                <span className="mt-1 block text-xs text-gray-500">调用时会按开关传递账号 Cookie（x5sec 绑定账号会话，通常必须传递），请只在可信网络与可信节点间使用。</span>
              </label>
            </div>
          </section>

          <section className="section-panel">
            <SectionHeader
              title="商品同步"
              description="设置后台定时获取闲鱼商品的频率和单次范围。"
              icon={Database}
            />
            <SettingToggle
              title="启用商品自动同步"
              description="定时将账号商品更新到本地商品库。"
              checked={toBool(settings.item_sync_enabled, true)}
              onChange={() => setSettings({
                ...settings,
                item_sync_enabled: !toBool(settings.item_sync_enabled, true),
              })}
            />
            <div className="grid gap-4 p-4 sm:grid-cols-2">
              <label>
                <span className="field-label">同步间隔（分钟）</span>
                <input
                  type="number"
                  value={Math.round((settings.item_sync_interval || 600) / 60)}
                  onChange={(event) => {
                    const minutes = parseInt(event.target.value, 10) || 10;
                    setSettings({ ...settings, item_sync_interval: minutes * 60 });
                  }}
                  className="ios-input w-full rounded-md px-3 py-2.5"
                  min="1"
                  max="1440"
                />
                <span className="mt-1 block text-xs text-gray-500">建议 10 至 60 分钟。</span>
              </label>
              <label>
                <span className="field-label">每次最多同步页数</span>
                <input
                  type="number"
                  value={settings.item_sync_max_pages || 5}
                  onChange={(event) => setSettings({
                    ...settings,
                    item_sync_max_pages: parseInt(event.target.value, 10) || 5,
                  })}
                  className="ios-input w-full rounded-md px-3 py-2.5"
                  min="1"
                  max="50"
                />
                <span className="mt-1 block text-xs text-gray-500">闲鱼接口通常每页返回 20 件商品。</span>
              </label>
            </div>
          </section>

          <section className="section-panel">
            <SectionHeader
              title="订单同步"
              description="定时从卖家端拉取订单，补齐监听离线期间产生的订单。"
              icon={Database}
            />
            <SettingToggle
              title="启用订单自动同步"
              description="关闭后只能在订单页手动点「拉取卖出订单」。"
              checked={settings.order_sync_enabled !== false && settings.order_sync_enabled !== 'false'}
              onChange={() => setSettings({
                ...settings,
                order_sync_enabled: settings.order_sync_enabled === false || settings.order_sync_enabled === 'false',
              })}
            />
            <div className="grid gap-4 p-4 sm:grid-cols-2">
              <label>
                <span className="field-label">同步间隔（分钟）</span>
                <input
                  type="number"
                  value={Math.round((settings.order_sync_interval || 1800) / 60)}
                  onChange={(event) => {
                    const minutes = parseInt(event.target.value, 10) || 30;
                    setSettings({ ...settings, order_sync_interval: minutes * 60 });
                  }}
                  className="ios-input w-full rounded-md px-3 py-2.5"
                  min="5"
                  max="1440"
                />
                <span className="mt-1 block text-xs text-gray-500">最低 5 分钟，建议 30 分钟。</span>
              </label>
            </div>
          </section>

          <section className="section-panel">
            <SectionHeader
              title="商品擦亮"
              description="定时擦亮商品重新获取搜索曝光，平台对每日次数有限制。"
              icon={Database}
            />
            <SettingToggle
              title="启用自动擦亮"
              description="开启后按下方间隔自动擦亮全部商品。也可在商品页手动触发。"
              checked={settings.auto_polish_enabled === true || settings.auto_polish_enabled === 'true'}
              onChange={() => setSettings({
                ...settings,
                auto_polish_enabled: !(settings.auto_polish_enabled === true || settings.auto_polish_enabled === 'true'),
              })}
            />
            <div className="grid gap-4 p-4 sm:grid-cols-2">
              <label>
                <span className="field-label">擦亮间隔（小时）</span>
                <input
                  type="number"
                  value={Math.round((settings.auto_polish_interval || 21600) / 3600)}
                  onChange={(event) => {
                    const hours = parseInt(event.target.value, 10) || 6;
                    setSettings({ ...settings, auto_polish_interval: hours * 3600 });
                  }}
                  className="ios-input w-full rounded-md px-3 py-2.5"
                  min="1"
                  max="24"
                />
                <span className="mt-1 block text-xs text-gray-500">最短 1 小时，建议 6 小时。</span>
              </label>
            </div>
          </section>

        </div>
      )}

      {activeSection === 'notice' && (
        <div className="grid gap-4 xl:grid-cols-2">
          <section className="section-panel">
            <SectionHeader
              title="公告与更新"
              description="填入你的公网 JSON 地址后，系统会定时拉取公告并检查新版本。"
              icon={Megaphone}
            />
            <SettingToggle
              title="启用公告与更新检查"
              description="关闭后不再拉取远端公告，也不提示新版本。"
              checked={settings.announcement_enabled !== 'false'}
              onChange={() => setSettings({
                ...settings,
                announcement_enabled: settings.announcement_enabled === 'false' ? 'true' : 'false',
              })}
            />
            <SettingToggle
              title="展示公告"
              description="关闭后顶部横幅和「关于」页都不再显示公告内容，仍会正常检查新版本。"
              checked={toBool(settings.announcement_show_notice, true)}
              onChange={() => setSettings({
                ...settings,
                announcement_show_notice: !toBool(settings.announcement_show_notice, true),
              })}
            />
            <SettingToggle
              title="展示版本更新提示"
              description="关闭后不再弹出新版本横幅，公告照常显示。适合不希望团队成员自行升级的场景。"
              checked={toBool(settings.announcement_show_update, true)}
              onChange={() => setSettings({
                ...settings,
                announcement_show_update: !toBool(settings.announcement_show_update, true),
              })}
            />
            <div className="px-4 py-3">
              <label className="field-label">公告 JSON 地址</label>
              <input
                type="url"
                value={settings.announcement_source_url || ''}
                onChange={e => setSettings({
                  ...settings,
                  announcement_source_url: e.target.value,
                })}
                placeholder="https://example.com/announcement.json（自建公告源地址）"
                className="ios-input mt-1 w-full rounded-md px-3 py-2 text-sm"
              />
              <p className="mt-1.5 text-xs text-gray-500">
                留空则展示内置的鱼小铺介绍，不请求任何外部网络。
                填写自建地址后，后端每 10 分钟拉取一次并缓存；远端不可用时沿用上次结果。
                在「关于」页可手动点「检查更新」立即刷新。
              </p>
            </div>

            <div className="border-t border-[var(--border)] px-4 py-4">
              <p className="text-sm font-bold text-[var(--text)]">发布公告</p>
              <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                发布后所有在线用户的顶栏铃铛实时收到；离线用户下次登录时自动补推最新一条，
                同一条公告只推一次，再发新公告才会再推。
              </p>
              <div className="mt-3 grid gap-3">
                <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
                  <div>
                    <label className="field-label">标题</label>
                    <input
                      value={announcementForm.title}
                      onChange={e => setAnnouncementForm(current => ({ ...current, title: e.target.value }))}
                      placeholder="例如：系统升级维护通知"
                      className="ios-input mt-1 w-full rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="field-label">级别</label>
                    <select
                      value={announcementForm.level}
                      onChange={e => setAnnouncementForm(current => ({ ...current, level: e.target.value as 'info' | 'warning' | 'danger' }))}
                      className="ios-input mt-1 w-full rounded-md px-3 py-2 text-sm"
                    >
                      <option value="info">通知</option>
                      <option value="warning">警告</option>
                      <option value="danger">重要</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="field-label">内容</label>
                  <textarea
                    value={announcementForm.content}
                    onChange={e => setAnnouncementForm(current => ({ ...current, content: e.target.value }))}
                    placeholder="公告正文，将显示在用户的通知铃铛里"
                    className="ios-input !min-h-[100px] mt-1 w-full resize-y rounded-md p-3 text-sm"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => void handlePublishAnnouncement()}
                    disabled={publishing}
                    className="ios-btn-primary flex items-center gap-2 rounded-md px-4 py-2.5 text-sm"
                  >
                    {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
                    {publishing ? '发布中' : '发布公告'}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {activeSection === 'phrases' && (
        <section className="section-panel">
          <SectionHeader
            title="快捷短语"
            description="人工客服常用话术，在消息管理页可一键插入到输入框。"
            icon={Zap}
          />
          <div className="grid gap-3 p-4 sm:grid-cols-[140px_200px_1fr_auto]">
            <input
              value={phraseForm.category}
              onChange={(e) => setPhraseForm({ ...phraseForm, category: e.target.value })}
              placeholder="分类"
              className="ios-input rounded-md px-3 py-2.5"
            />
            <input
              value={phraseForm.title}
              onChange={(e) => setPhraseForm({ ...phraseForm, title: e.target.value })}
              placeholder="标题"
              className="ios-input rounded-md px-3 py-2.5"
            />
            <input
              value={phraseForm.content}
              onChange={(e) => setPhraseForm({ ...phraseForm, content: e.target.value })}
              placeholder="话术内容"
              className="ios-input rounded-md px-3 py-2.5"
            />
            <button
              type="button"
              onClick={() => void handleAddPhrase()}
              disabled={!phraseForm.title.trim() || !phraseForm.content.trim()}
              className="ios-btn-primary rounded-md px-4 py-2.5 text-sm disabled:opacity-60"
            >
              添加
            </button>
          </div>
          <div className="divide-y divide-gray-100 border-t border-gray-100">
            {phrases.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-500">还没有快捷短语</p>
            ) : (
              phrases.map((phrase) => (
                <div key={phrase.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-20 shrink-0 text-xs text-gray-500">{phrase.category}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-800">{phrase.title}</p>
                    <p className="truncate text-xs text-gray-500">{phrase.content}</p>
                  </div>
                  <span className="shrink-0 text-xs text-gray-400">用了 {phrase.use_count} 次</span>
                  <button
                    type="button"
                    onClick={() => void handleTogglePhrase(phrase)}
                    className="shrink-0 text-xs text-blue-600 hover:underline"
                  >
                    {phrase.enabled ? '停用' : '启用'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeletePhrase(phrase.id)}
                    className="shrink-0 text-xs text-red-500 hover:underline"
                  >
                    删除
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {activeSection === 'ai' && (
        <section className="section-panel">
          <SectionHeader
            title="默认 AI 配置"
            description="作为账号未单独配置时使用的全局模型与回复内容。"
            icon={Sparkles}
          />
          <div className="grid gap-4 p-4 lg:grid-cols-2">
            <label>
              <span className="field-label">API 地址</span>
              <input
                type="text"
                value={settings.ai_api_url || 'https://dashscope.aliyuncs.com/compatible-mode/v1'}
                onChange={(event) => setSettings({ ...settings, ai_api_url: event.target.value })}
                className="ios-input w-full rounded-md px-3 py-2.5 text-sm"
                placeholder="https://api.openai.com/v1"
              />
              <span className="mt-1 block text-xs text-gray-500">
                填写兼容 OpenAI 协议的服务根地址，无需补全 `/chat/completions`。
              </span>
              <span className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                AI 不够用？
                <a
                  href="https://corleom.com/"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 font-semibold text-[var(--brand-text)] hover:underline"
                >
                  跳转到我的中转站
                  <ExternalLink className="h-3 w-3" />
                </a>
              </span>
            </label>

            <label>
              <span className="field-label">API Key</span>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={settings.ai_api_key || ''}
                  onChange={(event) => setSettings({ ...settings, ai_api_key: event.target.value })}
                  className="ios-input w-full rounded-md px-3 py-2.5 pr-11 font-mono text-sm"
                  placeholder="sk-..."
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  aria-label={showApiKey ? '隐藏 API Key' : '显示 API Key'}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            <label>
              <span className="field-label">默认模型</span>
              <select
                value={settings.ai_model || 'qwen-plus'}
                onChange={(event) => setSettings({ ...settings, ai_model: event.target.value })}
                className="ios-input w-full rounded-md px-3 py-2.5"
              >
                <option value="qwen-plus">通义千问 Plus</option>
                <option value="qwen-turbo">通义千问 Turbo</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                <option value="gpt-4">GPT-4</option>
              </select>
            </label>

            <label className="lg:col-span-2">
              <span className="field-label">默认自动回复内容</span>
              <textarea
                className="ios-input min-h-28 w-full resize-y rounded-md px-3 py-2.5 text-sm"
                value={settings.default_reply || ''}
                onChange={(event) => setSettings({ ...settings, default_reply: event.target.value })}
                placeholder="设置默认的自动回复内容..."
              />
            </label>

            <div className="lg:col-span-2">
              <NoticeBanner
                type="info"
                message="常用兼容服务包括阿里云 DashScope 和 OpenAI。API Key 仅保存在当前系统配置中。"
              />
            </div>
          </div>
        </section>
      )}

      {activeSection === 'email' && (
        <section className="section-panel">
          <SectionHeader
            title="SMTP 邮件服务"
            description="用于发送注册验证码和系统邮件通知。"
            icon={Mail}
          />
          <div className="grid gap-4 p-4 lg:grid-cols-2">
            <label>
              <span className="field-label">SMTP 服务器</span>
              <input
                type="text"
                value={settings.smtp_server || ''}
                onChange={(event) => setSettings({ ...settings, smtp_server: event.target.value })}
                placeholder="smtp.qq.com"
                className="ios-input w-full rounded-md px-3 py-2.5 text-sm"
              />
            </label>

            <label>
              <span className="field-label">SMTP 端口</span>
              <input
                type="number"
                value={settings.smtp_port || 587}
                onChange={(event) => setSettings({
                  ...settings,
                  smtp_port: parseInt(event.target.value, 10),
                })}
                placeholder="587"
                className="ios-input w-full rounded-md px-3 py-2.5 text-sm"
              />
            </label>

            <label>
              <span className="field-label">发件邮箱</span>
              <input
                type="email"
                value={settings.smtp_user || ''}
                onChange={(event) => setSettings({ ...settings, smtp_user: event.target.value })}
                placeholder="your-email@qq.com"
                className="ios-input w-full rounded-md px-3 py-2.5 text-sm"
              />
            </label>

            <label>
              <span className="field-label">邮箱密码或授权码</span>
              <div className="relative">
                <input
                  type={showSmtpPassword ? 'text' : 'password'}
                  value={settings.smtp_password || ''}
                  onChange={(event) => setSettings({ ...settings, smtp_password: event.target.value })}
                  placeholder="输入密码或授权码"
                  className="ios-input w-full rounded-md px-3 py-2.5 pr-11 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  aria-label={showSmtpPassword ? '隐藏邮箱授权码' : '显示邮箱授权码'}
                >
                  {showSmtpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <span className="mt-1 block text-xs text-gray-500">QQ 邮箱等服务通常要求填写授权码。</span>
            </label>

            <label className="lg:col-span-2">
              <span className="field-label">发件人显示名</span>
              <input
                type="text"
                value={settings.smtp_from || ''}
                onChange={(event) => setSettings({ ...settings, smtp_from: event.target.value })}
                placeholder="闲鱼自动回复系统"
                className="ios-input w-full rounded-md px-3 py-2.5 text-sm"
              />
            </label>
          </div>

          <div className="border-t border-gray-100 p-4">
            <span className="field-label">测试发信</span>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="email"
                value={emailTestTo}
                onChange={(event) => setEmailTestTo(event.target.value)}
                placeholder="接收测试邮件的邮箱"
                className="ios-input w-full rounded-md px-3 py-2.5 text-sm sm:max-w-xs"
              />
              <button
                type="button"
                disabled={emailTesting}
                onClick={() => void handleTestEmail()}
                className="ios-btn-secondary flex items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 py-2.5 text-sm disabled:opacity-50"
              >
                {emailTesting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {emailTesting ? '发送中' : '发送测试邮件'}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-gray-500">
              使用上方表单当前填写的配置直接发送，无需先保存；验证通过后注册验证码和系统通知都能正常发出。
            </p>
          </div>
        </section>
      )}
    </div>
  );
};

export default Settings;
