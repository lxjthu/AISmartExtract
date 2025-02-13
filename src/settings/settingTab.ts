// src/settings/settingTab.ts
import { App, PluginSettingTab, Setting, Modal,Notice } from 'obsidian';
import type { TextComponent } from 'obsidian'; // 添加这个导入
import type AISmartExtractPlugin from '../main';
import { AIProvider, ProviderSettings,PromptTemplate, PluginSettings, SummarySettings, MetadataField } from '../types';
import { FolderSuggestModal } from '../modals/folderSuggest';
import { DEFAULT_SETTINGS  } from '../settings/settings';
import { config } from 'process';
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

                containerEl.createEl('h3', { text: '笔记总结设置' });

            // 添加说明文本
            const summaryDescEl = containerEl.createEl('p', {
                text: '自定义总结生成的提示词模板。使用 {count} 表示笔记数量，{notes} 表示笔记内容。'
            });
            summaryDescEl.style.fontSize = '12px';
            summaryDescEl.style.color = 'var(--text-muted)';
            summaryDescEl.style.marginBottom = '1em';

            // 添加提示词文本区域
            const summaryPromptArea = containerEl.createEl('textarea', {
                text: this.plugin.settings.summary.promptTemplate
            });

            // 设置文本区域样式
            summaryPromptArea.style.width = '100%';
            summaryPromptArea.style.height = '200px';
            summaryPromptArea.style.marginBottom = '1em';
            summaryPromptArea.style.fontFamily = 'monospace';

            // 添加事件监听
            summaryPromptArea.addEventListener('change', async (e) => {
                const target = e.target as HTMLTextAreaElement;
                this.plugin.settings.summary.promptTemplate = target.value;
                await this.plugin.saveSettings();
            });

            // 添加重置按钮
            new Setting(containerEl)
                .setName('重置总结提示词')
                .setDesc('将总结提示词重置为默认值')
                .addButton(button => button
                    .setButtonText('重置')
                    .onClick(async () => {
                        this.plugin.settings.summary.promptTemplate = DEFAULT_SETTINGS.summary.promptTemplate;
                        await this.plugin.saveSettings();
                        summaryPromptArea.value = DEFAULT_SETTINGS.summary.promptTemplate;
                    }));
                        
                new Setting(containerEl)
                    .setName('包含反向链接')
                    .setDesc('在原笔记中添加到总结的链接')
                    .addToggle(toggle => toggle
                        .setValue(this.plugin.settings.summary.includeBacklinks)
                        .onChange(async (value) => {
                            this.plugin.settings.summary.includeBacklinks = value;
                            await this.plugin.saveSettings();
                        }));
                        
                new Setting(containerEl)
                    .setName('显示知识图谱')
                    .setDesc('在总结中包含知识关系图谱')
                    .addToggle(toggle => toggle
                        .setValue(this.plugin.settings.summary.knowledgeGraphView)
                        .onChange(async (value) => {
                            this.plugin.settings.summary.knowledgeGraphView = value;
                            await this.plugin.saveSettings();
                        }));
        
                // 批量处理设置部分
        containerEl.createEl('h3', { text: '批量处理设置' });

        new Setting(containerEl)
            .setName('最大并发数')
            .setDesc('同时处理的最大文件数（1-10）')
            .addSlider(slider => slider
                .setLimits(1, 10, 1)
                .setValue(this.plugin.settings.batchProcessing.maxConcurrent)
                .onChange(async (value) => {
                    this.plugin.settings.batchProcessing.maxConcurrent = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('处理间隔')
            .setDesc('每个文件处理之间的延迟（毫秒）')
            .addSlider(slider => slider
                .setLimits(0, 5000, 100)
                .setValue(this.plugin.settings.batchProcessing.delayBetweenFiles)
                .onChange(async (value) => {
                    this.plugin.settings.batchProcessing.delayBetweenFiles = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('跳过已有标签')
            .setDesc('是否跳过已经包含标签的文件')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.batchProcessing.skipExistingTags)
                .onChange(async (value) => {
                    this.plugin.settings.batchProcessing.skipExistingTags = value;
                    await this.plugin.saveSettings();
                }));
        
    containerEl.createEl('h3', { text: '元数据设置' });
    
        // 添加重置元数据提示词按钮
        new Setting(containerEl)
        .setName('重置元数据提示词')
        .setDesc('将元数据提示词重置为默认值')
        .addButton(button => button
            .setButtonText('重置')
            .onClick(async () => {
                this.resetMetadataPrompts();
            }));
    this.addMetadataField(containerEl);

    
            // 时间格式设置
    containerEl.createEl('h3', { text: '时间元数据设置' });
    new Setting(containerEl)
        .setName('日期时间格式')
        .setDesc('设置创建时间和修改时间的显示格式')
        .addText(text => text
            .setPlaceholder('YYYY-MM-DD HH:mm:ss')
            .setValue(this.plugin.settings.metadata.dateFormat || 'YYYY-MM-DD HH:mm:ss')
            .onChange(async (value) => {
                this.plugin.settings.metadata.dateFormat = value;
                await this.plugin.saveSettings();
            }));

    new Setting(containerEl)
        .setName('包含时间戳')
        .setDesc('同时保存时间戳形式的创建和修改时间')
        .addToggle(toggle => toggle
            .setValue(this.plugin.settings.metadata.includeTimestamp || false)
            .onChange(async (value) => {
                this.plugin.settings.metadata.includeTimestamp = value;
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

         // 提示词模板管理
         containerEl.createEl('h3', { text: 'AI 提示词模板管理' });

         // 显示现有模板列表
         this.plugin.settings.promptTemplates.forEach(template => {
             const templateContainer = containerEl.createDiv('template-container');
             templateContainer.addClass('template-item');
 
             new Setting(templateContainer)
                 .setName(template.name)
                 .setDesc(template.description || '')
                 .addButton(btn => btn
                     .setButtonText('编辑')
                     .onClick(() => {
                         this.showTemplateEditModal(template);
                     }))
                 .addButton(btn => btn
                     .setButtonText('删除')
                     .onClick(async () => {
                         if (template.id === 'default') {
                             new Notice('不能删除默认模板');
                             return;
                         }
                         this.plugin.settings.promptTemplates = 
                             this.plugin.settings.promptTemplates.filter(t => t.id !== template.id);
                         await this.plugin.saveSettings();
                         this.display();
                     }));
         });
 
         // 添加新模板按钮
         new Setting(containerEl)
             .setName('添加新模板')
             .addButton(btn => btn
                 .setButtonText('添加')
                 .onClick(() => {
                     this.showTemplateEditModal();
                 }));
 
         // 命令模板映射设置
         containerEl.createEl('h3', { text: '命令模板映射' });
         
         // 为每个命令创建模板选择器
         // 在命令模板映射部分添加特殊处理
        // 在 settingTab.ts 中的 display() 方法中修改命令模板映射部分
        Object.keys(this.plugin.commands).forEach(commandId => {
            // 跳过元数据相关命令的模板映射
        if (commandId === 'add-smart-metadata' || 
            commandId === 'batch-add-smart-metadata') {
            return;
        }
            const command = this.plugin.commands[commandId];
            const container = containerEl.createDiv('command-settings');

            new Setting(container)
                .setName(command.name)
                .setDesc('选择命令使用的模板和响应类型')
                .addDropdown(dropdown => {
                    // 获取命令的响应类型，如果没有设置则使用默认值
                    const responseType = this.plugin.settings.commandResponseTypes[commandId] || 'tag';
                    
                    // 获取该响应类型的所有可用模板
                    const availableTemplates = this.plugin.settings.promptTemplates
                        .filter(t => t.type === responseType);
                    
                    // 如果没有可用模板，添加一个默认模板
                    if (availableTemplates.length === 0) {
                        const defaultTemplate: PromptTemplate = {
                            id: `default-${responseType}`,
                            name: `默认${responseType}模板`,
                            content: this.plugin.settings.defaultPrompt,
                            type: responseType,
                            description: '默认模板'
                        };
                        this.plugin.settings.promptTemplates.push(defaultTemplate);
                        availableTemplates.push(defaultTemplate);
                    }
                    
                    // 添加所有可用模板到下拉列表
                    availableTemplates.forEach(template => {
                        dropdown.addOption(template.id, template.name);
                    });
                    
                    // 设置当前选中的模板
                    const currentTemplateId = this.plugin.settings.commandTemplateMap[commandId] || 
                                        availableTemplates[0].id;
                    dropdown.setValue(currentTemplateId);
                    
                    dropdown.onChange(async value => {
                        this.plugin.settings.commandTemplateMap[commandId] = value;
                        await this.plugin.saveSettings();
                    });
                });
        });

    }

    private resetMetadataPrompts() {
        this.plugin.settings.metadata.configs = DEFAULT_SETTINGS.metadata.configs.map(config => ({
            ...config
        }));
        this.plugin.saveSettings();
        this.display();
    }

    private async showTemplateEditModal(template?: PromptTemplate) {
        const modal = new TemplateEditModal(
            this.app,
            template,
            async (result) => {
                if (template) {
                    // 更新现有模板
                    const index = this.plugin.settings.promptTemplates
                        .findIndex(t => t.id === template.id);
                    if (index !== -1) {
                        this.plugin.settings.promptTemplates[index] = result;
                    }
                } else {
                    // 添加新模板
                    result.id = String(Date.now()); // 简单的ID生成
                    this.plugin.settings.promptTemplates.push(result);
                }
                await this.plugin.saveSettings();
                this.display();
            }
        );
        modal.open();
    }
    
    // 在 AISmartExtractSettingTab 类中添加新方法
    // 在 settingTab.ts 中的使用方式
    private addMetadataField(containerEl: HTMLElement) {
        new Setting(containerEl)
            .setName('添加元数据字段')
            .setDesc('配置新的元数据字段')
            .addButton(button => button
                .setButtonText('添加字段')
                .onClick(() => {
                    const modal = new MetadataFieldModal(this.app, async (field: MetadataField) => {
                        this.plugin.settings.metadata.configs.push(field);
                        await this.plugin.saveSettings();
                        this.display();
                    });
                    modal.open();
                }));
    

        // 编辑现有字段
        this.plugin.settings.metadata.configs.forEach((field, index) => {
            const fieldContainer = containerEl.createDiv('metadata-field');
            
            new Setting(fieldContainer)
                .setName(field.key)
                .setDesc(field.type === 'ai' ? (field.prompt ?? '') : (field.description ?? ''))
                .addButton(button => button
                    .setIcon('pencil')
                    .onClick(() => {
                        const modal = new MetadataFieldModal(
                            this.app, 
                            async (updatedField: MetadataField) => {
                                this.plugin.settings.metadata.configs[index] = updatedField;
                                await this.plugin.saveSettings();
                                this.display();
                            },
                            field // 传递现有字段对象
                        );
                        modal.open();
                    }))
                .addButton(button => button
                    .setIcon('trash')
                    .onClick(async () => {
                        this.plugin.settings.metadata.configs.splice(index, 1);
                        await this.plugin.saveSettings();
                        this.display();
                    }));
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

//元数据配置弹窗
class MetadataFieldModal extends Modal {
    private field: MetadataField;
    private onSubmit: (field: MetadataField) => void;

    constructor(app: App, onSubmit: (field: MetadataField) => void, field?: MetadataField) {
        super(app);
        this.onSubmit = onSubmit;
        this.field = field || {
            key: '',
            type: 'ai',
            description: '',
            required: true,
            prompt: '' // 确保包含所有可能的字段
        };
    }

    onOpen() {
        const {contentEl} = this;
        contentEl.empty();

        contentEl.createEl('h3', { text: this.field.key ? '编辑元数据字段' : '添加元数据字段' });

        // 字段名称
        new Setting(contentEl)
            .setName('字段名称')
            .setDesc('输入字段的标识符')
            .addText(text => text
                .setPlaceholder('field_name')
                .setValue(this.field.key)
                .onChange(value => this.field.key = value));

        // 字段类型
        new Setting(contentEl)
            .setName('字段类型')
            .setDesc('选择字段的类型')
            .addDropdown(dropdown => {
                dropdown
                    .addOption('ai', 'AI分析字段')
                    .addOption('system', '系统字段')
                    .addOption('custom', '自定义字段')
                    .setValue(this.field.type)
                    .onChange(value => {
                        this.field.type = value as MetadataField['type'];
                        // 如果是 AI 字段，显示提示词输入
                        if (value === 'ai') {
                            this.showPromptInput();
                        }
                    });
            });

        // 字段描述
        new Setting(contentEl)
            .setName('字段描述')
            .setDesc('字段的描述信息')
            .addTextArea(text => text
                .setPlaceholder('描述该字段的用途...')
                .onChange(value => this.field.description = value));

        // 是否必填
        new Setting(contentEl)
            .setName('必填字段')
            .setDesc('是否为必填字段')
            .addToggle(toggle => toggle
                .setValue(this.field.required ?? true)
                .onChange(value => this.field.required = value));

            // AI 提示词（仅当字段类型为 AI 时显示）
        if (this.field.type === 'ai') {
            this.showPromptInput();
        }

        // 保存按钮
        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('保存')
                .onClick(() => {
                    this.onSubmit(this.field);
                    this.close();
                }))
            .addButton(btn => btn
                .setButtonText('取消')
                .onClick(() => this.close()));
    }

    private showPromptInput() {
        const promptSetting = new Setting(this.contentEl)
        .setName('AI 提示词')
        .setDesc('设置 AI 分析该字段的提示词')
        .addTextArea(text => text
            .setPlaceholder('请输入提示词...')
            .setValue(this.field.prompt || '')
            .onChange(value => this.field.prompt = value));
    }

    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}

// 模板编辑弹窗
class TemplateEditModal extends Modal {
    private template: PromptTemplate;
    private onSubmit: (result: PromptTemplate) => Promise<void>;

    constructor(
        app: App,
        template: PromptTemplate | undefined,
        onSubmit: (result: PromptTemplate) => Promise<void>
    ) {
        super(app);
        this.template = template || {
            id: '',
            name: '',
            content: '',
            description: '',
            type: 'metadata' // 默认模板类型
        };
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const {contentEl} = this;

        contentEl.createEl('h3', {text: this.template.id ? '编辑模板' : '新建模板'});

        // 模板名称
        new Setting(contentEl)
            .setName('模板名称')
            .addText(text => text
                .setValue(this.template.name)
                .onChange(value => this.template.name = value));

        // 模板描述
        new Setting(contentEl)
            .setName('模板描述')
            .addText(text => text
                .setValue(this.template.description || '')
                .onChange(value => this.template.description = value));

        // 模板内容
        contentEl.createEl('h4', {text: '模板内容'});
        const textarea = contentEl.createEl('textarea', {
            text: this.template.content
        });
        textarea.style.width = '100%';
        textarea.style.height = '200px';
        textarea.style.marginBottom = '1em';
        textarea.addEventListener('input', e => {
            this.template.content = (e.target as HTMLTextAreaElement).value;
        });

        // 保存按钮
        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('保存')
                .onClick(async () => {
                    await this.onSubmit(this.template);
                    this.close();
                }))
            .addButton(btn => btn
                .setButtonText('取消')
                .onClick(() => this.close()));
    }

    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}