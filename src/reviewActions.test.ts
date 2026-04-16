import { describe, expect, it, vi } from "vitest";
import {
  clearMasteredMistakeCardsAction,
  generateByMistakeTopicAction,
  generateForCurrentFolderAction,
  generateForCurrentNoteAction,
  openSourceNoteAction,
  toggleMasteredAction,
  toggleMistakeBookAction
} from "./reviewActions";
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

describe("reviewActions", () => {
  it("handles current note, folder, source opening, and mistake toggles with notices", async () => {
    const notify = vi.fn();
    const reloadCards = vi.fn(async () => undefined);
    const file = { path: "folder/note.md" };
    const generateForFile = vi.fn(async () => undefined);
    const generateForFolder = vi.fn(async () => undefined);
    const openFile = vi.fn(async () => undefined);
    const setMistakeBook = vi.fn(async () => undefined);
    const sourceCard = createCard({ sourceAnchorText: "概念", sourceStartLine: 12 });

    await generateForCurrentNoteAction(() => undefined, () => null, generateForFile, reloadCards, notify);
    await generateForCurrentNoteAction(() => "folder/note.md", () => file, generateForFile, reloadCards, notify);
    await generateForCurrentFolderAction(() => undefined, generateForFolder, reloadCards, notify);
    await generateForCurrentFolderAction(() => "folder", generateForFolder, reloadCards, notify);
    await openSourceNoteAction(sourceCard, () => null, openFile, notify);
    await openSourceNoteAction(sourceCard, () => file, openFile, notify);
    await toggleMistakeBookAction(createCard({ id: "mistake-1", inMistakeBook: false }), setMistakeBook, reloadCards, notify, 3);
    await toggleMistakeBookAction(createCard({ id: "mistake-2", inMistakeBook: true }), setMistakeBook, reloadCards, notify, 2);

    expect(generateForFile).toHaveBeenCalledWith(file);
    expect(generateForFolder).toHaveBeenCalledWith("folder");
    expect(openFile).toHaveBeenCalledWith(file, sourceCard);
    expect(setMistakeBook).toHaveBeenCalledWith("mistake-1", true);
    expect(setMistakeBook).toHaveBeenCalledWith("mistake-2", false);
    expect(reloadCards).toHaveBeenCalledWith("mistake-1", 3);
    expect(reloadCards).toHaveBeenCalledWith("mistake-2", 2);
    expect(notify).toHaveBeenCalledWith("当前没有可用的笔记");
    expect(notify).toHaveBeenCalledWith("当前没有可用的父文件夹");
    expect(notify).toHaveBeenCalledWith("找不到原文笔记");
    expect(notify).toHaveBeenCalledWith("已加入错题本");
    expect(notify).toHaveBeenCalledWith("已移出错题本");
  });

  it("toggles mastered state and clears mastered mistakes", async () => {
    const reloadCards = vi.fn(async () => undefined);
    const notify = vi.fn();
    const setMastered = vi.fn(async () => undefined);

    await toggleMasteredAction(createCard({ id: "card-9", isMastered: false }), setMastered, reloadCards, 4);
    await clearMasteredMistakeCardsAction(async () => 0, reloadCards, notify);
    await clearMasteredMistakeCardsAction(async () => 2, reloadCards, notify);

    expect(setMastered).toHaveBeenCalledWith("card-9", true);
    expect(reloadCards).toHaveBeenCalledWith("card-9", 4);
    expect(notify).toHaveBeenCalledWith("当前没有已掌握的错题可清理");
    expect(notify).toHaveBeenCalledWith("已清理 2 张已掌握错题");
  });

  it("notifies result summary when generating by mistake topic", async () => {
    const notify = vi.fn();
    const reloadCards = vi.fn(async () => undefined);
    const card = createCard({ id: "mistake-1", inMistakeBook: true });

    await generateByMistakeTopicAction(
      card,
      async () => ({ addedCount: 3, skippedCount: 0 }),
      reloadCards,
      notify,
      1
    );
    await generateByMistakeTopicAction(
      card,
      async () => ({ addedCount: 2, skippedCount: 1 }),
      reloadCards,
      notify,
      1
    );
    await generateByMistakeTopicAction(
      card,
      async () => ({ addedCount: 0, skippedCount: 5 }),
      reloadCards,
      notify,
      1
    );

    expect(notify).toHaveBeenCalledWith("已新增 3 张与当前错题主题相关的学习卡片。");
    expect(notify).toHaveBeenCalledWith("已新增 2 张卡片，跳过 1 张重复卡片。");
    expect(notify).toHaveBeenCalledWith("当前主题相关卡片已存在，本次未新增卡片。");
    expect(reloadCards).toHaveBeenCalledWith("mistake-1", 1);
  });
});
