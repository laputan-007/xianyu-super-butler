# 🎨 闲鱼超级管家 - UI重构设计指南

## 📋 目录
1. [设计理念](#设计理念)
2. [视觉系统](#视觉系统)
3. [组件规范](#组件规范)
4. [页面重构方案](#页面重构方案)
5. [实施路线](#实施路线)

---

## 设计理念

### 核心原则
- **简约商务**：去除冗余装饰，专注功能和数据
- **数据驱动**：可视化优先，图表>表格>文字
- **效率优先**：减少点击次数，快捷操作优先
- **响应式**：完美适配桌面、平板、移动端

### 设计参考
- Vercel Dashboard（极简、数据为中心）
- Linear App（流畅、快捷操作）
- Notion（模块化、灵活布局）

---

## 视觉系统

### 配色方案

#### 主色调
```css
--primary-500: #f59e0b;  /* 闲鱼黄 - 主品牌色 */
--primary-600: #d97706;  /* 悬停态 */
--primary-50: #fffbeb;   /* 浅背景 */
```

#### 语义色
```css
--success-500: #10b981;  /* 成功 - 绿色 */
--warning-500: #f97316;  /* 警告 - 橙色 */
--danger-500: #ef4444;   /* 危险 - 红色 */
--info-500: #3b82f6;     /* 信息 - 蓝色 */
```

#### 中性色（商务灰）
```css
--gray-50: #fafafa;      /* 背景 */
--gray-100: #f5f5f5;     /* 次级背景 */
--gray-200: #e5e5e5;     /* 边框 */
--gray-500: #737373;     /* 次级文字 */
--gray-900: #171717;     /* 主文字 */
```

### 字体规范

#### 字号层级
```css
text-xs: 0.75rem (12px)   /* 辅助信息 */
text-sm: 0.875rem (14px)  /* 次要内容 */
text-base: 1rem (16px)    /* 正文 */
text-lg: 1.125rem (18px)  /* 小标题 */
text-xl: 1.25rem (20px)   /* 标题 */
text-2xl: 1.5rem (24px)   /* 大标题 */
text-3xl: 1.875rem (30px) /* 特大标题 */
```

#### 字重
```css
font-normal: 400  /* 正文 */
font-medium: 500  /* 强调 */
font-semibold: 600 /* 标题 */
font-bold: 700    /* 重要标题 */
```

### 间距系统
```css
p-2: 0.5rem (8px)
p-3: 0.75rem (12px)
p-4: 1rem (16px)
p-6: 1.5rem (24px)
p-8: 2rem (32px)
```

### 圆角系统
```css
rounded-md: 8px   /* 小元素 */
rounded-lg: 12px  /* 卡片 */
rounded-xl: 16px  /* 大卡片 */
rounded-2xl: 20px /* 特大卡片 */
```

### 阴影系统
```css
shadow-sm: 轻微阴影（悬停态）
shadow-card: 卡片默认阴影
shadow-card-hover: 卡片悬停阴影
shadow-dropdown: 下拉框阴影
```

---

## 组件规范

### 1. 按钮组件 (Button)

#### 主要按钮
```tsx
<button className="
  px-4 py-2
  bg-primary-500 hover:bg-primary-600
  text-white font-medium
  rounded-lg shadow-sm
  transition-all duration-200
  active:scale-95
">
  主要操作
</button>
```

#### 次要按钮
```tsx
<button className="
  px-4 py-2
  bg-gray-100 hover:bg-gray-200
  text-gray-900 font-medium
  rounded-lg
  transition-colors duration-200
">
  次要操作
</button>
```

#### 危险按钮
```tsx
<button className="
  px-4 py-2
  bg-danger-500 hover:bg-danger-600
  text-white font-medium
  rounded-lg shadow-sm
  transition-all duration-200
">
  删除
</button>
```

#### 图标按钮
```tsx
<button className="
  w-9 h-9
  flex items-center justify-center
  bg-gray-100 hover:bg-gray-200
  text-gray-700
  rounded-lg
  transition-colors duration-200
">
  <Icon className="w-5 h-5" />
</button>
```

### 2. 卡片组件 (Card)

#### 标准卡片
```tsx
<div className="
  bg-white
  border border-gray-200
  rounded-xl
  shadow-card hover:shadow-card-hover
  transition-shadow duration-200
  p-6
">
  <h3 className="text-lg font-semibold text-gray-900 mb-4">
    卡片标题
  </h3>
  <p className="text-sm text-gray-600">
    卡片内容
  </p>
</div>
```

#### 统计卡片
```tsx
<div className="
  bg-white
  border border-gray-200
  rounded-xl
  shadow-card
  p-6
  hover:border-primary-300
  transition-colors duration-200
">
  {/* 图标 */}
  <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center mb-4">
    <Icon className="w-6 h-6 text-primary-500" />
  </div>

  {/* 数据 */}
  <div className="space-y-1">
    <p className="text-sm font-medium text-gray-600">今日订单</p>
    <p className="text-3xl font-bold text-gray-900">125</p>
    <p className="text-sm text-success-500 flex items-center gap-1">
      <ArrowUpIcon className="w-4 h-4" />
      <span>+12.5%</span>
    </p>
  </div>
</div>
```

### 3. 徽章组件 (Badge)

```tsx
{/* 成功 */}
<span className="
  inline-flex items-center gap-1
  px-2.5 py-1
  bg-success-50
  text-success-700
  text-xs font-medium
  rounded-md
">
  <CheckIcon className="w-3 h-3" />
  已完成
</span>

{/* 警告 */}
<span className="
  px-2.5 py-1
  bg-warning-50
  text-warning-700
  text-xs font-medium
  rounded-md
">
  待处理
</span>

{/* 危险 */}
<span className="
  px-2.5 py-1
  bg-danger-50
  text-danger-700
  text-xs font-medium
  rounded-md
">
  异常
</span>
```

### 4. 输入框组件 (Input)

```tsx
<div className="space-y-2">
  <label className="text-sm font-medium text-gray-700">
    订单号
  </label>
  <input
    type="text"
    placeholder="请输入订单号"
    className="
      w-full
      px-3 py-2
      bg-white
      border border-gray-200
      rounded-lg
      text-sm text-gray-900
      placeholder:text-gray-400
      focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
      transition-shadow duration-200
    "
  />
</div>
```

### 5. 表格组件 (Table)

```tsx
<div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
  <table className="w-full">
    <thead className="bg-gray-50 border-b border-gray-200">
      <tr>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          订单号
        </th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          状态
        </th>
      </tr>
    </thead>
    <tbody className="divide-y divide-gray-200">
      <tr className="hover:bg-gray-50 transition-colors duration-150">
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          #12345
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <Badge variant="success">已完成</Badge>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

---

## 页面重构方案

### 1. Dashboard 工作台（重点）

#### 布局结构
```
┌─────────────────────────────────────────────────────┐
│  欢迎回来，用户名  [今天] [本周] [本月]            │
├─────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐│
│  │ 📊 今日   │ │ 💰 收益  │ │ 🚀 待发货│ │ ⚠️ 异常 ││
│  │   订单    │ │          │ │          │ │         ││
│  │   45  ↑  │ │ ¥1,280 ↑│ │    12   │ │   2     ││
│  └──────────┘ └──────────┘ └──────────┘ └─────────┘│
│                                                     │
│  ┌─────────────────────────┐ ┌──────────────────┐ │
│  │ 📈 订单趋势              │ │ 🔥 快捷操作     │ │
│  │ [折线图]                 │ │ [批量发货]      │ │
│  │                          │ │ [刷新订单]      │ │
│  └─────────────────────────┘ │ [添加关键词]    │ │
│                               └──────────────────┘ │
│  ┌─────────────────────────┐ ┌──────────────────┐ │
│  │ 📋 最近活动              │ │ 💡 待办事项     │ │
│  │ 2分钟前 新订单           │ │ ☐ 处理12个待发货│ │
│  │ 5分钟前 自动回复         │ │ ☐ 查看2个异常   │ │
│  └─────────────────────────┘ └──────────────────┘ │
└─────────────────────────────────────────────────────┘
```

#### 代码示例
```tsx
// src/pages/dashboard/DashboardV2.tsx
import React from 'react';
import { TrendingUp, Package, AlertCircle, DollarSign } from 'lucide-react';

export default function DashboardV2() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">工作台</h1>
          <p className="text-sm text-gray-600 mt-1">欢迎回来，今天也要加油哦！</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
            今天
          </button>
          <button className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">
            本周
          </button>
          <button className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">
            本月
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* 今日订单 */}
        <StatCard
          icon={<Package className="w-6 h-6" />}
          iconBg="bg-primary-50"
          iconColor="text-primary-500"
          title="今日订单"
          value="45"
          trend="+12.5%"
          trendUp
        />

        {/* 今日收益 */}
        <StatCard
          icon={<DollarSign className="w-6 h-6" />}
          iconBg="bg-success-50"
          iconColor="text-success-500"
          title="今日收益"
          value="¥1,280"
          trend="+8.3%"
          trendUp
        />

        {/* 待发货 */}
        <StatCard
          icon={<TrendingUp className="w-6 h-6" />}
          iconBg="bg-info-50"
          iconColor="text-info-500"
          title="待发货"
          value="12"
          action="去处理"
        />

        {/* 异常订单 */}
        <StatCard
          icon={<AlertCircle className="w-6 h-6" />}
          iconBg="bg-danger-50"
          iconColor="text-danger-500"
          title="异常订单"
          value="2"
          action="查看"
          alert
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 订单趋势图 */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200 rounded-xl shadow-card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">订单趋势</h3>
            {/* 这里放置图表组件 */}
            <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
              <p className="text-gray-400">ECharts/Recharts 图表</p>
            </div>
          </div>
        </div>

        {/* 快捷操作 */}
        <div>
          <div className="bg-white border border-gray-200 rounded-xl shadow-card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">快捷操作</h3>
            <div className="space-y-3">
              <QuickActionButton icon="📤" title="批量发货" desc="12个订单待发货" />
              <QuickActionButton icon="🔄" title="刷新订单" desc="同步最新状态" />
              <QuickActionButton icon="💬" title="添加关键词" desc="设置自动回复" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 最近活动 */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">最近活动</h3>
          <div className="space-y-4">
            <ActivityItem time="2分钟前" type="订单" content="新订单 #12345" />
            <ActivityItem time="5分钟前" type="回复" content="自动回复买家咨询" />
            <ActivityItem time="10分钟前" type="发货" content="订单 #12344 已发货" />
          </div>
        </div>

        {/* 待办事项 */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">待办事项</h3>
          <div className="space-y-3">
            <TodoItem checked={false} title="处理12个待发货订单" />
            <TodoItem checked={false} title="查看2个异常订单" />
            <TodoItem checked={true} title="更新商品信息" />
          </div>
        </div>
      </div>
    </div>
  );
}

// 统计卡片组件
function StatCard({ icon, iconBg, iconColor, title, value, trend, trendUp, action, alert }) {
  return (
    <div className={`
      bg-white border rounded-xl shadow-card p-6
      hover:shadow-card-hover transition-all duration-200
      ${alert ? 'border-danger-200 hover:border-danger-300' : 'border-gray-200 hover:border-primary-300'}
    `}>
      <div className="flex items-start justify-between">
        <div className={`w-12 h-12 rounded-lg ${iconBg} flex items-center justify-center ${iconColor}`}>
          {icon}
        </div>
        {action && (
          <button className="text-sm font-medium text-primary-500 hover:text-primary-600">
            {action} →
          </button>
        )}
      </div>
      <div className="mt-4 space-y-1">
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        {trend && (
          <p className={`text-sm font-medium flex items-center gap-1 ${trendUp ? 'text-success-500' : 'text-danger-500'}`}>
            <TrendingUp className="w-4 h-4" />
            {trend}
          </p>
        )}
      </div>
    </div>
  );
}

// 快捷操作按钮
function QuickActionButton({ icon, title, desc }) {
  return (
    <button className="
      w-full p-4
      bg-gray-50 hover:bg-gray-100
      border border-gray-200 hover:border-primary-300
      rounded-lg
      text-left
      transition-all duration-200
      group
    ">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">{title}</p>
          <p className="text-xs text-gray-500 truncate">{desc}</p>
        </div>
        <span className="text-gray-400 group-hover:text-gray-600">→</span>
      </div>
    </button>
  );
}

// 活动项
function ActivityItem({ time, type, content }) {
  return (
    <div className="flex items-start gap-3 pb-4 border-b border-gray-100 last:border-0 last:pb-0">
      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
        <div className="w-2 h-2 rounded-full bg-primary-500"></div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">{time}</span>
          <span className="px-2 py-0.5 bg-primary-50 text-primary-700 text-xs font-medium rounded">
            {type}
          </span>
        </div>
        <p className="text-sm text-gray-700 mt-1">{content}</p>
      </div>
    </div>
  );
}

// 待办项
function TodoItem({ checked, title }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
      <input
        type="checkbox"
        checked={checked}
        className="w-5 h-5 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
      />
      <span className={`text-sm ${checked ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
        {title}
      </span>
    </div>
  );
}
```

### 2. 订单管理页面重构

#### 布局：主表格 + 侧边详情面板

```tsx
// src/pages/orders/OrdersV2.tsx
import React, { useState } from 'react';
import { Search, Filter, Download, RefreshCw, MoreVertical } from 'lucide-react';

export default function OrdersV2() {
  const [selectedOrder, setSelectedOrder] = useState(null);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* 主内容区 */}
      <div className="flex-1 flex flex-col">
        {/* 顶部工具栏 */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900">订单管理</h1>
            <div className="flex items-center gap-3">
              {/* 搜索框 */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索订单号、买家..."
                  className="
                    pl-10 pr-4 py-2
                    w-64
                    bg-gray-50
                    border border-gray-200
                    rounded-lg
                    text-sm
                    focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                  "
                />
              </div>

              {/* 筛选 */}
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                <Filter className="w-4 h-4" />
                筛选
              </button>

              {/* 刷新 */}
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                刷新
              </button>

              {/* 导出 */}
              <button className="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg flex items-center gap-2">
                <Download className="w-4 h-4" />
                导出
              </button>
            </div>
          </div>

          {/* 筛选标签 */}
          <div className="mt-4 flex items-center gap-2">
            <FilterChip label="全部" count={156} active />
            <FilterChip label="待发货" count={12} />
            <FilterChip label="已发货" count={45} />
            <FilterChip label="已完成" count={89} />
            <FilterChip label="异常" count={2} alert />
          </div>
        </div>

        {/* 订单表格 */}
        <div className="flex-1 overflow-auto p-6">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="w-12 px-6 py-3">
                    <input type="checkbox" className="rounded border-gray-300" />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">订单号</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">买家</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">金额</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">时间</th>
                  <th className="w-12 px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {/* 订单行 */}
                <OrderRow
                  selected={selectedOrder?.id === '123'}
                  onClick={() => setSelectedOrder({ id: '123' })}
                />
                {/* 更多订单... */}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 侧边详情面板 */}
      {selectedOrder && (
        <OrderDetailPanel
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  );
}

// 筛选标签
function FilterChip({ label, count, active, alert }) {
  return (
    <button className={`
      px-3 py-1.5
      text-sm font-medium
      rounded-lg
      transition-colors duration-200
      ${active
        ? 'bg-primary-500 text-white'
        : alert
        ? 'bg-danger-50 text-danger-700 hover:bg-danger-100'
        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }
    `}>
      {label} {count && `(${count})`}
    </button>
  );
}

// 订单行
function OrderRow({ selected, onClick }) {
  return (
    <tr
      className={`
        hover:bg-gray-50 cursor-pointer transition-colors duration-150
        ${selected ? 'bg-primary-50' : ''}
      `}
      onClick={onClick}
    >
      <td className="px-6 py-4">
        <input type="checkbox" className="rounded border-gray-300" />
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
        #12345
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
        张**
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
        ¥99
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="px-2.5 py-1 bg-warning-50 text-warning-700 text-xs font-medium rounded-md">
          待发货
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        2小时前
      </td>
      <td className="px-6 py-4">
        <button className="text-gray-400 hover:text-gray-600">
          <MoreVertical className="w-5 h-5" />
        </button>
      </td>
    </tr>
  );
}

// 订单详情面板
function OrderDetailPanel({ order, onClose }) {
  return (
    <div className="w-96 bg-white border-l border-gray-200 flex flex-col">
      {/* 头部 */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">订单详情</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* 订单信息 */}
        <div className="space-y-3">
          <DetailItem label="订单号" value="#12345" />
          <DetailItem label="状态" value={<Badge variant="warning">待发货</Badge>} />
          <DetailItem label="金额" value="¥99" />
          <DetailItem label="买家" value="张**" />
        </div>

        {/* 收货信息 */}
        <div className="pt-6 border-t border-gray-200 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">收货信息</h3>
          <DetailItem label="收货人" value="张三" />
          <DetailItem label="电话" value="138****1234" />
          <DetailItem label="地址" value="北京市朝阳区xxx街道xxx号" />
        </div>

        {/* 商品信息 */}
        <div className="pt-6 border-t border-gray-200 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">商品信息</h3>
          <DetailItem label="规格" value="黑色 / L码" />
          <DetailItem label="数量" value="1" />
        </div>
      </div>

      {/* 底部操作 */}
      <div className="px-6 py-4 border-t border-gray-200 space-y-2">
        <button className="w-full px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg">
          立即发货
        </button>
        <button className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg">
          编辑订单
        </button>
      </div>
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right">{value}</span>
    </div>
  );
}
```

---

## 实施路线

### Phase 1: 设计系统和核心组件（2-3天）
- [x] 更新 Tailwind 配置
- [ ] 创建通用组件库
  - Button (各种变体)
  - Card (标准、统计、操作卡片)
  - Badge (各种状态)
  - Input/Select/Checkbox
  - Modal/Drawer
  - Table (响应式)
- [ ] 创建布局组件
  - 主布局
  - 侧边栏
  - 顶部导航

### Phase 2: 核心页面重构（3-4天）
- [ ] Dashboard 工作台
- [ ] 订单管理（侧边详情 + 批量操作）
- [ ] 账号管理（卡片布局）
- [ ] 关键词管理（分组 + 拖拽）

### Phase 3: 功能增强（2-3天）
- [ ] 数据可视化（ECharts/Recharts）
- [ ] 命令面板（Cmd+K）
- [ ] 实时推送（WebSocket）
- [ ] 批量操作（全模块）

### Phase 4: 性能优化（1-2天）
- [ ] 虚拟滚动
- [ ] 图片懒加载
- [ ] 代码分割
- [ ] 组件懒加载

### Phase 5: 移动端优化（2-3天）
- [ ] 响应式优化
- [ ] 触摸手势
- [ ] 底部导航
- [ ] 移动端专属组件

### Phase 6: 测试和打磨（1-2天）
- [ ] 功能测试
- [ ] 性能测试
- [ ] 浏览器兼容性
- [ ] 无障碍优化

---

## 技术栈推荐

### 保留
- ✅ React 18
- ✅ TypeScript
- ✅ Tailwind CSS
- ✅ Zustand
- ✅ React Query
- ✅ Lucide React

### 新增
```bash
# 数据可视化
npm install recharts

# 虚拟滚动
npm install @tanstack/react-virtual

# 命令面板
npm install cmdk

# 日期处理
npm install date-fns

# 拖拽
npm install @dnd-kit/core @dnd-kit/sortable

# 表格
npm install @tanstack/react-table
```

---

## 最佳实践

### 1. 组件化
- 每个组件只做一件事
- 保持组件纯净（无副作用）
- 提取可复用组件

### 2. 性能优化
- 使用 React.memo() 避免重渲染
- 使用 useMemo/useCallback 缓存
- 虚拟滚动处理长列表

### 3. 可维护性
- TypeScript 类型完整
- 组件有清晰的 Props 接口
- 统一的代码风格

### 4. 用户体验
- 加载状态反馈
- 错误处理友好
- 动画流畅自然
- 响应式完善

---

## 资源

### 设计参考
- [Vercel Dashboard](https://vercel.com/dashboard)
- [Linear](https://linear.app)
- [Notion](https://notion.so)

### 组件库参考
- [Shadcn UI](https://ui.shadcn.com)
- [Radix UI](https://radix-ui.com)
- [Headless UI](https://headlessui.com)

### 工具
- [Tailwind CSS](https://tailwindcss.com)
- [Heroicons](https://heroicons.com)
- [Lucide Icons](https://lucide.dev)

---

**开始重构，打造专业级商务后台！** 🚀
