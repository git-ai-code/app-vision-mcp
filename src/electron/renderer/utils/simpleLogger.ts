/**
 * App Vision MCP - Simple Renderer Logger
 * レンダラープロセス用の軽量ログ機能（Node.js依存なし）
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class SimpleLogger {
  private prefix: string;

  constructor(prefix: string = 'Renderer') {
    this.prefix = prefix;
  }

  debug(message: string, ...args: any[]): void {
    console.debug(`[${this.prefix}] ${message}`, ...args);
  }

  info(message: string, ...args: any[]): void {
    console.info(`[${this.prefix}] ${message}`, ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(`[${this.prefix}] ${message}`, ...args);
  }

  error(message: string, ...args: any[]): void {
    console.error(`[${this.prefix}] ${message}`, ...args);
  }
}

// 簡単に使用できるファクトリー関数
export function getSimpleLogger(prefix?: string): SimpleLogger {
  return new SimpleLogger(prefix);
}