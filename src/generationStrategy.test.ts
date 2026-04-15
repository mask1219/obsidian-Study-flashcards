import { AI_MODEL_ERRORS } from "./aiModelState";
import { describe, expect, it } from "vitest";
import { GENERATION_COPY, generateCardsForSections } from "./generationStrategy";
import type { NoteFlashcardsSettings, ParsedSection } from "./types";

const SECTIONS: ParsedSection[] = [
  {
    heading: "概念",
    content: "定义：说明",
    listItems: ["要点一"],
    sourcePath: "note.md"
  }
];

function createSettings(overrides: Partial<NoteFlashcardsSettings> = {}): NoteFlashcardsSettings {
  return {
    generatorMode: "rule",
    maxCardsPerNote: 10,
    summaryLength: 100,
    aiModelConfigs: [],
    activeAiModelId: "",
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

describe("generateCardsForSections", () => {
  it("uses the rule generator in rule mode", async () => {
    const cards = await generateCardsForSections(SECTIONS, createSettings({ generatorMode: "rule" }));

    expect(cards).toHaveLength(3);
  });

  it("throws when no AI model config is available in ai mode", async () => {
    await expect(generateCardsForSections(SECTIONS, createSettings({ generatorMode: "ai" }))).rejects.toThrow(AI_MODEL_ERRORS.noConfigs);
  });

  it("does not fall back to rule generation in hybrid mode when AI fails", async () => {
    await expect(generateCardsForSections(SECTIONS, createSettings({ generatorMode: "hybrid" }))).rejects.toThrow(AI_MODEL_ERRORS.noConfigs);
  });
});
