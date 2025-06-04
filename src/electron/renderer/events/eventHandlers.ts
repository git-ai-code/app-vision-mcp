/**
 * App Vision MCP - Event Handlers
 * イベント処理管理
 */

import type { AppConfig, AnalysisData, InitializationData, ProposalWithStatus, ProposalStatus, ImageDisplayMode } from '../types/index.js';
import { StateManager } from '../state/stateManager.js';
import { UIController } from '../ui/uiController.js';
import { determineAdapterType } from '../utils/helpers.js';

export class EventHandlers {
  private isAPIListenersSetup = false;
  private proposals: ProposalWithStatus[] = [];
  private autoHideTimer: NodeJS.Timeout | null = null;
  
  constructor(
    private stateManager: StateManager,
    private uiController: UIController
  ) {}

  /**
   * API イベントリスナーの設定
   */
  public setupAPIEventListeners(): void {
    if (this.isAPIListenersSetup) {
      return;
    }
    
    if (!window.appVisionAPI) {
      return;
    }
    
    // 解析結果の更新
    window.appVisionAPI.onAnalysisUpdate((data: AnalysisData) => {
      this.handleAnalysisUpdate(data);
    });

    // 設定の更新
    window.appVisionAPI.onConfigUpdate((config: AppConfig) => {
      this.stateManager.setCurrentConfig(config);
      this.uiController.updateUIFromConfig(config);
    });

    // アプリケーション初期化完了
    window.appVisionAPI.onAppInitialized((data: InitializationData) => {
      // 初期化完了後に設定を再読み込み
      this.loadInitialData();
    });

    // 自動キャプチャ完了イベント
    window.appVisionAPI.onAutoCaptureCompleted(async (data: any) => {
      // 手動キャプチャ済みフラグを確認して適切なモードを決定
      let displayMode: ImageDisplayMode = 'auto-only';
      try {
        const flagResult = await window.appVisionAPI.hasManualCaptureFlag();
        if (flagResult.success && flagResult.hasFlag) {
          displayMode = 'dual-view';
        }
      } catch (error) {
        // フォールバック: DOMの状態を確認
        const manualContainer = document.querySelector('.image-container.manual-capture');
        displayMode = manualContainer ? 'dual-view' : 'auto-only';
      }
      
      this.uiController.displayCapturedImage(data.filePath, displayMode);
      this.uiController.showNotification('success', '自動キャプチャ', '📸 自動キャプチャ完了');
    });

    // 自動キャプチャエラーイベント
    window.appVisionAPI.onAutoCaptureError((data: any) => {
      this.uiController.showNotification('error', '自動キャプチャエラー', `❌ キャプチャに失敗しました: ${data.error}`);
    });
    
    this.isAPIListenersSetup = true;
  }

  /**
   * DOM イベントリスナーの設定
   */
  public setupEventListeners(): void {
    // キャプチャ開始ボタン
    const startBtn = document.getElementById('start-capture');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        this.handleStartCapture();
      });
    }

    // キャプチャ停止ボタン
    const stopBtn = document.getElementById('stop-capture');
    stopBtn?.addEventListener('click', () => this.handleStopCapture());

    // 手動キャプチャボタン
    const manualBtn = document.getElementById('manual-capture');
    if (manualBtn) {
      manualBtn.addEventListener('click', () => {
        this.handleManualCapture();
      });
    }

    // スマート選択
    const targetAppSelect = document.getElementById('target-app-select') as HTMLSelectElement;
    targetAppSelect?.addEventListener('change', () => this.handleTargetAppSelection());

    // アプリ一覧更新ボタン
    const refreshBtn = document.getElementById('refresh-apps');
    refreshBtn?.addEventListener('click', () => this.refreshAvailableApps());

    // アダプター選択
    const adapterSelect = document.getElementById('adapter-select') as HTMLSelectElement;
    adapterSelect?.addEventListener('change', () => this.handleAdapterChange());

    // 設定ボタン（新しい設定ポップアップ機能で処理）

    // ヘルプボタン
    const helpBtn = document.getElementById('help-btn');
    helpBtn?.addEventListener('click', () => this.handleHelpClick());
  }

  /**
   * キャプチャ開始処理
   */
  private async handleStartCapture(): Promise<void> {
    // APIが利用可能か確認
    if (!window.appVisionAPI) {
      this.uiController.showNotification('error', 'エラー', 'APIが利用できません');
      return;
    }

    // 現在の選択を取得
    const currentSelection = this.stateManager.getCurrentSelection();
    const targetApp = this.stateManager.getTargetAppName();
    
    // 選択されていない場合
    if (!currentSelection || !targetApp) {
      const targetAppSelect = document.getElementById('target-app-select') as HTMLSelectElement;
      if (targetAppSelect) {
        targetAppSelect.classList.add('validation-error');
        setTimeout(() => targetAppSelect.classList.remove('validation-error'), 2000);
      }
      this.uiController.showNotification('warning', '警告', 'キャプチャ対象を選択してください');
      return;
    }

    try {
      this.uiController.showLoading(true);
      
      // 初回キャプチャ準備時：手動キャプチャ済みフラグをクリア
      try {
        await window.appVisionAPI.clearManualCaptureFlag();
      } catch (error) {
        // フラグクリアに失敗してもキャプチャは続行
      }
      
      const result = await window.appVisionAPI.screenCapture(targetApp);
      
      if (result.success) {
        this.stateManager.setIsCapturing(true);
        this.uiController.updateCaptureStatus(true);
        this.uiController.showNotification('success', '成功', 'キャプチャを開始しました');
        
        // 画像表示はonAutoCaptureCompletedイベントハンドラーに任せる
        // if (result.filePath) {
        //   this.uiController.displayCapturedImage(result.filePath, 'auto-only');
        // }
      } else {
        this.uiController.showNotification('error', 'エラー', result.error || 'キャプチャの開始に失敗しました');
      }
    } catch (error) {
      this.uiController.showNotification('error', 'エラー', 'キャプチャの開始中にエラーが発生しました');
    } finally {
      this.uiController.showLoading(false);
    }
  }

  /**
   * キャプチャ停止処理
   */
  private async handleStopCapture(): Promise<void> {
    this.stateManager.setIsCapturing(false);
    this.uiController.updateCaptureStatus(false);
    this.uiController.showNotification('info', '情報', 'キャプチャを停止しました');
  }

  /**
   * 手動キャプチャ処理
   */
  private async handleManualCapture(): Promise<void> {
    // APIが利用可能か確認
    if (!window.appVisionAPI) {
      this.uiController.showNotification('error', 'エラー', 'APIが利用できません');
      return;
    }

    try {
      // 現在の選択状態を取得
      const currentSelection = this.stateManager.getCurrentSelection();
      const targetApp = currentSelection ? currentSelection.name : null;
      
      this.uiController.showLoading(true);
      const result = await window.appVisionAPI.manualCapture(targetApp);
      
      if (result.success) {
        // 手動キャプチャ済みフラグを作成
        try {
          await window.appVisionAPI.createManualCaptureFlag();
        } catch (error) {
          // フラグ作成に失敗しても手動キャプチャ処理は続行
        }
        
        this.uiController.showNotification('success', '成功', '手動キャプチャが完了しました');
        
        // 手動キャプチャAPIレスポンスにはfilePathが含まれないため、固定パスを使用
        if (result.result && result.result.timestamp) {
          try {
            // filePathパラメータはundefinedでも大丈夫（getScreenshotPaths()で固定パス取得）
            await this.uiController.displayCapturedImage(undefined, 'dual-view');
          } catch (displayError) {
            // 表示エラーは無視して続行
          }
        }
      } else {
        this.uiController.showNotification('error', 'エラー', result.error || '手動キャプチャに失敗しました');
      }
    } catch (error) {
      this.uiController.showNotification('error', 'エラー', '手動キャプチャ中にエラーが発生しました');
    } finally {
      this.uiController.showLoading(false);
    }
  }

  /**
   * 対象アプリの設定
   */
  private async handleTargetAppSelection(): Promise<void> {
    const select = document.getElementById('target-app-select') as HTMLSelectElement;
    if (!select || select.value === '') return;
    
    const selectedOption = this.stateManager.findOptionById(select.value);
    if (!selectedOption) return;
    
    this.stateManager.setCurrentSelection(selectedOption);
    await this.saveLastSelection(selectedOption);
    
    // キャプチャ中なら対象を変更して新しいキャプチャを取得
    if (this.stateManager.getIsCapturing()) {
      await this.changeTargetDuringCapture(selectedOption);
    }
    
    // アダプターの自動選択
    if (selectedOption.type === 'application' && selectedOption.name) {
      const adapterType = determineAdapterType(selectedOption.name);
      const adapterSelect = document.getElementById('adapter-select') as HTMLSelectElement;
      if (adapterSelect && adapterType !== 'generic') {
        adapterSelect.value = adapterType;
      }
    }
  }

  /**
   * キャプチャ中の対象変更
   */
  private async changeTargetDuringCapture(selectedOption: any): Promise<void> {
    if (!window.appVisionAPI) return;
    
    const targetApp = this.stateManager.getTargetAppName();
    if (!targetApp) return;
    
    try {
      this.stateManager.saveSelectionAsPrevious();
      this.uiController.showLoading(true);
      
      const result = await window.appVisionAPI.changeTarget(targetApp);
      
      if (result.success) {
        this.uiController.showNotification('success', '成功', `対象を「${selectedOption.name}」に変更しました`);
        
        // 新しいキャプチャが自動的に開始される
        // changeTargetは新しいキャプチャを自動的にトリガーするが、filePathは返さない
      } else {
        this.uiController.showNotification('error', 'エラー', result.error || '対象の変更に失敗しました');
        // 失敗時は前の選択に戻す
        this.stateManager.restorePreviousSelection();
        this.updateSelectDropdownValue();
      }
    } catch (error) {
      this.uiController.showNotification('error', 'エラー', '対象変更中にエラーが発生しました');
      this.stateManager.restorePreviousSelection();
      this.updateSelectDropdownValue();
    } finally {
      this.uiController.showLoading(false);
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
   * アダプター変更処理
   */
  private async handleAdapterChange(): Promise<void> {
    const select = document.getElementById('adapter-select') as HTMLSelectElement;
    if (!select || !window.appVisionAPI) return;
    
    try {
      const result = await window.appVisionAPI.setAdapter(select.value);
      if (!result.success) {
        this.uiController.showNotification('error', 'エラー', result.error || 'アダプターの変更に失敗しました');
      }
    } catch (error) {
      this.uiController.showNotification('error', 'エラー', 'アダプター変更中にエラーが発生しました');
    }
  }


  /**
   * ヘルプを表示
   */
  private handleHelpClick(): void {
    this.showHelpPopup();
  }

  /**
   * 解析結果の処理
   */
  private handleAnalysisUpdate(data: AnalysisData): void {
    // 提案の更新
    if (data.proposals) {
      this.setProposals(data.proposals);
    }
    
    // スクリーンショットの更新
    if (data.screenshot) {
      this.uiController.updateScreenshot(data.screenshot);
    }
  }

  /**
   * アプリ一覧の更新
   */
  private async refreshAvailableApps(): Promise<void> {
    if (!window.appVisionAPI) return;
    
    try {
      const result = await window.appVisionAPI.getSelectionOptions();
      if (result.success && result.options) {
        this.stateManager.setAvailableOptions(result.options);
        this.uiController.populateSelectDropdown(result.options);
        this.uiController.showNotification('success', '成功', 'アプリ一覧を更新しました');
      }
    } catch (error) {
      this.uiController.showNotification('error', 'エラー', 'アプリ一覧の更新に失敗しました');
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

  /**
   * 最後の選択を保存
   */
  private async saveLastSelection(selection: any): Promise<void> {
    if (!window.appVisionAPI) return;
    
    try {
      await window.appVisionAPI.saveLastSelection(selection);
    } catch (error) {
      // エラー時は静かに失敗
    }
  }

  /**
   * 提案の採用
   */
  public adoptProposal(index: number): void {
    if (index < 0 || index >= this.proposals.length) return;
    
    const proposal = this.proposals[index];
    if (proposal.status !== 'pending') return;
    
    // 提案を採用状態に変更
    proposal.status = 'adopted';
    proposal.adoptedAt = Date.now();
    
    // UIを更新（採用状態を反映）
    this.updateProposalDisplay();
    
    // 自動削除タイマーをクリア（採用済み提案は永続化）
    this.clearAutoHideTimer();
    
    this.uiController.showNotification('success', '採用', `提案「${proposal.title}」を採用しました`);
  }

  /**
   * 提案の却下
   */
  public dismissProposal(index: number): void {
    if (index < 0 || index >= this.proposals.length) return;
    
    const proposal = this.proposals[index];
    if (proposal.status !== 'pending') return;
    
    // 提案を却下状態に変更
    proposal.status = 'dismissed';
    
    // 即座にUIから削除
    this.removeProposalFromDOM(index);
    
    // 残りの提案が全て処理済みかチェック
    this.checkIfAllProposalsProcessed();
    
    this.uiController.showNotification('info', '却下', `提案「${proposal.title}」を却下しました`);
  }

  /**
   * 採用済み提案の完了処理（一括）
   */
  public completeAdoptedProposals(): void {
    // 採用済み提案を削除
    this.proposals = this.proposals.filter(p => p.status !== 'adopted');
    
    // UIを更新
    this.updateProposalDisplay();
    
    // 残りの提案に自動削除タイマーを再設定
    this.startAutoHideTimer();
    
    this.uiController.showNotification('success', '完了', '採用済み提案をクリアしました');
  }

  /**
   * 個別提案の完了処理
   */
  public completeIndividualProposal(index: number): void {
    if (index < 0 || index >= this.proposals.length) return;
    
    const proposal = this.proposals[index];
    if (proposal.status !== 'adopted') return;
    
    // 特定の提案を削除
    this.proposals.splice(index, 1);
    
    // UIを更新
    this.updateProposalDisplay();
    
    // 残りの提案に自動削除タイマーを再設定
    this.startAutoHideTimer();
    
    this.uiController.showNotification('success', '完了', `提案「${proposal.title}」を完了しました`);
  }

  /**
   * 未処理提案のみクリア
   */
  public clearPendingProposals(): void {
    const pendingCount = this.proposals.filter(p => p.status === 'pending').length;
    
    if (pendingCount === 0) {
      this.uiController.showNotification('info', '情報', '削除対象の未処理提案がありません');
      return;
    }
    
    // 未処理提案を削除
    this.proposals = this.proposals.filter(p => p.status !== 'pending');
    
    // UIを更新
    this.updateProposalDisplay();
    
    // 自動削除タイマーをクリア
    this.clearAutoHideTimer();
    
    this.uiController.showNotification('success', '削除完了', `${pendingCount}件の未処理提案を削除しました`);
  }

  /**
   * 全提案をクリア
   */
  public clearAllProposals(): void {
    const totalCount = this.proposals.length;
    const visibleCount = this.proposals.filter(p => p.status !== 'dismissed').length;
    
    if (totalCount === 0) {
      this.uiController.showNotification('info', '情報', '削除対象の提案がありません');
      return;
    }
    
    // 全提案を削除
    this.proposals = [];
    
    // UIを更新
    this.updateProposalDisplay();
    
    // 自動削除タイマーをクリア
    this.clearAutoHideTimer();
    
    this.uiController.showNotification('success', '削除完了', `${visibleCount}件の提案を全て削除しました`);
  }

  /**
   * 提案表示の更新
   */
  private updateProposalDisplay(): void {
    // 未処理と採用済みの提案のみ表示
    const visibleProposals = this.proposals.filter(p => p.status !== 'dismissed');
    this.uiController.updateProposalsWithStatus(visibleProposals);
    
    // カウント表示も更新（却下済みを除外した数値で表示）
    this.uiController.updateProposalCounts(visibleProposals);
  }

  /**
   * DOMから特定の提案を削除
   */
  private removeProposalFromDOM(index: number): void {
    const proposalElement = document.querySelector(`[data-index="${index}"]`);
    if (proposalElement) {
      proposalElement.remove();
    }
  }

  /**
   * 全ての提案が処理済みかチェック
   */
  private checkIfAllProposalsProcessed(): void {
    const pendingProposals = this.proposals.filter(p => p.status === 'pending');
    if (pendingProposals.length === 0) {
      // 未処理の提案がない場合は自動削除タイマーをクリア
      this.clearAutoHideTimer();
    }
  }


  /**
   * 自動削除タイマーを開始
   */
  private startAutoHideTimer(): void {
    this.clearAutoHideTimer();
    
    // 未処理の提案がある場合のみタイマーを設定
    const pendingProposals = this.proposals.filter(p => p.status === 'pending');
    if (pendingProposals.length > 0) {
      this.autoHideTimer = setTimeout(() => {
        this.hideAllPendingProposals();
      }, 5 * 60 * 1000); // 5分
    }
  }

  /**
   * 自動削除タイマーをクリア
   */
  private clearAutoHideTimer(): void {
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
      this.autoHideTimer = null;
    }
  }

  /**
   * 未処理の提案をすべて非表示
   */
  private hideAllPendingProposals(): void {
    this.proposals = this.proposals.filter(p => p.status === 'adopted');
    this.updateProposalDisplay();
    this.uiController.showNotification('info', '自動クリア', '未処理の提案が自動的にクリアされました');
  }

  /**
   * 新しい提案データを設定
   */
  public setProposals(newProposals: AnalysisData['proposals']): void {
    if (!newProposals) return;
    
    // 既存の採用済み提案を保持しつつ、新しい提案を追加
    const adoptedProposals = this.proposals.filter(p => p.status === 'adopted');
    
    // 新しい提案をpending状態で追加
    const pendingProposals: ProposalWithStatus[] = newProposals.map(proposal => ({
      ...proposal,
      status: 'pending' as ProposalStatus
    }));
    
    this.proposals = [...adoptedProposals, ...pendingProposals];
    
    // UIを更新
    this.updateProposalDisplay();
    
    // 自動削除タイマーを開始
    this.startAutoHideTimer();
  }

  /**
   * 設定ポップアップのイベントリスナー設定
   */
  public setupSettingsPopupListeners(): void {
    const settingsBtn = document.getElementById('settings-btn');
    const settingsPopup = document.getElementById('settings-popup');
    const settingsPopupClose = document.getElementById('settings-popup-close');
    const openFolderBtn = document.getElementById('open-folder-btn');

    if (!settingsBtn || !settingsPopup || !settingsPopupClose || !openFolderBtn) {
      return;
    }

    // 設定ボタンクリック - ポップアップ表示
    settingsBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await this.showSettingsPopup();
    });

    // 閉じるボタンクリック
    settingsPopupClose.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.hideSettingsPopup();
    });

    // ポップアップ外クリックで閉じる
    settingsPopup.addEventListener('click', (e) => {
      if (e.target === settingsPopup) {
        this.hideSettingsPopup();
      }
    });

    // ESCキーで閉じる
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && settingsPopup.style.display === 'flex') {
        this.hideSettingsPopup();
      }
    });

    // フォルダを開くボタン
    openFolderBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await this.openSharedDataFolder();
    });

  }

  /**
   * 設定ポップアップを表示
   */
  private async showSettingsPopup(): Promise<void> {
    const settingsPopup = document.getElementById('settings-popup');
    const sharedDataPathElement = document.getElementById('shared-data-path');

    if (!settingsPopup || !sharedDataPathElement) return;

    try {
      // 共有データパスを取得
      if (window.appVisionAPI?.getSharedDataPath) {
        const result = await window.appVisionAPI.getSharedDataPath();
        if (result.success && result.path) {
          sharedDataPathElement.textContent = result.path;
        } else {
          sharedDataPathElement.textContent = 'パスの取得に失敗しました';
        }
      } else {
        sharedDataPathElement.textContent = 'API利用不可';
      }
    } catch (error) {
      sharedDataPathElement.textContent = 'エラーが発生しました';
    }

    // ポップアップを表示
    settingsPopup.style.display = 'flex';
    
    // フォーカストラップ用に最初の要素にフォーカス
    const closeBtn = document.getElementById('settings-popup-close');
    if (closeBtn) {
      closeBtn.focus();
    }
  }

  /**
   * 設定ポップアップを非表示
   */
  private hideSettingsPopup(): void {
    const settingsPopup = document.getElementById('settings-popup');
    if (!settingsPopup) return;

    // フェードアウトアニメーション
    settingsPopup.classList.add('fade-out');
    
    setTimeout(() => {
      settingsPopup.style.display = 'none';
      settingsPopup.classList.remove('fade-out');
    }, 200);
  }

  /**
   * 共有データフォルダを開く
   */
  private async openSharedDataFolder(): Promise<void> {
    try {
      if (window.appVisionAPI?.openSharedDataFolder) {
        const result = await window.appVisionAPI.openSharedDataFolder();
        if (result.success) {
          this.uiController.showNotification('success', '成功', 'フォルダを開きました');
          this.hideSettingsPopup();
        } else {
          this.uiController.showNotification('error', 'エラー', 'フォルダを開けませんでした');
        }
      } else {
        this.uiController.showNotification('error', 'エラー', 'API利用不可');
      }
    } catch (error) {
      this.uiController.showNotification('error', 'エラー', 'フォルダを開く際にエラーが発生しました');
    }
  }

  /**
   * ヘルプポップアップのイベントリスナー設定
   */
  public setupHelpPopupListeners(): void {
    const helpBtn = document.getElementById('help-btn');
    const helpPopup = document.getElementById('help-popup');
    const helpPopupClose = document.getElementById('help-popup-close');

    if (!helpBtn || !helpPopup || !helpPopupClose) {
      return;
    }

    // ヘルプボタンクリック - ポップアップ表示
    helpBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showHelpPopup();
    });

    // 閉じるボタンクリック
    helpPopupClose.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.hideHelpPopup();
    });

    // ポップアップ外クリックで閉じる
    helpPopup.addEventListener('click', (e) => {
      if (e.target === helpPopup) {
        this.hideHelpPopup();
      }
    });

    // ESCキーで閉じる（既存のESCハンドラーに統合）
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && helpPopup.style.display === 'flex') {
        this.hideHelpPopup();
      }
    });

  }

  /**
   * ヘルプポップアップを表示
   */
  private showHelpPopup(): void {
    const helpPopup = document.getElementById('help-popup');
    if (!helpPopup) return;

    // ポップアップを表示
    helpPopup.style.display = 'flex';
    
    // フォーカストラップ用に最初の要素にフォーカス
    const closeBtn = document.getElementById('help-popup-close');
    if (closeBtn) {
      closeBtn.focus();
    }
  }

  /**
   * ヘルプポップアップを非表示
   */
  private hideHelpPopup(): void {
    const helpPopup = document.getElementById('help-popup');
    if (!helpPopup) return;

    // フェードアウトアニメーション
    helpPopup.classList.add('fade-out');
    
    setTimeout(() => {
      helpPopup.style.display = 'none';
      helpPopup.classList.remove('fade-out');
    }, 200);
  }
}