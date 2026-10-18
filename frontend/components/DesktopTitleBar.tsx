import React, { useEffect, useState } from 'react';
import { Minus, Square, X } from 'lucide-react';

/**
 * 打包客户端（pywebview frameless 窗口）的自定义标题栏。
 *
 * - 拖拽区挂 `pywebview-drag-region` 类：pywebview 注入的拖拽钩子按该类名生效，
 *   按钮区与拖拽区平级排布，避免点按钮被拖拽事件吃掉；
 * - 窗口控制按钮走 Start.py 注入的 js_api 桥（minimize/maximize/restore/close）；
 * - 标题栏固定深色（与登录封面同色系），浅色主题的应用内呈现为深色顶条。
 * 浏览器访问时不渲染（window.pywebview 不存在）。
 */

/** pywebview 注入的 JS 桥（Start.py 的 _DesktopClientApi）。 */
export interface PyWebViewBridge {
  pywebview?: {
    api?: {
      minimize?: () => void;
      maximize?: () => void;
      restore?: () => void;
      close?: () => void;
      create_desktop_shortcut?: () => Promise<{ success: boolean; path?: string; message?: string }>;
      select_storage_dir?: () => Promise<{ success: boolean; path?: string; cancelled?: boolean; message?: string }>;
      open_data_dir?: () => Promise<{ success: boolean; message?: string }>;
      restart?: () => void | Promise<{ success: boolean; message?: string }>;
    };
  };
}

/** 是否运行在打包客户端的 pywebview 壳里（bridge 异步注入，轮询等待）。 */
export const useDesktopShell = (): boolean => {
  const [enabled, setEnabled] = useState(
    () => typeof window !== 'undefined' && Boolean((window as PyWebViewBridge).pywebview),
  );

  useEffect(() => {
    if (enabled) return;
    const timer = window.setInterval(() => {
      if ((window as PyWebViewBridge).pywebview) {
        setEnabled(true);
        window.clearInterval(timer);
      }
    }, 200);
    const stop = window.setTimeout(() => window.clearInterval(timer), 15000);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(stop);
    };
  }, [enabled]);

  return enabled;
};

const DesktopTitleBar: React.FC = () => {
  // 仅在 pywebview 壳内渲染：浏览器访问 window.pywebview 不存在，整体不显示
  const shellActive = useDesktopShell();
  const [maximized, setMaximized] = useState(false);
  const api = () => (window as PyWebViewBridge).pywebview?.api;

  if (!shellActive) return null;

  const handleToggleMaximize = () => {
    const bridge = api();
    if (!bridge) return;
    if (maximized) {
      bridge.restore?.();
      setMaximized(false);
    } else {
      bridge.maximize?.();
      setMaximized(true);
    }
  };

  return (
    <div className="fixed inset-x-0 top-0 z-[9999] flex h-9 select-none items-center bg-[#17130a] text-white/60">
      <span className="px-3 text-xs font-bold tracking-wide text-white/70">鱼小铺</span>
      {/* 拖拽区：占满剩余宽度，与右侧按钮区平级 */}
      <div className="pywebview-drag-region h-full flex-1" />
      <div className="flex h-full items-stretch">
        <button
          type="button"
          onClick={() => api()?.minimize?.()}
          aria-label="最小化"
          title="最小化"
          className="flex w-11 items-center justify-center transition-colors hover:bg-white/10 hover:text-white"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={handleToggleMaximize}
          aria-label={maximized ? '还原' : '最大化'}
          title={maximized ? '还原' : '最大化'}
          className="flex w-11 items-center justify-center transition-colors hover:bg-white/10 hover:text-white"
        >
          <Square className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => api()?.close?.()}
          aria-label="关闭"
          title="关闭"
          className="flex w-11 items-center justify-center transition-colors hover:bg-red-600 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default DesktopTitleBar;
