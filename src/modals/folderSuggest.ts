// src/modals/folderSuggest.ts
import { App, Modal, TFolder } from 'obsidian';

export class FolderSuggestModal extends Modal {
    private folders: TFolder[] = [];
    private filteredFolders: TFolder[] = [];
    private searchInput: HTMLInputElement;
    private folderList: HTMLElement;
    private onSelect: (folderPath: string) => void;

    constructor(app: App, onSelect: (folderPath: string) => void) {
        super(app);
        this.onSelect = onSelect;
    }

    onOpen() {
        // 设置模态框标题
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('folder-suggest-modal');

        // 创建搜索输入框
        const searchContainer = contentEl.createDiv('search-container');
        this.searchInput = searchContainer.createEl('input', {
            type: 'text',
            placeholder: '搜索文件夹...'
        });
        this.searchInput.addEventListener('input', () => this.updateFolderList());

        // 创建文件夹列表容器
        this.folderList = contentEl.createDiv('folder-list');

        // 获取所有文件夹
        this.getAllFolders();
        
        // 初始显示所有文件夹
        this.updateFolderList();

        // 聚焦搜索框
        this.searchInput.focus();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }

    private getAllFolders() {
        this.folders = [];
        const rootFolder = this.app.vault.getRoot();
        
        const processFolder = (folder: TFolder) => {
            this.folders.push(folder);
            folder.children.forEach(child => {
                if (child instanceof TFolder) {
                    processFolder(child);
                }
            });
        };

        processFolder(rootFolder);
        this.folders.sort((a, b) => a.path.localeCompare(b.path));
    }

    private updateFolderList() {
        const searchTerm = this.searchInput.value.toLowerCase();
        this.folderList.empty();

        // 过滤文件夹
        this.filteredFolders = this.folders.filter(folder => 
            folder.path.toLowerCase().contains(searchTerm)
        );

        // 创建文件夹列表项
        this.filteredFolders.forEach(folder => {
            const folderItem = this.folderList.createDiv('folder-item');
            
            // 创建文件夹图标
            const folderIcon = folderItem.createSpan('folder-icon');
            folderIcon.innerHTML = `<svg viewBox="0 0 100 100" class="folder" width="16" height="16">
                <path fill="currentColor" d="M6.1,8c-3.3,0-6,2.7-6,6v64c0,3.3,2.7,6,6,6h87.8c3.3,0,6-2.7,6-6V26c0-3.3-2.7-6-6-6H48.1l-8.7-12H6.1z"/>
            </svg>`;
            
            // 创建文件夹路径文本
            const folderPath = folderItem.createDiv('folder-path');
            folderPath.setText(folder.path);

            // 点击事件处理
            folderItem.addEventListener('click', () => {
                this.onSelect(folder.path);
                this.close();
            });

            // 鼠标悬停效果
            folderItem.addEventListener('mouseenter', () => {
                folderItem.addClass('is-selected');
            });
            
            folderItem.addEventListener('mouseleave', () => {
                folderItem.removeClass('is-selected');
            });
        });

        // 如果没有匹配结果，显示提示信息
        if (this.filteredFolders.length === 0) {
            const noResults = this.folderList.createDiv('no-results');
            noResults.setText('未找到匹配的文件夹');
        }
    }
}
