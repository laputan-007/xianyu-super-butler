import React, { useEffect, useState } from 'react';
import { AdminStats, OrderAnalytics } from '../types';
import { getAdminStats, getOrderAnalytics } from '../services/api';
import { TrendingUp, Users, ShoppingCart, AlertCircle, DollarSign, Activity, Package, ArrowUpRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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

  useEffect(() => {
    getAdminStats().then(setStats).catch(console.error);
    getOrderAnalytics(7).then(setAnalytics).catch(console.error);
  }, []);

  if (!stats || !analytics) return <div className="p-8 flex justify-center text-gray-400"><Activity className="w-8 h-8 animate-spin text-[#FFE815]" /></div>;

  const chartData = analytics.daily_stats?.map(d => ({
      name: d.date.slice(5), // MM-DD
      amount: d.amount
  })) || [];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
          <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">运营概览</h2>
          <p className="text-gray-500 mt-2 text-base">欢迎回来，以下是闲鱼店铺的实时经营数据。</p>
        </div>
        <div className="text-sm font-bold text-gray-700 bg-white px-5 py-2.5 rounded-full shadow-sm border border-gray-100 flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></span>
          系统正常运行
        </div>
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