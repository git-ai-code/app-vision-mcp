/**
 * App Vision MCP - State Manager
 * アプリケーション状態管理
 */

import type { AppConfig, SelectionOption } from '../types/index.js';

export class StateManager {
  // キャプチャ状態
  private isCapturing: boolean = false;
  
  // 設定
  private currentConfig: AppConfig | null = null;
  
  // 提案数
  private proposalCount: number = 0;
  
  // 選択オプション
  private availableOptions: SelectionOption[] = [];
  private currentSelection: SelectionOption | null = null;
  
  // 前回の選択（キャプチャ失敗時の復元用）
  private previousSelection: SelectionOption | null = null;

  /**
   * キャプチャ状態の取得
   */
  public getIsCapturing(): boolean {
    return this.isCapturing;
  }

  /**
   * キャプチャ状態の設定
   */
  public setIsCapturing(value: boolean): void {
    this.isCapturing = value;
  }

  /**
   * 現在の設定を取得
   */
  public getCurrentConfig(): AppConfig | null {
    return this.currentConfig;
  }

  /**
   * 設定を更新
   */
  public setCurrentConfig(config: AppConfig | null): void {
    this.currentConfig = config;
  }

  /**
   * 提案数の取得
   */
  public getProposalCount(): number {
    return this.proposalCount;
  }

  /**
   * 提案数の設定
   */
  public setProposalCount(count: number): void {
    this.proposalCount = count;
  }

  /**
   * 利用可能なオプションの取得
   */
  public getAvailableOptions(): SelectionOption[] {
    return this.availableOptions;
  }

  /**
   * 利用可能なオプションの設定
   */
  public setAvailableOptions(options: SelectionOption[]): void {
    this.availableOptions = options;
  }

  /**
   * 現在の選択を取得
   */
  public getCurrentSelection(): SelectionOption | null {
    return this.currentSelection;
  }

  /**
   * 現在の選択を設定
   */
  public setCurrentSelection(selection: SelectionOption | null): void {
    this.currentSelection = selection;
  }

  /**
   * 前回の選択を取得
   */
  public getPreviousSelection(): SelectionOption | null {
    return this.previousSelection;
  }

  /**
   * 前回の選択を設定
   */
  public setPreviousSelection(selection: SelectionOption | null): void {
    this.previousSelection = selection;
  }

  /**
   * 選択を保存（前回の選択として）
   */
  public saveSelectionAsPrevious(): void {
    this.previousSelection = this.currentSelection;
  }

  /**
   * 選択を復元（前回の選択から）
   */
  public restorePreviousSelection(): void {
    if (this.previousSelection) {
      this.currentSelection = this.previousSelection;
      this.previousSelection = null;
    }
  }

  /**
   * 対象アプリ名の取得（現在の選択から）
   */
  public getTargetAppName(): string | null {
    if (this.currentSelection) {
      if (this.currentSelection.type === 'display') {
        return this.currentSelection.name;
      } else if (this.currentSelection.type === 'application') {
        return this.currentSelection.name;
      }
    }
    return null;
  }

  /**
   * アダプタータイプの取得（現在の選択から）
   */
  public getAdapterType(): string | null {
    return this.currentSelection?.adapterType || null;
  }

  /**
   * 選択オプションをIDで検索
   */
  public findOptionById(id: string): SelectionOption | undefined {
    return this.availableOptions.find(option => option.id === id);
  }

  /**
   * 選択オプションを名前で検索
   */
  public findOptionByName(name: string): SelectionOption | undefined {
    return this.availableOptions.find(option => option.name === name);
  }

  /**
   * 状態のリセット
   */
  public reset(): void {
    this.isCapturing = false;
    this.currentConfig = null;
    this.proposalCount = 0;
    this.availableOptions = [];
    this.currentSelection = null;
    this.previousSelection = null;
  }
}