// src/types/index.ts
import { TFile, View, Command } from 'obsidian';

export interface ExtendedCommand extends Command {
    id: string;
    name: string;
}

//不同类型AI响应接口
export type AIResponseType = 'tag' | 'metadata' | 'summary'| 'rewrite';
// 基础响应接口
export interface BaseAIResponse {
    type: AIResponseType;
}

// 标签响应
export interface TagAIResponse extends BaseAIResponse {
    type: 'tag';
    keywords: string[];
    summary: string;
    tags: string[];
}
export type MetadataFieldType = 'ai' | 'system' | 'custom' | 'string' | 'number' | 'string[]' | 'date';

export interface MetadataField {
    key: string;
    type:  MetadataFieldType;
    required: boolean;
    prompt?: string;     // AI 提示词
    description?: string; // AI 生成的描述，可选
    systemField?: 'created' | 'modified'; // system 类型特有的字段
}

// 元数据响应
export interface MetadataAIResponse {
    type: 'metadata';
    fields: Record<string, any>;
    category?: string;
    topics?: string[];
    summary?: string;
    keywords?: string[];
    [key: string]: any;  // 允许任意字符串索引
}

// 文件夹总结响应
export interface SummaryAIResponse extends BaseAIResponse {
    type: 'summary';
    themes: string[];
    summary: string;
    structure: string;
    tags: string[];
}

// 添加改写响应接口
export interface RewriteAIResponse extends BaseAIResponse {
    type: 'rewrite';
    content: string;           // 改写后的内容
    changes?: string[];        // 改动说明
    suggestions?: string[];    // 改进建议
}

export type AIResponse = TagAIResponse | MetadataAIResponse | SummaryAIResponse | RewriteAIResponse;


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

//笔记总结接口
export interface SummarySettings {
    
    summaryTemplate: string;
    includeBacklinks: boolean;
    knowledgeGraphView: boolean;
    promptTemplate: string;  // 添加提示词模板设置
}
// 添加改写设置接口
// 基础改写配置接口
export interface BaseRewriteConfig {
    template: string;           // 改写提示词模板
    createBackup?: boolean;     // 是否创建备份
    keepStructure?: boolean;    // 是否保持原有结构
    fullDocument?: boolean;     // 是否改写整个文档
}

// 改写设置接口（用于插件设置）
export interface RewriteSettings extends BaseRewriteConfig {
    styles: RewriteStyle[];     // 预设的改写风格列表
    defaultStyleId?: string;    // 默认风格ID
    customStyles?: boolean;     // 是否允许自定义风格
    styleCategories?: string[]; // 风格分类
}

// 改写选项接口（用于执行改写操作）
export interface RewriteOptions extends BaseRewriteConfig {
    style?: string;            // 选择的改写风格ID
    category?: string;         // 风格分类
    preserveFormatting?: boolean; // 是否保留原文格式
    customTemplate?: string;   // 自定义模板内容
    tags?: string[];          // 风格标签
}

//改写风格接口
export interface RewriteStyle {
    id: string;
    name: string;
    description?: string;
    template: string;
    defaultTemplate?: boolean;  // 添加默认模板标识
    order?: number;            // 添加排序字段
    tags?: string[];          // 添加标签分类
}

// 元数据配置接口
export type MetadataConfig = MetadataField;

// 元数据处理设置
export interface MetadataProcessingSettings {
    configs: MetadataField[];        // 使用统一的 MetadataField 类型
    skipExisting: boolean;
    batchProcessing: {
        enabled: boolean;
        maxConcurrent: number;
        delayBetweenFiles: number;
    };
    dateFormat: string;
    includeTimestamp: boolean;
}

// 可选：添加系统元数据类型

export interface SystemMetadata {
    created: string;
    modified: string;
    createdTimestamp?: number;
    modifiedTimestamp?: number;
    [key: string]: any; // 添加字符串索引签名
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
    summary: SummarySettings; // 笔记总结设置
    metadata: MetadataProcessingSettings; // 元数据处理设置
    commandResponseTypes: {
        [commandId: string]: AIResponseType;
    };
    rewrite: RewriteSettings;  // 添加改写设置
}

// 提示词模板定义
export interface PromptTemplate {
    id: string;           // 模板唯一标识
    name: string;         // 模板名称
    content: string;      // 模板内容
    description?: string; // 模板描述（可选）
    type: 'tag' | 'metadata' | 'summary'|'rewrite'; // 添加 type 属性并定义其可能的值
}



// AI服务接口
export interface AIService {
    processText(
        text: string,
        templateContent?: string,
        modelOverride?: string,
        responseType?: AIResponseType,
        metadataFields?: MetadataField[]
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
