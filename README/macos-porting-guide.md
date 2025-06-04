# 🍎 App Vision MCP - macOS移植技術ガイド

## 📋 ドキュメント概要

本ドキュメントは、現在Windows専用で開発されているApp Vision MCPプロジェクトのmacOS移植に関する技術的な調査・分析資料です。

**重要な注意事項**：
- 本ガイドは技術的な**予測と推測**に基づいて作成されています
- 実際の移植作業における**参考資料**として位置づけられます
- 記載内容は**確実な実装手順ではなく**、技術的可能性の検討材料です
- 実装時には追加の調査・検証・テストが必須となります
- ~~実装されていない理由は作者がMaoOS環境を持っていないためとなります~~

**対象読者**: macOS移植を検討する技術者・開発者  
**技術前提**: macOS開発環境およびElectronアプリケーション開発の基礎知識  
**作成日**: 2025-06-04

---

## 🎯 移植可能性評価

### ✅ **高い互換性（すぐに対応可能）**

| 機能 | 現在の実装 | macOS互換性 | 理由 |
|------|-----------|-------------|------|
| アプリ一覧取得 | `desktopCapturer.getSources()` | ✅ 95% | Electron公式API |
| ディスプレイ検出 | `screen.getAllDisplays()` | ✅ 100% | クロスプラットフォーム対応 |
| ファイル管理 | `fs/promises`, `path` | ✅ 100% | Node.js標準API |
| IPC通信 | `ipcMain`, `ipcRenderer` | ✅ 100% | Electron標準機能 |
| UI部分 | HTML/CSS/TypeScript | ✅ 100% | Web標準技術 |

### ⚠️ **要調整（実装修正が必要）**

| 機能 | 現在の問題 | macOS必要対応 | 難易度 |
|------|-----------|-------------|--------|
| 画面キャプチャ | Windows Graphics Capture依存 | Screen Recording権限実装 | 🟡 中 |
| ファイルパス | backslash固定 | `path.join()`統一 | 🟢 低 |
| アプリ判定 | Windows形式前提 | macOS形式対応 | 🟡 中 |
| アプリライフサイクル | 一部Windows特化 | Dock動作対応 | 🟢 低 |

### ❌ **困難（環境依存）**

| 項目 | 制約内容 | 対処法 |
|------|----------|--------|
| 開発環境 | macOS必須 | macOS機材の準備 |
| テスト | 実機での動作確認 | 複数macOSバージョンテスト |

---

## 🔧 技術的検討事項（予測ベース）

### 1. **画面キャプチャ機能のmacOS移植検討**

#### **現在のWindows実装分析**
```typescript
// src/electron/main/services/screenCaptureService.ts
const sources = await desktopCapturer.getSources({
  types: ['window', 'screen'],
  thumbnailSize: {
    width: Math.min(primaryDisplay.size.width, 1920),
    height: Math.min(primaryDisplay.size.height, 1920)
  }
});
```

#### **macOS環境での予想される制約**
- **macOS 10.15 Catalina以降**: Screen Recording権限が必要と予測されます
- **権限未取得時**: `desktopCapturer.getSources()`が空配列を返す可能性があります
- **ユーザー操作**: システム環境設定での手動許可が必要と推測されます

#### **実装予測：PermissionService案**
```typescript
// src/electron/main/services/permissionService.ts
import { systemPreferences, shell, dialog } from 'electron';

export class PermissionService {
  /**
   * Screen Recording権限の状態確認
   */
  async checkScreenRecordingPermission(): Promise<{
    hasPermission: boolean;
    canRequest: boolean;
  }> {
    if (process.platform !== 'darwin') {
      return { hasPermission: true, canRequest: false };
    }

    const status = systemPreferences.getMediaAccessStatus('screen');
    
    return {
      hasPermission: status === 'granted',
      canRequest: status === 'not-determined'
    };
  }

  /**
   * Screen Recording権限の要求
   */
  async requestScreenRecordingPermission(): Promise<boolean> {
    if (process.platform !== 'darwin') {
      return true;
    }

    const { hasPermission, canRequest } = await this.checkScreenRecordingPermission();
    
    if (hasPermission) {
      return true;
    }

    if (canRequest) {
      // システムダイアログを表示して権限要求
      return await systemPreferences.askForMediaAccess('screen');
    }

    // 既に拒否されている場合はシステム環境設定を開く
    await this.showPermissionDialog();
    return false;
  }

  /**
   * システム環境設定への導線
   */
  private async showPermissionDialog(): Promise<void> {
    const result = await dialog.showMessageBox({
      type: 'warning',
      title: 'Screen Recording Permission Required',
      message: 'App Vision MCPには画面収録の権限が必要です',
      detail: 'システム環境設定 > セキュリティとプライバシー > プライバシー > 画面収録 で App Vision MCP を許可してください',
      buttons: ['システム環境設定を開く', 'キャンセル'],
      defaultId: 0
    });

    if (result.response === 0) {
      await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
    }
  }
}
```

#### **ScreenCaptureService修正案**
```typescript
// 修正版: src/electron/main/services/screenCaptureService.ts
import { PermissionService } from './permissionService';

export class ScreenCaptureService {
  private permissionService: PermissionService;

  constructor() {
    this.permissionService = new PermissionService();
  }

  async captureScreen(): Promise<ScreenshotData> {
    // macOSでは権限チェックを優先実行
    if (process.platform === 'darwin') {
      const hasPermission = await this.permissionService.checkScreenRecordingPermission();
      if (!hasPermission.hasPermission) {
        const granted = await this.permissionService.requestScreenRecordingPermission();
        if (!granted) {
          throw new Error('Screen Recording permission is required for screen capture');
        }
      }
    }

    // 既存のキャプチャロジック
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: { width: 1920, height: 1920 }
    });

    // macOS特有のエラーハンドリング
    if (sources.length === 0 && process.platform === 'darwin') {
      throw new Error('No capture sources available. Please check Screen Recording permissions in System Preferences.');
    }

    // 既存の処理続行...
  }
}
```

### 2. **ファイルパス処理のクロスプラットフォーム対応**

#### **現在の問題箇所**
```typescript
// ❌ 問題: src/electron/assets/config/appConfig.ts Line 97
const normalizedPath = sharedDataPath.replace(/\\/g, '/');

// ❌ 問題: src/electron/main/handlers/ipcHandlers.ts Line 154
sharedDataPath = sharedDataPath.replace(/\//g, '\\');

// ❌ 問題: src/electron/renderer/utils/helpers.ts Line 85-86
automatic: `${baseDir}\\shared-data\\automatic\\current\\screenshot.png`,
manual: `${baseDir}\\shared-data\\manual\\current\\screenshot.png`
```

#### **✅ 解決策：統一されたパス処理**
```typescript
// ✅ 修正版: src/electron/assets/config/appConfig.ts
import * as path from 'path';

// MCP設定ファイルの読み込み
function loadMCPConfig(): { sharedDataPath?: string } {
  try {
    const mcpConfigPath = path.join(process.cwd(), 'mcp-config.json');
    const content = fs.readFileSync(mcpConfigPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return {};
  }
}

// パス正規化（クロスプラットフォーム対応）
function normalizeSharedDataPath(configPath?: string): string {
  if (!configPath) {
    return path.join(process.cwd(), 'shared-data');
  }
  
  // 絶対パスの場合はそのまま、相対パスの場合は正規化
  const normalizedPath = path.isAbsolute(configPath) 
    ? path.normalize(configPath)
    : path.resolve(process.cwd(), configPath);
    
  return normalizedPath;
}

// ✅ 修正版: src/electron/renderer/utils/helpers.ts
export async function getScreenshotPaths(): Promise<{ automatic: string; manual: string }> {
  const baseDir = await getBaseDirectory();
  return {
    automatic: path.join(baseDir, 'shared-data', 'automatic', 'current', 'screenshot.png'),
    manual: path.join(baseDir, 'shared-data', 'manual', 'current', 'screenshot.png')
  };
}

export function createImageUrl(filePath: string): string {
  const timestamp = Date.now();
  // ファイルURLでもクロスプラットフォーム対応
  const normalizedPath = filePath.split(path.sep).join('/');
  return `file://${normalizedPath}?t=${timestamp}`;
}
```

### 3. **アプリケーション発見機能のmacOS対応**

#### **現在のWindows向け実装**
```typescript
// src/electron/main/services/appDiscoveryService.ts
private extractAppName(windowTitle: string, processName: string): string {
  // Windows形式: "Document.docx - Microsoft Word"
  const parts = windowTitle.split(/[\-–—]/);
  return parts[parts.length - 1]?.trim() || windowTitle;
}
```

#### **macOS対応版の実装**
```typescript
// ✅ macOS対応版: src/electron/main/services/appDiscoveryService.ts
export class AppDiscoveryService {
  private macosAppPatterns: RegExp[] = [
    /^(.+)\.app$/,  // "Safari.app" → "Safari"
    /^(.+) — (.+)$/,  // "Safari — Google" → "Safari"
    /^(.+) - (.+)$/,  // "Safari - Google" → "Safari" 
  ];

  private extractAppName(windowTitle: string, processName: string): string {
    if (process.platform === 'darwin') {
      return this.extractAppNameMacOS(windowTitle);
    } else {
      return this.extractAppNameWindows(windowTitle);
    }
  }

  private extractAppNameMacOS(windowTitle: string): string {
    // macOS特有のパターンマッチング
    for (const pattern of this.macosAppPatterns) {
      const match = windowTitle.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    // フォールバック: 最初の単語を使用
    const firstWord = windowTitle.split(/[\s\-–—]+/)[0];
    return firstWord || windowTitle;
  }

  private extractAppNameWindows(windowTitle: string): string {
    // 既存のWindows用ロジック
    const parts = windowTitle.split(/[\-–—]/);
    return parts[parts.length - 1]?.trim() || windowTitle;
  }

  private getAppIcon(adapterType: string): string {
    const iconMap: Record<string, string> = {
      'image-editing': '🎨',
      'development': process.platform === 'darwin' ? '💻' : '🖥️',
      'browser': '🌐',
      'game-development': '🎮',
      'generic': process.platform === 'darwin' ? '📱' : '🖼️'
    };

    return iconMap[adapterType] || iconMap['generic'];
  }
}
```

### 4. **アプリケーションライフサイクルのmacOS対応**

#### **現在の実装状況**
```typescript
// src/electron/main/managers/appManager.ts Line 143-147
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {  // ✅ 既に対応済み
    app.quit();
  }
});
```

#### **追加が必要なmacOS対応**
```typescript
// ✅ 完全版: src/electron/main/managers/appManager.ts
private setupAppEvents(): void {
  // 既存のイベント設定...

  // macOS: Dockアイコンクリック時の処理
  app.on('activate', async () => {
    if (process.platform === 'darwin') {
      if (this.windowManager.getMainWindow() === null) {
        await this.windowManager.createMainWindow();
      } else {
        // 既存ウィンドウを前面に表示
        this.windowManager.getMainWindow()?.show();
        this.windowManager.getMainWindow()?.focus();
      }
    }
  });

  // macOS: メニューバーのイベント処理
  app.on('before-quit', async (event) => {
    if (process.platform === 'darwin' && this.isInitialized && !this.isQuitting) {
      event.preventDefault();
      await this.cleanup();
      app.exit(0);
    }
  });

  // macOS: システム終了時の処理
  app.on('will-quit', async (event) => {
    if (process.platform === 'darwin' && this.isInitialized && !this.isQuitting) {
      event.preventDefault();
      await this.cleanup();
      app.exit(0);
    }
  });
}
```

---

## 🚀 段階的移植戦略

### **Phase 1: 基盤準備**（優先度：🔴 高）

#### **1.1 起動スクリプト作成**
```bash
#!/bin/bash
# scripts/start-macos.sh
export NODE_ENV=${NODE_ENV:-development}
export ELECTRON_IS_DEV=1

# macOS特有の環境変数
export NSHighResolutionCapable=true
export ELECTRON_ENABLE_LOGGING=1

# 権限チェック
if [[ "$OSTYPE" == "darwin"* ]]; then
  echo "🍎 macOS環境を検出しました"
  echo "📹 画面収録権限が必要です。初回起動時に許可してください。"
fi

# アプリケーション起動
npm run electron
```

#### **1.2 package.jsonのスクリプト追加**
```json
{
  "scripts": {
    "start:macos": "chmod +x ./scripts/start-macos.sh && ./scripts/start-macos.sh",
    "build:macos": "npm run build && electron-builder --mac",
    "dev:macos": "npm run dev & npm run start:macos"
  }
}
```

#### **1.3 ファイルパス統一修正**
優先修正ファイル：
1. `src/electron/assets/config/appConfig.ts` - 設定パス処理
2. `src/electron/renderer/utils/helpers.ts` - スクリーンショットパス
3. `src/electron/main/handlers/ipcHandlers.ts` - IPC通信でのパス

### **Phase 2: 権限管理実装**（優先度：🔴 高）

#### **2.1 PermissionServiceの実装**
- 新規ファイル: `src/electron/main/services/permissionService.ts`
- 機能: Screen Recording権限の確認・要求・案内

#### **2.2 既存サービスの修正**
- `screenCaptureService.ts`: 権限チェック統合
- `appDiscoveryService.ts`: 権限エラー対応

#### **2.3 エラーハンドリング強化**
```typescript
// macOS特有のエラーメッセージ
const ERROR_MESSAGES = {
  PERMISSION_DENIED: process.platform === 'darwin' 
    ? 'システム環境設定で画面収録を許可してください' 
    : 'キャプチャ権限が必要です',
  NO_SOURCES: process.platform === 'darwin'
    ? '画面収録権限を確認してください'
    : 'キャプチャソースが見つかりません'
};
```

### **Phase 3: UI・UX最適化**（優先度：🟡 中）

#### **3.1 macOS HIG準拠**
- ボタンサイズ・間隔の調整
- macOS標準フォント (San Francisco) の使用
- ダークモード自動対応

#### **3.2 アプリ判定精度向上**
- macOS特有のアプリ名パターン対応
- `.app`サフィックス処理
- 日本語アプリ名対応

#### **3.3 パフォーマンス最適化**
```typescript
// macOS Retinaディスプレイ対応
const getOptimalThumbnailSize = () => {
  if (process.platform === 'darwin') {
    const primaryDisplay = screen.getPrimaryDisplay();
    const scaleFactor = primaryDisplay.scaleFactor;
    return {
      width: Math.min(1920 * scaleFactor, 3840),
      height: Math.min(1920 * scaleFactor, 3840)
    };
  }
  return { width: 1920, height: 1920 };
};
```


---

## 🧪 テスト戦略

### **開発段階でのテスト項目**

#### **1. 基本機能テスト**
```bash
# 権限テスト
npm run test:permissions

# キャプチャ機能テスト  
npm run test:capture

# ファイル処理テスト
npm run test:file-paths
```

#### **2. macOSバージョン互換性**
| macOS | 対応状況 | 備考 |
|-------|----------|------|
| 10.15 Catalina | ✅ 対応 | Screen Recording権限導入 |
| 11.0 Big Sur | ✅ 対応 | 推奨バージョン |
| 12.0 Monterey | ✅ 対応 | ARM64対応 |
| 13.0 Ventura | ✅ 対応 | 最新安定版 |
| 14.0 Sonoma | ✅ 対応 | 最新版 |

#### **3. ハードウェア対応**
- **Intel Mac**: 完全対応
- **Apple Silicon (M1/M2/M3)**: ARM64ビルド必要
- **Retina Display**: 高解像度対応

---

## 📋 移植チェックリスト

### **Phase 1: 基盤準備**
- [ ] macOS起動スクリプト作成
- [ ] package.jsonスクリプト追加
- [ ] `appConfig.ts`のパス処理修正
- [ ] `helpers.ts`のパス処理修正
- [ ] `ipcHandlers.ts`のパス処理修正
- [ ] 基本起動テスト

### **Phase 2: 権限管理**
- [ ] `PermissionService`クラス実装
- [ ] Screen Recording権限チェック
- [ ] 権限要求ダイアログ
- [ ] システム環境設定への導線
- [ ] `screenCaptureService.ts`統合
- [ ] エラーハンドリング実装

### **Phase 3: 機能最適化**
- [ ] macOS向けアプリ判定ロジック
- [ ] HIG準拠UI調整
- [ ] Retinaディスプレイ対応
- [ ] ダークモード対応
- [ ] 日本語環境テスト


---

## 🆘 予想されるトラブルと対処法

### **よくある問題と解決策**

#### **1. 権限関連**
```
❌ 問題: "No sources returned from desktopCapturer"
✅ 解決: システム環境設定 > セキュリティとプライバシー > 画面収録 で許可
```

#### **2. ファイルパス関連**
```
❌ 問題: "ENOENT: no such file or directory"
✅ 解決: path.join()を使用してクロスプラットフォーム対応
```

#### **3. アプリ判定関連**
```
❌ 問題: アプリ名が正しく表示されない
✅ 解決: macOS特有のウィンドウタイトル形式に対応
```

#### **4. パフォーマンス関連**
```
❌ 問題: Retinaディスプレイで動作が重い
✅ 解決: scaleFactor考慮のサムネイルサイズ最適化
```

---

## 📚 参考リソース

### **公式ドキュメント**
- [Electron - macOS Support](https://www.electronjs.org/docs/tutorial/macos-dock)
- [Apple - Screen Recording Permission](https://developer.apple.com/documentation/avfoundation/cameras_and_media_capture/requesting_authorization_for_media_capture_on_macos)

### **コミュニティリソース**
- [macOS Electron App Examples](https://github.com/sindresorhus/awesome-electron#macos)
- [Screen Capture Permission Handling](https://github.com/desktop/desktop/pull/9595)

### **開発ツール**
- [macOS Screen Recording Tester](https://github.com/lachlanjc/macos-screencapture-test)
- [Electron Permission Helper](https://github.com/electron/electron/tree/main/spec/fixtures/api/app)

---

## 📞 サポート・コントリビューション

このガイドに関する質問や改善提案は、プロジェクトのIssueトラッカーまでお寄せください。macOS対応の実装進捗や成果報告も歓迎いたします。

---

## ⚠️ 免責事項

- 本ドキュメントの内容は、技術的な予測・推測に基づく分析結果です
- 実際の移植作業において、記載されている手順や方法が確実に機能することを保証するものではありません
- 移植実装時には、各段階での詳細な検証・テスト・調査が必要です
- macOS環境での動作確認は未実施のため、実機テストでの動作は不確実です

---

**文書種別**: 技術調査・分析資料（予測ベース）  
**作成**: App Vision MCP開発チーム  
**最終更新**: 2025-06-04  
**バージョン**: 1.0.0

*本ガイドは、App Vision MCPのmacOS移植検討における参考情報として提供されています。実装の成功を保証するものではありませんが、移植計画の立案に役立てていただければ幸いです。*