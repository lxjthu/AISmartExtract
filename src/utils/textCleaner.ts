// src/utils/textCleaner.ts

/**
 * 清理PDF文本
 */
export function cleanPdfText(text: string): string {
    if (!text) return '';
    
    // 基础清理
    let cleaned = text
        .replace(/\s+/g, ' ')
        .replace(/[\r\n]+/g, ' ')
        .replace(/[\x00-\x1F\x7F-\x9F\uFFF0-\uFFFF]/g, '')
        .replace(/[""'']/g, '"')
        .replace(/[–—]/g, '-')
        .replace(/\u2013|\u2014/g, '-')
        .replace(/\u2026/g, '...')
        .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
        .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
        .replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
        .trim();

    return formatMixedText(cleaned);
}

/**
 * 格式化中英文混排文本
 */
export function formatMixedText(text: string): string {
    const isCJK = (char: string): boolean => {
        return /[\u4E00-\u9FFF\u3400-\u4DBF\u20000-\u2A6DF\u2A700-\u2B73F\u2B740-\u2B81F\u2B820-\u2CEAF\u2CEB0-\u2EBEF\u30000-\u3134F\uF900-\uFAFF\u2F800-\u2FA1F\u3040-\u309F\u30A0-\u30FF\u3100-\u312F\u31F0-\u31FF\uAC00-\uD7AF]/.test(char);
    };

    const isEnglishChar = (char: string): boolean => {
        return /[a-zA-Z0-9]/.test(char);
    };

    let result = '';
    let lastCharType: 'cjk' | 'english' | 'other' | null = null;
    
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        let currentCharType: 'cjk' | 'english' | 'other';

        if (isCJK(char)) {
            currentCharType = 'cjk';
        } else if (isEnglishChar(char)) {
            currentCharType = 'english';
        } else {
            currentCharType = 'other';
        }

        if (lastCharType && lastCharType !== currentCharType) {
            if ((lastCharType === 'cjk' && currentCharType === 'english') ||
                (lastCharType === 'english' && currentCharType === 'cjk')) {
                result += ' ';
            }
        }

        result += char;
        lastCharType = currentCharType;
    }

    return result;
}
