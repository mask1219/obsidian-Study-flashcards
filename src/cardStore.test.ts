import { describe, expect, it, vi } from "vitest";
import { CardStore } from "./cardStore";
import type { Flashcard, NoteFlashcardsSettings } from "./types";

const SETTINGS: NoteFlashcardsSettings = {
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

function createStore(cards: Flashcard[]) {
  let persisted: Awaited<ReturnType<CardStore["getData"]>> = { cards, settings: SETTINGS };
  const store = new CardStore(
    async () => persisted,
    async (data) => {
      persisted = data;
    }
  );

  return {
    store,
    getPersisted: () => persisted
  };
}

describe("CardStore mistake book behavior", () => {
  it("adds card to mistake book on again", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-12T08:00:00.000Z"));

    const { store } = createStore([createCard()]);
    const reviewed = await store.applyReview("card-1", "again");

    expect(reviewed?.inMistakeBook).toBe(true);
    expect(reviewed?.mistakeSuccessStreak).toBe(0);

    vi.useRealTimers();
  });

  it("increments streak on good for cards already in mistake book", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-12T08:00:00.000Z"));

    const { store } = createStore([createCard({ inMistakeBook: true, mistakeSuccessStreak: 0 })]);
    const reviewed = await store.applyReview("card-1", "good");

    expect(reviewed?.inMistakeBook).toBe(true);
    expect(reviewed?.mistakeSuccessStreak).toBe(1);

    vi.useRealTimers();
  });

  it("auto removes card from mistake book after consecutive successes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-12T08:00:00.000Z"));

    const { store } = createStore([createCard({ inMistakeBook: true, mistakeSuccessStreak: 1 })]);
    const reviewed = await store.applyReview("card-1", "easy");

    expect(reviewed?.inMistakeBook).toBe(false);
    expect(reviewed?.mistakeSuccessStreak).toBe(0);

    vi.useRealTimers();
  });

  it("clears mastered mistake cards in bulk", async () => {
    const { store, getPersisted } = createStore([
      createCard({ id: "a", inMistakeBook: true, mistakeSuccessStreak: 2 }),
      createCard({ id: "b", inMistakeBook: true, mistakeSuccessStreak: 1 }),
      createCard({ id: "c", inMistakeBook: false, mistakeSuccessStreak: 2 })
    ]);

    const removed = await store.clearMasteredMistakeCards();

    expect(removed).toBe(1);
    expect(getPersisted().cards.find((card) => card.id === "a")).toMatchObject({
      inMistakeBook: false,
      mistakeSuccessStreak: 0
    });
    expect(getPersisted().cards.find((card) => card.id === "b")?.inMistakeBook).toBe(true);
  });

  it("resets all cards while preserving settings", async () => {
    const { store, getPersisted } = createStore([
      createCard({ id: "a" }),
      createCard({ id: "b", inMistakeBook: true, isMastered: true })
    ]);

    await store.resetCards();

    expect(getPersisted()).toEqual({
      cards: [],
      settings: SETTINGS
    });
  });

  it("marks cards as mastered and removes them from mistake book", async () => {
    const { store, getPersisted } = createStore([
      createCard({ id: "a", inMistakeBook: true, isMastered: false, mistakeSuccessStreak: 1 })
    ]);

    const updated = await store.setMastered("a", true);

    expect(updated).toMatchObject({
      isMastered: true,
      inMistakeBook: false,
      mistakeSuccessStreak: 0
    });
    expect(getPersisted().cards[0]).toMatchObject({
      isMastered: true,
      inMistakeBook: false
    });
  });
});
