// src/types/index.ts
import { TFile, View, Command } from 'obsidian';

export interface ExtendedCommand extends Command {
    id: string;
    name: string;
}


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


// 批量处理设置接口
export interface BatchProcessingSettings {
    maxConcurrent: number;          // 最大并发数
    delayBetweenFiles: number;      // 文件处理间隔（毫秒）
    skipExistingTags: boolean;      // 是否跳过已有标签的文件
}

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
    batchProcessing: BatchProcessingSettings;  // 批量处理设置
    // 提示词模板相关
    promptTemplates: PromptTemplate[];      // 所有可用的提示词模板
    defaultTemplateId: string;              // 默认使用的模板ID
    commandTemplateMap: {                   // 命令与模板的映射
        [commandId: string]: string;        // key是命令ID，value是模板ID
    };
}

// 提示词模板定义
export interface PromptTemplate {
    id: string;           // 模板唯一标识
    name: string;         // 模板名称
    content: string;      // 模板内容
    description?: string; // 模板描述（可选）
}

// AI响应接口
export interface AIResponse {
    keywords: string[];
    summary: string;
    tags: string[];
}

// AI服务接口
export interface AIService {
    processText(
        text: string,
        templateContent?: string,
        modelOverride?: string
    ): Promise<AIResponse>;
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
