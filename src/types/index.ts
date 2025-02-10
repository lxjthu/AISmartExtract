// src/types/index.ts
import { TFile, View } from 'obsidian';

// 扩展 AI 提供商类型
export type AIProvider = 
    | 'openai' 
    | 'qianwen' 
    | 'deepseek'
    | 'anthropic' // Claude
    | 'gemini'    // Google
    | 'mistral'   // Mistral AI
    | 'baidu'     // 文心一言
    | 'xunfei'    // 讯飞星火
    | 'zhipu'     // 智谱 ChatGLM
    | 'minimax'   // MiniMax
    | 'moonshot'  // Moonshot AI
    | 'azure-openai'; // Azure OpenAI Service

// 每个提供商的具体设置接口
export interface ProviderSettings {
    endpoint: string;
    availableModels: string[];
    apiVersion?: string;    // 部分服务需要指定 API 版本
    requiresOrganization?: boolean; // 是否需要组织 ID
    customHeaders?: Record<string, string>; // 自定义请求头
    maxTokens?: number;     // 最大 token 限制
    streamingSupport?: boolean; // 是否支持流式响应
}

// 所有提供商设置的映射
export type ProvidersConfig = Record<AIProvider, ProviderSettings>;

// 插件设置接口
export interface PluginSettings {
    apiKey: string;
    apiEndpoint: string;
    addBacklinks: boolean;
    backlinkStyle: 'wiki' | 'ref';
    aiProvider: AIProvider; 
    model: string;
    addBacklinksSection: boolean;
    promptTemplate: string;
    defaultPrompt: string;
    targetFolder: string;
    quoteCallout: string;
    quoteCollapsible: boolean;
    pdfQuoteStyle: 'callout' | 'codeblock';
    pdfPageLink: boolean;
    providerSettings: ProvidersConfig;
    openInNewTab: boolean;           // 是否在新标签页打开
    splitDirection: number;  // 0 为垂直分割，1 为水平分割
    pdfNoteTemplate: string;  // PDF笔记模板
    includePdfMetadata: boolean;  // 是否包含PDF元数据
    pdfMetadataInFrontmatter: boolean;  // 是否在 front matter 中包含 PDF 元数据
    pdfMetadataInContent: boolean;      // 是否在正文中包含 PDF 元数据
    pdfSourceSection: string;           // PDF 源信息部分的标题
    pdfTimestampFormat: string;         // 时间戳格式
}

// AI响应接口
export interface AIResponse {
    keywords: string[];
    summary: string;
    tags: string[];
}

// PDF选择接口

export interface PdfSelection {
    text: string;
    fileName: string;
    pageNumber: number;
    relativePosition: {
        top: number;
        left: number;
        width: number;
        height: number;
    };
    pdfViewerState: {
        currentScale: number;
        currentPageNumber: number;
        pagesCount: number;
    };
    timestamp: string;
}


// PDF视图接口
export interface EmbeddedPDFView extends View {
    file: TFile;
    containerEl: HTMLElement;
    selectionHandler?: (event: Event) => void;
    viewer: {
        pdfViewer: {
            currentScale: number;
            currentPageNumber: number;
            pagesCount: number;
            getSelectedText(): string;
        };
    };
}
