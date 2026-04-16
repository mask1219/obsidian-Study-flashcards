# Obsidian Study Flashcards

一个 Obsidian 学习闪卡插件，用于从笔记内容生成问答卡片，并在侧边栏中进行复习。

## 功能

- 从当前笔记生成闪卡
- 从当前文件夹批量生成闪卡
- 侧边栏打开闪卡复习视图
- 支持新卡、学习中、复习中三种卡片状态
- 支持错题本与已掌握标记
- 支持随机 / 顺序出卡
- 支持仅看错题、排除已掌握卡片
- 支持规则生成、AI 生成、混合生成三种模式
- 支持每日新卡数量与学习步长配置

## 安装

### 从源码构建

```bash
npm install
npm run build
```

构建后将以下文件复制到你的 Obsidian 插件目录：

- `main.js`
- `manifest.json`
- `styles.css`
- `versions.json`

目标目录通常为：

```text
<你的库路径>/.obsidian/plugins/note-flashcards/
```

然后在 Obsidian 的社区插件设置中启用 `Study Flashcards`。

## 使用方法

### 1. 生成闪卡

插件提供以下入口：

- 命令面板：
  - `从当前笔记生成闪卡`
  - `从当前文件夹生成闪卡`
  - `打开闪卡复习视图`
- 笔记右键菜单：生成当前笔记闪卡
- 文件夹相关菜单：生成当前文件夹闪卡
- 左侧 Ribbon 图标：打开闪卡复习视图

### 2. 复习闪卡

打开复习视图后，可以：

- 查看当前卡片题面与答案
- 手动切换上一张 / 下一张
- 切换随机或顺序学习
- 只查看错题本
- 排除已掌握卡片

### 3. 调整设置

插件设置中支持：

- 生成模式：`rule` / `ai` / `hybrid`
- 每篇笔记最多生成卡片数
- AI Provider（OpenAI 兼容 / OpenRouter / Azure OpenAI / Anthropic / Gemini）
- AI 接口地址（兼容 OpenAI Chat Completions）
- AI API Key
- AI 模型名
- AI 附加提示词（可选）
- AI 连接测试按钮
- 摘要长度
- 忽略文件夹列表
- 每日新卡数量
- 学习步长（分钟）
- 毕业间隔（天）
- easy 间隔（天）
- 是否在复习中显示全部卡片
- 重置全部卡片数据
- 恢复默认设置

### 4. AI 模式配置说明

- 当前 AI 模式支持五类 Provider：
  - OpenAI 兼容（支持 `/v1/chat/completions` 与 `/v1/responses`）
  - OpenRouter（`https://openrouter.ai/api/v1/chat/completions`）
  - Azure OpenAI（`.../openai/deployments/{model}/chat/completions?...`）
  - Anthropic（`/v1/messages`）
  - Gemini（`.../models/{model}:generateContent`，支持 `{model}` 占位符）
- 你可以切换 Provider 后直接使用默认接口地址，也可以手动改成自定义网关地址。
- Azure OpenAI 场景中，“AI 模型名”填写 deployment 名称即可，URL 中可保留 `{model}` 自动替换。
- `hybrid` 模式下，如果 AI 调用失败，会自动回退到规则生成。

## 开发

```bash
npm install
npm test
npm run build
```

## 仓库状态

当前仓库已完成首次代码上传，默认分支为 `main`。
