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

  const loadAnalytics = (range: TimeRange) => {
    const today = new Date();
    let params: { start_date: string; end_date: string };

    switch (range) {
      case 'today':
        // 今天：从今天00:00:00到今天23:59:59
        params = {
          start_date: today.toISOString().split('T')[0],
          end_date: today.toISOString().split('T')[0]
        };
        break;
      case 'yesterday':
        // 昨天：从昨天00:00:00到昨天23:59:59
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        params = {
          start_date: yesterday.toISOString().split('T')[0],
          end_date: yesterday.toISOString().split('T')[0]
        };
        break;
      case '3days':
        // 3天：从3天前到今天
        const threeDaysAgo = new Date(today);
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        params = {
          start_date: threeDaysAgo.toISOString().split('T')[0],
          end_date: today.toISOString().split('T')[0]
        };
        break;
      case '7days':
        // 7天：从7天前到今天
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        params = {
          start_date: sevenDaysAgo.toISOString().split('T')[0],
          end_date: today.toISOString().split('T')[0]
        };
        break;
      case '30days':
        // 30天：从30天前到今天
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        params = {
          start_date: thirtyDaysAgo.toISOString().split('T')[0],
          end_date: today.toISOString().split('T')[0]
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
          const defaultDaysAgo = new Date(today);
          defaultDaysAgo.setDate(defaultDaysAgo.getDate() - 7);
          params = {
            start_date: defaultDaysAgo.toISOString().split('T')[0],
            end_date: today.toISOString().split('T')[0]
          };
        }
        break;
      default:
        // 默认7天
        const defaultStart = new Date(today);
        defaultStart.setDate(defaultStart.getDate() - 7);
        params = {
          start_date: defaultStart.toISOString().split('T')[0],
          end_date: today.toISOString().split('T')[0]
        };
    }

    getOrderAnalytics(params).then(setAnalytics).catch(console.error);
  };

  useEffect(() => {
    getAdminStats().then(setStats).catch(console.error);
    loadAnalytics(timeRange);
  }, [timeRange]);

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
          <a
            href="/report"
            target="_blank"
            rel="noopener noreferrer"
            className="ios-btn-primary px-6 py-3 rounded-2xl font-bold shadow-lg shadow-yellow-200 text-sm flex items-center gap-2 cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4" />
            查看报表
          </a>
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
          trend="+12%"
        />
        <StatCard 
          title="活跃账号 / 总数" 
          value={`${stats.active_cookies} / ${stats.total_cookies}`} 
          icon={Users} 
          colorClass="bg-blue-500"
        />
        <StatCard 
          title="累计订单数" 
          value={stats.total_orders.toLocaleString()} 
          icon={ShoppingCart} 
          colorClass="bg-orange-500"
          trend="新订单"
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
        <div className="flex justify-between items-center mb-10">
          <div>
            <h3 className="text-xl font-bold text-gray-900">营收趋势分析</h3>
            <p className="text-sm text-gray-400 mt-1">最近7天的销售额走势</p>
          </div>
          <button className="flex items-center gap-1 text-sm font-bold text-gray-900 bg-[#F7F8FA] px-4 py-2 rounded-xl hover:bg-[#FFE815] transition-colors">
              查看报表 <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
        <div className="h-[350px] w-full">
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
        </div>
      </div>
    </div>
  );
};

export default Dashboard;