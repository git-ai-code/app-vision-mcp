import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { BrowserWindow } from 'electron';
import { Logger } from '../../utils/logger.js';
import { formatCompactDateTime } from '../../../utils/dateFormatter.js';

/**
 * 提案フラグデータ構造
 */
export interface SuggestionFlag {
  suggestion_ready: boolean;
  last_update: string;
  suggestion_id: string;
  display_status: 'hidden' | 'ready' | 'processing' | 'displayed';
  auto_clear: boolean;
  file_path?: string;
}

/**
 * 提案データ構造
 */
export interface SuggestionData {
  metadata?: {
    timestamp: string;
    format_version: string;
    suggestion_id: string;
    [key: string]: any;
  };
  suggestions: Array<{
    id?: string;
    title: string;
    description: string;
    category?: string;
    priority: 'high' | 'medium' | 'low';
    actionable_steps?: string[];
    estimated_time?: string;
    benefit?: string;
    [key: string]: any;
  }>;
  [key: string]: any;
}

/**
 * AI提案監視サービス
 * suggestion_flag.jsonの変化を監視し、新しい提案をUIに表示
 */
export class SuggestionMonitorService {
  private logger: Logger;
  private sharedDataPath: string;
  private flagFilePath: string;
  private suggestionFilePath: string;
  private mainWindow: BrowserWindow | null;
  private currentSuggestionId: string | null = null;
  private flagWatcher: fsSync.FSWatcher | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastFlagCheck: string = '';

  constructor(sharedDataPath: string, mainWindow: BrowserWindow | null) {
    this.logger = new Logger('info');
    this.sharedDataPath = sharedDataPath;
    this.flagFilePath = path.join(sharedDataPath, 'flags', 'suggestion_flag.json');
    this.suggestionFilePath = path.join(sharedDataPath, 'suggestions', 'ai_suggestions.json');
    this.mainWindow = mainWindow;
  }

  /**
   * MainWindow参照の更新
   */
  public setMainWindow(mainWindow: BrowserWindow | null): void {
    this.mainWindow = mainWindow;
  }

  /**
   * 監視開始
   */
  public async startMonitoring(): Promise<void> {
    try {
      // ディレクトリ作成（存在しない場合）
      await this.ensureDirectories();
      
      // ファイル監視開始
      await this.watchSuggestionFlag();
      
      // ポーリング監視開始（確実性のため）
      this.startPolling();
      
    } catch (error) {
      this.handleError(error as Error, 'startMonitoring');
    }
  }

  /**
   * 監視停止
   */
  public stopMonitoring(): void {
    try {
      if (this.flagWatcher) {
        this.flagWatcher.close();
        this.flagWatcher = null;
      }
      
      if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
        this.pollingInterval = null;
      }
      
    } catch (error) {
      this.handleError(error as Error, 'stopMonitoring');
    }
  }

  /**
   * 必要なディレクトリの作成
   */
  private async ensureDirectories(): Promise<void> {
    const flagsDir = path.join(this.sharedDataPath, 'flags');
    const suggestionsDir = path.join(this.sharedDataPath, 'suggestions');
    
    await fs.mkdir(flagsDir, { recursive: true });
    await fs.mkdir(suggestionsDir, { recursive: true });
  }

  /**
   * suggestion_flag.json監視（fs.watch）
   */
  private async watchSuggestionFlag(): Promise<void> {
    try {
      // 初期読み込み
      await this.checkFlagFile();
      
      // ファイル監視
      this.flagWatcher = fsSync.watch(path.dirname(this.flagFilePath), (eventType, filename) => {
        if (filename === 'suggestion_flag.json' && (eventType === 'change' || eventType === 'rename')) {
          this.checkFlagFile().catch(error => {
            this.handleError(error, 'watchSuggestionFlag:fileChange');
          });
        }
      });
      
      this.logger.debug('[SuggestionMonitor] Flag file watcher started');
    } catch (error) {
      this.handleError(error as Error, 'watchSuggestionFlag');
    }
  }

  /**
   * ポーリング監視開始
   */
  private startPolling(): void {
    this.pollingInterval = setInterval(() => {
      this.checkFlagFile().catch(error => {
        this.handleError(error, 'polling:checkFlagFile');
      });
    }, 2000); // 2秒間隔
  }

  /**
   * フラグファイルチェック
   */
  private async checkFlagFile(): Promise<void> {
    try {
      if (!fsSync.existsSync(this.flagFilePath)) {
        return;
      }

      const flagContent = await fs.readFile(this.flagFilePath, 'utf8');
      
      // 内容に変化がない場合はスキップ
      if (flagContent === this.lastFlagCheck) {
        return;
      }
      
      this.lastFlagCheck = flagContent;
      const flagData: SuggestionFlag = JSON.parse(flagContent);
      
      // 提案準備完了かつ新しいIDの場合
      if (flagData.suggestion_ready && 
          flagData.suggestion_id !== this.currentSuggestionId &&
          flagData.display_status === 'ready') {
        
        await this.onFlagChanged(flagData);
      }
    } catch (error) {
      this.handleError(error as Error, 'checkFlagFile');
    }
  }

  /**
   * フラグ変化検出時の処理
   */
  private async onFlagChanged(flagData: SuggestionFlag): Promise<void> {
    try {
      // 提案データ読み込み
      const suggestionData = await this.loadSuggestionData(this.suggestionFilePath);
      
      if (suggestionData && suggestionData.suggestions?.length > 0) {
        // 現在のIDを更新
        this.currentSuggestionId = flagData.suggestion_id;
        
        // フラグステータス更新
        await this.updateFlagStatus(flagData.suggestion_id, 'processing');
        
        // UI更新
        await this.notifyRenderer(suggestionData);
        
        // フラグステータス更新
        await this.updateFlagStatus(flagData.suggestion_id, 'displayed');
        
        // 自動クリア設定の場合
        if (flagData.auto_clear) {
          setTimeout(() => {
            this.autoClearing(flagData.suggestion_id);
          }, 300000); // 5分後（300秒）
        }
      }
    } catch (error) {
      this.handleError(error as Error, 'onFlagChanged');
    }
  }

  /**
   * ai_suggestions.json読み込み・検証
   */
  private async loadSuggestionData(filePath: string): Promise<SuggestionData | null> {
    try {
      if (!fsSync.existsSync(filePath)) {
        this.logger.warn(`[SuggestionMonitor] Suggestion file not found: ${filePath}`);
        return null;
      }

      const content = await fs.readFile(filePath, 'utf8');
      const data: SuggestionData = JSON.parse(content);
      
      // 基本的なデータ検証
      if (!data.suggestions || !Array.isArray(data.suggestions)) {
        this.logger.warn('[SuggestionMonitor] Invalid suggestion data: missing suggestions array');
        return null;
      }

      return data;
    } catch (error) {
      this.handleError(error as Error, 'loadSuggestionData');
      return null;
    }
  }

  /**
   * UI更新（IPC経由でレンダラーに送信）
   */
  private async notifyRenderer(suggestionData: SuggestionData): Promise<void> {
    try {
      if (!this.mainWindow || this.mainWindow.isDestroyed()) {
        this.logger.warn('[SuggestionMonitor] Main window not available for suggestion update');
        return;
      }

      // レンダラープロセスに提案データを送信
      this.mainWindow.webContents.send('suggestion-update', {
        suggestions: suggestionData.suggestions,
        metadata: suggestionData.metadata
      });
      
    } catch (error) {
      this.handleError(error as Error, 'notifyRenderer');
    }
  }

  /**
   * フラグステータス更新
   */
  private async updateFlagStatus(suggestionId: string, status: SuggestionFlag['display_status']): Promise<void> {
    try {
      if (!fsSync.existsSync(this.flagFilePath)) {
        return;
      }

      const flagContent = await fs.readFile(this.flagFilePath, 'utf8');
      const flagData: SuggestionFlag = JSON.parse(flagContent);
      
      flagData.display_status = status;
      flagData.last_update = formatCompactDateTime();
      
      await fs.writeFile(this.flagFilePath, JSON.stringify(flagData, null, 2));
      
      this.logger.debug(`[SuggestionMonitor] Flag status updated: ${status}`);
    } catch (error) {
      this.handleError(error as Error, 'updateFlagStatus');
    }
  }

  /**
   * 自動クリア機能
   */
  private async autoClearing(suggestionId: string): Promise<void> {
    try {
      // 現在のIDと一致する場合のみクリア
      if (this.currentSuggestionId === suggestionId) {
        // レンダラーにクリア指示
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('suggestion-clear');
        }
        
        // フラグリセット
        await this.updateFlagStatus(suggestionId, 'hidden');
        this.currentSuggestionId = null;
      }
    } catch (error) {
      this.handleError(error as Error, 'autoClearing');
    }
  }

  /**
   * エラーハンドリング
   */
  private handleError(error: Error, context: string): void {
    this.logger.error(`[SuggestionMonitor:${context}] Error: ${error.message}`);
    if (error.stack) {
      this.logger.debug(`[SuggestionMonitor:${context}] Stack: ${error.stack}`);
    }
  }
}