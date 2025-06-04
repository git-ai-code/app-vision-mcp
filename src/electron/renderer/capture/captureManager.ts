/**
 * App Vision MCP - Capture Manager
 * キャプチャ機能管理
 */

import type { SelectionOption } from '../types/index.js';
import { StateManager } from '../state/stateManager.js';
import { UIController } from '../ui/uiController.js';
import { getSimpleLogger } from '../utils/simpleLogger.js';
import { getScreenshotPaths } from '../utils/helpers.js';

const logger = getSimpleLogger('CaptureManager');

export class CaptureManager {
  constructor(
    private stateManager: StateManager,
    private uiController: UIController
  ) {}

  /**
   * AI解析の開始
   */
  public async startAIAnalysis(): Promise<void> {
    try {
      this.uiController.showLoading(true);
      
      // AI解析処理（実際の処理はバックエンドで行われる）
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      this.uiController.showNotification('success', '完了', 'AI解析が完了しました');
    } catch (error) {
      this.uiController.showNotification('error', 'エラー', 'AI解析中にエラーが発生しました');
    } finally {
      this.uiController.showLoading(false);
    }
  }

  /**
   * スマート選択システムの初期化
   */
  public async initializeSmartSelection(): Promise<void> {
    try {
      // 前回の選択を復元
      await this.restoreLastSelection();
      
      // アプリ一覧を読み込み
      await this.loadSelectionOptions();
      
      logger.info('Smart selection system initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize smart selection:', error);
      this.uiController.showNotification('warning', '警告', 'アプリ選択システムの初期化に失敗しました');
    }
  }

  /**
   * 選択オプションの読み込み
   */
  private async loadSelectionOptions(): Promise<void> {
    logger.info('Loading selection options...');
    try {
      const result = await window.appVisionAPI.getSelectionOptions();
      logger.info('getSelectionOptions result:', result);
      
      if (result.success && result.options) {
        logger.info(`Loaded ${result.options.length} options`);
        this.stateManager.setAvailableOptions(result.options);
        this.uiController.populateSelectDropdown(result.options);
      } else {
        logger.error('Failed to load options:', result.error);
        this.uiController.showNotification('error', 'エラー', '選択肢の読み込みに失敗しました');
      }
    } catch (error) {
      logger.error('Error loading selection options:', error);
      this.uiController.showNotification('error', 'エラー', '選択肢の読み込み中にエラーが発生しました');
    }
  }

  /**
   * 前回の選択を復元
   */
  private async restoreLastSelection(): Promise<void> {
    try {
      const result = await window.appVisionAPI.getLastSelection();
      if (result.success && result.selection) {
        this.stateManager.setCurrentSelection(result.selection);
        this.updateSelectDropdownValue();
      }
    } catch (error) {
      // エラー時は静かに失敗
    }
  }

  /**
   * ドロップダウンの値を現在の選択に更新
   */
  private updateSelectDropdownValue(): void {
    const select = document.getElementById('target-app-select') as HTMLSelectElement;
    const currentSelection = this.stateManager.getCurrentSelection();
    if (select && currentSelection) {
      select.value = currentSelection.id;
    }
  }

  /**
   * メモリ監視の開始
   */
  public startMemoryMonitor(): void {
    setInterval(async () => {
      try {
        // APIが利用可能になるまで待機
        if (!window.appVisionAPI?.getMemoryUsage) {
          return;
        }
        
        const result = await window.appVisionAPI.getMemoryUsage();
        if (result.success && result.memoryMB !== undefined) {
          const element = document.getElementById('memory-usage');
          if (element) {
            element.textContent = result.memoryMB.toString();
          }
        }
      } catch (error) {
        // APIが未準備の場合は静かに失敗
      }
    }, 2000);
  }

  /**
   * 最新のスクリーンショットパスを取得
   */
  public async getLatestScreenshotPath(): Promise<string> {
    try {
      const paths = await getScreenshotPaths();
      // 手動キャプチャを優先（通常、手動の方が最新）
      return paths.manual;
    } catch (error) {
      // フォールバック: 相対パス
      return '.\\shared-data\\manual\\current\\screenshot.png';
    }
  }
}