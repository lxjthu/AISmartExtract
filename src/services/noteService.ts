// src/services/noteService.ts
import { App, TFile, MarkdownView } from 'obsidian';
import { PluginSettings, PdfSelection } from '../types';
import { AIServiceImpl } from './aiService';
import { formatDate } from '../utils/helpers';

export class NoteService {
    private aiService: AIServiceImpl;

    constructor(
        private app: App,
        private settings: PluginSettings
    ) {
        this.aiService = new AIServiceImpl(settings);
    }

    /**
     * 从Markdown创建笔记
     */
    async createFromMarkdown(
        text: string, 
        sourceView: MarkdownView,
        templateId?: string,
        pdfSelection?: PdfSelection
    ) {
        try {
            // 检查 sourceView.file 是否存在
            if (!sourceView.file) {
                throw new Error('Source file is not available.');
            }
    
            // 获取模板
            const template = templateId 
            ? this.settings.promptTemplates.find(t => t.id === templateId)
            : null;
        
        // 使用选定的模板或默认提示词进行AI处理
        const aiResult = await this.aiService.processText(
            text,
            template?.content, // 将模板内容传递给 AIService
            undefined               // 第三个参数：模型覆盖（可选）
        );
    
            // 准备笔记内容
            const noteContent = await this.prepareNoteContent(
                text,
                aiResult,
                sourceView.file,
                pdfSelection
            );
    
            // 创建新笔记并获取文件引用
            const fileName = this.generateFileName(aiResult.summary);
            const newFile = await this.createNote(fileName, noteContent);
    
            // 如果需要添加反向链接且不是 PDF 文件
            if (this.settings.addBacklinks && sourceView.file.extension !== 'pdf') {
                await this.addBacklink(sourceView.file, fileName, pdfSelection);
            }
    
            // 在新叶子中打开笔记
            await this.openNote(newFile);
    
            return fileName;
        } catch (error) {
            console.error('创建笔记失败:', error);
            throw error;
        }
    }
    

    /**
     * 准备笔记内容
     */
    private async prepareNoteContent(
        text: string,
        aiResult: { keywords: string[]; summary: string; tags: string[] },
        sourceFile: TFile,
        pdfInfo?: PdfSelection
    ): Promise<string> {
        const timestamp = formatDate(new Date());
        const sourceLink = this.settings.backlinkStyle === 'wiki' 
            ? `[[${sourceFile.basename}]]`
            : `[${sourceFile.basename}](${sourceFile.path})`;
    
        const formattedTags = aiResult.tags
            .map(tag => `  - ${tag.startsWith('#') ? tag.substring(1) : tag}`)
            .join('\n');
    
        // 构建基本的 YAML front matter
        const frontMatter = [
            `---`,
            `created: ${timestamp}`,
            `keywords: ${aiResult.keywords.join(', ')}`,
            `tags:`,
            formattedTags
        ];

        // 如果有 PDF 信息，添加到 front matter
        if (pdfInfo) {
            frontMatter.push(
                `source_type: pdf`,
                `pdf_page: ${pdfInfo.pageNumber}`,
                `pdf_position:`,
                `  top: ${pdfInfo.relativePosition.top.toFixed(2)}`,
                `  left: ${pdfInfo.relativePosition.left.toFixed(2)}`,
                `pdf_scale: ${pdfInfo.pdfViewerState.currentScale}`,
                `selection_time: ${pdfInfo.timestamp}`
            );
        }

        frontMatter.push('---', '');

        // 构建笔记主体内容
        const noteBody = [
            `# ${aiResult.summary}`,
            '',
            '## 原文引用',
            '',
            this.formatQuote(text)
        ];

        // 如果是 PDF，添加更详细的源信息
        if (pdfInfo) {
            noteBody.push(
                '',
                '## 源文件信息',
                `- 文件：${sourceLink}`,
                `- 页码：${pdfInfo.pageNumber}`,
                `- 位置：上${pdfInfo.relativePosition.top.toFixed(2)}%, 左${pdfInfo.relativePosition.left.toFixed(2)}%`,
                `- 缩放比例：${pdfInfo.pdfViewerState.currentScale}`,
                `- 选择时间：${pdfInfo.timestamp}`,
                ''
            );
        } else {
            noteBody.push('', `source: ${sourceLink}`);
        }

        noteBody.push('## 相关笔记', '');

        return [...frontMatter, ...noteBody].join('\n');
    }


    /**
     * 格式化引用内容
     */
    private formatQuote(text: string): string {
        if (this.settings.quoteCollapsible) {
            return [
                `> [!${this.settings.quoteCallout}]- 引用`,
                text.split('\n').map(line => `> ${line}`).join('\n')
            ].join('\n');
        } else {
            return [
                `> [!${this.settings.quoteCallout}] 引用`,
                text.split('\n').map(line => `> ${line}`).join('\n')
            ].join('\n');
        }
    }

    /**
     * 生成文件名
     */
    private generateFileName(summary: string): string {
        const timestamp = formatDate(new Date(), 'YYYYMMDDHHmmss');
        const sanitizedSummary = summary
            .replace(/[\\/:*?"<>|]/g, '')  // 移除不允许的字符
            .replace(/\s+/g, '-');         // 空格替换为破折号
        return `${timestamp}-${sanitizedSummary}`;
    }

    /**
     * 创建笔记文件
     */
    private async createNote(fileName: string, content: string): Promise<TFile> {
        // 确保目标文件夹存在
        const targetFolder = this.settings.targetFolder;
        if (!(await this.app.vault.adapter.exists(targetFolder))) {
            await this.app.vault.createFolder(targetFolder);
        }

        // 创建文件
        const filePath = `${targetFolder}/${fileName}.md`;
        const file = await this.app.vault.create(filePath, content);
        return file;
    }

    /**
 * 在新叶子中打开笔记
 */
    private async openNote(file: TFile): Promise<void> {
        try {
            // 获取当前活动的视图
            const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
            let targetLeaf;
            
            if (this.settings.openInNewTab) {
                // 在新标签页打开
                targetLeaf = this.app.workspace.createLeafInParent(
                    this.app.workspace.rootSplit,
                    this.settings.splitDirection
                );
            } else {
                // 在当前标签页打开
                targetLeaf = activeView?.leaf;
                if (!targetLeaf) {
                    // 如果没有活动的标签页，创建一个新的
                    targetLeaf = this.app.workspace.createLeafInParent(
                        this.app.workspace.rootSplit,
                        this.settings.splitDirection
                    );
                }
            }
    
            // 打开文件
            await targetLeaf.openFile(file);
            
            // 激活新打开的标签页
            this.app.workspace.setActiveLeaf(targetLeaf, { focus: true });
    
            // 确保视图类型是 markdown
            if (targetLeaf.view.getViewType() !== 'markdown') {
                await targetLeaf.setViewState({
                    type: 'markdown',
                    state: targetLeaf.view.getState()
                });
            }
        } catch (error) {
            console.error('打开笔记失败:', error);
            throw error;
        }
    }
    

            /**
         * 添加反向链接
         */
        private async addBacklink(sourceFile: TFile, targetFileName: string, pdfSelection?: PdfSelection) {
            try {
                // 如果是 PDF 文件，直接返回，不添加反向链接
                if (sourceFile.extension === 'pdf') {
                    return;
                }

                const content = await this.app.vault.read(sourceFile);
                const backlinksSection = this.settings.addBacklinksSection ? '\n## 相关笔记\n' : '\n';
                
                let newLink = this.settings.backlinkStyle === 'wiki'
                    ? `[[${targetFileName}]]`
                    : `[${targetFileName}](${this.settings.targetFolder}/${targetFileName}.md)`;

                // 如果是 PDF，添加页码信息（这部分可以保留，因为它只影响链接文本）
                if (pdfSelection) {
                    newLink += ` (第 ${pdfSelection.pageNumber} 页)`;
                }

                if (content.includes('## 相关笔记')) {
                    const updatedContent = content.replace(
                        /## 相关笔记\n/,
                        `## 相关笔记\n${newLink}\n`
                    );
                    await this.app.vault.modify(sourceFile, updatedContent);
                } else {
                    await this.app.vault.modify(
                        sourceFile,
                        content + backlinksSection + newLink + '\n'
                    );
                }
            } catch (error) {
                console.error('添加反向链接失败:', error);
                // 不抛出错误，因为这是可选功能
                console.debug('跳过添加反向链接');
            }
        }
}
