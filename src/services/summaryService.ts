// src/services/summaryService.ts
import { App, TFile } from 'obsidian';
import { PluginSettings, AIResponse,SummaryAIResponse } from '../types';
import { AIServiceImpl } from './aiService';

export class SummaryService {
    private aiService: AIServiceImpl;

    constructor(
        private app: App,
        private settings: PluginSettings
    ) {
        this.aiService = new AIServiceImpl(settings);
    }

    async generateFolderSummary(folderPath: string): Promise<string> {
        console.log('Generating folder summary:', {
            folderPath,
            settings: this.settings.summary
        });
        
        try {
            // 1. 获取文件夹下所有笔记
            const files = await this.getMarkdownFiles(folderPath);
            
            // 2. 提取每个笔记的内容
            const notesContent = await Promise.all(
                files.map(async file => {
                    const content = await this.app.vault.read(file);
                    return {
                        title: file.basename,
                        content: this.extractMainContent(content)
                    };
                })
            );
    
            console.log('Extracted notes content:', notesContent);
    
            // 3. 构建提示词
            const summaryPrompt = this.buildSummaryPrompt(notesContent);
            console.log('Summary prompt:', summaryPrompt);
    
            // 4. 调用 AI 生成总结
            const aiResponse = await this.aiService.processText(
                summaryPrompt,
                this.settings.summary.promptTemplate,
                undefined,
                'summary'
            );
    
            // 类型检查和转换
            if (aiResponse.type !== 'summary') {
                throw new Error('AI response type mismatch');
            }
    
            // 5. 生成文件夹结构
            const structure = await this.generateFolderStructure(folderPath);
    
            // 6. 构造完整的 SummaryAIResponse
            const summaryResponse: SummaryAIResponse = {
                type: 'summary',
                themes: aiResponse.themes || [],  // 确保有默认值
                summary: aiResponse.summary || '',
                structure: structure,
                tags: aiResponse.tags || []
            };
    
            // 7. 格式化总结内容
            const summaryContent = this.formatSummaryNote(summaryResponse, files, folderPath);
    
            // 8. 保存总结文件
            const folderName = folderPath.split('/').pop() || 'folder';
            const summaryFileName = `${folderName}-总结.md`;  // 添加 .md 扩展名
            const summaryFilePath = `${folderPath}/${summaryFileName}`;
    
            await this.app.vault.create(summaryFilePath, summaryContent);
    
            return summaryFilePath;
        } catch (error) {
            console.error('生成文件夹总结失败:', error);
            throw error;
        }
    }

    private async getMarkdownFiles(folderPath: string): Promise<TFile[]> {
        const files: TFile[] = [];
        const folder = this.app.vault.getAbstractFileByPath(folderPath);
        
        if (!folder) {
            throw new Error(`找不到文件夹: ${folderPath}`);
        }

        const recurse = (folder: any) => {
            for (const child of folder.children) {
                if (child instanceof TFile && child.extension === 'md') {
                    files.push(child);
                } else if (child.children) {
                    recurse(child);
                }
            }
        };

        recurse(folder);
        return files;
    }

    private buildSummaryPrompt(notes: Array<{title: string, content: string}>): string {
        if (!notes || notes.length === 0) {
            throw new Error('没有找到需要总结的笔记');
        }
    
        // 添加调试日志，检查每个笔记的内容
        console.log('Notes to summarize:', notes.map(n => ({
            title: n.title,
            contentLength: n.content?.length || 0,
            contentPreview: n.content?.substring(0, 100)
        })));
    
        const notesContent = notes.map((note, index) => {
            // 确保内容不为 undefined
            const content = note.content || '';
            
            return `
    ## ${note.title}
    ${content}`;
        }).join('\n\n');
    
        // 使用设置中的提示词模板
        const prompt = this.settings.summary.promptTemplate
            .replace('{count}', String(notes.length))
            .replace('{notes}', notesContent);
    
        // 记录最终生成的提示词
        console.log('Final prompt length:', prompt.length);
        
        return prompt;
    }
    
    private extractMainContent(content: string): string {
        try {
            // 1. 移除 YAML frontmatter
            const frontMatterRegex = /^---\n[\s\S]*?\n---/;
            let cleanContent = content.replace(frontMatterRegex, '');
    
            // 2. 移除 Obsidian 内部链接语法，但保留链接文本
            cleanContent = cleanContent.replace(/\[\[(.*?)\]\]/g, '$1');
    
            // 3. 保留文本内容，包括标题和正文
            cleanContent = cleanContent
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0)
                .join('\n');
    
            // 添加调试日志
            console.log('Content extraction:', {
                originalLength: content.length,
                cleanedLength: cleanContent.length,
                sample: cleanContent.substring(0, 100) + '...'
            });
    
            return cleanContent;
        } catch (error) {
            console.error('Error extracting content:', error);
            return '';
        }
    }

    // 添加新的辅助方法来清理内容
private cleanContent(content: string): string {
    // 移除 YAML frontmatter
    const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
    const cleanContent = content.replace(frontmatterRegex, '');
    
    // 移除代码块
    const codeBlockRegex = /```[\s\S]*?```/g;
    const withoutCode = cleanContent.replace(codeBlockRegex, '');
    
    // 移除空行和多余空格
    return withoutCode
        .split('\n')
        .filter(line => line.trim())
        .join('\n')
        .trim();
}

// 新增：生成文件夹结构的方法
private async generateFolderStructure(folderPath: string): Promise<string> {
    const folder = this.app.vault.getAbstractFileByPath(folderPath);
    if (!folder) {
        throw new Error(`找不到文件夹: ${folderPath}`);
    }

    const structure: string[] = [];
    
    const buildStructure = (file: any, depth: number = 0) => {
        const indent = '  '.repeat(depth);
        
        if (file instanceof TFile) {
            if (file.extension === 'md') {
                structure.push(`${indent}- [[${file.basename}]]`);
            }
        } else if (file.children) {
            if (depth > 0) {
                structure.push(`${indent}- 📁 ${file.name}`);
            }
            const sortedChildren = [...file.children].sort((a, b) => {
                if (a.children && !b.children) return -1;
                if (!a.children && b.children) return 1;
                return a.name.localeCompare(b.name);
            });
            
            sortedChildren.forEach(child => {
                buildStructure(child, depth + (depth > 0 ? 1 : 0));
            });
        }
    };

    buildStructure(folder);
    return structure.join('\n');
}

    
private formatSummaryNote(
    summary: SummaryAIResponse,
    files: TFile[],
    folderPath: string
): string {
    const timestamp = new Date().toISOString();
    const folderName = folderPath.split('/').pop() || 'folder';
    
    return `---
created: ${timestamp}
type: summary
folder: ${folderPath}
themes: ${summary.themes.join(', ')}
tags:
${summary.tags.map(tag => `  - ${tag}`).join('\n')}
---

# ${folderName} 文件夹笔记总结

## 核心主题
${summary.themes.map(theme => `- ${theme}`).join('\n')}

## 主要观点
${summary.summary}

## 文件夹结构
${summary.structure}

## 相关标签
${summary.tags.map(tag => `#${tag}`).join(' ')}
`;
}
    
    private generateKnowledgeStructure(aiResult: AIResponse): string {
        // 首先检查响应类型
        if (aiResult.type !== 'summary') {
            throw new Error('收到了错误的响应类型');
        }
    
        // 现在可以安全地使用 SummaryAIResponse 的属性
        return aiResult.tags
            .map(tag => `- ${tag}\n  ${
                aiResult.themes  // 使用 themes 替代 keywords
                    .filter(theme => theme.toLowerCase().includes(tag.toLowerCase()))
                    .map(theme => `  - ${theme}`)
                    .join('\n')
            }`)
            .join('\n');
    }
    
}
