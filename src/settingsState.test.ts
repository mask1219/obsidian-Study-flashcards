import { describe, expect, it, vi } from "vitest";
import {
  getAiProviderOptions,
  getDefaultAiApiUrl,
  getGeneratorModeOptions,
  parseNonNegativeInteger,
  parsePositiveInteger,
  parsePositiveIntegerList,
  parseStringList,
  updateSetting
} from "./settingsState";
import { DEFAULT_SETTINGS } from "./settings";

describe("settingsState", () => {
  it("parses positive integers and rejects invalid values", () => {
    expect(parsePositiveInteger("12")).toBe(12);
    expect(parsePositiveInteger("0")).toBeNull();
    expect(parsePositiveInteger("abc")).toBeNull();
  });

  it("parses non-negative integers", () => {
    expect(parseNonNegativeInteger("0")).toBe(0);
    expect(parseNonNegativeInteger("8")).toBe(8);
    expect(parseNonNegativeInteger("-1")).toBeNull();
  });

  it("parses integer lists and string lists", () => {
    expect(parsePositiveIntegerList("1, 10, x, 0")).toEqual([1, 10]);
    expect(parseStringList("Templates/, Archive/ ,")).toEqual(["Templates/", "Archive/"]);
  });

  it("updates a setting and calls save", async () => {
    const settings = { ...DEFAULT_SETTINGS };
    const save = vi.fn(async () => undefined);

    await updateSetting(settings, "newCardsPerDay", 20, save);

    expect(settings.newCardsPerDay).toBe(20);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("returns generator mode options", () => {
    expect(getGeneratorModeOptions().map((option) => option.value)).toEqual(["rule", "ai", "hybrid"]);
  });

  it("returns AI provider options and default API URLs", () => {
    expect(getAiProviderOptions().map((option) => option.value)).toEqual(["openai-compatible", "openrouter", "azure-openai", "anthropic", "gemini"]);
    expect(getDefaultAiApiUrl("openai-compatible")).toBe("https://api.openai.com/v1/chat/completions");
    expect(getDefaultAiApiUrl("openrouter")).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(getDefaultAiApiUrl("azure-openai")).toBe("https://{resource}.openai.azure.com/openai/deployments/{model}/chat/completions?api-version=2024-06-01");
    expect(getDefaultAiApiUrl("anthropic")).toBe("https://api.anthropic.com/v1/messages");
    expect(getDefaultAiApiUrl("gemini")).toBe("https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent");
  });
});
