// src/services/queueService.ts
import { Notice } from 'obsidian';

interface QueueTask {
    id: string;
    task: () => Promise<any>;
    onSuccess?: (result: any) => void;
    onError?: (error: Error) => void;
}

export class QueueService {
    private queue: QueueTask[] = [];
    private isProcessing = false;

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

        while (this.queue.length > 0) {
            const currentTask = this.queue.shift();
            if (!currentTask) continue;

            try {
                const result = await currentTask.task();
                currentTask.onSuccess?.(result);
            } catch (error) {
                console.error('Task failed:', error);
                new Notice(`任务失败: ${error.message}`);
                currentTask.onError?.(error);
            }
        }

        this.isProcessing = false;
    }

    /**
     * 清空队列
     */
    clearQueue() {
        this.queue = [];
        this.isProcessing = false;
    }
}
