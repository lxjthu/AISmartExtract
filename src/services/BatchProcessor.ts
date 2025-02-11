// src/services/BatchProcessor.ts
import { Notice, TFile } from 'obsidian';
import { QueueService } from './queueService';
import { BatchTagService } from './batchTagService';
import { PluginSettings } from '../types';
export class BatchProcessor {
    constructor(
        private queueService: QueueService,
        private batchTagService: BatchTagService,
        private settings: PluginSettings  // 添加设置参数

    ) {}

    /**
     * 处理批量文件
     */
    async processBatchFiles(files: TFile[]): Promise<void> {

        // 使用设置
        const { maxConcurrent, delayBetweenFiles, skipExistingTags } = this.settings.batchProcessing;
        
        // 配置队列服务的并发数
        this.queueService.setMaxConcurrent(maxConcurrent);

        const total = files.length;
        let processed = 0;
        const startTime = Date.now();

        // 创建进度提示
        const progressNotice = new Notice(`开始处理文件 (0/${total})`, 0);

        // 为每个文件创建处理任务
        for (const file of files) {
            await this.queueService.addTask(
                // 任务函数
                async () => {
                    return await this.batchTagService.processFile(file);
                },
                // 成功回调
                () => {
                    processed++;
                    this.updateProgress(processed, total, progressNotice);

                    // 所有文件处理完成
                    if (processed === total) {
                        this.showCompletionNotice(total, startTime);
                        progressNotice.hide();
                    }
                },
                // 错误回调
                (error) => {
                    this.handleError(file, error);
                }
            );
        }
    }

    /**
     * 更新进度显示
     */
    private updateProgress(processed: number, total: number, notice: Notice): void {
        const progress = Math.round((processed / total) * 100);
        notice.setMessage(
            `正在处理文件 (${processed}/${total}) - ${progress}%`
        );
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
