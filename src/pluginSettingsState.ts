import { DEFAULT_SETTINGS } from "./settings";
import { sanitizeAiModelConfigs } from "./aiModelState";
import type { NoteFlashcardsSettings } from "./types";

export function loadPersistedSettings(data: unknown): NoteFlashcardsSettings {
  const rawSettings = ((data && typeof data === "object" ? (data as { settings?: Partial<NoteFlashcardsSettings> }).settings : undefined) ?? {});
  const aiModelConfigs = sanitizeAiModelConfigs(rawSettings.aiModelConfigs);
  const activeAiModelId = typeof rawSettings.activeAiModelId === "string" ? rawSettings.activeAiModelId : "";

  return {
    generatorMode: rawSettings.generatorMode ?? DEFAULT_SETTINGS.generatorMode,
    maxCardsPerNote: rawSettings.maxCardsPerNote ?? DEFAULT_SETTINGS.maxCardsPerNote,
    summaryLength: rawSettings.summaryLength ?? DEFAULT_SETTINGS.summaryLength,
    mistakeTopicCardEntryEnabled: typeof rawSettings.mistakeTopicCardEntryEnabled === "boolean"
      ? rawSettings.mistakeTopicCardEntryEnabled
      : DEFAULT_SETTINGS.mistakeTopicCardEntryEnabled,
    aiModelConfigs,
    activeAiModelId: aiModelConfigs.some((config) => config.id === activeAiModelId) ? activeAiModelId : "",
    aiSectionCollapsed: typeof rawSettings.aiSectionCollapsed === "boolean" ? rawSettings.aiSectionCollapsed : DEFAULT_SETTINGS.aiSectionCollapsed,
    ignoredFolders: rawSettings.ignoredFolders ?? DEFAULT_SETTINGS.ignoredFolders,
    newCardsPerDay: rawSettings.newCardsPerDay ?? DEFAULT_SETTINGS.newCardsPerDay,
    showAllCardsInReview: rawSettings.showAllCardsInReview ?? DEFAULT_SETTINGS.showAllCardsInReview,
    learningStepsMinutes: rawSettings.learningStepsMinutes ?? DEFAULT_SETTINGS.learningStepsMinutes,
    graduatingIntervalDays: rawSettings.graduatingIntervalDays ?? DEFAULT_SETTINGS.graduatingIntervalDays,
    easyIntervalDays: rawSettings.easyIntervalDays ?? DEFAULT_SETTINGS.easyIntervalDays
  };
}

export function buildSavedPluginData(data: unknown, settings: NoteFlashcardsSettings): { settings: NoteFlashcardsSettings; cards: unknown[] } & Record<string, unknown> {
  const existing = data && typeof data === "object" ? data as Record<string, unknown> & { cards?: unknown[] } : {};
  return {
    ...existing,
    settings,
    cards: Array.isArray(existing.cards) ? existing.cards : []
  };
}
