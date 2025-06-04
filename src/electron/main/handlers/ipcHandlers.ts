/**
 * App Vision MCP - IPC Handlers
 * メインプロセスとレンダラープロセス間の通信処理
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { ServiceManager } from '../managers/serviceManager';
import { AppConfig } from '../../assets/config/appConfig';
import { SelectionOption } from '../services/appDiscoveryService';
import { getLogger } from '../../utils/logger';

const logger = getLogger();

export class IPCHandlers {
  private serviceManager: ServiceManager;
  private config: AppConfig;
  private handlersRegistered: boolean = false;

  constructor(serviceManager: ServiceManager, config: AppConfig) {
    this.serviceManager = serviceManager;
    this.config = config;
  }

  /**
   * 全IPCハンドラーの設定
   */
  setupHandlers(): void {
    if (this.handlersRegistered) {
      logger.warn('IPC handlers already registered');
      return;
    }

    // キャプチャ関連
    this.setupCaptureHandlers();
    
    // アプリケーション設定関連
    this.setupConfigHandlers();
    
    // システム情報関連
    this.setupSystemHandlers();
    
    // アプリ選択関連
    this.setupAppSelectionHandlers();
    
    // アダプター関連
    this.setupAdapterHandlers();
    
    // ダイアログ関連
    this.setupDialogHandlers();

    this.handlersRegistered = true;
  }

  /**
   * キャプチャ関連のIPCハンドラー
   */
  private setupCaptureHandlers(): void {
    // キャプチャ開始
    ipcMain.handle('capture:start', async () => {
      try {
        const result = await this.serviceManager.startCapture();
        return result;
      } catch (error) {
        logger.error('Failed to start capture:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
        };
      }
    });

    // キャプチャ停止
    ipcMain.handle('capture:stop', async () => {
      try {
        const result = await this.serviceManager.stopCapture();
        return result;
      } catch (error) {
        logger.error('Failed to stop capture:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
        };
      }
    });

    // 手動キャプチャ
    ipcMain.handle('capture:manual', async (
      _event: IpcMainInvokeEvent, 
      targetApp?: string | null
    ) => {
      try {
        const result = await this.serviceManager.manualCapture(targetApp);
        if (!result.success) {
          logger.warn('Manual capture failed', result.error);
        }
        return result;
      } catch (error) {
        logger.error('Manual capture error:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
        };
      }
    });

    // 新しいスクリーンキャプチャ
    ipcMain.handle('screen:capture', async (
      _event: IpcMainInvokeEvent, 
      targetApp?: string
    ) => {
      try {
        const result = await this.serviceManager.performScreenCapture(targetApp);
        if (result.success) {
          // Screen capture completed
        } else {
          logger.warn('Screen capture failed', result.error);
        }
        return result;
      } catch (error) {
        logger.error('Screen capture error:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
        };
      }
    });

    // 最新のスクリーンショット情報取得
    ipcMain.handle('screen:getLatest', async () => {
      logger.debug('IPC: screen:getLatest called');
      try {
        const fileManager = this.serviceManager.getFileManager();
        if (!fileManager) {
          return { success: false, error: 'FileManager not available' };
        }

        const hasLatest = await fileManager.hasLatestScreenshot();
        if (!hasLatest) {
          return { success: false, error: 'No latest screenshot available' };
        }

        const latestPath = fileManager.getLatestScreenshotPath();
        const metadata = await fileManager.getLatestCaptureMetadata();

        return {
          success: true,
          data: {
            filePath: latestPath,
            metadata
          }
        };
      } catch (error) {
        logger.error('Failed to get latest screenshot:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
        };
      }
    });

    // ファイル統計情報取得
    ipcMain.handle('files:getStats', async () => {
      logger.debug('IPC: files:getStats called');
      try {
        const fileManager = this.serviceManager.getFileManager();
        if (!fileManager) {
          return { success: false, error: 'FileManager not available' };
        }

        const stats = await fileManager.getFileStats();
        return {
          success: true,
          data: stats
        };
      } catch (error) {
        logger.error('Failed to get file stats:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
        };
      }
    });

    // キャプチャ状態取得
    ipcMain.handle('capture:status', async () => {
      logger.debug('IPC: capture:status called');
      const status = this.serviceManager.getStatus();
      return {
        success: true,
        status
      };
    });

    // 対象アプリケーション設定
    ipcMain.handle('capture:setTargetApp', async (
      _event: IpcMainInvokeEvent, 
      appName: string, 
      patterns: string[]
    ) => {
      try {
        this.serviceManager.setTargetApplication(appName, patterns);
        
        // 設定を永続化
        this.config.targetApp.name = appName;
        this.config.targetApp.windowTitlePatterns = patterns;
        
        return { success: true };
      } catch (error) {
        logger.error('Failed to set target app:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
        };
      }
    });

    // キャプチャ中の対象変更（リアルタイム）
    ipcMain.handle('capture:changeTarget', async (
      _event: IpcMainInvokeEvent, 
      targetApp: string
    ) => {
      try {
        const result = await this.serviceManager.changeTargetDuringCapture(targetApp);
        
        if (result.success) {
          // 設定も更新
          this.config.targetApp.name = targetApp;
          this.config.targetApp.lastSelected = targetApp;
        }
        
        return result;
      } catch (error) {
        logger.error('Failed to change target during capture:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
        };
      }
    });

    // 手動キャプチャ済みフラグ管理
    ipcMain.handle('capture:hasManualCaptureFlag', async () => {
      logger.debug('IPC: capture:hasManualCaptureFlag called');
      try {
        const fileManager = this.serviceManager.getFileManager();
        if (!fileManager) {
          return { success: false, error: 'FileManager not available' };
        }
        const hasFlag = await fileManager.hasManualCaptureDoneFlag();
        return { success: true, hasFlag };
      } catch (error) {
        logger.error('Failed to check manual capture flag:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
        };
      }
    });

    ipcMain.handle('capture:createManualCaptureFlag', async () => {
      logger.debug('IPC: capture:createManualCaptureFlag called');
      try {
        const fileManager = this.serviceManager.getFileManager();
        if (!fileManager) {
          return { success: false, error: 'FileManager not available' };
        }
        await fileManager.createManualCaptureDoneFlag();
        return { success: true };
      } catch (error) {
        logger.error('Failed to create manual capture flag:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
        };
      }
    });

    ipcMain.handle('capture:clearManualCaptureFlag', async () => {
      logger.debug('IPC: capture:clearManualCaptureFlag called');
      try {
        const fileManager = this.serviceManager.getFileManager();
        if (!fileManager) {
          return { success: false, error: 'FileManager not available' };
        }
        await fileManager.clearManualCaptureDoneFlag();
        return { success: true };
      } catch (error) {
        logger.error('Failed to clear manual capture flag:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
        };
      }
    });
  }

  /**
   * アプリケーション設定関連のIPCハンドラー
   */
  private setupConfigHandlers(): void {
    // 設定取得
    ipcMain.handle('config:get', async () => {
      logger.debug('IPC: config:get called');
      return {
        success: true,
        config: this.config
      };
    });

    // 設定更新
    ipcMain.handle('config:update', async (
      _event: IpcMainInvokeEvent, 
      updates: Partial<AppConfig>
    ) => {
      try {
        // 設定のマージ
        this.config = { ...this.config, ...updates };
        
        // サービスマネージャーに設定変更を通知
        this.serviceManager.updateConfig(this.config);
        
        return { 
          success: true,
          config: this.config 
        };
      } catch (error) {
        logger.error('Failed to update config:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
        };
      }
    });

    // アダプター変更
    ipcMain.handle('config:setAdapter', async (
      _event: IpcMainInvokeEvent, 
      adapterId: string
    ) => {
      try {
        this.serviceManager.setAdapter(adapterId);
        this.config.targetApp.defaultAdapter = adapterId;
        
        return { success: true };
      } catch (error) {
        logger.error('Failed to set adapter:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
        };
      }
    });

    // テーマ変更
    ipcMain.handle('config:setTheme', async (
      _event: IpcMainInvokeEvent, 
      theme: 'light' | 'dark'
    ) => {
      try {
        this.config.ui.theme = theme;
        return { success: true };
      } catch (error) {
        logger.error('Failed to set theme:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
        };
      }
    });
  }

  /**
   * システム情報関連のIPCハンドラー
   */
  private setupSystemHandlers(): void {
    // メモリ使用量取得
    ipcMain.handle('system:memoryUsage', async () => {
      const used = process.memoryUsage();
      const memoryMB = Math.round(used.heapUsed / 1024 / 1024);
      logger.debug('IPC: system:memoryUsage called', { memoryMB });
      return {
        success: true,
        memoryMB
      };
    });

    // ログパス取得
    ipcMain.handle('system:logPath', async () => {
      const logPath = logger.getLogPath();
      logger.debug('IPC: system:logPath called', { logPath });
      return {
        success: true,
        logPath
      };
    });

    // アプリケーション情報取得
    ipcMain.handle('system:appInfo', async () => {
      logger.debug('IPC: system:appInfo called');
      
      // package.jsonから動的にバージョンを取得
      let packageVersion = '1.0.0';
      try {
        const packageJson = require('../../../package.json');
        packageVersion = packageJson.version;
      } catch (error) {
        logger.warn('Failed to load package.json version, using fallback:', packageVersion);
      }
      
      return {
        success: true,
        info: {
          name: this.config.app.name,
          version: packageVersion,
          platform: process.platform,
          nodeVersion: process.version,
          electronVersion: process.versions.electron
        }
      };
    });

    // 設定リセット
    ipcMain.handle('system:resetConfig', async () => {
      try {
        // デフォルト設定に戻す（一部設定は保持）
        const { targetApp } = this.config;
        const { defaultConfig } = await import('../../assets/config/appConfig');
        
        this.config = {
          ...defaultConfig,
          targetApp: targetApp // 現在の対象アプリ設定は保持
        };
        
        this.serviceManager.updateConfig(this.config);
        
        return { 
          success: true,
          config: this.config 
        };
      } catch (error) {
        logger.error('Failed to reset config:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
        };
      }
    });

    // 共有データパス取得
    ipcMain.handle('settings:getSharedDataPath', async () => {
      try {
        logger.debug('IPC: settings:getSharedDataPath called');
        const sharedDataPath = this.config.environment.sharedDataPath;
        return {
          success: true,
          path: sharedDataPath
        };
      } catch (error) {
        logger.error('IPC: Failed to get shared data path:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    });

    // 共有データフォルダを開く
    ipcMain.handle('settings:openSharedDataFolder', async () => {
      try {
        logger.debug('IPC: settings:openSharedDataFolder called');
        const { shell } = require('electron');
        const path = require('path');
        let sharedDataPath = this.config.environment.sharedDataPath;
        
        // Windowsの場合、パスをbackslash形式に正規化
        if (process.platform === 'win32') {
          sharedDataPath = sharedDataPath.replace(/\//g, '\\');
        }
        
        
        // フォルダが存在しない場合は作成
        const fs = require('fs');
        
        if (!fs.existsSync(sharedDataPath)) {
          fs.mkdirSync(sharedDataPath, { recursive: true });
        }
        
        // フォルダの存在を再確認
        if (!fs.existsSync(sharedDataPath)) {
          throw new Error(`Directory does not exist after creation attempt: ${sharedDataPath}`);
        }
        
        // shell.openPathの結果を確認
        const result = await shell.openPath(sharedDataPath);
        if (result) {
          // resultが空文字列でない場合はエラー
          logger.error('shell.openPath returned error:', result);
          throw new Error(`Failed to open folder: ${result}`);
        }
        
        return {
          success: true
        };
      } catch (error) {
        logger.error('IPC: Failed to open shared data folder:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    });
  }

  /**
   * ダイアログ関連のIPCハンドラー
   */
  private setupDialogHandlers(): void {
    // エラーダイアログ表示
    ipcMain.handle('dialog:showError', async (
      _event: IpcMainInvokeEvent, 
      title: string, 
      message: string
    ) => {
      // WindowManagerを通じてダイアログ表示（実装は後で追加）
      return { success: true };
    });

    // 確認ダイアログ表示
    ipcMain.handle('dialog:showConfirm', async (
      _event: IpcMainInvokeEvent, 
      title: string, 
      message: string
    ) => {
      // WindowManagerを通じてダイアログ表示（実装は後で追加）
      return { 
        success: true, 
        confirmed: true // 暫定値
      };
    });

    // ファイル選択ダイアログ
    ipcMain.handle('dialog:selectFile', async (
      _event: IpcMainInvokeEvent, 
      title: string, 
      filters?: any[]
    ) => {
      // WindowManagerを通じてダイアログ表示（実装は後で追加）
      return { 
        success: true, 
        filePath: null // 暫定値
      };
    });
  }

  /**
   * 設定の更新
   */
  updateConfig(newConfig: AppConfig): void {
    this.config = newConfig;
  }


  /**
   * アダプター関連のIPCハンドラー
   */
  private setupAdapterHandlers(): void {
    // 利用可能なアダプター一覧取得
    ipcMain.handle('adapter:getAvailable', async () => {
      try {
        const adapters = await this.serviceManager.getAvailableAdapters();
        return { success: true, adapters };
      } catch (error) {
        logger.error('Failed to get available adapters:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // アダプタードロップダウン用オプション取得
    ipcMain.handle('adapter:getDropdownOptions', async () => {
      try {
        const options = await this.serviceManager.getAdapterDropdownOptions();
        return { success: true, options };
      } catch (error) {
        logger.error('Failed to get adapter dropdown options:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // 特定のアダプター情報取得
    ipcMain.handle('adapter:getInfo', async (event: IpcMainInvokeEvent, adapterId: string) => {
      try {
        const adapterInfo = await this.serviceManager.getAdapterInfo(adapterId);
        if (adapterInfo) {
          return { success: true, adapter: adapterInfo };
        } else {
          return { success: false, error: 'Adapter not found' };
        }
      } catch (error) {
        logger.error('Failed to get adapter info:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });
  }

  /**
   * アプリ選択関連のIPCハンドラー
   */
  private setupAppSelectionHandlers(): void {
    // 選択オプション一覧取得（アプリ、ディスプレイ、特殊選択）
    ipcMain.handle('app-selection:getOptions', async () => {
      try {
        const options = await this.serviceManager.getSelectionOptions();
        return { success: true, options };
      } catch (error) {
        logger.error('Failed to get selection options:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // 利用可能なアプリケーション一覧取得
    ipcMain.handle('app-selection:getAvailableApps', async () => {
      try {
        const apps = await this.serviceManager.getAvailableApps();
        return { success: true, apps };
      } catch (error) {
        logger.error('Failed to get available apps:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // 利用可能なディスプレイ一覧取得
    ipcMain.handle('app-selection:getAvailableDisplays', async () => {
      try {
        const displays = await this.serviceManager.getAvailableDisplays();
        return { success: true, displays };
      } catch (error) {
        logger.error('Failed to get available displays:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // 前回選択の保存
    ipcMain.handle('app-selection:saveLastSelection', async (event: IpcMainInvokeEvent, selection: SelectionOption) => {
      try {
        // SelectionOptionをLastSelectedApp形式に変換
        const lastSelected = {
          type: selection.type === 'application' ? 'app' as const : 'display' as const,
          name: selection.name,
          windowTitle: selection.type === 'application' ? selection.displayName : undefined,
          adapterId: selection.adapterType,
          timestamp: Date.now()
        };
        
        // 設定に保存（将来的にはFileManagerを使用）
        this.config.targetApp.lastSelected = lastSelected;
        return { success: true };
      } catch (error) {
        logger.error('Failed to save last selection:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // 前回選択の取得
    ipcMain.handle('app-selection:getLastSelection', async () => {
      try {
        const lastSelection = this.config.targetApp.lastSelected || null;
        return { success: true, selection: lastSelection };
      } catch (error) {
        logger.error('Failed to get last selection:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });
  }

  /**
   * クリーンアップ
   */
  cleanup(): void {
    if (this.handlersRegistered) {
      // 登録したハンドラーを削除
      ipcMain.removeAllListeners('capture:start');
      ipcMain.removeAllListeners('capture:stop');
      ipcMain.removeAllListeners('capture:manual');
      ipcMain.removeAllListeners('capture:status');
      ipcMain.removeAllListeners('capture:setTargetApp');
      ipcMain.removeAllListeners('capture:changeTarget');
      
      ipcMain.removeAllListeners('config:get');
      ipcMain.removeAllListeners('config:update');
      ipcMain.removeAllListeners('config:setAdapter');
      ipcMain.removeAllListeners('config:setTheme');
      
      ipcMain.removeAllListeners('system:memoryUsage');
      ipcMain.removeAllListeners('system:logPath');
      ipcMain.removeAllListeners('system:appInfo');
      ipcMain.removeAllListeners('system:resetConfig');
      
      ipcMain.removeAllListeners('dialog:showError');
      ipcMain.removeAllListeners('dialog:showConfirm');
      ipcMain.removeAllListeners('dialog:selectFile');
      
      ipcMain.removeAllListeners('app-selection:getOptions');
      ipcMain.removeAllListeners('app-selection:getAvailableApps');
      ipcMain.removeAllListeners('app-selection:getAvailableDisplays');
      ipcMain.removeAllListeners('app-selection:saveLastSelection');
      ipcMain.removeAllListeners('app-selection:getLastSelection');
      
      this.handlersRegistered = false;
    }
  }
}