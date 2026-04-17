import { describe, expect, it } from "vitest";
import { CardStore } from "./cardStore";
import type { Flashcard, NoteFlashcardsSettings } from "./types";

const SETTINGS: NoteFlashcardsSettings = {
  generatorMode: "rule",
  maxCardsPerNote: 10,
  summaryLength: 120,
  mistakeTopicCardEntryEnabled: true,
  aiModelConfigs: [],
  activeAiModelId: "",
  aiSectionCollapsed: true,
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
    () => Promise.resolve(persisted),
    (data) => {
      persisted = data;
      return Promise.resolve();
    }
  );

  return {
    store,
    getPersisted: () => persisted
  };
}

describe("CardStore mistake book behavior", () => {
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

  it("appends non-duplicate cards and returns dedupe stats", async () => {
    const { store, getPersisted } = createStore([
      createCard({ id: "a", question: "什么是哈希表？", answer: "键值映射结构。" })
    ]);

    const result = await store.appendCardsWithDedupe([
      createCard({ id: "b", question: "什么是哈希表？", answer: "一种数据结构。" }),
      createCard({ id: "c", question: "哈希冲突如何处理？", answer: "链地址法或开放寻址。" })
    ]);

    expect(result).toEqual({ addedCount: 1, skippedCount: 1 });
    expect(getPersisted().cards.map((card) => card.id)).toEqual(["a", "c"]);
  });
});
