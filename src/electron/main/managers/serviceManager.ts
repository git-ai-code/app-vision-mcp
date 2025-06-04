/**
 * App Vision MCP - Service Manager
 * 各種サービス（キャプチャ、解析、MCP統合等）の統合管理
 */

import { AppConfig } from '../../assets/config/appConfig';
import { getLogger } from '../../utils/logger';
import { ScreenCaptureService } from '../services/screenCaptureService';
import { FileManager } from '../services/fileManager';
import { AppDiscoveryService, SelectionOption } from '../services/appDiscoveryService';
import { formatDataDateTime } from '../../../utils/dateFormatter.js';
import { AdapterService, AdapterInfo } from '../services/adapterService';
import { HeartbeatService } from '../services/heartbeatService';
import { RequestMonitorService } from '../services/requestMonitorService';
import { SuggestionMonitorService } from '../services/suggestionMonitorService';
import path from 'path';

const logger = getLogger();

export interface CaptureResult {
  image: Electron.NativeImage | Buffer; // Electronのネイティブ画像またはバッファ
  windowTitle: string;
  bounds: { x: number; y: number; width: number; height: number };
  timestamp: string;
}

export interface AnalysisResult {
  detected: Record<string, unknown>; // 検出された要素の詳細情報
  suggestions: string[];
  metadata: {
    analysisTime?: number;
    confidence?: number;
    [key: string]: unknown;
  };
}

export interface ServiceStatus {
  captureActive: boolean;
  captureMode: 'on-demand' | 'interval' | 'manual';
  targetApp: string;
  adapter: string;
  lastCapture?: string;
  errorCount: number;
}


export class ServiceManager {
  private config: AppConfig;
  private serviceStatus: ServiceStatus;
  private isInitialized: boolean = false;
  
  // 新しいサービス
  private screenCaptureService: ScreenCaptureService | null = null;
  private fileManager: FileManager | null = null;
  private appDiscoveryService: AppDiscoveryService | null = null;
  private adapterService: AdapterService | null = null;
  private heartbeatService: HeartbeatService | null = null;
  private requestMonitorService: RequestMonitorService | null = null;
  private suggestionMonitorService: SuggestionMonitorService | null = null;
  
  // MainWindow参照（UI更新通知用）
  private mainWindow: Electron.BrowserWindow | null = null;

  constructor(config: AppConfig) {
    this.config = config;
    this.serviceStatus = {
      captureActive: false,
      captureMode: 'manual',
      targetApp: '',
      adapter: config.targetApp.defaultAdapter,
      errorCount: 0
    };
  }


  /**
   * 全サービスの初期化
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('ServiceManager is already initialized');
      return;
    }

    try {
      // ファイル管理サービスの初期化
      await this.initializeFileManager();
      
      // 新しいスクリーンキャプチャサービスの初期化
      await this.initializeScreenCaptureService();
      
      // アプリ検出サービスの初期化
      await this.initializeAppDiscoveryService();
      
      // アダプターサービスの初期化
      await this.initializeAdapterService();
      
      // ハートビートサービスの初期化
      await this.initializeHeartbeatService();
      
      // RequestMonitorService の初期化
      await this.initializeRequestMonitorService();
      
      // SuggestionMonitorService の初期化
      await this.initializeSuggestionMonitorService();
      
      // 🔥 重要: RequestMonitorServiceとScreenCaptureServiceを連携
      if (this.requestMonitorService && this.screenCaptureService) {
        this.requestMonitorService.setScreenCaptureService(this.screenCaptureService);
      }
      
      
      this.isInitialized = true;
      
    } catch (error) {
      logger.error('Failed to initialize services:', error);
      throw error;
    }
  }

  /**
   * ファイル管理サービスの初期化
   */
  private async initializeFileManager(): Promise<void> {
    
    // プロジェクトルートを取得（実行時のディレクトリから）
    const projectRoot = process.cwd();
    
    // 環境設定から共有データディレクトリを取得
    const sharedDataDir = this.config.environment.sharedDataPath;
    
    this.fileManager = new FileManager({
      projectRoot,
      sharedDataDir
    });
    
    await this.fileManager.initializeDirectories();
    
    // 起動時の履歴クリーンアップを実行
    await this.fileManager.cleanupOnStartup();
  }

  /**
   * 新しいスクリーンキャプチャサービスの初期化
   */
  private async initializeScreenCaptureService(): Promise<void> {
    
    if (!this.fileManager) {
      throw new Error('FileManager must be initialized first');
    }
    
    this.screenCaptureService = new ScreenCaptureService(this.fileManager);
  }

  /**
   * アプリ検出サービスの初期化
   */
  private async initializeAppDiscoveryService(): Promise<void> {
    
    this.appDiscoveryService = new AppDiscoveryService();
  }

  /**
   * アダプターサービスの初期化
   */
  private async initializeAdapterService(): Promise<void> {
    
    this.adapterService = new AdapterService();
  }

  /**
   * ハートビートサービスの初期化
   */
  private async initializeHeartbeatService(): Promise<void> {
    
    if (!this.fileManager) {
      throw new Error('FileManager must be initialized first');
    }
    
    const sharedDataDir = this.fileManager.getSharedDataPath();
    this.heartbeatService = new HeartbeatService(sharedDataDir);
    
    // ハートビート開始
    await this.heartbeatService.start();
  }

  /**
   * RequestMonitorService の初期化
   */
  private async initializeRequestMonitorService(): Promise<void> {
    
    if (!this.fileManager) {
      throw new Error('FileManager must be initialized first');
    }
    
    const sharedDataDir = this.fileManager.getSharedDataPath();
    this.requestMonitorService = new RequestMonitorService(sharedDataDir);
    
    // 🔥 重要: AppConfigを注入
    this.requestMonitorService.setConfig(this.config);
    
    // フラグファイル監視開始
    await this.requestMonitorService.start();
  }

  /**
   * SuggestionMonitorService の初期化
   */
  private async initializeSuggestionMonitorService(): Promise<void> {
    
    if (!this.fileManager) {
      throw new Error('FileManager must be initialized first');
    }
    
    const sharedDataDir = this.fileManager.getSharedDataPath();
    this.suggestionMonitorService = new SuggestionMonitorService(sharedDataDir, this.mainWindow);
    
    // AI提案監視開始
    await this.suggestionMonitorService.startMonitoring();
  }


  /**
   * 新しいキャプチャシステムでの画面キャプチャ実行
   */
  async performScreenCapture(targetApp?: string): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      if (!this.screenCaptureService) {
        throw new Error('ScreenCaptureService not initialized');
      }

      let result;
      
      if (targetApp && targetApp.trim()) {
        // 対象アプリケーション・ディスプレイのキャプチャ（統一処理）
        result = await this.screenCaptureService.captureTargetApp(targetApp, 'automatic');
      } else {
        // 全画面キャプチャ
        result = await this.screenCaptureService.captureFullScreen('automatic');
      }

      if (result.success) {
        this.serviceStatus.lastCapture = formatDataDateTime();

        // 初回キャプチャ開始成功ログ
        const fileSizeKB = result.metadata?.size 
          ? Math.round(result.metadata.size / 1024) 
          : 'unknown';
        logger.info('Initial capture started', { 
          target: targetApp || 'fullscreen', 
          fileSize: `${fileSizeKB}KB`,
          captureType: 'initial-start'
        });

        // UI更新通知をRenderer側に送信（直接APIコール用）
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('auto-capture:completed', {
            filePath: result.filePath,
            targetApp,
            timestamp: formatDataDateTime(),
            success: true
          });
        } else {
          logger.warn('MainWindow not available for UI notification');
        }
      }

      return {
        success: result.success,
        filePath: result.filePath,
        error: result.error
      };

    } catch (error) {
      logger.error('Screen capture failed:', error);
      this.serviceStatus.errorCount++;
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * ファイル管理サービスへのアクセス
   */
  getFileManager(): FileManager | null {
    return this.fileManager;
  }

  /**
   * スクリーンキャプチャサービスへのアクセス
   */
  getScreenCaptureService(): ScreenCaptureService | null {
    return this.screenCaptureService;
  }

  /**
   * メインウィンドウの設定（UI更新通知用）
   */
  setMainWindow(mainWindow: Electron.BrowserWindow | null): void {
    this.mainWindow = mainWindow;
    
    if (this.requestMonitorService && mainWindow) {
      this.requestMonitorService.setMainWindow(mainWindow);
    }
    
    if (this.suggestionMonitorService && mainWindow) {
      this.suggestionMonitorService.setMainWindow(mainWindow);
    }
  }

  /**
   * キャプチャの開始
   */
  async startCapture(): Promise<{ success: boolean; mode: string; error?: string }> {
    try {
      // 新しい実装：ステータスの更新のみ
      this.serviceStatus.captureActive = true;
      this.serviceStatus.captureMode = 'on-demand';
      
      return { 
        success: true, 
        mode: this.serviceStatus.captureMode 
      };
    } catch (error) {
      logger.error('Failed to start capture:', error);
      this.serviceStatus.errorCount++;
      return { 
        success: false, 
        mode: this.serviceStatus.captureMode,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * キャプチャの停止
   */
  async stopCapture(): Promise<{ success: boolean }> {
    try {
      // 新しい実装：ステータスの更新のみ
      this.serviceStatus.captureActive = false;
      return { success: true };
    } catch (error) {
      logger.error('Failed to stop capture:', error);
      this.serviceStatus.errorCount++;
      return { success: false };
    }
  }

  /**
   * 手動キャプチャの実行
   */
  async manualCapture(requestedTargetApp?: string | null): Promise<{ success: boolean; result?: CaptureResult; error?: string }> {
    try {
      if (!this.screenCaptureService) {
        throw new Error('ScreenCaptureService not initialized');
      }

      // 引数で指定されたtargetAppを優先、なければ現在の設定を使用
      const targetApp = requestedTargetApp ?? this.serviceStatus.targetApp;
      let result;
      
      if (targetApp && targetApp.trim() && targetApp !== 'fullscreen') {
        // 対象アプリケーションのキャプチャ（手動）
        result = await this.screenCaptureService.captureTargetApp(targetApp, 'manual');
      } else {
        // 全画面キャプチャ（手動）
        result = await this.screenCaptureService.captureFullScreen('manual');
      }

      if (result.success) {
        this.serviceStatus.lastCapture = formatDataDateTime();

        // 手動キャプチャ成功ログ
        const fileSizeKB = result.metadata?.size 
          ? Math.round(result.metadata.size / 1024) 
          : 'unknown';
        logger.info('Manual capture completed', { 
          target: targetApp || 'fullscreen', 
          fileSize: `${fileSizeKB}KB`,
          captureType: 'manual'
        });

        // 結果を従来の形式に変換
        const legacyResult: CaptureResult = {
          image: Buffer.alloc(0), // 実際のイメージデータが必要な場合は別途処理
          windowTitle: targetApp || 'Unknown Application',
          bounds: { x: 0, y: 0, width: 1920, height: 1080 },
          timestamp: result.timestamp ? formatDataDateTime(result.timestamp) : formatDataDateTime()
        };

        return { success: true, result: legacyResult };
      } else {
        return { success: false, error: result.error || 'Manual capture failed' };
      }
    } catch (error) {
      logger.error('Manual capture failed:', error);
      this.serviceStatus.errorCount++;
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 対象アプリケーションの設定
   */
  setTargetApplication(appName: string, patterns: string[]): void {
    // レガシーサービスへの依存を削除
    this.serviceStatus.targetApp = appName;
    this.config.targetApp.name = appName;
    this.config.targetApp.windowTitlePatterns = patterns;
  }

  /**
   * キャプチャ中の対象変更（リアルタイム）
   */
  async changeTargetDuringCapture(targetApp: string): Promise<{ 
    success: boolean; 
    captureActive: boolean; 
    newTarget: string;
    error?: string 
  }> {
    try {
      
      // 対象アプリケーションを更新
      this.serviceStatus.targetApp = targetApp;
      this.config.targetApp.name = targetApp;
      this.config.targetApp.lastSelected = targetApp;
      
      // レガシーサービスへの通知は削除
      
      // 新しい対象で即座にキャプチャを実行（captureActiveの状態に関係なく）
      if (this.screenCaptureService) {
        const captureResult = await this.screenCaptureService.captureTargetApp(targetApp, 'automatic');
        
        if (captureResult.success && captureResult.filePath) {
          // ファイルサイズもチェック
          const fs = require('fs');
          const fileStats = fs.statSync(captureResult.filePath);
          
          if (fileStats.size > 0) {
            this.serviceStatus.lastCapture = formatDataDateTime();

            // ターゲット変更キャプチャ成功ログ
            const fileSizeKB = fileStats.size 
              ? Math.round(fileStats.size / 1024) 
              : 'unknown';
            logger.info('Target change capture completed', { 
              target: targetApp, 
              fileSize: `${fileSizeKB}KB`,
              captureType: 'target-change'
            });

            // UI更新通知をRenderer側に送信（対象変更時・直接APIコール用）
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
              this.mainWindow.webContents.send('auto-capture:completed', {
                filePath: captureResult.filePath,
                targetApp: targetApp,
                timestamp: formatDataDateTime(),
                success: true
              });
            } else {
              logger.warn('MainWindow not available for UI notification (target change)');
            }
          } else {
            logger.error('Immediate capture failed: App not capturable (WGC limitation)', {
              filePath: captureResult.filePath,
              newTarget: targetApp
            });
            return {
              success: false,
              captureActive: this.serviceStatus.captureActive,
              newTarget: this.serviceStatus.targetApp,
              error: `キャプチャ対象「${targetApp}」はキャプチャできません。\n` +
                     `このアプリはWindows Graphics Capture APIでサポートされていません。\n` +
                     `• セキュリティ保護されたアプリ\n` +
                     `• 管理者権限で実行中のアプリ\n` +
                     `• 古いGDI/DirectDrawベースのアプリ\n` +
                     `代替として「ディスプレイ」キャプチャをお試しください。`
            };
          }
        } else {
          logger.error('Immediate capture with new target failed', captureResult.error);
          return {
            success: false,
            captureActive: this.serviceStatus.captureActive,
            newTarget: this.serviceStatus.targetApp,
            error: captureResult.error || 
              `キャプチャ対象「${targetApp}」のキャプチャに失敗しました。\n` +
              `一部のアプリはWindows Graphics Capture APIでキャプチャできません。\n` +
              `代替として「ディスプレイ」キャプチャをお試しください。`
          };
        }
      }
      
      return {
        success: true,
        captureActive: this.serviceStatus.captureActive,
        newTarget: targetApp
      };
      
    } catch (error) {
      logger.error('Failed to change target during capture:', error);
      return {
        success: false,
        captureActive: this.serviceStatus.captureActive,
        newTarget: this.serviceStatus.targetApp,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * アダプターの変更
   */
  setAdapter(adapterId: string): void {
    // レガシーサービスへの依存を削除
    this.serviceStatus.adapter = adapterId;
  }

  /**
   * サービス状態の取得
   */
  getStatus(): ServiceStatus {
    return { ...this.serviceStatus };
  }

  /**
   * 設定の更新
   */
  updateConfig(newConfig: AppConfig): void {
    this.config = newConfig;
    
    // アダプター設定の更新
    if (newConfig.targetApp.defaultAdapter !== this.serviceStatus.adapter) {
      this.serviceStatus.adapter = newConfig.targetApp.defaultAdapter;
    }
  }

  /**
   * クリーンアップ
   */
  async cleanup(): Promise<void> {
    
    try {
      // ハートビートサービスを最初に停止
      if (this.heartbeatService) {
        await this.heartbeatService.stop();
        this.heartbeatService = null;
      }
      
      // RequestMonitorService の停止
      if (this.requestMonitorService) {
        await this.requestMonitorService.stop();
        this.requestMonitorService = null;
      }
      
      // SuggestionMonitorService の停止
      if (this.suggestionMonitorService) {
        this.suggestionMonitorService.stopMonitoring();
        this.suggestionMonitorService = null;
      }
      
      if (this.screenCaptureService) {
        this.screenCaptureService.cleanup();
        this.screenCaptureService = null;
      }
      
      // レガシーサービスのクリーンアップは削除（すでに存在しないため）
      
      // ファイル管理サービスは最後にクリーンアップ
      this.fileManager = null;
      
      this.isInitialized = false;
      
    } catch (error) {
      logger.error('Error during service cleanup:', error);
    }
  }

  /**
   * 選択オプション一覧を取得（アプリ、ディスプレイ、特殊選択）
   */
  async getSelectionOptions(): Promise<SelectionOption[]> {
    if (!this.appDiscoveryService) {
      logger.warn('AppDiscoveryService not initialized');
      return [];
    }

    try {
      return await this.appDiscoveryService.getSelectionOptions();
    } catch (error) {
      logger.error('Failed to get selection options:', error);
      return [];
    }
  }

  /**
   * 利用可能なアプリケーション一覧を取得
   */
  async getAvailableApps() {
    if (!this.appDiscoveryService) {
      logger.warn('AppDiscoveryService not initialized');
      return [];
    }

    try {
      return await this.appDiscoveryService.getAvailableApps();
    } catch (error) {
      logger.error('Failed to get available apps:', error);
      return [];
    }
  }

  /**
   * 利用可能なディスプレイ一覧を取得
   */
  async getAvailableDisplays() {
    if (!this.appDiscoveryService) {
      logger.warn('AppDiscoveryService not initialized');
      return [];
    }

    try {
      return await this.appDiscoveryService.getAvailableDisplays();
    } catch (error) {
      logger.error('Failed to get available displays:', error);
      return [];
    }
  }

  /**
   * 利用可能なアダプター一覧を取得
   */
  async getAvailableAdapters(): Promise<AdapterInfo[]> {
    if (!this.adapterService) {
      logger.warn('AdapterService not initialized');
      return [];
    }

    try {
      return await this.adapterService.getAvailableAdapters();
    } catch (error) {
      logger.error('Failed to get available adapters:', error);
      return [];
    }
  }

  /**
   * アダプタードロップダウン用オプションを取得
   */
  async getAdapterDropdownOptions(): Promise<Array<{value: string, text: string, description?: string}>> {
    if (!this.adapterService) {
      logger.warn('AdapterService not initialized');
      return [{
        value: 'none',
        text: 'なし',
        description: 'アダプターサービスが初期化されていません'
      }];
    }

    try {
      return await this.adapterService.getAdapterDropdownOptions();
    } catch (error) {
      logger.error('Failed to get adapter dropdown options:', error);
      return [{
        value: 'error',
        text: 'エラー',
        description: 'アダプターオプションの取得に失敗しました'
      }];
    }
  }

  /**
   * 特定のアダプター情報を取得
   */
  async getAdapterInfo(adapterId: string): Promise<AdapterInfo | null> {
    if (!this.adapterService) {
      logger.warn('AdapterService not initialized');
      return null;
    }

    try {
      return this.adapterService.getAdapterInfo(adapterId) || null;
    } catch (error) {
      logger.error('Failed to get adapter info:', error);
      return null;
    }
  }
}