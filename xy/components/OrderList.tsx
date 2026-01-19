import React, { useEffect, useState } from 'react';
import { Order, OrderStatus } from '../types';
import { getOrders, syncOrders, manualShipOrder, updateOrder, importOrders } from '../services/api';
import { Search, MoreHorizontal, Truck, RefreshCw, Copy, ChevronLeft, ChevronRight, PackageCheck, Edit, Eye, Plus, Save, X, User as UserIcon, Phone, MapPin } from 'lucide-react';

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
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editForm, setEditForm] = useState<Partial<Order>>({});
  const [importText, setImportText] = useState('');

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

  const handleViewDetail = (order: Order) => {
    setSelectedOrder(order);
    setShowDetailModal(true);
  };

  const handleEdit = (order: Order) => {
    setSelectedOrder(order);
    setEditForm({ ...order });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedOrder) return;
    try {
      await updateOrder(selectedOrder.order_id, editForm);
      setShowEditModal(false);
      loadOrders();
    } catch (error) {
      console.error('更新订单失败:', error);
      alert('更新失败，请重试');
    }
  };

  const handleImportOrders = async () => {
    try {
      const orders = JSON.parse(importText);
      await importOrders(Array.isArray(orders) ? orders : [orders]);
      setShowImportModal(false);
      setImportText('');
      loadOrders();
      alert('订单导入成功');
    } catch (error) {
      alert('导入失败，请检查JSON格式');
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
            <button
              onClick={() => setShowImportModal(true)}
              className="px-5 py-3 rounded-2xl font-bold bg-gray-900 text-white hover:bg-gray-800 transition-colors text-sm flex items-center gap-2 shadow-lg"
            >
              <Plus className="w-4 h-4" />
              插入订单
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
                <th className="px-8 py-5 w-1/3">订单信息</th>
                <th className="px-6 py-5">买家信息</th>
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
                        <div className="text-xs text-gray-500 mt-1 font-medium">订单ID: {order.order_id}</div>
                        <div className="text-xs text-gray-400 mt-0.5">数量: {order.quantity} • {order.created_at}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                      <div className="flex flex-col gap-1">
                          <div className="text-sm font-bold text-gray-800">{order.buyer_id}</div>
                          <div className="text-xs text-gray-500">{order.buyer_name || '-'}</div>
                          <div className="text-xs text-gray-400">{order.buyer_phone || '-'}</div>
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
                            className="mr-2 text-white bg-black hover:bg-gray-800 shadow-lg shadow-gray-200 text-xs font-bold px-3 py-2 rounded-xl transition-all active:scale-95"
                        >
                            立即发货
                        </button>
                    )}
                    <button
                      onClick={() => handleViewDetail(order)}
                      className="mr-2 text-gray-400 hover:text-blue-600 p-2 rounded-xl hover:bg-blue-50 transition-colors"
                      title="查看详情"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleEdit(order)}
                      className="text-gray-400 hover:text-black p-2 rounded-xl hover:bg-gray-100 transition-colors"
                      title="编辑订单"
                    >
                      <Edit className="w-4 h-4" />
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

      {/* 订单详情弹窗 */}
      {showDetailModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4">
          <div className="bg-white rounded-[2rem] p-8 max-w-2xl w-full shadow-2xl animate-slide-up flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
              <h3 className="text-2xl font-extrabold text-gray-900">订单详情</h3>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-6 -mr-2 pr-2">
              {/* 商品信息 */}
              <div className="p-4 bg-gray-50 rounded-2xl">
                <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <PackageCheck className="w-4 h-4" />
                  商品信息
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">商品标题:</span>
                    <div className="font-medium text-gray-900 mt-1">{selectedOrder.item_title || '-'}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">商品ID:</span>
                    <div className="font-mono text-gray-900 mt-1">{selectedOrder.item_id || '-'}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">数量:</span>
                    <div className="font-medium text-gray-900 mt-1">{selectedOrder.quantity}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">规格:</span>
                    <div className="font-medium text-gray-900 mt-1">{selectedOrder.spec_name || '-'}</div>
                  </div>
                </div>
              </div>

              {/* 订单信息 */}
              <div className="p-4 bg-blue-50 rounded-2xl">
                <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <Truck className="w-4 h-4" />
                  订单信息
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">订单ID:</span>
                    <div className="font-mono text-gray-900 mt-1">{selectedOrder.order_id}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">订单状态:</span>
                    <div className="mt-1"><StatusBadge status={selectedOrder.status} /></div>
                  </div>
                  <div>
                    <span className="text-gray-500">实付金额:</span>
                    <div className="font-extrabold text-gray-900 mt-1">¥{selectedOrder.amount}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">创建时间:</span>
                    <div className="font-medium text-gray-900 mt-1">{selectedOrder.created_at}</div>
                  </div>
                </div>
              </div>

              {/* 买家信息 */}
              <div className="p-4 bg-green-50 rounded-2xl">
                <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <UserIcon className="w-4 h-4" />
                  买家信息
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">买家ID:</span>
                    <div className="font-medium text-gray-900 mt-1">{selectedOrder.buyer_id || '-'}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">姓名:</span>
                    <div className="font-medium text-gray-900 mt-1">{selectedOrder.buyer_name || '-'}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">手机:</span>
                    <div className="font-medium text-gray-900 mt-1 flex items-center gap-2">
                      {selectedOrder.buyer_phone || '-'}
                      {selectedOrder.buyer_phone && <Copy className="w-3 h-3 cursor-pointer hover:text-black" />}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">地址:</span>
                    <div className="font-medium text-gray-900 mt-1">{selectedOrder.buyer_address || '-'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 编辑订单弹窗 */}
      {showEditModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4">
          <div className="bg-white rounded-[2rem] p-8 max-w-2xl w-full shadow-2xl animate-slide-up flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
              <h3 className="text-2xl font-extrabold text-gray-900">编辑订单</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 -mr-2 pr-2 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">商品ID</label>
                  <input
                    type="text"
                    value={editForm.item_id || ''}
                    onChange={(e) => setEditForm({ ...editForm, item_id: e.target.value })}
                    className="w-full ios-input px-4 py-3 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">买家ID</label>
                  <input
                    type="text"
                    value={editForm.buyer_id || ''}
                    onChange={(e) => setEditForm({ ...editForm, buyer_id: e.target.value })}
                    className="w-full ios-input px-4 py-3 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">规格名称</label>
                  <input
                    type="text"
                    value={editForm.spec_name || ''}
                    onChange={(e) => setEditForm({ ...editForm, spec_name: e.target.value })}
                    className="w-full ios-input px-4 py-3 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">规格值</label>
                  <input
                    type="text"
                    value={editForm.spec_value || ''}
                    onChange={(e) => setEditForm({ ...editForm, spec_value: e.target.value })}
                    className="w-full ios-input px-4 py-3 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">数量</label>
                  <input
                    type="number"
                    value={editForm.quantity || 1}
                    onChange={(e) => setEditForm({ ...editForm, quantity: parseInt(e.target.value) })}
                    className="w-full ios-input px-4 py-3 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">金额</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.amount || 0}
                    onChange={(e) => setEditForm({ ...editForm, amount: parseFloat(e.target.value) })}
                    className="w-full ios-input px-4 py-3 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">订单状态</label>
                <select
                  value={editForm.status || 'processing'}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value as OrderStatus })}
                  className="w-full ios-input px-4 py-3 rounded-xl"
                >
                  <option value="processing">处理中</option>
                  <option value="pending_ship">待发货</option>
                  <option value="shipped">已发货</option>
                  <option value="completed">已完成</option>
                  <option value="cancelled">已取消</option>
                  <option value="refunding">退款中</option>
                </select>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  收货人信息
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">姓名</label>
                    <input
                      type="text"
                      value={editForm.buyer_name || ''}
                      onChange={(e) => setEditForm({ ...editForm, buyer_name: e.target.value })}
                      className="w-full ios-input px-4 py-3 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">手机</label>
                    <input
                      type="text"
                      value={editForm.buyer_phone || ''}
                      onChange={(e) => setEditForm({ ...editForm, buyer_phone: e.target.value })}
                      className="w-full ios-input px-4 py-3 rounded-xl"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-bold text-gray-700 mb-2">地址</label>
                  <textarea
                    value={editForm.buyer_address || ''}
                    onChange={(e) => setEditForm({ ...editForm, buyer_address: e.target.value })}
                    className="w-full ios-input px-4 py-3 rounded-xl h-24 resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-6 py-3 rounded-xl font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 ios-btn-primary px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  保存更改
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 导入订单弹窗 */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4">
          <div className="bg-white rounded-[2rem] p-8 max-w-lg w-full shadow-2xl animate-slide-up flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
              <h3 className="text-2xl font-extrabold text-gray-900">导入订单</h3>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto -mr-2 pr-2">
              <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">订单数据 (JSON格式)</label>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder='[{"order_id": "123", "item_title": "商品", "buyer_id": "user123", "amount": 99.99, ...}]'
                  className="w-full ios-input px-4 py-3 rounded-xl h-48 resize-none font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-2">
                  支持单个订单对象或订单数组，JSON格式
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="flex-1 px-6 py-3 rounded-xl font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleImportOrders}
                  className="flex-1 ios-btn-primary px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  导入订单
                </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderList;
