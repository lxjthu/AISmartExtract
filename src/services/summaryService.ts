// src/services/summaryService.ts
import { App, TFile } from 'obsidian';
import { PluginSettings, AIResponse } from '../types';
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

        // 3. 构建提示词
        const summaryPrompt = this.buildSummaryPrompt(notesContent);

        // 4. 调用 AI 生成总结
        const result = await this.aiService.processText(summaryPrompt);

        // 5. 格式化总结内容
        const summaryContent = this.formatSummaryNote(result, files, folderPath);

        // 6. 保存总结文件
        const folderName = folderPath.split('/').pop() || 'folder';
        const summaryFileName = `${folderName}-总结.md`;
        const summaryFilePath = `${folderPath}/${summaryFileName}`;

        await this.app.vault.create(summaryFilePath, summaryContent);

        return summaryFilePath;
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

    private extractMainContent(content: string): string {
        const frontMatterRegex = /^---\n([\s\S]*?)\n---/;
        return content.replace(frontMatterRegex, '').trim();
    }

    private buildSummaryPrompt(notes: Array<{title: string, content: string}>): string {
        const notesContent = notes.map(note => `
    # ${note.title}
    ${note.content.substring(0, 500)}...
    `).join('\n');
    
        return this.settings.summary.promptTemplate
            .replace('{count}', String(notes.length))
            .replace('{notes}', notesContent);
    }
private formatSummaryNote(
                aiResult: AIResponse, 
                files: TFile[], 
                folderPath: string
            ): string {
                const timestamp = new Date().toISOString();
                const fileLinks = files
                    .map(file => `- [[${file.basename}]]`)
                    .join('\n');

                return `---
created: ${timestamp}
type: summary
folder: ${folderPath}
keywords: ${aiResult.keywords.join(', ')}
tags:
${aiResult.tags.map(tag => `  - ${tag}`).join('\n')}
---

# ${folderPath.split('/').pop()} 文件夹笔记总结

## 核心主题
${aiResult.keywords.map(k => `- ${k}`).join('\n')}

## 主要观点
${aiResult.summary}

## 知识结构
${this.generateKnowledgeStructure(aiResult)}

## 包含笔记
 ${fileLinks}
`;
}

    private generateKnowledgeStructure(aiResult: AIResponse): string {
        // 这里可以基于 AI 返回的标签和关键词生成一个简单的知识结构
        return aiResult.tags
            .map(tag => `- ${tag}\n  ${
                aiResult.keywords
                    .filter(k => k.toLowerCase().includes(tag.toLowerCase()))
                    .map(k => `  - ${k}`)
                    .join('\n')
            }`)
            .join('\n');
    }
}
