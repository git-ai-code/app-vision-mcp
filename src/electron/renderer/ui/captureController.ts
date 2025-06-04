/**
 * App Vision MCP - Capture Controller
 * キャプチャ制御専用
 */

import type { 
  ImageDisplayMode, 
  LayoutConfig, 
  AspectRatioInfo 
} from '../types/index.js';
import { 
  updateLastCaptureTime,
  createImageUrl,
  getWindowAspectRatio,
  checkImageAndGetInfo,
  getScreenshotPaths
} from '../utils/helpers.js';

export class CaptureController {
  private uiController?: any; // UIController への参照

  /**
   * UIController の参照を設定
   */
  public setUIController(uiController: any): void {
    this.uiController = uiController;
  }

  /**
   * キャプチャステータスの更新
   */
  public updateCaptureStatus(isActive: boolean): void {
    const statusText = document.getElementById('status-text');
    const statusDot = document.getElementById('status-dot');
    const startBtn = document.getElementById('start-capture') as HTMLButtonElement;
    const stopBtn = document.getElementById('stop-capture') as HTMLButtonElement;
    
    if (statusText) {
      statusText.textContent = isActive ? '準備完了' : '停止中';
    }
    
    if (statusDot) {
      if (isActive) {
        statusDot.classList.add('active');
      } else {
        statusDot.classList.remove('active');
      }
    }
    
    if (startBtn) {
      startBtn.disabled = isActive;
    }
    
    if (stopBtn) {
      stopBtn.disabled = !isActive;
    }
    
    // 手動キャプチャはキャプチャ中のみ有効
    const manualBtn = document.getElementById('manual-capture') as HTMLButtonElement;
    if (manualBtn) {
      manualBtn.disabled = !isActive;
    }
  }

  /**
   * スクリーンショットの更新
   */
  public updateScreenshot(screenshotData: string): void {
    const container = document.getElementById('screenshot-container');
    if (!container) return;
    
    const img = document.createElement('img');
    img.src = screenshotData;
    img.alt = 'キャプチャ画像';
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';
    img.style.objectFit = 'contain';
    
    // コンテナをクリアして新しい画像を表示
    container.innerHTML = '';
    container.appendChild(img);
  }

  /**
   * キャプチャ画像の表示
   */
  public async displayCapturedImage(filePath?: string, mode: ImageDisplayMode = 'dual-view'): Promise<void> {
    try {
      const container = document.getElementById('screenshot-container');
      if (!container) {
        return;
      }

      // プレースホルダーコンテンツをクリア
      container.innerHTML = '';
      container.offsetHeight; // reflow を強制

      // 両方のスクリーンショットパスを取得
      const paths = await getScreenshotPaths();
      
      const autoImageInfo = mode === 'manual-only' ? null : await checkImageAndGetInfo(paths.automatic);
      const manualImageInfo = mode === 'auto-only' ? null : await checkImageAndGetInfo(paths.manual);
      
      // 最適なレイアウトを決定
      const layout = this.determineOptimalLayout(autoImageInfo, manualImageInfo);
      
      // デュアルビューコンテナを作成
      const dualViewContainer = document.createElement('div');
      
      // 単独表示の場合は single-view クラスを適用
      const isSingleView = !autoImageInfo || !manualImageInfo;
      if (isSingleView) {
        dualViewContainer.className = `dual-view-container single-view`;
      } else {
        dualViewContainer.className = `dual-view-container ${layout.containerClass}`;
      }
      
      // レイアウト更新ボタンを追加（両方の画像がある場合のみ）
      if (autoImageInfo && manualImageInfo) {
        this.addLayoutUpdateButton();
      }
      
      // 自動キャプチャコンテナ
      if (autoImageInfo) {
        const autoContainer = this.createImageContainer('auto', paths.automatic, layout.autoPosition);
        dualViewContainer.appendChild(autoContainer);
      }
      
      // 手動キャプチャコンテナ
      if (manualImageInfo) {
        const manualContainer = this.createImageContainer('manual', paths.manual, layout.manualPosition);
        dualViewContainer.appendChild(manualContainer);
      }
      
      // コンテナに追加
      container.appendChild(dualViewContainer);
      updateLastCaptureTime();
      
    } catch (error) {
      // エラーは無視して続行
    }
  }

  /**
   * 自動キャプチャのみクリア（スマートクリア対応）
   */
  public async clearAutomaticCapture(): Promise<void> {
    // 現在のDOM状態から手動キャプチャが表示されているかチェック
    const manualContainer = document.querySelector('.image-panel.manual-capture');
    const autoContainer = document.querySelector('.image-panel.auto-capture');
    
    if (manualContainer) {
      // 手動キャプチャも表示されている場合は手動のみ表示
      this.displayCapturedImage(undefined, 'manual-only');
    } else {
      // 手動キャプチャが表示されていない場合は完全に初期状態に戻る
      this.clearCapturedImage();
    }
  }

  /**
   * 手動キャプチャのみクリア（スマートクリア対応）
   */
  public async clearManualCapture(): Promise<void> {
    
    // 現在のDOM状態から自動キャプチャが表示されているかチェック
    const manualContainer = document.querySelector('.image-panel.manual-capture');
    const autoContainer = document.querySelector('.image-panel.auto-capture');
    
    if (autoContainer) {
      // 自動キャプチャも表示されている場合は自動のみ表示
      this.displayCapturedImage(undefined, 'auto-only');
    } else {
      // 自動キャプチャが表示されていない場合は完全に初期状態に戻る
      this.clearCapturedImage();
    }
  }

  /**
   * キャプチャ画像をクリア
   */
  public clearCapturedImage(): void {
    const container = document.getElementById('screenshot-container');
    if (!container) return;

    // プレースホルダーコンテンツを復元
    container.innerHTML = `
      <div class="placeholder-content">
        <div class="placeholder-icon">📱</div>
        <p class="placeholder-text">キャプチャを開始してください</p>
        <p class="placeholder-subtitle">対象アプリケーションを設定し、キャプチャボタンを押すと画面解析が始まります</p>
      </div>
    `;
  }

  // 以下、private メソッドの実装が必要
  // （現在のuiController.tsから移行予定）

  private determineOptimalLayout(autoImageInfo: AspectRatioInfo | null, manualImageInfo: AspectRatioInfo | null): LayoutConfig {
    // 両方の画像が存在する場合
    if (autoImageInfo && manualImageInfo) {
      const windowAspect = getWindowAspectRatio();
      
      // ウィンドウが縦長の場合は常に上下分割
      if (windowAspect.orientation === 'portrait') {
        return {
          mode: 'top-bottom',
          autoPosition: 'top',
          manualPosition: 'bottom',
          containerClass: 'dual-view-vertical'
        };
      }
      
      // ウィンドウが横長の場合
      // 両方が横長の場合: 左右分割
      if (autoImageInfo.orientation === 'landscape' && manualImageInfo.orientation === 'landscape') {
        return {
          mode: 'side-by-side',
          autoPosition: 'left',
          manualPosition: 'right',
          containerClass: 'dual-view-horizontal'
        };
      }
      
      // 両方が縦長の場合でもウィンドウが横長なら左右分割
      if (autoImageInfo.orientation === 'portrait' && manualImageInfo.orientation === 'portrait') {
        return {
          mode: 'side-by-side',
          autoPosition: 'left',
          manualPosition: 'right',
          containerClass: 'dual-view-horizontal'
        };
      }
      
      // 混在の場合: フレキシブルレイアウト
      return {
        mode: 'side-by-side',
        autoPosition: 'left',
        manualPosition: 'right',
        containerClass: 'dual-view-adaptive'
      };
    }
    
    // 片方のみの場合: 単体表示
    return {
      mode: 'single-focus',
      autoPosition: autoImageInfo ? 'top' : 'bottom',
      manualPosition: manualImageInfo ? 'top' : 'bottom',
      containerClass: 'single-view'
    };
  }

  private addLayoutUpdateButton(): void {
    const captureInfo = document.getElementById('capture-info');
    if (captureInfo) {
      // 既存のボタンがあれば削除
      const existingButton = captureInfo.querySelector('.layout-update-btn');
      if (existingButton) {
        existingButton.remove();
      }
      
      // 新しいボタンを作成
      const layoutUpdateButton = document.createElement('button');
      layoutUpdateButton.className = 'layout-update-btn';
      layoutUpdateButton.innerHTML = '🔄';
      layoutUpdateButton.title = 'レイアウトを更新';
      layoutUpdateButton.onclick = () => (window as any).appRenderer.refreshLayout();
      
      // 最終更新の左側に挿入
      const lastUpdateSpan = captureInfo.querySelector('span:not(#capture-info)');
      if (lastUpdateSpan) {
        captureInfo.insertBefore(layoutUpdateButton, lastUpdateSpan);
      }
    }
  }

  private createImageContainer(type: 'auto' | 'manual', imagePath: string, position: string): HTMLElement {
    const container = document.createElement('div');
    container.className = `image-panel ${type}-capture ${position}`;
    
    const header = document.createElement('div');
    header.className = 'image-panel-header';
    
    const title = document.createElement('span');
    title.className = 'panel-title';
    title.textContent = type === 'auto' ? '🤖 自動キャプチャ' : '👆 手動キャプチャ';
    
    const clearBtn = document.createElement('button');
    clearBtn.className = 'image-clear-btn';
    clearBtn.textContent = '×';
    clearBtn.title = `${type === 'auto' ? '自動' : '手動'}キャプチャを削除`;
    
    // イベントリスナーで削除機能を設定
    clearBtn.addEventListener('click', () => {
      if (type === 'auto') {
        (window as any).appRenderer.clearAutomaticCapture();
      } else {
        (window as any).appRenderer.clearManualCapture();
      }
    });
    
    header.appendChild(title);
    header.appendChild(clearBtn);
    
    const imageWrapper = document.createElement('div');
    imageWrapper.className = 'image-panel-content';
    
    const img = document.createElement('img');
    img.className = 'panel-image';
    img.src = createImageUrl(imagePath);
    img.alt = `${type === 'auto' ? '自動' : '手動'}キャプチャ画像`;
    img.style.cursor = 'pointer';
    img.title = 'クリックで拡大表示';
    
    // 画像クリックで拡大表示
    img.addEventListener('click', (e) => {
      e.stopPropagation();
      // UIControllerのshowImageModalを呼び出す
      if (this.uiController) {
        this.uiController.showImageModal(img.src, type === 'auto' ? '自動キャプチャ' : '手動キャプチャ');
      }
    });
    
    imageWrapper.appendChild(img);
    container.appendChild(header);
    container.appendChild(imageWrapper);
    
    return container;
  }
}