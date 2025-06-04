import fs from 'fs/promises';
import path from 'path';
import { Logger } from '../../utils/logger';
import { formatDataDateTime } from '../../../utils/dateFormatter.js';

/**
 * ファイルパス設定インターフェース
 */
export interface FileManagerConfig {
  projectRoot: string;
  sharedDataDir?: string;
  screenshotsDir?: string;
}

/**
 * キャプチャメタデータインターフェース
 */
export interface CaptureMetadata {
  timestamp: string;
  type: string;
  sourceName: string;
  appName: string;
  fileName: string;
  filePath: string;
  size: number;
  format: string;
}


/**
 * ファイル管理サービス
 * shared-dataディレクトリの管理とファイル操作を担当
 */
export class FileManager {
  private logger: Logger;
  private config: Required<Omit<FileManagerConfig, 'analysisDir'>>;

  constructor(config: FileManagerConfig) {
    this.logger = new Logger('info');
    
    // デフォルト設定とユーザー設定をマージ（仕様に準拠したパス）
    this.config = {
      projectRoot: config.projectRoot,
      sharedDataDir: config.sharedDataDir || path.join(config.projectRoot, 'shared-data'),
      screenshotsDir: config.screenshotsDir || path.join(config.projectRoot, 'shared-data', 'automatic', 'current')
    };

  }

  /**
   * 共有データディレクトリのパスを取得
   */
  public getSharedDataPath(): string {
    return this.config.sharedDataDir;
  }

  /**
   * 必要なディレクトリを初期化
   */
  public async initializeDirectories(): Promise<void> {
    try {
      await this.ensureDirectoryExists(this.config.sharedDataDir);
      await this.ensureDirectoryExists(this.config.screenshotsDir);
      
    } catch (error) {
      this.logger.error('Failed to initialize directories', { error });
      throw error;
    }
  }

  /**
   * ディレクトリが存在しない場合は作成
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * スクリーンショットを履歴フォルダに保存
   */
  public async saveScreenshot(fileName: string, buffer: Buffer, captureType: 'automatic' | 'manual' = 'automatic'): Promise<string> {
    try {
      await this.initializeDirectories();
      
      // タイムスタンプ付きファイルはhistoryフォルダに保存
      const historyDir = path.join(this.config.sharedDataDir, captureType, 'history');
      await this.ensureDirectoryExists(historyDir);
      
      const filePath = path.join(historyDir, fileName);
      await fs.writeFile(filePath, buffer);
      
      // 履歴ファイルのクリーンアップを実行
      await this.cleanupHistoryFiles(captureType);
      
      return filePath;
    } catch (error) {
      this.logger.error('Failed to save screenshot to history', { fileName, error });
      throw error;
    }
  }

  /**
   * 最新のスクリーンショットとして保存（仕様準拠: screenshot.png）
   */
  public async saveLatestScreenshot(buffer: Buffer, captureType: 'automatic' | 'manual' = 'automatic'): Promise<string> {
    try {
      await this.initializeDirectories();
      
      // キャプチャタイプに応じて保存先を決定
      const saveDir = path.join(this.config.sharedDataDir, captureType, 'current');
      await this.ensureDirectoryExists(saveDir);
      
      const screenshotPath = path.join(saveDir, 'screenshot.png');
      await fs.writeFile(screenshotPath, buffer);
      
      return screenshotPath;
    } catch (error) {
      this.logger.error('Failed to save latest screenshot', { error });
      throw error;
    }
  }

  /**
   * キャプチャメタデータを保存（仕様準拠: metadata.json）
   */
  public async saveCaptureMetadata(metadata: CaptureMetadata, captureType: 'automatic' | 'manual' = 'automatic'): Promise<void> {
    try {
      await this.initializeDirectories();
      
      // キャプチャタイプに応じて保存先を決定
      const saveDir = path.join(this.config.sharedDataDir, captureType, 'current');
      await this.ensureDirectoryExists(saveDir);
      
      const metadataPath = path.join(saveDir, 'metadata.json');
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
      
    } catch (error) {
      this.logger.error('Failed to save capture metadata', { metadata, error });
      throw error;
    }
  }

  /**
   * 最新のキャプチャメタデータを取得
   */
  public async getLatestCaptureMetadata(): Promise<CaptureMetadata | null> {
    try {
      const metadataPath = path.join(this.config.screenshotsDir, 'latest_metadata.json');
      const content = await fs.readFile(metadataPath, 'utf8');
      return JSON.parse(content) as CaptureMetadata;
    } catch (error) {
      this.logger.warn('Failed to read capture metadata', { error });
      return null;
    }
  }


  /**
   * 最新のスクリーンショットパスを取得
   */
  public getLatestScreenshotPath(captureType: 'automatic' | 'manual' = 'manual'): string {
    return path.join(this.config.sharedDataDir, captureType, 'current', 'screenshot.png');
  }

  /**
   * 最新のスクリーンショットが存在するかチェック
   */
  public async hasLatestScreenshot(captureType: 'automatic' | 'manual' = 'manual'): Promise<boolean> {
    try {
      const latestPath = this.getLatestScreenshotPath(captureType);
      await fs.access(latestPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * スクリーンショット履歴を取得
   */
  public async getScreenshotHistory(limit: number = 10): Promise<string[]> {
    try {
      const files = await fs.readdir(this.config.screenshotsDir);
      const screenshots = files
        .filter(file => file.endsWith('.png') && file !== 'latest.png')
        .sort((a, b) => b.localeCompare(a)) // 新しい順
        .slice(0, limit)
        .map(file => path.join(this.config.screenshotsDir, file));
      
      return screenshots;
    } catch (error) {
      this.logger.error('Failed to get screenshot history', { error });
      return [];
    }
  }

  /**
   * 古いファイルをクリーンアップ
   */
  public async cleanupOldFiles(maxAge: number = 24 * 60 * 60 * 1000): Promise<void> {
    try {
      const now = Date.now();
      
      // スクリーンショットのクリーンアップ
      const screenshotFiles = await fs.readdir(this.config.screenshotsDir);
      for (const file of screenshotFiles) {
        if (file === 'latest.png' || file === 'latest_metadata.json') continue;
        
        const filePath = path.join(this.config.screenshotsDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          await fs.unlink(filePath);
        }
      }
      
      
    } catch (error) {
      this.logger.error('Failed to cleanup old files', { error });
    }
  }

  /**
   * ファイル統計情報を取得
   */
  public async getFileStats(): Promise<{
    screenshotCount: number;
    totalSize: number;
    latestScreenshot?: string;
  }> {
    try {
      const stats = {
        screenshotCount: 0,
        totalSize: 0,
        latestScreenshot: undefined as string | undefined
      };

      // スクリーンショット統計
      try {
        const screenshotFiles = await fs.readdir(this.config.screenshotsDir);
        stats.screenshotCount = screenshotFiles.filter(f => f.endsWith('.png')).length;
        
        for (const file of screenshotFiles) {
          const filePath = path.join(this.config.screenshotsDir, file);
          const fileStat = await fs.stat(filePath);
          stats.totalSize += fileStat.size;
        }
        
        if (await this.hasLatestScreenshot()) {
          stats.latestScreenshot = this.getLatestScreenshotPath();
        }
      } catch (error) {
        this.logger.warn('Failed to get screenshot stats', { error });
      }


      return stats;
    } catch (error) {
      this.logger.error('Failed to get file stats', { error });
      throw error;
    }
  }

  /**
   * 設定情報を取得
   */
  public getConfig(): Required<Omit<FileManagerConfig, 'analysisDir'>> {
    return { ...this.config };
  }

  /**
   * 履歴ファイルのクリーンアップ
   */
  private async cleanupHistoryFiles(captureType: 'automatic' | 'manual'): Promise<void> {
    try {
      const autoCleanup = process.env.APP_VISION_AUTO_CLEANUP !== 'false';
      if (!autoCleanup) return;

      const historyDir = path.join(this.config.sharedDataDir, captureType, 'history');
      const maxFiles = parseInt(process.env.APP_VISION_HISTORY_MAX_FILES || '10', 10);
      const retentionDays = parseInt(process.env.APP_VISION_HISTORY_RETENTION_DAYS || '7', 10);

      // ディレクトリが存在しない場合は何もしない
      try {
        await fs.access(historyDir);
      } catch {
        return;
      }

      // 履歴ファイル一覧を取得（PNGファイルのみ）
      const files = await fs.readdir(historyDir);
      const pngFiles = files.filter(file => file.endsWith('.png'));

      // ファイル情報を取得してソート（新しい順）
      const fileStats = await Promise.all(
        pngFiles.map(async (file) => {
          const filePath = path.join(historyDir, file);
          const stats = await fs.stat(filePath);
          return { file, filePath, mtime: stats.mtime };
        })
      );

      fileStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      // 削除対象ファイルを特定
      const filesToDelete: string[] = [];
      const now = new Date();
      const retentionMs = retentionDays * 24 * 60 * 60 * 1000;

      for (let i = 0; i < fileStats.length; i++) {
        const { filePath, mtime } = fileStats[i];
        
        // 最大ファイル数を超える場合、または保持期間を超える場合
        if (i >= maxFiles || (now.getTime() - mtime.getTime()) > retentionMs) {
          filesToDelete.push(filePath);
        }
      }

      // ファイルを削除
      for (const filePath of filesToDelete) {
        try {
          await fs.unlink(filePath);
        } catch (error) {
          this.logger.warn('Failed to delete history file', { filePath, error });
        }
      }

      if (filesToDelete.length > 0) {
      }

    } catch (error) {
      this.logger.error('Failed to cleanup history files', { captureType, error });
    }
  }

  /**
   * 起動時の履歴クリーンアップ
   */
  public async cleanupOnStartup(): Promise<void> {
    try {
      const cleanupOnStartup = process.env.APP_VISION_CLEANUP_ON_STARTUP !== 'false';
      if (!cleanupOnStartup) return;

      await this.cleanupHistoryFiles('automatic');
      await this.cleanupHistoryFiles('manual');

    } catch (error) {
      this.logger.error('Failed to perform startup cleanup', { error });
    }
  }

  /**
   * 手動キャプチャ済みフラグの管理
   */

  /**
   * 手動キャプチャ済みフラグファイルのパスを取得
   */
  private getManualCaptureDoneFlagPath(): string {
    return path.join(this.config.sharedDataDir, 'manual', 'manual_capture_done.json');
  }

  /**
   * 手動キャプチャ済みフラグが存在するかチェック
   */
  public async hasManualCaptureDoneFlag(): Promise<boolean> {
    try {
      await fs.access(this.getManualCaptureDoneFlagPath());
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 手動キャプチャ済みフラグを作成
   */
  public async createManualCaptureDoneFlag(): Promise<void> {
    try {
      const flagPath = this.getManualCaptureDoneFlagPath();
      const flagData = {
        created: formatDataDateTime(),
        description: 'Manual capture has been performed at least once'
      };
      
      // ディレクトリが存在しない場合は作成
      await fs.mkdir(path.dirname(flagPath), { recursive: true });
      
      await fs.writeFile(flagPath, JSON.stringify(flagData, null, 2), 'utf8');
    } catch (error) {
      this.logger.error('Failed to create manual capture done flag', { error });
      throw error;
    }
  }

  /**
   * 手動キャプチャ済みフラグを削除（初回キャプチャ準備時用）
   */
  public async clearManualCaptureDoneFlag(): Promise<void> {
    try {
      const flagPath = this.getManualCaptureDoneFlagPath();
      await fs.unlink(flagPath);
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        this.logger.error('Failed to clear manual capture done flag', { error });
        throw error;
      }
      // ファイルが存在しない場合は正常（何もしない）
    }
  }
}