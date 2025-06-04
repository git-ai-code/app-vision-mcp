import { desktopCapturer, screen } from 'electron';
import { Logger } from '../../utils/logger';

export interface AppInfo {
  id: string;
  name: string;
  processName: string;
  windowTitle: string;
  icon?: string;
  adapterType?: string;
  pid?: number;
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface DisplayInfo {
  id: string;
  name: string;
  isPrimary: boolean;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  scaleFactor: number;
}

export interface SelectionOption {
  type: 'special' | 'display' | 'application';
  id: string;
  name: string;
  displayName: string;
  icon?: string;
  adapterType?: string;
  metadata?: any;
}

export class AppDiscoveryService {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('info'); // LogLevelを最初の引数に
  }

  /**
   * 利用可能なアプリケーション一覧を取得
   */
  async getAvailableApps(): Promise<AppInfo[]> {
    try {
      const apps: AppInfo[] = [];
      
      // Electronのソース一覧から取得
      const sources = await desktopCapturer.getSources({
        types: ['window'],
        thumbnailSize: { width: 0, height: 0 }
      });
      
      for (const [index, source] of sources.entries()) {
        // 空のウィンドウや非表示ウィンドウをスキップ
        if (!source.name || source.name.trim() === '' || source.name === 'Desktop') {
          continue;
        }

        // App Vision MCP関連を特別チェック
        if (source.name.toLowerCase().includes('app') || 
            source.name.toLowerCase().includes('vision') ||
            source.name.toLowerCase().includes('universal')) {
        }

        const appInfo = await this.analyzeWindowSource(source);
        if (appInfo) {
          apps.push(appInfo);
        }
      }

      // 重複除去とソート
      const uniqueApps = this.deduplicateApps(apps);
      const sortedApps = this.sortAppsByRelevance(uniqueApps);

      return sortedApps;

    } catch (error) {
      this.logger.error('Failed to get available apps:', error);
      return [];
    }
  }

  /**
   * ディスプレイ情報を取得
   */
  async getAvailableDisplays(): Promise<DisplayInfo[]> {
    try {
      const displays = screen.getAllDisplays();
      
      return displays.map((display, index) => ({
        id: `display-${display.id}`,
        name: `ディスプレイ ${index + 1}`,
        isPrimary: display.bounds.x === 0 && display.bounds.y === 0,
        bounds: display.bounds,
        scaleFactor: display.scaleFactor
      }));

    } catch (error) {
      this.logger.error('Failed to get displays:', error);
      return [];
    }
  }

  /**
   * 選択オプション一覧を取得（統合版）
   */
  async getSelectionOptions(): Promise<SelectionOption[]> {
    const options: SelectionOption[] = [];

    // 特殊選択は削除（フルスクリーン関連処理を削除）

    // ディスプレイ選択を追加
    const displays = await this.getAvailableDisplays();
    for (const display of displays) {
      options.push({
        type: 'display',
        id: display.id,
        name: display.name,
        displayName: `📺 ${display.name}${display.isPrimary ? ' (プライマリ)' : ''} - 単体`,
        icon: '📺',
        metadata: display
      });
    }

    // アプリケーション選択を追加
    const apps = await this.getAvailableApps();
    
    // App Vision MCP専用の特別処理は削除済み
    
    for (const app of apps) {
      const icon = this.getAppIcon(app.adapterType || 'generic');
      
      // 同じアプリ名が複数ある場合はウィンドウタイトルを表示
      const sameAppCount = apps.filter(a => a.name === app.name).length;
      const displayName = sameAppCount > 1 
        ? `${icon} ${app.name} - ${this.truncateTitle(app.windowTitle)}`
        : `${icon} ${app.name}${app.adapterType ? ` (${app.adapterType})` : ''}`;
      
      options.push({
        type: 'application',
        id: app.id,
        name: app.windowTitle, // 実際の検索対象はウィンドウタイトル全体
        displayName: displayName,
        icon: icon,
        adapterType: app.adapterType,
        metadata: app
      });
    }

    return options;
  }

  private async analyzeWindowSource(source: Electron.DesktopCapturerSource): Promise<AppInfo | null> {
    try {
      // ウィンドウ名からアプリケーション情報を抽出
      const windowTitle = source.name;
      const processName = this.extractProcessName(windowTitle);
      const appName = this.extractAppName(windowTitle, processName);
      
      // App Vision MCP関連の詳細ログ
      if (windowTitle.toLowerCase().includes('app') || 
          windowTitle.toLowerCase().includes('vision') ||
          windowTitle.toLowerCase().includes('universal')) {
      }
      
      // アダプタータイプを検出
      const adapterType = this.detectAdapterType(appName, windowTitle);
      
      // アイコンを取得（サムネイルから）
      let iconDataUrl: string | undefined;
      if (source.thumbnail) {
        try {
          iconDataUrl = source.thumbnail.toDataURL();
        } catch (error) {
          // アイコン取得失敗は無視
        }
      }

      const result = {
        id: `app-${source.id}`,
        name: appName,
        processName: processName,
        windowTitle: windowTitle,
        icon: iconDataUrl,
        adapterType: adapterType,
        // 追加情報があれば設定
        bounds: source.display_id ? undefined : undefined // 将来的に実装
      };

      if (windowTitle.toLowerCase().includes('app') || 
          windowTitle.toLowerCase().includes('vision')) {
      }

      return result;

    } catch (error) {
      this.logger.warn('Failed to analyze window source:', error);
      return null;
    }
  }

  private extractProcessName(windowTitle: string): string {
    // ウィンドウタイトルの最初の単語を使用（汎用化）
    const firstWord = windowTitle.split(/[\s\-–—]+/)[0];
    return firstWord || 'unknown';
  }

  private extractAppName(windowTitle: string, processName: string): string {
    // 汎用化：ウィンドウタイトルの最後の部分を使用
    const parts = windowTitle.split(/[\-–—]/);
    return parts[parts.length - 1]?.trim() || windowTitle;
  }

  private detectAdapterType(appName: string, windowTitle: string): string | undefined {
    // 汎用アダプターのみ使用（helpers.tsで'generic'固定のため）
    return 'generic';
  }

  private deduplicateApps(apps: AppInfo[]): AppInfo[] {
    const seen = new Map<string, AppInfo>();
    
    for (const app of apps) {
      // ウィンドウタイトル全体をキーにして、同じウィンドウの重複のみ除去
      const key = `${app.name}::${app.windowTitle}`;
      const existing = seen.get(key);
      
      if (!existing) {
        seen.set(key, app);
      }
    }

    return Array.from(seen.values());
  }

  private sortAppsByRelevance(apps: AppInfo[]): AppInfo[] {
    return apps.sort((a, b) => {
      // シンプルにアルファベット順（日本語も含む）
      return a.name.localeCompare(b.name, 'ja', { numeric: true });
    });
  }

  private getAppIcon(adapterType: string): string {
    const iconMap: Record<string, string> = {
      'image-editing': '🎨',
      'development': '💻',
      'browser': '🌐',
      'game-development': '🎮',
      'generic': '📱'
    };

    return iconMap[adapterType] || '📱';
  }

  /**
   * ウィンドウタイトルを短縮表示用に切り詰め
   */
  private truncateTitle(title: string, maxLength: number = 40): string {
    if (title.length <= maxLength) {
      return title;
    }
    
    // アプリ名部分を除去してページタイトル部分のみ表示
    const parts = title.split(' - ');
    if (parts.length > 1) {
      // 最後の部分（通常アプリ名）を除去
      const pageTitle = parts.slice(0, -1).join(' - ');
      if (pageTitle.length <= maxLength) {
        return pageTitle;
      }
    }
    
    return title.substring(0, maxLength - 3) + '...';
  }

}