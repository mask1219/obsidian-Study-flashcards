import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { WorkspaceLeaf } from "obsidian";
import { ReviewView } from "./reviewView";
import type { Flashcard, StudySessionResult } from "./types";

type OpenFileTarget = { path: string };

type LeafEditor = {
  setCursor: ReturnType<typeof vi.fn>;
  scrollIntoView: ReturnType<typeof vi.fn>;
};

type LeafViewMock = {
  setEphemeralState: ReturnType<typeof vi.fn>;
  editor: LeafEditor;
};

type TestableReviewView = {
  render: ReturnType<typeof vi.fn>;
  app: {
    workspace: {
      getActiveViewOfType: () => ReviewView;
      getLeaf: () => WorkspaceLeaf;
    };
  };
  cards: Flashcard[];
  index: number;
  flipped: boolean;
  totalCards: number;
  selectedCount: number;
  sessionCardIds: string[];
  includeMistakeBookOnly: boolean;
  excludeMastered: boolean;
  studyScope: "current" | "folder" | "all";
  countMode: "random10" | "all";
  orderMode: "random" | "sequential";
  handleKeydown: (event: { key: string; preventDefault: () => void; target: HTMLElement }) => void;
  reloadCards: ReturnType<typeof vi.fn>;
  toggleMistakeBook: (card: Flashcard) => Promise<void>;
  toggleMastered: (card: Flashcard) => Promise<void>;
  openSourceNote: (card: Flashcard) => Promise<void>;
  generateByMistakeTopic: (card: Flashcard) => Promise<void>;
  ensureMistakeTopicResolution: (card: Flashcard) => void;
  getMistakeTopicKey: (card: Flashcard) => string;
  mistakeTopicResolution: { topic: string; source: string } | null;
  mistakeTopicLoading: boolean;
  mistakeTopicKey: string;
};

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

function createSession(overrides: Partial<StudySessionResult> = {}): StudySessionResult {
  const cards = overrides.cards ?? [];
  return {
    cards,
    totalCards: overrides.totalCards ?? cards.length,
    selectedCount: overrides.selectedCount ?? cards.length,
    sessionCardIds: overrides.sessionCardIds ?? cards.map((card) => card.id)
  };
}

function createView(overrides: {
  currentPath?: string;
  currentFolderPath?: string;
  getStudySession?: () => Promise<StudySessionResult>;
} = {}) {
  const generationService = {
    getStudySession: vi.fn(overrides.getStudySession ?? (() => Promise.resolve(createSession()))),
    getFileByPath: vi.fn(),
    getSettingsSnapshot: vi.fn(() => ({
      generatorMode: "ai",
      mistakeTopicCardEntryEnabled: true,
      activeAiModelId: "model-1",
      aiModelConfigs: [{
        id: "model-1",
        name: "默认模型",
        provider: "openai-compatible",
        apiUrl: "https://api.openai.com/v1/chat/completions",
        apiKey: "sk-test",
        model: "gpt-4o-mini",
        prompt: ""
      }]
    })),
    resolveMistakeTopicForCard: vi.fn(() => Promise.resolve({ topic: "哈希表", source: "sourceHeading" })),
    generateForMistakeTopic: vi.fn(() => Promise.resolve({ addedCount: 1, skippedCount: 0 }))
  };
  const cardStore = {
    setMistakeBook: vi.fn(() => Promise.resolve(undefined)),
    setMastered: vi.fn(() => Promise.resolve(undefined)),
    clearMasteredMistakeCards: vi.fn(() => Promise.resolve(0))
  };

  const leaf = new WorkspaceLeaf();
  const openFile = vi.fn((target: OpenFileTarget) => Promise.resolve(target));
  leaf.openFile = openFile as never;
  const leafView: LeafViewMock = {
    setEphemeralState: vi.fn(),
    editor: {
      setCursor: vi.fn(),
      scrollIntoView: vi.fn()
    }
  };
  leaf.view = leafView as never;

  const view = new ReviewView(
    leaf,
    generationService as never,
    cardStore as never,
    () => overrides.currentPath ?? "folder/note.md",
    () => overrides.currentFolderPath ?? "folder"
  );
  const viewAny = view as unknown as TestableReviewView;
  viewAny.render = vi.fn();
  viewAny.app = {
    workspace: {
      getActiveViewOfType: () => view,
      getLeaf: () => leaf
    }
  };

  return { view, viewAny, generationService, cardStore, leaf, openFile, leafView };
}

class FakeHTMLElement {
  constructor(
    public tagName: string,
    public isContentEditable = false
  ) {}
}

const originalHTMLElement = (globalThis as { HTMLElement?: unknown }).HTMLElement;

beforeAll(() => {
  (globalThis as { HTMLElement?: unknown }).HTMLElement = FakeHTMLElement;
});

afterAll(() => {
  (globalThis as { HTMLElement?: unknown }).HTMLElement = originalHTMLElement;
});

describe("ReviewView", () => {
  it("reloads study session and keeps the preferred card when still present", async () => {
    const session = createSession({
      cards: [createCard({ id: "a" }), createCard({ id: "b" })],
      totalCards: 5,
      selectedCount: 2,
      sessionCardIds: ["a", "b"]
    });
    const { view, viewAny, generationService } = createView({
      getStudySession: () => Promise.resolve(session)
    });
    viewAny.flipped = true;

    await view.reloadCards("b", 0);

    expect(generationService.getStudySession).toHaveBeenCalledWith({
      scope: "current",
      sourcePath: "folder/note.md",
      countMode: "random10",
      orderMode: "random",
      includeMistakeBookOnly: false,
      excludeMastered: false
    }, undefined);
    expect(viewAny.cards.map((card) => card.id)).toEqual(["a", "b"]);
    expect(viewAny.sessionCardIds).toEqual(["a", "b"]);
    expect(viewAny.index).toBe(1);
    expect(viewAny.totalCards).toBe(5);
    expect(viewAny.selectedCount).toBe(2);
    expect(viewAny.flipped).toBe(false);
    expect(viewAny.render).toHaveBeenCalled();
  });

  it("reuses the same random10 session ids on refresh", async () => {
    const firstSession = createSession({
      cards: [createCard({ id: "a" }), createCard({ id: "b" })],
      totalCards: 12,
      selectedCount: 2,
      sessionCardIds: ["a", "b"]
    });
    const secondSession = createSession({
      cards: [createCard({ id: "a", inMistakeBook: true }), createCard({ id: "b" })],
      totalCards: 12,
      selectedCount: 2,
      sessionCardIds: ["a", "b"]
    });
    const getStudySession = vi.fn()
      .mockResolvedValueOnce(firstSession)
      .mockResolvedValueOnce(secondSession);
    const { view, viewAny, generationService } = createView({ getStudySession });

    await view.reloadCards();
    await view.reloadCards("a", 0);

    expect(generationService.getStudySession).toHaveBeenNthCalledWith(1, {
      scope: "current",
      sourcePath: "folder/note.md",
      countMode: "random10",
      orderMode: "random",
      includeMistakeBookOnly: false,
      excludeMastered: false
    }, undefined);
    expect(generationService.getStudySession).toHaveBeenNthCalledWith(2, {
      scope: "current",
      sourcePath: "folder/note.md",
      countMode: "random10",
      orderMode: "random",
      includeMistakeBookOnly: false,
      excludeMastered: false
    }, ["a", "b"]);
    expect(viewAny.cards.map((card) => card.id)).toEqual(["a", "b"]);
    expect(viewAny.sessionCardIds).toEqual(["a", "b"]);
  });

  it("does not reuse random10 session ids after filters change", async () => {
    const firstSession = createSession({
      cards: [createCard({ id: "a", inMistakeBook: true }), createCard({ id: "b", inMistakeBook: true })],
      totalCards: 2,
      selectedCount: 2,
      sessionCardIds: ["a", "b"]
    });
    const secondSession = createSession({
      cards: [createCard({ id: "a", inMistakeBook: true }), createCard({ id: "b", inMistakeBook: true }), createCard({ id: "c" })],
      totalCards: 3,
      selectedCount: 3,
      sessionCardIds: ["a", "b", "c"]
    });
    const getStudySession = vi.fn()
      .mockResolvedValueOnce(firstSession)
      .mockResolvedValueOnce(secondSession);
    const { view, viewAny, generationService } = createView({ getStudySession });
    viewAny.includeMistakeBookOnly = true;

    await view.reloadCards();
    viewAny.includeMistakeBookOnly = false;
    await view.reloadCards();

    expect(generationService.getStudySession).toHaveBeenNthCalledWith(1, {
      scope: "current",
      sourcePath: "folder/note.md",
      countMode: "random10",
      orderMode: "random",
      includeMistakeBookOnly: true,
      excludeMastered: false
    }, undefined);
    expect(generationService.getStudySession).toHaveBeenNthCalledWith(2, {
      scope: "current",
      sourcePath: "folder/note.md",
      countMode: "random10",
      orderMode: "random",
      includeMistakeBookOnly: false,
      excludeMastered: false
    }, undefined);
    expect(viewAny.cards.map((card) => card.id)).toEqual(["a", "b", "c"]);
    expect(viewAny.sessionCardIds).toEqual(["a", "b", "c"]);
  });

  it("does not reuse random10 session ids after exclude mastered changes", async () => {
    const firstSession = createSession({
      cards: [createCard({ id: "a" }), createCard({ id: "b" })],
      totalCards: 2,
      selectedCount: 2,
      sessionCardIds: ["a", "b"]
    });
    const secondSession = createSession({
      cards: [createCard({ id: "a" }), createCard({ id: "b" }), createCard({ id: "c", isMastered: true })],
      totalCards: 3,
      selectedCount: 3,
      sessionCardIds: ["a", "b", "c"]
    });
    const getStudySession = vi.fn()
      .mockResolvedValueOnce(firstSession)
      .mockResolvedValueOnce(secondSession);
    const { view, viewAny, generationService } = createView({ getStudySession });
    viewAny.excludeMastered = true;

    await view.reloadCards();
    viewAny.excludeMastered = false;
    await view.reloadCards();

    expect(generationService.getStudySession).toHaveBeenNthCalledWith(1, {
      scope: "current",
      sourcePath: "folder/note.md",
      countMode: "random10",
      orderMode: "random",
      includeMistakeBookOnly: false,
      excludeMastered: true
    }, undefined);
    expect(generationService.getStudySession).toHaveBeenNthCalledWith(2, {
      scope: "current",
      sourcePath: "folder/note.md",
      countMode: "random10",
      orderMode: "random",
      includeMistakeBookOnly: false,
      excludeMastered: false
    }, undefined);
    expect(viewAny.cards.map((card) => card.id)).toEqual(["a", "b", "c"]);
    expect(viewAny.sessionCardIds).toEqual(["a", "b", "c"]);
  });

  it("passes updated study filters into getStudySession", async () => {
    const { view, viewAny, generationService } = createView();
    viewAny.studyScope = "folder";
    viewAny.countMode = "all";
    viewAny.orderMode = "sequential";
    viewAny.includeMistakeBookOnly = true;
    viewAny.excludeMastered = true;

    await view.reloadCards();

    expect(generationService.getStudySession).toHaveBeenCalledWith({
      scope: "folder",
      sourcePath: "folder",
      countMode: "all",
      orderMode: "sequential",
      includeMistakeBookOnly: true,
      excludeMastered: true
    }, undefined);
  });

  it("handles study keyboard shortcuts for flip and navigation", () => {
    const { viewAny } = createView();
    viewAny.cards = [createCard({ id: "a" }), createCard({ id: "b" })];

    const flipEvent = {
      key: " ",
      preventDefault: vi.fn(),
      target: new FakeHTMLElement("DIV") as unknown as HTMLElement
    };
    viewAny.handleKeydown(flipEvent);
    expect(flipEvent.preventDefault).toHaveBeenCalled();
    expect(viewAny.flipped).toBe(true);

    const nextEvent = {
      key: "ArrowRight",
      preventDefault: vi.fn(),
      target: new FakeHTMLElement("DIV") as unknown as HTMLElement
    };
    viewAny.handleKeydown(nextEvent);
    expect(nextEvent.preventDefault).toHaveBeenCalled();
    expect(viewAny.index).toBe(1);
    expect(viewAny.flipped).toBe(false);

    const previousEvent = {
      key: "ArrowLeft",
      preventDefault: vi.fn(),
      target: new FakeHTMLElement("DIV") as unknown as HTMLElement
    };
    viewAny.handleKeydown(previousEvent);
    expect(previousEvent.preventDefault).toHaveBeenCalled();
    expect(viewAny.index).toBe(0);
  });

  it("ignores keyboard shortcuts from editable controls", () => {
    const { viewAny } = createView();
    viewAny.cards = [createCard({ id: "a" })];

    const event = {
      key: " ",
      preventDefault: vi.fn(),
      target: new FakeHTMLElement("BUTTON") as unknown as HTMLElement
    };
    viewAny.handleKeydown(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(viewAny.flipped).toBe(false);
  });

  it("toggles mastered and mistake book through store helpers while keeping card position", async () => {
    const { viewAny, cardStore } = createView();
    const card = createCard({ id: "card-2", inMistakeBook: true, isMastered: false });
    const reloadCards = vi.fn(() => Promise.resolve(undefined));
    viewAny.reloadCards = reloadCards;
    viewAny.index = 2;

    await viewAny.toggleMistakeBook(card);
    expect(cardStore.setMistakeBook).toHaveBeenCalledWith("card-2", false);
    expect(reloadCards).toHaveBeenCalledWith("card-2", 2);

    await viewAny.toggleMastered(card);
    expect(cardStore.setMastered).toHaveBeenCalledWith("card-2", true);
    expect(reloadCards).toHaveBeenCalledWith("card-2", 2);
  });

  it("opens source note by anchor first, then line, then plain file open", async () => {
    const file = { path: "folder/note.md" };
    const { viewAny, generationService, openFile, leafView } = createView();
    generationService.getFileByPath.mockReturnValue(file);

    await viewAny.openSourceNote(createCard({ sourceAnchorText: "概念", sourceStartLine: 12 }));
    expect(openFile).toHaveBeenCalledWith(file);
    expect(leafView.setEphemeralState).toHaveBeenCalledWith({ subpath: "# 概念" });

    leafView.setEphemeralState.mockClear();
    await viewAny.openSourceNote(createCard({ sourceAnchorText: undefined, sourceStartLine: 8 }));
    expect(leafView.setEphemeralState).not.toHaveBeenCalled();
    expect(leafView.editor.setCursor).toHaveBeenCalledWith({ line: 7, ch: 0 });

    leafView.editor.setCursor.mockClear();
    await viewAny.openSourceNote(createCard({ sourceAnchorText: undefined, sourceStartLine: undefined }));
    expect(leafView.editor.setCursor).not.toHaveBeenCalled();
  });

  it("generates by mistake topic and keeps current card position", async () => {
    const { viewAny, generationService } = createView();
    const card = createCard({ id: "mistake-2", inMistakeBook: true });
    const reloadCards = vi.fn(() => Promise.resolve(undefined));
    viewAny.reloadCards = reloadCards;
    viewAny.index = 5;

    await viewAny.generateByMistakeTopic(card);

    expect(generationService.generateForMistakeTopic).toHaveBeenCalledWith(card);
    expect(reloadCards).toHaveBeenCalledWith("mistake-2", 5);
  });

  it("re-resolves topic when active model config changes for the same card", () => {
    const { viewAny, generationService } = createView();
    const card = createCard({ id: "mistake-2", inMistakeBook: true });
    generationService.getSettingsSnapshot
      .mockReturnValueOnce({
        generatorMode: "ai",
        mistakeTopicCardEntryEnabled: true,
        activeAiModelId: "model-1",
        aiModelConfigs: [{ id: "model-1", name: "模型A", provider: "openai-compatible", apiUrl: "https://a", model: "m", prompt: "p1", apiKey: "k1" }]
      })
      .mockReturnValue({
        generatorMode: "ai",
        mistakeTopicCardEntryEnabled: true,
        activeAiModelId: "model-1",
        aiModelConfigs: [{ id: "model-1", name: "模型A", provider: "openai-compatible", apiUrl: "https://a", model: "m", prompt: "p2", apiKey: "k2" }]
      });

    viewAny.mistakeTopicResolution = { topic: "旧主题", source: "question" };
    viewAny.mistakeTopicLoading = false;
    viewAny.mistakeTopicKey = viewAny.getMistakeTopicKey(card);

    viewAny.ensureMistakeTopicResolution(card);

    expect(generationService.resolveMistakeTopicForCard).toHaveBeenCalledWith(card);
  });
});
