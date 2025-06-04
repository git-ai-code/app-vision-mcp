import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { initializeLogger } from '../../utils/logger';
import { formatDataDateTime } from '../../../utils/dateFormatter.js';

/**
 * ハートビートサービス
 * ElectronアプリとMCPサーバー間の生存通信を管理
 */
export class HeartbeatService {
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private logger = initializeLogger('info');
  private sharedDataDir: string;
  private isActive = false;
  
  // ハートビート設定
  private readonly HEARTBEAT_INTERVAL = 5000; // 5秒間隔
  private readonly HEARTBEAT_TIMEOUT = 30000; // 30秒タイムアウト

  constructor(sharedDataDir: string) {
    this.sharedDataDir = sharedDataDir;
  }

  /**
   * ハートビート開始
   */
  async start(): Promise<void> {
    if (this.isActive) {
      this.logger.warn('Heartbeat already active');
      return;
    }

    try {
      // ハートビートディレクトリ作成
      const heartbeatDir = path.join(this.sharedDataDir, 'heartbeat');
      await fs.mkdir(heartbeatDir, { recursive: true });

      // 初回ハートビート送信
      await this.sendHeartbeat();

      // 定期ハートビート開始
      this.heartbeatInterval = setInterval(async () => {
        try {
          await this.sendHeartbeat();
        } catch (error) {
          this.logger.error('Heartbeat send failed:', error);
        }
      }, this.HEARTBEAT_INTERVAL);

      this.isActive = true;

    } catch (error) {
      this.logger.error('Failed to start heartbeat service:', error);
      throw error;
    }
  }

  /**
   * ハートビート停止
   */
  async stop(): Promise<void> {
    if (!this.isActive) {
      this.logger.debug('Heartbeat not active');
      return;
    }

    try {
      // ハートビートタイマー停止
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }

      // 終了ハートビート送信
      await this.sendShutdownHeartbeat();

      this.isActive = false;

    } catch (error) {
      this.logger.error('Error stopping heartbeat service:', error);
    }
  }

  /**
   * ハートビート送信
   */
  private async sendHeartbeat(): Promise<void> {
    const heartbeatFile = path.join(this.sharedDataDir, 'heartbeat', 'app-status.json');
    
    const heartbeatData = {
      timestamp: formatDataDateTime(),
      status: 'active',
      pid: process.pid,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      version: '0.1.0',
      services: {
        screenCapture: true,
        imageAnalysis: true,
        fileMonitoring: true
      }
    };

    try {
      await fs.writeFile(heartbeatFile, JSON.stringify(heartbeatData, null, 2));
      this.logger.debug('Heartbeat sent', { timestamp: heartbeatData.timestamp });
    } catch (error) {
      this.logger.error('Failed to write heartbeat:', error);
      throw error;
    }
  }

  /**
   * 終了ハートビート送信
   */
  private async sendShutdownHeartbeat(): Promise<void> {
    const heartbeatFile = path.join(this.sharedDataDir, 'heartbeat', 'app-status.json');
    
    const shutdownData = {
      timestamp: formatDataDateTime(),
      status: 'shutdown',
      pid: process.pid,
      uptime: process.uptime(),
      reason: 'graceful_shutdown'
    };

    try {
      await fs.writeFile(heartbeatFile, JSON.stringify(shutdownData, null, 2));
    } catch (error) {
      this.logger.error('Failed to write shutdown heartbeat:', error);
    }
  }

  /**
   * ハートビート状態確認
   */
  getStatus(): { active: boolean; interval: number; timeout: number } {
    return {
      active: this.isActive,
      interval: this.HEARTBEAT_INTERVAL,
      timeout: this.HEARTBEAT_TIMEOUT
    };
  }

  /**
   * 最後のハートビートからの経過時間を取得
   */
  static async getLastHeartbeatAge(sharedDataDir: string): Promise<number | null> {
    const heartbeatFile = path.join(sharedDataDir, 'heartbeat', 'app-status.json');
    
    try {
      if (!fsSync.existsSync(heartbeatFile)) {
        return null;
      }

      const heartbeatData = JSON.parse(await fs.readFile(heartbeatFile, 'utf8'));
      const lastTimestamp = new Date(heartbeatData.timestamp);
      const now = new Date();
      
      return now.getTime() - lastTimestamp.getTime();
    } catch (error) {
      return null;
    }
  }

  /**
   * アプリが生存しているかチェック
   */
  static async isAppAlive(sharedDataDir: string, timeoutMs: number = 30000): Promise<boolean> {
    const age = await HeartbeatService.getLastHeartbeatAge(sharedDataDir);
    
    if (age === null) {
      return false; // ハートビートファイルなし
    }
    
    return age < timeoutMs; // タイムアウト内なら生存
  }
}