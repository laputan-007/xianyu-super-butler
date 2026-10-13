import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, LogOut, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { AccountDetail } from '../types';
import ThemeToggle from './ThemeToggle';

interface HeaderProps {
  pageTitle: string;
  accounts: AccountDetail[];
  activeAccountId: string;
  onAccountChange: (id: string) => void;
  onLogout: () => void;
  onOpenMobileNav: () => void;
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
 * 「管理的账号」是全局概念——各页面账号选择器与这里双向联动。
 */
const Header: React.FC<HeaderProps> = ({
  pageTitle,
  accounts,
  activeAccountId,
  onAccountChange,
  onLogout,
  onOpenMobileNav,
  username,
  isAdmin,
  sidebarCollapsed,
  onToggleSidebar,
}) => {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // 两处下拉互斥 + 点击外部关闭
  useEffect(() => {
    if (!accountMenuOpen && !userMenuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (accountMenuOpen && accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
      if (userMenuOpen && userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [accountMenuOpen, userMenuOpen]);

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
      <h1 className="min-w-0 truncate text-sm font-bold text-[var(--text)]">{pageTitle}</h1>

      <div className="ml-auto flex items-center gap-1.5">
        {/* 账号切换器 */}
        <div ref={accountMenuRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setAccountMenuOpen(open => !open);
              setUserMenuOpen(false);
            }}
            className="flex min-h-9 max-w-[168px] items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface-strong)] px-2.5 py-1.5 text-[var(--text)] transition-colors hover:border-[var(--border-brand)]"
            aria-haspopup="listbox"
            aria-expanded={accountMenuOpen}
            title="切换管理的账号"
          >
            <span className="relative h-5 w-5 shrink-0 overflow-hidden rounded-full bg-[var(--brand-50)]">
              {current?.avatar_url && (
                <img src={normalizeAvatarUrl(current.avatar_url)} alt="" className="h-full w-full object-cover" />
              )}
            </span>
            <span className="truncate text-[13px] font-medium">{displayName(current)}</span>
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${current?.enabled ? 'bg-emerald-500' : 'bg-gray-400'}`} />
            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 text-[var(--text-soft)] transition-transform ${accountMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {accountMenuOpen && (
            <div
              className="absolute right-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg"
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

        <ThemeToggle compact />

        {/* 登录用户信息 + 退出 */}
        <div ref={userMenuRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setUserMenuOpen(open => !open);
              setAccountMenuOpen(false);
            }}
            className="flex min-h-9 items-center gap-2 rounded-full border border-transparent px-1.5 py-1.5 text-[var(--text)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
            aria-haspopup="menu"
            aria-expanded={userMenuOpen}
            title={`${username || '未登录'}${isAdmin ? '（管理员）' : ''}`}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand-300)] to-[var(--brand)] text-[11px] font-black text-[#2a2416]">
              {userInitial}
            </span>
            <span className="hidden max-w-28 truncate text-[13px] font-bold sm:block">{username || '未登录'}</span>
            {isAdmin && (
              <span className="hidden rounded-full bg-[var(--brand)]/20 px-1.5 py-0.5 text-[10px] font-black text-[var(--brand-text)] md:block">
                管理员
              </span>
            )}
            <ChevronDown
              className={`hidden h-3.5 w-3.5 shrink-0 text-[var(--text-soft)] transition-transform sm:block ${userMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full z-30 mt-2 w-52 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg" role="menu">
              <div className="border-b border-[var(--border)] px-3 py-2.5">
                <p className="truncate text-[13px] font-bold text-[var(--text)]">{username || '未登录'}</p>
                <p className="mt-0.5 text-[11px] text-[var(--text-soft)]">{isAdmin ? '管理员 · 全部权限' : '普通用户 · 业务权限'}</p>
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setUserMenuOpen(false);
                  onLogout();
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] font-bold text-[var(--danger)] transition-colors hover:bg-[var(--danger-soft)]"
              >
                <LogOut className="h-4 w-4" />
                退出登录
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
