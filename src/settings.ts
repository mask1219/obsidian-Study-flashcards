import type { NoteFlashcardsSettings } from "./types";

export const DEFAULT_SETTINGS: NoteFlashcardsSettings = {
  generatorMode: "rule",
  maxCardsPerNote: 12,
  summaryLength: 220,
  mistakeTopicCardEntryEnabled: true,
  aiModelConfigs: [],
  activeAiModelId: "",
  aiSectionCollapsed: true,
  ignoredFolders: [],
  newCardsPerDay: 10,
  showAllCardsInReview: false,
  learningStepsMinutes: [1, 10],
  graduatingIntervalDays: 1,
  easyIntervalDays: 4
};
