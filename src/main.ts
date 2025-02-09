import {App, Plugin, PluginSettingTab, Setting, TFolder, TFile, MarkdownView, Notice, SuggestModal, requestUrl, Vault, WorkspaceLeaf, View, Menu} from 'obsidian';

// ===== 工具函数区域 =====
/**
 * 防抖函数
 * @param func 需要防抖的函数
 * @param wait 等待时间（毫秒）
 */
function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;
    
    return (...args: Parameters<T>) => {
        if (timeout) {
            clearTimeout(timeout);
        }
        
        timeout = setTimeout(() => {
            timeout = null;
            func(...args);
        }, wait);
    };
}


// 工具函数
/**
 * 清理PDF文本
 * @param text 原始文本
 */
function cleanPdfText(text: string): string {
    if (!text) return '';
    
    // 基础清理
    let cleaned = text
        .replace(/\s+/g, ' ')           // 合并多个空格
        .replace(/[\r\n]+/g, ' ')       // 移除换行
        .replace(/[\x00-\x1F\x7F-\x9F\uFFF0-\uFFFF]/g, '')  // 移除控制字符
        .replace(/[""'']/g, '"')        // 统一引号
        .replace(/[–—]/g, '-')          // 统一破折号
        .replace(/\u2013|\u2014/g, '-') // 统一 en-dash 和 em-dash
        .replace(/\u2026/g, '...')      // 替换省略号
        .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')  // 统一双引号
        .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")  // 统一单引号
        .replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000]/g, ' ')  // 统一空格
        .trim();

    return formatMixedText(cleaned);
}

/**
 * 格式化中英文混排文本
 * @param text 清理后的文本
 */
function formatMixedText(text: string): string {
    // 判断字符是否为 CJK（中日韩）字符
    const isCJK = (char: string): boolean => {
        return /[\u4E00-\u9FFF\u3400-\u4DBF\u20000-\u2A6DF\u2A700-\u2B73F\u2B740-\u2B81F\u2B820-\u2CEAF\u2CEB0-\u2EBEF\u30000-\u3134F\uF900-\uFAFF\u2F800-\u2FA1F\u3040-\u309F\u30A0-\u30FF\u3100-\u312F\u31F0-\u31FF\uAC00-\uD7AF]/.test(char);
    };

    // 判断字符是否为英文字母或数字
    const isEnglishChar = (char: string): boolean => {
        return /[a-zA-Z0-9]/.test(char);
    };

    let result = '';
    let lastCharType: 'cjk' | 'english' | 'other' | null = null;
    
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        let currentCharType: 'cjk' | 'english' | 'other';

        if (isCJK(char)) {
            currentCharType = 'cjk';
        } else if (isEnglishChar(char)) {
            currentCharType = 'english';
        } else {
            currentCharType = 'other';
        }

        // 在中文和英文之间添加空格
        if (lastCharType && lastCharType !== currentCharType) {
            if ((lastCharType === 'cjk' && currentCharType === 'english') ||
                (lastCharType === 'english' && currentCharType === 'cjk')) {
                result += ' ';
            }
        }

        result += char;
        lastCharType = currentCharType;
    }

    return result;
}

interface PdfSelection {
    text: string;
    pageNumber: number;
    fileName: string;
    timestamp: string;
}

interface EmbeddedPDFView extends View {
    file: TFile;
    containerEl: HTMLElement;
    selectionHandler?: (event: Event) => void;
    viewer: {
        pdfViewer: {
            currentScale: number;
            currentPageNumber: number;
            pagesCount: number;
            getSelectedText(): string;
        };
    };
}


// 定义 AIResponse 接口
interface AIResponse {
    keywords: string[];
    summary: string;
    tags: string[];
}

interface PluginSettings {
    apiKey: string;
    apiEndpoint: string;
    addBacklinks: boolean;           // 是否添加反向链接
    backlinkStyle: 'wiki' | 'ref';   // 链接样式
    addBacklinksSection: boolean;    // 是否添加相关笔记区域
    promptTemplate: string;         // 添加提示词模板设置
    defaultPrompt: string;          // 添加默认提示词设置
    targetFolder: string;          // 添加目标文件夹设置
    quoteCallout: string;     // 引用标注类型，默认为 'cite'
    quoteCollapsible: boolean; // 是否可折叠，默认为 true
    pdfQuoteStyle: 'callout' | 'codeblock';  // PDF引用样式
    pdfPageLink: boolean;                     // 是否添加PDF页面链接
}

const DEFAULT_SETTINGS: PluginSettings = {
    apiKey: '',
    apiEndpoint: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
    addBacklinks: true,
    backlinkStyle: 'wiki',
    addBacklinksSection: true,
    quoteCallout: 'cite',
    quoteCollapsible: true,
    targetFolder: 'Extractcards',         // 默认文件夹名称
    pdfQuoteStyle: 'callout',
    pdfPageLink: true,
    promptTemplate: `请分析以下文本，提供：
    1. 3-5个关键词
    2. 一句话总结（15字以内，不要加句号）
    3. 将关键词转换为3-5个相关标签（每个标签以#开头）
    
    请按照以下格式返回：
    关键词：关键词1，关键词2，关键词3
    总结：一句话总结
    标签：#标签1 #标签2 #标签3
    
    原文：
    {text}`,
        defaultPrompt: `请分析以下文本，提供：
    1. 3-5个关键词
    2. 一句话总结（15字以内，不要加句号）
    3. 将关键词转换为3-5个相关标签（每个标签以#开头）
    
    请按照以下格式返回：
    关键词：关键词1，关键词2，关键词3
    总结：一句话总结
    标签：#标签1 #标签2 #标签3
    
    原文：
    {text}`
}

export default class AISmartExtractPlugin extends Plugin {
    settings: PluginSettings;
    private lastPdfSelection: PdfSelection | null = null;
    private pdfSelectionTimeout: NodeJS.Timeout | null = null;
    

    async onload() {
        
        await this.loadSettings();

        // 添加设置标签页
        this.addSettingTab(new AISmartExtractSettingTab(this.app, this));

        this.addCommand({
            id: 'create-smart-note-from-markdown',  // 修改为与 manifest 一致的 ID
            name: '从Markdown选中文本创建智能笔记',
            editorCallback: async (editor, view) => {
                const selectedText = editor.getSelection();
                if (!selectedText) {
                    new Notice('请先选择一段文本');
                    return;
                }

                try {
                    new Notice('正在处理文本...');
                    const aiResult = await this.processWithAI(selectedText);
                    // 检查 view 是否为 MarkdownView 类型
                    if (view instanceof MarkdownView) {
                        await this.createNewNote(selectedText, aiResult, view);
                        new Notice('笔记创建成功！');
                    } else {
                        new Notice('当前视图不是 MarkdownView，无法创建笔记');
                    }
                } catch (error) {
                    new Notice('处理失败: ' + error.message);
                }
            }
        });

        this.addCommand({
            id: 'create-smart-note-from-pdf',
            name: '从PDF选中文本创建智能笔记',
            checkCallback: (checking: boolean) => {
                // 获取当前活动视图
                const currentView = this.app.workspace.getActiveViewOfType(View);
                
                // 调试日志
                console.log('Active view type:', currentView?.getViewType());
                
                // 使用类型守卫检查是否是PDF视图
                const isPdfView = currentView && this.isPdfView(currentView);
                console.log('Is PDF view:', isPdfView);
        
                // 如果不是PDF视图，返回false
                if (!isPdfView) {
                    return false;
                }
        
                // 如果只是检查命令是否可用，返回true
                if (checking) {
                    return true;
                }
        
                // 实际执行命令
                this.handlePdfSelection(currentView);
                return true;
            }
        });
        
        
         // 添加 PDF 选择监听器
         this.registerEvent(
            this.app.workspace.on('active-leaf-change', (leaf) => {
                console.log('Active leaf changed:', leaf?.view?.getViewType());
                if (!leaf?.view) return;
                if (this.isPdfView(leaf.view)) {
                    console.log('Setting up handlers for new PDF view');
                    this.setupPdfSelectionHandler(leaf.view);
                }
            })
        );

        // 监听文件打开
    this.registerEvent(
        this.app.workspace.on('file-open', (file) => {
            console.log('File opened:', file?.extension);
            if (file?.extension === 'pdf') {
                const view = this.app.workspace.getActiveViewOfType(View);
                if (view && this.isPdfView(view)) {
                    console.log('Setting up handlers for opened PDF');
                    this.setupPdfSelectionHandler(view);
                }
            }
        })
    );

    // 监听布局变化
    this.registerEvent(
        this.app.workspace.on('layout-change', () => {
            console.log('Layout changed');
            const view = this.app.workspace.getActiveViewOfType(View);
            if (view && this.isPdfView(view)) {
                console.log('Setting up handlers after layout change');
                this.setupPdfSelectionHandler(view);
            }
        })
    );

    


        // 注册 PDF 视图的右键菜单
        // 在 onload() 方法中修改菜单注册部分
        this.registerEvent(
            this.app.workspace.on('file-menu', (menu: Menu, file: TFile, source: string, leaf: WorkspaceLeaf) => {
                // 添加调试日志
                console.log('File menu triggered:', {
                    fileType: file?.extension,
                    sourceName: source,
                    viewType: leaf?.view?.getViewType(),
                    hasSelection: this.lastPdfSelection !== null
                });

                // 检查是否是 PDF 文件
                if (file?.extension !== 'pdf') return;

                // 获取当前视图
                const view = leaf?.view;
                if (!view || !this.isPdfView(view)) {
                    console.log('Not a PDF view:', view?.getViewType());
                    return;
                }

                // 检查是否有选中的文本
                if (this.lastPdfSelection && this.lastPdfSelection.text.trim()) {
                    menu.addItem((item) => {
                        item
                            .setTitle('创建智能提取卡片')
                            .setIcon('create-note')
                            .onClick(async () => {
                                try {
                                    const pdfView = view as EmbeddedPDFView;
                                    await this.handlePdfSelection(pdfView);
                                } catch (error) {
                                    console.error('处理PDF选择时出错:', error);
                                    new Notice('处理PDF选择时出错: ' + error.message);
                                }
                            });
                    });
                }
            })
        );

        
        



        // 为当前打开的 PDF 添加监听器
        const currentView = this.app.workspace.getActiveViewOfType(View);
    if (currentView && this.isPdfView(currentView)) {
        console.log('Setting up handlers for initial view');
        this.setupPdfSelectionHandler(currentView);
    }

        // 修改命令注册
        this.addCommand({
            id: 'create-smart-note-from-pdf',
            name: '从PDF选中文本创建智能笔记',
            checkCallback: (checking: boolean) => {
                const activeLeaf = this.app.workspace.activeLeaf;
                if (!activeLeaf) return false;

                const isPDF = activeLeaf.view?.getViewType() === 'pdf';
                
                // 如果不是 PDF 视图，返回 false
                if (!isPDF) return false;

                // 检查是否有保存的选择文本
                if (checking) {
                    return !!this.getPdfSelection;
                }

                // 执行命令
                this.handlePdfSelection(activeLeaf.view as EmbeddedPDFView);
                return true;
            }
        });

    }

    private handleContextMenu = (event: MouseEvent) => {
        // 获取当前活动视图
        const view = this.app.workspace.getActiveViewOfType(View);
        if (!view || !this.isPdfView(view)) return;
    
        // 检查是否有有效的选中文本
        if (!this.lastPdfSelection || !this.lastPdfSelection.text.trim()) {
            return; // 如果没有选中文本，只显示默认菜单
        }
    
        // 等待默认菜单创建完成
        setTimeout(() => {
            // 创建新的菜单
            const menu = new Menu();  // 移除 this.app 参数
            
            // 添加我们的自定义菜单项
            menu.addItem((item) => {
                item
                    .setTitle('创建智能提取卡片')
                    .setIcon('create-note')
                    .onClick(async () => {
                        try {
                            await this.handlePdfSelection(view as EmbeddedPDFView);
                        } catch (error) {
                            console.error('处理PDF选择时出错:', error);
                            new Notice('处理PDF选择时出错: ' + error.message);
                        }
                    });
            });
    
            // 在鼠标位置显示菜单
            menu.showAtPosition({ x: event.pageX, y: event.pageY });
        }, 50);
    };
    
    
    
    private setupPdfSelectionHandler(view: EmbeddedPDFView) {
        if (!view || !view.containerEl) {
            console.log('Invalid view or container element');
            return;
        }
    
        const pdfContainer = view.containerEl;
    
        // 修改右键菜单处理函数
        const handleContextMenu = (event: MouseEvent) => {
            console.log('Context menu event triggered:', {
                type: event.type,
                target: event.target,
                currentTarget: event.currentTarget,
                path: event.composedPath(),
                button: event.button,
                buttons: event.buttons,
                clientX: event.clientX,
                clientY: event.clientY
            });
    
            // 获取当前选中的文本
            const hasSelection = this.lastPdfSelection && this.lastPdfSelection.text.trim();
    
            // 触发 Obsidian 的文件菜单事件，但添加我们的自定义选项
            this.app.workspace.trigger('file-menu', (menu: Menu) => {
                // 只有在有选中文本时才添加我们的菜单项
                if (hasSelection) {
                    // 添加分隔线
                    menu.addSeparator();
                    
                    // 添加我们的自定义选项
                    menu.addItem((item) => {
                        item
                            .setTitle('创建智能提取卡片')
                            .setIcon('create-note')
                            .onClick(async () => {
                                try {
                                    await this.handlePdfSelection(view);
                                } catch (error) {
                                    console.error('处理PDF选择时出错:', error);
                                    new Notice('处理PDF选择时出错: ' + error.message);
                                }
                            });
                    });
                }
            }, event);
        };
    
        // 移除之前的事件监听器
        if (view.selectionHandler) {
            pdfContainer.removeEventListener('mouseup', view.selectionHandler);
            pdfContainer.removeEventListener('keyup', view.selectionHandler);
            document.removeEventListener('selectionchange', view.selectionHandler);
        }
    
        // 设置选择文本的处理函数
        view.selectionHandler = debounce(async (event: Event) => {
            console.log('Selection event triggered:', event.type);
            const selection = await this.getPdfSelection();
            if (selection) {
                console.log('New PDF selection detected:', selection);
                this.lastPdfSelection = selection;
            }
        }, 300);
    
        // 添加事件监听器
        pdfContainer.addEventListener('contextmenu', handleContextMenu, false);
        pdfContainer.addEventListener('mouseup', view.selectionHandler);
        pdfContainer.addEventListener('keyup', view.selectionHandler);
        document.addEventListener('selectionchange', view.selectionHandler);
    }
    
    
    
    

    
    
    
    


    private handlePdfMouseUp = async (event: MouseEvent) => {
        await this.savePdfSelection();
    }

    private handlePdfKeyUp = async (event: KeyboardEvent) => {
        // 处理键盘选择（比如 Shift + 方向键）
        await this.savePdfSelection();
    }

    private async savePdfSelection() {
        const currentView = this.app.workspace.getActiveViewOfType(View);
        if (!currentView || !this.isPdfView(currentView)) return;
    
        try {
            const pdfView = currentView as EmbeddedPDFView;
            const selection = pdfView.viewer?.pdfViewer?.getSelectedText();
            console.log('Got PDF selection text:', selection); // 添加调试日志
    
            if (selection && selection.trim()) {
                const cleanedText = this.cleanPdfText(selection);
                if (cleanedText) {
                    this.lastPdfSelection = {
                        text: cleanedText,
                        pageNumber: pdfView.viewer?.pdfViewer?.currentPageNumber || 1,
                        fileName: currentView.file?.name || 'unknown',
                        timestamp: new Date().toISOString()
                    };
                    console.log('PDF selection saved:', this.lastPdfSelection);
                }
            } else {
                // 如果没有选中文本，清除上一次的选择
                this.lastPdfSelection = null;
                console.log('No text selected, cleared lastPdfSelection');
            }
        } catch (error) {
            console.error('Error saving PDF selection:', error);
            this.lastPdfSelection = null;
        }
    }
    
    
    // 添加获取当前页码的辅助方法
    private getCurrentPageNumber(pdfView: EmbeddedPDFView): number {
        try {
            // 尝试从 PDF 查看器获取当前页码
            const currentPage = pdfView.viewer?.pdfViewer?.currentPageNumber || 1;
            return currentPage;
        } catch (error) {
            console.error('Error getting current page number:', error);
            return 1; // 如果获取失败，返回默认值 1
        }
    }
    
    
    
    
    

    private cleanPdfText(text: string): string {
        if (!text) return '';
        
        // 基础清理
        let cleaned = text
            // 替换多个连续空格为单个空格
            .replace(/\s+/g, ' ')
            // 替换所有换行符为空格
            .replace(/[\r\n]+/g, ' ')
            // 移除不可打印字符和特殊Unicode字符
            .replace(/[\x00-\x1F\x7F-\x9F\uFFF0-\uFFFF]/g, '')
            // 移除常见的PDF乱码字符
            .replace(/[""'']/g, '"')
            .replace(/[–—]/g, '-')
            // 处理特殊的破折号和其他特殊字符
            .replace(/\u2013|\u2014/g, '-')
            // 处理特殊的省略号
            .replace(/\u2026/g, '...')
            // 处理特殊的引号
            .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
            // 处理特殊的撇号
            .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
            // 处理其他可能的特殊空格
            .replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
            // 移除开头和结尾的空格
            .trim();

        // 处理中英文混排
        cleaned = this.formatMixedText(cleaned);

        return cleaned;
    }

    private formatMixedText(text: string): string {
        const isCJK = (char: string): boolean => {
            return /[\u4E00-\u9FFF\u3400-\u4DBF\u20000-\u2A6DF\u2A700-\u2B73F\u2B740-\u2B81F\u2B820-\u2CEAF\u2CEB0-\u2EBEF\u30000-\u3134F\uF900-\uFAFF\u2F800-\u2FA1F\u3040-\u309F\u30A0-\u30FF\u3100-\u312F\u31F0-\u31FF\uAC00-\uD7AF]/.test(char);
        };

        const isEnglishChar = (char: string): boolean => {
            return /[a-zA-Z0-9]/.test(char);
        };

        let result = '';
        let lastCharType: 'cjk' | 'english' | 'other' | null = null;
        
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            let currentCharType: 'cjk' | 'english' | 'other';

            if (isCJK(char)) {
                currentCharType = 'cjk';
            } else if (isEnglishChar(char)) {
                currentCharType = 'english';
            } else {
                currentCharType = 'other';
            }

            // 处理空格
            if (i > 0) {
                const needSpace = 
                    // 英文和英文之间需要空格
                    (lastCharType === 'english' && currentCharType === 'english') ||
                    // 中文和英文之间需要空格
                    (lastCharType === 'cjk' && currentCharType === 'english') ||
                    (lastCharType === 'english' && currentCharType === 'cjk');

                if (needSpace && !text[i-1].match(/\s/)) {
                    result += ' ';
                }
            }

            result += char;
            lastCharType = currentCharType;
        }

        return result;
    }


    private async handlePdfSelection(pdfView: EmbeddedPDFView) {
        try {
            const selection = await this.getPdfSelection();
            if (!selection) {
                new Notice('请先在PDF中选择文本');
                return;
            }
    
            new Notice('正在处理PDF文本...');
            const aiResult = await this.processWithAI(selection.text); // 使用 selection.text
            
            // 创建新笔记
            await this.createNewNoteFromPdf(
                selection.text,
                aiResult,
                selection.fileName,
                selection.pageNumber
            );
            
            new Notice('笔记创建成功！');
        } catch (error) {
            console.error('PDF处理错误:', error);
            new Notice('处理PDF文本失败: ' + error.message);
        }
    }
    
    
    
    


        // 新增方法：检查是否是嵌入的 PDF 视图
        private isEmbeddedPdfView(view: View | null): boolean {
            if (!view) return false;
            
            // 检查是否是 markdown 视图
            if (view.getViewType() === 'markdown') {
                // 获取当前编辑器中的嵌入式 PDF
                const markdownView = view as MarkdownView;
                const editor = markdownView.editor;
                
                // 检查是否有嵌入的 PDF iframe
                const pdfIframe = markdownView.containerEl.querySelector('iframe[src*=".pdf"]');
                return !!pdfIframe;
            }
            
            // 检查是否是独立的 PDF 视图
            return view.getViewType() === 'pdf';
        }
        // 类型守卫函数
        private isPdfView(view: View | null): view is EmbeddedPDFView {
            if (!view) return false;
            return view.getViewType() === 'pdf' && 'viewer' in view;
        }
        
        




    // 获取PDF中选中的文本
    private async getPdfSelection(): Promise<PdfSelection | null> {
        console.log('Getting PDF selection...');
        
        const selection = window.getSelection();
        if (!selection) {
            console.log('No window selection found');
            return null;
        }
        
        const text = selection.toString().trim();
        if (!text) {
            console.log('No text in selection');
            return null;
        }
        
        console.log('Selected text:', text);
        
        try {
            const currentView = this.app.workspace.getActiveViewOfType(View);
            if (!currentView || !this.isPdfView(currentView)) {
                console.log('Not in PDF view:', currentView?.getViewType());
                return null;
            }
            
            const pdfView = currentView as EmbeddedPDFView;
            const pageNumber = pdfView.viewer?.pdfViewer?.currentPageNumber || 1;
            
            const pdfSelection: PdfSelection = {
                text: this.cleanPdfText(text),
                pageNumber: pageNumber,
                fileName: currentView.file.name,
                timestamp: new Date().toISOString()
            };
            
            console.log('Created PDF selection object:', pdfSelection);
            return pdfSelection;
        } catch (error) {
            console.error('Error getting PDF selection:', error);
            return null;
        }
    }
    
    
    
    

    // 从PDF创建新笔记的方法
    private async createNewNoteFromPdf(
        originalText: string,
        aiResult: AIResponse,
        fileName: string,
        pageNumber: number
    ) {
        try {
            // 确保目标文件夹存在
            const folderPath = this.settings.targetFolder;
            await this.ensureFolder(folderPath);
    
            // 生成新笔记的文件名
            const newFileName = `${folderPath}/${aiResult.summary}.md`;
    
            // 构建笔记内容，添加PDF源文件信息
            const noteContent = this.buildPdfNoteContent(
                originalText,
                aiResult,
                fileName,
                pageNumber
            );
    
            // 创建新笔记
            const newFile = await this.app.vault.create(newFileName, noteContent);
    
            // 添加PDF反向引用（如果启用）
            if (this.settings.addBacklinks) {
                await this.addPdfBacklink(newFile, fileName);
            }
    
            // 打开新创建的笔记
            const leaf = this.app.workspace.getLeaf(false);
            await leaf.openFile(newFile);
    
        } catch (error) {
            throw new Error('创建PDF笔记失败: ' + error.message);
        }
    }
    

    // 构建PDF笔记内容的方法
    private buildPdfNoteContent(
        originalText: string,
        aiResult: AIResponse,
        pdfFileName: string,
        pageNumber: number
    ): string {
        // 构建YAML frontmatter
        const frontmatter = [
            '---',
            `title: ${aiResult.summary}`,
            `keywords: ${aiResult.keywords.join(', ')}`,
            `tags:`,
            ...aiResult.tags.map(tag => `  - ${tag.startsWith('#') ? tag.substring(1) : tag}`),
            `created: ${new Date().toISOString()}`,
            `source: ${pdfFileName}`,
            `page: ${pageNumber}`,
            'type: pdf-extract',
            '---',
            ''
        ].join('\n');
    
        // 根据设置选择引用样式
        let quoteBlock;
        if (this.settings.pdfQuoteStyle === 'callout') {
            const collapsible = this.settings.quoteCollapsible ? '+' : '';
            const callout = this.settings.quoteCallout || 'cite';
            quoteBlock = [
                `> [!${callout}]${collapsible} 引用`,
                originalText.split('\n').map(line => `> ${line}`).join('\n')
            ].join('\n');
        } else {
            quoteBlock = [
                '```pdf-quote',
                originalText,
                '```'
            ].join('\n');
        }
    
        // 构建页面链接
        const pageLink = this.settings.pdfPageLink 
            ? `\n\nSource: [[${pdfFileName}]] (p.${pageNumber})`
            : '';
    
        // 组合完整内容
        return [
            frontmatter,
            '## 原文引用',
            quoteBlock,
            pageLink,
            '',
            '## 关键词',
            aiResult.keywords.map(kw => `- ${kw}`).join('\n'),
            '',
            '## 标签',
            aiResult.tags.join(' ')
        ].join('\n');
    }
    

    // 添加PDF反向链接的方法
    private async addPdfBacklink(newNoteFile: TFile, pdfFileName: string) {
        try {
            // 检查是否存在对应的markdown笔记
            const pdfNotePath = pdfFileName.replace('.pdf', '.md');
            const pdfNote = this.app.vault.getAbstractFileByPath(pdfNotePath);
    
            if (pdfNote instanceof TFile) {
                // 如果存在对应的markdown笔记，添加反向链接
                const originalContent = await this.app.vault.read(pdfNote);
                let newContent = originalContent;
    
                // 添加相关笔记区域
                if (this.settings.addBacklinksSection) {
                    const backlinksHeader = '## 相关笔记';
                    const newBacklink = `- [[${newNoteFile.basename}]]`;
    
                    if (!newContent.includes(backlinksHeader)) {
                        newContent += `\n\n${backlinksHeader}\n${newBacklink}\n`;
                    } else {
                        const sections = newContent.split(backlinksHeader);
                        const existingBacklinks = sections[1].trim();
                        
                        if (!existingBacklinks.includes(`[[${newNoteFile.basename}]]`)) {
                            newContent = `${sections[0]}${backlinksHeader}\n${existingBacklinks}\n${newBacklink}\n`;
                        }
                    }
    
                    await this.app.vault.modify(pdfNote, newContent);
                }
            }
        } catch (error) {
            console.error('添加PDF反向链接失败:', error);
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async processWithAI(text: string): Promise<AIResponse> {
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

            // 解析AI响应
            const aiResponse = response.json;
            if (aiResponse.output && aiResponse.output.text) {
                const text = aiResponse.output.text;
                
                // 解析返回的文本
                const keywordsMatch = text.match(/关键词：(.*)/);
                const summaryMatch = text.match(/总结：(.*)/);
                const tagsMatch = text.match(/标签：(.*?)(?=\n|$)/);

                if (!keywordsMatch || !summaryMatch || !tagsMatch) {
                    console.error('AI返回内容:', text); // 添加日志输出
                    throw new Error('AI返回格式不正确');
                }

                const keywords = keywordsMatch[1].split('，').map((k: string) => k.trim());
                const summary = summaryMatch[1].trim().replace(/。$/, ''); // 移除末尾的句号
                const tags = tagsMatch[1].trim().split(/\s+/).filter((tag: string) => tag.startsWith('#'));

                return {
                    keywords: keywords,
                    summary: summary,
                    tags: tags
                };
            }
            console.error('AI返回内容:', text); // 添加日志输出
            throw new Error('AI返回格式不正确');
        } catch (error) {
            console.error('AI处理错误:', error);
            throw new Error('AI处理失败: ' + (error.message || '未知错误'));
        }

    }

    async createNewNote(originalText: string, aiResult: AIResponse, view: MarkdownView) {
        const currentFile = view.file;
        if (!currentFile) return;

        

        try {
            // 确保目标文件夹存在
            const folderPath = this.settings.targetFolder;
            await this.ensureFolder(folderPath);

            // 生成新笔记的文件名（使用总结作为标题）
            const newFileName =`${folderPath}/${aiResult.summary}.md.md`;
        
        // 构建笔记内容
            const noteContent = this.buildNoteContent(
            originalText,
            aiResult,
            currentFile.basename
            );


            // 创建新笔记
            const newFile = await this.app.vault.create(newFileName, noteContent);
            
            // 在原文添加反向链接
            if (this.settings.addBacklinks) {
                await this.addBacklink(currentFile, newFile.basename, view);
            }
            // 打开新创建的笔记
            const leaf = this.app.workspace.getLeaf(false);
            await leaf.openFile(newFile);
            
            new Notice('笔记创建成功！');
        } catch (error) {
            new Notice('创建笔记失败: ' + error.message);
            console.error('创建笔记失败:', error);
        }
    }
// 添加确保文件夹存在的函数
async ensureFolder(folderPath: string): Promise<void> {
    if (!folderPath) return;

    const folders = folderPath.split('/').filter(p => p.length > 0);
    let currentPath = '';

    for (const folder of folders) {
        currentPath = currentPath ? `${currentPath}/${folder}` : folder;
        if (!(await this.app.vault.adapter.exists(currentPath))) {
            try {
                await this.app.vault.createFolder(currentPath);
            } catch (error) {
                console.error(`创建文件夹失败: ${currentPath}`, error);
                throw new Error(`无法创建文件夹 ${currentPath}: ${error.message}`);
            }
        }
    }
}

// 在主插件类中添加获取完整路径的辅助方法
private getFullPath(fileName: string): string {
    const folder = this.settings.targetFolder.trim();
    if (!folder) return fileName;
    return `${folder}/${fileName}`;
}

    private buildNoteContent(
        originalText: string,
        aiResult: AIResponse,
        originalFileName: string
    ): string {
        // 构建YAML frontmatter
        const frontmatter = [
            '---',
            `title: ${aiResult.summary}`,
            `keywords: ${aiResult.keywords.join(', ')}`,
            `tags:`,
        aiResult.tags.map(tag => `  - ${tag.startsWith('#') ? tag.substring(1) : tag}`).join('\n'),
            'created: ' + new Date().toISOString(),
            `source: ${originalFileName}`,
            '---',
            '',
            `source: [[${originalFileName}]]`,
        ].join('\n');

        // 构建笔记主体
        const content = [
            frontmatter,
            originalText,
            '',
            '## 关键词',
            aiResult.keywords.map((kw: string) => `- ${kw}`).join('\n'),
            '',
            '## 标签',
            aiResult.tags.join(' '),
        ].join('\n');


        return content;
    }

    private async addBacklink(
        originalFile: TFile,
        newNoteTitle: string,
        view: MarkdownView
    ) {
        try {
            // 获取原文件内容
            const originalContent = await this.app.vault.read(originalFile);
            const selectedText = view.editor.getSelection();
            
            let newContent = originalContent;
            
            if (this.settings.backlinkStyle === 'wiki') {
                // Wiki 链接样式
                const linkedText = `${selectedText} [[${newNoteTitle}]]`;
                newContent = originalContent.replace(selectedText, linkedText);
            } else {
                // 引用链接样式
                // 构建引用标题
                const collapsible = this.settings.quoteCollapsible ? '+' : '';
                const callout = this.settings.quoteCallout || 'cite';
                const quoteTitle = `> [!${callout}]${collapsible} [[${newNoteTitle}]]`;
                
                // 确保选中文本前后有空行
                const quotedText = selectedText.split('\n')
                    .map(line => `> ${line}`)
                    .join('\n');
                    
                // 构建引用块
                const quoteBlock = [
                    '',  // 确保前面有空行
                    quoteTitle,  // 使用构建的引用标题
                    quotedText,
                    ''   // 确保后面有空行
                ].join('\n');
                
                // 替换原文中的选中文本
                newContent = originalContent.replace(selectedText, quoteBlock);
            }
            
            // 添加相关笔记区域（如果启用）
            if (this.settings.addBacklinksSection) {
                const backlinksHeader = '## 相关笔记';
                const newBacklink = `- [[${newNoteTitle}]]`;
                
                if (!newContent.includes(backlinksHeader)) {
                    // 如果不存在相关笔记区域，添加新区域
                    newContent += `\n\n${backlinksHeader}\n${newBacklink}\n`;
                } else {
                    // 如果已存在相关笔记区域，在其下添加新链接
                    const sections = newContent.split(backlinksHeader);
                    const existingBacklinks = sections[1].trim();
                    
                    // 检查链接是否已存在
                    if (!existingBacklinks.includes(`[[${newNoteTitle}]]`)) {
                        newContent = `${sections[0]}${backlinksHeader}\n${existingBacklinks}\n${newBacklink}\n`;
                    }
                }
            }
            
            // 更新文件内容
            await this.app.vault.modify(originalFile, newContent);
            
            // 更新编辑器视图并保持光标位置
            const cursor = view.editor.getCursor();
            view.editor.setValue(newContent);
            view.editor.setCursor(cursor);
            
        } catch (error) {
            new Notice('添加反向链接失败: ' + error.message);
            console.error('添加反向链接失败:', error);
        }
    }
    
    
    
    

    onunload() {
        console.log('卸载插件');
        
        // 清理 lastPdfSelection
        this.lastPdfSelection = null;
        
        // 清理定时器
        if (this.pdfSelectionTimeout) {
            clearTimeout(this.pdfSelectionTimeout);
        }
        
        // 清理所有PDF视图的事件监听器
        this.app.workspace.iterateAllLeaves(leaf => {
            if (leaf.view && this.isPdfView(leaf.view)) {
                const view = leaf.view as EmbeddedPDFView;
                if (view.containerEl && view.selectionHandler) {
                    view.containerEl.removeEventListener('mouseup', view.selectionHandler);
                    view.containerEl.removeEventListener('keyup', view.selectionHandler);
                    document.removeEventListener('selectionchange', view.selectionHandler);
                    view.containerEl.removeEventListener('contextmenu', this.handleContextMenu);
                    delete view.selectionHandler;
                }
            }
        });
    }
    
    
}



class FolderSuggestModal extends SuggestModal<TFolder> {
    constructor(app: App, private callback: (folder: TFolder) => void) {
        super(app);
    }

    // 静态方法：获取所有文件夹路径
    static getAllFolderPathSegments(vault: Vault): string[] {
        const allFiles = vault.getFiles();
        const folderPaths = new Set<string>();

        for (const file of allFiles) {
            const pathParts = file.path.split('/');
            for (let i = 1; i < pathParts.length; i++) {
                folderPaths.add(pathParts.slice(0, i).join('/'));
            }
        }

        return Array.from(folderPaths);
    }

    getSuggestions(inputString: string): TFolder[] {
        // 根据输入字符串筛选文件夹建议
        const folderPaths = FolderSuggestModal.getAllFolderPathSegments(this.app.vault); // 获取所有文件夹路径
        const folders: TFolder[] = [];

        for (const folderPath of folderPaths) {
            const abstractFile = this.app.vault.getAbstractFileByPath(folderPath); // 传递字符串路径
            if (abstractFile instanceof TFolder && folderPath.includes(inputString)) {
                folders.push(abstractFile);
            }
        }

        return folders;
    }

    renderSuggestion(folder: TFolder, el: HTMLElement) {
        // 渲染每个文件夹建议项
        el.setText(folder.path);
    }

    onChooseSuggestion(item: TFolder, evt: MouseEvent | KeyboardEvent) {
        // 处理选择文件夹后的逻辑
        this.callback(item);
        this.close();
    }
}

class AISmartExtractSettingTab extends PluginSettingTab {
    plugin: AISmartExtractPlugin;

    constructor(app: App, plugin: AISmartExtractPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // API 设置
        containerEl.createEl('h3', { text: 'API 设置' });

        new Setting(containerEl)
            .setName('API Key')
            .setDesc('设置阿里云通义千问API Key')
            .addText(text => text
                .setPlaceholder('输入API Key')
                .setValue(this.plugin.settings.apiKey)
                .onChange(async (value) => {
                    this.plugin.settings.apiKey = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('API Endpoint')
            .setDesc('API接口地址')
            .addText(text => text
                .setPlaceholder('输入API地址')
                .setValue(this.plugin.settings.apiEndpoint)
                .onChange(async (value) => {
                    this.plugin.settings.apiEndpoint = value;
                    await this.plugin.saveSettings();
                }));

        // 链接设置
        containerEl.createEl('h3', { text: '链接设置' });

        new Setting(containerEl)
            .setName('添加反向链接')
            .setDesc('在原文中添加指向新笔记的链接')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.addBacklinks)
                .onChange(async (value) => {
                    this.plugin.settings.addBacklinks = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('链接样式')
            .setDesc('选择反向链接的显示样式')
            .addDropdown(dropdown => dropdown
                .addOption('wiki', 'Wiki链接 [[]]')
                .addOption('ref', '引用链接 ^[[]]')
                .setValue(this.plugin.settings.backlinkStyle)
                .onChange(async (value) => {
                    this.plugin.settings.backlinkStyle = value as 'wiki' | 'ref';
                    await this.plugin.saveSettings();
                }));
        new Setting(containerEl)
                .setName('引用标注类型')
                .setDesc('设置引用块的标注类型')
                .addText(text => text
                    .setPlaceholder('cite')
                    .setValue(this.plugin.settings.quoteCallout)
                    .onChange(async (value) => {
                        this.plugin.settings.quoteCallout = value;
                        await this.plugin.saveSettings();
                    }));
            
        new Setting(containerEl)
                .setName('可折叠引用')
                .setDesc('引用块是否可折叠')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.quoteCollapsible)
                    .onChange(async (value) => {
                        this.plugin.settings.quoteCollapsible = value;
                        await this.plugin.saveSettings();
                    }));

        new Setting(containerEl)
            .setName('添加相关笔记区域')
            .setDesc('在原文末尾添加相关笔记区域')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.addBacklinksSection)
                .onChange(async (value) => {
                    this.plugin.settings.addBacklinksSection = value;
                    await this.plugin.saveSettings();
                }));

        // 提示词设置
        containerEl.createEl('h3', { text: 'AI 提示词设置' });

        // 添加提示词设置说明
        const descEl = containerEl.createEl('p', {
            text: '在提示词中使用 {text} 作为原文占位符。系统会自动将其替换为选中的文本。'
        });
        descEl.style.fontSize = '12px';
        descEl.style.color = 'var(--text-muted)';

        // 添加重置按钮
        new Setting(containerEl)
            .setName('重置提示词')
            .setDesc('将提示词重置为默认值')
            .addButton(button => button
                .setButtonText('重置')
                .onClick(async () => {
                    this.plugin.settings.promptTemplate = this.plugin.settings.defaultPrompt;
                    await this.plugin.saveSettings();
                    // 刷新提示词文本区域
                    this.display();
                }));

        // 添加提示词编辑区域
        const promptSetting = new Setting(containerEl)
            .setName('AI 提示词模板')
            .setDesc('自定义 AI 分析文本时使用的提示词');

        const promptTextArea = containerEl.createEl('textarea', {
            text: this.plugin.settings.promptTemplate
        });
        
        // 设置文本区域样式
        promptTextArea.style.width = '100%';
        promptTextArea.style.height = '200px';
        promptTextArea.style.marginBottom = '1em';
        promptTextArea.style.fontFamily = 'monospace';
        
        // 添加变更监听
        promptTextArea.addEventListener('change', async (e) => {
            const target = e.target as HTMLTextAreaElement;
            this.plugin.settings.promptTemplate = target.value;
            await this.plugin.saveSettings();
        });
        // 添加文件夹设置区域
        containerEl.createEl('h3', { text: '文件夹设置' });

        new Setting(containerEl)
            .setName('目标文件夹')
            .setDesc('新生成的笔记将保存在这个文件夹中')
            .addSearch(search => {
                search
                    .setPlaceholder("选择保存文件夹")
                    .setValue(this.plugin.settings.targetFolder)
                    .onChange(async (value) => {
                        this.plugin.settings.targetFolder = value;
                        await this.plugin.saveSettings();
                    });
            });

        // 使用 SuggestModal 实现文件夹建议功能
        const folderSuggestModal = new FolderSuggestModal(this.app, async (selectedFolder) => {
            this.plugin.settings.targetFolder = selectedFolder.path;
            await this.plugin.saveSettings();
            this.display(); // 刷新设置页面以显示新的文件夹路径
        });

        // 添加一个按钮来触发 SuggestModal
            new Setting(containerEl)
            .setName('选择文件夹')
            .setDesc('点击选择目标文件夹')
            .addButton(button => button
                .setButtonText('选择文件夹')
                .onClick(() => {
                    folderSuggestModal.open();
        
                })); 
    
        // PDF设置
        containerEl.createEl('h3', { text: 'PDF 设置' });

        new Setting(containerEl)
            .setName('PDF引用样式')
            .setDesc('选择从PDF提取文本时的引用样式')
            .addDropdown(dropdown => dropdown
                .addOption('callout', '引用框')
                .addOption('codeblock', '代码块')
                .setValue(this.plugin.settings.pdfQuoteStyle)
                .onChange(async (value) => {
                    this.plugin.settings.pdfQuoteStyle = value as 'callout' | 'codeblock';
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('添加页面链接')
            .setDesc('在引用中添加PDF页面链接')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.pdfPageLink)
                .onChange(async (value) => {
                    this.plugin.settings.pdfPageLink = value;
                    await this.plugin.saveSettings();
                }));
    }
}