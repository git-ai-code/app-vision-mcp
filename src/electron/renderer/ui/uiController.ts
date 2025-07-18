/**
 * App Vision MCP - UI Controller
 * ユーザーインターフェース制御
 */

import type { 
  AppConfig, 
  AnalysisData, 
  SelectionOption,
  NotificationType,
  ImageDisplayMode,
  ProposalWithStatus
} from '../types/index.js';
import { 
  escapeHtml, 
  getPriorityLevel,
  updateLastCaptureTime,
  createImageUrl,
  getScreenshotPaths
} from '../utils/helpers.js';
import { NotificationController } from './notificationController.js';
import { DropdownController } from './dropdownController.js';
import { CaptureController } from './captureController.js';

export class UIController {
  private notificationController: NotificationController;
  private dropdownController: DropdownController;
  private captureController: CaptureController;

  constructor() {
    this.notificationController = new NotificationController();
    this.dropdownController = new DropdownController();
    this.captureController = new CaptureController();
    
    // CaptureControllerに自分の参照を渡す
    this.captureController.setUIController(this);
  }

  /**
   * 通知の表示（NotificationControllerに委譲）
   */
  public showNotification(type: NotificationType, title: string, message: string): void {
    this.notificationController.showNotification(type, title, message);
  }

  /**
   * キャプチャステータスの更新（CaptureControllerに委譲）
   */
  public updateCaptureStatus(isActive: boolean): void {
    this.captureController.updateCaptureStatus(isActive);
  }

  /**
   * スクリーンショットの更新（CaptureControllerに委譲）
   */
  public updateScreenshot(screenshotData: string): void {
    this.captureController.updateScreenshot(screenshotData);
  }

  /**
   * 提案の更新
   */
  public updateProposals(proposals: AnalysisData['proposals']): void {
    const container = document.getElementById('proposals-container');
    if (!container || !proposals) return;
    
    this.updateProposalCount(proposals.length);
    
    if (proposals.length === 0) {
      container.innerHTML = `
        <div class="placeholder-content">
          <div class="placeholder-icon">🤖</div>
          <p class="placeholder-text">AI提案を待機中</p>
          <p class="placeholder-subtitle">現在の画面に対する改善提案はありません</p>
        </div>
      `;
      return;
    }
    
    const proposalsHTML = proposals.map((proposal, index) => `
      <div class="proposal-item" data-index="${index}">
        <div class="proposal-header">
          <h3 class="proposal-title">${escapeHtml(proposal.title || 'AI提案')}</h3>
          <span class="proposal-priority ${getPriorityLevel(proposal.priority)}">${proposal.priority || '中'}</span>
        </div>
        <p class="proposal-description">${escapeHtml(proposal.description || '')}</p>
        ${proposal.reason ? `<p class="proposal-reason">理由: ${escapeHtml(proposal.reason)}</p>` : ''}
        <div class="proposal-actions">
          ${this.createDetailButton(index)}
          <button class="btn btn-primary btn-sm" onclick="appRenderer.adoptProposal(${index})">
            採用
          </button>
          <button class="btn btn-outline btn-sm" onclick="appRenderer.dismissProposal(${index})">
            却下
          </button>
        </div>
      </div>
    `).join('');
    
    container.innerHTML = proposalsHTML;
  }

  /**
   * 状態付き提案の更新
   */
  public updateProposalsWithStatus(proposals: ProposalWithStatus[]): void {
    const container = document.getElementById('proposals-container');
    if (!container) return;
    
    this.updateProposalCounts(proposals);
    
    if (proposals.length === 0) {
      container.innerHTML = `
        <div class="placeholder-content">
          <div class="placeholder-icon">🤖</div>
          <p class="placeholder-text">AI提案を待機中</p>
          <p class="placeholder-subtitle">現在の画面に対する改善提案はありません</p>
        </div>
      `;
      return;
    }
    
    const proposalsHTML = proposals.map((proposal, index) => {
      const statusClass = proposal.status === 'adopted' ? 'adopted' : 'pending';
      const statusLabel = proposal.status === 'adopted' ? '✅ 採用' : '';
      
      let buttonsHTML = '';
      if (proposal.status === 'adopted') {
        // 採用済み提案には詳細・完了ボタン
        buttonsHTML = `
          <div class="proposal-actions adopted-actions">
            ${this.createDetailButton(index)}
            <button class="btn btn-success btn-sm" onclick="appRenderer.completeIndividualProposal(${index})">
              完了
            </button>
          </div>
        `;
      } else {
        // 未処理提案には詳細・採用・却下ボタン
        buttonsHTML = `
          <div class="proposal-actions">
            ${this.createDetailButton(index)}
            <button class="btn btn-primary btn-sm" onclick="appRenderer.adoptProposal(${index})">
              採用
            </button>
            <button class="btn btn-outline btn-sm" onclick="appRenderer.dismissProposal(${index})">
              却下
            </button>
          </div>
        `;
      }
      
      return `
        <div class="proposal-item ${statusClass}" data-index="${index}">
          <div class="proposal-header">
            <h3 class="proposal-title">${escapeHtml(proposal.title || 'AI提案')}</h3>
            <div class="proposal-status-container">
              <span class="proposal-priority ${getPriorityLevel(proposal.priority)}">${proposal.priority || '中'}</span>
              ${statusLabel ? `<span class="proposal-status-label">${statusLabel}</span>` : ''}
            </div>
          </div>
          <p class="proposal-description">${escapeHtml(proposal.description || '')}</p>
          ${proposal.reason ? `<p class="proposal-reason">理由: ${escapeHtml(proposal.reason)}</p>` : ''}
          ${buttonsHTML}
        </div>
      `;
    }).join('');
    
    container.innerHTML = proposalsHTML;
    
    // 全提案クリア機能を常時表示
    this.addGlobalClearControls();
  }

  /**
   * 全提案クリア機能の表示
   */
  private addGlobalClearControls(): void {
    const container = document.getElementById('proposals-container');
    if (!container) return;
    
    // 既存のクリアコントロールがあれば削除
    const existingControls = document.getElementById('global-clear-controls');
    if (existingControls) {
      existingControls.remove();
    }
    
    // 提案がある場合のみ表示
    const hasProposals = container.querySelector('.proposal-item');
    if (!hasProposals) return;
    
    const clearControls = document.createElement('div');
    clearControls.id = 'global-clear-controls';
    clearControls.className = 'global-clear-controls';
    clearControls.innerHTML = `
      <div class="clear-controls-separator"></div>
      <div class="clear-controls-section">
        <h4 class="clear-controls-title">一括操作</h4>
        <div class="clear-controls-buttons">
          <button class="btn btn-outline btn-sm" onclick="appRenderer.clearPendingProposals()">
            採用以外削除
          </button>
          <button class="btn btn-outline-danger btn-sm" onclick="appRenderer.clearAllProposals()">
            全ての提案削除
          </button>
        </div>
      </div>
    `;
    
    container.appendChild(clearControls);
  }

  /**
   * 提案数の更新
   */
  public updateProposalCount(count: number): void {
    const countElement = document.getElementById('proposal-count');
    if (countElement) {
      countElement.textContent = count.toString();
    }
  }

  /**
   * 提案カウント表示の更新（詳細版）
   */
  public updateProposalCounts(proposals: ProposalWithStatus[]): void {
    const totalCount = proposals.length;
    const adoptedCount = proposals.filter(p => p.status === 'adopted').length;
    const pendingCount = proposals.filter(p => p.status === 'pending').length;
    
    // 総数
    const totalElement = document.getElementById('proposal-count');
    if (totalElement) {
      totalElement.textContent = totalCount.toString();
    }
    
    // 採用数
    const adoptedElement = document.getElementById('adopted-count');
    if (adoptedElement) {
      adoptedElement.textContent = adoptedCount.toString();
    }
    
    // 未決数
    const pendingElement = document.getElementById('pending-count');
    if (pendingElement) {
      pendingElement.textContent = pendingCount.toString();
    }
  }

  /**
   * 設定からUIを更新
   */
  public updateUIFromConfig(config: AppConfig): void {
    // 対象アプリの設定
    const targetAppInput = document.getElementById('target-app') as HTMLInputElement;
    if (targetAppInput && config.targetApp?.name) {
      targetAppInput.value = config.targetApp.name;
    }

    // アダプターの設定
    const adapterSelect = document.getElementById('adapter-select') as HTMLSelectElement;
    if (adapterSelect && config.targetApp?.defaultAdapter) {
      adapterSelect.value = config.targetApp.defaultAdapter;
    }
  }

  /**
   * ローディング状態の表示/非表示
   */
  public showLoading(show: boolean): void {
    const loadingElement = document.getElementById('loading-overlay');
    if (loadingElement) {
      loadingElement.style.display = show ? 'flex' : 'none';
    }
  }

  /**
   * ドロップダウンに選択肢を設定（DropdownControllerに委譲）
   */
  public populateSelectDropdown(options: SelectionOption[]): void {
    this.dropdownController.populateSelectDropdown(options);
  }

  /**
   * キャプチャ画像の表示（CaptureControllerに委譲）
   */
  public async displayCapturedImage(filePath?: string, mode: ImageDisplayMode = 'dual-view'): Promise<void> {
    await this.captureController.displayCapturedImage(filePath, mode);
  }



  /**
   * レイアウトを現在のウィンドウサイズに合わせて更新
   */
  public refreshLayout(): void {
    this.displayCapturedImage(undefined, 'dual-view');
  }

  /**
   * 自動キャプチャのみクリア（CaptureControllerに委譲）
   */
  public async clearAutomaticCapture(): Promise<void> {
    await this.captureController.clearAutomaticCapture();
  }

  /**
   * 手動キャプチャのみクリア（CaptureControllerに委譲）
   */
  public async clearManualCapture(): Promise<void> {
    await this.captureController.clearManualCapture();
  }

  /**
   * キャプチャ画像をクリア（CaptureControllerに委譲）
   */
  public clearCapturedImage(): void {
    this.captureController.clearCapturedImage();
  }

  /**
   * 詳細ボタンHTML生成
   */
  private createDetailButton(index: number): string {
    return `<button class="btn btn-info btn-sm" onclick="appRenderer.showProposalDetail(${index})">詳細</button>`;
  }

  /**
   * JSON詳細情報を汎用的に構築
   */
  private buildDetailSections(proposal: any): string {
    const excludedKeys = ['title', 'description', 'id', 'category', 'priority']; // メイン表示で使用済み
    let sections = '';
    
    // 各プロパティを動的に処理
    Object.keys(proposal).forEach(key => {
      if (excludedKeys.includes(key)) return;
      
      const value = proposal[key];
      if (!value) return;
      
      sections += this.buildGenericSection(key, value);
    });
    
    return sections;
  }

  /**
   * 汎用セクション構築
   */
  private buildGenericSection(key: string, value: any): string {
    const sectionTitle = this.formatSectionTitle(key);
    const content = this.formatSectionContent(value);
    
    if (!content) return '';
    
    return `
      <div class="detail-section">
        <h4 class="detail-section-title">${sectionTitle}</h4>
        ${content}
      </div>
    `;
  }

  /**
   * セクションタイトル整形
   */
  private formatSectionTitle(key: string): string {
    const titleMap: {[key: string]: string} = {
      implementation: '📋 実装手順',
      expected_benefit: '🎯 期待効果',
      additional_notes: '💡 追加情報',
      reason: '💭 理由'
    };
    
    return titleMap[key] || `📄 ${key.replace(/_/g, ' ').toUpperCase()}`;
  }

  /**
   * セクション内容整形
   */
  private formatSectionContent(value: any): string {
    if (Array.isArray(value)) {
      return `<ol class="implementation-steps">${value.map(item => `<li class="implementation-step">${escapeHtml(String(item))}</li>`).join('')}</ol>`;
    }
    
    if (typeof value === 'object' && value !== null) {
      return this.formatObjectContent(value);
    }
    
    return `<p class="proposal-description-full">${escapeHtml(String(value))}</p>`;
  }

  /**
   * オブジェクト内容整形
   */
  private formatObjectContent(obj: any): string {
    let content = '';
    
    Object.keys(obj).forEach(subKey => {
      const subValue = obj[subKey];
      if (!subValue) return;
      
      const subTitle = subKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      
      if (Array.isArray(subValue)) {
        content += `
          <div class="notes-subsection">
            <h5>${subTitle}</h5>
            <ul class="tips-list">${subValue.map(item => `<li>${escapeHtml(String(item))}</li>`).join('')}</ul>
          </div>
        `;
      } else {
        content += `
          <div class="notes-subsection">
            <h5>${subTitle}</h5>
            <p>${escapeHtml(String(subValue))}</p>
          </div>
        `;
      }
    });
    
    return content;
  }

  /**
   * 提案詳細モーダルの表示
   */
  public showProposalDetailModal(proposal: any): void {
    // 既存のモーダルがあれば削除
    const existingModal = document.querySelector('.proposal-detail-modal');
    if (existingModal) existingModal.remove();

    // モーダル要素を作成
    const modal = document.createElement('div');
    modal.className = 'proposal-detail-modal';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'proposal-detail-modal-content';
    
    // HTML構築（汎用版）
    modalContent.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title">${escapeHtml(proposal.title || 'AI提案の詳細')}</h3>
        <button class="modal-close" aria-label="詳細を閉じる">&times;</button>
      </div>
      <div class="modal-body">
        <div class="detail-section">
          <h4 class="detail-section-title">📝 概要</h4>
          <p class="proposal-description-full">${escapeHtml(proposal.description || '')}</p>
        </div>
        ${this.buildDetailSections(proposal)}
      </div>
    `;
    
    modal.appendChild(modalContent);
    
    // イベント設定と表示
    this.setupModalEvents(modal, modalContent);
    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('show'));
  }

  /**
   * モーダルイベント設定
   */
  private setupModalEvents(modal: HTMLElement, modalContent: HTMLElement): void {
    const closeModal = () => {
      modal.classList.remove('show');
      setTimeout(() => {
        modal.remove();
        document.removeEventListener('keydown', escKeyHandler);
      }, 300);
    };
    
    const escKeyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    
    const closeButton = modalContent.querySelector('.modal-close');
    if (closeButton) closeButton.addEventListener('click', closeModal);
    
    document.addEventListener('keydown', escKeyHandler);
  }

  /**
   * 画像モーダルの表示
   */
  public showImageModal(imageSrc: string, imageTitle: string): void {
    // 既存のモーダルがあれば削除
    const existingModal = document.querySelector('.image-modal');
    if (existingModal) {
      existingModal.remove();
    }

    // モーダル要素を作成
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    
    // モーダルコンテンツを作成
    const modalContent = document.createElement('div');
    modalContent.className = 'image-modal-content';
    
    // 画像要素を作成
    const img = document.createElement('img');
    img.className = 'image-modal-image';
    img.src = imageSrc;
    img.alt = imageTitle;
    
    // 情報パネルを作成
    const infoPanel = document.createElement('div');
    infoPanel.className = 'image-modal-info';
    
    const infoContent = document.createElement('div');
    infoContent.className = 'info-details';
    infoContent.textContent = `${imageTitle} - 画面クリックまたはESCキーで閉じる`;
    
    // 要素を組み立て
    infoPanel.appendChild(infoContent);
    
    modalContent.appendChild(img);
    modalContent.appendChild(infoPanel);
    
    modal.appendChild(modalContent);
    
    // モーダルの閉じる処理
    const closeModal = () => {
      modal.classList.remove('show');
      setTimeout(() => {
        if (modal.parentNode) {
          modal.remove();
        }
        // イベントリスナーを削除
        document.removeEventListener('keydown', escKeyHandler);
      }, 300); // CSSトランジション時間と合わせる
    };
    
    // ESCキーハンドラー
    const escKeyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    };
    
    // 背景クリックで閉じる（画像クリックでは閉じない）
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
    
    // 画像クリックで閉じる
    img.addEventListener('click', (e) => {
      e.stopPropagation();
      closeModal();
    });
    
    // ESCキーで閉じる
    document.addEventListener('keydown', escKeyHandler);
    
    // DOMに追加
    document.body.appendChild(modal);
    
    // アニメーション用にshowクラスを遅延追加
    requestAnimationFrame(() => {
      modal.classList.add('show');
    });
  }

}