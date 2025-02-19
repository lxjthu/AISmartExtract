export const DEBUG_CONFIG = {
    GLOBAL: false,           // 全局调试开关
    SERVICES: {
        AI: false,          // AI服务调试
        RELATED: false,     // 相关笔记服务调试
        BATCH: false,       // 批处理服务调试
        NOTE: false,        // 笔记服务调试
        QUEUE: false,       // 队列服务调试
        PDF: false,         // PDF服务调试
        METADATA: false,    // 元数据服务调试
        SUMMARY: false      // 总结服务调试
    }
};

export function debugLog(module: keyof typeof DEBUG_CONFIG.SERVICES, message: string, ...args: any[]) {
    if (DEBUG_CONFIG.GLOBAL && DEBUG_CONFIG.SERVICES[module]) {
        console.log(`[${module}] ${message}`, ...args);
    }
}

// 添加一个便捷的调试检查函数
export function isDebugEnabled(module: keyof typeof DEBUG_CONFIG.SERVICES): boolean {
    return DEBUG_CONFIG.GLOBAL && DEBUG_CONFIG.SERVICES[module];
}