import type { TFile } from "obsidian";
import type { Flashcard } from "./types";
import { REVIEW_COPY } from "./reviewCopy";

export async function generateForCurrentNoteAction(
  getCurrentPath: () => string | undefined,
  getFileByPath: (path: string) => TFile | null,
  generateForFile: (file: TFile) => Promise<unknown>,
  reloadCards: () => Promise<void>,
  notify: (message: string) => void
): Promise<void> {
  const currentPath = getCurrentPath();
  if (!currentPath) {
    notify(REVIEW_COPY.notices.noCurrentNote);
    return;
  }

  const file = getFileByPath(currentPath);
  if (!file) {
    notify(REVIEW_COPY.notices.cannotReadCurrentNote);
    return;
  }

  await generateForFile(file);
  await reloadCards();
}

export async function generateForCurrentFolderAction(
  getCurrentFolderPath: () => string | undefined,
  generateForFolder: (folderPath: string) => Promise<unknown>,
  reloadCards: () => Promise<void>,
  notify: (message: string) => void
): Promise<void> {
  const folderPath = getCurrentFolderPath();
  if (!folderPath) {
    notify(REVIEW_COPY.notices.noCurrentFolder);
    return;
  }

  await generateForFolder(folderPath);
  await reloadCards();
}

export async function openSourceNoteAction(
  card: Flashcard,
  getFileByPath: (path: string) => TFile | null,
  openFile: (file: TFile, card: Flashcard) => Promise<void>,
  notify: (message: string) => void
): Promise<void> {
  const file = getFileByPath(card.sourcePath);
  if (!file) {
    notify(REVIEW_COPY.notices.sourceNotFound);
    return;
  }

  await openFile(file, card);
}

export async function toggleMistakeBookAction(
  card: Flashcard,
  setMistakeBook: (cardId: string, inMistakeBook: boolean) => Promise<unknown>,
  reloadCards: (preferredCardId?: string, preferredIndex?: number) => Promise<void>,
  notify: (message: string) => void,
  preferredIndex = 0
): Promise<void> {
  await setMistakeBook(card.id, !card.inMistakeBook);
  notify(card.inMistakeBook ? REVIEW_COPY.notices.removedFromMistakes : REVIEW_COPY.notices.addedToMistakes);
  await reloadCards(card.id, preferredIndex);
}

export async function toggleMasteredAction(
  card: Flashcard,
  setMastered: (cardId: string, isMastered: boolean) => Promise<unknown>,
  reloadCards: (preferredCardId?: string, preferredIndex?: number) => Promise<void>,
  preferredIndex = 0
): Promise<void> {
  await setMastered(card.id, !card.isMastered);
  await reloadCards(card.id, preferredIndex);
}

export async function clearMasteredMistakeCardsAction(
  clearMasteredMistakeCards: () => Promise<number>,
  reloadCards: () => Promise<void>,
  notify: (message: string) => void
): Promise<void> {
  const removedCount = await clearMasteredMistakeCards();
  if (removedCount === 0) {
    notify(REVIEW_COPY.notices.noMasteredMistakesToClear);
    return;
  }

  notify(REVIEW_COPY.notices.clearedMasteredMistakes(removedCount));
  await reloadCards();
}

export async function generateByMistakeTopicAction(
  card: Flashcard,
  generateForMistakeTopic: (card: Flashcard) => Promise<{ addedCount: number; skippedCount: number }>,
  reloadCards: (preferredCardId?: string, preferredIndex?: number) => Promise<void>,
  notify: (message: string) => void,
  preferredIndex = 0
): Promise<void> {
  const result = await generateForMistakeTopic(card);
  if (result.addedCount === 0) {
    notify(REVIEW_COPY.notices.mistakeTopicAllDuplicated);
  } else if (result.skippedCount > 0) {
    notify(REVIEW_COPY.notices.mistakeTopicGeneratedPartial(result.addedCount, result.skippedCount));
  } else {
    notify(REVIEW_COPY.notices.mistakeTopicGenerated(result.addedCount));
  }
  await reloadCards(card.id, preferredIndex);
}
