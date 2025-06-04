/**
 * App Vision MCP - Renderer Process (Refactored)
 * レンダラープロセスのメインエントリーポイント
 */

import { StateManager } from './state/stateManager.js';
import { UIController } from './ui/uiController.js';
import { EventHandlers } from './events/eventHandlers.js';
import { CaptureManager } from './capture/captureManager.js';

/**
 * App Vision レンダラー
 * 全てのモジュールを統合し、アプリケーションを制御
 */
class AppVisionRenderer {
  private stateManager: StateManager;
  private uiController: UIController;
  private eventHandlers: EventHandlers;
  private captureManager: CaptureManager;

  constructor() {
    // 依存性注入
    this.stateManager = new StateManager();
    this.uiController = new UIController();
    this.eventHandlers = new EventHandlers(this.stateManager, this.uiController);
    this.captureManager = new CaptureManager(this.stateManager, this.uiController);
    
    // 初期化
    this.initialize();
  }

  /**
   * アプリケーションの初期化
   */
  private initialize(): void {
    // UI の初期化
    this.initializeUI();
    
    // イベントリスナーの設定
    this.setupEventListeners();
    
    // メモリ監視の開始
    this.captureManager.startMemoryMonitor();
    
    // 初期データの読み込み
    this.loadInitialData();
  }

  /**
   * UI の初期化
   */
  private initializeUI(): void {
    // 初期状態の設定
    this.uiController.updateCaptureStatus(false);
    this.uiController.updateProposalCount(0);
    
    // APIの確認
    if (window.appVisionAPI) {
      this.eventHandlers.setupAPIEventListeners();
      
      // DOM要素が確実に読み込まれるまで少し待機
      setTimeout(() => {
        this.captureManager.initializeSmartSelection();
        this.initializeAdapterDropdown();
        this.initializeVersionDisplay();
        this.eventHandlers.setupSettingsPopupListeners();
        this.eventHandlers.setupHelpPopupListeners();
      }, 100);
    } else {
      this.uiController.showNotification('error', 'エラー', 'APIが利用できません');
    }
  }

  /**
   * イベントリスナーの設定
   */
  private setupEventListeners(): void {
    this.eventHandlers.setupEventListeners();
    this.setupIPCListeners();
  }

  /**
   * IPC通信リスナーの設定
   */
  private setupIPCListeners(): void {
    // AI提案更新イベント
    window.electronAPI?.ipcRenderer.on('suggestion-update', (event: any, data: any) => {
      this.handleSuggestionUpdate(data);
    });

    // AI提案クリアイベント
    window.electronAPI?.ipcRenderer.on('suggestion-clear', () => {
      this.handleSuggestionClear();
    });
  }

  /**
   * AI提案更新の処理
   */
  private handleSuggestionUpdate(data: { suggestions: any[], metadata?: any }): void {
    if (data.suggestions && Array.isArray(data.suggestions)) {
      // 新しい提案状態管理システムを使用
      this.eventHandlers.setProposals(data.suggestions);
      
      // 通知を表示
      this.uiController.showNotification(
        'success',
        'AI提案更新',
        `${data.suggestions.length}件の新しい改善提案が生成されました`
      );
    }
  }

  /**
   * AI提案クリアの処理
   */
  private handleSuggestionClear(): void {
    // EventHandlersから現在の提案状態を取得し、採用済み提案のみを保持
    if (this.eventHandlers) {
      try {
        // 未処理提案のみをクリア（採用済みは保持）
        this.eventHandlers.clearPendingProposals();
      } catch (error) {
        // エラー時のフォールバック
        this.uiController.updateProposals([]);
      }
    } else {
      // フォールバック：全提案をクリア
      this.uiController.updateProposals([]);
    }
  }

  /**
   * アダプタードロップダウンの初期化
   */
  private async initializeAdapterDropdown(): Promise<void> {
    try {
      
      const adapterSelect = document.getElementById('adapter-select') as HTMLSelectElement;
      if (!adapterSelect) {
        return;
      }

      // 現在のオプションをクリア
      adapterSelect.innerHTML = '';

      // アダプタードロップダウンオプションを取得
      const result = await window.appVisionAPI.getAdapterDropdownOptions();
      
      if (result.success && result.options) {
        
        // オプションを追加
        result.options.forEach(option => {
          const optionElement = document.createElement('option');
          optionElement.value = option.value;
          optionElement.textContent = option.text;
          
          if (option.description) {
            optionElement.title = option.description;
          }
          
          adapterSelect.appendChild(optionElement);
        });
        
      } else {
        
        // エラー時はデフォルトオプションを表示
        const errorOption = document.createElement('option');
        errorOption.value = 'error';
        errorOption.textContent = 'エラー: アダプターを読み込めません';
        adapterSelect.appendChild(errorOption);
      }
      
    } catch (error) {
      
      // エラー時のフォールバック
      const adapterSelect = document.getElementById('adapter-select') as HTMLSelectElement;
      if (adapterSelect) {
        adapterSelect.innerHTML = '<option value="error">エラー: 初期化失敗</option>';
      }
    }
  }

  /**
   * バージョン表示の初期化
   */
  private async initializeVersionDisplay(): Promise<void> {
    try {
      
      const versionElement = document.getElementById('app-version');
      if (!versionElement) {
        return;
      }

      // アプリ情報を取得してバージョンを表示
      const result = await window.appVisionAPI.getAppInfo();
      
      if (result.success && result.info?.version) {
        versionElement.textContent = `v${result.info.version}`;
      } else {
        // エラー時はデフォルト値のまま
      }
      
    } catch (error) {
      // エラー時はデフォルト値のまま
    }
  }

  /**
   * 初期データの読み込み
   */
  private async loadInitialData(): Promise<void> {
    try {
      // 設定の読み込み
      const configResult = await window.appVisionAPI.getConfig();
      if (configResult.success && configResult.config) {
        this.stateManager.setCurrentConfig(configResult.config);
        this.uiController.updateUIFromConfig(configResult.config);
      }

      // キャプチャ状態の確認
      const statusResult = await window.appVisionAPI.getCaptureStatus();
      if (statusResult.success && statusResult.status) {
        this.uiController.updateCaptureStatus(Boolean(statusResult.status?.captureActive));
      }

    } catch (error) {
      this.uiController.showNotification('error', 'エラー', '初期データの読み込みに失敗しました');
    }
  }

  // ===== グローバル公開用メソッド =====
  
  /**
   * 提案詳細の表示（グローバル公開用）
   */
  public showProposalDetail(index: number): void {
    const proposal = this.eventHandlers.getProposalByIndex(index);
    if (proposal) {
      this.uiController.showProposalDetailModal(proposal);
    }
  }

  /**
   * 提案の採用（グローバル公開用）
   */
  public adoptProposal(index: number): void {
    this.eventHandlers.adoptProposal(index);
  }

  /**
   * 提案の却下（グローバル公開用）
   */
  public dismissProposal(index: number): void {
    this.eventHandlers.dismissProposal(index);
  }

  /**
   * 採用済み提案の完了（グローバル公開用）
   */
  public completeAdoptedProposals(): void {
    this.eventHandlers.completeAdoptedProposals();
  }

  /**
   * 個別提案の完了（グローバル公開用）
   */
  public completeIndividualProposal(index: number): void {
    this.eventHandlers.completeIndividualProposal(index);
  }

  /**
   * 未処理提案のみクリア（グローバル公開用）
   */
  public clearPendingProposals(): void {
    this.eventHandlers.clearPendingProposals();
  }

  /**
   * 全提案をクリア（グローバル公開用）
   */
  public clearAllProposals(): void {
    this.eventHandlers.clearAllProposals();
  }

  /**
   * レイアウトの更新（グローバル公開用）
   */
  public refreshLayout(): void {
    this.uiController.refreshLayout();
  }

  /**
   * 自動キャプチャのクリア（グローバル公開用）
   */
  public clearAutomaticCapture(): void {
    this.uiController.clearAutomaticCapture();
  }

  /**
   * 手動キャプチャのクリア（グローバル公開用）
   */
  public clearManualCapture(): void {
    this.uiController.clearManualCapture();
  }
}

// グローバルインスタンス
let appRenderer: AppVisionRenderer;

// DOM 読み込み完了時に初期化
document.addEventListener('DOMContentLoaded', () => {
  
  // target-app-select要素の存在確認
  const targetSelect = document.getElementById('target-app-select');
  
  try {
    appRenderer = new AppVisionRenderer();
    
    // グローバルアクセス用（初期化後に設定）
    (window as any).appRenderer = appRenderer;
    
  } catch (error) {
  }
});

// TypeScript用のグローバル型宣言
declare global {
  interface Window {
    appRenderer: AppVisionRenderer;
  }
}