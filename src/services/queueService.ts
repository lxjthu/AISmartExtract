// src/services/queueService.ts
import { Notice } from 'obsidian';
import { PluginSettings } from '../types';

interface QueueTask {
    id: string;
    task: () => Promise<any>;
    onSuccess?: (result: any) => void;
    onError?: (error: Error) => void;
}

export class QueueService {
    private queue: QueueTask[] = [];
    private activeTaskCount = 0;
    private isProcessing = false;
    private settings: PluginSettings;

    constructor(settings: PluginSettings) {
        this.settings = settings;
    }

    /**
     * 设置最大并发数
     */
    setMaxConcurrent(value: number) {
        this.settings.batchProcessing.maxConcurrent = value;
    }

    /**
     * 添加任务到队列
     */
    async addTask(
        task: () => Promise<any>,
        onSuccess?: (result: any) => void,
        onError?: (error: Error) => void
    ): Promise<void> {
        const taskId = Date.now().toString();
        this.queue.push({
            id: taskId,
            task,
            onSuccess,
            onError
        });

        if (!this.isProcessing) {
            this.processQueue();
        }
    }

    /**
     * 处理队列
     */
    private async processQueue() {
        if (this.isProcessing || this.queue.length === 0) {
            return;
        }

        this.isProcessing = true;

        while (this.queue.length > 0 || this.activeTaskCount > 0) {
            // 检查是否可以启动新任务
            while (
                this.queue.length > 0 && 
                this.activeTaskCount < this.settings.batchProcessing.maxConcurrent
            ) {
                const currentTask = this.queue.shift();
                if (!currentTask) continue;

                this.activeTaskCount++;
                
                // 使用 Promise 来处理任务
                this.executeTask(currentTask).finally(() => {
                    this.activeTaskCount--;
                    // 如果还有任务待处理，继续处理队列
                    if (this.queue.length > 0) {
                        this.processQueue();
                    }
                });

                // 添加处理间隔
                if (this.settings.batchProcessing.delayBetweenFiles > 0) {
                    await new Promise(resolve => 
                        setTimeout(resolve, this.settings.batchProcessing.delayBetweenFiles)
                    );
                }
            }

            // 等待当前批次的任务完成
            if (this.activeTaskCount > 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        this.isProcessing = false;
    }

    /**
     * 执行单个任务
     */
    private async executeTask(task: QueueTask): Promise<void> {
        try {
            const result = await task.task();
            task.onSuccess?.(result);
        } catch (error) {
            console.error('Task failed:', error);
            new Notice(`任务失败: ${error.message}`);
            task.onError?.(error);
        }
    }

    /**
     * 获取当前队列长度
     */
    getQueueLength(): number {
        return this.queue.length;
    }

    /**
     * 获取当前活动任务数
     */
    getActiveTaskCount(): number {
        return this.activeTaskCount;
    }

    /**
     * 清空队列
     */
    clearQueue() {
        this.queue = [];
        this.activeTaskCount = 0;
        this.isProcessing = false;
    }

    /**
     * 更新设置
     */
    updateSettings(settings: PluginSettings) {
        this.settings = settings;
    }
}
