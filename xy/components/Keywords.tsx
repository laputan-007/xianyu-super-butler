import React, { useEffect, useState } from 'react';
import { AccountDetail } from '../types';
import { getAccountDetails, getReplyRules, updateReplyRule, deleteReplyRule } from '../services/api';
import { Plus, Trash2, MessageSquare, X, Save, Loader2, Key } from 'lucide-react';

interface Keyword {
  id: string;
  keyword: string;
  reply_content: string;
  match_type: 'exact' | 'fuzzy';
  enabled: boolean;
}

const Keywords: React.FC = () => {
  const [accounts, setAccounts] = useState<AccountDetail[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingKeyword, setEditingKeyword] = useState<Keyword | null>(null);
  const [form, setForm] = useState({
    keyword: '',
    reply_content: ''
  });

  useEffect(() => {
    getAccountDetails().then(setAccounts);
  }, []);

  useEffect(() => {
    if (selectedAccount) {
      loadKeywords();
    }
  }, [selectedAccount]);

  const loadKeywords = async () => {
    if (!selectedAccount) return;
    setLoading(true);
    try {
      const data = await getReplyRules(selectedAccount);
      setKeywords(data as Keyword[]);
    } catch (e) {
      console.error('加载关键词失败', e);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingKeyword(null);
    setForm({ keyword: '', reply_content: '' });
    setShowModal(true);
  };

  const handleEdit = (keyword: Keyword) => {
    setEditingKeyword(keyword);
    setForm({
      keyword: keyword.keyword,
      reply_content: keyword.reply_content
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!selectedAccount) {
      alert('请先选择账号');
      return;
    }
    if (!form.keyword.trim() || !form.reply_content.trim()) {
      alert('请填写关键词和回复内容');
      return;
    }

    try {
      await updateReplyRule(
        {
          id: editingKeyword?.id,
          keyword: form.keyword,
          reply_content: form.reply_content,
          match_type: 'exact',
          enabled: true
        },
        selectedAccount
      );
      setShowModal(false);
      loadKeywords();
      alert('保存成功！');
    } catch (e) {
      alert('保存失败：' + (e as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!selectedAccount || !confirm('确认删除该关键词吗？')) return;
    try {
      await deleteReplyRule(id, selectedAccount);
      loadKeywords();
      alert('删除成功！');
    } catch (e) {
      alert('删除失败：' + (e as Error).message);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">关键词管理</h2>
          <p className="text-gray-500 mt-2 font-medium">设置自动回复的关键词触发规则</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="ios-input px-4 py-3 rounded-xl font-medium"
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
          >
            <option value="">选择账号</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.nickname}
              </option>
            ))}
          </select>
          <button
            onClick={handleAdd}
            disabled={!selectedAccount}
            className="ios-btn-primary flex items-center gap-2 px-6 py-3 rounded-2xl font-bold shadow-lg shadow-yellow-200 disabled:opacity-50"
          >
            <Plus className="w-5 h-5" />
            添加关键词
          </button>
        </div>
      </div>

      {!selectedAccount ? (
        <div className="py-20 text-center bg-white rounded-[2rem] border-2 border-dashed border-gray-200">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">请选择账号</h3>
          <p className="text-gray-500 mt-1">选择一个账号以管理其关键词规则</p>
        </div>
      ) : loading ? (
        <div className="p-20 flex justify-center">
          <Loader2 className="w-8 h-8 text-[#FFE815] animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {keywords.map((keyword) => (
            <div
              key={keyword.id}
              className="ios-card p-6 rounded-[2rem] flex items-center justify-between group hover:border-[#FFE815] transition-all"
            >
              <div className="flex items-center gap-6 flex-1">
                <div className="p-4 bg-[#FFF9C4] rounded-2xl group-hover:bg-[#FFE815] transition-colors">
                  <Key className="w-6 h-6 text-yellow-800" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-extrabold text-gray-900">{keyword.keyword}</h3>
                    <span className="px-2.5 py-1 rounded-lg bg-green-100 text-green-700 text-xs font-bold">
                      {keyword.match_type === 'exact' ? '精确匹配' : '模糊匹配'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2 max-w-2xl">回复：{keyword.reply_content}</p>
                </div>
              </div>
              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => handleEdit(keyword)}
                  className="p-3 bg-yellow-50 text-yellow-700 rounded-xl hover:bg-yellow-100 transition-colors"
                  title="编辑"
                >
                  <MessageSquare className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleDelete(keyword.id)}
                  className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors"
                  title="删除"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}

          {keywords.length === 0 && (
            <div className="py-20 text-center bg-white rounded-[2rem] border-2 border-dashed border-gray-200">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">暂无关键词</h3>
              <p className="text-gray-500 mt-1">点击右上角添加新的关键词规则</p>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <div className="flex items-center justify-between w-full">
                <h3 className="text-2xl font-extrabold text-gray-900">
              {editingKeyword ? '编辑关键词' : '添加关键词'}
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
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">触发关键词</label>
                <input
                  type="text"
                  value={form.keyword}
                  onChange={(e) => setForm({ ...form, keyword: e.target.value })}
                  placeholder="例如：价格、包邮、怎么样"
                  className="w-full ios-input px-4 py-3 rounded-xl"
                />
                <p className="text-xs text-gray-500 mt-2">买家消息中包含此关键词时自动回复</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">回复内容</label>
                <textarea
                  value={form.reply_content}
                  onChange={(e) => setForm({ ...form, reply_content: e.target.value })}
                  placeholder="输入自动回复的内容..."
                  rows={6}
                  className="w-full ios-input px-4 py-3 rounded-xl resize-none"
                />
                <p className="text-xs text-gray-500 mt-2">支持换行，系统将自动发送此内容给买家</p>
              </div>
            </div>

            <div className="modal-footer">
              <div className="flex gap-3 w-full">
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
                  保存关键词
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Keywords;
