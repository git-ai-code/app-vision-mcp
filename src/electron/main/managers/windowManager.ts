/**
 * App Vision MCP - Window Manager
 * ウィンドウの作成、管理、および表示制御
 */

import { BrowserWindow, dialog } from 'electron';
import * as path from 'path';
import { AppConfig } from '../../assets/config/appConfig';
import { getLogger } from '../../utils/logger';
import { formatDataDateTime } from '../../../utils/dateFormatter.js';

const logger = getLogger();

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;
  private config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
  }

  /**
   * メインウィンドウの作成
   */
  async createMainWindow(): Promise<BrowserWindow> {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.focus();
      return this.mainWindow;
    }

    this.mainWindow = new BrowserWindow({
      width: this.config.window.width,
      height: this.config.window.height,
      minWidth: this.config.window.minWidth,
      minHeight: this.config.window.minHeight,
      resizable: this.config.window.resizable,
      autoHideMenuBar: true, // メニューバー自動非表示
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../../preload.js')
      }
    });

    // HTMLファイルのロード
    const htmlPath = path.join(__dirname, '../../../assets/index.html');
    
    try {
      await this.mainWindow.loadFile(htmlPath);
    } catch (error) {
      logger.error('Failed to load main window HTML:', error);
      throw error;
    }

    // ウィンドウイベントの設定
    this.setupWindowEvents();

    // 開発者ツールの制御
    this.setupDevTools();

    // ウィンドウを表示
    this.mainWindow.show();

    return this.mainWindow;
  }

  /**
   * ウィンドウイベントの設定
   */
  private setupWindowEvents(): void {
    if (!this.mainWindow) return;

    // ウィンドウが閉じられた
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // ウィンドウサイズ変更
    this.mainWindow.on('resize', () => {
      // サイズ変更の処理は必要に応じて追加
    });

    // ウィンドウの準備完了
    this.mainWindow.once('ready-to-show', () => {
      // 準備完了時の処理は必要に応じて追加
    });

    // ページ読み込み完了
    this.mainWindow.webContents.once('did-finish-load', () => {
      
      // 初期化完了をレンダラーに通知
      this.sendToRenderer('app-initialized', {
        config: this.config,
        timestamp: formatDataDateTime()
      });
    });

    // 外部リンクを既定のブラウザで開く
    this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      return { action: 'deny' }; // Electronで開かない
    });

    // ナビゲーション制御（セキュリティ）
    this.mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
      const parsedUrl = new URL(navigationUrl);
      
      // ファイルプロトコル以外は拒否
      if (parsedUrl.protocol !== 'file:') {
        event.preventDefault();
        logger.warn('Navigation blocked for security', { url: navigationUrl });
      }
    });

    // コンソールメッセージの監視
    this.mainWindow.webContents.on('console-message', (event, level, message) => {
      if (this.config.development.enableConsoleLogging) {
        logger.debug(`Renderer console [${level}]:`, message);
      }
    });
  }

  /**
   * 開発者ツールの設定
   */
  private setupDevTools(): void {
    if (!this.mainWindow) return;

    // 開発モードでの自動DevTools表示は無効化
    // F12キーで手動で開くことは可能

    // キーボードショートカット
    this.mainWindow.webContents.on('before-input-event', (event, input) => {
      // F12 または Ctrl+Shift+I で DevTools 切り替え
      if (input.key === 'F12' || 
          (input.control && input.shift && input.key.toLowerCase() === 'i')) {
        
        if (this.mainWindow?.webContents.isDevToolsOpened()) {
          this.mainWindow.webContents.closeDevTools();
          logger.debug('DevTools closed by keyboard shortcut');
        } else {
          this.mainWindow?.webContents.openDevTools();
          logger.debug('DevTools opened by keyboard shortcut');
        }
      }
    });
  }

  /**
   * レンダラープロセスにメッセージを送信
   */
  sendToRenderer(channel: string, data: any): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
      logger.debug('Message sent to renderer', { channel, data });
    } else {
      logger.warn('Cannot send message to renderer: window not available', { channel });
    }
  }

  /**
   * 設定の更新
   */
  updateConfig(newConfig: AppConfig): void {
    this.config = newConfig;
    
    // ウィンドウタイトルの更新
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.setTitle(this.config.app.title);
      
      // 設定変更をレンダラーに通知
      this.sendToRenderer('config-updated', this.config);
    }
  }

  /**
   * エラーダイアログの表示
   */
  showErrorDialog(title: string, content: string): void {
    dialog.showErrorBox(title, content);
    logger.error('Error dialog shown', { title, content });
  }

  /**
   * 情報ダイアログの表示
   */
  async showInfoDialog(title: string, message: string): Promise<number> {
    const result = await dialog.showMessageBox(this.mainWindow!, {
      type: 'info',
      title: title,
      message: message,
      buttons: ['OK']
    });
    return result.response;
  }

  /**
   * 確認ダイアログの表示
   */
  async showConfirmDialog(title: string, message: string): Promise<boolean> {
    const result = await dialog.showMessageBox(this.mainWindow!, {
      type: 'question',
      title: title,
      message: message,
      buttons: ['はい', 'いいえ'],
      defaultId: 0,
      cancelId: 1
    });
    
    const confirmed = result.response === 0;
    return confirmed;
  }

  /**
   * ファイル選択ダイアログの表示
   */
  async showFileDialog(title: string, filters?: Electron.FileFilter[]): Promise<string | null> {
    const result = await dialog.showOpenDialog(this.mainWindow!, {
      title: title,
      filters: filters,
      properties: ['openFile']
    });
    
    const filePath = result.canceled ? null : result.filePaths[0];
    return filePath;
  }

  /**
   * メインウィンドウの取得
   */
  getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  /**
   * ウィンドウの存在確認
   */
  isMainWindowAvailable(): boolean {
    return this.mainWindow !== null && !this.mainWindow.isDestroyed();
  }

  /**
   * クリーンアップ
   */
  async cleanup(): Promise<void> {
    
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.close();
      
      // ウィンドウが完全に閉じるまで待機
      await new Promise<void>((resolve) => {
        if (this.mainWindow) {
          this.mainWindow.once('closed', resolve);
        } else {
          resolve();
        }
      });
    }
    
    this.mainWindow = null;
  }
}