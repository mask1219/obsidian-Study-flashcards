import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "./settings";
import { buildSavedPluginData, loadPersistedSettings } from "./pluginSettingsState";

describe("pluginSettingsState", () => {
  it("falls back to default settings when persisted data is missing or invalid", () => {
    expect(loadPersistedSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(loadPersistedSettings({ settings: { newCardsPerDay: 5 } })).toEqual({ ...DEFAULT_SETTINGS, newCardsPerDay: 5 });
  });

  it("preserves existing cards when saving settings", () => {
    const existing = {
      cards: [{ id: "card-1", question: "Q" }],
      settings: { newCardsPerDay: 3 },
      extra: "keep"
    };

    expect(buildSavedPluginData(existing, { ...DEFAULT_SETTINGS, newCardsPerDay: 8 })).toEqual({
      ...existing,
      cards: existing.cards,
      settings: { ...DEFAULT_SETTINGS, newCardsPerDay: 8 }
    });
  });

  it("writes an empty card list when persisted cards are invalid", () => {
    expect(buildSavedPluginData({ settings: { newCardsPerDay: 3 }, cards: "bad-data" }, { ...DEFAULT_SETTINGS, newCardsPerDay: 6 })).toEqual({
      settings: { ...DEFAULT_SETTINGS, newCardsPerDay: 6 },
      cards: []
    });
  });

  it("can be reused to persist default settings while preserving cards", () => {
    const existing = {
      cards: [{ id: "card-1" }],
      settings: { newCardsPerDay: 25 }
    };

    expect(buildSavedPluginData(existing, DEFAULT_SETTINGS)).toEqual({
      cards: [{ id: "card-1" }],
      settings: DEFAULT_SETTINGS
    });
  });

  it("supports clearing settings customizations back to defaults", () => {
    expect(loadPersistedSettings({ settings: { newCardsPerDay: 0, ignoredFolders: ["Archive/"] } })).toEqual({
      ...DEFAULT_SETTINGS,
      newCardsPerDay: 0,
      ignoredFolders: ["Archive/"]
    });
  });

  it("ignores legacy single-model fields and keeps new model list empty", () => {
    expect(loadPersistedSettings({
      settings: {
        aiProvider: "openai-compatible",
        aiApiUrl: "https://api.openai.com/v1/chat/completions",
        aiApiKey: "legacy-key",
        aiModel: "legacy-model",
        aiPrompt: "legacy"
      }
    } as never)).toEqual({
      ...DEFAULT_SETTINGS,
      aiModelConfigs: [],
      activeAiModelId: "",
      aiSectionCollapsed: true
    });
  });
});
