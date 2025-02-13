// src/services/BatchProcessor.ts
import { Notice, TFile } from 'obsidian';
import { QueueService } from './queueService';
import { BatchTagService } from './batchTagService';
import { PluginSettings, AIResponseType } from '../types';
import { MetadataService } from './metadataService';
export class BatchProcessor {
    constructor(
        private queueService: QueueService,
        private batchTagService: BatchTagService,
        private settings: PluginSettings,  // 添加设置参数
        private metadataService: MetadataService, 

    ) {}

    private progressNotice: Notice | null = null; // 添加成员变量以跟踪通知

    /**
     * 处理批量文件
     */
    async processBatchFiles(files: TFile[], type: AIResponseType = 'tag'): Promise<void> {
        const settings = type === 'metadata' ? 
            this.settings.metadata.batchProcessing : 
            this.settings.batchProcessing;

        this.queueService.setMaxConcurrent(settings.maxConcurrent);

        const total = files.length;
        let processed = 0;
        const startTime = Date.now();
        

        // 创建进度提示
        this.progressNotice = new Notice(`开始处理文件 (0/${total})`, 0);

        try {
            for (const file of files) {
                await this.queueService.addTask(
                    async () => {
                        if (type === 'metadata') {
                            return await this.metadataService.processFile(file);
                        } else {
                            return await this.batchTagService.processFile(file);
                        }
                    },
                    () => {
                        processed++;
                        this.updateProgress(processed, total);
                    },
                    (error) => {
                        this.handleError(file, error);
                    }
                );

                if (settings.delayBetweenFiles > 0) {
                    await new Promise(resolve => 
                        setTimeout(resolve, settings.delayBetweenFiles)
                    );
                }
            }
        } finally {
            // 处理完成或发生错误时关闭进度提示
            if (this.progressNotice) {
                this.progressNotice.hide();
                this.progressNotice = null;
            }
            // 显示完成通知
            this.showCompletionNotice(total, startTime);
        }
    }

    //批量添加元数据
    async processMetadata(files: TFile[]): Promise<void> {
        const { maxConcurrent, delayBetweenFiles } = 
            this.settings.metadata.batchProcessing;

        this.queueService.setMaxConcurrent(maxConcurrent);

        const total = files.length;
        let processed = 0;
        const startTime = Date.now();

        this.progressNotice = new Notice(`开始处理文件 (0/${total})`, 0);

        try {
            for (const file of files) {
                await this.queueService.addTask(
                    async () => {
                        return await this.metadataService.processFile(file);
                    },
                    () => {
                        processed++;
                        this.updateProgress(processed, total);
                    },
                    (error) => {
                        this.handleError(file, error);
                    }
                );

                if (delayBetweenFiles > 0) {
                    await new Promise(resolve => setTimeout(resolve, delayBetweenFiles));
                }
            }
        } finally {
            // 处理完成或发生错误时关闭进度提示
            if (this.progressNotice) {
                this.progressNotice.hide();
                this.progressNotice = null;
            }
            // 显示完成通知
            this.showCompletionNotice(total, startTime);
        }
    }

    /**
     * 更新进度显示
     */
    private updateProgress(processed: number, total: number): void {
        if (this.progressNotice) {
            const progress = Math.round((processed / total) * 100);
            this.progressNotice.setMessage(
                `正在处理文件 (${processed}/${total}) - ${progress}%`
            );
            
            // 如果处理完成，关闭进度提示
            if (processed === total) {
                this.progressNotice.hide();
                this.progressNotice = null;
            }
        }
    }

    /**
     * 显示完成通知
     */
    private showCompletionNotice(total: number, startTime: number): void {
        const duration = Math.round((Date.now() - startTime) / 1000);
        new Notice(
            `处理完成！\n共处理 ${total} 个文件\n耗时 ${duration} 秒`
        );
    }

    /**
     * 处理错误
     */
    private handleError(file: TFile, error: Error): void {
        console.error(`处理文件 ${file.path} 失败:`, error);
        new Notice(`处理文件 ${file.path} 失败: ${error.message}`);
    }
}
