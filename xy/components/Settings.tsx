import React, { useEffect, useState } from 'react';
import { getSystemSettings, updateSystemSettings } from '../services/api';
import { SystemSettings } from '../types';
import { Bot, Save, Lock, Sparkles, Mail, Settings as SettingsIcon } from 'lucide-react';

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getSystemSettings().then(setSettings);
  }, []);

  const handleSave = async () => {
      if(!settings) return;
      setLoading(true);
      await updateSystemSettings(settings);
      setLoading(false);
      alert('系统配置已保存');
  };

  if (!settings) return <div className="p-8 text-center text-gray-400">加载配置中...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-24">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center">
            <SettingsIcon className="w-6 h-6 text-gray-600" />
        </div>
        <div>
            <h2 className="text-3xl font-extrabold text-gray-900">系统设置</h2>
            <p className="text-gray-500 mt-1 text-sm font-medium">配置全局自动化规则与系统参数。</p>
        </div>
      </div>

      {/* AI Configuration Section */}
      <section className="space-y-4">
        <h3 className="text-lg font-extrabold text-gray-800 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#FFE815] text-black">
                <Sparkles className="w-4 h-4" />
            </div>
            AI 智能回复配置 (Global)
        </h3>
        
        <div className="ios-card rounded-[2rem] overflow-hidden p-0 border-0 shadow-lg">
            <div className="p-10 space-y-8 bg-white">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                        <label className="block text-sm font-bold text-gray-800">默认模型</label>
                        <div className="relative">
                            <Bot className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <select 
                                value={settings.ai_model || 'gemini-pro'}
                                onChange={e => setSettings({...settings, ai_model: e.target.value})}
                                className="w-full ios-input pl-12 pr-4 py-4 rounded-2xl appearance-none text-gray-900 text-sm font-bold cursor-pointer"
                            >
                                <option value="gemini-pro">Google Gemini Pro</option>
                                <option value="qwen-plus">阿里通义千问 (Qwen)</option>
                                <option value="gpt-4">OpenAI GPT-4 Turbo</option>
                            </select>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <label className="block text-sm font-bold text-gray-800">API Base URL</label>
                        <input 
                            type="text" 
                            value={settings.ai_base_url || ''}
                            onChange={e => setSettings({...settings, ai_base_url: e.target.value})}
                            className="w-full ios-input px-5 py-4 rounded-2xl text-sm" 
                            placeholder="https://api.openai.com/v1"
                        />
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="block text-sm font-bold text-gray-800">API Key 密钥</label>
                    <div className="relative group">
                        <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-black transition-colors" />
                        <input 
                            type="password" 
                            value={settings.ai_api_key || ''}
                            onChange={e => setSettings({...settings, ai_api_key: e.target.value})}
                            className="w-full ios-input pl-12 pr-6 py-4 rounded-2xl font-mono text-sm tracking-widest" 
                        />
                    </div>
                </div>
                
                <div className="space-y-3">
                    <label className="block text-sm font-bold text-gray-800">默认自动回复内容</label>
                    <textarea 
                        className="w-full ios-input px-5 py-4 rounded-2xl min-h-[120px] text-sm leading-relaxed" 
                        value={settings.default_reply || ''}
                        onChange={e => setSettings({...settings, default_reply: e.target.value})}
                    ></textarea>
                </div>
            </div>
        </div>
      </section>

      {/* SMTP Settings */}
      <section className="space-y-4">
        <h3 className="text-lg font-extrabold text-gray-800 flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-100 text-blue-600">
                <Mail className="w-4 h-4" />
            </div>
            邮件通知配置
        </h3>
        <div className="ios-card p-10 rounded-[2rem] bg-white">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="space-y-3">
                    <label className="block text-sm font-bold text-gray-800">SMTP 服务器</label>
                    <input 
                        type="text" 
                        value={settings.smtp_server || ''}
                        onChange={e => setSettings({...settings, smtp_server: e.target.value})}
                        className="w-full ios-input px-5 py-4 rounded-2xl text-sm" 
                    />
                 </div>
                 <div className="space-y-3">
                    <label className="block text-sm font-bold text-gray-800">SMTP 端口</label>
                    <input 
                        type="number" 
                        value={settings.smtp_port || ''}
                        onChange={e => setSettings({...settings, smtp_port: Number(e.target.value)})}
                        className="w-full ios-input px-5 py-4 rounded-2xl text-sm" 
                    />
                 </div>
             </div>
        </div>
      </section>

      {/* Save Button */}
      <div className="fixed bottom-10 right-10 z-30">
        <button 
            onClick={handleSave}
            disabled={loading}
            className="ios-btn-primary px-10 py-5 rounded-[2rem] text-lg shadow-2xl shadow-yellow-200 flex items-center gap-3 transform hover:scale-105 active:scale-95 transition-all disabled:opacity-70"
        >
            <Save className="w-6 h-6" />
            {loading ? '保存中...' : '保存所有配置'}
        </button>
      </div>
    </div>
  );
};

export default Settings;