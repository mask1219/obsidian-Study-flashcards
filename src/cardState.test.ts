import { describe, expect, it, vi } from "vitest";
import { clearMistakeBookState, isMasteredMistakeCard, normalizeCard, setMasteredState, setMistakeBookState, updateMistakeBookState } from "./cardState";
import type { Flashcard } from "./types";

function createCard(overrides: Partial<Flashcard> = {}): Flashcard {
  return {
    id: "card-1",
    question: "Q",
    answer: "A",
    sourcePath: "note.md",
    generatorType: "rule",
    createdAt: "2026-04-12T00:00:00.000Z",
    dueAt: "2026-04-12T00:00:00.000Z",
    intervalDays: 5,
    easeFactor: 2.5,
    repetition: 2,
    lapseCount: 0,
    reviewCount: 0,
    cardState: "review",
    learningStep: 0,
    inMistakeBook: false,
    isMastered: false,
    mistakeSuccessStreak: 0,
    ...overrides
  };
}

describe("cardState", () => {
  it("fills missing legacy fields during normalization", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-12T08:00:00.000Z"));

    const card = normalizeCard({
      id: "legacy",
      question: "Q",
      answer: "A",
      sourcePath: "note.md",
      generatorType: "rule"
    } as Flashcard);

    expect(card).toMatchObject({
      createdAt: "2026-04-12T08:00:00.000Z",
      dueAt: "2026-04-12T08:00:00.000Z",
      intervalDays: 0,
      easeFactor: 2.5,
      repetition: 0,
      lapseCount: 0,
      reviewCount: 0,
      cardState: "new",
      learningStep: 0,
      inMistakeBook: false,
      isMastered: false,
      mistakeSuccessStreak: 0
    });

    vi.useRealTimers();
  });

  it("resets streak when manually toggling mistake book state", () => {
    expect(setMistakeBookState(createCard({ mistakeSuccessStreak: 3, isMastered: true }), true)).toMatchObject({
      inMistakeBook: true,
      isMastered: false,
      mistakeSuccessStreak: 0
    });
    expect(clearMistakeBookState(createCard({ inMistakeBook: true, mistakeSuccessStreak: 2 }))).toMatchObject({
      inMistakeBook: false,
      mistakeSuccessStreak: 0
    });
  });

  it("marks cards as mastered and removes them from mistake book", () => {
    expect(setMasteredState(createCard({ inMistakeBook: true, mistakeSuccessStreak: 2 }), true)).toMatchObject({
      isMastered: true,
      inMistakeBook: false,
      mistakeSuccessStreak: 0
    });
    expect(setMasteredState(createCard({ isMastered: true }), false)).toMatchObject({
      isMastered: false
    });
  });

  it("tracks mastered mistake cards", () => {
    expect(isMasteredMistakeCard(createCard({ inMistakeBook: true, mistakeSuccessStreak: 2 }))).toBe(true);
    expect(isMasteredMistakeCard(createCard({ inMistakeBook: true, mistakeSuccessStreak: 1 }))).toBe(false);
  });

  it("updates mistake book state from ratings without changing behavior", () => {
    expect(updateMistakeBookState(createCard(), "again")).toMatchObject({
      inMistakeBook: true,
      mistakeSuccessStreak: 0
    });
    expect(updateMistakeBookState(createCard({ inMistakeBook: true, mistakeSuccessStreak: 0 }), "good")).toMatchObject({
      inMistakeBook: true,
      mistakeSuccessStreak: 1
    });
    expect(updateMistakeBookState(createCard({ inMistakeBook: true, mistakeSuccessStreak: 1 }), "easy")).toMatchObject({
      inMistakeBook: false,
      mistakeSuccessStreak: 0
    });
    expect(updateMistakeBookState(createCard({ inMistakeBook: true, mistakeSuccessStreak: 1 }), "hard")).toMatchObject({
      inMistakeBook: true,
      mistakeSuccessStreak: 0
    });
  });
});
