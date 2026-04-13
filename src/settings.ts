import type { NoteFlashcardsSettings } from "./types";

export const DEFAULT_SETTINGS: NoteFlashcardsSettings = {
  generatorMode: "rule",
  maxCardsPerNote: 12,
  summaryLength: 220,
  aiProvider: "openai-compatible",
  aiApiUrl: "https://api.openai.com/v1/chat/completions",
  aiApiKey: "",
  aiModel: "",
  aiPrompt: "",
  ignoredFolders: [],
  newCardsPerDay: 10,
  showAllCardsInReview: false,
  learningStepsMinutes: [1, 10],
  graduatingIntervalDays: 1,
  easyIntervalDays: 4
};
