/**
 * App Vision MCP - Main Process Entry Point
 * Electronメインプロセスのエントリーポイント
 */

import { app } from 'electron';
import { AppManager } from './managers/appManager';
import { AppConfig, initializeAppConfig } from '../assets/config/appConfig';
import { initializeLogger } from '../utils/logger';

// アプリケーション設定の初期化（.env読み込み含む）
const config: AppConfig = initializeAppConfig();

// 開発設定の微調整
config.development.enableDevTools = false; // 手動でF12で開く
config.development.enableConsoleLogging = true;
config.development.logLevel = 'info';

// ログシステムの初期化
const logger = initializeLogger(config.development.logLevel);

logger.info('App Vision MCP starting...', {
  version: config.app.version,
  platform: process.platform,
  nodeVersion: process.version,
  electronVersion: process.versions.electron,
  sharedDataPath: config.environment.sharedDataPath
});

// アプリケーションマネージャーの初期化（app.ready前に作成）
let appManager: AppManager;

try {
  appManager = new AppManager(config);
} catch (error) {
  console.error('Failed to create AppManager:', error);
  logger.error('Failed to create AppManager:', {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    error: error
  });
  app.quit();
}

/**
 * アプリケーションの起動
 */
async function startApplication(): Promise<void> {
  try {
    await appManager.initialize();
    logger.info('App Vision MCP started successfully');
  } catch (error) {
    console.error('Failed to start application:', error);
    logger.error('Failed to start application:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      error: error
    });
    app.quit();
  }
}

/**
 * アプリケーションの終了処理
 */
async function stopApplication(): Promise<void> {
  try {
    if (appManager) {
      await appManager.cleanup();
    }
    logger.info('App Vision MCP stopped successfully');
  } catch (error) {
    logger.error('Error during application shutdown:', error);
  }
}

// Electronアプリケーションイベント
app.whenReady().then(startApplication);

app.on('before-quit', async (event) => {
  if (appManager) {
    event.preventDefault();
    await stopApplication();
    app.exit(0);
  }
});

// プロセス終了時のクリーンアップ
process.on('exit', () => {
  logger.info('Process exiting');
});

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully');
  await stopApplication();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  await stopApplication();
  process.exit(0);
});