# 技术方案-完善AI模式多模型配置（实现映射）

## 1. 目标与范围

本次实现目标：按 PRD 与《测试用例-完善AI模式多模型配置》将 AI 配置从“单模型”升级为“多模型列表 + 当前生效模型”。

已覆盖能力：

- 多模型配置的新增、编辑、删除、复制、排序、设为默认
- AI 配置区域折叠/展开（默认折叠）
- 生成链路只读取当前生效模型
- AI/Hybrid 失败均直接报错，不回退规则生成
- 中文错误提示与字段校验
- 连接测试与当前生效模型解耦（只测编辑中的模型配置）
- 旧字段废弃（不迁移，不作为配置来源）

## 2. 数据模型设计

### 2.1 设置结构

```ts
interface AiModelConfig {
  id: string;
  name: string;
  provider: AiProvider;
  apiUrl: string;
  apiKey: string;
  model: string;
  prompt: string;
}

interface NoteFlashcardsSettings {
  generatorMode: "rule" | "ai" | "hybrid";
  maxCardsPerNote: number;
  summaryLength: number;

  aiModelConfigs: AiModelConfig[];
  activeAiModelId: string;
  aiSectionCollapsed: boolean;

  // 其余学习/复习字段保持不变
}
```

### 2.2 默认值与兼容策略

- `aiModelConfigs = []`
- `activeAiModelId = ""`
- `aiSectionCollapsed = true`
- 加载持久化设置时仅解析新结构字段。
- 历史 `aiProvider/aiApiUrl/aiApiKey/aiModel/aiPrompt` 即使存在，也不再读取。

## 3. 关键流程

### 3.1 生成流程（AI/Hybrid）

1. 根据 `activeAiModelId` 查找当前生效模型。  
2. 若列表为空/未选中/ID失效/配置缺失，直接中文报错。  
3. 按模型 `provider + apiUrl + apiKey + model + prompt` 调用 Provider。  
4. 成功解析 JSON 卡片后写入。  
5. 失败时直接报错（`ai` 与 `hybrid` 行为一致，不回退规则生成）。

### 3.2 设置页模型管理流程

1. 在折叠区管理模型列表。  
2. 编辑态支持连接测试（仅当前编辑模型）。  
3. 保存前执行必填校验：配置名称、Provider、API URL、API Key、模型名。  
4. 删除当前生效模型时：清空 `activeAiModelId`，不自动切换。

## 4. 错误处理策略

- 配置错误：`未配置模型`、`未选择当前生效模型`、`当前生效模型不存在`、`缺少必填字段`、`Provider 不支持`
- 请求错误：
  - `401/403` -> 鉴权失败
  - `429` -> 限流/配额不足
  - `5xx` -> 服务异常
  - 网络异常 -> 网络请求失败
- 返回错误：响应结构异常/JSON 解析失败统一提示 `AI 返回内容无法解析为闪卡...`

## 5. 代码落点

- 类型与默认设置：`src/types.ts`, `src/settings.ts`
- 模型领域逻辑：`src/aiModelState.ts`
- 设置加载与新旧兼容：`src/pluginSettingsState.ts`
- 设置页交互：`src/settingTab.ts`, `src/settingsState.ts`, `styles.css`
- AI 调用：`src/aiGenerator.ts`
- 生成策略：`src/generationStrategy.ts`

## 6. 测试用例映射

- TC01-TC03（折叠区/列表展示）：`settingTab.ts` + `styles.css`
- TC04-TC12（CRUD/复制/排序/删除行为）：`settingTab.ts` + `aiModelState.ts`
- TC13-TC15（当前生效模型生成）：`aiModelState.ts` + `aiGenerator.ts`
- TC16-TC19、TC32（字段校验/Provider）：`aiModelState.ts`
- TC20-TC24（网络/鉴权/限流/结构解析）：`aiGenerator.ts`
- TC25-TC26（失败不回退）：`generationStrategy.ts`
- TC27-TC28、TC33（连接测试解耦）：`settingTab.ts` + `aiGenerator.ts`
- TC29-TC30（旧字段废弃）：`pluginSettingsState.ts` + `pluginSettingsState.test.ts`
- TC31（持久化）：`pluginSettingsState.ts` + 设置页写入路径

## 7. 已完成验证

- `npm test`：全量通过
- `npm run build`：通过

