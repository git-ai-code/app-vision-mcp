/*
 * App Vision MCP - 共通日時フォーマットユーティリティ
 * MCPサーバーとElectronアプリで共有される日時形式の統一化
 * 用途別に最適化された4つの日時フォーマット関数を提供
 */

/**
 * ファイル名用コンパクト日時形式
 * @param date 変換する日付（省略時は現在日時）
 * @returns 20251225_153045 形式の文字列
 * @example
 * formatCompactDateTime(new Date('2025-12-25T15:30:45'))
 * // Returns: "20251225_153045"
 */
export function formatCompactDateTime(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

/**
 * ミリ秒付きコンパクト日時形式（キャプチャファイル名・ID生成用統一関数）
 * @param date 変換する日付（省略時は現在日時）
 * @returns 20251225_153045_456 形式の文字列
 * @example
 * formatCompactDateTimeMillisec(new Date('2025-12-25T15:30:45.456'))
 * // Returns: "20251225_153045_456"
 */
export function formatCompactDateTimeMillisec(date: Date = new Date()): string {
  const compactDateTime = formatCompactDateTime(date);
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
  return `${compactDateTime}_${milliseconds}`;
}

/**
 * データ表示用の日時形式（アンダーバー区切り）
 * @param date 変換する日付（省略時は現在日時）
 * @returns 2025-12-25_15:30:45 形式の文字列
 * @example
 * formatDataDateTime(new Date('2025-12-25T15:30:45'))
 * // Returns: "2025-12-25_15:30:45"
 */
export function formatDataDateTime(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day}_${hours}:${minutes}:${seconds}`;
}

/**
 * ログ表示用の日時形式（スペース区切り）
 * @param date 変換する日付（省略時は現在日時）
 * @returns 2025-12-25 15:30:45 形式の文字列
 * @example
 * formatLogDateTime(new Date('2025-12-25T15:30:45'))
 * // Returns: "2025-12-25 15:30:45"
 */
export function formatLogDateTime(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}