// src/main.ts
import { App, Plugin, Notice, MarkdownView, View } from 'obsidian';
import { PluginSettings } from './types';
import { DEFAULT_SETTINGS } from './settings/settings';
import { AISmartExtractSettingTab } from './settings/settingTab';
import { NoteService } from './services/noteService';
import { PDFService } from './services/pdfService';
import { QueueService } from './services/queueService';
import { isPdfView } from './utils/helpers';
import { AIService } from './services/aiService';

export default class AISmartExtractPlugin extends Plugin {
    settings: PluginSettings;
    private noteService: NoteService;
    private pdfService: PDFService;
    private aiService: AIService;
    private queueService: QueueService;

    async onload() {
        console.debug('AI Smart Extract Plugin 正在加载...');
        await this.loadSettings();

        // 初始化服务
        this.aiService = new AIService(this.settings);
        this.noteService = new NoteService(this.app, this.settings);
        this.queueService = new QueueService();
        this.pdfService = new PDFService(
            this.app,
            this.noteService,
            this.aiService
        );

        // 添加设置标签页
        this.addSettingTab(new AISmartExtractSettingTab(this.app, this));

        // 添加命令
        this.addCommands();
        
        // 注册事件监听器
        this.registerEventHandlers();

        // 为现有打开的 PDF 视图设置处理器
        this.setupExistingPdfViews();

        console.debug('AI Smart Extract Plugin 加载完成');
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
        this.addCommand({
            id: 'create-smart-note-from-markdown',
            name: '从Markdown选中文本创建智能笔记',
            editorCallback: (editor, view: MarkdownView) => {
                const selectedText = editor.getSelection();
                if (!selectedText) {
                    new Notice('请先选择一段文本');
                    return;
                }

                this.queueService.addTask(
                    async () => await this.noteService.createFromMarkdown(selectedText, view),
                    () => new Notice('笔记创建成功！'),
                    (error) => new Notice('处理失败: ' + error.message)
                );
            }
        });

        this.addCommand({
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
        
                this.queueService.addTask(
                    async () => await this.pdfService.handlePdfSelection(activeView),
                    undefined,
                    (error) => new Notice('处理PDF选择时出错: ' + error.message)
                );
                
                return true;
            }
        });
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

    onunload() {
        console.debug('正在卸载 AI Smart Extract Plugin');
        this.pdfService.cleanup();
    }
}
