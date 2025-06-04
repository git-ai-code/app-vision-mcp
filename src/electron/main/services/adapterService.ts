import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../../utils/logger';

export interface AdapterInfo {
  id: string;
  name: string;
  description?: string;
  version?: string;
  enabled: boolean;
  configPath?: string;
  metadata?: Record<string, any>;
}

export class AdapterService {
  private logger: Logger;
  private adaptersPath: string;
  private adapters: Map<string, AdapterInfo> = new Map();

  constructor() {
    this.logger = new Logger('info');
    // プロジェクトルートのadaptersフォルダを指定
    this.adaptersPath = path.join(process.cwd(), 'adapters');
  }

  /**
   * adaptersフォルダをスキャンして利用可能なアダプターを取得
   */
  async getAvailableAdapters(): Promise<AdapterInfo[]> {
    try {
      // adaptersフォルダの存在確認
      if (!fs.existsSync(this.adaptersPath)) {
        this.logger.warn(`Adapters folder not found: ${this.adaptersPath}`);
        return [];
      }

      // フォルダ内容を読み取り
      const entries = fs.readdirSync(this.adaptersPath, { withFileTypes: true });
      const adapters: AdapterInfo[] = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const adapterInfo = await this.loadAdapterInfo(entry.name);
          if (adapterInfo) {
            adapters.push(adapterInfo);
            this.adapters.set(adapterInfo.id, adapterInfo);
          }
        }
      }

      return adapters;

    } catch (error) {
      this.logger.error('Failed to scan adapters folder:', error);
      return [];
    }
  }

  /**
   * 個別アダプターの情報を読み込み
   */
  private async loadAdapterInfo(adapterFolderName: string): Promise<AdapterInfo | null> {
    try {
      const adapterPath = path.join(this.adaptersPath, adapterFolderName);
      const configPath = path.join(adapterPath, 'adapter.json');

      // adapter.jsonの存在確認
      if (!fs.existsSync(configPath)) {
        this.logger.warn(`No adapter.json found in ${adapterFolderName}`);
        // adapter.jsonがない場合はフォルダ名から基本情報を生成
        return {
          id: adapterFolderName,
          name: this.formatAdapterName(adapterFolderName),
          description: `カスタムアダプター: ${adapterFolderName}`,
          enabled: true
        };
      }

      // adapter.jsonを読み込み
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configContent);

      return {
        id: config.id || adapterFolderName,
        name: config.name || this.formatAdapterName(adapterFolderName),
        description: config.description,
        version: config.version,
        enabled: config.enabled !== false,
        configPath: configPath,
        metadata: config.metadata
      };

    } catch (error) {
      this.logger.error(`Failed to load adapter info for ${adapterFolderName}:`, error);
      return null;
    }
  }

  /**
   * フォルダ名からユーザーフレンドリーな名前を生成
   */
  private formatAdapterName(folderName: string): string {
    return folderName
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * 特定のアダプターの情報を取得
   */
  getAdapterInfo(adapterId: string): AdapterInfo | undefined {
    return this.adapters.get(adapterId);
  }

  /**
   * UIドロップダウン用のオプションリストを生成
   */
  async getAdapterDropdownOptions(): Promise<Array<{value: string, text: string, description?: string}>> {
    const adapters = await this.getAvailableAdapters();
    
    if (adapters.length === 0) {
      return [{
        value: 'none',
        text: 'なし',
        description: '利用可能なアダプターがありません'
      }];
    }

    return adapters
      .filter(adapter => adapter.enabled)
      .map(adapter => ({
        value: adapter.id,
        text: adapter.name,
        description: adapter.description
      }));
  }
}