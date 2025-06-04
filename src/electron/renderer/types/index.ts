/**
 * App Vision MCP - Type Definitions
 * レンダラープロセスの型定義
 */

// グローバル型宣言（レンダラー環境用）
declare global {
  interface Window {
    appVisionAPI: AppVisionAPI;
    electronAPI?: {
      ipcRenderer: {
        on: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
        off: (channel: string, listener: (...args: any[]) => void) => void;
        send: (channel: string, ...args: any[]) => void;
      };
    };
  }
}

// 共通型定義
export type PriorityLevel = 'low' | 'medium' | 'high';

// 型定義の強化
export interface ScreenshotData {
  filePath: string;
  timestamp: number;
  size?: { width: number; height: number };
  metadata?: Record<string, unknown>;
}

export interface AppInfo {
  name: string;
  pid: number;
  windowTitle?: string;
}

export interface AppConfig {
  targetApp?: {
    name: string;
    patterns: string[];
    defaultAdapter: string;
  };
  adapters?: Record<string, unknown>;
  ui?: {
    theme: 'light' | 'dark';
    layout: string;
  };
}

export interface SystemInfo {
  platform: string;
  version: string;
  memory: {
    total: number;
    used: number;
  };
}

// 提案の状態を管理する型
export type ProposalStatus = 'pending' | 'adopted' | 'dismissed';

export interface ProposalWithStatus {
  title: string;
  description: string;
  priority: PriorityLevel;
  reason?: string;
  status: ProposalStatus;
  adoptedAt?: number; // 採用された時刻のタイムスタンプ
}

export interface AnalysisData {
  timestamp: number;
  results: Record<string, unknown>;
  screenshot?: string;
  proposals?: Array<{
    title: string;
    description: string;
    priority: PriorityLevel;
    reason?: string;
  }>;
  suggestions?: Array<{
    title: string;
    description: string;
    priority: PriorityLevel;
    reason?: string;
  }>;
}

export interface InitializationData {
  version: string;
  status: 'ready' | 'error';
  message?: string;
}

export interface SelectionOption {
  id: string;
  type: 'special' | 'display' | 'application';
  name: string;
  description?: string;
  adapterType?: string;
  icon?: string;
  metadata?: Record<string, unknown>;
}

export interface AdapterInfo {
  id: string;
  name: string;
  description?: string;
  version?: string;
  enabled: boolean;
  configPath?: string;
  metadata?: Record<string, unknown>;
}

export interface AdapterDropdownOption {
  value: string;
  text: string;
  description?: string;
}

export interface AppVisionAPI {
  // キャプチャ関連（現行API）
  screenCapture(targetApp?: string): Promise<{ success: boolean; filePath?: string; error?: string }>;
  getLatestScreenshot(): Promise<{ success: boolean; data?: ScreenshotData; error?: string }>;
  getAvailableApps(): Promise<{ success: boolean; apps?: AppInfo[]; error?: string }>;
  getFileStats(): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }>;
  
  // キャプチャ中の対象変更
  changeTarget(targetApp: string): Promise<{ success: boolean; captureActive: boolean; newTarget: string; error?: string }>;
  
  // アプリ選択関連
  getSelectionOptions(): Promise<{ success: boolean; options?: SelectionOption[]; error?: string }>;
  saveLastSelection(selection: SelectionOption): Promise<{ success: boolean; error?: string }>;
  getLastSelection(): Promise<{ success: boolean; selection?: SelectionOption; error?: string }>;
  getAvailableDisplays(): Promise<{ success: boolean; displays?: Array<{ id: string; name: string; bounds: Record<string, number> }>; error?: string }>;
  
  // アダプター関連
  getAvailableAdapters(): Promise<{ success: boolean; adapters?: AdapterInfo[]; error?: string }>;
  getAdapterDropdownOptions(): Promise<{ success: boolean; options?: AdapterDropdownOption[]; error?: string }>;
  getAdapterInfo(adapterId: string): Promise<{ success: boolean; adapter?: AdapterInfo; error?: string }>;
  
  // コアキャプチャAPI
  startCapture(): Promise<{ success: boolean; mode?: string; error?: string }>;
  stopCapture(): Promise<{ success: boolean; error?: string }>;
  getCaptureStatus(): Promise<{ success: boolean; status?: Record<string, unknown> }>;
  setTargetApp(appName: string, patterns: string[]): Promise<{ success: boolean; error?: string }>;
  manualCapture(targetApp?: string | null): Promise<{ success: boolean; result?: any; error?: string }>;

  // 手動キャプチャフラグ管理
  hasManualCaptureFlag(): Promise<{ success: boolean; hasFlag?: boolean; error?: string }>;
  createManualCaptureFlag(): Promise<{ success: boolean; error?: string }>;
  clearManualCaptureFlag(): Promise<{ success: boolean; error?: string }>;

  // 設定関連
  getConfig(): Promise<{ success: boolean; config?: AppConfig; error?: string }>;
  updateConfig(updates: Partial<AppConfig>): Promise<{ success: boolean; config?: AppConfig; error?: string }>;
  setAdapter(adapterId: string): Promise<{ success: boolean; error?: string }>;
  setTheme(theme: 'light' | 'dark'): Promise<{ success: boolean; error?: string }>;

  // システム関連
  getMemoryUsage(): Promise<{ success: boolean; memoryMB?: number }>;
  getAppInfo(): Promise<{ success: boolean; info?: SystemInfo; error?: string }>;
  getLogPath(): Promise<{ success: boolean; logPath?: string }>;
  resetConfig(): Promise<{ success: boolean; config?: AppConfig; error?: string }>;

  // 設定情報関連（新機能）
  getSharedDataPath(): Promise<{ success: boolean; path?: string; error?: string }>;
  openSharedDataFolder(): Promise<{ success: boolean; error?: string }>;

  // イベントリスナー
  onAnalysisUpdate(callback: (data: AnalysisData) => void): void;
  onConfigUpdate(callback: (config: AppConfig) => void): void;
  onAppInitialized(callback: (data: InitializationData) => void): void;
  onAutoCaptureCompleted(callback: (data: any) => void): void;
  onAutoCaptureError(callback: (data: any) => void): void;
  removeAllListeners(): void;

  // ダイアログ関連
  showError(title: string, message: string): Promise<{ success: boolean }>;
  showConfirm(title: string, message: string): Promise<{ success: boolean; confirmed?: boolean }>;
  selectFile(title: string, filters?: any[]): Promise<{ success: boolean; filePath?: string }>;
}

// 通知タイプ
export type NotificationType = 'success' | 'info' | 'warning' | 'error';

// 画像表示モード
export type ImageDisplayMode = 'auto-only' | 'manual-only' | 'dual-view';

// レイアウト設定
export interface LayoutConfig {
  mode: 'side-by-side' | 'top-bottom' | 'single-focus';
  autoPosition: 'left' | 'right' | 'top' | 'bottom';
  manualPosition: 'left' | 'right' | 'top' | 'bottom';
  containerClass: string;
}

// アスペクト比情報
export interface AspectRatioInfo {
  ratio: number;
  orientation: 'landscape' | 'portrait';
}