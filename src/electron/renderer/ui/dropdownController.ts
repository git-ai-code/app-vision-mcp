/**
 * App Vision MCP - Dropdown Controller
 * ドロップダウン管理専用制御
 */

import type { SelectionOption } from '../types/index.js';

export class DropdownController {

  /**
   * ドロップダウンに選択肢を設定
   */
  public populateSelectDropdown(options: SelectionOption[]): void {
    const select = document.getElementById('target-app-select') as HTMLSelectElement;
    if (!select) {
      return;
    }

    
    // 既存の全てのオプションとoptgroupをクリア（最初のプレースホルダーを除く）
    const placeholder = select.options[0]; // プレースホルダーを保存
    select.innerHTML = ''; // 全てをクリア
    select.appendChild(placeholder); // プレースホルダーを復元

    // グループごとに整理
    const displays = options.filter(opt => opt.type === 'display');
    const applications = options.filter(opt => opt.type === 'application');
    
    
    // ディスプレイグループ（シンプルラベル）
    if (displays.length > 0) {
      const displayGroup = document.createElement('optgroup');
      displayGroup.label = 'ディスプレイ';
      
      displays.forEach(display => {
        const option = document.createElement('option');
        option.value = display.id;
        
        // 文字数制限とフル名称のtitle設定
        const truncatedName = this.truncateText(display.name, 30);
        option.textContent = truncatedName;
        option.title = display.name; // フル名称をtooltipに設定
        
        if (display.description) {
          option.title += ` - ${display.description}`;
        }
        displayGroup.appendChild(option);
      });
      
      select.appendChild(displayGroup);
    }
    
    // アプリケーショングループ（シンプルラベル）
    if (applications.length > 0) {
      const appGroup = document.createElement('optgroup');
      appGroup.label = 'アプリケーション';
      
      applications.forEach(app => {
        const option = document.createElement('option');
        option.value = app.id;
        
        // アプリケーション名の構築
        let displayName = app.name;
        
        // 文字数制限とフル名称のtitle設定
        const truncatedName = this.truncateText(displayName, 35);
        option.textContent = truncatedName;
        option.title = displayName; // フル名称をtooltipに設定
        
        if (app.description) {
          option.title += ` - ${app.description}`;
        }
        appGroup.appendChild(option);
      });
      
      select.appendChild(appGroup);
    }
    
  }

  /**
   * テキストを指定文字数で省略（末尾に...付加）
   */
  private truncateText(text: string, maxLength: number): string {
    if (!text || text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * ドロップダウンの選択値を取得
   */
  public getSelectedValue(): string | null {
    const select = document.getElementById('target-app-select') as HTMLSelectElement;
    if (!select) {
      return null;
    }
    return select.value || null;
  }

  /**
   * ドロップダウンの選択値を設定
   */
  public setSelectedValue(value: string): void {
    const select = document.getElementById('target-app-select') as HTMLSelectElement;
    if (select) {
      select.value = value;
    }
  }

  /**
   * ドロップダウンをクリア（プレースホルダーのみ残す）
   */
  public clearDropdown(): void {
    const select = document.getElementById('target-app-select') as HTMLSelectElement;
    if (!select) return;

    const placeholder = select.options[0]; // プレースホルダーを保存
    select.innerHTML = ''; // 全てをクリア
    if (placeholder) {
      select.appendChild(placeholder); // プレースホルダーを復元
    }
  }
}