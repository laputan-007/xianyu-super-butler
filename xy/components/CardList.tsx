import React, { useEffect, useState } from 'react';
import { Card } from '../types';
import { getCards, createCard } from '../services/api';
import { Plus, CreditCard, Clock, FileText, Image as ImageIcon, Code } from 'lucide-react';

const CardList: React.FC = () => {
  const [cards, setCards] = useState<Card[]>([]);
  const [showModal, setShowModal] = useState(false);

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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">卡密库存</h2>
          <p className="text-gray-500 mt-2 text-sm">管理自动发货的卡密、链接或图片资源。</p>
        </div>
        <button 
            onClick={() => setShowModal(true)}
            className="ios-btn-primary flex items-center gap-2 px-6 py-3 rounded-full font-medium shadow-lg shadow-blue-500/30"
        >
          <Plus className="w-5 h-5" />
          添加新卡密
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map(card => (
              <div key={card.id} className="ios-card p-6 rounded-3xl hover:shadow-lg transition-all group relative overflow-hidden">
                  <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-gray-50 rounded-2xl group-hover:bg-white transition-colors">
                        <CardIcon type={card.type} />
                      </div>
                      <span className={`px-2 py-1 rounded-md text-xs font-bold ${card.enabled ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                          {card.enabled ? '启用中' : '已停用'}
                      </span>
                  </div>
                  
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{card.name}</h3>
                  <p className="text-sm text-gray-500 line-clamp-2 min-h-[40px]">{card.description || '暂无描述'}</p>
                  
                  <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between items-center text-xs text-gray-400 font-medium">
                      <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(card.created_at).toLocaleDateString()}
                      </div>
                      <button className="text-blue-600 hover:text-blue-700">管理库存 &rarr;</button>
                  </div>
              </div>
          ))}
          
          {cards.length === 0 && (
              <div className="col-span-full py-20 text-center text-gray-400 bg-white/40 rounded-3xl border border-dashed border-gray-300">
                  <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p>暂无卡密配置，请点击右上角添加。</p>
              </div>
          )}
      </div>
    </div>
  );
};

export default CardList;