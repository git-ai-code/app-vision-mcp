/**
 * App Vision MCP - Preload Script
 * メインプロセスとレンダラープロセス間のセキュリティブリッジ
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { ScreenshotData, AppInfo, AppConfig, SystemInfo, AppVisionAPI } from './renderer/types/index.js';

// メインプロセスとの通信API
const appVisionAPI: AppVisionAPI = {
  // ===== スクリーンキャプチャAPI =====
  
  async screenCapture(targetApp?: string) {
    try {
      return await ipcRenderer.invoke('screen:capture', targetApp);
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  },

  async getLatestScreenshot() {
    try {
      return await ipcRenderer.invoke('screen:getLatest');
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  },

  async getAvailableApps() {
    try {
      return await ipcRenderer.invoke('screen:getAvailableApps');
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  },

  async getFileStats() {
    try {
      return await ipcRenderer.invoke('files:getStats');
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  },

  // ===== キャプチャ中の対象変更 =====

  async changeTarget(targetApp: string) {
    try {
      return await ipcRenderer.invoke('capture:changeTarget', targetApp);
    } catch (error) {
      return { 
        success: false, 
        captureActive: false,
        newTarget: '',
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  },

  // ===== コアキャプチャAPI =====
  
  async startCapture() {
    try {
      return await ipcRenderer.invoke('capture:start');
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  },

  async stopCapture() {
    try {
      return await ipcRenderer.invoke('capture:stop');
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  },

  async manualCapture(targetApp?: string | null) {
    try {
      return await ipcRenderer.invoke('capture:manual', targetApp);
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  },

  async getCaptureStatus() {
    try {
      return await ipcRenderer.invoke('capture:status');
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  },

  async setTargetApp(appName: string, patterns: string[]) {
    try {
      return await ipcRenderer.invoke('capture:setTargetApp', appName, patterns);
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  },

  // 手動キャプチャフラグ管理
  async hasManualCaptureFlag() {
    try {
      return await ipcRenderer.invoke('capture:hasManualCaptureFlag');
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  },

  async createManualCaptureFlag() {
    try {
      return await ipcRenderer.invoke('capture:createManualCaptureFlag');
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  },

  async clearManualCaptureFlag() {
    try {
      return await ipcRenderer.invoke('capture:clearManualCaptureFlag');
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  },

  // ===== 設定関連 =====

  async getConfig() {
    try {
      return await ipcRenderer.invoke('config:get');
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  },

  async updateConfig(updates: any) {
    try {
      return await ipcRenderer.invoke('config:update', updates);
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  },

  async setAdapter(adapterId: string) {
    try {
      return await ipcRenderer.invoke('config:setAdapter', adapterId);
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  },

  async setTheme(theme: 'light' | 'dark') {
    try {
      return await ipcRenderer.invoke('config:setTheme', theme);
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  },

  // ===== システム関連 =====

  async getMemoryUsage() {
    try {
      return await ipcRenderer.invoke('system:memoryUsage');
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  },

  async getAppInfo() {
    try {
      return await ipcRenderer.invoke('system:appInfo');
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  },

  async getLogPath() {
    try {
      return await ipcRenderer.invoke('system:logPath');
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  },

  async resetConfig() {
    try {
      return await ipcRenderer.invoke('system:resetConfig');
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  },

  // ===== 設定情報関連 =====

  async getSharedDataPath() {
    try {
      return await ipcRenderer.invoke('settings:getSharedDataPath');
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  },

  async openSharedDataFolder() {
    try {
      return await ipcRenderer.invoke('settings:openSharedDataFolder');
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  },

  // ===== ダイアログ関連 =====

  async showError(title: string, message: string) {
    try {
      return await ipcRenderer.invoke('dialog:showError', title, message);
    } catch (error) {
      return { success: false };
    }
  },

  async showConfirm(title: string, message: string) {
    try {
      return await ipcRenderer.invoke('dialog:showConfirm', title, message);
    } catch (error) {
      return { success: false, confirmed: false };
    }
  },

  async selectFile(title: string, filters?: any[]) {
    try {
      return await ipcRenderer.invoke('dialog:selectFile', title, filters);
    } catch (error) {
      return { success: false, filePath: null };
    }
  },

  // ===== アプリ選択関連 =====

  async getSelectionOptions() {
    try {
      return await ipcRenderer.invoke('app-selection:getOptions');
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  },

  async getAvailableDisplays() {
    try {
      return await ipcRenderer.invoke('app-selection:getAvailableDisplays');
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  },

  async saveLastSelection(selection: any) {
    try {
      return await ipcRenderer.invoke('app-selection:saveLastSelection', selection);
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  },

  async getLastSelection() {
    try {
      return await ipcRenderer.invoke('app-selection:getLastSelection');
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  },

  // ===== アダプター関連 =====

  async getAvailableAdapters() {
    try {
      return await ipcRenderer.invoke('adapter:getAvailable');
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  },

  async getAdapterDropdownOptions() {
    try {
      return await ipcRenderer.invoke('adapter:getDropdownOptions');
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  },

  async getAdapterInfo(adapterId: string) {
    try {
      return await ipcRenderer.invoke('adapter:getInfo', adapterId);
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  },

  // ===== イベントリスナー =====

  onAnalysisUpdate(callback: (data: any) => void) {
    ipcRenderer.on('analysis-update', (_event, data) => {
      callback(data);
    });
  },

  onConfigUpdate(callback: (config: any) => void) {
    ipcRenderer.on('config-updated', (_event, config) => {
      callback(config);
    });
  },

  onAppInitialized(callback: (data: any) => void) {
    ipcRenderer.on('app-initialized', (_event, data) => {
      callback(data);
    });
  },

  // 🔥 自動キャプチャ完了イベント
  onAutoCaptureCompleted(callback: (data: any) => void) {
    ipcRenderer.on('auto-capture:completed', (_event, data) => {
      console.log('Auto capture completed event received:', data);
      callback(data);
    });
  },

  // 🔥 自動キャプチャエラーイベント
  onAutoCaptureError(callback: (data: any) => void) {
    ipcRenderer.on('auto-capture:error', (_event, data) => {
      console.log('Auto capture error event received:', data);
      callback(data);
    });
  },

  removeAllListeners() {
    ipcRenderer.removeAllListeners('analysis-update');
    ipcRenderer.removeAllListeners('config-updated');
    ipcRenderer.removeAllListeners('app-initialized');
    ipcRenderer.removeAllListeners('auto-capture:completed');
    ipcRenderer.removeAllListeners('auto-capture:error');
  }
};

// セキュリティブリッジを通じてAPIを公開
contextBridge.exposeInMainWorld('appVisionAPI', appVisionAPI);

// Electron API（IPC通信用）を公開
contextBridge.exposeInMainWorld('electronAPI', {
  ipcRenderer: {
    on: (channel: string, listener: (event: any, ...args: any[]) => void) => {
      ipcRenderer.on(channel, listener);
    },
    off: (channel: string, listener: (...args: any[]) => void) => {
      ipcRenderer.off(channel, listener);
    },
    send: (channel: string, ...args: any[]) => {
      ipcRenderer.send(channel, ...args);
    }
  }
});

// プロセス情報のログ出力（デバッグ用）
console.log('App Vision MCP Preload script loaded');
console.log('Node version:', process.versions.node);
console.log('Chrome version:', process.versions.chrome);
console.log('Electron version:', process.versions.electron);

// ウィンドウのセキュリティ情報
console.log('Context isolation:', process.contextIsolated);
console.log('Node integration:', process.env.NODE_ENV);

// エラーハンドリング（シンプル版）
console.log('Error handling setup - errors will be logged to console');

// Preload script の初期化完了を通知
ipcRenderer.send('preload-ready');

export {}; // TypeScript module として認識させるため