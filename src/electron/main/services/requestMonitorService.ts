import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { initializeLogger } from '../../utils/logger';
import { ScreenCaptureService } from './screenCaptureService';
import { BrowserWindow } from 'electron';
import { AppConfig } from '../../assets/config/appConfig';
import { formatDataDateTime } from '../../../utils/dateFormatter.js';

/**
 * キャプチャリクエスト情報
 */
export interface CaptureRequest {
  requestId: string;
  analysisType: 'basic' | 'detailed';
  saveToHistory?: boolean;
  timestamp: string;
}

/**
 * リクエスト監視サービス
 * MCPサーバーからのキャプチャリクエストを監視・処理
 * flags/capture-request.flag ファイルを監視して自動キャプチャを実行
 */
export class RequestMonitorService {
  private watcher: fsSync.FSWatcher | null = null;
  private processing = false;
  private logger = initializeLogger('info');
  private sharedDataDir: string;
  private flagFilePath: string;
  private screenCaptureService: ScreenCaptureService | null = null;
  private mainWindow: BrowserWindow | null = null;
  private config: AppConfig | null = null;

  constructor(sharedDataDir: string) {
    this.sharedDataDir = sharedDataDir;
    this.flagFilePath = path.join(sharedDataDir, 'flags', 'capture-request.flag');
  }

  /**
   * ScreenCaptureServiceインスタンスを設定
   */
  public setScreenCaptureService(screenCaptureService: ScreenCaptureService): void {
    this.screenCaptureService = screenCaptureService;
  }

  /**
   * メインウィンドウインスタンスを設定
   */
  public setMainWindow(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow;
  }

  /**
   * AppConfigインスタンスを設定
   */
  public setConfig(config: AppConfig): void {
    this.config = config;
  }

  /**
   * 監視サービス開始
   */
  async start(): Promise<void> {
    try {
      // 必要なディレクトリ作成
      await this.initializeDirectories();
      
      // フラグファイル監視開始
      await this.startRequestMonitoring();
      
    } catch (error) {
      this.logger.error('Failed to start RequestMonitorService:', error);
      throw error;
    }
  }

  /**
   * 監視サービス停止
   */
  async stop(): Promise<void> {
    try {
      if (this.watcher) {
        this.watcher.close();
        this.watcher = null;
      }
      
    } catch (error) {
      this.logger.error('Failed to stop RequestMonitorService:', error);
    }
  }

  /**
   * 必要なディレクトリ初期化
   */
  private async initializeDirectories(): Promise<void> {
    const directories = [
      path.dirname(this.flagFilePath),
      path.join(this.sharedDataDir, 'automatic', 'current'),
      path.join(this.sharedDataDir, 'automatic', 'history')
    ];

    for (const dir of directories) {
      await fs.mkdir(dir, { recursive: true });
    }

  }

  /**
   * リクエストファイル監視開始
   */
  private async startRequestMonitoring(): Promise<void> {
    try {
      const flagDir = path.dirname(this.flagFilePath);

      this.watcher = fsSync.watch(flagDir, async (eventType, filename) => {
        if (!filename || this.processing) {
          return;
        }

        // capture-request.flag の監視
        if (filename === 'capture-request.flag' && eventType === 'rename') {
          const flagPath = this.flagFilePath;
          
          // ファイル存在確認（削除イベントを除外）
          if (fsSync.existsSync(flagPath)) {
            await this.processAutoCaptureRequest();
          }
        }
      });

      // 既存のリクエストファイル確認（起動時処理）
      await this.checkExistingRequests();

    } catch (error) {
      this.logger.error('Failed to start request monitoring:', error);
      throw error;
    }
  }

  /**
   * 既存リクエストファイル確認
   */
  private async checkExistingRequests(): Promise<void> {
    try {
      const flagPath = this.flagFilePath;
      
      if (fsSync.existsSync(flagPath)) {
        await this.processAutoCaptureRequest();
      }
    } catch (error) {
      this.logger.warn('Error checking existing requests:', error);
    }
  }

  /**
   * 自動キャプチャリクエスト処理
   */
  private async processAutoCaptureRequest(): Promise<void> {
    if (this.processing) {
      this.logger.warn('Already processing a request, skipping...');
      return;
    }

    const processingLock = path.join(path.dirname(this.flagFilePath), 'processing.lock');

    try {
      this.processing = true;

      // 処理ロック作成
      await fs.writeFile(processingLock, JSON.stringify({
        timestamp: formatDataDateTime(),
        type: 'auto-capture'
      }));

      // リクエスト情報読み込み
      const requestData = await this.readRequestFile();
      if (!requestData) {
        this.logger.error('Failed to read request data', { 
          flagFilePath: this.flagFilePath,
          message: 'Request data is null - file read or parse failed' 
        });
        return;
      }

      // キャプチャ実行を発火（実際のキャプチャ処理は既存のScreenCaptureServiceが担当）
      await this.triggerScreenCapture(requestData);

      // リクエストフラグ削除（重要！）
      await this.deleteRequestFlag();

    } catch (error) {
      this.logger.error('Auto capture processing failed:', error);
    } finally {
      // 処理ロック削除
      try {
        if (fsSync.existsSync(processingLock)) {
          await fs.unlink(processingLock);
        }
      } catch (error) {
        this.logger.warn('Failed to remove processing lock:', error);
      }
      this.processing = false;
    }
  }

  /**
   * リクエストファイル読み込み（リトライ機構付き）
   */
  private async readRequestFile(): Promise<CaptureRequest | null> {
    const maxRetries = 5;
    const retryDelay = 100; // 100ms

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // ファイル存在確認
        if (!fsSync.existsSync(this.flagFilePath)) {
          this.logger.warn('Request file does not exist', { flagFilePath: this.flagFilePath, attempt });
          return null;
        }

        const requestContent = await fs.readFile(this.flagFilePath, 'utf8');

        if (!requestContent.trim()) {
          if (attempt < maxRetries) {
            this.logger.warn('Request file is empty, retrying...', { 
              flagFilePath: this.flagFilePath, 
              attempt, 
              retryIn: retryDelay 
            });
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          } else {
            this.logger.warn('Request file remains empty after all retries', { 
              flagFilePath: this.flagFilePath, 
              attempt 
            });
            return null;
          }
        }

        const requestData = JSON.parse(requestContent) as CaptureRequest;
        
        return requestData;
      } catch (error) {
        if (attempt < maxRetries) {
          this.logger.warn('Failed to read request file, retrying...', { 
            flagFilePath: this.flagFilePath,
            attempt,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            retryIn: retryDelay
          });
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          this.logger.error('Failed to read request file after all retries', { 
            flagFilePath: this.flagFilePath,
            attempt,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            errorStack: error instanceof Error ? error.stack : undefined,
            errorType: typeof error
          });
          return null;
        }
      }
    }
    
    return null;
  }

  /**
   * スクリーンキャプチャトリガー
   */
  private async triggerScreenCapture(request: CaptureRequest): Promise<void> {
    if (!this.screenCaptureService) {
      this.logger.error('ScreenCaptureService not available', { requestId: request.requestId });
      return;
    }

    try {
      // UI選択状態を直接取得（AppSelectionServiceから）
      const currentSelection = await this.getCurrentUISelection();

      // デフォルト状態（選択なし）の場合はキャプチャを実行せず、エラー通知を表示
      if (!currentSelection || currentSelection === 'fullscreen') {
        this.logger.info('No target selected - cancelling automatic capture to prevent unintended capture', { 
          requestId: request.requestId 
        });

        // リクエストフラグを削除
        try {
          await this.deleteRequestFlag();
          this.logger.debug('Request flag deleted due to no target selection');
        } catch (flagError) {
          this.logger.warn('Failed to delete request flag', { error: flagError });
        }

        // エラー通知をRenderer側に送信
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('auto-capture:error', {
            requestId: request.requestId,
            error: 'キャプチャ対象が選択されていません。画面右上のドロップダウンからアプリケーションまたはディスプレイを選択してください。',
            timestamp: formatDataDateTime(),
            success: false
          });
        }
        return;
      }

      let captureResult = await this.screenCaptureService.captureTargetApp(currentSelection, 'automatic');

      if (captureResult.success) {
        // キャプチャ成功ログ
        const fileSizeKB = captureResult.metadata?.size 
          ? Math.round(captureResult.metadata.size / 1024) 
          : 'unknown';
        this.logger.info('Screen capture completed', { 
          target: currentSelection, 
          fileSize: `${fileSizeKB}KB`,
          requestId: request.requestId 
        });

        // 🔥 重要！UI更新通知をRenderer側に送信
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('auto-capture:completed', {
            requestId: request.requestId,
            filePath: captureResult.filePath,
            metadata: captureResult.metadata,
            timestamp: formatDataDateTime(),
            success: true
          });
        } else {
          this.logger.warn('MainWindow not available for UI notification', { requestId: request.requestId });
        }
      } else {
        this.logger.error('Screen capture failed', { 
          requestId: request.requestId,
          error: captureResult.error 
        });

        // エラー通知もRenderer側に送信
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('auto-capture:error', {
            requestId: request.requestId,
            error: captureResult.error,
            timestamp: formatDataDateTime(),
            success: false
          });
        }
      }

    } catch (error) {
      this.logger.error('Screen capture execution failed', { 
        requestId: request.requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  /**
   * UI選択状態を取得
   * AppConfigから直接config.targetApp.lastSelectedを取得
   */
  private async getCurrentUISelection(): Promise<string | null> {
    try {
      if (!this.config) {
        this.logger.error('AppConfig not set - cannot get UI selection');
        return null;
      }

      const lastSelected = this.config.targetApp?.lastSelected;
      
      if (lastSelected) {
        // オブジェクトの場合は適切な文字列を抽出
        if (typeof lastSelected === 'object' && lastSelected !== null) {
          // ディスプレイ選択の場合
          if (lastSelected.type === 'display' && lastSelected.name) {
            return lastSelected.name; // "ディスプレイ 2" など
          }
          // アプリ選択の場合
          else if (lastSelected.name) {
            return lastSelected.name;
          }
          // フォールバック: オブジェクトから文字列化
          else {
            this.logger.warn('Could not extract name from selection object, using toString');
            return String(lastSelected);
          }
        }
        // 既に文字列の場合はそのまま返す
        else if (typeof lastSelected === 'string') {
          return lastSelected;
        }
        // その他の場合
        else {
          this.logger.warn('Unexpected selection type, using default');
          return null;
        }
      } else {
        this.logger.warn('No last selection found in config, using default');
        return null; // デフォルトでフルスクリーン
      }
      
    } catch (error) {
      this.logger.error('Failed to get current UI selection', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return null; // エラー時はフルスクリーン
    }
  }

  /**
   * リクエストフラグファイルを削除
   */
  private async deleteRequestFlag(): Promise<void> {
    try {
      await fs.unlink(this.flagFilePath);
      this.logger.debug('Request flag file deleted', { flagPath: this.flagFilePath });
    } catch (error) {
      // ファイルが存在しない場合のエラーは無視
      if ((error as any).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}