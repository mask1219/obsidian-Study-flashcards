import type { Flashcard } from "./types";
import { REVIEW_COPY } from "./reviewCopy";

export async function generateForCurrentNoteAction(
  getCurrentPath: () => string | undefined,
  getFileByPath: (path: string) => unknown,
  generateForFile: (file: unknown) => Promise<unknown>,
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
  getFileByPath: (path: string) => unknown,
  openFile: (file: unknown, card: Flashcard) => Promise<void>,
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
