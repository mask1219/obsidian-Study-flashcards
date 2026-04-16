import { describe, expect, it } from "vitest";
import {
  AI_MODEL_ERRORS,
  buildCopyName,
  getActiveAiModelOrThrow,
  moveModelConfig,
  sanitizeAiModelConfigs,
  validateModelConfigForRequest,
  validateModelConfigForSave
} from "./aiModelState";
import type { AiModelConfig, NoteFlashcardsSettings } from "./types";

function createModel(overrides: Partial<AiModelConfig> = {}): AiModelConfig {
  return {
    id: "model-1",
    name: "主配置",
    provider: "openai-compatible",
    apiUrl: "https://api.openai.com/v1/chat/completions",
    apiKey: "sk-test",
    model: "gpt-4o-mini",
    prompt: "",
    ...overrides
  };
}

function createSettings(overrides: Partial<NoteFlashcardsSettings> = {}): NoteFlashcardsSettings {
  const model = createModel();
  return {
    generatorMode: "ai",
    maxCardsPerNote: 10,
    summaryLength: 100,
    mistakeTopicCardEntryEnabled: true,
    aiModelConfigs: [model],
    activeAiModelId: model.id,
    aiSectionCollapsed: true,
    ignoredFolders: [],
    newCardsPerDay: 10,
    showAllCardsInReview: false,
    learningStepsMinutes: [1, 10],
    graduatingIntervalDays: 1,
    easyIntervalDays: 4,
    ...overrides
  };
}

describe("aiModelState", () => {
  it("validates required fields when saving", () => {
    expect(validateModelConfigForSave(createModel({ name: "", apiKey: "", model: "" }))).toContain("配置名称");
    expect(validateModelConfigForSave(createModel())).toBeNull();
  });

  it("validates request URL format and placeholders", () => {
    expect(validateModelConfigForRequest(createModel({ apiUrl: "not-a-url" }))).toBe(AI_MODEL_ERRORS.invalidApiUrl);
    expect(validateModelConfigForRequest(createModel({
      provider: "azure-openai",
      apiUrl: "https://{resource}.openai.azure.com/openai/deployments/{model}/chat/completions?api-version=2024-06-01"
    }))).toContain("{resource}");
    expect(validateModelConfigForRequest(createModel({
      provider: "gemini",
      apiUrl: "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
      model: "gemini-2.5-flash"
    }))).toBeNull();
    expect(validateModelConfigForRequest(createModel({
      provider: "openai-compatible",
      apiUrl: "https://api.openai.com/v1/responses"
    }))).toBeNull();
  });

  it("generates copy names with incremental suffix", () => {
    expect(buildCopyName("配置A", [])).toBe("配置A-副本");
    expect(buildCopyName("配置A", ["配置A-副本"])).toBe("配置A-副本2");
    expect(buildCopyName("配置A", ["配置A-副本", "配置A-副本2"])).toBe("配置A-副本3");
  });

  it("moves model configs by index", () => {
    const moved = moveModelConfig(
      [createModel({ id: "a" }), createModel({ id: "b" }), createModel({ id: "c" })],
      2,
      0
    );
    expect(moved.map((item) => item.id)).toEqual(["c", "a", "b"]);
  });

  it("throws clear errors for invalid active model settings", () => {
    expect(() => getActiveAiModelOrThrow(createSettings({ aiModelConfigs: [], activeAiModelId: "" }))).toThrow(AI_MODEL_ERRORS.noConfigs);
    expect(() => getActiveAiModelOrThrow(createSettings({ activeAiModelId: "" }))).toThrow(AI_MODEL_ERRORS.noActiveModel);
    expect(() => getActiveAiModelOrThrow(createSettings({ activeAiModelId: "missing-id" }))).toThrow(AI_MODEL_ERRORS.activeModelNotFound);
  });

  it("sanitizes persisted model configs", () => {
    const sanitized = sanitizeAiModelConfigs([
      createModel({ name: "  A  " }),
      { id: "bad", provider: "not-supported" }
    ]);
    expect(sanitized).toHaveLength(1);
    expect(sanitized[0].name).toBe("A");
  });
});
