import { getDefaultAiApiUrl } from "./settingsState";
import type { AiModelConfig, AiProvider, NoteFlashcardsSettings } from "./types";

const SUPPORTED_PROVIDERS = new Set<AiProvider>(["openai-compatible", "openrouter", "azure-openai", "anthropic", "gemini"]);

const REQUIRED_FIELD_LABELS = {
  name: "配置名称",
  provider: "Provider",
  apiUrl: "API URL",
  apiKey: "API Key",
  model: "模型名"
} as const;

const ALLOWED_MODEL_PLACEHOLDER = "{model}";
const URL_PLACEHOLDER_PATTERN = /\{[^}]+\}/g;

export const AI_MODEL_ERRORS = {
  noConfigs: "未配置任何 AI 模型，请先新增模型配置。",
  noActiveModel: "未选择当前生效模型，请先在设置页选择。",
  activeModelNotFound: "当前生效模型不存在，请重新选择。",
  unsupportedProvider: "Provider 不支持，请检查模型配置。",
  missingFields: (fields: string[]) => `模型配置缺少必填项：${fields.join("、")}`,
  invalidApiUrl: "API URL 格式无效，请填写完整的 http(s) 地址。",
  invalidApiProtocol: "API URL 仅支持 http(s) 协议。",
  unresolvedUrlPlaceholders: (tokens: string[]) => `API URL 存在未替换占位符：${tokens.join("、")}，请填写真实地址。`
} as const;

function getAllowedUrlPlaceholders(provider: AiProvider): Set<string> {
  if (provider === "azure-openai" || provider === "gemini") {
    return new Set([ALLOWED_MODEL_PLACEHOLDER]);
  }
  return new Set();
}

function getUnresolvedUrlPlaceholders(apiUrl: string, provider: AiProvider): string[] {
  const matched = apiUrl.match(URL_PLACEHOLDER_PATTERN);
  if (!matched) {
    return [];
  }
  const allowed = getAllowedUrlPlaceholders(provider);
  const unresolved = matched.filter((token) => !allowed.has(token));
  return Array.from(new Set(unresolved));
}

export function createAiModelId(): string {
  return `model-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createAiModelConfig(provider: AiProvider = "openai-compatible"): AiModelConfig {
  return {
    id: createAiModelId(),
    name: "",
    provider,
    apiUrl: getDefaultAiApiUrl(provider),
    apiKey: "",
    model: "",
    prompt: ""
  };
}

export function isSupportedProvider(value: unknown): value is AiProvider {
  return typeof value === "string" && SUPPORTED_PROVIDERS.has(value as AiProvider);
}

export function sanitizeAiModelConfig(data: unknown): AiModelConfig | null {
  if (!data || typeof data !== "object") {
    return null;
  }
  const candidate = data as Partial<AiModelConfig> & { provider?: unknown };
  if (!isSupportedProvider(candidate.provider)) {
    return null;
  }
  return {
    id: typeof candidate.id === "string" && candidate.id.trim().length > 0 ? candidate.id : createAiModelId(),
    name: typeof candidate.name === "string" ? candidate.name.trim() : "",
    provider: candidate.provider,
    apiUrl: typeof candidate.apiUrl === "string" ? candidate.apiUrl.trim() : "",
    apiKey: typeof candidate.apiKey === "string" ? candidate.apiKey.trim() : "",
    model: typeof candidate.model === "string" ? candidate.model.trim() : "",
    prompt: typeof candidate.prompt === "string" ? candidate.prompt.trim() : ""
  };
}

export function sanitizeAiModelConfigs(data: unknown): AiModelConfig[] {
  if (!Array.isArray(data)) {
    return [];
  }
  return data.flatMap((item) => {
    const config = sanitizeAiModelConfig(item);
    return config ? [config] : [];
  });
}

export function getMissingRequiredFields(config: AiModelConfig): string[] {
  const fields: string[] = [];
  if (!config.name.trim()) {
    fields.push(REQUIRED_FIELD_LABELS.name);
  }
  if (!config.provider || !isSupportedProvider(config.provider)) {
    fields.push(REQUIRED_FIELD_LABELS.provider);
  }
  if (!config.apiUrl.trim()) {
    fields.push(REQUIRED_FIELD_LABELS.apiUrl);
  }
  if (!config.apiKey.trim()) {
    fields.push(REQUIRED_FIELD_LABELS.apiKey);
  }
  if (!config.model.trim()) {
    fields.push(REQUIRED_FIELD_LABELS.model);
  }
  return fields;
}

export function validateModelConfigForSave(config: AiModelConfig): string | null {
  const missing = getMissingRequiredFields(config);
  return missing.length > 0 ? AI_MODEL_ERRORS.missingFields(missing) : null;
}

export function validateModelConfigForRequest(config: AiModelConfig): string | null {
  const missing = getMissingRequiredFields({ ...config, name: config.name || "tmp" });
  const requestFields = missing.filter((field) => field !== REQUIRED_FIELD_LABELS.name);
  if (requestFields.length > 0) {
    return AI_MODEL_ERRORS.missingFields(requestFields);
  }
  if (!isSupportedProvider(config.provider)) {
    return AI_MODEL_ERRORS.unsupportedProvider;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(config.apiUrl.trim());
  } catch (_error) {
    return AI_MODEL_ERRORS.invalidApiUrl;
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return AI_MODEL_ERRORS.invalidApiProtocol;
  }

  const unresolvedPlaceholders = getUnresolvedUrlPlaceholders(config.apiUrl.trim(), config.provider);
  if (unresolvedPlaceholders.length > 0) {
    return AI_MODEL_ERRORS.unresolvedUrlPlaceholders(unresolvedPlaceholders);
  }

  return null;
}

export function getActiveAiModel(settings: NoteFlashcardsSettings): AiModelConfig | null {
  if (settings.aiModelConfigs.length === 0 || !settings.activeAiModelId.trim()) {
    return null;
  }
  return settings.aiModelConfigs.find((config) => config.id === settings.activeAiModelId) ?? null;
}

export function getActiveAiModelOrThrow(settings: NoteFlashcardsSettings): AiModelConfig {
  if (settings.aiModelConfigs.length === 0) {
    throw new Error(AI_MODEL_ERRORS.noConfigs);
  }
  if (!settings.activeAiModelId.trim()) {
    throw new Error(AI_MODEL_ERRORS.noActiveModel);
  }
  const active = getActiveAiModel(settings);
  if (!active) {
    throw new Error(AI_MODEL_ERRORS.activeModelNotFound);
  }
  const validationError = validateModelConfigForRequest(active);
  if (validationError) {
    throw new Error(validationError);
  }
  return active;
}

export function buildCopyName(baseName: string, existingNames: string[]): string {
  const normalizedBase = baseName.trim() || "未命名配置";
  const firstCandidate = `${normalizedBase}-副本`;
  if (!existingNames.includes(firstCandidate)) {
    return firstCandidate;
  }
  let suffix = 2;
  while (existingNames.includes(`${normalizedBase}-副本${suffix}`)) {
    suffix += 1;
  }
  return `${normalizedBase}-副本${suffix}`;
}

export function duplicateModelConfig(config: AiModelConfig, existingNames: string[]): AiModelConfig {
  return {
    ...config,
    id: createAiModelId(),
    name: buildCopyName(config.name, existingNames)
  };
}

export function moveModelConfig(configs: AiModelConfig[], from: number, to: number): AiModelConfig[] {
  if (from < 0 || from >= configs.length || to < 0 || to >= configs.length || from === to) {
    return configs;
  }
  const next = [...configs];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
