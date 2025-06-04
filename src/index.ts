#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema,
  InitializeRequestSchema,
  PingRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { formatCompactDateTime, formatCompactDateTimeMillisec, formatDataDateTime } from './utils/dateFormatter.js';
import { readFileSync } from 'fs';

// ========================================
// CONSTANTS & TYPES
// ========================================

// package.jsonからバージョン情報を取得
const getPackageVersion = (): string => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    // ビルド後のパス構造に対応: dist/index.js → package.json
    const possiblePaths = [
      path.join(__dirname, '..', 'package.json'),           // dist/package.json
      path.join(__dirname, '..', '..', 'package.json'),     // プロジェクトルート/package.json
      path.join(__dirname, 'package.json'),                 // dist/package.json (コピー済み)
    ];
    
    for (const packageJsonPath of possiblePaths) {
      try {
        if (fsSync.existsSync(packageJsonPath)) {
          const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
          return packageJson.version || '0.0.1';
        }
      } catch (pathError) {
        continue; // 次のパスを試行
      }
    }
    
    throw new Error('package.json not found in any expected location');
  } catch (error) {
    console.error('Warning: Could not read package.json version, using fallback:', error instanceof Error ? error.message : 'Unknown error');
    return '0.0.1';
  }
};

// 定数の先行取得（型安全性確保）
const SERVER_VERSION = getPackageVersion();

const CONFIG = {
  TIMEOUTS: {
    HEARTBEAT: 30000, // 30秒
    CAPTURE: 15000, // 15秒
    POLLING_INTERVAL: 500 // 0.5秒
  },
  SERVER: {
    VERSION: SERVER_VERSION,
    PROTOCOL_VERSION: '2024-11-05'
  }
} as const;

interface ImageData {
  base64: string;
  mimeType: string;
}

interface CaptureMetadata {
  timestamp: string;
  type: string;
  sourceName: string;
  appName: string;
  size: number;
  format: string;
}

interface CaptureResult {
  requestId: string;
  metadata: CaptureMetadata;
  screenshotPath: string;
  success: boolean;
}

// ========================================
// IMAGE ANALYZER
// ========================================
/**
 * 画像ファイル読み込みクラス
 */
class ImageAnalyzer {
  async loadImage(filePath: string): Promise<ImageData> {
    this.validateFilePath(filePath);
    
    try {
      const imageBuffer = await fs.readFile(filePath);
      const base64Data = imageBuffer.toString('base64');
      
      return {
        base64: base64Data,
        mimeType: 'image/png'
      };
    } catch (error) {
      throw new Error(`画像読み込みエラー: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private validateFilePath(filePath: string): void {
    const normalizedPath = path.normalize(filePath);
    if (normalizedPath.includes('..')) {
      throw new Error('無効なファイルパスです');
    }
  }
}

// ========================================
// MCP SERVER
// ========================================
/**
 * App Vision MCP Server
 * 画面キャプチャとAI分析機能を提供するMCPサーバー
 */
class AppVisionMCPServer {
  private server: Server;
  private imageAnalyzer: ImageAnalyzer;

  constructor() {
    this.server = new Server(
      {
        name: 'app-vision-mcp',
        version: CONFIG.SERVER.VERSION,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.imageAnalyzer = new ImageAnalyzer();
    this.setupHandlers();
  }

  // === CORE HANDLERS ===
  private setupHandlers(): void {
    this.server.setRequestHandler(InitializeRequestSchema, async () => ({
      protocolVersion: CONFIG.SERVER.PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: 'app-vision-mcp', version: CONFIG.SERVER.VERSION },
    }));

    this.server.setRequestHandler(PingRequestSchema, async () => ({}));

    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'capture_screen',
          description: 'Captures the current screen content automatically via Electron app integration, providing high-quality screenshots with metadata for AI analysis and workflow automation. Note: Do not execute this command when user explicitly requests manual analysis (e.g., "please analyze manually", "manual analysis please") - use analyze_manual instead.',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'analyze_auto',
          description: 'Analyzes the most recent automatically captured screenshot using AI Vision, providing detailed insights about screen content, UI elements, and application state for development workflows',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'analyze_manual',
          description: 'Analyzes the most recent manually captured screenshot using AI Vision, optimized for user-triggered captures with contextual understanding of specific application workflows and content creation tasks',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'ai_template_get',
          description: 'Retrieves the YAML template format for AI suggestion data structure, enabling AI to understand how to process suggestion context data effectively',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'ai_template_reset',
          description: 'Clears the AI template cache and resets to default template format, useful for debugging or when switching between different adapter contexts',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'ai_suggest',
          description: 'Outputs AI-generated suggestions to file system for app-side integration, enabling real-time suggestion display and workflow automation',
          inputSchema: {
            type: 'object',
            properties: {
              content: {
                type: 'string',
                description: 'AI-generated suggestion content in JSON format'
              }
            },
            required: ['content']
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        switch (name) {
          case 'capture_screen':
            return await this.captureScreen();
          case 'analyze_auto':
            return await this.analyzeImage('automatic');
          case 'analyze_manual':
            return await this.analyzeImage('manual');
          case 'ai_template_get':
            return await this.getAiTemplate();
          case 'ai_template_reset':
            return await this.resetAiTemplate();
          case 'ai_suggest':
            if (!args || typeof args.content !== 'string') {
              throw new Error('ai_suggest requires content parameter as string');
            }
            return await this.outputAiSuggestion(args.content);
          default:
            throw new Error(`未知のツール: ${name}`);
        }
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `❌ **エラーが発生しました**\n\n${error instanceof Error ? error.message : String(error)}`
          }]
        };
      }
    });
  }

  // === UTILITY METHODS ===
  private getSharedDataPath(): string {
    if (process.env.APP_VISION_SHARED_DATA) {
      return process.env.APP_VISION_SHARED_DATA;
    }
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    return path.join(__dirname, '..', 'shared-data');
  }

  private async checkAppHeartbeat(sharedDataDir: string): Promise<boolean> {
    try {
      const heartbeatFile = path.join(sharedDataDir, 'heartbeat', 'app-status.json');

      if (!fsSync.existsSync(heartbeatFile)) {
        return false;
      }

      const data = await fs.readFile(heartbeatFile, 'utf8');
      const heartbeatData = JSON.parse(data);
      
      // 型安全性の強化
      if (!heartbeatData || typeof heartbeatData.timestamp !== 'string') {
        return false;
      }

      const now = Date.now();
      // タイムスタンプ形式を標準形式に変換（YYYY-MM-DD_HH:MM:SS → YYYY-MM-DDTHH:MM:SS）
      const normalizedTimestamp = heartbeatData.timestamp.replace('_', 'T');
      const heartbeatTime = new Date(normalizedTimestamp).getTime();
      
      // NaN チェックを追加
      if (isNaN(heartbeatTime)) {
        return false;
      }
      
      const timeDiff = now - heartbeatTime;
      const withinTimeout = timeDiff < CONFIG.TIMEOUTS.HEARTBEAT;
      return withinTimeout;
    } catch (error) {
      return false;
    }
  }

  // === CAPTURE METHODS ===
  private async captureScreen(): Promise<any> {
    const analysisType = 'basic';
    const saveToHistory = true;
    
    const sharedDataDir = this.getSharedDataPath();
    const automaticDir = path.join(sharedDataDir, 'automatic');
    const flagsDir = path.join(sharedDataDir, 'flags');
    const currentDir = path.join(automaticDir, 'current');

    await fs.mkdir(flagsDir, { recursive: true });
    await fs.mkdir(currentDir, { recursive: true });

    const isAppAlive = await this.checkAppHeartbeat(sharedDataDir);
    if (!isAppAlive) {
      throw new Error('アプリケーションが起動していません。Visual Assistant アプリを起動してから再試行してください。');
    }

    const processingLockPath = path.join(flagsDir, 'processing.lock');
    if (fsSync.existsSync(processingLockPath)) {
      throw new Error('画面キャプチャが既に処理中です。しばらくお待ちください。');
    }

    const requestId = Date.now().toString();
    const captureRequestFlagPath = path.join(flagsDir, 'capture-request.flag');
    const requestData = JSON.stringify({
      requestId,
      analysisType,
      saveToHistory,
      timestamp: formatDataDateTime()
    });
    
    await fs.writeFile(captureRequestFlagPath, requestData);
    
    const writtenContent = await fs.readFile(captureRequestFlagPath, 'utf8');
    if (!writtenContent.trim()) {
      throw new Error('フラグファイルの書き込みに失敗しました');
    }

    return await this.waitForCapture(currentDir, requestId);
  }

  private async waitForCapture(currentDir: string, requestId: string): Promise<any> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < CONFIG.TIMEOUTS.CAPTURE) {
      const metadataFilePath = path.join(currentDir, 'metadata.json');
      const screenshotFilePath = path.join(currentDir, 'screenshot.png');
      
      if (fsSync.existsSync(metadataFilePath) && fsSync.existsSync(screenshotFilePath)) {
        const metadata = JSON.parse(await fs.readFile(metadataFilePath, 'utf8'));
        
        return {
          content: [{
            type: 'text',
            text: this.formatCaptureResult({
              requestId,
              metadata,
              screenshotPath: screenshotFilePath,
              success: true
            })
          }]
        };
      }
      
      await new Promise(resolve => setTimeout(resolve, CONFIG.TIMEOUTS.POLLING_INTERVAL));
    }

    throw new Error('キャプチャ処理がタイムアウトしました。アプリケーションの状態を確認してください。');
  }

  // === ANALYSIS METHODS ===
  private async analyzeImage(captureType: 'automatic' | 'manual'): Promise<any> {
    const analysisType = 'basic';
    const appType = 'generic';
    
    const sharedDataDir = this.getSharedDataPath();
    const currentDir = path.join(sharedDataDir, captureType, 'current');
    const screenshotFilePath = path.join(currentDir, 'screenshot.png');
    
    if (!fsSync.existsSync(screenshotFilePath)) {
      const captureTypeText = captureType === 'automatic' ? '自動' : '手動';
      const actionText = captureType === 'automatic' ? 'capture_screen を実行' : 'アプリで手動キャプチャを実行';
      throw new Error(`${captureTypeText}キャプチャ画像が見つかりません。先に ${actionText}してください。`);
    }

    try {
      const imageData = await this.imageAnalyzer.loadImage(screenshotFilePath);
      const captureTypeText = captureType === 'automatic' ? '自動' : '手動';
      
      return {
        content: [
          {
            type: 'text',
            text: `🔍 **${captureTypeText}キャプチャ画像解析**

**解析設定:**
- 解析レベル: ${analysisType}
- アプリタイプ: ${appType}
- 画像ファイル: ${screenshotFilePath}

**画像情報:**
- 形式: ${imageData.mimeType}
- サイズ: ${Math.round(imageData.base64.length * 3 / 4 / 1024)}KB

AI Vision で画像解析を実行します：

**🚀 AI提案生成の次ステップ:**
⚠️ **注意**: AI提案は**ユーザーが明示的に要求した場合のみ**実施してください
1. \`ai_template_get\` でAI提案用テンプレートを取得
2. \`ai_suggest\` で高品質なAI提案を生成
3. アプリ側で提案の表示・採用・却下が可能`
          },
          {
            type: 'image',
            data: imageData.base64,
            mimeType: imageData.mimeType
          }
        ]
      };
    } catch (error) {
      throw new Error(`画像解析に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private formatCaptureResult(result: CaptureResult): string {
    const { requestId, metadata, screenshotPath } = result;
    
    return `✅ **画面キャプチャ完了**

**基本情報:**
- Request ID: ${requestId}
- ファイル: ${screenshotPath}
- サイズ: ${Math.round((metadata.size || 0) / 1024)}KB
- ソース: ${metadata.sourceName || 'Unknown'}
- アプリ: ${metadata.appName || 'Unknown'}

AI Vision で詳細分析を行うには、analyze_auto コマンドを使用してください。`;
  }

  // === AI METHODS ===
  private async getAiTemplate(): Promise<any> {
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const projectRoot = path.resolve(__dirname, '..');
      const templatePath = path.join(projectRoot, 'templates', 'ai-suggestion-template.yaml');
      
      if (!fsSync.existsSync(templatePath)) {
        throw new Error(`テンプレートファイルが見つかりません: ${templatePath}\n現在のディレクトリ: ${__dirname}\nプロジェクトルート: ${projectRoot}`);
      }
      
      const template = await fs.readFile(templatePath, 'utf8');

      return {
        content: [{
          type: 'text',
          text: `📋 **AI提案データテンプレート**

**テンプレート情報:**
- バージョン: 1.0
- 形式: YAML
- 用途: AI提案生成用コンテキストデータ
- ソース: ${templatePath}

**テンプレート内容:**

\`\`\`yaml
${template}
\`\`\`

このテンプレートに従って ai_suggest コマンドが実データを提供します。`
        }]
      };
    } catch (error) {
      throw new Error(`テンプレートファイルの読み込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async resetAiTemplate(): Promise<any> {
    const sharedDataDir = this.getSharedDataPath();
    const suggestionsDir = path.join(sharedDataDir, 'suggestions');
    const flagsDir = path.join(sharedDataDir, 'flags');
    
    try {
      // suggestions と flags ディレクトリの作成（存在しない場合）
      await fs.mkdir(suggestionsDir, { recursive: true });
      await fs.mkdir(flagsDir, { recursive: true });
      
      const filesToClear = [
        path.join(suggestionsDir, 'ai_suggestions.json'),
        path.join(suggestionsDir, 'template_cache.yaml'),
        path.join(flagsDir, 'suggestion_flag.json')
      ];
      
      let clearedFiles = 0;
      for (const filePath of filesToClear) {
        if (fsSync.existsSync(filePath)) {
          await fs.unlink(filePath);
          clearedFiles++;
        }
      }
      
      const suggestionFlagPath = path.join(flagsDir, 'suggestion_flag.json');
      const resetFlag = {
        suggestion_ready: false,
        last_update: formatDataDateTime(),
        suggestion_id: null,
        display_status: "hidden",
        auto_clear: true,
        template_reset: true,
        reset_timestamp: formatDataDateTime()
      };
      
      await fs.writeFile(suggestionFlagPath, JSON.stringify(resetFlag, null, 2));

      return {
        content: [{
          type: 'text',
          text: `🔄 **AI提案システムリセット完了**

**実行内容:**
- ${clearedFiles}個のファイルをクリア
- 提案フラグを初期状態にリセット
- システム状態を完全に初期化

**クリア対象:**
- ai_suggestions.json（提案データ）
- template_cache.yaml（テンプレートキャッシュ）
- suggestion_flag.json（提案フラグ）

**リセット後の状態:**
- 提案システムが完全に初期化されました
- 次回使用時にクリーンな状態から開始
- テンプレートも最新版を再取得

システムの初期化やデバッグ時にご利用ください。`
        }]
      };
    } catch (error) {
      throw new Error(`AI提案システムのリセットに失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async outputAiSuggestion(content: string): Promise<any> {
    if (!content || typeof content !== 'string') {
      throw new Error('AI提案コンテンツが指定されていません。JSON形式の提案内容を渡してください。');
    }

    const sharedDataDir = this.getSharedDataPath();
    const suggestionsDir = path.join(sharedDataDir, 'suggestions');
    const flagsDir = path.join(sharedDataDir, 'flags');
    
    try {
      // ディレクトリの作成（存在しない場合）
      await fs.mkdir(suggestionsDir, { recursive: true });
      await fs.mkdir(flagsDir, { recursive: true });
      
      // AI提案コンテンツの検証とパース
      let suggestionData;
      try {
        suggestionData = JSON.parse(content);
      } catch (parseError) {
        throw new Error(`提案コンテンツのJSONパースに失敗しました: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }
      
      // タイムスタンプ付加
      const now = new Date();
      const compactDateTime = formatCompactDateTime(now);
      const suggestionWithMeta = {
        ...suggestionData,
        metadata: {
          ...suggestionData.metadata,
          timestamp: compactDateTime,
          suggestion_id: `suggestion_${formatCompactDateTimeMillisec(now)}`,
          format_version: "1.0"
        }
      };
      
      // 提案ファイル出力
      const suggestionFilePath = path.join(suggestionsDir, 'ai_suggestions.json');
      await fs.writeFile(suggestionFilePath, JSON.stringify(suggestionWithMeta, null, 2), 'utf8');
      
      // フラグファイル更新
      const suggestionFlagPath = path.join(flagsDir, 'suggestion_flag.json');
      const flagData = {
        suggestion_ready: true,
        last_update: compactDateTime,
        suggestion_id: suggestionWithMeta.metadata.suggestion_id,
        display_status: "ready",
        auto_clear: true,
        file_path: suggestionFilePath
      };
      
      await fs.writeFile(suggestionFlagPath, JSON.stringify(flagData, null, 2), 'utf8');

      return {
        content: [{
          type: 'text',
          text: `✅ **AI提案ファイル出力完了**

**出力結果:**
- 提案ファイル: ${suggestionFilePath}
- フラグファイル: ${suggestionFlagPath}
- 提案ID: ${suggestionWithMeta.metadata.suggestion_id}
- 生成時刻: ${compactDateTime}

**アプリ側連携:**
- ファイル監視による自動検出待機中
- UI表示準備完了
- 提案内容がアプリに表示されます

AI主導の提案システムが正常に動作しました。`
        }]
      };
    } catch (error) {
      throw new Error(`AI提案ファイル出力に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

// ========================================
// MAIN STARTUP
// ========================================
async function main(): Promise<void> {
  try {
    const dataDir = process.env.APP_VISION_SHARED_DATA;
    const message = dataDir ? `Data directory: ${dataDir}` : 'Using default data directory';
    console.error(`🚀 Starting App Vision MCP Server... (${message})`);
    
    const server = new AppVisionMCPServer();
    await server.start();
    
    console.error('✅ App Vision MCP Server started successfully');
  } catch (error) {
    console.error('❌ Failed to start App Vision MCP Server:', error);
    process.exit(1);
  }
}

const gracefulShutdown = (signal: string) => {
  console.error(`📥 Received ${signal}, shutting down gracefully...`);
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
main();