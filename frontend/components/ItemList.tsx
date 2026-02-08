import React, { useEffect, useState } from 'react';
import { Item, AccountDetail } from '../types';
import { getItems, getAccountDetails, syncItemsFromAccount, deleteItem, createItem, updateItem } from '../services/api';
import { Box, RefreshCw, ShoppingBag, Trash2, Loader2, Plus, Edit2, X, Save } from 'lucide-react';

const ItemList: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [accounts, setAccounts] = useState<AccountDetail[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [form, setForm] = useState({
    item_title: '',
    item_price: 0,
    item_image: '',
    is_multi_spec: false
  });

  useEffect(() => {
    getAccountDetails().then(setAccounts);
    getItems().then(setItems);
  }, []);

  const handleSync = async () => {
      if (!selectedAccount) return alert('请先选择账号');
      setLoading(true);
      await syncItemsFromAccount(selectedAccount);
      getItems().then(setItems);
      setLoading(false);
  };

  const handleDelete = async (cookieId: string, itemId: string) => {
    if (!confirm('确认删除该商品吗？')) return;
    try {
      await deleteItem(cookieId, itemId);
      getItems().then(setItems);
      alert('删除成功！');
    } catch (e) {
      alert('删除失败：' + (e as Error).message);
    }
  };

  const handleAdd = () => {
    if (!selectedAccount) return alert('请先选择账号');
    setEditingItem(null);
    setForm({
      item_title: '',
      item_price: 0,
      item_image: '',
      is_multi_spec: false
    });
    setShowModal(true);
  };

  const handleEdit = (item: Item) => {
    setEditingItem(item);
    setForm({
      item_title: item.item_title,
      item_price: item.item_price,
      item_image: item.item_image || '',
      is_multi_spec: item.is_multi_spec
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      if (editingItem) {
        await updateItem(editingItem.cookie_id, editingItem.item_id, form);
      } else {
        await createItem(selectedAccount, form);
      }
      setShowModal(false);
      getItems().then(setItems);
      alert('保存成功！');
    } catch (e) {
      alert('保存失败：' + (e as Error).message);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">商品管理</h2>
          <p className="text-gray-500 mt-2 text-sm">监控并管理所有账号下的闲鱼商品。</p>
        </div>
        <div className="flex gap-3">
            <select
                className="ios-input px-4 py-2 rounded-xl text-sm"
                value={selectedAccount}
                onChange={e => setSelectedAccount(e.target.value)}
            >
                <option value="">选择账号以同步</option>
                {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.nickname}</option>
                ))}
            </select>
            <button
                onClick={handleAdd}
                disabled={!selectedAccount}
                className="ios-btn-primary flex items-center gap-2 px-6 py-2 rounded-full font-medium shadow-lg shadow-yellow-200 disabled:opacity-50"
            >
                <Plus className="w-4 h-4" />
                新增商品
            </button>
            <button
                onClick={handleSync}
                disabled={loading || !selectedAccount}
                className="ios-btn-primary flex items-center gap-2 px-6 py-2 rounded-full font-medium shadow-lg shadow-blue-500/30 disabled:opacity-50"
            >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                同步商品
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {items.map(item => (
              <div key={`${item.cookie_id}-${item.item_id}`} className="ios-card p-4 rounded-3xl hover:shadow-lg transition-all group">
                  <div className="aspect-square bg-gray-100 rounded-2xl mb-4 overflow-hidden relative">
                      {item.item_image ? (
                          <img src={item.item_image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300">
                              <Box className="w-10 h-10" />
                          </div>
                      )}
                      <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-md text-white text-xs font-bold px-2 py-1 rounded-lg">
                          ¥{item.item_price}
                      </div>
                  </div>
                  <h3 className="font-bold text-gray-900 line-clamp-2 text-sm mb-2 h-10">{item.item_title}</h3>
                  <div className="flex justify-between items-center text-xs">
                      <div className="flex-1 flex items-center gap-2 text-gray-500">
                        <span className="bg-gray-100 px-2 py-1 rounded-md text-xs truncate">ID: {item.item_id.substring(0, 8)}</span>
                        <span className="text-xs">{item.is_multi_spec ? '多规格' : '单规格'}</span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEdit(item)}
                          className="p-1.5 bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100 transition-colors flex-shrink-0"
                          title="编辑"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.cookie_id, item.item_id)}
                          className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors flex-shrink-0"
                          title="删除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                  </div>
              </div>
          ))}
          {items.length === 0 && (
             <div className="col-span-full py-20 text-center text-gray-400">
                 <ShoppingBag className="w-12 h-12 mx-auto mb-4 opacity-30" />
                 暂无商品数据，请选择账号进行同步
             </div>
          )}
      </div>
    </div>
  );
};

export default ItemList;