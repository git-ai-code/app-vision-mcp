/**
 * App Vision MCP - Preload Script
 * メインプロセスとレンダラープロセス間のセキュリティブリッジ
 */
import { contextBridge, ipcRenderer } from 'electron';
// メインプロセスとの通信API
const appVisionAPI = {
    // ===== キャプチャ関連 =====
    async startCapture() {
        try {
            return await ipcRenderer.invoke('capture:start');
        }
        catch (error) {
            console.error('startCapture error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    },
    async stopCapture() {
        try {
            return await ipcRenderer.invoke('capture:stop');
        }
        catch (error) {
            console.error('stopCapture error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    },
    async manualCapture() {
        try {
            return await ipcRenderer.invoke('capture:manual');
        }
        catch (error) {
            console.error('manualCapture error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    },
    async getCaptureStatus() {
        try {
            return await ipcRenderer.invoke('capture:status');
        }
        catch (error) {
            console.error('getCaptureStatus error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    },
    async setTargetApp(appName, patterns) {
        try {
            return await ipcRenderer.invoke('capture:setTargetApp', appName, patterns);
        }
        catch (error) {
            console.error('setTargetApp error:', error);
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
        }
        catch (error) {
            console.error('getConfig error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    },
    async updateConfig(updates) {
        try {
            return await ipcRenderer.invoke('config:update', updates);
        }
        catch (error) {
            console.error('updateConfig error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    },
    async setAdapter(adapterId) {
        try {
            return await ipcRenderer.invoke('config:setAdapter', adapterId);
        }
        catch (error) {
            console.error('setAdapter error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    },
    async setTheme(theme) {
        try {
            return await ipcRenderer.invoke('config:setTheme', theme);
        }
        catch (error) {
            console.error('setTheme error:', error);
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
        }
        catch (error) {
            console.error('getMemoryUsage error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    },
    async getAppInfo() {
        try {
            return await ipcRenderer.invoke('system:appInfo');
        }
        catch (error) {
            console.error('getAppInfo error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    },
    async getLogPath() {
        try {
            return await ipcRenderer.invoke('system:logPath');
        }
        catch (error) {
            console.error('getLogPath error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    },
    async resetConfig() {
        try {
            return await ipcRenderer.invoke('system:resetConfig');
        }
        catch (error) {
            console.error('resetConfig error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    },
    // ===== ダイアログ関連 =====
    async showError(title, message) {
        try {
            return await ipcRenderer.invoke('dialog:showError', title, message);
        }
        catch (error) {
            console.error('showError error:', error);
            return { success: false };
        }
    },
    async showConfirm(title, message) {
        try {
            return await ipcRenderer.invoke('dialog:showConfirm', title, message);
        }
        catch (error) {
            console.error('showConfirm error:', error);
            return { success: false, confirmed: false };
        }
    },
    async selectFile(title, filters) {
        try {
            return await ipcRenderer.invoke('dialog:selectFile', title, filters);
        }
        catch (error) {
            console.error('selectFile error:', error);
            return { success: false, filePath: null };
        }
    },
    // ===== イベントリスナー =====
    onAnalysisUpdate(callback) {
        ipcRenderer.on('analysis-update', (_event, data) => {
            callback(data);
        });
    },
    onConfigUpdate(callback) {
        ipcRenderer.on('config-updated', (_event, config) => {
            callback(config);
        });
    },
    onAppInitialized(callback) {
        ipcRenderer.on('app-initialized', (_event, data) => {
            callback(data);
        });
    },
    removeAllListeners() {
        ipcRenderer.removeAllListeners('analysis-update');
        ipcRenderer.removeAllListeners('config-updated');
        ipcRenderer.removeAllListeners('app-initialized');
    }
};
// セキュリティブリッジを通じてAPIを公開
contextBridge.exposeInMainWorld('appVisionAPI', appVisionAPI);
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
//# sourceMappingURL=preload.js.map