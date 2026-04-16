import { describe, expect, it } from "vitest";
import { resolveMistakeTopic } from "./mistakeTopicState";
import type { Flashcard, NoteFlashcardsSettings } from "./types";

function createSettings(overrides: Partial<NoteFlashcardsSettings> = {}): NoteFlashcardsSettings {
  return {
    generatorMode: "ai",
    maxCardsPerNote: 10,
    summaryLength: 120,
    mistakeTopicCardEntryEnabled: true,
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

function createCard(overrides: Partial<Flashcard> = {}): Flashcard {
  return {
    id: "card-1",
    question: "哈希表的时间复杂度是什么？",
    answer: "平均 O(1)。",
    sourcePath: "note.md",
    generatorType: "rule",
    createdAt: "2026-04-12T00:00:00.000Z",
    dueAt: "2026-04-12T00:00:00.000Z",
    intervalDays: 0,
    easeFactor: 2.5,
    repetition: 0,
    lapseCount: 0,
    reviewCount: 0,
    cardState: "new",
    learningStep: 0,
    inMistakeBook: true,
    isMastered: false,
    mistakeSuccessStreak: 0,
    ...overrides
  };
}

describe("mistakeTopicState", () => {
  it("prioritizes sourceHeading before sourceAnchorText and question", async () => {
    const result = await resolveMistakeTopic(
      createCard({
        sourceHeading: "二分查找",
        sourceAnchorText: "查找边界"
      }),
      createSettings(),
      async () => "不该调用"
    );
    expect(result).toEqual({
      topic: "二分查找",
      source: "sourceHeading"
    });
  });

  it("falls back to sourceAnchorText when heading is missing", async () => {
    const result = await resolveMistakeTopic(
      createCard({
        sourceHeading: "",
        sourceAnchorText: "链表反转"
      }),
      createSettings(),
      async () => "不该调用"
    );
    expect(result).toEqual({
      topic: "链表反转",
      source: "sourceAnchorText"
    });
  });

  it("extracts topic from question when local headings are missing", async () => {
    const result = await resolveMistakeTopic(
      createCard({
        sourceHeading: "",
        sourceAnchorText: "",
        question: "哈希表的冲突怎么处理？"
      }),
      createSettings(),
      async () => "不该调用"
    );
    expect(result.topic).toBe("哈希表");
    expect(result.source).toBe("question");
  });

  it("uses AI fallback when local topic cannot be resolved", async () => {
    const result = await resolveMistakeTopic(
      createCard({
        sourceHeading: "",
        sourceAnchorText: "",
        question: "请解释这道题。"
      }),
      createSettings(),
      async () => "动态规划"
    );
    expect(result).toEqual({
      topic: "动态规划",
      source: "ai"
    });
  });

  it("returns no-ai-model hint when AI fallback cannot run", async () => {
    const result = await resolveMistakeTopic(
      createCard({
        sourceHeading: "",
        sourceAnchorText: "",
        question: "请解释这道题。"
      }),
      createSettings(),
      async () => {
        throw new Error("未配置任何 AI 模型，请先新增模型配置。");
      }
    );
    expect(result.topic).toBeNull();
    expect(result.error).toContain("未配置可用 AI 模型");
  });
});
