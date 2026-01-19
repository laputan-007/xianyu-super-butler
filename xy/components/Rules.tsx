import React, { useEffect, useState } from 'react';
import { ShippingRule, ReplyRule, AccountDetail, Card } from '../types';
import { getShippingRules, getReplyRules, updateShippingRule, deleteShippingRule, updateReplyRule, deleteReplyRule, getAccountDetails, getCards } from '../services/api';
import { Zap, MessageCircle, Plus, Trash2, Power, AlertCircle, RefreshCw, X, Save, Edit2 } from 'lucide-react';

const Rules: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'shipping' | 'reply'>('shipping');
  const [shippingRules, setShippingRules] = useState<ShippingRule[]>([]);
  const [replyRules, setReplyRules] = useState<ReplyRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  // Modal states
  const [showShippingModal, setShowShippingModal] = useState(false);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [editingShippingRule, setEditingShippingRule] = useState<ShippingRule | null>(null);
  const [editingReplyRule, setEditingReplyRule] = useState<ReplyRule | null>(null);

  // Form states
  const [shippingForm, setShippingForm] = useState({
    name: '',
    item_keyword: '',
    card_group_id: 0,
    priority: 1,
    enabled: true
  });
  const [replyForm, setReplyForm] = useState({
    keyword: '',
    reply_content: '',
    match_type: 'exact' as 'exact' | 'fuzzy',
    enabled: true
  });

  // Reference data
  const [accounts, setAccounts] = useState<AccountDetail[]>([]);
  const [cards, setCards] = useState<Card[]>([]);

  // Load data
  const refresh = async () => {
      setLoading(true);
      try {
          if (activeTab === 'shipping') {
              const data = await getShippingRules();
              setShippingRules(data);
          } else {
              // 关键词回复需要选择账号
              if (!selectedAccountId) {
                  setReplyRules([]);
                  return;
              }
              const data = await getReplyRules(selectedAccountId);
              setReplyRules(data);
          }
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
      refresh();
  }, [activeTab, selectedAccountId]);

  useEffect(() => {
      getAccountDetails().then(setAccounts);
      getCards().then(setCards);
  }, []);

  // Handlers
  const handleToggleShipping = async (rule: ShippingRule) => {
      await updateShippingRule({ ...rule, enabled: !rule.enabled });
      refresh();
  };
  const handleDeleteShipping = async (id: string) => {
      if(confirm('确定删除该发货规则吗？')) {
          await deleteShippingRule(id);
          refresh();
      }
  };

  const handleToggleReply = async (rule: ReplyRule) => {
      if (!selectedAccountId) return alert('请先选择账号');
      await updateReplyRule({ ...rule, enabled: !rule.enabled }, selectedAccountId);
      refresh();
  };
  const handleDeleteReply = async (id: string) => {
       if (!selectedAccountId) return alert('请先选择账号');
       if(confirm('确定删除该回复规则吗？')) {
          await deleteReplyRule(id, selectedAccountId);
          refresh();
      }
  };

  // Shipping rule handlers
  const handleAddShipping = () => {
      setEditingShippingRule(null);
      setShippingForm({
          name: '',
          item_keyword: '',
          card_group_id: 0,
          priority: 1,
          enabled: true
      });
      setShowShippingModal(true);
  };

  const handleEditShipping = (rule: ShippingRule) => {
      setEditingShippingRule(rule);
      setShippingForm({
          name: rule.name,
          item_keyword: rule.item_keyword,
          card_group_id: rule.card_group_id,
          priority: rule.priority,
          enabled: rule.enabled
      });
      setShowShippingModal(true);
  };

  const handleSaveShipping = async () => {
      try {
          const payload: Partial<ShippingRule> = {
              ...shippingForm,
              id: editingShippingRule?.id
          };
          await updateShippingRule(payload);
          setShowShippingModal(false);
          refresh();
          alert('保存成功！');
      } catch (e) {
          alert('保存失败：' + (e as Error).message);
      }
  };

  // Reply rule handlers
  const handleAddReply = () => {
      if (!selectedAccountId) return alert('请先选择账号');
      setEditingReplyRule(null);
      setReplyForm({
          keyword: '',
          reply_content: '',
          match_type: 'exact',
          enabled: true
      });
      setShowReplyModal(true);
  };

  const handleEditReply = (rule: ReplyRule) => {
      if (!selectedAccountId) return alert('请先选择账号');
      setEditingReplyRule(rule);
      setReplyForm({
          keyword: rule.keyword,
          reply_content: rule.reply_content,
          match_type: rule.match_type,
          enabled: rule.enabled
      });
      setShowReplyModal(true);
  };

  const handleSaveReply = async () => {
      if (!selectedAccountId) return alert('请先选择账号');
      try {
          const payload: Partial<ReplyRule> = {
              ...replyForm,
              id: editingReplyRule?.id
          };
          await updateReplyRule(payload, selectedAccountId);
          setShowReplyModal(false);
          refresh();
          alert('保存成功！');
      } catch (e) {
          alert('保存失败：' + (e as Error).message);
      }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900">智能策略</h2>
          <p className="text-gray-500 mt-2 font-medium">配置自动发货逻辑与关键词自动回复规则。</p>
        </div>
        <button onClick={refresh} className="p-3 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <RefreshCw className={`w-5 h-5 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex p-1.5 bg-gray-200/50 rounded-2xl w-fit">
          <button 
            onClick={() => setActiveTab('shipping')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'shipping' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-gray-700'}`}
          >
              <Zap className="w-4 h-4" /> 自动发货规则
          </button>
          <button 
            onClick={() => setActiveTab('reply')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'reply' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-gray-700'}`}
          >
              <MessageCircle className="w-4 h-4" /> 关键词回复
          </button>
      </div>

      {/* Content Area */}
      <div className="ios-card bg-white rounded-[2rem] p-6 min-h-[500px]">
          
          {/* SHIPPING RULES */}
          {activeTab === 'shipping' && (
              <div className="space-y-4">
                  <div className="flex justify-between items-center mb-6">
                      <div className="flex items-center gap-2 text-sm text-yellow-700 bg-yellow-50 px-4 py-2 rounded-xl">
                          <AlertCircle className="w-4 h-4" />
                          当订单商品标题包含关键词时，自动发送对应卡密。
                      </div>
                      <button onClick={handleAddShipping} className="ios-btn-primary px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-yellow-100">
                          <Plus className="w-4 h-4" /> 新增发货规则
                      </button>
                  </div>
                  
                  <div className="space-y-3">
                      {shippingRules.map(rule => (
                          <div key={rule.id} className="flex items-center justify-between p-5 rounded-2xl border border-gray-100 bg-[#F7F8FA] hover:bg-white hover:shadow-lg transition-all duration-300">
                              <div className="flex items-center gap-4">
                                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg ${rule.enabled ? 'bg-black text-[#FFE815]' : 'bg-gray-200 text-gray-400'}`}>
                                      {rule.priority}
                                  </div>
                                  <div>
                                      <h3 className="font-bold text-gray-900 text-lg">{rule.name}</h3>
                                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 font-medium">
                                          <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-lg">关键词: {rule.item_keyword}</span>
                                          <span>→</span>
                                          <span className="bg-purple-50 text-purple-600 px-2 py-0.5 rounded-lg">卡密组: {rule.card_group_name || `ID:${rule.card_group_id}`}</span>
                                      </div>
                                  </div>
                              </div>
                              <div className="flex items-center gap-3">
                                  <button
                                    onClick={() => handleToggleShipping(rule)}
                                    className={`w-12 h-8 rounded-full relative transition-colors ${rule.enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                                  >
                                      <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-sm transition-transform ${rule.enabled ? 'left-5' : 'left-1'}`}></div>
                                  </button>
                                  <button onClick={() => handleEditShipping(rule)} className="p-2 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-xl transition-colors">
                                      <Edit2 className="w-5 h-5" />
                                  </button>
                                  <button onClick={() => handleDeleteShipping(rule.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                                      <Trash2 className="w-5 h-5" />
                                  </button>
                              </div>
                          </div>
                      ))}
                      {shippingRules.length === 0 && <div className="text-center py-20 text-gray-400">暂无规则</div>}
                  </div>
              </div>
          )}

          {/* REPLY RULES */}
          {activeTab === 'reply' && (
              <div className="space-y-4">
                  <div className="flex justify-between items-center mb-6">
                      <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 px-4 py-2 rounded-xl">
                              <AlertCircle className="w-4 h-4" />
                              当买家发送包含关键词的消息时，优先触发此回复。
                          </div>
                          <select
                            value={selectedAccountId}
                            onChange={(e) => setSelectedAccountId(e.target.value)}
                            className="px-4 py-2 rounded-xl border border-gray-200 text-sm"
                          >
                              <option value="">选择账号查看关键词</option>
                              {accounts.map(acc => (
                                  <option key={acc.id} value={acc.id}>{acc.nickname}</option>
                              ))}
                          </select>
                      </div>
                      <button onClick={handleAddReply} className="ios-btn-primary px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-yellow-100">
                          <Plus className="w-4 h-4" /> 新增回复规则
                      </button>
                  </div>

                  <div className="space-y-3">
                      {replyRules.map(rule => (
                          <div key={rule.id} className="flex flex-col md:flex-row md:items-center justify-between p-5 rounded-2xl border border-gray-100 bg-[#F7F8FA] hover:bg-white hover:shadow-lg transition-all duration-300 gap-4">
                              <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                      <span className="px-3 py-1 bg-black text-white rounded-lg text-xs font-bold">{rule.match_type === 'exact' ? '精确匹配' : '模糊包含'}</span>
                                      <h3 className="font-bold text-gray-900">"{rule.keyword}"</h3>
                                  </div>
                                  <div className="bg-white p-3 rounded-xl border border-gray-100 text-sm text-gray-600 leading-relaxed">
                                      {rule.reply_content}
                                  </div>
                              </div>
                              <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-gray-200 pt-4 md:pt-0 md:pl-6">
                                  <button
                                    onClick={() => handleToggleReply(rule)}
                                    className={`w-12 h-8 rounded-full relative transition-colors ${rule.enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                                  >
                                      <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-sm transition-transform ${rule.enabled ? 'left-5' : 'left-1'}`}></div>
                                  </button>
                                  <button onClick={() => handleEditReply(rule)} className="p-2 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-xl transition-colors">
                                      <Edit2 className="w-5 h-5" />
                                  </button>
                                  <button onClick={() => handleDeleteReply(rule.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                                      <Trash2 className="w-5 h-5" />
                                  </button>
                              </div>
                          </div>
                      ))}
                      {replyRules.length === 0 && <div className="text-center py-20 text-gray-400">暂无规则</div>}
                  </div>
              </div>
          )}
      </div>

      {/* Shipping Rule Modal */}
      {showShippingModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <div className="flex items-center justify-between w-full">
                <h3 className="text-2xl font-extrabold text-gray-900">
              {editingShippingRule ? '编辑发货规则' : '新增发货规则'}
            </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>

            <div className="modal-body space-y-5">

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">规则名称</label>
                <input
                  type="text"
                  value={shippingForm.name}
                  onChange={(e) => setShippingForm({ ...shippingForm, name: e.target.value })}
                  placeholder="例如：会员月卡自动发货"
                  className="w-full ios-input px-4 py-3 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">商品关键词</label>
                <input
                  type="text"
                  value={shippingForm.item_keyword}
                  onChange={(e) => setShippingForm({ ...shippingForm, item_keyword: e.target.value })}
                  placeholder="商品标题包含此关键词时触发"
                  className="w-full ios-input px-4 py-3 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">关联卡券</label>
                <select
                  value={shippingForm.card_group_id}
                  onChange={(e) => setShippingForm({ ...shippingForm, card_group_id: parseInt(e.target.value) })}
                  className="w-full ios-input px-4 py-3 rounded-xl"
                >
                  <option value={0}>选择卡券组</option>
                  {cards.map(card => (
                    <option key={card.id} value={card.id}>{card.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">发货数量</label>
                <input
                  type="number"
                  value={shippingForm.priority}
                  onChange={(e) => setShippingForm({ ...shippingForm, priority: parseInt(e.target.value) || 1 })}
                  placeholder="每次发送的卡密数量"
                  className="w-full ios-input px-4 py-3 rounded-xl"
                  min="1"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <div className="font-bold text-gray-900">启用规则</div>
                  <div className="text-xs text-gray-500 mt-1">禁用后将不会自动发货</div>
                </div>
                <button
                  onClick={() => setShippingForm({ ...shippingForm, enabled: !shippingForm.enabled })}
                  className={`w-14 h-8 rounded-full transition-all relative ${
                    shippingForm.enabled ? 'bg-[#FFE815]' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`w-6 h-6 bg-white rounded-full absolute top-1 transition-all shadow-md ${
                      shippingForm.enabled ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="modal-footer">
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setShowShippingModal(false)}
                  className="flex-1 px-6 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveShipping}
                  className="flex-1 px-6 py-3 rounded-xl ios-btn-primary font-bold shadow-lg shadow-yellow-200 flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  保存规则
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reply Rule Modal */}
      {showReplyModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <div className="flex items-center justify-between w-full">
                <h3 className="text-2xl font-extrabold text-gray-900">
              {editingReplyRule ? '编辑回复规则' : '新增回复规则'}
            </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>

            <div className="modal-body space-y-5">

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">触发关键词</label>
                <input
                  type="text"
                  value={replyForm.keyword}
                  onChange={(e) => setReplyForm({ ...replyForm, keyword: e.target.value })}
                  placeholder="例如：在吗、价格"
                  className="w-full ios-input px-4 py-3 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">回复内容</label>
                <textarea
                  value={replyForm.reply_content}
                  onChange={(e) => setReplyForm({ ...replyForm, reply_content: e.target.value })}
                  placeholder="买家发送关键词后，自动回复的内容..."
                  rows={4}
                  className="w-full ios-input px-4 py-3 rounded-xl resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">匹配模式</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setReplyForm({ ...replyForm, match_type: 'exact' })}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl font-bold text-sm transition-all ${
                      replyForm.match_type === 'exact'
                        ? 'bg-[#FFE815] text-black'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    精确匹配
                  </button>
                  <button
                    onClick={() => setReplyForm({ ...replyForm, match_type: 'fuzzy' })}
                    className={`flex flex-col items-center gap-2 p-3 rounded-xl font-bold text-sm transition-all ${
                      replyForm.match_type === 'fuzzy'
                        ? 'bg-[#FFE815] text-black'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    模糊包含
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <div className="font-bold text-gray-900">启用规则</div>
                  <div className="text-xs text-gray-500 mt-1">禁用后将不会自动回复</div>
                </div>
                <button
                  onClick={() => setReplyForm({ ...replyForm, enabled: !replyForm.enabled })}
                  className={`w-14 h-8 rounded-full transition-all relative ${
                    replyForm.enabled ? 'bg-[#FFE815]' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`w-6 h-6 bg-white rounded-full absolute top-1 transition-all shadow-md ${
                      replyForm.enabled ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="modal-footer">
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setShowReplyModal(false)}
                  className="flex-1 px-6 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveReply}
                  className="flex-1 px-6 py-3 rounded-xl ios-btn-primary font-bold shadow-lg shadow-yellow-200 flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  保存规则
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Rules;
