// src/main.ts
import { App, Plugin, Notice, MarkdownView, View } from 'obsidian';
import { ExtendedCommand,PluginSettings } from './types';
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

export default class AISmartExtractPlugin extends Plugin {
    settings: PluginSettings;
    private noteService: NoteService;
    private pdfService: PDFService;
    private aiService: AIServiceImpl;
    private queueService: QueueService;
    private batchTagService: BatchTagService;
    private batchProcessor: BatchProcessor;
    public commands: { [key: string]: ExtendedCommand } = {};



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
        this.batchTagService = new BatchTagService(this.app, this.settings);
        this.batchProcessor = new BatchProcessor(
            this.queueService,
            this.batchTagService,
            this.settings
        );

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
                        templateId  // 传递模板ID
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
                        activeView,
                        
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
    
        // 存储命令到插件实例中
        this.commands['create-smart-note-from-markdown'] = markdownCommand;
        this.commands['create-smart-note-from-pdf'] = pdfCommand;
        this.commands['batch-process-folder'] = batchCommand;
    
        // 注册命令到 Obsidian
        this.addCommand(markdownCommand);
        this.addCommand(pdfCommand);
        this.addCommand(batchCommand);
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
