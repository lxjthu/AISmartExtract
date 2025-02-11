// src/services/pdfService.ts
import { App, View, TFile, Notice, MarkdownView } from 'obsidian';
import { EmbeddedPDFView, PdfSelection } from '../types';
import { cleanPdfText } from '../utils/textCleaner';
import { NoteService } from './noteService';
import { AIServiceImpl } from './aiService';

export class PDFService {
    private selectionHandlers: WeakMap<View, () => void> = new WeakMap();
    // 添加一个额外的 Set 来跟踪视图
    private activeViews: Set<View> = new Set();

    constructor(
        private app: App,
        private noteService: NoteService,
        private aiService: AIServiceImpl
    ) {}

    async handlePdfSelection(view: EmbeddedPDFView) {
        console.debug('处理 PDF 选择');
        try {
            const selection = await this.getPdfSelection(view);
            if (!selection) {
                new Notice('请先在PDF中选择文本');
                return;
            }

            new Notice('正在处理选中文本...');
            const cleanedText = cleanPdfText(selection.text);
            
            await this.noteService.createFromMarkdown(
                cleanedText,                          // 第一个参数：清理后的文本
                view as unknown as MarkdownView,      // 第二个参数：视图
                undefined,                            // 第三个参数：模板ID（如果不需要可以传undefined）
                selection                            // 第四个参数：PDF选择信息
            );

            new Notice('笔记创建成功！');
        } catch (error) {
            console.error('处理PDF选择时出错:', error);
            new Notice(`处理失败: ${error.message}`);
        }
    }

    setupPdfSelectionHandler(view: View) {
        console.debug('设置 PDF 选择处理器');
        
        if (!this.isPdfView(view)) {
            console.debug('不是 PDF 视图，跳过');
            return;
        }
    
        const pdfView = view as EmbeddedPDFView;
        
        // 移除旧的处理器
        this.removeSelectionHandler(view);
    
        // 只保存选择的文本，不自动处理
        const handleSelection = () => {
            // 这里不再自动触发处理，只在需要时通过命令调用 handlePdfSelection
            console.debug('文本已选择');
        };
    
        // 只监听选择事件，不再自动处理
        pdfView.containerEl.addEventListener('mouseup', handleSelection);
        pdfView.containerEl.addEventListener('keyup', handleSelection);
    
        // 保存清理函数
        this.selectionHandlers.set(view, () => {
            pdfView.containerEl.removeEventListener('mouseup', handleSelection);
            pdfView.containerEl.removeEventListener('keyup', handleSelection);
        });
    
        // 添加到活动视图集合
        this.activeViews.add(view);
        
        console.debug('PDF 选择处理器设置完成');
    }
    

    private setupSelectionChangeListener(view: EmbeddedPDFView) {
        const handler = () => {
            const selection = window.getSelection();
            if (selection?.isCollapsed) {
                console.debug("PDF 选择已取消");
            }
        };
    
        document.addEventListener('selectionchange', handler);
        
        // 将清理函数添加到现有的处理器中
        const existingCleanup = this.selectionHandlers.get(view);
        this.selectionHandlers.set(view, () => {
            existingCleanup?.();
            document.removeEventListener('selectionchange', handler);
        });
    }
    
    

    private async waitForPdfViewer(view: EmbeddedPDFView): Promise<void> {
        return new Promise((resolve, reject) => {
            // 增加等待时间，每次检查间隔增加
            const maxAttempts = 100; // 增加最大尝试次数
            const baseDelay = 50; // 基础延迟时间（毫秒）
            let attempts = 0;

            const check = () => {
                // 增加更详细的检查逻辑
                if (view?.viewer?.pdfViewer) {
                    const pdfViewer = view.viewer.pdfViewer;
                    
                    // 检查必要的属性是否已初始化
                    if (typeof pdfViewer.currentScale === 'number' && 
                        typeof pdfViewer.currentPageNumber === 'number' && 
                        typeof pdfViewer.pagesCount === 'number' &&
                        typeof pdfViewer.getSelectedText === 'function') {
                        
                        console.debug('PDF 查看器初始化成功', {
                            scale: pdfViewer.currentScale,
                            page: pdfViewer.currentPageNumber,
                            totalPages: pdfViewer.pagesCount
                        });
                        
                        resolve();
                        return;
                    }
                }

                attempts++;
                if (attempts >= maxAttempts) {
                    console.error('PDF 查看器初始化检查失败', {
                        attempts,
                        viewerExists: !!view?.viewer,
                        pdfViewerExists: !!view?.viewer?.pdfViewer,
                        properties: view?.viewer?.pdfViewer ? {
                            hasScale: 'currentScale' in view.viewer.pdfViewer,
                            hasPageNumber: 'currentPageNumber' in view.viewer.pdfViewer,
                            hasPagesCount: 'pagesCount' in view.viewer.pdfViewer,
                            hasGetSelectedText: 'getSelectedText' in view.viewer.pdfViewer
                        } : null
                    });
                    
                    reject(new Error('PDF 查看器初始化超时'));
                    return;
                }

                // 使用递增的延迟时间
                const delay = baseDelay * Math.pow(1.1, attempts);
                setTimeout(check, delay);
            };

            check();
        });
    }

    private isPdfViewerReady(view: EmbeddedPDFView): boolean {
        const pdfViewer = view?.viewer?.pdfViewer;
        return !!(pdfViewer?.currentScale && 
                 pdfViewer?.currentPageNumber && 
                 pdfViewer?.pagesCount && 
                 typeof pdfViewer?.getSelectedText === 'function');
    }

    private isPdfView(view: View): boolean {
        return view.getViewType() === 'pdf';
    }

    private async getPdfSelection(view: EmbeddedPDFView): Promise<PdfSelection | null> {
        try {
            // 使用 window.getSelection() 替代 pdfViewer.getSelectedText()
            const selection = window.getSelection();
            const selectedText = selection?.toString().trim();
            
            if (!selectedText) {
                return null;
            }
    
            // 获取选区位置信息
            const range = selection?.getRangeAt(0);
            const rect = range?.getBoundingClientRect();
    
            const pdfViewer = view.viewer?.pdfViewer;
            
            const selectionInfo: PdfSelection = {
                text: selectedText,
                fileName: view.file.name,
                pageNumber: pdfViewer?.currentPageNumber || 1,
                relativePosition: {
                    top: rect?.top || 0,
                    left: rect?.left || 0,
                    width: rect?.width || 0,
                    height: rect?.height || 0
                },
                pdfViewerState: {
                    currentScale: pdfViewer?.currentScale || 1,
                    currentPageNumber: pdfViewer?.currentPageNumber || 1,
                    pagesCount: pdfViewer?.pagesCount || 1,
                },
                timestamp: new Date().toISOString()
            };
    
            return selectionInfo;
        } catch (error) {
            console.error('获取 PDF 选择时出错:', error);
            return null;
        }
    }
    

    removeSelectionHandler(view: View) {
        const cleanup = this.selectionHandlers.get(view);
        if (cleanup) {
            cleanup();
            this.selectionHandlers.delete(view);
            this.activeViews.delete(view);
        }
    }

    cleanup() {
       // 使用 Set 进行遍历
       for (const view of this.activeViews) {
        this.removeSelectionHandler(view);
    }
    this.activeViews.clear();
    }
}
