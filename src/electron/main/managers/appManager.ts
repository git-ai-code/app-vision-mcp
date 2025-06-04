/**
 * App Vision MCP - Application Manager
 * アプリケーション全体のライフサイクルと状態管理
 */

import { app, dialog } from 'electron';
import { WindowManager } from './windowManager';
import { ServiceManager } from './serviceManager';
import { IPCHandlers } from '../handlers/ipcHandlers';
import { AppConfig, defaultConfig } from '../../assets/config/appConfig';
import { getLogger } from '../../utils/logger';

const logger = getLogger();

export class AppManager {
  private windowManager: WindowManager;
  private serviceManager: ServiceManager;
  private ipcHandlers: IPCHandlers;
  private config: AppConfig;
  private isInitialized: boolean = false;
  private isQuitting: boolean = false;

  constructor(config?: Partial<AppConfig>) {
    // 設定のマージ
    this.config = { ...defaultConfig, ...config };
    
    // ハードウェアアクセラレーション無効化（文字化け解決）
    app.disableHardwareAcceleration();
    
    // マネージャーの初期化
    this.windowManager = new WindowManager(this.config);
    this.serviceManager = new ServiceManager(this.config);
    this.ipcHandlers = new IPCHandlers(this.serviceManager, this.config);
    
    // アプリケーションイベントのセットアップ
    this.setupAppEvents();
  }

  /**
   * アプリケーションの初期化
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('AppManager is already initialized');
      return;
    }

    try {
      // Electronアプリの準備待ち
      if (!app.isReady()) {
        await app.whenReady();
      }
      
      // サービスマネージャーの初期化（MCP接続等）
      await this.serviceManager.initialize();
      
      // IPC ハンドラーの設定
      this.ipcHandlers.setupHandlers();
      
      // メインウィンドウの作成
      await this.windowManager.createMainWindow();
      
      // 🔥 重要！MainWindowをServiceManagerに設定（UI更新通知用）
      const mainWindow = this.windowManager.getMainWindow();
      if (mainWindow) {
        this.serviceManager.setMainWindow(mainWindow);
      } else {
        logger.warn('MainWindow not available for UI notifications');
      }
      
      this.isInitialized = true;
      
    } catch (error) {
      logger.error('Failed to initialize AppManager:', error);
      
      // 初期化エラーダイアログ
      dialog.showErrorBox(
        'Initialization Error', 
        `Failed to initialize ${this.config.app.name}. Please check the logs.`
      );
      
      // アプリケーション終了
      app.quit();
      throw error;
    }
  }

  /**
   * アプリケーションのクリーンアップと終了
   */
  async cleanup(): Promise<void> {
    if (!this.isInitialized || this.isQuitting) {
      return;
    }
    
    this.isQuitting = true;
    
    try {
      // サービスの停止
      await this.serviceManager.cleanup();
      
      // ウィンドウの閉鎖
      await this.windowManager.cleanup();
      
      // IPCハンドラーのクリーンアップ
      this.ipcHandlers.cleanup();
      
    } catch (error) {
      logger.error('Error during cleanup:', error);
    }
  }

  /**
   * アプリケーション設定の更新
   */
  updateConfig(newConfig: Partial<AppConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // 各マネージャーに設定変更を通知
    this.windowManager.updateConfig(this.config);
    this.serviceManager.updateConfig(this.config);
    this.ipcHandlers.updateConfig(this.config);
    
  }

  /**
   * 現在の設定を取得
   */
  getConfig(): AppConfig {
    return { ...this.config };
  }

  /**
   * アプリケーションイベントのセットアップ
   */
  private setupAppEvents(): void {
    // アプリ準備完了
    app.on('ready', () => {
      // Electronアプリ準備完了
    });

    // 全ウィンドウが閉じられた
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    // アプリがアクティブになった
    app.on('activate', async () => {
      if (this.windowManager.getMainWindow() === null) {
        await this.windowManager.createMainWindow();
      }
    });

    // アプリ終了前
    app.on('before-quit', async (event) => {
      if (this.isInitialized && !this.isQuitting) {
        event.preventDefault();
        await this.cleanup();
        app.exit(0);
      }
    });

    // 未処理例外の処理
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      dialog.showErrorBox('Unexpected Error', error.message);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection', { 
        promise: promise.toString(), 
        reason: reason 
      });
    });
  }

  /**
   * アプリケーション情報の取得
   */
  getAppInfo() {
    return {
      name: this.config.app.name,
      version: this.config.app.version,
      isInitialized: this.isInitialized,
      platform: process.platform,
      nodeVersion: process.version,
      electronVersion: process.versions.electron
    };
  }
}