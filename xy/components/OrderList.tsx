import React, { useEffect, useState } from 'react';
import { Order, OrderStatus } from '../types';
import { getOrders, syncOrders, manualShipOrder } from '../services/api';
import { Search, MoreHorizontal, Truck, RefreshCw, Copy, ChevronLeft, ChevronRight, PackageCheck } from 'lucide-react';

const StatusBadge: React.FC<{ status: OrderStatus }> = ({ status }) => {
  const styles = {
    processing: 'bg-yellow-100 text-yellow-800',
    pending_ship: 'bg-[#FFE815] text-black',
    shipped: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-gray-100 text-gray-500',
    refunding: 'bg-red-100 text-red-600',
  };

  const labels = {
    processing: '处理中',
    pending_ship: '待发货',
    shipped: '已发货',
    completed: '已完成',
    cancelled: '已取消',
    refunding: '退款中',
  };

  return (
    <span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${styles[status] || styles.cancelled}`}>
      {labels[status] || status}
    </span>
  );
};

const OrderList: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const loadOrders = () => {
      setLoading(true);
      getOrders(undefined, filter, page).then((res) => {
          setOrders(res.data);
          setTotalPages(res.total_pages);
          setLoading(false);
      }).catch(() => setLoading(false));
  };

  useEffect(() => {
    loadOrders();
  }, [filter, page]);

  const handleSync = async () => {
      setLoading(true);
      await syncOrders();
      loadOrders();
  };

  const handleShip = async (id: string) => {
      if(confirm('确认立即执行自动发货匹配吗？')) {
          await manualShipOrder([id], 'auto_match');
          loadOrders();
      }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
          <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">订单中心</h2>
          <p className="text-gray-500 mt-2 font-medium">查看所有闲鱼交易记录与状态。</p>
        </div>
        <div className="flex items-center gap-3">
            <button onClick={loadOrders} className="p-3 rounded-2xl bg-white border border-gray-100 text-gray-600 hover:bg-gray-50 hover:text-black transition-colors shadow-sm">
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={handleSync} className="ios-btn-primary px-6 py-3 rounded-2xl font-bold shadow-lg shadow-yellow-200 text-sm flex items-center gap-2">
                <Truck className="w-5 h-5" />
                一键同步订单
            </button>
        </div>
      </div>

      <div className="ios-card rounded-[2rem] overflow-hidden shadow-lg border-0 bg-white">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-50 flex flex-col md:flex-row gap-4 justify-between items-center bg-[#FAFAFA]">
          <div className="flex gap-1 p-1 bg-gray-200/50 rounded-xl overflow-x-auto max-w-full">
             {[
                 {k:'all', v:'全部'}, 
                 {k:'pending_ship', v:'待发货'}, 
                 {k:'shipped', v:'已发货'}, 
                 {k:'refunding', v:'售后'}
             ].map(opt => (
                 <button 
                    key={opt.k}
                    onClick={() => { setFilter(opt.k); setPage(1); }}
                    className={`px-5 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${filter === opt.k ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                 >
                    {opt.v}
                 </button>
             ))}
          </div>
          <div className="relative w-full md:w-auto group">
             <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#FFE815] transition-colors" />
             <input 
                 type="text" 
                 placeholder="搜索订单号..." 
                 className="ios-input pl-10 pr-4 py-2.5 rounded-xl w-64 bg-white border-none shadow-sm focus:ring-0"
             />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white text-gray-400 text-xs font-bold uppercase tracking-wider border-b border-gray-50">
                <th className="px-8 py-5 w-1/3">商品信息</th>
                <th className="px-6 py-5">订单号 / 买家</th>
                <th className="px-6 py-5">实付金额</th>
                <th className="px-6 py-5">当前状态</th>
                <th className="px-6 py-5 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-[#FFFDE7]/50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 rounded-xl bg-gray-100 overflow-hidden shadow-sm border border-gray-100 flex-shrink-0">
                        {order.item_image ? (
                            <img src={order.item_image} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300"><PackageCheck /></div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-gray-900 line-clamp-1 text-sm">{order.item_title || '未知商品'}</div>
                        <div className="text-xs text-gray-500 mt-1 font-medium">数量: {order.quantity} • {order.created_at}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                      <div className="flex flex-col gap-1">
                          <div className="text-xs font-mono text-gray-500 flex items-center gap-1 cursor-pointer hover:text-black font-medium">
                              {order.order_id} <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                          </div>
                          <div className="text-sm font-bold text-gray-800">{order.buyer_id}</div>
                      </div>
                  </td>
                  <td className="px-6 py-5 text-base font-extrabold text-gray-900 font-feature-settings-tnum">¥{order.amount}</td>
                  <td className="px-6 py-5">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="px-6 py-5 text-right">
                    {order.status === 'pending_ship' && (
                        <button 
                            onClick={() => handleShip(order.order_id)}
                            className="mr-3 text-white bg-black hover:bg-gray-800 shadow-lg shadow-gray-200 text-xs font-bold px-4 py-2 rounded-xl transition-all active:scale-95"
                        >
                            立即发货
                        </button>
                    )}
                    <button className="text-gray-400 hover:text-black p-2 rounded-xl hover:bg-gray-100 transition-colors">
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="p-4 border-t border-gray-50 flex items-center justify-between bg-white">
            <div className="text-sm text-gray-500 font-medium pl-2">
                第 {page} 页 / 共 {totalPages} 页
            </div>
            <div className="flex gap-2">
                <button 
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                    className="p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600 transition-colors"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <button 
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                    className="p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600 transition-colors"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default OrderList;