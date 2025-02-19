// src/main.ts
import { App, Plugin, Notice, MarkdownView, View } from 'obsidian';
import { ExtendedCommand,PluginSettings,RewriteOptions } from './types';
import { DEFAULT_SETTINGS } from './settings/settings';
import { AISmartExtractSettingTab } from './settings/settingTab';
import { NoteService } from './services/noteService';
import { PDFService } from './services/pdfService';
import { QueueService } from './services/queueService';
import { isPdfView } from './utils/helpers';
import { AIServiceImpl } from './services/aiService';
import { BatchTagService } from './services/batchTagService';
import { BatchProcessor } from './services/BatchProcessor';
import { FolderSuggestModal } from './modals/folderSuggest';
import { SummaryService } from './services/summaryService';
import { MetadataService } from './services/metadataService';
import { RewriteService } from './services/rewriteService';

export default class AISmartExtractPlugin extends Plugin {
    settings: PluginSettings;
    private noteService: NoteService;
    private pdfService: PDFService;
    private aiService: AIServiceImpl;
    private queueService: QueueService;
    private batchTagService: BatchTagService;
    private batchProcessor: BatchProcessor;
    public commands: { [key: string]: ExtendedCommand } = {};
    private summaryService: SummaryService;
    private metadataService: MetadataService;
    private rewriteService: RewriteService;



    async onload() {
        console.debug('AI Smart Extract Plugin 正在加载...');
        await this.loadSettings();

        // 初始化服务
        this.aiService = new AIServiceImpl(this.settings);
        this.noteService = new NoteService(this.app, this.settings);
        this.queueService = new QueueService(this.settings);
        this.pdfService = new PDFService(
            this.app,
            this.noteService,
            this.aiService
        );
        this.metadataService = new MetadataService(this.app, this.settings, this.aiService);
        this.batchTagService = new BatchTagService(this.app, this.settings);
        this.batchProcessor = new BatchProcessor(
            this.queueService,
            this.batchTagService,
            this.settings,
            this.metadataService
        );
        this.summaryService = new SummaryService(this.app, this.settings);
        this.rewriteService = new RewriteService(this.app, this.settings);


        // 添加设置标签页
        this.addSettingTab(new AISmartExtractSettingTab(this.app, this));

        // 添加命令
        this.addCommands();
        
        // 注册事件监听器
        this.registerEventHandlers();

        // 为现有打开的 PDF 视图设置处理器
        this.setupExistingPdfViews();

        // 添加状态栏
        this.addStatusBarItem().setText('智能笔记助手已启动');

         
        console.debug('AI Smart Extract Plugin 加载完成');
        // 添加设置面板
        this.addSettingTab(new AISmartExtractSettingTab(this.app, this));

        // 添加状态栏
        this.addStatusBarItem().setText('智能笔记助手已启动');
    }

    /**
     * 开始批量处理流程
     */
    // 修改批量处理方法以支持模板
    private async startBatchProcess(templateId?: string) {
        new FolderSuggestModal(this.app, async (folderPath) => {
            if (!folderPath) {
                new Notice('未选择文件夹');
                return;
            }

            try {
                const files = await this.batchTagService.getMarkdownFiles(folderPath);
                
                if (files.length === 0) {
                    new Notice('所选文件夹中没有 Markdown 文件');
                    return;
                }

                if (!await this.confirmBatchProcess(files.length)) {
                    return;
                }

                // 使用 BatchProcessor 处理文件，传入模板ID
                await this.batchProcessor.processBatchFiles(files, );

            } catch (error) {
                console.error('批量处理初始化失败:', error);
                new Notice('批量处理初始化失败，请查看控制台了解详情');
            }
        }).open();
    }

    private setupExistingPdfViews() {
        console.debug('设置现有 PDF 视图的处理器');
        this.app.workspace.getLeavesOfType('pdf').forEach(leaf => {
            if (leaf.view && isPdfView(leaf.view)) {
                console.debug('为已打开的 PDF 视图设置处理器');
                this.pdfService.setupPdfSelectionHandler(leaf.view);
            }
        });
    }

    private addCommands() {
        // 从 Markdown 创建笔记的命令
        const markdownCommand: ExtendedCommand = {
            id: 'create-smart-note-from-markdown',
            name: '从Markdown选中文本创建智能笔记',
            editorCallback: (editor, view: MarkdownView) => {
                const selectedText = editor.getSelection();
                if (!selectedText) {
                    new Notice('请先选择一段文本');
                    return;
                }
        
                // 获取命令对应的模板ID
                const templateId = this.settings.commandTemplateMap['create-smart-note-from-markdown'] || 
                                 this.settings.defaultTemplateId;
        
                this.queueService.addTask(
                    async () => await this.noteService.createFromMarkdown(
                        selectedText, 
                        view,
                        templateId,
                        undefined,  // pdfSelection 参数
                        'tag'      // 明确指定响应类型为 'tag'
                    ),
                    () => new Notice('笔记创建成功！'),
                    (error) => new Notice('处理失败: ' + error.message)
                );
            }
        };
    
        // PDF命令
        const pdfCommand: ExtendedCommand = {
            id: 'create-smart-note-from-pdf',
            name: '从PDF选中文本创建智能笔记',
            checkCallback: (checking: boolean) => {
                const activeView = this.app.workspace.getActiveViewOfType(View);
                console.debug('PDF命令检查，当前视图:', activeView?.getViewType());
                
                if (!activeView || !isPdfView(activeView)) {
                    return false;
                }
        
                if (checking) {
                    return true;
                }
        
                // 获取命令对应的模板ID
                const templateId = this.settings.commandTemplateMap['create-smart-note-from-pdf'] || 
                                 this.settings.defaultTemplateId;
        
                this.queueService.addTask(
                    async () => await this.pdfService.handlePdfSelection(
                        activeView
                    ),
                    undefined,
                    (error) => new Notice('处理PDF选择时出错: ' + error.message)
                );
                
                return true;
            }
        };
    
        // 批量处理命令
        const batchCommand: ExtendedCommand = {
            id: 'batch-process-folder',
            name: '批量处理文件夹中的笔记添加智能标签',
            callback: () => {
                const templateId = this.settings.commandTemplateMap['batch-process-folder'] || 
                                 this.settings.defaultTemplateId;
                this.startBatchProcess(templateId);
            }
        };

        // 添加文件夹总结命令
    // 在 addCommands() 方法中的总结命令处理部分
    const summaryCommand: ExtendedCommand = {
        id: 'generate-folder-summary',
        name: '为文件夹生成笔记总结',
        callback: () => {
            // 添加调试日志：显示当前使用的模板
            console.log('Summary command templates:', {
                defaultTemplate: this.settings.promptTemplates.find(
                    t => t.id === 'default-summary'
                ),
                mappedTemplate: this.settings.promptTemplates.find(
                    t => t.id === this.settings.commandTemplateMap['generate-folder-summary']
                ),
                summarySettings: this.settings.summary
            });
    
            new FolderSuggestModal(this.app, async (folderPath) => {
                if (!folderPath) {
                    new Notice('未选择文件夹');
                    return;
                }
    
                console.log('Selected folder for summary:', folderPath);
    
                this.queueService.addTask(
                    async () => {
                        new Notice('正在生成文件夹总结...');
                        console.log('Starting folder summary generation...');
                        
                        const summaryPath = await this.summaryService
                            .generateFolderSummary(folderPath);
                        
                        console.log('Summary generation completed:', {
                            path: summaryPath,
                            template: this.settings.summary.promptTemplate
                        });
                        
                        return summaryPath;
                    },
                    (path) => {
                        console.log('Summary created successfully at:', path);
                        new Notice(`成功创建总结：${path}`);
                    },
                    (error) => {
                        console.error('Summary generation failed:', error);
                        new Notice(`生成总结失败: ${error.message}`);
                    }
                );
            }).open();
        }
    };
    

        // 单文件元数据处理命令
        const metadataCommand: ExtendedCommand = {
            id: 'add-smart-metadata',
            name: '添加智能元数据',
            editorCallback: async (editor, view: MarkdownView) => {
                if (!view.file) {
                    new Notice('当前视图没有关联文件');
                    return;
                }

                // 验证元数据配置
                const aiFields = this.settings.metadata.configs.filter(field => field.type === 'ai');
                if (aiFields.length === 0) {
                    new Notice('未配置任何 AI 元数据字段');
                    return;
                }

                // 验证 AI 字段是否都有提示词
                const missingPrompts = aiFields.filter(field => !field.prompt);
                if (missingPrompts.length > 0) {
                    new Notice(`以下字段缺少 AI 提示词：${missingPrompts.map(f => f.key).join(', ')}`);
                    return;
                }

                // 显示处理状态
                const statusBar = this.addStatusBarItem();
                statusBar.setText('正在处理元数据...');

                try {
                    await this.queueService.addTask(
                        async () => {
                            await this.metadataService.processFile(view.file!);
                        },
                        () => {
                            new Notice('元数据添加成功！');
                            statusBar.setText('元数据处理完成');
                            setTimeout(() => statusBar.remove(), 3000);
                        },
                        (error) => {
                            new Notice('处理失败: ' + error.message);
                            statusBar.setText('元数据处理失败');
                            setTimeout(() => statusBar.remove(), 3000);
                        }
                    );
                } catch (error) {
                    console.error('元数据处理错误:', error);
                    new Notice('处理过程中发生错误');
                    statusBar.remove();
                }
            }
        };

        // 批量元数据处理命令
        const batchMetadataCommand: ExtendedCommand = {
            id: 'batch-add-smart-metadata',
            name: '批量添加智能元数据',
            callback: () => {
                // 验证元数据配置
                const aiFields = this.settings.metadata.configs.filter(field => field.type === 'ai');
                if (aiFields.length === 0) {
                    new Notice('未配置任何 AI 元数据字段');
                    return;
                }

                // 显示当前配置状态
                console.log('元数据批处理配置:', {
                    aiFields: aiFields.map(f => ({
                        key: f.key,
                        description: f.description
                    })),
                    batchSettings: this.settings.metadata.batchProcessing,
                    skipExisting: this.settings.metadata.skipExisting,
                    dateFormat: this.settings.metadata.dateFormat
                });

                new FolderSuggestModal(this.app, async (folderPath) => {
                    if (!folderPath) {
                        new Notice('未选择文件夹');
                        return;
                    }

                    const files = await this.batchTagService.getMarkdownFiles(folderPath);
                    
                    if (files.length === 0) {
                        new Notice('所选文件夹中没有 Markdown 文件');
                        return;
                    }

                    // 显示处理状态
                    const statusBar = this.addStatusBarItem();
                    statusBar.setText(`准备处理 ${files.length} 个文件...`);

                    try {
                        console.log(`开始批量处理文件夹: ${folderPath}`, {
                            fileCount: files.length,
                            files: files.map(f => f.path)
                        });

                        await this.batchProcessor.processMetadata(files);
                        
                        statusBar.setText('批量处理完成');
                        setTimeout(() => statusBar.remove(), 3000);
                        
                        new Notice(`成功处理 ${files.length} 个文件的元数据`);
                    } catch (error) {
                        console.error('批量处理错误:', error);
                        statusBar.setText('批量处理失败');
                        setTimeout(() => statusBar.remove(), 3000);
                        new Notice('批量处理过程中发生错误');
                    }
                }).open();
            }
        };
        // 单文件改写命令
        const rewriteCommand: ExtendedCommand = {
            id: 'rewrite-note',
            name: '智能改写笔记',
            editorCallback: async (editor, view: MarkdownView) => {
                if (!view.file) {
                    new Notice('当前视图没有关联文件');
                    return;
                }

                const options: RewriteOptions = {
                    template: this.settings.rewrite.template,
                    createBackup: this.settings.rewrite.createBackup,
                    keepStructure: this.settings.rewrite.keepStructure
                };

                this.queueService.addTask(
                    async () => {
                        await this.rewriteService.processRewrite(view.file!, options);
                    },
                    () => new Notice('笔记改写完成！'),
                    (error) => new Notice('改写失败: ' + error.message)
                );
            }
        };

        // 批量改写命令
        const batchRewriteCommand: ExtendedCommand = {
            id: 'batch-rewrite-notes',
            name: '批量智能改写笔记',
            callback: () => {
                new FolderSuggestModal(this.app, async (folderPath) => {
                    if (!folderPath) {
                        new Notice('未选择文件夹');
                        return;
                    }

                    try {
                        const files = await this.rewriteService.getMarkdownFiles(folderPath);
                        
                        if (files.length === 0) {
                            new Notice('所选文件夹中没有 Markdown 文件');
                            return;
                        }

                        if (!await this.confirmBatchProcess(files.length)) {
                            return;
                        }

                        const options: RewriteOptions = {
                            template: this.settings.rewrite.template,
                            createBackup: this.settings.rewrite.createBackup,
                            keepStructure: this.settings.rewrite.keepStructure
                        };

                        await this.rewriteService.processBatchRewrite(files, options);

                    } catch (error) {
                        console.error('批量改写初始化失败:', error);
                        new Notice('批量改写初始化失败，请查看控制台了解详情');
                    }
                }).open();
            }
        };




    

    
        // 存储命令到插件实例中
        this.commands['create-smart-note-from-markdown'] = markdownCommand;
        this.commands['create-smart-note-from-pdf'] = pdfCommand;
        this.commands['batch-process-folder'] = batchCommand;
        this.commands['generate-folder-summary'] = summaryCommand;
        this.commands['add-smart-metadata'] = metadataCommand;
        this.commands['batch-add-smart-metadata'] = batchMetadataCommand;
        this.commands['rewrite-note'] = rewriteCommand;
        this.commands['batch-rewrite-notes'] = batchRewriteCommand;
    
       // 注册所有命令到 Obsidian
    const allCommands = [
        markdownCommand,
        pdfCommand,
        batchCommand,
        summaryCommand,  // 添加新命令
        metadataCommand,
        batchMetadataCommand,
        rewriteCommand,
        batchRewriteCommand
    ];

    allCommands.forEach(command => this.addCommand(command));
    }

    
    private registerEventHandlers() {
        console.debug('注册事件处理器');

        // 当活动叶子改变时
        this.registerEvent(
            this.app.workspace.on('active-leaf-change', (leaf) => {
                console.debug('活动叶子改变:', leaf?.view?.getViewType());
                if (!leaf?.view) return;
                
                if (isPdfView(leaf.view)) {
                    console.debug('检测到新的 PDF 视图，设置处理器');
                    // 延迟设置处理器，确保 PDF 视图完全加载
                    setTimeout(() => {
                        this.pdfService.setupPdfSelectionHandler(leaf.view);
                    }, 500);
                }
            })
        );

        // 当文件打开时
        this.registerEvent(
            this.app.workspace.on('file-open', (file) => {
                console.debug('文件打开:', file?.extension);
                if (!file || file.extension !== 'pdf') return;

                const view = this.app.workspace.getActiveViewOfType(View);
                if (view && isPdfView(view)) {
                    console.debug('PDF 文件打开，设置处理器');
                    // 延迟设置处理器，确保 PDF 视图完全加载
                    setTimeout(() => {
                        this.pdfService.setupPdfSelectionHandler(view);
                    }, 500);
                }
            })
        );

        // 监听布局变化
        this.registerEvent(
            this.app.workspace.on('layout-change', () => {
                console.debug('布局改变');
                const activeView = this.app.workspace.getActiveViewOfType(View);
                if (activeView && isPdfView(activeView)) {
                    console.debug('布局改变，重新设置 PDF 处理器');
                    this.pdfService.setupPdfSelectionHandler(activeView);
                }
            })
        );
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    /**
     * 确认批量处理
     */
    private async confirmBatchProcess(fileCount: number): Promise<boolean> {
        return new Promise((resolve) => {
            const notice = new Notice(
                `确认处理 ${fileCount} 个文件？\n这可能需要一些时间。`,
                0
            );
            
            notice.noticeEl.createEl('button', {
                text: '确认',
                cls: 'mod-cta'
            }).onclick = () => {
                notice.hide();
                resolve(true);
            };

            notice.noticeEl.createEl('button', {
                text: '取消'
            }).onclick = () => {
                notice.hide();
                resolve(false);
            };
        });
    }

    /**
     * 更新设置
     */
    async updateSettings(updates: Partial<PluginSettings>) {
        this.settings = {
            ...this.settings,
            ...updates
        };
        await this.saveSettings();
    }



    onunload() {
        console.debug('正在卸载 AI Smart Extract Plugin');
        this.pdfService.cleanup();
    }
}
