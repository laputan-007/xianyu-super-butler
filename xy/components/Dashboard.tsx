import React, { useEffect, useState } from 'react';
import { AdminStats, OrderAnalytics } from '../types';
import { getAdminStats, getOrderAnalytics, getValidOrders } from '../services/api';
import { TrendingUp, Users, ShoppingCart, AlertCircle, DollarSign, Activity, Package, ArrowUpRight, Calendar, X, MapPin, BarChart3, PieChart } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell } from 'recharts';

const COLORS = ['#FFE815', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#F97316'];

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

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [analytics, setAnalytics] = useState<OrderAnalytics | null>(null);
  const [timeRange, setTimeRange] = useState<'today' | 'yesterday' | '3days' | '7days' | '30days' | 'custom'>('7days');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [validOrders, setValidOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const getDateRange = () => {
    const today = new Date();
    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    switch (timeRange) {
      case 'today':
        return { start_date: formatDate(today), end_date: formatDate(today) };
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        return { start_date: formatDate(yesterday), end_date: formatDate(yesterday) };
      case '3days':
        const threeDaysAgo = new Date(today);
        threeDaysAgo.setDate(today.getDate() - 3);
        return { start_date: formatDate(threeDaysAgo), end_date: formatDate(today) };
      case '7days':
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);
        return { start_date: formatDate(sevenDaysAgo), end_date: formatDate(today) };
      case '30days':
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        return { start_date: formatDate(thirtyDaysAgo), end_date: formatDate(today) };
      case 'custom':
        return { start_date: customStart, end_date: customEnd };
      default:
        return { start_date: formatDate(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)), end_date: formatDate(today) };
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const statsData = await getAdminStats();
      setStats(statsData);

      const dateRange = getDateRange();
      const analyticsData = await getOrderAnalytics(dateRange);
      setAnalytics(analyticsData);
    } catch (error) {
      console.error('加载数据失败', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [timeRange, customStart, customEnd]);

  const loadReportData = async () => {
    const dateRange = getDateRange();
    const orders = await getValidOrders(dateRange);
    setValidOrders(orders);
    setShowReportModal(true);
  };

  if (loading && !stats && !analytics) {
    return <div className="p-8 flex justify-center text-gray-400"><Activity className="w-8 h-8 animate-spin text-[#FFE815]" /></div>;
  }

  const chartData = analytics?.daily_stats?.map(d => ({
      name: d.date.slice(5), // MM-DD
      amount: d.amount
  })) || [];

  const statusChartData = analytics?.status_stats?.map((s, i) => ({
    name: s.status,
    value: s.count,
    color: COLORS[i % COLORS.length]
  })) || [];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
          <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">运营概览</h2>
          <p className="text-gray-500 mt-2 text-base">欢迎回来，以下是闲鱼店铺的实时经营数据</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Time Range Selector */}
          <div className="flex items-center gap-2 bg-white rounded-xl p-1 shadow-sm border border-gray-100">
            {[
              { key: 'today', label: '今天' },
              { key: 'yesterday', label: '昨天' },
              { key: '3days', label: '三天' },
              { key: '7days', label: '7天' },
              { key: '30days', label: '一个月' },
            ].map((range) => (
              <button
                key={range.key}
                onClick={() => setTimeRange(range.key as any)}
                className={`px-3 py-2 text-sm font-bold rounded-lg transition-all ${
                  timeRange === range.key
                    ? 'bg-[#FFE815] text-black shadow-md'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {range.label}
              </button>
            ))}
            <button
              onClick={() => setTimeRange('custom')}
              className={`px-3 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-1 ${
                timeRange === 'custom'
                  ? 'bg-[#FFE815] text-black shadow-md'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Calendar className="w-4 h-4" />
              自定义
            </button>
          </div>
          <div className="text-sm font-bold text-gray-700 bg-white px-5 py-2.5 rounded-full shadow-sm border border-gray-100 flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></span>
            运行正常
          </div>
        </div>
      </div>

      {/* Custom Date Range */}
      {timeRange === 'custom' && (
        <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-gray-200">
          <span className="text-sm font-bold text-gray-700">选择日期范围：</span>
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="ios-input px-3 py-2 rounded-lg text-sm"
          />
          <span className="text-gray-400">至</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="ios-input px-3 py-2 rounded-lg text-sm"
          />
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="累计营收 (CNY)"
          value={`¥${analytics?.revenue_stats.total_amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) || '0.00'}`}
          icon={DollarSign}
          colorClass="bg-yellow-400"
          trend="+12%"
        />
        <StatCard
          title="活跃账号 / 总数"
          value={`${stats?.active_cookies || 0} / ${stats?.total_cookies || 0}`}
          icon={Users}
          colorClass="bg-blue-500"
        />
        <StatCard
          title="累计订单数"
          value={(analytics?.revenue_stats.total_orders || 0).toLocaleString()}
          icon={ShoppingCart}
          colorClass="bg-orange-500"
          trend="新订单"
        />
        <StatCard
          title="库存卡密余量"
          value={stats?.total_cards || 0}
          icon={Package}
          colorClass="bg-purple-500"
        />
      </div>

      {/* Main Chart Section */}
      <div className="ios-card p-8 rounded-[2rem]">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h3 className="text-xl font-bold text-gray-900">营收趋势分析</h3>
            <p className="text-sm text-gray-400 mt-1">选定时间范围的销售额走势</p>
          </div>
          <button
            onClick={loadReportData}
            className="flex items-center gap-2 text-sm font-bold text-white bg-black px-6 py-3 rounded-xl hover:bg-gray-800 transition-colors shadow-lg"
          >
            <BarChart3 className="w-4 h-4" />
            查看详细报表
          </button>
        </div>
        <div className="h-[350px] w-full">
          {chartData.length > 0 ? (
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
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              <p>暂无数据</p>
            </div>
          )}
        </div>
      </div>

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-fade-in p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-6xl shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white z-10 p-8 border-b border-gray-100 rounded-t-[2.5rem]">
              <button
                onClick={() => setShowReportModal(false)}
                className="absolute top-6 right-6 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
              <h2 className="text-3xl font-extrabold text-gray-900">详细报表分析</h2>
              <p className="text-gray-500 mt-2">
                数据期间：{getDateRange().start_date} 至 {getDateRange().end_date}
              </p>
            </div>

            <div className="p-8 space-y-8">
              {/* Revenue Overview */}
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-yellow-500" />
                  收益总览
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-yellow-50 to-orange-50 p-6 rounded-2xl border border-yellow-200">
                    <p className="text-sm text-gray-600 mb-2">期间总收益</p>
                    <p className="text-3xl font-extrabold text-yellow-700">
                      ¥{analytics?.revenue_stats.total_amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-6 rounded-2xl">
                    <p className="text-sm text-gray-600 mb-2">平均客单价</p>
                    <p className="text-2xl font-bold text-gray-900">
                      ¥{analytics?.revenue_stats.avg_amount.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-6 rounded-2xl">
                    <p className="text-sm text-gray-600 mb-2">独立买家</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {analytics?.revenue_stats.unique_buyers}
                    </p>
                  </div>
                  <div className="bg-gray-50 p-6 rounded-2xl">
                    <p className="text-sm text-gray-600 mb-2">独立商品</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {analytics?.revenue_stats.unique_items}
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Distribution */}
              {statusChartData.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-blue-500" />
                    订单状态分布
                  </h3>
                  <div className="bg-gray-50 p-6 rounded-2xl grid md:grid-cols-2 gap-6">
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <RePieChart>
                          <Pie
                            data={statusChartData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {statusChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </RePieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-3">
                      {analytics?.status_stats.map((stat, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-white rounded-xl">
                          <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            <span className="font-medium text-gray-900">{stat.status}</span>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-gray-900">{stat.count}单</div>
                            <div className="text-sm text-gray-500">¥{stat.amount.toFixed(2)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* City Distribution */}
              {analytics && analytics.city_stats && analytics.city_stats.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-green-500" />
                    地区分布 TOP 10
                  </h3>
                  <div className="bg-gray-50 p-6 rounded-2xl space-y-3">
                    {analytics.city_stats.slice(0, 10).map((city, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-white rounded-xl">
                        <div className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${i < 3 ? 'bg-gradient-to-br from-yellow-400 to-orange-500' : 'bg-gray-400'}`}>
                            {i + 1}
                          </span>
                          <span className="font-medium text-gray-900">{city.city}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-gray-900">{city.order_count}单</div>
                          <div className="text-sm text-gray-500">¥{city.total_amount.toFixed(2)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Item Ranking */}
              {analytics && analytics.item_stats && analytics.item_stats.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Package className="w-5 h-5 text-purple-500" />
                    商品排行 TOP 10
                  </h3>
                  <div className="bg-gray-50 p-6 rounded-2xl overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-sm font-bold text-gray-600 border-b border-gray-200">
                          <th className="pb-3">排名</th>
                          <th className="pb-3">商品ID</th>
                          <th className="pb-3 text-right">订单数</th>
                          <th className="pb-3 text-right">总金额</th>
                          <th className="pb-3 text-right">平均金额</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {analytics.item_stats.slice(0, 10).map((item, i) => (
                          <tr key={i} className="text-sm">
                            <td className="py-3">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${i < 3 ? 'bg-gradient-to-br from-yellow-400 to-orange-500' : 'bg-gray-400'}`}>
                                {i + 1}
                              </span>
                            </td>
                            <td className="py-3 font-mono text-xs">{item.item_id}</td>
                            <td className="py-3 text-right font-medium">{item.order_count}</td>
                            <td className="py-3 text-right font-bold text-yellow-700">¥{item.total_amount.toFixed(2)}</td>
                            <td className="py-3 text-right text-gray-600">¥{item.avg_amount.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
