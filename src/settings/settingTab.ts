// src/settings/settingTab.ts
import { App, PluginSettingTab, Setting } from 'obsidian';
import type { TextComponent } from 'obsidian'; // 添加这个导入
import type AISmartExtractPlugin from '../main';
import { AIProvider, ProviderSettings } from '../types';
import { FolderSuggestModal } from '../modals/folderSuggest';
export class AISmartExtractSettingTab extends PluginSettingTab {
    plugin: AISmartExtractPlugin;

    constructor(app: App, plugin: AISmartExtractPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // AI 服务提供商设置
        containerEl.createEl('h3', { text: 'AI 服务设置' });

        // AI 提供商选择
        new Setting(containerEl)
            .setName('AI 服务提供商')
            .setDesc('选择要使用的 AI 服务')
            .addDropdown(dropdown => {
                dropdown
                    .addOption('openai', 'OpenAI')
                    .addOption('azure-openai', 'Azure OpenAI')
                    .addOption('anthropic', 'Anthropic Claude')
                    .addOption('gemini', 'Google Gemini')
                    .addOption('qianwen', '通义千问')
                    .addOption('deepseek', 'DeepSeek')
                    .addOption('mistral', 'Mistral AI')
                    .addOption('baidu', '文心一言')
                    .addOption('xunfei', '讯飞星火')
                    .addOption('zhipu', 'ChatGLM')
                    .addOption('minimax', 'MiniMax')
                    .addOption('moonshot', 'Moonshot AI')
                    .setValue(this.plugin.settings.aiProvider)
                    .onChange(async (value: AIProvider) => {
                        this.plugin.settings.aiProvider = value;
                        // 更新 endpoint 和其他相关设置
                        const providerSettings = this.plugin.settings.providerSettings[value];
                        this.plugin.settings.apiEndpoint = providerSettings.endpoint;
                        if (providerSettings.availableModels.length > 0) {
                            this.plugin.settings.model = providerSettings.availableModels[0];
                        }
                        await this.plugin.saveSettings();
                        // 重新渲染设置页面以更新相关选项
                        this.display();
                    });
            });

        // API Key 设置
        new Setting(containerEl)
            .setName('API Key')
            .setDesc('设置 API Key')
            .addText(text => text
                .setPlaceholder('输入 API Key')
                .setValue(this.plugin.settings.apiKey)
                .onChange(async (value) => {
                    this.plugin.settings.apiKey = value;
                    await this.plugin.saveSettings();
                }));

        // API Endpoint 设置
        new Setting(containerEl)
            .setName('API Endpoint')
            .setDesc('API 服务地址')
            .addText(text => {
                const provider = this.plugin.settings.aiProvider;
                const providerSettings = this.plugin.settings.providerSettings[provider];
                text.setPlaceholder(providerSettings.endpoint)
                    .setValue(this.plugin.settings.apiEndpoint)
                    .onChange(async (value) => {
                        this.plugin.settings.apiEndpoint = value;
                        await this.plugin.saveSettings();
                    });
            });

        // 模型选择
        new Setting(containerEl)
            .setName('模型')
            .setDesc('选择要使用的模型')
            .addDropdown(dropdown => {
                const provider = this.plugin.settings.aiProvider;
                const models = this.plugin.settings.providerSettings[provider].availableModels;
                models.forEach(model => dropdown.addOption(model, model));
                dropdown
                    .setValue(this.plugin.settings.model)
                    .onChange(async (value) => {
                        this.plugin.settings.model = value;
                        await this.plugin.saveSettings();
                    });
            });

        // 特定提供商的额外设置
        this.renderProviderSpecificSettings(containerEl);

        // 添加目标文件夹设置
        let textComponent: TextComponent; // 声明一个变量来保存文本组件

        new Setting(containerEl)
            .setName('目标文件夹')
            .setDesc('选择保存提取内容的目标文件夹')
            .addText(text => {
                textComponent = text; // 保存文本组件的引用
                return text
                    .setPlaceholder('选择文件夹...')
                    .setValue(this.plugin.settings.targetFolder)
                    .setDisabled(true);
            })
            .addButton(button => button
                .setButtonText('选择文件夹')
                .onClick(() => {
                    // 打开文件夹选择对话框
                    new FolderSuggestModal(this.app, (folderPath) => {
                        // 更新设置
                        this.plugin.settings.targetFolder = folderPath;
                        // 更新文本框显示
                        textComponent.setValue(folderPath);
                        // 保存设置
                        this.plugin.saveSettings();
                    }).open();
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

        // PDF 设置
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
                new Setting(containerEl)
                .setName('包含PDF元数据')
                .setDesc('在笔记中包含PDF文件名、页码等信息')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.includePdfMetadata)
                    .onChange(async (value) => {
                        this.plugin.settings.includePdfMetadata = value;
                        await this.plugin.saveSettings();
                    })
                );
    
            new Setting(containerEl)
                .setName('PDF笔记模板')
                .setDesc('自定义PDF笔记的模板格式')
                .addTextArea(text => text
                    .setValue(this.plugin.settings.pdfNoteTemplate)
                    .onChange(async (value) => {
                        this.plugin.settings.pdfNoteTemplate = value;
                        await this.plugin.saveSettings();
                    })
                );
        // 添加新的 PDF 元数据设置
        new Setting(containerEl)
        .setName('在 Front Matter 中包含 PDF 元数据')
        .setDesc('将 PDF 页码、位置等信息添加到笔记的 front matter 中')
        .addToggle(toggle => toggle
            .setValue(this.plugin.settings.pdfMetadataInFrontmatter)
            .onChange(async (value) => {
                this.plugin.settings.pdfMetadataInFrontmatter = value;
                await this.plugin.saveSettings();
            }));

        new Setting(containerEl)
        .setName('在正文中包含 PDF 元数据')
        .setDesc('将 PDF 页码、位置等信息添加到笔记的正文中')
        .addToggle(toggle => toggle
            .setValue(this.plugin.settings.pdfMetadataInContent)
            .onChange(async (value) => {
                this.plugin.settings.pdfMetadataInContent = value;
                await this.plugin.saveSettings();
            }));

        new Setting(containerEl)
        .setName('PDF 源信息标题')
        .setDesc('在笔记中显示 PDF 源信息的标题')
        .addText(text => text
            .setPlaceholder('源文件信息')
            .setValue(this.plugin.settings.pdfSourceSection)
            .onChange(async (value) => {
                this.plugin.settings.pdfSourceSection = value;
                await this.plugin.saveSettings();
            }));

        new Setting(containerEl)
        .setName('时间戳格式')
        .setDesc('PDF 选择时间的显示格式')
        .addText(text => text
            .setPlaceholder('YYYY-MM-DD HH:mm:ss')
            .setValue(this.plugin.settings.pdfTimestampFormat)
            .onChange(async (value) => {
                this.plugin.settings.pdfTimestampFormat = value;
                await this.plugin.saveSettings();
            }));

        // 提示词设置
        containerEl.createEl('h3', { text: 'AI 提示词设置' });

        // 提示词说明
        const descEl = containerEl.createEl('p', {
            text: '在提示词中使用 {text} 作为原文占位符。系统会自动将其替换为选中的文本。'
        });
        descEl.style.fontSize = '12px';
        descEl.style.color = 'var(--text-muted)';

        // 重置提示词按钮
        new Setting(containerEl)
            .setName('重置提示词')
            .setDesc('将提示词重置为默认值')
            .addButton(button => button
                .setButtonText('重置')
                .onClick(async () => {
                    this.plugin.settings.promptTemplate = this.plugin.settings.defaultPrompt;
                    await this.plugin.saveSettings();
                    this.display();
                }));

        // 提示词编辑区域
        const promptTextArea = containerEl.createEl('textarea', {
            text: this.plugin.settings.promptTemplate
        });
        
        promptTextArea.style.width = '100%';
        promptTextArea.style.height = '200px';
        promptTextArea.style.marginBottom = '1em';
        promptTextArea.style.fontFamily = 'monospace';
        
        promptTextArea.addEventListener('change', async (e) => {
            const target = e.target as HTMLTextAreaElement;
            this.plugin.settings.promptTemplate = target.value;
            await this.plugin.saveSettings();
        });
    }

    private renderProviderSpecificSettings(containerEl: HTMLElement) {
        const provider = this.plugin.settings.aiProvider;
        const providerSettings = this.plugin.settings.providerSettings[provider];

        // Azure OpenAI 特定设置
        if (provider === 'azure-openai') {
            new Setting(containerEl)
                .setName('API Version')
                .setDesc('Azure OpenAI API 版本')
                .addText(text => text
                    .setPlaceholder('2024-02-15-preview')
                    .setValue(providerSettings.apiVersion || '')
                    .onChange(async (value) => {
                        this.plugin.settings.providerSettings['azure-openai'].apiVersion = value;
                        await this.plugin.saveSettings();
                    }));
        }

        // Anthropic 特定设置
        if (provider === 'anthropic') {
            new Setting(containerEl)
                .setName('Anthropic Version')
                .setDesc('Anthropic API 版本')
                .addText(text => text
                    .setPlaceholder('2024-01-01')
                    .setValue(providerSettings.customHeaders?.['anthropic-version'] || '')
                    .onChange(async (value) => {
                        this.plugin.settings.providerSettings['anthropic'].customHeaders = {
                            'anthropic-version': value
                        };
                        await this.plugin.saveSettings();
                    }));
        }

        // 讯飞星火特定设置（WebSocket）
        if (provider === 'xunfei') {
            new Setting(containerEl)
                .setName('WebSocket 连接')
                .setDesc('使用 WebSocket 连接进行实时对话')
                .addToggle(toggle => toggle
                    .setValue(providerSettings.streamingSupport ?? false) // 使用空值合并运算符
                    .onChange(async (value) => {
                        this.plugin.settings.providerSettings['xunfei'].streamingSupport = value;
                        await this.plugin.saveSettings();
                    }));
        }
    }
}
