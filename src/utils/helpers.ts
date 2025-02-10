// src/utils/helpers.ts
import { View } from 'obsidian';
import { EmbeddedPDFView } from 'src/types';
/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
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

/**
 * 格式化日期
 */
export function formatDate(date: Date, format: string = 'YYYY-MM-DD HH:mm:ss'): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return format
        .replace('YYYY', String(year))
        .replace('MM', month)
        .replace('DD', day)
        .replace('HH', hours)
        .replace('mm', minutes)
        .replace('ss', seconds);
}

/**
 * 类型守卫 - 检查是否为PDF视图
 */
export function isPdfView(view: View): view is EmbeddedPDFView {
    console.debug('检查视图类型:', view.getViewType());
    return view.getViewType() === 'pdf';
}