# Obsidian 智能笔记助手

## 🆕 最新更新

### PDF 智能处理功能
- ✨ 新增 PDF 文档智能处理支持
  - 支持从 PDF 文档中选择文本并创建智能笔记
  - 自动记录 PDF 页码、位置和缩放比例等元数据
  - 优化了 PDF 文本清理算法，提供更好的文本提取质量
  - 保护性设计：不修改原始 PDF 文件

### AI 集成增强
- 🤖 扩展 AI 工具支持
  - 新增多个主流 AI API 支持：
    - OpenAI (GPT-3.5/GPT-4)
    - Anthropic Claude
    - Google PaLM
    - 智谱 ChatGLM
  - 灵活的 API 配置选项
    - 支持自定义 API 端点
    - 可配置的模型参数
    - 多账号负载均衡

### 笔记生成优化
- 📝 增强的笔记结构
  - 智能标题生成
  - 自动关键词提取
  - 标签智能推荐
  - 可折叠的引用块
  - 支持多种引用样式

### 用户界面改进
- 🎨 设置面板优化
  - 分类整理的设置选项
  - 直观的 AI 配置界面
  - 实时配置验证
  - 配置导入/导出功能

### 性能优化
- ⚡️ 性能提升
  - 异步处理优化
  - 智能防抖动
  - 内存使用优化
  - 错误处理增强

## 配置说明

### AI API 设置
```typescript
{
  "aiProvider": "openai", // 可选: "openai", "anthropic", "palm", "chatglm"
  "apiKey": "your-api-key",
  "apiEndpoint": "https://api.openai.com/v1", // 可自定义 API 端点
  "model": "gpt-3.5-turbo", // 根据提供商支持的模型选择
  "temperature": 0.7,
  "maxTokens": 2000
}
```

### PDF 处理设置
```typescript
{
  "pdfSettings": {
    "autoProcess": false,    // 是否自动处理选中文本
    "addBacklinks": false,   // 是否添加反向链接
    "extractMetadata": true, // 是否提取 PDF 元数据
    "cleanupMode": "basic"   // 文本清理模式: "basic", "aggressive"
  }
}
```

### 笔记生成设置
```typescript
{
  "noteTemplate": {
    "frontMatter": true,     // 是否包含 Front Matter
    "addTimestamp": true,    // 是否添加时间戳
    "quoteStyle": "callout", // 引用样式: "callout", "blockquote"
    "collapsible": true      // 引用块是否可折叠
  }
}
```

## 使用示例

### PDF 文本处理
1. 打开 PDF 文件
2. 选择需要处理的文本
3. 使用命令面板或快捷键触发处理
4. 自动生成包含元数据的智能笔记

### AI 处理
```typescript
// 示例：使用不同的 AI 提供商处理文本
await aiService.processText(text, {
  provider: "openai",
  model: "gpt-4",
  temperature: 0.5
});
```

## 注意事项
- PDF 文件处理时不会修改原文件
- API 密钥请妥善保管
- 建议根据实际需求调整 AI 参数
- 大文件处理可能需要更长时间

## 计划功能
- [ ] 多语言支持
- [ ] 批量处理功能
- [ ] 更多 AI 提供商支持
- [ ] 高级 PDF 注释功能
- [ ] 知识图谱集成

## 贡献指南
欢迎提交 Issue 和 Pull Request！

## 许可证
MIT License
