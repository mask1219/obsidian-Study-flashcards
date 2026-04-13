import { describe, expect, it, vi } from "vitest";
import { GenerationService } from "./generationService";
import type { Flashcard, NoteFlashcardsSettings, ParsedSection } from "./types";

vi.mock("./noteParser", () => ({
  parseMarkdownSections: vi.fn((markdown: string, sourcePath: string) => markdown ? [{ heading: "概念", content: markdown, listItems: [], sourcePath }] : [])
}));

vi.mock("./generationStrategy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./generationStrategy")>();
  return {
    ...actual,
    generateCardsForSections: vi.fn(async (sections: ParsedSection[]) => sections.map((section: ParsedSection, index: number) => ({
      id: `${section.sourcePath}-${index}`,
      question: `${section.heading}?`,
      answer: section.content,
      sourcePath: section.sourcePath,
      sourceHeading: section.heading,
      sourceAnchorText: section.sourceAnchorText,
      sourceStartLine: section.sourceStartLine,
      sourceEndLine: section.sourceEndLine,
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
      mistakeSuccessStreak: 0
    })))
  };
});

const SETTINGS: NoteFlashcardsSettings = {
  generatorMode: "rule",
  maxCardsPerNote: 10,
  summaryLength: 120,
  aiProvider: "openai-compatible",
  aiApiUrl: "https://api.openai.com/v1/chat/completions",
  aiApiKey: "",
  aiModel: "",
  aiPrompt: "",
  ignoredFolders: [],
  newCardsPerDay: 2,
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

function createService(cards: Flashcard[], settings: NoteFlashcardsSettings = SETTINGS, overrides: {
  replaceCardsForSource?: (sourcePath: string, newCards: Flashcard[]) => Promise<number>;
  cachedRead?: (file: { path: string }) => Promise<string>;
  getMarkdownFiles?: () => Array<{ path: string; basename: string }>;
  getAbstractFileByPath?: (path: string) => unknown;
} = {}): GenerationService {
  const store = {
    getCards: async () => cards,
    replaceCardsForSource: overrides.replaceCardsForSource ?? (async () => 0)
  } as never;
  const vault = {
    getAbstractFileByPath: overrides.getAbstractFileByPath ?? (() => null),
    cachedRead: overrides.cachedRead ?? (async () => ""),
    getMarkdownFiles: overrides.getMarkdownFiles ?? (() => [])
  } as never;

  return new GenerationService(vault, store, () => settings);
}

describe("GenerationService", () => {
  it("generates cards for a file and replaces cards for that source", async () => {
    const replaceCardsForSource = vi.fn(async (_sourcePath: string, newCards: Flashcard[]) => newCards.length);
    const service = createService([], SETTINGS, {
      replaceCardsForSource,
      cachedRead: async () => "定义：说明"
    });

    const count = await service.generateForFile({ path: "folder/note.md", basename: "note" } as never);

    expect(count).toBe(1);
    expect(replaceCardsForSource).toHaveBeenCalledWith(
      "folder/note.md",
      expect.arrayContaining([expect.objectContaining({ sourcePath: "folder/note.md" })])
    );
  });

  it("generates cards for a folder while skipping ignored folders", async () => {
    const replaceCardsForSource = vi.fn(async (_sourcePath: string, newCards: Flashcard[]) => newCards.length);
    const service = createService([], { ...SETTINGS, ignoredFolders: ["folder/skip"] }, {
      replaceCardsForSource,
      cachedRead: async (file) => file.path.includes("keep") ? "保留内容" : "跳过内容",
      getMarkdownFiles: () => [
        { path: "folder/keep.md", basename: "keep" },
        { path: "folder/skip/ignored.md", basename: "ignored" },
        { path: "folder-archive/should-not-match.md", basename: "archive" },
        { path: "other/outside.md", basename: "outside" }
      ]
    });

    const count = await service.generateForFolder("folder");

    expect(count).toBe(1);
    expect(replaceCardsForSource).toHaveBeenCalledTimes(1);
    expect(replaceCardsForSource).toHaveBeenCalledWith(
      "folder/keep.md",
      expect.arrayContaining([expect.objectContaining({ sourcePath: "folder/keep.md" })])
    );
  });

  it("limits due new cards by daily setting while keeping due review cards", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-12T08:00:00.000Z"));

    const service = createService([
      createCard({ id: "due-review", cardState: "review", dueAt: "2026-04-12T07:00:00.000Z", sourcePath: "folder/a.md", sourceStartLine: 1 }),
      createCard({ id: "new-early", cardState: "new", createdAt: "2026-04-10T00:00:00.000Z", dueAt: "2026-04-12T06:00:00.000Z", sourcePath: "folder/a.md", sourceStartLine: 2 }),
      createCard({ id: "new-late", cardState: "new", createdAt: "2026-04-11T00:00:00.000Z", dueAt: "2026-04-12T06:10:00.000Z", sourcePath: "folder/a.md", sourceStartLine: 3 }),
      createCard({ id: "future-review", cardState: "review", dueAt: "2026-04-13T08:00:00.000Z", sourcePath: "folder/a.md", sourceStartLine: 4 })
    ], { ...SETTINGS, newCardsPerDay: 1, showAllCardsInReview: false });

    const session = await service.getStudySession({
      scope: "all",
      countMode: "all",
      orderMode: "sequential",
      includeMistakeBookOnly: false,
      excludeMastered: false
    });

    expect(session.cards.map((card) => card.id)).toEqual(["due-review", "new-early"]);
    expect(session.totalCards).toBe(2);
    expect(session.selectedCount).toBe(2);

    vi.useRealTimers();
  });

  it("returns empty queue when no cards are due and showAllCardsInReview is disabled", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-12T08:00:00.000Z"));

    const service = createService([
      createCard({ id: "future-new", dueAt: "2026-04-13T08:00:00.000Z" }),
      createCard({ id: "future-review", cardState: "review", dueAt: "2026-04-13T09:00:00.000Z" })
    ], { ...SETTINGS, showAllCardsInReview: false });

    const session = await service.getStudySession({
      scope: "all",
      countMode: "all",
      orderMode: "sequential",
      includeMistakeBookOnly: false,
      excludeMastered: false
    });

    expect(session.cards).toEqual([]);
    expect(session.totalCards).toBe(0);

    vi.useRealTimers();
  });

  it("falls back to all cards when no cards are due and showAllCardsInReview is enabled", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-12T08:00:00.000Z"));

    const service = createService([
      createCard({ id: "future-a", sourcePath: "folder/a.md", sourceStartLine: 2, dueAt: "2026-04-13T08:00:00.000Z" }),
      createCard({ id: "future-b", sourcePath: "folder/a.md", sourceStartLine: 1, dueAt: "2026-04-13T09:00:00.000Z" })
    ], { ...SETTINGS, showAllCardsInReview: true });

    const session = await service.getStudySession({
      scope: "all",
      countMode: "all",
      orderMode: "sequential",
      includeMistakeBookOnly: false,
      excludeMastered: false
    });

    expect(session.cards.map((card) => card.id)).toEqual(["future-b", "future-a"]);
    expect(session.totalCards).toBe(2);

    vi.useRealTimers();
  });

  it("builds a study session for sequential and filtered study mode", async () => {
    const service = createService([
      createCard({ id: "mastered", isMastered: true, sourcePath: "folder/a.md", sourceStartLine: 1 }),
      createCard({ id: "mistake-2", inMistakeBook: true, sourcePath: "folder/a.md", sourceStartLine: 2 }),
      createCard({ id: "mistake-1", inMistakeBook: true, sourcePath: "folder/a.md", sourceStartLine: 1 }),
      createCard({ id: "other-folder", inMistakeBook: true, sourcePath: "other/b.md", sourceStartLine: 1 })
    ]);

    const session = await service.getStudySession({
      scope: "folder",
      sourcePath: "folder/",
      countMode: "all",
      orderMode: "sequential",
      includeMistakeBookOnly: true,
      excludeMastered: true
    });

    expect(session.cards.map((card) => card.id)).toEqual(["mistake-1", "mistake-2"]);
    expect(session.totalCards).toBe(2);
    expect(session.selectedCount).toBe(2);
    expect(session.sessionCardIds).toEqual(["mistake-1", "mistake-2"]);
  });

  it("reuses provided session card ids for stable study sessions", async () => {
    const service = createService([
      createCard({ id: "card-1", cardState: "review" }),
      createCard({ id: "card-2", cardState: "review" }),
      createCard({ id: "card-3", cardState: "review" }),
      createCard({ id: "card-4", cardState: "review" })
    ], { ...SETTINGS, newCardsPerDay: 1 });

    const session = await service.getStudySession({
      scope: "all",
      countMode: "random10",
      orderMode: "random",
      includeMistakeBookOnly: false,
      excludeMastered: false
    }, ["card-3", "card-1"]);

    expect(session.cards.map((card) => card.id)).toEqual(["card-3", "card-1"]);
    expect(session.sessionCardIds).toEqual(["card-3", "card-1"]);
  });
});
