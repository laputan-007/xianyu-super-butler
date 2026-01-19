import React, { useEffect, useState } from 'react';
import { Card } from '../types';
import { getCards, createCard, updateCard, deleteCard, getCardDetails } from '../services/api';
import {
  Plus,
  CreditCard,
  Clock,
  FileText,
  Image as ImageIcon,
  Code,
  Database,
  Edit2,
  Trash2,
  X,
  Save,
  Loader2,
  Eye,
  Package,
  TrendingUp,
  Calendar
} from 'lucide-react';

const CardList: React.FC = () => {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [form, setForm] = useState({
    name: '',
    type: 'text' as 'api' | 'text' | 'data' | 'image',
    description: '',
    enabled: true,
    text_content: ''
  });

  // Detail modal states
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [cardDetails, setCardDetails] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadCards = () => {
    setLoading(true);
    getCards().then((data) => {
      setCards(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    loadCards();
  }, []);

  const handleAdd = () => {
    setEditingCard(null);
    setForm({
      name: '',
      type: 'text',
      description: '',
      enabled: true,
      text_content: ''
    });
    setShowModal(true);
  };

  const handleEdit = (card: Card) => {
    setEditingCard(card);
    setForm({
      name: card.name,
      type: card.type,
      description: card.description || '',
      enabled: card.enabled,
      text_content: card.text_content || ''
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      if (editingCard) {
        await updateCard(String(editingCard.id), form);
      } else {
        await createCard(form);
      }
      setShowModal(false);
      loadCards();
      alert('保存成功！');
    } catch (e) {
      alert('保存失败：' + (e as Error).message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确认删除该卡券吗？')) return;
    try {
      await deleteCard(String(id));
      loadCards();
      alert('删除成功！');
    } catch (e) {
      alert('删除失败：' + (e as Error).message);
    }
  };

  const handleViewDetail = async (card: Card) => {
    setSelectedCard(card);
    setShowDetailModal(true);
    setDetailLoading(true);
    try {
      const details = await getCardDetails(String(card.id));
      setCardDetails(details);
    } catch (e) {
      alert('获取卡券详情失败：' + (e as Error).message);
    } finally {
      setDetailLoading(false);
    }
  };

  const CardIcon = ({ type }: { type: string }) => {
    switch (type) {
      case 'text':
        return <FileText className="w-5 h-5 text-blue-500" />;
      case 'image':
        return <ImageIcon className="w-5 h-5 text-purple-500" />;
      case 'api':
        return <Code className="w-5 h-5 text-orange-500" />;
      case 'data':
        return <Database className="w-5 h-5 text-green-500" />;
      default:
        return <CreditCard className="w-5 h-5 text-gray-500" />;
    }
  };

  if (loading) return <div className="p-20 flex justify-center"><Loader2 className="w-8 h-8 text-[#FFE815] animate-spin" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">卡券管理</h2>
          <p className="text-gray-500 mt-2 font-medium">管理自动发货的卡密、链接或图片资源</p>
        </div>
        <button
          onClick={handleAdd}
          className="ios-btn-primary flex items-center gap-2 px-6 py-3 rounded-2xl font-bold shadow-lg shadow-yellow-200"
        >
          <Plus className="w-5 h-5" />
          添加新卡券
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card) => (
          <div
            key={card.id}
            onClick={() => handleViewDetail(card)}
            className="ios-card p-6 rounded-[2rem] hover:shadow-xl transition-all group relative overflow-hidden cursor-pointer"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-gray-50 rounded-2xl group-hover:bg-[#FFFDE7] transition-colors">
                <CardIcon type={card.type} />
              </div>
              <span
                className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                  card.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {card.enabled ? '启用中' : '已停用'}
              </span>
            </div>

            <h3 className="text-lg font-extrabold text-gray-900 mb-1 line-clamp-1">{card.name}</h3>
            <p className="text-sm text-gray-500 line-clamp-2 min-h-[40px] mb-4">
              {card.description || '暂无描述'}
            </p>

            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <div className="flex items-center gap-1 text-xs text-gray-400 font-medium">
                <Clock className="w-3 h-3" />
                {new Date(card.created_at).toLocaleDateString()}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(card);
                  }}
                  className="p-2 bg-yellow-50 text-yellow-700 rounded-xl hover:bg-yellow-100 transition-colors"
                  title="编辑"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(card.id);
                  }}
                  className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors"
                  title="删除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {cards.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white rounded-[2rem] border-2 border-dashed border-gray-200">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CreditCard className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">暂无卡券</h3>
            <p className="text-gray-500 mt-1">请点击右上角添加新的卡券</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md animate-fade-in p-4">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-2xl w-full shadow-2xl relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-6 right-6 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>

            <h3 className="text-2xl font-extrabold text-gray-900 mb-6">
              {editingCard ? '编辑卡券' : '添加新卡券'}
            </h3>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">卡券名称</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="例如：视频会员月卡"
                  className="w-full ios-input px-4 py-3 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">卡券类型</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: 'text', label: '文本', icon: <FileText className="w-4 h-4" /> },
                    { value: 'image', label: '图片', icon: <ImageIcon className="w-4 h-4" /> },
                    { value: 'api', label: 'API', icon: <Code className="w-4 h-4" /> },
                    { value: 'data', label: '数据', icon: <Database className="w-4 h-4" /> },
                  ].map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setForm({ ...form, type: type.value as any })}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl font-bold text-sm transition-all ${
                        form.type === type.value
                          ? 'bg-[#FFE815] text-black'
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {type.icon}
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">描述</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="简单描述该卡券的用途..."
                  rows={2}
                  className="w-full ios-input px-4 py-3 rounded-xl resize-none"
                />
              </div>

              {form.type === 'text' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">文本内容</label>
                  <textarea
                    value={form.text_content}
                    onChange={(e) => setForm({ ...form, text_content: e.target.value })}
                    placeholder="输入要发送的文本内容..."
                    rows={4}
                    className="w-full ios-input px-4 py-3 rounded-xl resize-none font-mono text-sm"
                  />
                </div>
              )}

              {form.type === 'data' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">批量数据</label>
                  <textarea
                    value={form.text_content}
                    onChange={(e) => setForm({ ...form, text_content: e.target.value })}
                    placeholder="每行一个卡密，例如：&#10;ABCD-1234-EFGH&#10;IJKL-5678-MNOP"
                    rows={6}
                    className="w-full ios-input px-4 py-3 rounded-xl resize-none font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-2">每行一条数据，自动按顺序发放</p>
                </div>
              )}

              {form.type === 'api' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">API 地址</label>
                  <input
                    type="text"
                    value={form.text_content}
                    onChange={(e) => setForm({ ...form, text_content: e.target.value })}
                    placeholder="https://api.example.com/get-code"
                    className="w-full ios-input px-4 py-3 rounded-xl font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-2">发货时将调用此 API 获取卡密</p>
                </div>
              )}

              {form.type === 'image' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">图片 URL</label>
                  <input
                    type="text"
                    value={form.text_content}
                    onChange={(e) => setForm({ ...form, text_content: e.target.value })}
                    placeholder="https://example.com/image.jpg"
                    className="w-full ios-input px-4 py-3 rounded-xl text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-2">输入图片的完整 URL 地址</p>
                </div>
              )}

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <div className="font-bold text-gray-900">启用卡券</div>
                  <div className="text-xs text-gray-500 mt-1">禁用后将不会使用该卡券发货</div>
                </div>
                <button
                  onClick={() => setForm({ ...form, enabled: !form.enabled })}
                  className={`w-14 h-8 rounded-full transition-all relative ${
                    form.enabled ? 'bg-[#FFE815]' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`w-6 h-6 bg-white rounded-full absolute top-1 transition-all shadow-md ${
                      form.enabled ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-6 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-6 py-3 rounded-xl ios-btn-primary font-bold shadow-lg shadow-yellow-200 flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                保存卡券
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md animate-fade-in p-4">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-4xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowDetailModal(false)}
              className="absolute top-6 right-6 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>

            <div className="mb-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <CardIcon type={selectedCard.type} />
                </div>
                <div>
                  <h3 className="text-2xl font-extrabold text-gray-900">{selectedCard.name}</h3>
                  <p className="text-gray-500 mt-1">{selectedCard.description || '暂无描述'}</p>
                </div>
              </div>
            </div>

            {detailLoading ? (
              <div className="py-20 flex justify-center">
                <Loader2 className="w-8 h-8 text-[#FFE815] animate-spin" />
              </div>
            ) : cardDetails ? (
              <div className="space-y-6">
                {/* 库存统计 */}
                <div>
                  <h4 className="font-bold text-lg mb-3 flex items-center gap-2">
                    <Package className="w-5 h-5 text-gray-700" />
                    库存统计
                  </h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-gray-50 p-4 rounded-xl">
                      <div className="text-sm text-gray-600 mb-1">总库存</div>
                      <div className="text-3xl font-bold text-gray-900">{cardDetails?.total || 0}</div>
                    </div>
                    <div className="bg-red-50 p-4 rounded-xl">
                      <div className="text-sm text-gray-600 mb-1">已发货</div>
                      <div className="text-3xl font-bold text-red-600">{cardDetails?.used || 0}</div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-xl">
                      <div className="text-sm text-gray-600 mb-1">剩余</div>
                      <div className="text-3xl font-bold text-green-600">{cardDetails?.remaining || 0}</div>
                    </div>
                  </div>
                </div>

                {/* 卡密列表 (仅数据类型) */}
                {selectedCard.type === 'data' && cardDetails?.cards && cardDetails.cards.length > 0 && (
                  <div>
                    <h4 className="font-bold text-lg mb-3 flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-gray-700" />
                      卡密列表
                    </h4>
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {cardDetails.cards.map((item: any, i: number) => (
                        <div
                          key={i}
                          className={`p-3 rounded-xl flex items-center justify-between ${
                            item.is_used ? 'bg-gray-100' : 'bg-green-50'
                          }`}
                        >
                          <span className="font-mono text-sm flex-1 truncate">{item.content}</span>
                          <span
                            className={`text-xs px-3 py-1 rounded-lg font-bold ml-3 ${
                              item.is_used ? 'bg-gray-300 text-gray-700' : 'bg-green-200 text-green-700'
                            }`}
                          >
                            {item.is_used ? '已使用' : '未使用'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 发货记录 */}
                {cardDetails?.history && cardDetails.history.length > 0 && (
                  <div>
                    <h4 className="font-bold text-lg mb-3 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-gray-700" />
                      发货记录
                    </h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {cardDetails.history.map((record: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">订单 {record.order_id}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                              <Calendar className="w-3 h-3" />
                              {record.created_at || '未知时间'}
                            </div>
                          </div>
                          <div className="text-sm text-gray-600 font-mono">{record.buyer_id || '未知买家'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 无发货记录提示 */}
                {(!cardDetails?.history || cardDetails.history.length === 0) && (
                  <div className="text-center py-8 bg-gray-50 rounded-xl">
                    <div className="text-gray-400 mb-2">暂无发货记录</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                无法加载卡券详情
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowDetailModal(false)}
                className="flex-1 px-6 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CardList;
