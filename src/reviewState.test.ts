import { describe, expect, it } from "vitest";
import { getWrappedReviewIndex, resolveReviewIndex } from "./reviewState";
import type { Flashcard } from "./types";

function createCard(overrides: Partial<Flashcard> = {}): Flashcard {
  return {
    id: "card-1",
    question: "Q",
    answer: "A",
    sourcePath: "folder/note.md",
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

describe("reviewState", () => {
  it("resolves preferred card index when card still exists", () => {
    const cards = [createCard({ id: "a" }), createCard({ id: "b" }), createCard({ id: "c" })];
    expect(resolveReviewIndex(cards, 0, "b", 0)).toBe(1);
  });

  it("falls back to preferred index when preferred card is missing", () => {
    const cards = [createCard({ id: "a" }), createCard({ id: "b" })];
    expect(resolveReviewIndex(cards, 0, "missing", 1)).toBe(1);
    expect(resolveReviewIndex(cards, 0, "missing", 5)).toBe(1);
  });

  it("clamps current index when no preferred card is provided", () => {
    const cards = [createCard({ id: "a" }), createCard({ id: "b" })];
    expect(resolveReviewIndex(cards, 1)).toBe(1);
    expect(resolveReviewIndex(cards, 9)).toBe(1);
  });

  it("returns zero when no cards exist", () => {
    expect(resolveReviewIndex([], 3, "a", 2)).toBe(0);
    expect(getWrappedReviewIndex(0, 0, 1)).toBe(0);
  });

  it("wraps review index forward and backward", () => {
    expect(getWrappedReviewIndex(0, 3, 1)).toBe(1);
    expect(getWrappedReviewIndex(2, 3, 1)).toBe(0);
    expect(getWrappedReviewIndex(0, 3, -1)).toBe(2);
  });
});
