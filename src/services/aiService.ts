// src/services/aiService.ts
import { requestUrl } from 'obsidian';
import { PluginSettings, AIResponse } from '../types';

export class AIService {
    constructor(private settings: PluginSettings) {}

    /**
     * 处理文本并获取AI分析结果
     */
    async processText(text: string): Promise<AIResponse> {
        if (!this.settings.apiKey) {
            throw new Error('请先在设置中配置API Key');
        }

        // 使用设置中的提示词模板，替换占位符
        const prompt = this.settings.promptTemplate.replace('{text}', text);

        try {
            const response = await requestUrl({
                url: this.settings.apiEndpoint,
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.settings.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'qwen-max',
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
                })
            });

            return this.parseAIResponse(response.json);
        } catch (error) {
            console.error('AI处理错误:', error);
            throw new Error('AI处理失败: ' + (error.message || '未知错误'));
        }
    }

    /**
     * 解析AI响应
     */
    private parseAIResponse(aiResponse: any): AIResponse {
        if (!aiResponse.output?.text) {
            throw new Error('AI返回格式不正确');
        }
    
        const text = aiResponse.output.text;
        
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
            .map((tag: string) => tag.startsWith('#') ? tag.substring(1) : tag); // 移除 # 前缀
    
        return {
            keywords: keywordsMatch[1].split('，').map((k: string) => k.trim()),
            summary: summaryMatch[1].trim().replace(/。$/, ''),
            tags: tags
        };
    }
}
