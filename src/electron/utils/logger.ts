/**
 * App Vision MCP - Logger Utility
 * 汎用ログシステム
 */

import * as fs from 'fs';
import * as path from 'path';
import { formatCompactDateTime, formatLogDateTime } from '../../utils/dateFormatter.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class Logger {
  private logPath: string;
  private logLevel: LogLevel;

  constructor(logLevel: LogLevel = 'info', logDir?: string) {
    this.logLevel = logLevel;
    
    // ログディレクトリの決定
    const defaultLogDir = path.join(process.cwd(), 'logs');
    const actualLogDir = logDir || defaultLogDir;
    
    // ログディレクトリの作成
    if (!fs.existsSync(actualLogDir)) {
      fs.mkdirSync(actualLogDir, { recursive: true });
    }
    
    // ログファイルパスの生成（統一フォーマット使用）
    const now = new Date();
    const compactDateTime = formatCompactDateTime(now);
    this.logPath = path.join(actualLogDir, `app-vision-mcp-${compactDateTime}.log`);
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      'debug': 0,
      'info': 1,
      'warn': 2,
      'error': 3
    };
    
    return levels[level] >= levels[this.logLevel];
  }

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = formatLogDateTime();
    const dataStr = data ? ` | ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${dataStr}`;
  }

  private writeLog(level: LogLevel, message: string, data?: any): void {
    if (!this.shouldLog(level)) {
      return;
    }
    
    const formattedMessage = this.formatMessage(level, message, data);
    
    // コンソール出力
    (console[level] as (message: string) => void)(formattedMessage);
    
    // ファイル出力（同期書き込みで即座に反映）
    try {
      fs.appendFileSync(this.logPath, formattedMessage + '\n');
    } catch (error) {
      // ファイル書き込みエラーは無視してコンソール出力のみ継続
    }
  }

  debug(message: string, data?: any): void {
    this.writeLog('debug', message, data);
  }

  info(message: string, data?: any): void {
    this.writeLog('info', message, data);
  }

  warn(message: string, data?: any): void {
    this.writeLog('warn', message, data);
  }

  error(message: string, data?: any): void {
    this.writeLog('error', message, data);
  }

  getLogPath(): string {
    return this.logPath;
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
    this.info('Log level changed', { newLevel: level });
  }

}

// グローバルロガーインスタンス
let globalLogger: Logger | null = null;

export function getLogger(): Logger {
  if (!globalLogger) {
    globalLogger = new Logger();
  }
  return globalLogger;
}

export function initializeLogger(logLevel: LogLevel, logDir?: string): Logger {
  // 既存のロガーは新しいインスタンスで置き換える（同期書き込みのためクリーンアップ不要）
  globalLogger = new Logger(logLevel, logDir);
  return globalLogger;
}

// 共通の日時フォーマット関数は ../../utils/dateFormatter.js からエクスポート
export { formatCompactDateTime } from '../../utils/dateFormatter.js';