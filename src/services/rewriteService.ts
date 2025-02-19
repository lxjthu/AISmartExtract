import { App, TFile, Notice,View } from 'obsidian';
import { AIServiceImpl } from './aiService';
import { QueueService } from './queueService';
import { BatchProcessor } from './BatchProcessor';
import { isPdfView } from 'src/utils/helpers';  
import { 
    PluginSettings, 
    RewriteOptions, 
    RewriteAIResponse, 
    EmbeddedPDFView,
    PdfSelection,
    AIResponse 
} from '../types';
import { cleanPdfText } from '../utils/textCleaner';
export class RewriteService {
    private aiService: AIServiceImpl;
    private queueService: QueueService;
    private batchProcessor: BatchProcessor;

    constructor(
        private app: App,
        private settings: PluginSettings
    ) {
        this.aiService = new AIServiceImpl(settings);
        this.queueService = new QueueService(settings);
        
    }

    /**
     * 批量改写文件
     */
    async processBatchRewrite(files: TFile[], options: RewriteOptions): Promise<void> {
        // 使用 BatchProcessor 的配置
        const { maxConcurrent, delayBetweenFiles } = this.settings.batchProcessing;
        this.queueService.setMaxConcurrent(maxConcurrent);

        const total = files.length;
        let processed = 0;
        const progressNotice = new Notice(`开始改写文件 (0/${total})`, 0);

        try {
            for (const file of files) {
                await this.queueService.addTask(
                    async () => {
                        return await this.processRewrite(file, options);
                    },
                    () => {
                        processed++;
                        const progress = Math.round((processed / total) * 100);
                        progressNotice.setMessage(
                            `正在改写文件 (${processed}/${total}) - ${progress}%`
                        );
                    },
                    (error) => {
                        console.error(`改写文件 ${file.path} 失败:`, error);
                        new Notice(`改写文件 ${file.path} 失败: ${error.message}`);
                    }
                );

                if (delayBetweenFiles > 0) {
                    await new Promise(resolve => 
                        setTimeout(resolve, delayBetweenFiles)
                    );
                }
            }
        } finally {
            progressNotice.hide();
        }
    }

    /**
     * 处理单个文件的改写
     */
    public async processRewrite(file: TFile, options: RewriteOptions): Promise<void> {
        let content: string;
        
        if (file.extension === 'pdf') {
            content = await this.extractPdfContent(file, options.fullDocument);
        } else if (file.extension === 'md') {
            content = await this.app.vault.read(file);
        } else {
            throw new Error('不支持的文件类型');
        }
        
        // 提取内容和 frontmatter（对于PDF文件，frontMatter为空）
        const { frontMatter, mainContent } = this.extractContentWithFrontMatter(content);
        
        // 使用 AI 改写内容
        const aiResult = await this.aiService.processText(
            mainContent,
            options.template,
            undefined,
            'rewrite'
        );
    
        if (aiResult.type !== 'rewrite') {
            throw new Error('收到了错误的响应类型');
        }
    
        // 生成新的内容
        const newContent = this.generateNewContent(frontMatter, aiResult, file);
        
        // 如果需要备份原文件
        if (options.createBackup) {
            await this.createBackup(file);
        }
    
        // 生成新文件路径
        const newFilePath = this.generateNewFilePath(file);
        
        // 创建改写后的文件
        await this.app.vault.create(newFilePath, newContent);

        // 在原文件末尾添加反向链接（仅对Markdown文件）
        if (file.extension === 'md' && this.settings.addBacklinks) {
            const originalContent = await this.app.vault.read(file);
            const backlink = `\n\n---\n### 相关笔记\n- [[${file.basename}-rewrite|查看改写版本]]`;
            await this.app.vault.modify(file, originalContent + backlink);
        }

        // 打开新创建的文件
        const newFile = this.app.vault.getAbstractFileByPath(newFilePath);
        if (newFile instanceof TFile) {
            await this.app.workspace.getLeaf().openFile(newFile);
        }
    }
    
    /**
     * 生成新文件路径
     */
    private generateNewFilePath(file: TFile): string {
        // 获取目标文件夹路径
        const targetFolder = this.settings.targetFolder;
        
        // 生成新的文件名（添加 -rewrite 后缀）
        const baseName = file.basename;
        const newFileName = `${baseName}-rewrite.md`;
        
        // 组合完整路径
        return `${targetFolder}/${newFileName}`;
    }
    /**
     * 提取 frontmatter 和主要内容
     */
    private extractContentWithFrontMatter(content: string): { frontMatter: string, mainContent: string } {
        const frontMatterRegex = /^---\n([\s\S]*?)\n---/;
        const match = content.match(frontMatterRegex);
        
        if (!match) {
            return {
                frontMatter: '',
                mainContent: content.trim()
            };
        }
    
        return {
            frontMatter: match[0],
            mainContent: content.replace(frontMatterRegex, '').trim()
        };
    }

    /**
     * 提取PDF文件内容
     */
    /**
 * 提取PDF文件内容
 */
    private async extractPdfContent(file: TFile, fullDocument: boolean = false): Promise<string> {
        const leaves = this.app.workspace.getLeavesOfType('pdf');
        if (leaves.length === 0) {
            throw new Error('请先打开 PDF 文件');
        }
    
        const view = leaves[0].view as EmbeddedPDFView;
        if (!view || !view.viewer) {
            throw new Error('PDF 视图未就绪');
        }
    
        let text: string = '';
    
        if (fullDocument) {
            try {
                const pdfViewer = view.viewer.pdfViewer;
                const pageCount = pdfViewer.pagesCount;
                const pageTexts: string[] = [];
    
                // 直接获取选中文本
                text = pdfViewer.getSelectedText()?.trim() || '';
                
                // 如果没有选中文本，尝试获取当前页面的文本
                if (!text) {
                    const currentPage = pdfViewer.currentPageNumber;
                    text = `[第${currentPage}页]\n${pdfViewer.getSelectedText() || ''}`;
                }
    
            } catch (error) {
                console.error('提取 PDF 文本时出错:', error);
                throw new Error('无法提取 PDF 文本，请确保文档已完全加载');
            }
        } else {
            text = view.viewer.pdfViewer.getSelectedText()?.trim() || '';
            if (!text) {
                throw new Error('请先在 PDF 中选择要改写的文本');
            }
        }
    
        return cleanPdfText(text);
    }
    /**
     * 生成新的文件内容
     */
    private generateNewContent(frontMatter: string, aiResult: RewriteAIResponse, file: TFile): string {
        const parts: string[] = [];
    
        // 添加 frontmatter
        if (frontMatter) {
            parts.push(frontMatter);
        }
    
        // 添加原文链接
        parts.push(`> [!info] 原文链接\n> [[${file.basename}|查看原文]]`);
    
        // 添加改写后的内容
        parts.push(aiResult.content);
    
        // 如果有改写说明，添加到文件末尾
        if (aiResult.changes && aiResult.changes.length > 0) {
            parts.push('\n---\n### 改写说明');
            aiResult.changes.forEach(change => {
                parts.push(`- ${change}`);
            });
        }
    
        // 如果有改进建议，也添加到文件末尾
        if (aiResult.suggestions && aiResult.suggestions.length > 0) {
            parts.push('\n### 改进建议');
            aiResult.suggestions.forEach(suggestion => {
                parts.push(`- ${suggestion}`);
            });
        }
    
        return parts.join('\n\n');
    }
    /**
     * 创建文件备份
     */
    private async createBackup(file: TFile): Promise<void> {
        const content = await this.app.vault.read(file);
        const backupPath = `${file.path}.backup`;
        await this.app.vault.create(backupPath, content);
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