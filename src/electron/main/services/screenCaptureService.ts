import { desktopCapturer, screen, Display } from 'electron';
import { Logger } from '../../utils/logger';
import { FileManager } from './fileManager';
import { formatCompactDateTime, formatDataDateTime } from '../../../utils/dateFormatter.js';

/**
 * 画面キャプチャ設定インターフェース
 */
export interface CaptureConfig {
  targetApp?: string;
  fullScreen?: boolean;
  includeAudio?: boolean;
  format?: 'png' | 'jpg';
  quality?: number;
}

/**
 * キャプチャ結果インターフェース
 */
export interface CaptureResult {
  success: boolean;
  filePath?: string;
  error?: string;
  timestamp?: Date;
  metadata?: {
    width: number;
    height: number;
    format: string;
    size: number;
  };
}

/**
 * 画面キャプチャサービス
 * Electronのデスクトップキャプチャ機能を管理
 */
export class ScreenCaptureService {
  private logger: Logger;
  private fileManager: FileManager;
  private isCapturing: boolean = false;
  private captureConfig: CaptureConfig = {};

  constructor(fileManager: FileManager) {
    this.logger = new Logger('info');
    this.fileManager = fileManager;
  }

  /**
   * キャプチャ設定を更新
   */
  public updateConfig(config: CaptureConfig): void {
    this.captureConfig = { ...this.captureConfig, ...config };
  }

  /**
   * 利用可能なキャプチャソースを取得
   */
  public async getAvailableSources(): Promise<Electron.DesktopCapturerSource[]> {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['window', 'screen'],
        thumbnailSize: { width: 0, height: 0 }
      });

      // source.nameをそのまま使用（正常動作確認済み）
      const normalizedSources = sources;

      return normalizedSources;
    } catch (error) {
      this.logger.error('Failed to get capture sources', { error });
      throw error;
    }
  }

  

  /**
   * シンプルで効果的な安全なテキスト変換（文字化け解消）
   */
  private toSafeText(text: string): string {
    try {
      // Try to encode as UTF-8, fallback to ASCII replacement
      return Buffer.from(text, 'utf8').toString('utf8');
    } catch {
      // If encoding fails, replace non-ASCII with readable placeholders
      return text.replace(/[^\x00-\x7F]/g, (match) => {
        const code = match.charCodeAt(0);
        return `[U+${code.toString(16).toUpperCase().padStart(4, '0')}]`;
      });
    }
  }

  /**
   * ゼロ幅文字を除去して検索用に正規化
   */
  private normalizeForSearch(text: string): string {
    return text
      .toLowerCase()
      // ゼロ幅文字を除去
      .replace(/[\u200B-\u200F\uFEFF]/g, '') // ゼロ幅スペース、左右マーク等
      .replace(/[\u2060-\u206F]/g, '')       // 単語結合子等
      // 連続する空白を単一スペースに
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 対象アプリケーションのウィンドウを検索
   */
  public async findTargetWindow(appName: string): Promise<Electron.DesktopCapturerSource | null> {
    try {

      // タスクマネージャーの例外処理
      const normalizedAppName = this.normalizeForSearch(appName);
      if (normalizedAppName.includes('task manager') || 
          normalizedAppName.includes('taskmgr') ||
          normalizedAppName.includes('タスク マネージャー') ||
          normalizedAppName.includes('タスクマネージャー')) {
        this.logger.warn('Task Manager capture blocked', { appName });
        throw new Error('タスクマネージャーはWindows Graphics Capture APIの制限により、キャプチャできません。');
      }

      const sources = await this.getAvailableSources();
      
      // 特殊選択項目の処理（より柔軟な判定）
      if (appName === 'fullscreen' || 
          appName === '全画面' || 
          appName.includes('fullscreen') ||
          appName.includes('全ディスプレイ統合') ||
          appName.includes('全画面')) {
        // 真の全画面：全ディスプレイを統合したキャプチャ
        // 特別なIDを使用して後で処理
        return {
          id: 'fullscreen:all',
          name: '全ディスプレイ統合',
          display_id: undefined,
          thumbnail: null
        } as any;
      }

      // ディスプレイ番号指定の処理（例：'ディスプレイ 1', 'Screen 2'等）
      const displayMatch = appName.match(/(?:ディスプレイ|画面|screen)\s*(\d+)/i);
      if (displayMatch) {
        const displayNum = parseInt(displayMatch[1]) - 1; // 0ベースインデックスに変換
        const screenSources = sources.filter(source => source.id.startsWith('screen:'));
        if (screenSources[displayNum]) {
          // 選択されたディスプレイ番号を正しくsourceNameに反映
          const correctedSource = {
            ...screenSources[displayNum],
            name: `画面 ${displayNum + 1}`
          };
          return correctedSource;
        }
      }
      
      // ウィンドウソースをそのまま使用
      const normalizedSources = sources.filter(source => source.id.startsWith('window:'));

      // 詳細なウィンドウ検索デバッグ（強制INFO出力）
      
      normalizedSources.forEach((source, index) => {
        const safeName = this.toSafeText(source.name);
        
        // App Vision MCPの可能性があるウィンドウを特別チェック
        if (source.name.toLowerCase().includes('app') || 
            source.name.toLowerCase().includes('vision') || 
            source.name.toLowerCase().includes('universal')) {
        }
      });

      // 通常のアプリケーション検索のみ実行
      let targetWindow: any = null;

      // 通常のアプリケーション名での完全一致を優先
      if (!targetWindow) {
        const normalizedAppName = this.normalizeForSearch(appName);
        targetWindow = normalizedSources.find(source => 
          this.normalizeForSearch(source.name) === normalizedAppName
        );
      }

      // 完全一致がない場合、部分一致で検索（ゼロ幅文字対応版）
      if (!targetWindow) {
        const normalizedSearchTerm = this.normalizeForSearch(appName);
        
        targetWindow = normalizedSources.find(source => {
          const normalizedSourceName = this.normalizeForSearch(source.name);
          const contains = normalizedSourceName.includes(normalizedSearchTerm);
          
          if (source.name.toLowerCase().includes('edge') || contains) {
          }
          
          return contains;
        });
        
        if (targetWindow) {
        }
      }

      if (targetWindow) {
      } else {
        this.logger.warn('Target window not found', { 
          appName,
          searchedIn: normalizedSources.length,
          availableWindowNames: normalizedSources.map(s => s.name)
        });
      }

      return targetWindow || null;
    } catch (error) {
      // タスクマネージャーの場合は例外を再スロー（親切なエラーメッセージ付き）
      if (error instanceof Error && error.message.includes('タスクマネージャー')) {
        throw error;
      }
      
      this.logger.error('Error finding target window', { appName, error });
      return null;
    }
  }


  /**
   * 画面全体をキャプチャ
   */
  public async captureFullScreen(captureType: 'automatic' | 'manual' = 'manual'): Promise<CaptureResult> {
    if (this.isCapturing) {
      return { success: false, error: 'Capture already in progress' };
    }

    try {
      this.isCapturing = true;

      const thumbnailSize = { width: 1920, height: 1920 };
      
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: thumbnailSize // 高解像度でキャプチャ
      });

      if (sources.length === 0) {
        throw new Error('No screen sources available');
      }

      const primaryScreen = sources[0];
      
      // 実際のキャプチャサイズを取得
      const actualSize = primaryScreen.thumbnail.getSize();
      
      // ディスプレイ情報を取得
      const primaryDisplay = screen.getPrimaryDisplay();
      
      const dataUrl = primaryScreen.thumbnail.toDataURL();
      
      // データURLが有効かチェック
      if (!dataUrl || dataUrl === 'data:,' || !dataUrl.includes('base64')) {
        this.logger.error('Invalid fullscreen capture data', { 
          screenName: primaryScreen.name,
          dataUrlStart: dataUrl?.substring(0, 50) || 'null'
        });
        throw new Error('Screen capture failed - invalid data');
      }
      
      return await this.saveScreenshot(dataUrl, {
        type: 'fullscreen',
        sourceName: primaryScreen.name
      }, captureType);

    } catch (error) {
      this.logger.error('Full screen capture failed', { error });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    } finally {
      this.isCapturing = false;
    }
  }

  /**
   * 特定のアプリケーションウィンドウをキャプチャ
   */
  public async captureTargetApp(appName: string, captureType: 'automatic' | 'manual' = 'manual'): Promise<CaptureResult> {
    if (this.isCapturing) {
      return { success: false, error: 'Capture already in progress' };
    }

    try {
      this.isCapturing = true;

      const targetWindow = await this.findTargetWindow(appName);
      if (!targetWindow) {
        return { 
          success: false, 
          error: `対象アプリケーション「${appName}」が見つかりません。\n\nアプリのタイトルが変更されている可能性があります。\n「アプリを更新」ボタンを押して、最新のアプリ一覧を取得してから再度選択してください。` 
        };
      }

      // スクリーンかウィンドウかを判定してキャプチャ方法を変更
      const isScreenCapture = targetWindow.id.startsWith('screen:');
      const captureTypes: ('screen' | 'window')[] = isScreenCapture ? ['screen'] : ['window'];

      const thumbnailSize = { width: 1920, height: 1920 };
      
      // findTargetWindow()で既に取得済みのソース情報を再利用するため、再度取得
      const sources = await desktopCapturer.getSources({
        types: captureTypes,
        thumbnailSize: thumbnailSize // 高解像度でキャプチャ
      });

      const captureSource = sources.find(s => s.id === targetWindow.id);
      if (!captureSource) {
        this.logger.error('Capture source not found', { 
          targetId: targetWindow.id, 
          availableIds: sources.map(s => s.id) 
        });
        return { 
          success: false, 
          error: `Failed to get ${isScreenCapture ? 'screen' : 'window'} capture` 
        };
      }

      // 実際のキャプチャサイズを取得
      const actualSize = captureSource.thumbnail.getSize();
      
      // ディスプレイ情報を取得（スクリーンキャプチャの場合）
      let displayInfo = null;
      if (isScreenCapture) {
        const allDisplays = screen.getAllDisplays();
        const primaryDisplay = screen.getPrimaryDisplay();
        displayInfo = {
          allDisplaysCount: allDisplays.length,
          primaryBounds: primaryDisplay.bounds,
          primarySize: primaryDisplay.size,
          scaleFactor: primaryDisplay.scaleFactor
        };
      }
      
      const dataUrl = captureSource.thumbnail.toDataURL();
      
      // データURLが有効かチェック
      if (!dataUrl || dataUrl === 'data:,' || !dataUrl.includes('base64')) {
        this.logger.error('Invalid capture data', { 
          targetId: targetWindow.id, 
          dataUrlStart: dataUrl?.substring(0, 50) || 'null'
        });
        return { 
          success: false, 
          error: `Source is not capturable: ${targetWindow.name}` 
        };
      }
      
      return await this.saveScreenshot(dataUrl, {
        type: isScreenCapture ? 'screen' : 'window',
        sourceName: targetWindow.name,
        appName
      }, captureType);

    } catch (error) {
      this.logger.error('Target app capture failed', { appName, error });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    } finally {
      this.isCapturing = false;
    }
  }

  /**
   * スクリーンショットを保存
   */
  private async saveScreenshot(
    dataUrl: string, 
    metadata: { type: string; sourceName: string; appName?: string; metadata?: any },
    captureType: 'automatic' | 'manual' = 'manual'
  ): Promise<CaptureResult> {
    try {
      const timestamp = new Date();
      const base64Data = dataUrl.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');

      // ファイル名生成（統一フォーマット使用）
      const compactDateTime = formatCompactDateTime(timestamp);
      const fileName = `${compactDateTime}.png`;
      
      // ファイルサイズチェック - 0バイトの場合は失敗として扱う
      if (buffer.length === 0) {
        this.logger.error('❌ Capture failed: Empty buffer (0 bytes)', {
          appName: metadata.appName,
          sourceName: metadata.sourceName,
          captureType
        });
        return {
          success: false,
          error: 'キャプチャに失敗しました（空のファイル）。このアプリはWindows Graphics Capture APIでサポートされていません。'
        };
      }

      // ファイル保存（キャプチャタイプを指定）
      const filePath = await this.fileManager.saveScreenshot(fileName, buffer, captureType);
      await this.fileManager.saveLatestScreenshot(buffer, captureType);

      // メタデータ保存（統一フォーマット使用・互換性重視）
      const captureMetadata = {
        timestamp: formatDataDateTime(timestamp),
        type: metadata.type,
        sourceName: metadata.sourceName,
        appName: metadata.appName || 'unknown',
        fileName,
        filePath,
        size: buffer.length,
        format: 'png'
      };

      await this.fileManager.saveCaptureMetadata(captureMetadata, captureType);

      return {
        success: true,
        filePath,
        timestamp,
        metadata: {
          width: 0, // サムネイルからは正確な解像度が取得できない
          height: 0,
          format: 'png',
          size: buffer.length
        }
      };

    } catch (error) {
      this.logger.error('Failed to save screenshot', { error });
      throw error;
    }
  }

  /**
   * キャプチャ状態を取得
   */
  public getStatus(): { isCapturing: boolean; config: CaptureConfig } {
    return {
      isCapturing: this.isCapturing,
      config: { ...this.captureConfig }
    };
  }

  /**
   * サービスクリーンアップ
   */
  public cleanup(): void {
    this.isCapturing = false;
  }
}