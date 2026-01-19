import React, { useEffect, useState } from 'react';
import { ShippingRule, ReplyRule } from '../types';
import { getShippingRules, getReplyRules, updateShippingRule, deleteShippingRule, updateReplyRule, deleteReplyRule } from '../services/api';
import { Zap, MessageCircle, Plus, Trash2, Power, AlertCircle, RefreshCw } from 'lucide-react';

const Rules: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'shipping' | 'reply'>('shipping');
  const [shippingRules, setShippingRules] = useState<ShippingRule[]>([]);
  const [replyRules, setReplyRules] = useState<ReplyRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

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
                      <button className="ios-btn-primary px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-yellow-100">
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
                              {/* 这里需要从账号列表填充选项，暂时留空 */}
                          </select>
                      </div>
                      <button className="ios-btn-primary px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-yellow-100">
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
    </div>
  );
};

export default Rules;
