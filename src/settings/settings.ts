// src/settings/settings.ts
import { PluginSettings } from '../types';

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

    // 提示词模板
    promptTemplate: `请分析以下文本，提供：
1. 3-5个关键词
2. 一句话总结（15字以内，不要加句号）
3. 将关键词转换为3-5个相关标签（每个标签以#开头）

请按照以下格式返回：
关键词：关键词1，关键词2，关键词3
总结：一句话总结
标签：#标签1 #标签2 #标签3

原文：
{text}`,
    defaultPrompt: `请分析以下文本，提供：
1. 3-5个关键词
2. 一句话总结（15字以内，不要加句号）
3. 将关键词转换为3-5个相关标签（每个标签以#开头）

请按照以下格式返回：
关键词：关键词1，关键词2，关键词3
总结：一句话总结
标签：#标签1 #标签2 #标签3

原文：
{text}`,

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
    }
};