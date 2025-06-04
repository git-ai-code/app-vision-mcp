/**
 * App Vision MCP - Application Configuration
 * 汎用アプリケーション監視・解析システムの設定管理
 */

import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../../utils/logger.js';

// 設定ファイル用のロガーインスタンス
const logger = new Logger('info');

// 環境変数設定インターフェース
export interface EnvironmentConfig {
  sharedDataPath: string;
}

// 前回選択したアプリケーション情報
export interface LastSelectedApp {
  type?: 'display' | 'app';  // 選択タイプ（ディスプレイまたはアプリ）
  name: string;               // アプリ名またはディスプレイ名
  windowTitle?: string;       // ウィンドウタイトル（アプリの場合）
  adapterId?: string;         // アダプターID
  timestamp?: number;         // タイムスタンプ
}

export interface AppConfig {
  // 環境設定
  environment: EnvironmentConfig;
  
  // アプリケーション基本情報
  app: {
    name: string;
    version: string;
    title: string;
  };
  
  // ウィンドウ設定
  window: {
    width: number;
    height: number;
    minWidth: number;
    minHeight: number;
    resizable: boolean;
  };
  
  // キャプチャ設定
  capture: {
    defaultInterval: number; // ミリ秒
    manualCaptureEnabled: boolean;
    autoDetectApps: boolean;
  };
  
  // 監視対象アプリケーション設定
  targetApp: {
    name: string;
    windowTitlePatterns: string[];
    fileExtensions: string[];
    defaultAdapter: string;
    lastSelected?: string | LastSelectedApp; // 前回選択したアプリケーション情報（文字列または詳細情報）
  };
  
  // UI設定
  ui: {
    theme: 'light' | 'dark';
    language: 'ja' | 'en';
    showDetailedAnalysis: boolean;
    compactMode: boolean;
  };
  
  // 開発・デバッグ設定
  development: {
    enableDevTools: boolean;
    enableConsoleLogging: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
}

/**
 * 環境変数から設定を読み込む
 */
export function loadEnvironmentConfig(): EnvironmentConfig {
  // 環境変数の読み込み（デフォルト値付き）
  let defaultSharedDataPath: string;
  
  // デフォルトパスをプロジェクトルートベースで生成
  try {
    defaultSharedDataPath = path.join(process.cwd(), 'shared-data');
  } catch (error) {
    // フォールバック: __dirnameベースの相対パス
    defaultSharedDataPath = path.join(__dirname, '..', '..', '..', '..', 'shared-data');
  }
  
  const sharedDataPath = process.env.APP_VISION_SHARED_DATA || defaultSharedDataPath;
  
  // Windowsパス形式をslash形式に正規化（MCP側との互換性確保）
  const normalizedPath = sharedDataPath.replace(/\\/g, '/');
  
  return {
    sharedDataPath: normalizedPath
  };
}

/**
 * .envファイルを手動で読み込む（dotenvの代替）
 */
export function loadEnvFile(): void {
  try {
    // プロジェクトルートからの.envファイルを探す
    const possibleEnvPaths = [
      path.join(process.cwd(), '.env'),                           // 実行時のカレントディレクトリ
      path.join(__dirname, '..', '..', '..', '..', '.env'),       // dist配下からの相対パス
      path.join(__dirname, '..', '..', '..', '..', '..', '.env'), // dist/electronからの相対パス
    ];
    
    let envPath: string | null = null;
    for (const possiblePath of possibleEnvPaths) {
      if (fs.existsSync(possiblePath)) {
        envPath = possiblePath;
        break;
      }
    }
    
    if (envPath) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const lines = envContent.split('\n');
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          const [key, ...valueParts] = trimmedLine.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').trim();
            process.env[key.trim()] = value;
          }
        }
      }
    } else {
      logger.warn('.env file not found in any expected location');
    }
  } catch (error) {
    logger.warn('Could not load .env file', { error });
  }
}

// package.jsonから動的にバージョンを取得
let packageVersion = '0.1.0'; // フォールバック値
try {
  const packageJson = require('../../../package.json');
  packageVersion = packageJson.version;
} catch (error) {
  logger.warn('Could not load version from package.json, using fallback', { error });
}

// デフォルト設定
export const defaultConfig: AppConfig = {
  // 環境設定はロード時に動的に設定
  environment: {
    sharedDataPath: ''
  },
  
  app: {
    name: 'App Vision MCP',
    version: packageVersion,
    title: 'App Vision MCP - Universal Visual Assistant'
  },
  
  window: {
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    resizable: true
  },
  
  capture: {
    defaultInterval: 10000, // 10秒
    manualCaptureEnabled: true,
    autoDetectApps: true
  },
  
  targetApp: {
    name: '', // ユーザーが動的に設定
    windowTitlePatterns: [], // ユーザーが動的に設定
    fileExtensions: [], // アダプターによって決定
    defaultAdapter: 'generic' // 汎用アダプターをデフォルト
  },
  
  ui: {
    theme: 'light', // 白基調をデフォルト
    language: 'ja',
    showDetailedAnalysis: false, // シンプルモードをデフォルト
    compactMode: true // キャプチャ特化モード
  },
  
  development: {
    enableDevTools: false,
    enableConsoleLogging: true,
    logLevel: 'debug'
  }
};


/**
 * 設定の検証
 */
export function validateConfig(config: Partial<AppConfig>): string[] {
  const errors: string[] = [];
  
  if (config.window) {
    if (config.window.width && config.window.width < 400) {
      errors.push('ウィンドウ幅は400px以上である必要があります');
    }
    if (config.window.height && config.window.height < 300) {
      errors.push('ウィンドウ高さは300px以上である必要があります');
    }
  }
  
  if (config.capture?.defaultInterval && config.capture.defaultInterval < 1000) {
    errors.push('キャプチャ間隔は1秒以上である必要があります');
  }
  
  return errors;
}

/**
 * アプリケーション設定を初期化
 * .envファイルを読み込み、環境変数を設定してからconfigを生成
 */
export function initializeAppConfig(): AppConfig {
  // 1. .envファイルを読み込み
  loadEnvFile();
  
  // 2. 環境設定を取得
  const environmentConfig = loadEnvironmentConfig();
  
  // 3. デフォルト設定に環境設定をマージ
  const config: AppConfig = {
    ...defaultConfig,
    environment: environmentConfig
  };
  
  return config;
}