import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, LogOut, Menu, Palette, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { AccountDetail } from '../types';
import ThemeToggle from './ThemeToggle';
import NotificationBell from './NotificationBell';
import BrandLogo from './BrandLogo';
import { BrandPreference, BRAND_PREFERENCES, useTheme } from '../theme/ThemeProvider';

/** 主题色下拉的展示名（与设置页外观分区的色板一致） */
const BRAND_LABELS: Record<BrandPreference, string> = {
  yellow: '闲鱼黄',
  sky: '天蓝',
  jade: '水绿',
  royal: '皇家蓝',
  coral: '珊瑚橙',
  violet: '紫罗兰',
  rose: '玫红',
};

interface HeaderProps {
  pageTitle: string;
  accounts: AccountDetail[];
  activeAccountId: string;
  onAccountChange: (id: string) => void;
  onLogout: () => void;
  onOpenMobileNav: () => void;
  /** 通知铃铛点击买家消息时跳转消息中心 */
  onNavigateToMessages: () => void;
  /** 登录用户信息（最右侧展示） */
  username: string;
  isAdmin: boolean;
  /** 侧边栏折叠状态与切换 */
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

// 闲鱼头像地址常以 // 开头（协议相对地址），浏览器直用会被当成本地路径
const normalizeAvatarUrl = (value?: string) => {
  if (!value) return '';
  return value.startsWith('//') ? `https:${value}` : value;
};

/**
 * 全局顶栏：侧边栏开关 + 账号切换 + 主题切换 + 登录用户信息。
 * 右侧三块控件统一为 36px 高、8px 圆角、同底色同描边的控件组，避免视觉割裂。
 * 「管理的账号」是全局概念——各页面账号选择器与这里双向联动。
 */
const Header: React.FC<HeaderProps> = ({
  pageTitle,
  accounts,
  activeAccountId,
  onAccountChange,
  onLogout,
  onOpenMobileNav,
  onNavigateToMessages,
  username,
  isAdmin,
  sidebarCollapsed,
  onToggleSidebar,
}) => {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  // 无悬浮能力的输入方式（触屏）下，点按用户卡把退出层钉住
  const [logoutPinned, setLogoutPinned] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const userChipRef = useRef<HTMLDivElement>(null);
  // 主题色换肤：顶栏下拉直达，切换即时生效（本浏览器偏好）
  const { brand, setBrand } = useTheme();

  // 账号下拉与退出钉住态互斥 + 点击外部关闭
  useEffect(() => {
    if (!accountMenuOpen && !logoutPinned) return;
    const onPointerDown = (event: MouseEvent) => {
      if (accountMenuOpen && accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
      if (logoutPinned && userChipRef.current && !userChipRef.current.contains(event.target as Node)) {
        setLogoutPinned(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [accountMenuOpen, logoutPinned]);

  const current = accounts.find(account => account.id === activeAccountId);
  const displayName = (account?: AccountDetail) =>
    account?.nickname || account?.remark || account?.username || (account ? `账号 ${account.id.slice(0, 6)}` : '选择账号');
  const userInitial = (username || '?').trim().charAt(0).toUpperCase();

  return (
    <header className="z-20 flex h-14 shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 lg:px-6">
      {/* 侧边栏控制：移动端打开抽屉导航，桌面端折叠/展开图标栏 */}
      <button
        type="button"
        onClick={() => {
          if (window.matchMedia('(min-width: 1024px)').matches) {
            onToggleSidebar();
          } else {
            onOpenMobileNav();
          }
        }}
        className="-ml-2 rounded-md p-2 text-[var(--text-soft)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"
        title="侧边栏"
        aria-label="切换侧边栏"
      >
        <Menu className="h-5 w-5 lg:hidden" />
        {sidebarCollapsed ? (
          <PanelLeftOpen className="hidden h-5 w-5 lg:block" />
        ) : (
          <PanelLeftClose className="hidden h-5 w-5 lg:block" />
        )}
      </button>
      {/* 移动端：汉堡旁常驻品牌（侧栏收进抽屉后顶栏是唯一品牌位） */}
      <div className="flex min-w-0 items-center gap-1.5 lg:hidden">
        <BrandLogo className="h-6 w-6" />
        <span className="brand-wordmark text-[15px] font-black leading-none">鱼小铺</span>
      </div>
      <h1 className="hidden min-w-0 truncate text-[15px] font-bold text-[var(--text)] lg:block">{pageTitle}</h1>

      <div className="ml-auto flex items-center gap-1.5 md:gap-2">
        {/* 账号切换器 */}
        <div ref={accountMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setAccountMenuOpen(open => !open)}
            className="flex h-9 max-w-[184px] items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] px-2 text-[var(--text)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] md:px-2.5"
            aria-haspopup="listbox"
            aria-expanded={accountMenuOpen}
            title="切换管理的账号"
          >
            <span className="relative h-5 w-5 shrink-0 overflow-hidden rounded-full bg-[var(--brand-50)]">
              {current?.avatar_url && (
                <img src={normalizeAvatarUrl(current.avatar_url)} alt="" className="h-full w-full object-cover" />
              )}
            </span>
            <span className="hidden max-w-[110px] truncate text-[13px] font-medium md:block">{displayName(current)}</span>
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${current?.enabled ? 'bg-emerald-500' : 'bg-gray-400'}`} />
            <ChevronDown
              className={`hidden h-3.5 w-3.5 shrink-0 text-[var(--text-soft)] transition-transform md:block ${accountMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {accountMenuOpen && (
            <div
              className="header-popover dropdown-pop-in absolute right-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg"
              role="listbox"
              aria-label="选择管理的账号"
            >
              <p className="border-b border-[var(--border)] px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[var(--text-soft)]">
                切换管理的账号
              </p>
              <div className="max-h-80 overflow-y-auto py-1">
                {accounts.length === 0 && (
                  <p className="px-3 py-4 text-center text-xs text-[var(--text-soft)]">
                    暂无账号，请先在「账号管理」添加
                  </p>
                )}
                {accounts.map(account => {
                  const selected = account.id === activeAccountId;
                  return (
                    <button
                      key={account.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        onAccountChange(account.id);
                        setAccountMenuOpen(false);
                      }}
                      className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                        selected ? 'bg-[var(--brand-50)]' : 'hover:bg-[var(--surface-hover)]'
                      }`}
                    >
                      <span className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full bg-[var(--brand-50)]">
                        {account.avatar_url && (
                          <img
                            src={normalizeAvatarUrl(account.avatar_url)}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-bold text-[var(--text)]">
                          {displayName(account)}
                        </span>
                        <span className="block truncate text-[11px] text-[var(--text-soft)]">
                          {account.enabled ? '已启用' : '已停用'}
                          {account.remark ? ` · ${account.remark}` : ''}
                        </span>
                      </span>
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${account.enabled ? 'bg-emerald-500' : 'bg-gray-400'}`}
                      />
                      {selected && <Check className="h-4 w-4 shrink-0 text-[var(--brand-text)]" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 主题色下拉：调色板图标随当前主题色着色，选择即时生效 */}
        <div className="relative hidden h-9 items-center md:flex">
          <Palette className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-[var(--brand-text)]" />
          <select
            value={brand}
            onChange={(event) => setBrand(event.target.value as BrandPreference)}
            aria-label="主题色"
            title="切换全站主题色（按钮、图表与强调元素）"
            className="h-9 cursor-pointer appearance-none rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] pl-7 pr-6 text-xs font-bold text-[var(--text)] transition-colors hover:border-[var(--border-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            {BRAND_PREFERENCES.map((option) => (
              <option key={option} value={option}>
                {BRAND_LABELS[option]}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-gray-400" />
        </div>

        <NotificationBell onOpenMessage={onNavigateToMessages} />

        <ThemeToggle header />

        {/* 登录用户：用户名/角色上下排列，悬浮（或点按钉住）在下方弹出退出登录 */}
        <div ref={userChipRef} className="user-chip-wrap relative">
          <div
            className="flex h-9 cursor-pointer select-none items-center gap-2.5 rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] pl-2 pr-3 transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
            onClick={() => setLogoutPinned(pinned => !pinned)}
            title={`${username || '未登录'} · ${isAdmin ? '管理员' : '普通用户'}`}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand-300)] to-[var(--brand)] text-[11px] font-black text-[var(--brand-ink)]">
              {userInitial}
            </span>
            <span className="hidden min-w-0 flex-col leading-tight sm:flex">
              <span className="max-w-32 truncate text-xs font-bold text-[var(--text)]">{username || '未登录'}</span>
              <span className="max-w-32 truncate text-[10px] font-semibold text-[var(--text-soft)]">
                {isAdmin ? '管理员' : '普通用户'}
              </span>
            </span>
            <ChevronDown className="user-caret hidden h-3.5 w-3.5 shrink-0 text-[var(--text-soft)] sm:block" />
          </div>
          {/* 退出菜单浮出在卡片下方（Element 式 zoom-in-top），样式见 index.css 的 .user-menu */}
          <div className={`user-menu ${logoutPinned ? 'user-menu--pinned' : ''}`}>
            <div
              className="min-w-[120px] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg"
              role="menu"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setLogoutPinned(false);
                  onLogout();
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] font-bold text-[var(--danger)] transition-colors hover:bg-[var(--danger-soft)]"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                退出登录
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
