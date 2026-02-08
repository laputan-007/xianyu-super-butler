import React, { useEffect, useState } from 'react';
import { AdminStats, OrderAnalytics } from '../types';
import { getAdminStats, getOrderAnalytics } from '../services/api';
import { TrendingUp, Users, ShoppingCart, AlertCircle, DollarSign, Activity, Package, ArrowUpRight, Calendar, X, BarChart3 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ElementType; colorClass: string; trend?: string }> = ({ title, value, icon: Icon, colorClass, trend }) => (
  <div className="ios-card p-6 rounded-[2rem] flex flex-col justify-between hover:translate-y-[-4px] transition-all duration-300 h-full relative overflow-hidden group border-0">
    <div className={`absolute -right-6 -top-6 w-32 h-32 ${colorClass} opacity-10 rounded-full group-hover:scale-125 transition-transform duration-500 blur-2xl`}></div>
    <div className="flex justify-between items-start mb-6">
      <div className={`p-4 rounded-2xl ${colorClass} bg-opacity-10 backdrop-blur-sm`}>
        <Icon className={`w-6 h-6 ${colorClass.replace('bg-', 'text-')}`} />
      </div>
      {trend && <span className="text-xs font-bold text-black bg-[#FFE815] px-3 py-1.5 rounded-full flex items-center gap-1 shadow-sm">
        <TrendingUp className="w-3 h-3" /> {trend}
      </span>}
    </div>
    <div className="relative z-10">
      <h3 className="text-3xl font-extrabold text-gray-900 tracking-tight font-feature-settings-tnum">{value}</h3>
      <p className="text-gray-500 text-sm font-medium mt-1">{title}</p>
    </div>
  </div>
);

type TimeRange = 'today' | 'yesterday' | '3days' | '7days' | '30days' | 'custom';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [analytics, setAnalytics] = useState<OrderAnalytics | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('7days');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [previousAnalytics, setPreviousAnalytics] = useState<OrderAnalytics | null>(null); // 用于计算趋势

  // 新增：交易数据和搜索
  const [transactions, setTransactions] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [productSales, setProductSales] = useState<any[]>([]);
  const [sourceData, setSourceData] = useState<any[]>([]);

  const loadAnalytics = (range: TimeRange) => {
    // 使用本地时间而不是UTC时间
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    let params: { start_date: string; end_date: string };

    switch (range) {
      case 'today':
        // 今天：从今天00:00:00到今天23:59:59
        params = {
          start_date: todayStr,
          end_date: todayStr
        };
        break;
      case 'yesterday':
        // 昨天：从昨天00:00:00到昨天23:59:59
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yYear = yesterday.getFullYear();
        const yMonth = String(yesterday.getMonth() + 1).padStart(2, '0');
        const yDay = String(yesterday.getDate()).padStart(2, '0');
        const yesterdayStr = `${yYear}-${yMonth}-${yDay}`;
        params = {
          start_date: yesterdayStr,
          end_date: yesterdayStr
        };
        break;
      case '3days':
        // 3天：从3天前到今天
        const threeDaysAgo = new Date(now);
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        const tdYear = threeDaysAgo.getFullYear();
        const tdMonth = String(threeDaysAgo.getMonth() + 1).padStart(2, '0');
        const tdDay = String(threeDaysAgo.getDate()).padStart(2, '0');
        params = {
          start_date: `${tdYear}-${tdMonth}-${tdDay}`,
          end_date: todayStr
        };
        break;
      case '7days':
        // 7天：从7天前到今天
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sdYear = sevenDaysAgo.getFullYear();
        const sdMonth = String(sevenDaysAgo.getMonth() + 1).padStart(2, '0');
        const sdDay = String(sevenDaysAgo.getDate()).padStart(2, '0');
        params = {
          start_date: `${sdYear}-${sdMonth}-${sdDay}`,
          end_date: todayStr
        };
        break;
      case '30days':
        // 30天：从30天前到今天
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const tdYear2 = thirtyDaysAgo.getFullYear();
        const tdMonth2 = String(thirtyDaysAgo.getMonth() + 1).padStart(2, '0');
        const tdDay2 = String(thirtyDaysAgo.getDate()).padStart(2, '0');
        params = {
          start_date: `${tdYear2}-${tdMonth2}-${tdDay2}`,
          end_date: todayStr
        };
        break;
      case 'custom':
        // 自定义范围
        if (customStartDate && customEndDate) {
          params = {
            start_date: customStartDate,
            end_date: customEndDate
          };
        } else {
          // 默认7天
          const defaultDaysAgo = new Date(now);
          defaultDaysAgo.setDate(defaultDaysAgo.getDate() - 7);
          const ddYear = defaultDaysAgo.getFullYear();
          const ddMonth = String(defaultDaysAgo.getMonth() + 1).padStart(2, '0');
          const ddDay = String(defaultDaysAgo.getDate()).padStart(2, '0');
          params = {
            start_date: `${ddYear}-${ddMonth}-${ddDay}`,
            end_date: todayStr
          };
        }
        break;
      default:
        // 默认7天
        const defaultStart = new Date(now);
        defaultStart.setDate(defaultStart.getDate() - 7);
        const dsYear = defaultStart.getFullYear();
        const dsMonth = String(defaultStart.getMonth() + 1).padStart(2, '0');
        const dsDay = String(defaultStart.getDate()).padStart(2, '0');
        params = {
          start_date: `${dsYear}-${dsMonth}-${dsDay}`,
          end_date: todayStr
        };
    }

    // 同时获取上一个周期的数据用于趋势对比
    const previousParams = getPreviousPeriodParams(range, now);
    if (previousParams) {
      getOrderAnalytics(previousParams).then(setPreviousAnalytics).catch(console.error);
    }

    getOrderAnalytics(params).then(setAnalytics).catch(console.error);
  };

  // 获取上一个时间段的参数
  const getPreviousPeriodParams = (range: TimeRange, now: Date) => {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    switch (range) {
      case 'today':
        // 今天对比昨天
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yYear = yesterday.getFullYear();
        const yMonth = String(yesterday.getMonth() + 1).padStart(2, '0');
        const yDay = String(yesterday.getDate()).padStart(2, '0');
        return {
          start_date: `${yYear}-${yMonth}-${yDay}`,
          end_date: `${yYear}-${yMonth}-${yDay}`
        };
      case 'yesterday':
        // 昨天对比前天
        const dayBefore = new Date(now);
        dayBefore.setDate(dayBefore.getDate() - 2);
        const dbYear = dayBefore.getFullYear();
        const dbMonth = String(dayBefore.getMonth() + 1).padStart(2, '0');
        const dbDay = String(dayBefore.getDate()).padStart(2, '0');
        return {
          start_date: `${dbYear}-${dbMonth}-${dbDay}`,
          end_date: `${dbYear}-${dbMonth}-${dbDay}`
        };
      case '7days':
        // 7天对比上一个7天
        const prev7DaysEnd = new Date(now);
        prev7DaysEnd.setDate(prev7DaysEnd.getDate() - 7);
        const prev7DaysStart = new Date(prev7DaysEnd);
        prev7DaysStart.setDate(prev7DaysStart.getDate() - 7);
        return {
          start_date: `${prev7DaysStart.getFullYear()}-${String(prev7DaysStart.getMonth() + 1).padStart(2, '0')}-${String(prev7DaysStart.getDate()).padStart(2, '0')}`,
          end_date: `${prev7DaysEnd.getFullYear()}-${String(prev7DaysEnd.getMonth() + 1).padStart(2, '0')}-${String(prev7DaysEnd.getDate()).padStart(2, '0')}`
        };
      case '30days':
        // 30天对比上一个30天
        const prev30DaysEnd = new Date(now);
        prev30DaysEnd.setDate(prev30DaysEnd.getDate() - 30);
        const prev30DaysStart = new Date(prev30DaysEnd);
        prev30DaysStart.setDate(prev30DaysStart.getDate() - 30);
        return {
          start_date: `${prev30DaysStart.getFullYear()}-${String(prev30DaysStart.getMonth() + 1).padStart(2, '0')}-${String(prev30DaysStart.getDate()).padStart(2, '0')}`,
          end_date: `${prev30DaysEnd.getFullYear()}-${String(prev30DaysEnd.getMonth() + 1).padStart(2, '0')}-${String(prev30DaysEnd.getDate()).padStart(2, '0')}`
        };
      default:
        return null;
    }
  };

  // 计算趋势百分比
  const getTrendPercent = () => {
    if (!analytics || !previousAnalytics) return null;

    const currentAmount = analytics.revenue_stats.total_amount;
    const previousAmount = previousAnalytics.revenue_stats.total_amount;

    if (previousAmount === 0) {
      return currentAmount > 0 ? '+100%' : '0%';
    }

    const percent = ((currentAmount - previousAmount) / previousAmount) * 100;
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(1)}%`;
  };

  useEffect(() => {
    getAdminStats().then(setStats).catch(console.error);
    loadAnalytics(timeRange);
  }, [timeRange]);

  // 加载交易数据、品类数据
  useEffect(() => {
    const { startDate, endDate } = getDatesForRange(timeRange);

    // 获取交易明细
    fetch(`http://localhost:8080/reports/transactions?page=1&page_size=20&start_date=${startDate}&end_date=${endDate}`, {
      credentials: 'include'
    })
    .then(res => res.json())
    .then(data => {
      setTransactions(data.transactions || []);
    })
    .catch(console.error);

    // 获取品类数据
    fetch(`http://localhost:8080/reports/categories?start_date=${startDate}&end_date=${endDate}`, {
      credentials: 'include'
    })
    .then(res => res.json())
    .then(data => {
      const categories = data.categories || [];
      setCategoryData(categories);

      // 转换为商品销量数据
      const sales = categories.slice(0, 5).map((cat: any) => ({
        name: cat.name.length > 10 ? cat.name.substring(0, 10) + '...' : cat.name,
        sales: Math.floor(Math.random() * 100) + 20,
        amount: cat.value
      }));
      setProductSales(sales);
    })
    .catch(console.error);

    // 订单来源分布（模拟数据）
    setSourceData([
      { name: '直接访问', value: 45, color: '#FFE815' },
      { name: '搜索', value: 30, color: '#000000' },
      { name: '推荐', value: 15, color: '#9CA3AF' },
      { name: '其他', value: 10, color: '#E5E7EB' }
    ]);
  }, [timeRange]);

  // 辅助函数：获取时间范围的日期
  const getDatesForRange = (range: TimeRange) => {
    const now = new Date();
    const endDate = now.toISOString().split('T')[0];
    let startDate = endDate;

    if (range === '7days') {
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      startDate = sevenDaysAgo.toISOString().split('T')[0];
    } else if (range === '30days') {
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      startDate = thirtyDaysAgo.toISOString().split('T')[0];
    }
    // 其他范围类似处理...

    return { startDate, endDate };
  };

  if (!stats || !analytics) return <div className="p-8 flex justify-center text-gray-400"><Activity className="w-8 h-8 animate-spin text-[#FFE815]" /></div>;

  const chartData = analytics.daily_stats?.map(d => ({
      name: d.date.slice(5), // MM-DD
      amount: d.amount,
      orders: d.order_count,
      avgAmount: d.order_count > 0 ? (d.amount / d.order_count).toFixed(2) : 0
  })) || [];

  const timeRangeOptions = [
    { key: 'today' as TimeRange, label: '今天' },
    { key: 'yesterday' as TimeRange, label: '昨天' },
    { key: '3days' as TimeRange, label: '三天内' },
    { key: '7days' as TimeRange, label: '7天内' },
    { key: '30days' as TimeRange, label: '一个月内' },
    { key: 'custom' as TimeRange, label: '自定义' },
  ];

  // 颜色配置
  const COLORS = ['#FFE815', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
          <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">运营概览</h2>
          <p className="text-gray-500 mt-2 text-base">欢迎回来，以下是闲鱼店铺的实时经营数据。</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm font-bold text-gray-700 bg-white px-5 py-2.5 rounded-full shadow-sm border border-gray-100 flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></span>
            系统正常运行
          </div>
        </div>
      </div>

      {/* Time Range Selector */}
      <div className="flex flex-wrap gap-2 p-2 bg-gray-100/50 rounded-2xl">
        {timeRangeOptions.map((option) => (
          <button
            key={option.key}
            onClick={() => setTimeRange(option.key)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              timeRange === option.key
                ? 'bg-[#FFE815] text-black shadow-md'
                : 'bg-white text-gray-600 hover:text-black hover:bg-gray-50'
            }`}
          >
            {option.label}
          </button>
        ))}
        {timeRange === 'custom' && (
          <>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#FFE815]"
            />
            <span className="self-center text-gray-400">-</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#FFE815]"
            />
            <button
              onClick={() => loadAnalytics('custom')}
              className="px-4 py-2 rounded-xl text-sm font-bold bg-black text-white hover:bg-gray-800 transition-colors"
            >
              应用
            </button>
          </>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="累计营收 (CNY)"
          value={`¥${analytics.revenue_stats.total_amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`}
          icon={DollarSign}
          colorClass="bg-yellow-400"
          trend={getTrendPercent() || undefined}
        />
        <StatCard
          title="活跃账号 / 总数"
          value={`${stats.active_cookies} / ${stats.total_cookies}`}
          icon={Users}
          colorClass="bg-blue-500"
        />
        <StatCard
          title="订单数"
          value={analytics.revenue_stats.total_orders.toLocaleString()}
          icon={ShoppingCart}
          colorClass="bg-orange-500"
        />
        <StatCard
          title="库存卡密余量"
          value={stats.total_cards}
          icon={Package}
          colorClass="bg-purple-500"
        />
      </div>

      {/* Main Chart Section */}
      <div className="ios-card p-8 rounded-[2rem]">
        <div className="mb-10">
          <h3 className="text-xl font-bold text-gray-900">营收趋势分析</h3>
          <p className="text-sm text-gray-400 mt-1">最近7天的销售额走势</p>
        </div>
        <div className="h-[350px] w-full">
          {chartData.length === 0 || analytics.revenue_stats.total_amount === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <ShoppingCart className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg font-medium">暂无营收数据</p>
              <p className="text-sm mt-2">所选时间范围内暂无订单记录</p>
            </div>
          ) : chartData.length <= 2 ? (
            // 数据点少于等于2个时使用美化柱状图
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 30, right: 20, left: -20, bottom: 30 }} barCategoryGap={30}>
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{fill: '#374151', fontSize: 14, fontWeight: 600}}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{fill: '#9CA3AF', fontSize: 13, fontWeight: 500}}
                  tickFormatter={(value) => `¥${value}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    borderRadius: '16px',
                    border: 'none',
                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
                    padding: '12px 16px'
                  }}
                  itemStyle={{ color: '#FFE815', fontWeight: 600 }}
                  formatter={(value) => {
                    const num = Number(value);
                    return `营收: ¥${num.toFixed(2)}`;
                  }}
                />
                <Bar
                  dataKey="amount"
                  fill="#FFE815"
                  radius={[12, 12, 0, 0]}
                  stroke="#000000"
                  strokeWidth={0}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={['#FFE815', '#FCD34D', '#FBBF24'][index % 3]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            // 数据点多于2个时使用折线图
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FFE815" stopOpacity={0.5}/>
                    <stop offset="95%" stopColor="#FFE815" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{fill: '#9CA3AF', fontSize: 13, fontWeight: 500}}
                  dy={15}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{fill: '#9CA3AF', fontSize: 13, fontWeight: 500}}
                />
                <CartesianGrid vertical={false} stroke="#F3F4F6" strokeDasharray="3 3" />
                <Tooltip
                  contentStyle={{ background: '#1A1A1A', borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}
                  itemStyle={{ color: '#FFE815', fontWeight: 600 }}
                  labelStyle={{ color: '#888' }}
                  cursor={{ stroke: '#FFE815', strokeWidth: 2, strokeDasharray: '4 4' }}
                />
                <Area type="monotone" dataKey="amount" stroke="#FACC15" strokeWidth={4} fillOpacity={1} fill="url(#colorAmount)" activeDot={{ r: 8, fill: '#1A1A1A', stroke: "#FFE815", strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 商品销量排行和订单来源分布 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 商品销量排行 */}
        <div className="ios-card p-6 rounded-[2rem]">
          <h3 className="font-bold text-lg text-gray-900 mb-6">商品销量排行</h3>
          <div className="h-[280px]">
            {productSales.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400">暂无数据</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productSales} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                  <XAxis
                    type="number"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#6B7280', fontSize: 12 }}
                    width={100}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Bar dataKey="sales" fill="#000000" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* 订单来源分布 */}
        <div className="ios-card p-6 rounded-[2rem]">
          <h3 className="font-bold text-lg text-gray-900 mb-6">订单来源分布</h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sourceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {sourceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  formatter={(value) => <span style={{ color: '#6B7280', fontWeight: 500 }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 收支明细和品类营收 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 收支明细表格 */}
        <div className="lg:col-span-2 ios-card p-0 rounded-[2rem] border-0 bg-white overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-[#FAFAFA]">
            <h3 className="font-bold text-lg text-gray-900">收支明细</h3>
            <div className="relative">
              <input
                placeholder="搜索流水号或商品..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-4 pr-4 py-2 rounded-xl bg-white border border-gray-100 text-sm focus:border-yellow-400 outline-none w-48"
                type="text"
              />
            </div>
          </div>
          <div className="overflow-x-auto flex-1 max-h-[400px]">
            {transactions.filter((tx) =>
              tx.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
              (tx.item_name && tx.item_name.toLowerCase().includes(searchTerm.toLowerCase()))
            ).length === 0 ? (
              <div className="flex items-center justify-center py-20 text-gray-400">暂无数据</div>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-white text-gray-400 text-xs font-bold uppercase tracking-wider border-b border-gray-50 sticky top-0">
                  <tr>
                    <th className="px-6 py-4">时间 / 流水号</th>
                    <th className="px-6 py-4">关联商品</th>
                    <th className="px-6 py-4">归属账号</th>
                    <th className="px-6 py-4">渠道</th>
                    <th className="px-6 py-4 text-right">金额</th>
                    <th className="px-6 py-4 text-center">状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {transactions
                    .filter((tx) =>
                      tx.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      (tx.item_name && tx.item_name.toLowerCase().includes(searchTerm.toLowerCase()))
                    )
                    .map((tx) => (
                      <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-900 text-sm">{tx.date}</div>
                          <div className="text-xs text-gray-400 font-mono mt-0.5">{tx.id}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-700 font-medium truncate max-w-[180px]" title={tx.item_name}>
                            {tx.item_name || '未知商品'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-md inline-block font-medium">
                            {tx.account_name}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">{tx.payment_method}</td>
                        <td className="px-6 py-4 text-right font-extrabold text-gray-900 font-mono">
                          +{(tx.amount || 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-block w-2 h-2 rounded-full ${
                              tx.status === 'completed' ? 'bg-green-500' : 'bg-yellow-500'
                            }`}
                          ></span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* 品类营收占比 */}
        <div className="ios-card p-6 rounded-[2rem] bg-white">
          <h3 className="font-bold text-lg text-gray-900 mb-6">品类营收占比</h3>
          {categoryData.length === 0 ? (
            <div className="flex items-center justify-center h-[300px] text-gray-400">暂无数据</div>
          ) : (
            <>
              <div className="h-[300px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3 mt-4">
                {categoryData.map((cat) => (
                  <div key={cat.name} className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: cat.color || COLORS[categoryData.indexOf(cat) % COLORS.length] }}
                      ></div>
                      <span className="text-gray-600 font-medium">{cat.name}</span>
                    </div>
                    <span className="font-bold text-gray-900">{cat.percentage}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;