import { describe, expect, it } from "vitest";
import { getStudyDisplayState } from "./studyViewModel";
import type { Flashcard } from "./types";

function createCard(overrides: Partial<Flashcard> = {}): Flashcard {
  return {
    id: "card-1",
    question: "Q",
    answer: "A",
    sourcePath: "folder/note.md",
    sourceHeading: "概念",
    generatorType: "rule",
    createdAt: "2026-04-10T00:00:00.000Z",
    dueAt: "2026-04-10T00:00:00.000Z",
    intervalDays: 0,
    easeFactor: 2.5,
    repetition: 0,
    lapseCount: 0,
    reviewCount: 0,
    cardState: "new",
    learningStep: 0,
    inMistakeBook: false,
    isMastered: false,
    mistakeSuccessStreak: 0,
    ...overrides
  };
}

describe("getStudyDisplayState", () => {
  it("builds selection summary, numbering, stats, and current card actions", () => {
    const display = getStudyDisplayState({
      cards: [
        createCard({ id: "m", inMistakeBook: true }),
        createCard({ id: "x", isMastered: true }),
        createCard({ id: "n" })
      ],
      index: 1,
      flipped: false,
      scope: "folder",
      countMode: "random10",
      orderMode: "sequential",
      includeMistakeBookOnly: true,
      excludeMastered: true
    });

    expect(display.selectionSummary).toContain("当前文件夹");
    expect(display.selectionSummary).toContain("随机 10 题");
    expect(display.currentCard).toMatchObject({
      title: "问题 2",
      masteredToggleLabel: "取消已掌握",
      masteredToggleClass: "note-flashcards-mastered-active"
    });
    expect(display.stats).toEqual([
      expect.objectContaining({ label: "错题本", value: "1" }),
      expect.objectContaining({ label: "已掌握", value: "1" }),
      expect.objectContaining({ label: "学习中", value: "1" })
    ]);
  });

  it("returns empty state when there are no cards", () => {
    const display = getStudyDisplayState({
      cards: [],
      index: 0,
      flipped: false,
      scope: "all",
      countMode: "all",
      orderMode: "random",
      includeMistakeBookOnly: false,
      excludeMastered: false
    });

    expect(display.currentCard).toBeUndefined();
    expect(display.emptyState.title).toBe("当前条件下没有可学习的卡片。");
  });
});
