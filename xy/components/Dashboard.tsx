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
  const [showReportModal, setShowReportModal] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const loadAnalytics = (range: TimeRange) => {
    let days = 7;
    const today = new Date();

    switch (range) {
      case 'today':
        days = 1;
        break;
      case 'yesterday':
        days = 1;
        break;
      case '3days':
        days = 3;
        break;
      case '7days':
        days = 7;
        break;
      case '30days':
        days = 30;
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          const start = new Date(customStartDate);
          const end = new Date(customEndDate);
          days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        } else {
          days = 7;
        }
        break;
    }

    getOrderAnalytics(days).then(setAnalytics).catch(console.error);
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
          <button
            onClick={() => setShowReportModal(true)}
            className="ios-btn-primary px-6 py-3 rounded-2xl font-bold shadow-lg shadow-yellow-200 text-sm flex items-center gap-2"
          >
            <ArrowUpRight className="w-4 h-4" />
            查看报表
          </button>
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

      {/* 详细报表弹窗 */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden animate-slide-up">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-[#FFFDE7] to-white">
              <div>
                <h3 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
                  <BarChart3 className="w-6 h-6 text-[#FFE815]" />
                  详细BI数据报表
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {timeRange === 'custom'
                    ? `${customStartDate} 至 ${customEndDate}`
                    : timeRangeOptions.find(o => o.key === timeRange)?.label}
                </p>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)] space-y-6">
              {/* 统计概览卡片 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-yellow-50 to-white p-4 rounded-2xl border border-yellow-100">
                  <div className="text-sm text-gray-500 font-medium">总营收</div>
                  <div className="text-2xl font-extrabold text-gray-900 mt-1">
                    ¥{analytics.revenue_stats.total_amount.toFixed(2)}
                  </div>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-white p-4 rounded-2xl border border-blue-100">
                  <div className="text-sm text-gray-500 font-medium">总订单数</div>
                  <div className="text-2xl font-extrabold text-gray-900 mt-1">
                    {analytics.revenue_stats.total_orders}
                  </div>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-white p-4 rounded-2xl border border-green-100">
                  <div className="text-sm text-gray-500 font-medium">客单价</div>
                  <div className="text-2xl font-extrabold text-gray-900 mt-1">
                    ¥{analytics.revenue_stats.total_orders > 0
                      ? (analytics.revenue_stats.total_amount / analytics.revenue_stats.total_orders).toFixed(2)
                      : '0.00'}
                  </div>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-white p-4 rounded-2xl border border-purple-100">
                  <div className="text-sm text-gray-500 font-medium">日均营收</div>
                  <div className="text-2xl font-extrabold text-gray-900 mt-1">
                    ¥{(analytics.revenue_stats.total_amount / (analytics.daily_stats?.length || 1)).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* 营收趋势图 */}
              <div className="ios-card p-6 rounded-2xl">
                <h4 className="text-lg font-bold text-gray-900 mb-4">营收趋势</h4>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorAmount2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#FFE815" stopOpacity={0.5}/>
                          <stop offset="95%" stopColor="#FFE815" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 12}} dy={15} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 12}} />
                      <CartesianGrid vertical={false} stroke="#F3F4F6" strokeDasharray="3 3" />
                      <Tooltip
                        contentStyle={{ background: '#1A1A1A', borderRadius: '12px', border: 'none' }}
                        itemStyle={{ color: '#FFE815' }}
                        labelStyle={{ color: '#888' }}
                      />
                      <Area type="monotone" dataKey="amount" stroke="#FACC15" strokeWidth={3} fillOpacity={1} fill="url(#colorAmount2)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 订单数量柱状图 */}
              <div className="ios-card p-6 rounded-2xl">
                <h4 className="text-lg font-bold text-gray-900 mb-4">每日订单量</h4>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 12}} dy={15} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 12}} />
                      <CartesianGrid vertical={false} stroke="#F3F4F6" strokeDasharray="3 3" />
                      <Tooltip
                        contentStyle={{ background: '#1A1A1A', borderRadius: '12px', border: 'none' }}
                        itemStyle={{ color: '#FFE815' }}
                        labelStyle={{ color: '#888' }}
                      />
                      <Bar dataKey="orders" fill="#3B82F6" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 详细数据表格 */}
              <div className="ios-card p-6 rounded-2xl">
                <h4 className="text-lg font-bold text-gray-900 mb-4">每日明细</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="pb-3 text-sm font-bold text-gray-500">日期</th>
                        <th className="pb-3 text-sm font-bold text-gray-500">订单数</th>
                        <th className="pb-3 text-sm font-bold text-gray-500">营收金额</th>
                        <th className="pb-3 text-sm font-bold text-gray-500">客单价</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.daily_stats?.map((day, index) => (
                        <tr key={index} className="border-b border-gray-50 last:border-0">
                          <td className="py-3 text-sm font-medium text-gray-900">{day.date}</td>
                          <td className="py-3 text-sm text-gray-600">{day.order_count}</td>
                          <td className="py-3 text-sm font-bold text-gray-900">¥{day.amount.toFixed(2)}</td>
                          <td className="py-3 text-sm text-gray-600">
                            ¥{day.order_count > 0 ? (day.amount / day.order_count).toFixed(2) : '0.00'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;