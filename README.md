# Study Flashcards

Study Flashcards 是一个社区插件，用来从笔记生成学习闪卡，并在侧边栏里完成复习。

## 功能

- 从当前笔记生成闪卡
- 从当前文件夹批量生成闪卡
- 在右侧侧边栏打开复习视图
- 支持新卡、学习中、复习中三种卡片状态
- 支持错题卡片过滤与已掌握卡片排除
- 支持顺序 / 随机复习
- 支持规则生成、AI 生成、混合生成三种模式
- 支持每日新卡数量与学习步长配置

## 兼容性

- 插件 ID：`note-flashcards`
- 最低 Obsidian 版本：`1.5.0`
- 桌面端与移动端均可使用

## 安装

### 社区插件安装

插件通过 Obsidian 社区审核并上架后，可在：

`设置` → `社区插件` → `浏览`

中搜索 `Study Flashcards` 后安装并启用。

### 手动安装

1. 下载 release 中的以下文件：
   - `manifest.json`
   - `main.js`
   - `styles.css`
2. 将它们复制到你的 vault：

```text
<vault>/.obsidian/plugins/note-flashcards/
```

3. 重启 Obsidian，或在社区插件页面里重新加载插件。
4. 启用 `Study Flashcards`。

## 使用方法

### 生成闪卡

插件提供以下入口：

- 命令面板
  - `从当前笔记生成闪卡`
  - `从当前文件夹生成闪卡`
  - `打开闪卡复习视图`
- 当前笔记右键菜单：`生成当前笔记闪卡`
- 文件夹右键菜单：`生成当前文件夹闪卡`
- 左侧 Ribbon 图标：`打开闪卡复习视图`

### 复习闪卡

打开复习视图后，可以：

- 查看题面与答案
- 切换上一张 / 下一张
- 切换顺序 / 随机复习
- 只看错题
- 排除已掌握卡片

### 设置项

插件设置中支持：

- 生成模式：`rule` / `ai` / `hybrid`
- 每篇笔记最多生成卡片数
- AI Provider（OpenAI 兼容 / OpenRouter / Azure OpenAI / Anthropic / Gemini）
- AI 接口地址
- AI API Key
- AI 模型名
- AI 附加提示词
- AI 连接测试
- 摘要长度
- 忽略文件夹列表
- 每日新卡数量
- 学习步长（分钟）
- 毕业间隔（天）
- Easy 间隔（天）
- 复习中显示全部卡片
- 重置全部卡片数据
- 恢复默认设置

## AI 模式说明

- `rule`：只使用内置规则生成卡片
- `ai`：只使用外部模型生成卡片
- `hybrid`：优先使用 AI，失败后回退到规则生成

当前支持的 AI Provider：

- OpenAI 兼容接口
- OpenRouter
- Azure OpenAI
- Anthropic
- Gemini

使用 AI 功能时，你需要自行配置外部服务地址、模型名和 API Key。插件不会提供模型服务本身。

## 开发

```bash
npm install
npm test
npm run build
```

构建产物位于仓库根目录：

- `manifest.json`
- `main.js`
- `styles.css`

## License

MIT
