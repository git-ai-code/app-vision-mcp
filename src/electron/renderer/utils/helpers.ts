/**
 * App Vision MCP - Utility Helpers
 * 共通ユーティリティ関数
 */

/**
 * HTMLエスケープ処理
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 優先度レベルの取得（日本語→英語）
 */
export function getPriorityLevel(priority?: string): string {
  switch (priority) {
    case '高':
      return 'high';
    case '中':
      return 'medium';
    case '低':
      return 'low';
    default:
      return 'medium';
  }
}

/**
 * 最終更新時間の更新
 */
export function updateLastCaptureTime(): void {
  const lastUpdateElement = document.getElementById('last-update');
  if (lastUpdateElement) {
    const now = new Date();
    const timeString = now.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    lastUpdateElement.textContent = timeString;
  }
}

/**
 * ローディング状態の表示/非表示
 */
export function showLoading(show: boolean): void {
  const loadingElement = document.getElementById('loading-overlay');
  if (loadingElement) {
    loadingElement.style.display = show ? 'flex' : 'none';
  }
}

/**
 * ファイルパスからベースディレクトリを取得
 */
export async function getBaseDirectory(): Promise<string> {
  // APIを通じて動的にベースディレクトリを取得
  try {
    if (window.appVisionAPI?.getSharedDataPath) {
      const result = await window.appVisionAPI.getSharedDataPath();
      if (result.success && result.path) {
        // shared-dataの親ディレクトリを返す
        return result.path.replace('/shared-data', '').replace('\\shared-data', '');
      }
    }
  } catch (error) {
    console.warn('Failed to get dynamic base directory, using fallback');
  }
  
  // フォールバック: 相対パスベース
  return '.';
}

/**
 * スクリーンショットパスの取得
 */
export async function getScreenshotPaths(): Promise<{ automatic: string; manual: string }> {
  const baseDir = await getBaseDirectory();
  return {
    automatic: `${baseDir}\\shared-data\\automatic\\current\\screenshot.png`,
    manual: `${baseDir}\\shared-data\\manual\\current\\screenshot.png`
  };
}

/**
 * 画像URLの作成（キャッシュ回避付き）
 */
export function createImageUrl(filePath: string): string {
  const timestamp = Date.now();
  return `file://${filePath.replace(/\\/g, '/')}?t=${timestamp}`;
}

/**
 * ウィンドウアスペクト比の取得
 */
export function getWindowAspectRatio(): { ratio: number; orientation: 'landscape' | 'portrait' } {
  const ratio = window.innerWidth / window.innerHeight;
  return {
    ratio,
    orientation: ratio > 1.2 ? 'landscape' : 'portrait'
  };
}

/**
 * 画像の存在確認とアスペクト比計算
 */
export async function checkImageAndGetInfo(imagePath: string): Promise<{ ratio: number; orientation: 'landscape' | 'portrait' } | null> {
  try {
    return await new Promise((resolve) => {
      const img = new Image();
      
      img.onload = function() {
        const ratio = img.width / img.height;
        resolve({
          ratio: ratio,
          orientation: ratio > 1.2 ? 'landscape' : 'portrait'
        });
      };
      
      img.onerror = function() {
        resolve(null);
      };
      
      img.src = createImageUrl(imagePath);
    });
  } catch (error) {
    return null;
  }
}

/**
 * ディレイ関数
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * アダプタータイプの判定（汎用アダプターのみ使用）
 */
export function determineAdapterType(appName: string): string {
  // 汎用アダプターのみを使用するようシンプル化
  return 'generic';
}