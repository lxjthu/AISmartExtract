// src/settings/settings.ts
import { PluginSettings,PromptTemplate,SummarySettings,AIResponseType} from '../types';

// 首先定义默认的提示词模板
// settings.ts
const DEFAULT_TEMPLATES: PromptTemplate[] = [
    {
        id: 'default-tag',
        name: '默认标签提取',
        type: 'tag',
        description: '提取文本的关键词、总结和标签',
        content: `请分析以下文本，提供：
1. 3-5个关键词
2. 一句话总结（15字以内，不要加句号）
3. 将关键词转换为3-5个相关标签（每个标签以#开头）

请按照以下格式返回：
关键词：关键词1，关键词2，关键词3
总结：一句话总结
标签：#标签1 #标签2 #标签3

原文：
{text}`
    },
    
    {
        id: 'default-summary',
        name: '默认文件夹总结',
        type: 'summary', 
        description: '生成文件夹内容的综合总结',
        content: `请分析以下{count}篇笔记的内容并生成总结：

{notes}

请分析上述内容,并按照以下严格格式返回(注意:冒号后需要空格,逗号使用中文逗号):

关键词：主题1，主题2，主题3
总结：请在此处提供200字以内的主要观点总结
标签：#领域1 #领域2 #领域3`
    },
    {
        id: 'default-rewrite',
        name: '默认改写模板',
        type: 'rewrite',
        description: '改写文本内容，优化表达和结构',
        content: `请帮我改写以下文本，使其表达更清晰、结构更合理。

要求：
1. 保持原文的核心意思不变
2. 优化语言表达，使其更流畅
3. 调整段落结构，使逻辑更清晰
4. 添加必要的过渡语句
5. 保持专业性和准确性

请按照以下格式返回：
1. 改写后的内容
2. 主要改动说明（列出3-5点）
3. 改进建议（如有）

原文：
{text}`
    }
];

// 首先定义默认的改写风格
const DEFAULT_REWRITE_STYLES = [
    {
        id: 'academic',
        name: '学术风格',
        description: '使用更专业的学术表达',
        template: `请将以下文本改写为学术风格。

要求：
1. 使用更专业的学术用语
2. 增加引用和论证
3. 保持客观严谨的语气
4. 突出理论依据和研究价值

请按照以下格式返回：
1. 改写后的内容
2. 主要改动说明（列出3-5点）
3. 改进建议（如有）

原文：
{text}`
    },
    {
        id: 'concise',
        name: '简洁风格',
        description: '精简表达，突出重点',
        template: `请将以下文本改写得更简洁。

要求：
1. 删除冗余内容
2. 使用简短清晰的句子
3. 保留核心信息
4. 突出关键观点

请按照以下格式返回：
1. 改写后的内容
2. 主要改动说明（列出3-5点）
3. 改进建议（如有）

原文：
{text}`
    },
    {
        id: 'detailed',
        name: '详细风格',
        description: '添加更多细节和解释',
        template: `请将以下文本改写得更详细。

要求：
1. 添加更多背景信息
2. 扩展重要概念的解释
3. 增加具体的例子
4. 深入分析因果关系

请按照以下格式返回：
1. 改写后的内容
2. 主要改动说明（列出3-5点）
3. 改进建议（如有）

原文：
{text}`
    }
];



export const DEFAULT_SETTINGS: PluginSettings = {
    // API 相关设置
    apiKey: '',
    apiEndpoint: 'https://api.openai.com/v1/chat/completions',
    aiProvider: 'openai', // 新增：默认 AI 提供商
    model: 'gpt-3.5-turbo', // 新增：默认模型
    
    // 笔记相关设置
    targetFolder: 'Extractcards',
    addBacklinks: true,
    backlinkStyle: 'wiki',
    addBacklinksSection: true,
    splitDirection: 0,  
    openInNewTab: true,
    pdfNoteTemplate: '', // 添加 PDF 笔记模板的默认值
    includePdfMetadata: true, // 添加是否包含 PDF 元数据的默认值
    // 引用样式设置
    quoteCallout: 'cite',
    quoteCollapsible: true,
    pdfQuoteStyle: 'callout',
    pdfPageLink: true,
    pdfMetadataInFrontmatter: true,
    pdfMetadataInContent: true,
    pdfSourceSection: '源文件信息',
    pdfTimestampFormat: 'YYYY-MM-DD HH:mm:ss',
    // 批量处理默认设置
    batchProcessing: {
        maxConcurrent: 3,           // 默认同时处理3个文件
        delayBetweenFiles: 1000,    // 默认间隔1秒
        skipExistingTags: true      // 默认跳过已有标签的文件
    },
    // 新的提示词模板系统
    promptTemplates: DEFAULT_TEMPLATES,
    defaultTemplateId: 'default-tag',
    // 命令与模板ID的映射
    commandTemplateMap: {
        'create-smart-note-from-markdown': 'default-tag',
        'create-smart-note-from-pdf': 'default-tag',
        'batch-process-folder': 'default-tag',
        'generate-folder-summary': 'default-summary',
    },

    // 保留现有的promptTemplate和defaultPrompt以保持向后兼容
    promptTemplate: DEFAULT_TEMPLATES[0].content,
    defaultPrompt: DEFAULT_TEMPLATES[0].content,

    metadata: {
        configs: [
            {
                key: 'category',
                description: '根据文本内容判断笔记的主要类别',
                type: 'ai',
                required: true,
                prompt: '请分析文本内容，提取一个最合适的类别标签。返回格式：类别名称'
            },
            {
                key: 'topics',
                description: '提取文本中讨论的主要主题',
                type: 'ai',
                required: true,
                prompt: '请从文本中提取3-5个主要讨论的主题。返回格式：["主题1", "主题2", "主题3"]'
            },
            {
                key: 'summary',
                description: '生成文本的简短总结',
                type: 'ai',
                required: true,
                prompt: '请用20字以内对文本内容进行总结。返回格式：一句话总结'
            },
            {
                key: 'created',
                description: '文件创建时间',
                type: 'system',
                required: true,
                systemField: 'created'
            },
            {
                key: 'modified',
                description: '文件最后修改时间',
                type: 'system',
                required: true,
                systemField: 'modified'
            },
        ],
        skipExisting: true,
        batchProcessing: {
            enabled: true,
            maxConcurrent: 3,
            delayBetweenFiles: 1000
        },
       
        dateFormat: 'YYYY-MM-DD HH:mm:ss',  // 添加日期格式设置
        includeTimestamp: true,  // 是否同时包含时间戳
    },
    commandResponseTypes: {
        'create-smart-note-from-markdown': 'tag',
        'create-smart-note-from-pdf': 'tag',
        'batch-process-folder': 'tag',
        'generate-folder-summary': 'summary',
    },
    rewrite: {
        template: DEFAULT_TEMPLATES.find(t => t.id === 'default-rewrite')?.content || '',
        createBackup: true,
        keepStructure: true,
        fullDocument: false,
        styles: DEFAULT_REWRITE_STYLES  // 使用预定义的风格列表
    },




    // 扩展 providerSettings
    providerSettings: {
        openai: {
            endpoint: 'https://api.openai.com/v1/chat/completions',
            availableModels: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo-preview'],
            streamingSupport: true
        },
        'azure-openai': {
            endpoint: 'https://{resource-name}.openai.azure.com/openai/deployments/{deployment-name}/chat/completions',
            apiVersion: '2024-02-15-preview',
            availableModels: ['gpt-35-turbo', 'gpt-4', 'gpt-4-turbo'],
            streamingSupport: true
        },
        qianwen: {
            endpoint: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
            availableModels: ['qwen-turbo', 'qwen-plus', 'qwen-max', 'qwen-max-longcontext'],
            streamingSupport: true
        },
        deepseek: {
            endpoint: 'https://api.deepseek.com/v1/chat/completions',
            availableModels: ['deepseek-chat', 'deepseek-coder'],
            streamingSupport: true
        },
        anthropic: {
            endpoint: 'https://api.anthropic.com/v1/messages',
            availableModels: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-2.1'],
            streamingSupport: true,
            customHeaders: {
                'anthropic-version': '2024-01-01'
            }
        },
        gemini: {
            endpoint: 'https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent',
            availableModels: ['gemini-pro'],
            streamingSupport: true
        },
        mistral: {
            endpoint: 'https://api.mistral.ai/v1/chat/completions',
            availableModels: ['mistral-tiny', 'mistral-small', 'mistral-medium'],
            streamingSupport: true
        },
        baidu: {
            endpoint: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/',
            availableModels: ['ERNIE-Bot-4', 'ERNIE-Bot', 'ERNIE-Bot-turbo'],
            streamingSupport: true
        },
        xunfei: {
            endpoint: 'wss://spark-api.xf-yun.com/v3.5/chat',
            availableModels: ['spark-v3.5', 'spark-v2.0'],
            streamingSupport: true
        },
        zhipu: {
            endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
            availableModels: ['glm-4', 'glm-4v', 'glm-3-turbo'],
            streamingSupport: true
        },
        minimax: {
            endpoint: 'https://api.minimax.chat/v1/text/chatcompletion',
            availableModels: ['abab5.5-chat', 'abab5-chat'],
            streamingSupport: true
        },
        moonshot: {
            endpoint: 'https://api.moonshot.cn/v1/chat/completions',
            availableModels: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
            streamingSupport: true
        }
    },

    summary: {
        // 移除 summaryFolder 设置
        summaryTemplate: `# {folderName} 笔记总结
    
    ## 核心主题
    {themes}
    
    ## 主要观点
    {summary}
    
    ## 知识结构
    {structure}
    
    ## 包含笔记
{noteList}`,
        includeBacklinks: true,
        knowledgeGraphView: true,
        // 使用 DEFAULT_TEMPLATES 中的 summary 模板
        promptTemplate: DEFAULT_TEMPLATES.find(t => t.id === 'default-summary')?.content || `请分析以下{count}篇笔记的内容并生成总结：
    
    {notes}
    
    请提供：
    1. 3-5个核心主题和关键概念
    2. 笔记之间的关联性分析
    3. 主要观点总结（200字以内）
    4. 建议的知识结构
    
    请按照以下格式返回：
    关键词：主题1，主题2，主题3
    总结：主要观点总结
    标签：#领域1 #领域2 #领域3`
    }
}