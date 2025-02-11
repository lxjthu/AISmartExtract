// src/services/aiService.ts
import { requestUrl } from 'obsidian';
import { 
    PluginSettings, 
    AIResponse, 
    AIProvider, 
    AIService,
    ProviderSettings 
} from '../types';

export class AIServiceImpl implements AIService  {
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
        modelOverride?: string
    ): Promise<AIResponse> {
        if (!this.settings.apiKey) {
            throw new Error('请先在设置中配置API Key');
        }

        // 获取当前提供商的设置
        const providerConfig = this.settings.providerSettings[this.settings.aiProvider];
        if (!providerConfig) {
            throw new Error(`未找到 ${this.settings.aiProvider} 的配置`);
        }

        // 使用提供的模板内容或设置中的默认提示词
        const prompt = (templateContent || this.settings.promptTemplate)
            .replace('{text}', text);

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

            return this.parseAIResponse(response.json);
        } catch (error) {
            console.error('AI处理错误:', error);
            throw new Error('AI处理失败: ' + (error.message || '未知错误'));
        }
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
    private parseAIResponse(aiResponse: any): AIResponse {
        // 根据不同提供商处理不同的响应格式
        let text: string;
        
        if (aiResponse.output?.text) {
            // 千问格式
            text = aiResponse.output.text;
        } else if (aiResponse.choices?.[0]?.message?.content) {
            // OpenAI格式
            text = aiResponse.choices[0].message.content;
        } else {
            throw new Error('AI返回格式不正确');
        }
        
        // 解析返回的文本
        const keywordsMatch = text.match(/关键词：(.*)/);
        const summaryMatch = text.match(/总结：(.*)/);
        const tagsMatch = text.match(/标签：(.*?)(?=\n|$)/);
    
        if (!keywordsMatch || !summaryMatch || !tagsMatch) {
            console.error('AI返回内容:', text);
            throw new Error('AI返回格式不正确');
        }
    
        // 处理标签：移除 # 符号，因为在 YAML 格式中会单独处理
        const tags: string[] = tagsMatch[1].trim()
            .split(/[\s,，]+/)
            .map((tag: string) => tag.trim())
            .filter((tag: string) => tag)
            .map((tag: string) => tag.startsWith('#') ? tag.substring(1) : tag);
    
        return {
            keywords: keywordsMatch[1].split('，').map((k: string) => k.trim()),
            summary: summaryMatch[1].trim().replace(/。$/, ''),
            tags: tags
        };
    }
}
