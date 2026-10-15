import React from 'react';
import BrandLogo from './BrandLogo';
import {
  Bell,
  Bot,
  HeartHandshake,
  KeyRound,
  LayoutDashboard,
  MessageCircle,
  Package,
  Reply,
  Settings,
  ShoppingBag,
  UserCog,
  Users,
  Workflow,
  X,
  Info,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  isAdmin?: boolean;
  /** 收起为图标栏（桌面端） */
  collapsed?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  mobileOpen,
  onMobileClose,
  isAdmin = false,
  collapsed = false,
}) => {
  // 系统级页面只对管理员开放：普通用户看不到入口，后端接口也会拒绝其访问。
  // 「通知与日志」保留：通知渠道按用户隔离（页面内系统日志已单独按权限隐藏）。
  const adminOnly = (item: { id: string }) => isAdmin || !['settings', 'users'].includes(item.id);

  // 分组原则：按业务对象归拢，消灭只有单项的「孤儿分组」——
  // 商品自动化并入商品组、买家互动归入订单语境、回复三件套独立成组。
  const menuGroups = [
    {
      label: '经营概览',
      items: [
        { id: 'dashboard', icon: LayoutDashboard, label: '数据概览' },
      ],
    },
    {
      label: '账号与商品',
      items: [
        { id: 'accounts', icon: Users, label: '账号管理' },
        { id: 'items', icon: Package, label: '商品与发货' },
        { id: 'cards', icon: KeyRound, label: '卡密库存' },
        { id: 'product-automation', icon: Workflow, label: '商品自动化' },
      ],
    },
    {
      label: '订单与买家',
      items: [
        { id: 'orders', icon: ShoppingBag, label: '订单管理' },
        { id: 'buyer-interaction', icon: HeartHandshake, label: '买家互动' },
      ],
    },
    {
      label: '消息与回复',
      items: [
        { id: 'messages', icon: MessageCircle, label: '消息中心' },
        { id: 'auto-reply', icon: Reply, label: '自动回复' },
        { id: 'ai-reply', icon: Bot, label: 'AI 回复' },
      ],
    },
    {
      label: '系统',
      items: [
        { id: 'users', icon: UserCog, label: '用户管理' },
        { id: 'notifications', icon: Bell, label: '通知与日志' },
        { id: 'settings', icon: Settings, label: '系统设置' },
        { id: 'about', icon: Info, label: '关于' },
      ].filter(adminOnly),
    },
  ];

  return (
    <>
    {mobileOpen && (
      <button
        type="button"
        className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        onClick={onMobileClose}
        aria-label="关闭导航"
      />
    )}
    <aside
      className={`fixed left-0 top-0 z-40 flex h-screen flex-col bg-[var(--surface)] transition-all lg:translate-x-0 ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      } ${collapsed ? 'max-lg:w-[208px] lg:w-[72px]' : 'w-[208px]'}`}
      style={{ borderRight: '1px solid var(--border)' }}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        {/* 品牌区：SVG 吉祥物 logo，身体/鱼鳍/描边颜色随主题色联动；收起时只留 logo */}
        <div className={`flex h-[72px] shrink-0 items-center gap-3 ${collapsed ? 'justify-center px-2' : 'px-5'}`}>
          <span className="relative shrink-0">
            <span
              className="login-logo-glow absolute -inset-2 rounded-2xl"
              style={{ background: 'radial-gradient(circle, rgb(var(--brand-rgb)/0.35) 0%, transparent 65%)' }}
            />
            <BrandLogo className="relative h-10 w-10" />
          </span>
          <div className={`min-w-0 flex-1 ${collapsed ? 'lg:hidden' : ''}`}>
            <p className="brand-wordmark truncate text-[22px] font-black leading-none tracking-[0.1em]">鱼小铺</p>
            <p className="mt-1.5 text-[10.5px] font-bold tracking-[0.26em] text-[var(--text-soft)]">运营工作台</p>
          </div>
          <button type="button" onClick={onMobileClose} className="rounded-full p-2 hover:bg-[var(--surface-hover)] lg:hidden" aria-label="关闭导航">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          {menuGroups.map((group, groupIndex) => (
            <div key={group.label} className={groupIndex === 0 ? '' : 'mt-5'}>
              <p
                className={`mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--text-soft)] ${collapsed ? 'px-3 lg:hidden' : 'px-3'}`}
              >
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      title={collapsed ? item.label : undefined}
                      className={`group flex min-h-11 w-full items-center rounded-xl text-left transition-all ${
                        collapsed ? 'justify-center px-2 lg:px-2' : 'gap-3 px-3'
                      } ${
                        isActive
                          ? 'font-bold text-brand-ink'
                          : 'font-medium text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]'
                      }`}
                      style={isActive ? {
                        background: 'linear-gradient(135deg, var(--brand-300), var(--brand))',
                        boxShadow: 'var(--shadow-brand)',
                      } : undefined}
                    >
                      <Icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-brand-ink' : 'text-[var(--text-soft)] group-hover:text-[var(--text-muted)]'}`} />
                      <span className={`truncate text-sm ${collapsed ? 'lg:hidden' : ''}`}>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </aside>
    </>
  );
};

export default Sidebar;
