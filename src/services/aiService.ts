// src/services/aiService.ts
import { requestUrl } from 'obsidian';
import { 
    PluginSettings, 
    AIResponse, 
    AIProvider, 
    AIService,
    ProviderSettings, 
    AIResponseType,
    TagAIResponse,
    MetadataAIResponse,
    MetadataField,
    SummaryAIResponse,
    RewriteAIResponse
} from '../types';

export class AIServiceImpl implements AIService  {

    // 在这里添加调试开关，类的成员变量区域
    private readonly DEBUG = true;
    
    // 添加日志方法
    private log(message: string, ...args: any[]) {
        if (this.DEBUG) {
            console.log(`[AIService] ${message}`, ...args);
        }
    }
    constructor(private settings: PluginSettings) {}

    /**
     * 处理文本并获取AI分析结果
     * @param text 要处理的文本
     * @param templateContent 可选的模板内容
     * @param modelOverride 可选的模型覆盖
     */
    async processText(
        text: string, 
        templateContent?: string,
        modelOverride?: string,
        responseType: AIResponseType = 'tag', // 添加响应类型参数
        metadataFields?: MetadataField[]  // 添加元数据字段配置参数
    ): Promise<AIResponse> {
        if (!this.settings.apiKey) {
            throw new Error('请先在设置中配置API Key');
        }

        // 获取当前提供商的设置
        const providerConfig = this.settings.providerSettings[this.settings.aiProvider];
        if (!providerConfig) {
            throw new Error(`未找到 ${this.settings.aiProvider} 的配置`);
        }

        // 过滤出 AI 类型的字段
        const aiFields = metadataFields?.filter(field => field.type === 'ai');

        // 使用提供的模板内容或设置中的默认提示词
        const prompt = this.buildPrompt(
            text,
            templateContent,
            responseType,
            aiFields
        );

        // 验证模型是否可用
        const modelToUse = modelOverride || this.settings.model;
        if (!providerConfig.availableModels.includes(modelToUse)) {
            throw new Error(`模型 ${modelToUse} 不可用于 ${this.settings.aiProvider}`);
        }

        try {
            const headers: Record<string, string> = {
                'Authorization': `Bearer ${this.settings.apiKey}`,
                'Content-Type': 'application/json',
                ...(providerConfig.customHeaders || {})
            };

            const requestBody = this.buildRequestBody(
                this.settings.aiProvider,
                modelToUse,
                prompt,
                providerConfig
            );

            const response = await requestUrl({
                url: providerConfig.endpoint,
                method: 'POST',
                headers,
                body: JSON.stringify(requestBody)
            });

            return this.parseAIResponse(response.json,responseType, metadataFields);
        } catch (error) {
            console.error('AI处理错误:', error);
            throw new Error('AI处理失败: ' + (error.message || '未知错误'));
        }
        
    }

    //处理不同类型的模板选择
    private getTemplateForResponseType(responseType: AIResponseType): string {
        // 从配置中获取对应类型的模板 ID
        const templateId = this.settings.commandTemplateMap[responseType];
        
        // 查找对应的模板
        const template = this.settings.promptTemplates.find(t => t.id === templateId);
        
        if (!template) {
            console.warn(`未找到类型 ${responseType} 的模板，使用默认模板`);
            // 找不到对应模板时使用默认模板
            const defaultTemplate = this.settings.promptTemplates.find(
                t => t.id === this.settings.defaultTemplateId
            );
            return defaultTemplate?.content || '';
        }
        
        return template.content;
    }
    

    /**
     * 根据不同的AI提供商构建请求体
     */
    private buildRequestBody(
        provider: AIProvider,
        model: string,
        prompt: string,
        config: ProviderSettings
    ): any {
        switch (provider) {
            case 'qianwen':
                return {
                    model,
                    input: {
                        messages: [
                            {
                                role: 'user',
                                content: prompt
                            }
                        ]
                    },
                    parameters: {
                        temperature: 0.7,
                        top_p: 0.8,
                        result_format: 'text'
                    }
                };
            case 'openai':
            case 'azure-openai':
                return {
                    model,
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: config.maxTokens || 2048
                };
            // 添加其他提供商的处理...
            default:
                throw new Error(`不支持的AI提供商: ${provider}`);
        }
    }

    /**
     * 解析AI响应
     */
    private parseAIResponse(aiResponse: any, responseType: AIResponseType, metadataFields?: MetadataField[]): AIResponse {
        let text = this.extractResponseText(aiResponse);
        // 在这里添加日志，在进行任何解析之前
        this.log('AI Response:', text);
        
        switch (responseType) {
            case 'tag':
                return this.parseTagResponse(text);
            case 'metadata':
                return this.parseMetadataResponse(text);
            case 'summary':
                return this.parseSummaryResponse(text);
                case 'rewrite':  // 添加改写类型处理
                return this.parseRewriteResponse(text);
            default:
                throw new Error(`不支持的响应类型: ${responseType}`);
        }
    }

    // 添加改写响应解析方法
        private parseRewriteResponse(text: string): RewriteAIResponse {
            try {
                // 检查是否收到了有效的响应
                if (!text || typeof text !== 'string') {
                    throw new Error('无效的AI响应');
                }

                // 提取改写内容
                const content = text.trim();

                // 验证内容
                if (!content) {
                    throw new Error('改写内容为空');
                }

                return {
                    type: 'rewrite',
                    content: content
                };
            } catch (error) {
                console.error('解析改写响应失败:', error, '\n原始响应:', text);
                throw new Error('改写响应格式不正确');
            }
        }

    private extractResponseText(aiResponse: any): string {
        if (aiResponse.output?.text) {
            return aiResponse.output.text;
        } else if (aiResponse.choices?.[0]?.message?.content) {
            return aiResponse.choices[0].message.content;
        }
        throw new Error('AI返回格式不正确');
    }

    private parseTagResponse(text: string): TagAIResponse {
        const keywordsMatch = text.match(/关键词：(.*)/);
        const summaryMatch = text.match(/总结：(.*)/);
        const tagsMatch = text.match(/标签：(.*?)(?=\n|$)/);

        if (!keywordsMatch || !summaryMatch || !tagsMatch) {
            throw new Error('标签响应格式不正确');
        }

        return {
            type: 'tag',
            keywords: keywordsMatch[1].split('，').map(k => k.trim()),
            summary: summaryMatch[1].trim().replace(/。$/, ''),
            tags: this.processTags(tagsMatch[1])
        };
    }

    

    private parseSummaryResponse(response: string): SummaryAIResponse {
        try {
            // 检查是否收到了有效的响应
            if (!response || typeof response !== 'string') {
                throw new Error('无效的AI响应');
            }
    
            const lines = response.split('\n').map(line => line.trim());
            
            // 提取关键词/主题
            const themesLine = lines.find(line => line.startsWith('关键词：'));
            if (!themesLine) {
                throw new Error('未找到关键词部分');
            }
            const themes = themesLine
                .replace('关键词：', '')
                .split('，')
                .map(theme => theme.trim())
                .filter(theme => theme.length > 0);
    
            // 提取总结
            const summaryLine = lines.find(line => line.startsWith('总结：'));
            if (!summaryLine) {
                throw new Error('未找到总结部分');
            }
            const summary = summaryLine.replace('总结：', '').trim();
    
            // 提取标签
            const tagsLine = lines.find(line => line.startsWith('标签：'));
            if (!tagsLine) {
                throw new Error('未找到标签部分');
            }
            const tags = tagsLine
                .replace('标签：', '')
                .split(' ')
                .map(tag => tag.trim())
                .filter(tag => tag.startsWith('#'))
                .map(tag => tag.substring(1));
    
            // 验证所有必要字段
            if (!themes.length || !summary || !tags.length) {
                throw new Error('响应缺少必要字段');
            }
    
            // 返回完整的 SummaryAIResponse，包括空的 structure 字段
            return {
                type: 'summary',
                themes,
                summary,
                tags,
                structure: '' // 添加空的 structure 字段
            };
        } catch (error) {
            console.error('解析AI响应失败:', error, '\n原始响应:', response);
            throw new Error('总结响应格式不正确');
        }
    }
    


    private processTags(tagString: string): string[] {
        return tagString.trim()
            .split(/[\s,，]+/)
            .map(tag => tag.trim())
            .filter(tag => tag)
            .map(tag => tag.startsWith('#') ? tag.substring(1) : tag);
    }

    private parseJsonArray(jsonStr: string): string[] {
        try {
            return JSON.parse(jsonStr);
        } catch {
            return jsonStr
                .replace(/[\[\]"]/g, '')
                .split(',')
                .map(item => item.trim())
                .filter(item => item);
        }
    }

    // 在 AIService 中
private buildPrompt(
    text: string,
    templateContent?: string,
    responseType?: AIResponseType,
    metadataFields?: MetadataField[]
): string {
    // 如果直接传入了模板内容，优先使用传入的模板
    if (templateContent) {
       // 添加对所有占位符的处理
       return templateContent
       .replace('{text}', text)
       .replace('{notes}', text)  // 使用同样的内容替换 notes
       .replace('{count}', '1');  // 如果是单篇笔记就是 1
    }

    // 以下是原有的逻辑，作为后备方案
    if (responseType === 'metadata' && metadataFields?.length) {
        return this.buildMetadataPrompt(text, metadataFields);
    }

    if (!responseType) {
        const defaultTemplate = this.settings.promptTemplates.find(
            t => t.id === this.settings.defaultTemplateId
        );
        return (defaultTemplate?.content || '').replace('{text}', text);
    }

    return this.getTemplateForResponseType(responseType).replace('{text}', text);
}


    private buildMetadataPrompt(text: string, metadataFields: MetadataField[]): string {
        // 基础上下文说明
        const context = `请分析以下文本内容，并按要求提取或生成元数据信息。
    
    文本内容：
    ${text}
    
    请按照以下要求提供元数据，仅返回 YAML 格式的结果：`;
    
        // 构建字段说明和要求
        const fieldInstructions = metadataFields
            .filter(field => field.type === 'ai') // 只处理 AI 类型的字段
            .map(field => {
                let instruction = `${field.key}:`;
                
                // 添加字段提示词
                if (field.prompt) {
                    instruction += `\n# ${field.prompt}`;
                }
                
                // 添加字段描述（如果有）
                if (field.description) {
                    instruction += `\n# 说明：${field.description}`;
                }
                
                return instruction;
            })
            .join('\n\n');
    
        // 构建完整提示词
        const prompt = `${context}
    
    ---
    ${fieldInstructions}
    ---
    
    注意事项：
    1. 只返回 YAML 格式的元数据
    2. 确保所有字段都有值
    3. 对于文本类型字段，提供简洁明确的内容
    4. 对于数组类型字段（如标签），使用 YAML 数组格式：[item1, item2, item3]
    5. 对于日期类型字段，使用 YYYY-MM-DD 格式
    6. 生成的内容应该客观、准确、符合专业标准
    
    请开始生成：`;
    
        return prompt;
    }
    
    private parseMetadataResponse(text: string, metadataFields?: MetadataField[]): MetadataAIResponse {
        this.log('开始解析元数据响应:', text);
        
        // 清理和预处理文本
        const cleanedText = this.cleanYAMLText(text);
        this.log('清理后的文本:', cleanedText);
        
        const result = this.parseYAMLContent(cleanedText);
        this.log('解析后的结果:', result);
        
        return {
            type: 'metadata',
            fields: result
        };
    }
    
    private cleanYAMLText(text: string): string {
        // 移除 YAML 文档开始和结束标记之外的内容
        const yamlRegex = /---\n([\s\S]*?)\n---/;
        const match = text.match(yamlRegex);
        return match ? match[1].trim() : text.trim();
    }
    
    private parseYAMLContent(text: string): Record<string, any> {
        const result: Record<string, any> = {};
        const lines = text.split('\n');
        
        for (const line of lines) {
            // 跳过空行和注释
            if (!line.trim() || line.trim().startsWith('#')) {
                continue;
            }
            
            // 使用冒号分割键值对
            const colonIndex = line.indexOf(':');
            if (colonIndex === -1) continue;
            
            const key = line.slice(0, colonIndex).trim();
            let value = line.slice(colonIndex + 1).trim();
            
            // 处理数组格式
            if (value.startsWith('[') && value.endsWith(']')) {
                try {
                    // 尝试解析 JSON 数组
                    const arrayContent = value
                        .slice(1, -1)  // 移除方括号
                        .split(',')    // 分割项
                        .map(item => {
                            // 清理每个项的引号和空格
                            return item.trim().replace(/^["']|["']$/g, '');
                        })
                        .filter(Boolean); // 移除空项
                    
                    result[key] = arrayContent;
                } catch (e) {
                    // 如果解析失败，保留原始值
                    result[key] = value;
                }
            } else {
                // 处理普通值，移除可能的引号
                result[key] = value.replace(/^["']|["']$/g, '');
            }
        }
        
        return result;
    }
    
    
    private tryMultipleParsingMethods(text: string): any {
        this.log('开始多方法解析，原始文本:', text);
        const result: any = {};
    
        // 如果文本不包含分隔符，可能是单个值
        if (!text.includes(':') && !text.includes('：') && !text.includes('=')) {
            this.log('检测到单值文本，作为默认字段处理');
            result.content = text.trim();
            return result;
        }
    
        // 按行解析 key: value 格式
        const lines = text.split('\n').filter(line => line.trim());
        this.log('分行处理:', lines);
    
        for (const line of lines) {
            // 支持多种分隔符模式
            const patterns = [
                /^[\s-]*([^:：]+)[：:][\s]*(.+)$/,  // 处理中文冒号和英文冒号
                /^[\s-]*([^=]+)=[\s]*(.+)$/,        // 处理等号分隔
                /^[\s-]*([^：:=]+)[\s]+(.*?)$/      // 处理空格分隔
            ];
    
            let matched = false;
            for (const pattern of patterns) {
                const match = line.match(pattern);
                if (match) {
                    const [, key, value] = match;
                    const cleanKey = key.trim().toLowerCase();
                    result[cleanKey] = this.parseValue(value.trim());
                    matched = true;
                    this.log(`解析到键值对: ${cleanKey} = ${result[cleanKey]}`);
                    break;
                }
            }
    
            // 如果没有匹配任何模式，将整行作为内容保存
            if (!matched && line.trim()) {
                result.content = line.trim();
                this.log('未匹配到键值对，保存为content:', result.content);
            }
        }
    
        this.log('解析结果:', result);
        return result;
    }
    
    private extractFieldValue(result: Record<string, any>, fieldName: string): any {
        this.log(`尝试提取字段 ${fieldName}`);
        
        const possibleKeys = [
            fieldName,
            fieldName.toLowerCase(),
            fieldName.toUpperCase(),
            fieldName.charAt(0).toUpperCase() + fieldName.slice(1)
        ];
    
        for (const key of possibleKeys) {
            if (result[key] !== undefined) {
                this.log(`找到字段 ${fieldName} 的值:`, result[key]);
                return result[key];
            }
        }
    
        this.log(`未找到字段 ${fieldName} 的值`);
        return null;
    }
    
    private parseValue(value: string): any {
        // 尝试解析数组格式
        if (value.startsWith('[') && value.endsWith(']')) {
            try {
                return JSON.parse(value);
            } catch (e) {
                // 如果解析失败，返回原始字符串
                return value;
            }
        }
        return value;
    }
    
    

    
    private cleanResponseText(text: string): string {
        // 移除可能的 markdown 格式符号
        return text
            .replace(/^```json\s*/, '')
            .replace(/```$/, '')
            .trim();
    }
    
   
    
    
    
    
    private parseTextResponse(text: string): any {
        const result: any = {};
        const lines = text.split('\n');
    
        for (const line of lines) {
            const match = line.match(/^(.*?):\s*(.*?)$/);
            if (match) {
                const [, key, value] = match;
                result[key.trim()] = value.trim();
            }
        }
    
        return result;
    }
}

    

