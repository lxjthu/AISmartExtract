import {App, Plugin, PluginSettingTab, Setting, TFolder, TFile, MarkdownView, Notice, SuggestModal, requestUrl, Vault } from 'obsidian';

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

    async onload() {
        await this.loadSettings();

        // 添加设置标签页
        this.addSettingTab(new AISmartExtractSettingTab(this.app, this));

        this.addCommand({
            id: 'create-smart-note',
            name: '从选中文本创建智能笔记',
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
 
    }
}