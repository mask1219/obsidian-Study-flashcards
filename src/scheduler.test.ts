import { describe, expect, it, vi } from "vitest";
import { applyScheduledReview } from "./scheduler";
import type { Flashcard, NoteFlashcardsSettings } from "./types";

const BASE_SETTINGS: NoteFlashcardsSettings = {
  generatorMode: "rule",
  maxCardsPerNote: 10,
  summaryLength: 120,
  ignoredFolders: [],
  newCardsPerDay: 20,
  showAllCardsInReview: false,
  learningStepsMinutes: [1, 10],
  graduatingIntervalDays: 3,
  easyIntervalDays: 7
};

function createCard(overrides: Partial<Flashcard> = {}): Flashcard {
  return {
    id: "card-1",
    question: "Q",
    answer: "A",
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
    inMistakeBook: false,
    isMastered: false,
    mistakeSuccessStreak: 0,
    ...overrides
  };
}

describe("applyScheduledReview", () => {
  it("moves a new card into the next learning step on good", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-12T08:00:00.000Z"));

    const reviewed = applyScheduledReview(createCard(), "good", BASE_SETTINGS);

    expect(reviewed.cardState).toBe("learning");
    expect(reviewed.learningStep).toBe(1);
    expect(reviewed.reviewCount).toBe(1);
    expect(reviewed.dueAt).toBe("2026-04-12T08:10:00.000Z");

    vi.useRealTimers();
  });

  it("graduates a learning card into review when the last step passes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-12T08:00:00.000Z"));

    const reviewed = applyScheduledReview(createCard({ cardState: "learning", learningStep: 1 }), "good", BASE_SETTINGS);

    expect(reviewed.cardState).toBe("review");
    expect(reviewed.learningStep).toBe(0);
    expect(reviewed.intervalDays).toBe(BASE_SETTINGS.graduatingIntervalDays);
    expect(reviewed.repetition).toBe(1);
    expect(reviewed.dueAt).toBe("2026-04-15T08:00:00.000Z");

    vi.useRealTimers();
  });

  it("resets a review card to learning on again and records a lapse", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-12T08:00:00.000Z"));

    const reviewed = applyScheduledReview(createCard({ cardState: "review", repetition: 3, intervalDays: 8, easeFactor: 2.5 }), "again", BASE_SETTINGS);

    expect(reviewed.cardState).toBe("learning");
    expect(reviewed.learningStep).toBe(0);
    expect(reviewed.repetition).toBe(0);
    expect(reviewed.intervalDays).toBe(0);
    expect(reviewed.lapseCount).toBe(1);
    expect(reviewed.easeFactor).toBe(2.3);
    expect(reviewed.dueAt).toBe("2026-04-12T08:01:00.000Z");

    vi.useRealTimers();
  });
});
