import { describe, expect, it } from "vitest";
import { getStudySession } from "./studySession";
import type { Flashcard, StudySessionOptions } from "./types";

function createCard(overrides: Partial<Flashcard> = {}): Flashcard {
  return {
    id: "card-1",
    question: "Q",
    answer: "A",
    sourcePath: "folder/note.md",
    sourceHeading: "概念",
    sourceAnchorText: "概念",
    sourceStartLine: 1,
    sourceEndLine: 2,
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

function createOptions(overrides: Partial<StudySessionOptions> = {}): StudySessionOptions {
  return {
    scope: "all",
    countMode: "all",
    orderMode: "sequential",
    includeMistakeBookOnly: false,
    excludeMastered: false,
    ...overrides
  };
}

describe("getStudySession", () => {
  it("filters mastered cards when requested", () => {
    const session = getStudySession([
      createCard({ id: "normal" }),
      createCard({ id: "mastered", isMastered: true })
    ], createOptions({ excludeMastered: true }));

    expect(session.cards.map((card) => card.id)).toEqual(["normal"]);
    expect(session.totalCards).toBe(1);
    expect(session.selectedCount).toBe(1);
  });

  it("keeps only mistake book cards when requested", () => {
    const session = getStudySession([
      createCard({ id: "normal" }),
      createCard({ id: "mistake", inMistakeBook: true })
    ], createOptions({ includeMistakeBookOnly: true }));

    expect(session.cards.map((card) => card.id)).toEqual(["mistake"]);
    expect(session.totalCards).toBe(1);
  });

  it("sorts sequential sessions by source path and source line", () => {
    const session = getStudySession([
      createCard({ id: "b-20", sourcePath: "b.md", sourceStartLine: 20 }),
      createCard({ id: "a-10", sourcePath: "a.md", sourceStartLine: 10 }),
      createCard({ id: "a-2", sourcePath: "a.md", sourceStartLine: 2 })
    ], createOptions({ orderMode: "sequential" }));

    expect(session.cards.map((card) => card.id)).toEqual(["a-2", "a-10", "b-20"]);
  });

  it("limits random10 sessions to the first ten cards after random ordering", () => {
    const randomValues = [0.1, 0.7, 0.2, 0.9, 0.3, 0.8, 0.4, 0.6, 0.5, 0.05, 0.15];
    let index = 0;
    const random = () => randomValues[index++] ?? 0;
    const cards = Array.from({ length: 12 }, (_, cardIndex) => createCard({ id: `card-${cardIndex + 1}` }));

    const session = getStudySession(cards, createOptions({ countMode: "random10", orderMode: "random" }), random);

    expect(session.cards).toHaveLength(10);
    expect(session.selectedCount).toBe(10);
    expect(session.totalCards).toBe(12);
    expect(session.sessionCardIds).toEqual(session.cards.map((card) => card.id));
  });

  it("reuses existing session card ids for stable random10 sessions", () => {
    const cards = Array.from({ length: 12 }, (_, cardIndex) => createCard({ id: `card-${cardIndex + 1}` }));
    const sessionCardIds = ["card-8", "card-3", "card-11", "card-1"];

    const session = getStudySession(
      cards,
      createOptions({ countMode: "random10", orderMode: "random" }),
      () => 0.99,
      sessionCardIds
    );

    expect(session.cards.map((card) => card.id)).toEqual(sessionCardIds);
    expect(session.sessionCardIds).toEqual(sessionCardIds);
    expect(session.selectedCount).toBe(4);
    expect(session.totalCards).toBe(12);
  });
});
