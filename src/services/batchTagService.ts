// src/services/batchTagService.ts
import { App, TFile, Notice } from 'obsidian';
import { AIServiceImpl } from './aiService';
import { PluginSettings,TagAIResponse } from '../types';

export class BatchTagService {
    private aiService: AIServiceImpl;

    constructor(
        private app: App,
        private settings: PluginSettings
    ) {
        this.aiService = new AIServiceImpl(settings);
    }

    /**
     * 批量处理文件
     */
    async processBatchFiles(files: TFile[]) {
        const total = files.length;
        let processed = 0;
        const errors: string[] = [];

        // 创建进度提示
        const notice = new Notice(`开始处理文件 (0/${total})`, 0);

        for (const file of files) {
            try {
                await this.processFile(file);
                processed++;
                notice.setMessage(`正在处理文件 (${processed}/${total})`);
            } catch (error) {
                console.error(`处理文件 ${file.path} 失败:`, error);
                errors.push(file.path);
            }
        }

        // 更新最终状态
        if (errors.length > 0) {
            new Notice(`处理完成。${processed} 个成功，${errors.length} 个失败。`);
            console.error('处理失败的文件:', errors);
        } else {
            new Notice(`成功处理 ${processed} 个文件！`);
        }
    }

    /**
     * 处理单个文件
     */
    public async processFile(file: TFile) {
        // 只处理 markdown 文件
        if (file.extension !== 'md') {
            return;
        }

        // 读取文件内容
        const content = await this.app.vault.read(file);
        
        // 提取正文内容（排除 YAML frontmatter）
        const mainContent = this.extractMainContent(content);
        
        // 使用 AI 生成标签
        const aiResult = await this.aiService.processText(
            mainContent,
            undefined,
            undefined,
            'tag'  // 指定响应类型
        );

        if (aiResult.type !== 'tag') {
            throw new Error('收到了错误的响应类型');
        }
        
        // 更新文件
        await this.updateFileTags(file, content, aiResult.tags);
    }

    /**
     * 提取文件主要内容（排除 frontmatter）
     */
    private extractMainContent(content: string): string {
        const frontMatterRegex = /^---\n([\s\S]*?)\n---/;
        return content.replace(frontMatterRegex, '').trim();
    }

    /**
     * 更新文件标签
     */
    private async updateFileTags(file: TFile, content: string, newTags: string[]) {
        const frontMatterRegex = /^---\n([\s\S]*?)\n---/;
        const hasFrontMatter = frontMatterRegex.test(content);

        // 格式化新标签
        const formattedTags = newTags
            .map(tag => tag.startsWith('#') ? tag.substring(1) : tag)
            .map(tag => `  - ${tag}`);

        let newContent: string;
        
        if (hasFrontMatter) {
            // 更新现有的 frontmatter
            newContent = content.replace(frontMatterRegex, (match, frontMatter) => {
                if (frontMatter.includes('tags:')) {
                    // 更新现有标签
                    const tagRegex = /tags:\n([\s\S]*?)(?=\n\w|$)/;
                    frontMatter = frontMatter.replace(tagRegex, `tags:\n${formattedTags.join('\n')}`);
                } else {
                    // 添加新的标签部分
                    frontMatter += `\ntags:\n${formattedTags.join('\n')}`;
                }
                return `---\n${frontMatter}\n---`;
            });
        } else {
            // 创建新的 frontmatter
            const frontMatter = `---\ntags:\n${formattedTags.join('\n')}\n---\n\n`;
            newContent = frontMatter + content;
        }

        // 保存更新后的文件
        await this.app.vault.modify(file, newContent);
    }

    /**
     * 获取文件夹下所有 Markdown 文件
     */
    async getMarkdownFiles(folderPath: string): Promise<TFile[]> {
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
}
