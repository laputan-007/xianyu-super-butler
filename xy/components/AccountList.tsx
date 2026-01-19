import React, { useEffect, useState } from 'react';
import { AccountDetail, AIReplySettings } from '../types';
import {
  getAccountDetails,
  updateAccountStatus,
  deleteAccount,
  generateQRLogin,
  checkQRLoginStatus,
  updateAccountRemark,
  updateAccountAutoConfirm,
  updateAccountPauseDuration,
  getAccountAISettings,
  updateAccountAISettings,
  testAIConnection
} from '../services/api';
import { Plus, Power, Edit2, Trash2, QrCode, X, Check, Loader2, MessageSquare, RefreshCw, Bot, Save, TestTube } from 'lucide-react';

const AccountList: React.FC = () => {
  const [accounts, setAccounts] = useState<AccountDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [qrStatus, setQrStatus] = useState<string>('pending');

  // Edit modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountDetail | null>(null);
  const [editForm, setEditForm] = useState({
    remark: '',
    auto_confirm: false,
    pause_duration: 0
  });
  const [aiSettings, setAiSettings] = useState<AIReplySettings>({
    ai_enabled: false,
    model_name: 'qwen-plus',
    api_key: '',
    base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    max_discount_percent: 10,
    max_bargain_rounds: 3,
    custom_prompts: ''
  });
  const [aiTestLoading, setAiTestLoading] = useState(false);

  const loadAccounts = () => {
    setLoading(true);
    getAccountDetails().then((data) => {
      setAccounts(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleToggle = async (id: string, currentStatus: boolean) => {
      await updateAccountStatus(id, !currentStatus);
      loadAccounts();
  };

  const handleDelete = async (id: string) => {
      if(confirm('确认删除该账号吗？')) {
          await deleteAccount(id);
          loadAccounts();
      }
  };

  const startQRLogin = async () => {
      setShowQRModal(true);
      setQrStatus('loading');
      try {
          const res = await generateQRLogin();
          if (res.success && res.qr_code_url && res.session_id) {
              setQrCodeUrl(res.qr_code_url);
              setQrStatus('waiting');

              // Poll
              const interval = setInterval(async () => {
                  const statusRes = await checkQRLoginStatus(res.session_id!);
                  if (statusRes.status === 'success') {
                      clearInterval(interval);
                      setQrStatus('success');
                      setTimeout(() => {
                          setShowQRModal(false);
                          loadAccounts();
                      }, 1000);
                  } else if (statusRes.status === 'expired' || statusRes.status === 'error') {
                      clearInterval(interval);
                      setQrStatus('error');
                  }
              }, 2000);
          }
      } catch (e) {
          setQrStatus('error');
      }
  };

  const handleEdit = async (account: AccountDetail) => {
    setEditingAccount(account);
    setEditForm({
      remark: account.remark || '',
      auto_confirm: account.auto_confirm || false,
      pause_duration: account.pause_duration || 0
    });

    // Load AI settings
    try {
      const settings = await getAccountAISettings(account.id);
      setAiSettings(settings);
    } catch (e) {
      // Use defaults if failed
    }

    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingAccount) return;

    try {
      // Save basic settings
      await updateAccountRemark(editingAccount.id, editForm.remark);
      await updateAccountAutoConfirm(editingAccount.id, editForm.auto_confirm);
      await updateAccountPauseDuration(editingAccount.id, editForm.pause_duration);

      // Save AI settings
      await updateAccountAISettings(editingAccount.id, aiSettings);

      setShowEditModal(false);
      loadAccounts();
      alert('保存成功！');
    } catch (e) {
      alert('保存失败：' + (e as Error).message);
    }
  };

  const handleTestAI = async () => {
    if (!editingAccount) return;
    setAiTestLoading(true);
    try {
      const res = await testAIConnection(editingAccount.id);
      alert(res.message || 'AI 连接测试成功');
    } catch (e) {
      alert('AI 连接测试失败：' + (e as Error).message);
    } finally {
      setAiTestLoading(false);
    }
  };

  if (loading) return <div className="p-20 flex justify-center"><Loader2 className="w-8 h-8 text-[#FFE815] animate-spin"/></div>;

  return (
    <div className="space-y-8 animate-fade-in relative">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">账号管理</h2>
          <p className="text-gray-500 mt-2 font-medium">管理您的闲鱼授权账号及状态。</p>
        </div>
        <button 
            onClick={startQRLogin}
            className="ios-btn-primary flex items-center gap-2 px-6 py-3 rounded-2xl font-bold shadow-lg shadow-yellow-200 transition-transform hover:scale-105 active:scale-95"
        >
          <QrCode className="w-5 h-5" />
          扫码添加新账号
        </button>
      </div>

      {/* Account Grid */}
      <div className="grid grid-cols-1 gap-6">
        {accounts.map((account) => (
          <div key={account.id} className="ios-card p-6 rounded-[2rem] flex items-center justify-between group hover:border-[#FFE815] transition-all duration-300">
            <div className="flex items-center gap-8">
              <div className="relative">
                <img 
                  src={account.avatar_url} 
                  alt="avatar" 
                  className="w-20 h-20 rounded-3xl object-cover shadow-md ring-4 ring-white"
                />
                <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-4 border-white flex items-center justify-center ${account.enabled ? 'bg-green-500' : 'bg-gray-300'}`}>
                    {account.enabled && <Check className="w-3 h-3 text-white" />}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-xl font-extrabold text-gray-900">{account.nickname || `账号 ${account.id.substring(0,6)}...`}</h3>
                    {account.enabled ? (
                        <span className="px-2.5 py-0.5 rounded-lg bg-green-100 text-green-700 text-xs font-bold">在线</span>
                    ) : (
                        <span className="px-2.5 py-0.5 rounded-lg bg-gray-100 text-gray-500 text-xs font-bold">暂停</span>
                    )}
                </div>
                <p className="text-sm text-gray-500 font-medium mb-3">{account.remark || '暂无备注'}</p>
                <div className="flex gap-2">
                   {account.auto_confirm && <span className="text-xs bg-yellow-50 text-yellow-700 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5"><MessageSquare className="w-3 h-3"/> 自动回复开启</span>}
                   <span className="text-xs bg-gray-50 text-gray-400 px-3 py-1.5 rounded-lg font-mono">ID: {account.id}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pl-8 border-l border-gray-100">
              <button
                onClick={() => handleToggle(account.id, account.enabled)}
                title={account.enabled ? "暂停账号" : "启用账号"}
                className={`w-12 h-12 flex items-center justify-center rounded-2xl transition-all font-bold ${account.enabled ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
              >
                <Power className="w-5 h-5" />
              </button>
              <button
                onClick={() => handleEdit(account)}
                title="编辑配置"
                className="w-12 h-12 flex items-center justify-center rounded-2xl bg-[#FFF9C4] text-yellow-800 hover:bg-[#FFE815] hover:text-black transition-all">
                <Edit2 className="w-5 h-5" />
              </button>
              <button 
                onClick={() => handleDelete(account.id)}
                title="删除账号" 
                className="w-12 h-12 flex items-center justify-center rounded-2xl bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 transition-all"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
        
        {accounts.length === 0 && (
            <div className="py-20 text-center bg-white rounded-[2rem] border-2 border-dashed border-gray-200">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <QrCode className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">暂无账号</h3>
                <p className="text-gray-500 mt-1">请点击右上角扫码添加您的闲鱼账号</p>
            </div>
        )}
      </div>

      {/* QR Code Modal */}
      {showQRModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md animate-fade-in">
              <div className="bg-white rounded-[2.5rem] p-10 max-w-sm w-full shadow-2xl relative">
                  <button 
                    onClick={() => setShowQRModal(false)}
                    className="absolute top-6 right-6 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                  >
                      <X className="w-5 h-5 text-gray-600" />
                  </button>
                  
                  <div className="text-center">
                      <h3 className="text-2xl font-extrabold text-gray-900 mb-2">扫码登录</h3>
                      <p className="text-gray-500 mb-8 font-medium">请打开闲鱼APP扫描下方二维码</p>
                      
                      <div className="w-64 h-64 bg-[#F7F8FA] rounded-[2rem] mx-auto flex items-center justify-center overflow-hidden border-4 border-white shadow-inner mb-8 relative">
                          {qrStatus === 'loading' && <Loader2 className="w-10 h-10 text-[#FFE815] animate-spin" />}
                          {qrStatus === 'waiting' && <img src={qrCodeUrl} alt="QR Code" className="w-full h-full p-2" />}
                          {qrStatus === 'success' && (
                              <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center text-green-600 animate-fade-in">
                                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                                     <Check className="w-8 h-8" />
                                  </div>
                                  <span className="font-bold text-lg">登录成功</span>
                              </div>
                          )}
                          {qrStatus === 'error' && (
                              <div className="flex flex-col items-center">
                                  <span className="text-red-500 font-bold mb-2">获取失败</span>
                                  <button onClick={startQRLogin} className="text-xs bg-gray-200 px-3 py-1 rounded-full flex items-center gap-1 hover:bg-gray-300"><RefreshCw className="w-3 h-3"/> 重试</button>
                              </div>
                          )}
                      </div>

                      <p className="text-xs text-gray-400 font-medium bg-gray-50 py-2 rounded-xl">二维码有效期为5分钟，请尽快扫码。</p>
                  </div>
              </div>
          </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md animate-fade-in overflow-y-auto p-4">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-3xl w-full shadow-2xl relative my-8">
            <button
              onClick={() => setShowEditModal(false)}
              className="absolute top-6 right-6 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>

            <h3 className="text-2xl font-extrabold text-gray-900 mb-6">编辑账号配置</h3>

            <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
              {/* Basic Settings */}
              <div className="space-y-4">
                <h4 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  基本设置
                </h4>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">账号备注</label>
                  <input
                    type="text"
                    value={editForm.remark}
                    onChange={(e) => setEditForm({ ...editForm, remark: e.target.value })}
                    placeholder="给账号起个名字"
                    className="w-full ios-input px-4 py-3 rounded-xl"
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <div className="font-bold text-gray-900">自动确认订单</div>
                    <div className="text-xs text-gray-500 mt-1">收到订单后自动确认并发货</div>
                  </div>
                  <button
                    onClick={() => setEditForm({ ...editForm, auto_confirm: !editForm.auto_confirm })}
                    className={`w-14 h-8 rounded-full transition-all relative ${editForm.auto_confirm ? 'bg-[#FFE815]' : 'bg-gray-300'}`}
                  >
                    <div className={`w-6 h-6 bg-white rounded-full absolute top-1 transition-all shadow-md ${editForm.auto_confirm ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">暂停时长（分钟）</label>
                  <input
                    type="number"
                    value={editForm.pause_duration}
                    onChange={(e) => setEditForm({ ...editForm, pause_duration: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                    min="0"
                    className="w-full ios-input px-4 py-3 rounded-xl"
                  />
                  <p className="text-xs text-gray-500 mt-1">设置为 0 表示不暂停</p>
                </div>
              </div>

              {/* AI Settings */}
              <div className="space-y-4 pt-6 border-t border-gray-200">
                <h4 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <Bot className="w-5 h-5" />
                  AI 回复设置
                </h4>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <div className="font-bold text-gray-900">启用 AI 回复</div>
                    <div className="text-xs text-gray-500 mt-1">使用 AI 智能回复买家消息</div>
                  </div>
                  <button
                    onClick={() => setAiSettings({ ...aiSettings, ai_enabled: !aiSettings.ai_enabled })}
                    className={`w-14 h-8 rounded-full transition-all relative ${aiSettings.ai_enabled ? 'bg-[#FFE815]' : 'bg-gray-300'}`}
                  >
                    <div className={`w-6 h-6 bg-white rounded-full absolute top-1 transition-all shadow-md ${aiSettings.ai_enabled ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                {aiSettings.ai_enabled && (
                  <div className="space-y-4 pl-4 border-l-2 border-yellow-200">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">模型名称</label>
                      <input
                        type="text"
                        value={aiSettings.model_name}
                        onChange={(e) => setAiSettings({ ...aiSettings, model_name: e.target.value })}
                        placeholder="qwen-plus"
                        className="w-full ios-input px-4 py-3 rounded-xl"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">API Key</label>
                      <input
                        type="password"
                        value={aiSettings.api_key}
                        onChange={(e) => setAiSettings({ ...aiSettings, api_key: e.target.value })}
                        placeholder="sk-xxxxxxxxxxxxxxxx"
                        className="w-full ios-input px-4 py-3 rounded-xl font-mono text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Base URL</label>
                      <input
                        type="text"
                        value={aiSettings.base_url}
                        onChange={(e) => setAiSettings({ ...aiSettings, base_url: e.target.value })}
                        placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
                        className="w-full ios-input px-4 py-3 rounded-xl text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">最大折扣率 (%)</label>
                        <input
                          type="number"
                          value={aiSettings.max_discount_percent}
                          onChange={(e) => setAiSettings({ ...aiSettings, max_discount_percent: parseInt(e.target.value) || 0 })}
                          placeholder="10"
                          min="0"
                          max="100"
                          className="w-full ios-input px-4 py-3 rounded-xl"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">最大议价轮数</label>
                        <input
                          type="number"
                          value={aiSettings.max_bargain_rounds}
                          onChange={(e) => setAiSettings({ ...aiSettings, max_bargain_rounds: parseInt(e.target.value) || 0 })}
                          placeholder="3"
                          min="0"
                          className="w-full ios-input px-4 py-3 rounded-xl"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">自定义提示词</label>
                      <textarea
                        value={aiSettings.custom_prompts}
                        onChange={(e) => setAiSettings({ ...aiSettings, custom_prompts: e.target.value })}
                        placeholder="可选：自定义 AI 的回复风格和规则..."
                        rows={3}
                        className="w-full ios-input px-4 py-3 rounded-xl resize-none"
                      />
                    </div>

                    <button
                      onClick={handleTestAI}
                      disabled={aiTestLoading}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold transition-colors"
                    >
                      {aiTestLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
                      测试 AI 连接
                    </button>
                  </div>
                )}
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
                保存设置
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountList;