import React, { useEffect, useState } from 'react';
import { Card } from '../types';
import { getCards, createCard, updateCard, deleteCard } from '../services/api';
import { Plus, CreditCard, Clock, FileText, Image as ImageIcon, Code, Edit, Trash2, Save, X, Eye, EyeOff, Package } from 'lucide-react';

const CardList: React.FC = () => {
  const [cards, setCards] = useState<Card[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [editForm, setEditForm] = useState<Partial<Card>>({});
  const [addForm, setAddForm] = useState({
    name: '',
    type: 'text' as 'text' | 'image' | 'api',
    content: '',
    description: '',
    enabled: true,
    delay_seconds: 0
  });

  useEffect(() => {
    getCards().then(setCards);
  }, []);

  const CardIcon = ({ type }: { type: string }) => {
      switch(type) {
          case 'text': return <FileText className="w-5 h-5 text-blue-500" />;
          case 'image': return <ImageIcon className="w-5 h-5 text-purple-500" />;
          case 'api': return <Code className="w-5 h-5 text-orange-500" />;
          default: return <CreditCard className="w-5 h-5 text-gray-500" />;
      }
  };

  const handleEdit = (card: Card) => {
    setSelectedCard(card);
    setEditForm({ ...card });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedCard) return;
    try {
      await updateCard(selectedCard.id, editForm);
      setShowEditModal(false);
      getCards().then(setCards);
    } catch (error) {
      console.error('更新卡密失败:', error);
      alert('更新失败，请重试');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('确认删除该卡密吗？')) {
      try {
        await deleteCard(id);
        getCards().then(setCards);
      } catch (error) {
        console.error('删除卡密失败:', error);
        alert('删除失败，请重试');
      }
    }
  };

  const handleAddCard = async () => {
    try {
      await createCard(addForm);
      setShowAddModal(false);
      setAddForm({
        name: '',
        type: 'text',
        content: '',
        description: '',
        enabled: true,
        delay_seconds: 0
      });
      getCards().then(setCards);
    } catch (error) {
      console.error('添加卡密失败:', error);
      alert('添加失败，请重试');
    }
  };

  const toggleCardStatus = async (card: Card) => {
    try {
      await updateCard(card.id, { ...card, enabled: !card.enabled });
      getCards().then(setCards);
    } catch (error) {
      console.error('切换状态失败:', error);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">卡密库存</h2>
          <p className="text-gray-500 mt-2 text-sm">管理自动发货的卡密、链接或图片资源。</p>
        </div>
        <button
            onClick={() => setShowAddModal(true)}
            className="ios-btn-primary flex items-center gap-2 px-6 py-3 rounded-2xl font-bold shadow-lg shadow-yellow-200 transition-transform hover:scale-105 active:scale-95"
        >
          <Plus className="w-5 h-5" />
          添加新卡密
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map(card => (
              <div
                key={card.id}
                onClick={() => handleEdit(card)}
                className="ios-card p-6 rounded-3xl hover:shadow-lg hover:scale-[1.02] transition-all cursor-pointer group relative overflow-hidden"
              >
                  <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-gray-50 rounded-2xl group-hover:bg-white transition-colors">
                        <CardIcon type={card.type} />
                      </div>
                      <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleCardStatus(card); }}
                            className={`p-2 rounded-xl transition-colors ${card.enabled ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}
                          >
                            {card.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(card.id); }}
                            className="p-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                      </div>
                  </div>

                  <h3 className="text-lg font-bold text-gray-900 mb-1">{card.name}</h3>
                  <p className="text-sm text-gray-500 line-clamp-2 min-h-[40px]">{card.description || '暂无描述'}</p>

                  <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400 font-medium">
                      <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(card.created_at).toLocaleDateString()}
                      </div>
                      <button className="text-[#FFE815] hover:text-black font-bold flex items-center gap-1">
                          <Edit className="w-3 h-3" />
                          编辑
                      </button>
                  </div>
              </div>
          ))}

          {cards.length === 0 && (
              <div className="col-span-full py-20 text-center text-gray-400 bg-white/40 rounded-3xl border border-dashed border-gray-300">
                  <Package className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p>暂无卡密配置，请点击右上角添加。</p>
              </div>
          )}
      </div>

      {/* 编辑卡密弹窗 */}
      {showEditModal && selectedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4">
          <div className="bg-white rounded-[2rem] p-8 max-w-lg w-full shadow-2xl animate-slide-up flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
              <h3 className="text-2xl font-extrabold text-gray-900">编辑卡密</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto -mr-2 pr-2">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">卡密名称</label>
                  <input
                    type="text"
                    value={editForm.name || ''}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full ios-input px-4 py-3 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">类型</label>
                  <select
                    value={editForm.type || 'text'}
                    onChange={(e) => setEditForm({ ...editForm, type: e.target.value as any })}
                    className="w-full ios-input px-4 py-3 rounded-xl"
                    disabled
                  >
                    <option value="text">文本</option>
                    <option value="image">图片</option>
                    <option value="api">API</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">内容</label>
                  {editForm.type === 'text' ? (
                    <textarea
                      value={editForm.content || ''}
                      onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                      className="w-full ios-input px-4 py-3 rounded-xl h-32 resize-none font-mono text-sm"
                      placeholder="输入卡密内容，一行一个"
                    />
                  ) : editForm.type === 'image' ? (
                    <textarea
                      value={editForm.content || ''}
                      onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                      className="w-full ios-input px-4 py-3 rounded-xl h-32 resize-none font-mono text-sm"
                      placeholder="输入图片URL，一行一个"
                    />
                  ) : (
                    <input
                      type="text"
                      value={editForm.content || ''}
                      onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                      className="w-full ios-input px-4 py-3 rounded-xl"
                      placeholder="API地址"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">描述</label>
                  <textarea
                    value={editForm.description || ''}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full ios-input px-4 py-3 rounded-xl h-20 resize-none"
                    placeholder="卡密描述"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">延时发货（秒）</label>
                  <input
                    type="number"
                    value={editForm.delay_seconds || 0}
                    onChange={(e) => setEditForm({ ...editForm, delay_seconds: parseInt(e.target.value) || 0 })}
                    className="w-full ios-input px-4 py-3 rounded-xl"
                    min="0"
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <span className="font-bold text-gray-900">启用状态</span>
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, enabled: !editForm.enabled })}
                    className={`w-14 h-8 rounded-full transition-colors duration-300 relative ${
                      editForm.enabled ? 'bg-[#FFE815]' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 block ${
                        editForm.enabled ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </button>
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
        </div>
      )}

      {/* 添加新卡密弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4">
          <div className="bg-white rounded-[2rem] p-8 max-w-lg w-full shadow-2xl animate-slide-up flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
              <h3 className="text-2xl font-extrabold text-gray-900">添加新卡密</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto -mr-2 pr-2">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">卡密名称</label>
                  <input
                    type="text"
                    value={addForm.name}
                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                    placeholder="例如：VIP会员卡密"
                    className="w-full ios-input px-4 py-3 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">类型</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setAddForm({ ...addForm, type: 'text' })}
                      className={`p-3 rounded-xl font-bold transition-all ${addForm.type === 'text' ? 'bg-[#FFE815] text-black' : 'bg-gray-100 text-gray-600'}`}
                    >
                      <FileText className="w-5 h-5 mx-auto mb-1" />
                      文本
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddForm({ ...addForm, type: 'image' })}
                      className={`p-3 rounded-xl font-bold transition-all ${addForm.type === 'image' ? 'bg-[#FFE815] text-black' : 'bg-gray-100 text-gray-600'}`}
                    >
                      <ImageIcon className="w-5 h-5 mx-auto mb-1" />
                      图片
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddForm({ ...addForm, type: 'api' })}
                      className={`p-3 rounded-xl font-bold transition-all ${addForm.type === 'api' ? 'bg-[#FFE815] text-black' : 'bg-gray-100 text-gray-600'}`}
                    >
                      <Code className="w-5 h-5 mx-auto mb-1" />
                      API
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    {addForm.type === 'text' ? '卡密内容（一行一个）' : addForm.type === 'image' ? '图片URL（一行一个）' : 'API地址'}
                  </label>
                  {addForm.type === 'api' ? (
                    <input
                      type="text"
                      value={addForm.content}
                      onChange={(e) => setAddForm({ ...addForm, content: e.target.value })}
                      placeholder="https://api.example.com/get-code"
                      className="w-full ios-input px-4 py-3 rounded-xl"
                    />
                  ) : (
                    <textarea
                      value={addForm.content}
                      onChange={(e) => setAddForm({ ...addForm, content: e.target.value })}
                      className="w-full ios-input px-4 py-3 rounded-xl h-40 resize-none font-mono text-sm"
                      placeholder={addForm.type === 'text' ? 'CODE-123456\nCODE-789012\n...' : 'https://example.com/image1.jpg\nhttps://example.com/image2.jpg\n...'}
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">描述</label>
                  <textarea
                    value={addForm.description}
                    onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                    placeholder="卡密用途描述"
                    className="w-full ios-input px-4 py-3 rounded-xl h-20 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">延时发货（秒）</label>
                  <input
                    type="number"
                    value={addForm.delay_seconds}
                    onChange={(e) => setAddForm({ ...addForm, delay_seconds: parseInt(e.target.value) || 0 })}
                    className="w-full ios-input px-4 py-3 rounded-xl"
                    min="0"
                    placeholder="0"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 px-6 py-3 rounded-xl font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleAddCard}
                    className="flex-1 ios-btn-primary px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    添加卡密
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

export default CardList;
