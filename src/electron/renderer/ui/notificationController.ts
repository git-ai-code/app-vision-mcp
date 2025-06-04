/**
 * App Vision MCP - Notification Controller
 * 通知システム専用制御
 */

import type { NotificationType } from '../types/index.js';
import { escapeHtml } from '../utils/helpers.js';

export class NotificationController {
  private static notificationContainer: HTMLElement | null = null;
  private static notificationCount = 0;

  /**
   * 通知コンテナを取得または作成
   */
  private getNotificationContainer(): HTMLElement {
    if (!NotificationController.notificationContainer) {
      NotificationController.notificationContainer = document.createElement('div');
      NotificationController.notificationContainer.className = 'notification-container';
      document.body.appendChild(NotificationController.notificationContainer);
    }
    return NotificationController.notificationContainer;
  }

  /**
   * 通知の表示（縦並び対応）
   */
  public showNotification(type: NotificationType, title: string, message: string): void {
    const container = this.getNotificationContainer();
    
    // ユニークIDを生成
    const notificationId = `notification-${Date.now()}-${++NotificationController.notificationCount}`;
    
    // 新しい通知を作成
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.id = notificationId;
    notification.innerHTML = `
      <div class="notification-header">
        <h4 class="notification-title">${escapeHtml(title)}</h4>
        <button class="notification-close">&times;</button>
      </div>
      <div class="notification-content">${escapeHtml(message)}</div>
    `;

    // 閉じるボタンのイベント
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn?.addEventListener('click', () => {
      this.removeNotification(notification);
    });

    // 自動削除
    setTimeout(() => {
      if (notification.parentNode) {
        this.removeNotification(notification);
      }
    }, 5000);

    // 通知を表示（コンテナに追加）
    container.appendChild(notification);
    
    // アニメーション開始
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
  }

  /**
   * 通知を削除し、残りの通知位置を調整
   */
  private removeNotification(notification: HTMLElement): void {
    notification.classList.add('hide');
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 300);
  }

  /**
   * 全ての通知をクリア
   */
  public clearAllNotifications(): void {
    if (NotificationController.notificationContainer) {
      NotificationController.notificationContainer.innerHTML = '';
    }
  }

  /**
   * 通知数を取得
   */
  public getNotificationCount(): number {
    return NotificationController.notificationCount;
  }
}