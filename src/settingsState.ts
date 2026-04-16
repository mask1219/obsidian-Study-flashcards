import type { AiProvider, GeneratorMode, NoteFlashcardsSettings } from "./types";

const DEFAULT_AI_API_URLS: Record<AiProvider, string> = {
  "openai-compatible": "https://api.openai.com/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  "azure-openai": "https://{resource}.openai.azure.com/openai/deployments/{model}/chat/completions?api-version=2024-06-01",
  anthropic: "https://api.anthropic.com/v1/messages",
  gemini: "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
};

export const SETTINGS_COPY = {
  generatorMode: {
    name: "生成模式",
    description: "选择规则生成、AI 生成或混合模式",
    options: {
      rule: "规则",
      ai: "AI",
      hybrid: "混合"
    }
  },
  mistakeTopicCardEntry: {
    name: "错题主题定向生成入口",
    description: "在复习错题时显示“按错题主题生成学习卡片”区块"
  },
  maxCardsPerNote: {
    name: "每篇笔记最大卡片数",
    description: "限制单篇笔记生成的闪卡数量",
    placeholder: "12"
  },
  aiModelsSection: {
    name: "AI 模型配置",
    description: "维护多个模型配置并选择当前生效模型，生成时将直接使用当前生效模型。",
    addButton: "新增模型配置"
  },
  activeAiModel: {
    name: "当前生效模型",
    description: "生成闪卡时会直接使用该模型，不会二次询问",
    placeholder: "请选择模型配置",
    none: "未选择"
  },
  aiModelName: {
    name: "配置名称",
    placeholder: "例如：OpenAI-主配置"
  },
  aiProvider: {
    name: "Provider",
    description: "选择要调用的模型平台",
    options: {
      "openai-compatible": "OpenAI 兼容",
      openrouter: "OpenRouter",
      "azure-openai": "Azure OpenAI",
      anthropic: "Anthropic",
      gemini: "Gemini"
    }
  },
  aiApiUrl: {
    name: "AI 接口地址",
    description: "可自定义完整接口地址；Gemini/Azure 支持 {model} 占位符，Azure 需将 {resource} 替换为真实资源名",
    placeholder: "https://api.openai.com/v1/chat/completions"
  },
  aiApiKey: {
    name: "AI API Key",
    description: "用于调用 AI 模型，当前会随插件设置保存在本地",
    placeholder: "sk-..."
  },
  aiModel: {
    name: "AI 模型名",
    description: "填写目标模型标识（Azure 场景填写 deployment 名称）",
    placeholder: "gpt-4o-mini"
  },
  aiPrompt: {
    name: "AI 附加提示词",
    description: "可选，用于补充生成偏好；插件仍会强制要求返回 JSON",
    placeholder: "例如：更偏向术语定义、对比题和步骤题"
  },
  aiConnectionTest: {
    name: "AI 连接测试",
    description: "仅使用当前正在编辑的模型配置进行连通性验证",
    button: "测试连接",
    success: "AI 连接测试成功",
    failed: (detail?: string) => `AI 连接测试失败${detail ? `：${detail}` : ""}`
  },
  aiModelActions: {
    edit: "编辑",
    copy: "复制",
    setDefault: "设为默认",
    moveUp: "上移",
    moveDown: "下移",
    remove: "删除",
    save: "保存模型配置",
    cancel: "取消编辑",
    defaultTag: "当前生效"
  },
  summaryLength: {
    name: "答案摘要长度",
    description: "控制答案文本的最大长度",
    placeholder: "220"
  },
  newCardsPerDay: {
    name: "每日新卡上限",
    description: "限制复习页当天首次展示的新卡数量，不影响实际生成总数",
    placeholder: "10"
  },
  learningStepsMinutes: {
    name: "学习步进（分钟）",
    description: "使用逗号分隔，例如 1,10",
    placeholder: "1,10"
  },
  graduatingIntervalDays: {
    name: "毕业间隔（天）",
    description: "完成学习步进后的默认复习间隔",
    placeholder: "1"
  },
  easyIntervalDays: {
    name: "简单间隔（天）",
    description: "点击“简单”后直接进入复习的间隔",
    placeholder: "4"
  },
  showAllCardsInReview: {
    name: "无到期卡时显示全部",
    description: "当今天没有到期卡时，是否继续浏览全部卡片"
  },
  ignoredFolders: {
    name: "忽略文件夹",
    description: "使用逗号分隔多个文件夹前缀",
    placeholder: "Templates/,Archive/"
  },
  resetCards: {
    name: "重置所有卡片数据",
    description: "清空当前插件保存的全部卡片、错题本和已掌握状态"
  },
  resetSettings: {
    name: "恢复默认设置",
    description: "将当前插件设置恢复为默认值"
  }
} as const;

export function parsePositiveInteger(value: string): number | null {
  const parsed = Number(value);
  return !Number.isNaN(parsed) && parsed > 0 ? parsed : null;
}

export function parseNonNegativeInteger(value: string): number | null {
  const parsed = Number(value);
  return !Number.isNaN(parsed) && parsed >= 0 ? parsed : null;
}

export function parsePositiveIntegerList(value: string): number[] {
  return value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => !Number.isNaN(item) && item > 0);
}

export function parseStringList(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export function getGeneratorModeOptions(): Array<{ value: GeneratorMode; label: string }> {
  return [
    { value: "rule", label: SETTINGS_COPY.generatorMode.options.rule },
    { value: "ai", label: SETTINGS_COPY.generatorMode.options.ai },
    { value: "hybrid", label: SETTINGS_COPY.generatorMode.options.hybrid }
  ];
}

export function getAiProviderOptions(): Array<{ value: AiProvider; label: string }> {
  return [
    { value: "openai-compatible", label: SETTINGS_COPY.aiProvider.options["openai-compatible"] },
    { value: "openrouter", label: SETTINGS_COPY.aiProvider.options.openrouter },
    { value: "azure-openai", label: SETTINGS_COPY.aiProvider.options["azure-openai"] },
    { value: "anthropic", label: SETTINGS_COPY.aiProvider.options.anthropic },
    { value: "gemini", label: SETTINGS_COPY.aiProvider.options.gemini }
  ];
}

export function getDefaultAiApiUrl(provider: AiProvider): string {
  return DEFAULT_AI_API_URLS[provider];
}

export async function updateSetting<K extends keyof NoteFlashcardsSettings>(
  settings: NoteFlashcardsSettings,
  key: K,
  value: NoteFlashcardsSettings[K],
  saveSettings: () => Promise<void>
): Promise<void> {
  settings[key] = value;
  await saveSettings();
}
