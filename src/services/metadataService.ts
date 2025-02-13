import { App, TFile, parseYaml, stringifyYaml } from 'obsidian';
import moment from 'moment';
import { AIServiceImpl } from './aiService';
import { PluginSettings, MetadataConfig, SystemMetadata, MetadataProcessingSettings, MetadataAIResponse, MetadataField } from '../types';

export class MetadataService {
    constructor(
        private app: App,
        private settings: PluginSettings,
        private aiService: AIServiceImpl
    ) {}

    async processFile(file: TFile): Promise<void> {
        // 读取文件内容
        const content = await this.app.vault.read(file);
        
        // 解析现有的frontmatter
        const { frontmatter, content: mainContent } = this.parseFrontmatter(content);
        
        // 如果设置为跳过已有元数据且已存在，则跳过
        if (this.settings.metadata.skipExisting && 
            this.hasExistingMetadata(frontmatter)) {
            return;
        }
        
        console.debug(`Frontmatter 中的字段:`, Object.keys(frontmatter));
    
        // 获取系统元数据
        const systemMetadata = this.getSystemMetadata(file);
    
        // 处理 AI 字段
        const aiMetadata = await this.processAIFields(
            mainContent, 
            this.settings.metadata.configs
        );
        console.debug(`AI 元数据处理完成:`, aiMetadata);
    
        // 合并所有元数据
        const finalMetadata = {
            ...frontmatter,
            ...aiMetadata,
            ...systemMetadata
        };
        console.debug(`最终元数据合并完成:`, finalMetadata);
    
        // 更新文件
        await this.updateFileFrontmatter(file, finalMetadata, mainContent);
    }
    

    private async processAIFields(content: string, fields: MetadataField[]): Promise<Record<string, any>> {
        const results: Record<string, any> = {};
        
        // 筛选出 AI 类型的字段
        const aiFields = fields.filter(field => field.type === 'ai');
        console.debug(`需要处理的 AI 字段:`, aiFields.map(f => f.key));
        
        // 使用单次 AI 调用处理所有字段
        const aiResult = await this.aiService.processText(
            content,
            undefined, // 不传入 prompt，让 AIService 自己构建
            undefined,
            'metadata',
            aiFields // 传入所有需要处理的字段
        );
    
        console.debug(`AI 返回结果:`, JSON.stringify(aiResult));
    
        if (aiResult?.type === 'metadata' && aiResult?.fields) {
            // 使用深拷贝确保数据不会丢失
            const fieldsToMerge = JSON.parse(JSON.stringify(aiResult.fields));
            Object.assign(results, fieldsToMerge);
        }
    
        console.debug(`最终结果:`, JSON.stringify(results));
        return results;
    }
    
    
    

    private parseFrontmatter(content: string): { frontmatter: any, content: string } {
        // 解析 frontmatter 和正文内容
        const frontMatterRegex = /^---\n([\s\S]*?)\n---/;
        const match = content.match(frontMatterRegex);
        
        if (!match) {
            return { frontmatter: {}, content };
        }

        try {
            const frontmatter = parseYaml(match[1]);
            const mainContent = content.replace(frontMatterRegex, '').trim();
            return { frontmatter, content: mainContent };
        } catch (e) {
            console.error('Failed to parse frontmatter:', e);
            return { frontmatter: {}, content };
        }
    }

    private hasExistingMetadata(frontmatter: any): boolean {
        if (!frontmatter) return false;
        
        // 检查必需的字段是否已存在
        const requiredFields = this.settings.metadata.configs
            .filter(field => field.required)
            .map(field => field.key);
    
        return requiredFields.every(field => frontmatter[field] !== undefined);
    }
    

    private mergeMetadata(
        existing: any, 
        aiResult: MetadataAIResponse, 
        file: TFile
    ): any {
        const merged = { ...existing };
        const systemMetadata = this.getSystemMetadata(file);
    
        // 处理每个配置的字段
        this.settings.metadata.configs.forEach(field => {
            if (field.type === 'system') {
                merged[field.key] = systemMetadata[field.systemField || field.key];
            } else if (field.type === 'ai') {
                // 优先从 fields 中获取
                if (aiResult.fields && field.key in aiResult.fields) {
                    merged[field.key] = aiResult.fields[field.key];
                } else if (aiResult[field.key as keyof MetadataAIResponse]) {
                    // 如果在 fields 中没找到，尝试从顶层属性获取
                    merged[field.key] = aiResult[field.key as keyof MetadataAIResponse];
                }
            }
        });

        return merged;
    }

    private getSystemMetadata(file: TFile): SystemMetadata {
        const { dateFormat, includeTimestamp } = this.settings.metadata;
        
        const created = moment(file.stat.ctime).format(dateFormat);
        const modified = moment(file.stat.mtime).format(dateFormat);
        
        const metadata: SystemMetadata = {
            created,
            modified
        };

        if (includeTimestamp) {
            metadata.createdTimestamp = file.stat.ctime;
            metadata.modifiedTimestamp = file.stat.mtime;
        }

        return metadata;
    }


    private async updateFileFrontmatter(
        file: TFile,
        frontmatter: any,
        content: string
    ): Promise<void> {
        // 确保时间格式正确
        const { dateFormat } = this.settings.metadata;
        
        // 格式化日期字段
        Object.keys(frontmatter).forEach(key => {
            const config = this.settings.metadata.configs.find(c => c.key === key);
            if (config?.type === 'date') {
                frontmatter[key] = moment(frontmatter[key]).format(dateFormat);
            }
        });
        console.debug(`格式化后的 Frontmatter:`, frontmatter);
    
        const newContent = `---\n${stringifyYaml(frontmatter)}\n---\n\n${content}`;
        console.debug(`新的文件内容:`, newContent);
    
        await this.app.vault.modify(file, newContent);
        console.debug(`文件 ${file.path} 更新完成`);
    }
}
