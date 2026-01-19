import React, { useEffect, useState } from 'react';
import { Order, OrderStatus } from '../types';
import { getOrders, syncOrders, manualShipOrder, deleteOrder, updateOrder, importOrders } from '../services/api';
import { Search, MoreHorizontal, Truck, RefreshCw, Copy, ChevronLeft, ChevronRight, PackageCheck, Trash2, Eye, Edit2, X, Save, Upload, Plus } from 'lucide-react';

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
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

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

  const handleDelete = async (orderId: string) => {
    if (!confirm('确认删除该订单吗？')) return;
    try {
      await deleteOrder(orderId);
      loadOrders();
      alert('删除成功！');
    } catch (e) {
      alert('删除失败：' + (e as Error).message);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedOrders.length === 0) {
      alert('请先选择要删除的订单');
      return;
    }
    if (!confirm(`确认删除选中的 ${selectedOrders.length} 个订单吗？`)) return;
    try {
      await Promise.all(selectedOrders.map(id => deleteOrder(id)));
      setSelectedOrders([]);
      loadOrders();
      alert('批量删除成功！');
    } catch (e) {
      alert('批量删除失败：' + (e as Error).message);
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      alert('请选择文件');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      await importOrders(formData);
      setShowImportModal(false);
      setImportFile(null);
      loadOrders();
      alert('订单导入成功！');
    } catch (e) {
      alert('导入失败：' + (e as Error).message);
    }
  };

  const handleEdit = (order: Order) => {
    setEditingOrder(order);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingOrder) return;
    try {
      await updateOrder(editingOrder.order_id, editingOrder);
      setShowEditModal(false);
      loadOrders();
      alert('更新成功！');
    } catch (e) {
      alert('更新失败：' + (e as Error).message);
    }
  };

  const handleRefreshOrder = async (orderId: string) => {
    try {
      await updateOrder(orderId, {});
      loadOrders();
      alert('刷新成功！');
    } catch (e) {
      alert('刷新失败：' + (e as Error).message);
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
            {selectedOrders.length > 0 && (
              <button
                onClick={handleBatchDelete}
                className="px-4 py-3 rounded-2xl bg-red-50 text-red-600 hover:bg-red-100 font-bold text-sm flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                删除选中 ({selectedOrders.length})
              </button>
            )}
            <button onClick={loadOrders} className="p-3 rounded-2xl bg-white border border-gray-100 text-gray-600 hover:bg-gray-50 hover:text-black transition-colors shadow-sm">
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="px-6 py-3 rounded-2xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-bold text-sm flex items-center gap-2 shadow-sm"
            >
              <Upload className="w-5 h-5" />
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
                <th className="px-6 py-5 w-12">
                  <input
                    type="checkbox"
                    checked={orders.length > 0 && selectedOrders.length === orders.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedOrders(orders.map(o => o.order_id));
                      } else {
                        setSelectedOrders([]);
                      }
                    }}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                </th>
                <th className="px-6 py-5 w-1/3">商品信息</th>
                <th className="px-6 py-5">订单号 / 买家</th>
                <th className="px-6 py-5">实付金额</th>
                <th className="px-6 py-5">当前状态</th>
                <th className="px-6 py-5 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-[#FFFDE7]/50 transition-colors group">
                  <td className="px-6 py-5">
                    <input
                      type="checkbox"
                      checked={selectedOrders.includes(order.order_id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedOrders([...selectedOrders, order.order_id]);
                        } else {
                          setSelectedOrders(selectedOrders.filter(id => id !== order.order_id));
                        }
                      }}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 rounded-xl bg-gray-100 overflow-hidden shadow-sm border border-gray-100 flex-shrink-0">
                        {order.item_image ? (
                            <img src={order.item_image} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300"><PackageCheck /></div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-gray-900 line-clamp-1 text-sm">{order.item_title || `订单 ${order.order_id.substring(0, 12)}...`}</div>
                        <div className="text-xs text-gray-500 mt-1 font-medium">
                          ID: {order.order_id.substring(0, 8)}... • 数量: {order.quantity}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                      <div className="flex flex-col gap-1.5">
                          <div className="text-xs font-mono text-gray-400 flex items-center gap-1">
                              订单号 <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                          </div>
                          <div className="text-sm font-bold text-gray-900">{order.buyer_id}</div>
                          {order.receiver_name && (
                            <div className="text-xs text-gray-600">
                              {order.receiver_name} {order.receiver_phone && `• ${order.receiver_phone}`}
                            </div>
                          )}
                      </div>
                  </td>
                  <td className="px-6 py-5 text-base font-extrabold text-gray-900 font-feature-settings-tnum">¥{order.amount}</td>
                  <td className="px-6 py-5">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {order.status === 'pending_ship' && (
                        <button
                          onClick={() => handleShip(order.order_id)}
                          className="text-white bg-black hover:bg-gray-800 shadow-lg shadow-gray-200 text-xs font-bold px-4 py-2 rounded-xl transition-all active:scale-95"
                        >
                          立即发货
                        </button>
                      )}
                      <button
                        onClick={() => handleViewDetail(order)}
                        className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
                        title="查看详情"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(order)}
                        className="p-2 bg-yellow-50 text-yellow-700 rounded-xl hover:bg-yellow-100 transition-colors"
                        title="编辑"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRefreshOrder(order.order_id)}
                        className="p-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-colors"
                        title="刷新"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(order.order_id)}
                        className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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

      {/* Order Detail Modal */}
      {showDetailModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md animate-fade-in p-4">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-2xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowDetailModal(false)}
              className="absolute top-6 right-6 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>

            <h3 className="text-2xl font-extrabold text-gray-900 mb-6">订单详情</h3>

            <div className="space-y-6">
              {/* Order Info */}
              <div className="space-y-4">
                <h4 className="text-lg font-bold text-gray-800">订单信息</h4>
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">订单号</div>
                    <div className="font-mono text-sm font-bold text-gray-900">{selectedOrder.order_id}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">状态</div>
                    <StatusBadge status={selectedOrder.status} />
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">实付金额</div>
                    <div className="text-lg font-extrabold text-gray-900">¥{selectedOrder.amount}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">数量</div>
                    <div className="font-bold text-gray-900">{selectedOrder.quantity}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs text-gray-500 mb-1">创建时间</div>
                    <div className="text-sm font-medium text-gray-700">{selectedOrder.created_at}</div>
                  </div>
                </div>
              </div>

              {/* Item Info */}
              <div className="space-y-4">
                <h4 className="text-lg font-bold text-gray-800">商品信息</h4>
                <div className="p-4 bg-gray-50 rounded-xl flex items-center gap-4">
                  {selectedOrder.item_image && (
                    <img src={selectedOrder.item_image} alt="" className="w-20 h-20 rounded-xl object-cover border border-gray-200" />
                  )}
                  <div className="flex-1">
                    <div className="font-bold text-gray-900 mb-1">{selectedOrder.item_title || '未知商品'}</div>
                    <div className="text-sm text-gray-500">商品ID: {selectedOrder.item_id}</div>
                    {selectedOrder.item_price && (
                      <div className="text-sm text-gray-500 mt-1">标价: ¥{selectedOrder.item_price}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Buyer Info */}
              <div className="space-y-4">
                <h4 className="text-lg font-bold text-gray-800">买家信息</h4>
                <div className="p-4 bg-gray-50 rounded-xl space-y-3">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">买家ID</div>
                    <div className="font-bold text-gray-900">{selectedOrder.buyer_id}</div>
                  </div>
                  {selectedOrder.receiver_name && (
                    <div>
                      <div className="text-xs text-gray-500 mb-1">收货人</div>
                      <div className="font-medium text-gray-700">{selectedOrder.receiver_name}</div>
                    </div>
                  )}
                  {selectedOrder.receiver_phone && (
                    <div>
                      <div className="text-xs text-gray-500 mb-1">联系电话</div>
                      <div className="font-mono text-sm text-gray-700">{selectedOrder.receiver_phone}</div>
                    </div>
                  )}
                  {selectedOrder.receiver_address && (
                    <div>
                      <div className="text-xs text-gray-500 mb-1">收货地址</div>
                      <div className="text-sm text-gray-700">{selectedOrder.receiver_address}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowDetailModal(false)}
                className="flex-1 px-6 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold transition-colors"
              >
                关闭
              </button>
              {selectedOrder.status === 'pending_ship' && (
                <button
                  onClick={() => {
                    handleShip(selectedOrder.order_id);
                    setShowDetailModal(false);
                  }}
                  className="flex-1 px-6 py-3 rounded-xl ios-btn-primary font-bold shadow-lg shadow-yellow-200"
                >
                  立即发货
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md animate-fade-in p-4">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => setShowImportModal(false)}
              className="absolute top-6 right-6 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>

            <h3 className="text-2xl font-extrabold text-gray-900 mb-6">插入订单</h3>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">选择Excel文件</label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="w-full ios-input px-4 py-3 rounded-xl text-sm"
                />
                <p className="text-xs text-gray-500 mt-2">支持 .xlsx 和 .xls 格式</p>
              </div>

              {importFile && (
                <div className="p-3 bg-blue-50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Upload className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">{importFile.name}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowImportModal(false)}
                className="flex-1 px-6 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleImport}
                disabled={!importFile}
                className="flex-1 px-6 py-3 rounded-xl ios-btn-primary font-bold shadow-lg shadow-yellow-200 disabled:opacity-50"
              >
                导入订单
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md animate-fade-in p-4 overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-2xl w-full shadow-2xl relative my-8">
            <button
              onClick={() => setShowEditModal(false)}
              className="absolute top-6 right-6 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>

            <h3 className="text-2xl font-extrabold text-gray-900 mb-6">编辑订单</h3>

            <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">订单号</label>
                  <input
                    type="text"
                    value={editingOrder.order_id}
                    disabled
                    className="w-full ios-input px-4 py-3 rounded-xl bg-gray-50 text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">订单状态</label>
                  <select
                    value={editingOrder.status}
                    onChange={(e) => setEditingOrder({ ...editingOrder, status: e.target.value as OrderStatus })}
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">买家ID</label>
                  <input
                    type="text"
                    value={editingOrder.buyer_id}
                    onChange={(e) => setEditingOrder({ ...editingOrder, buyer_id: e.target.value })}
                    className="w-full ios-input px-4 py-3 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">实付金额</label>
                  <input
                    type="number"
                    value={editingOrder.amount}
                    onChange={(e) => setEditingOrder({ ...editingOrder, amount: parseFloat(e.target.value) })}
                    className="w-full ios-input px-4 py-3 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">收货人</label>
                  <input
                    type="text"
                    value={editingOrder.receiver_name || ''}
                    onChange={(e) => setEditingOrder({ ...editingOrder, receiver_name: e.target.value })}
                    className="w-full ios-input px-4 py-3 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">联系电话</label>
                  <input
                    type="text"
                    value={editingOrder.receiver_phone || ''}
                    onChange={(e) => setEditingOrder({ ...editingOrder, receiver_phone: e.target.value })}
                    className="w-full ios-input px-4 py-3 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">收货地址</label>
                <textarea
                  value={editingOrder.receiver_address || ''}
                  onChange={(e) => setEditingOrder({ ...editingOrder, receiver_address: e.target.value })}
                  rows={2}
                  className="w-full ios-input px-4 py-3 rounded-xl resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">商品标题</label>
                <input
                  type="text"
                  value={editingOrder.item_title || ''}
                  onChange={(e) => setEditingOrder({ ...editingOrder, item_title: e.target.value })}
                  className="w-full ios-input px-4 py-3 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">商品ID</label>
                  <input
                    type="text"
                    value={editingOrder.item_id}
                    onChange={(e) => setEditingOrder({ ...editingOrder, item_id: e.target.value })}
                    className="w-full ios-input px-4 py-3 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">数量</label>
                  <input
                    type="number"
                    value={editingOrder.quantity}
                    onChange={(e) => setEditingOrder({ ...editingOrder, quantity: parseInt(e.target.value) })}
                    className="w-full ios-input px-4 py-3 rounded-xl"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-6 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex-1 px-6 py-3 rounded-xl ios-btn-primary font-bold shadow-lg shadow-yellow-200 flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                保存修改
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderList;