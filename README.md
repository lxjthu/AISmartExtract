# AI Smart Extract Plugin for Obsidian

## 简介
这是一个 Obsidian 插件，能够智能提取文本内容并生成结构化的笔记。支持从 Markdown 和 PDF 文件中提取内容，自动生成关键词、摘要和标签，并创建智能化的笔记链接。

## 主要功能

### 1. 智能笔记提取
- 从 Markdown 选中文本创建智能笔记
- 从 PDF 选中文本创建智能笔记
- 自动生成关键词、摘要和标签
- 支持自定义提示词模板

### 2. PDF 增强功能
- PDF 文本智能提取
- 自动记录 PDF 页码和位置信息
- 支持可折叠引用块
- 自动添加页面链接

### 3. 批量处理功能
- 批量处理文件夹中的笔记
- 智能添加标签
- 可配置的并发处理数量
- 处理间隔时间可调

### 4. 链接管理
- 自动创建双向链接
- 支持 Wiki 和引用两种链接样式
- 自动添加相关笔记区域

## 配置选项

### AI 服务设置
- 支持多种 AI 服务提供商：
  - OpenAI
  - Azure OpenAI
  - Anthropic Claude
  - Google Gemini
  - 通义千问
  - DeepSeek
  - Mistral AI
  - 文心一言
  - 讯飞星火
  - ChatGLM
  - MiniMax
  - Moonshot AI
- 可配置 API 密钥和端点
- 可选择不同的模型

### 笔记设置
- 自定义目标文件夹
- 自定义链接样式
- 引用标注类型设置
- 可折叠引用选项

### 批量处理设置
- 最大并发数（1-10）
- 处理间隔时间
- 是否跳过已有标签的文件

### PDF 设置
- PDF 引用样式（引用框/代码块）
- 页面链接选项
- 元数据包含选项
- 自定义笔记模板
- 时间戳格式

## 使用方法

### 从 Markdown 创建笔记
1. 选择文本
2. 使用命令面板执行"从Markdown选中文本创建智能笔记"
3. 等待处理完成

### 从 PDF 创建笔记
1. 在 PDF 中选择文本
2. 使用命令面板执行"从PDF选中文本创建智能笔记"
3. 等待处理完成

### 批量处理文件夹
1. 使用命令面板执行"批量处理文件夹中的笔记添加智能标签"
2. 选择目标文件夹
3. 确认处理
4. 等待完成

## 提示词模板
插件支持自定义提示词模板，可以在设置中添加和管理模板：
- 默认模板
- 学术总结模板
- 自定义模板

### 模板变量
使用 `{text}` 作为原文占位符，系统会自动替换为选中的文本。

## 开发指南

### 环境要求
- Node.js
- TypeScript
- Obsidian API

### 项目结构
```
AISmartExtract/
└── src/
    ├── main.ts
    ├── modals/
    │   └── folderSuggest.ts
    ├── services/
    │   ├── aiService.ts
    │   ├── BatchProcessor.ts
    │   ├── batchTagService.ts
    │   ├── noteService.ts
    │   ├── pdfService.ts
    │   └── queueService.ts
    ├── settings/
    │   ├── settings.ts
    │   └── settingTab.ts
    ├── types/
    │   └── index.ts
    └── utils/
        ├── helpers.ts
        └── textCleaner.ts

```

### 构建和测试
```bash
# 安装依赖
npm install

# 开发构建
npm run dev

# 生产构建
npm run build

# 运行测试
npm test
```

## 注意事项
- 确保正确配置 AI 服务相关参数
- 建议定期备份重要笔记
- 注意模板格式的正确性
- PDF 文件处理时不会修改原文件
- API 密钥请妥善保管
- 建议根据实际需求调整 AI 参数
- 大文件处理可能需要更长时间

## 贡献指南
欢迎提交 Pull Request 或提出 Issue。请确保：
1. 代码符合项目的 TypeScript 规范
2. 提供充分的测试覆盖
3. 更新相关文档



## 计划功能
- [ ] 多语言支持
- [ ] 批量处理功能
- [ ] 更多 AI 提供商支持
- [ ] 高级 PDF 注释功能
- [ ] 知识图谱集成


## 许可证
MIT License
