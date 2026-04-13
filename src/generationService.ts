import { Notice, TFile, Vault } from "obsidian";
import type { CardStore } from "./cardStore";
import { parseMarkdownSections } from "./noteParser";
import { GENERATION_COPY, generateCardsForSections } from "./generationStrategy";
import { getStudySession } from "./studySession";
import type { Flashcard, NoteFlashcardsSettings, StudySessionOptions, StudySessionResult } from "./types";

function normalizeFolderPath(folderPath: string): string {
  return folderPath.endsWith("/") ? folderPath : `${folderPath}/`;
}

function isInFolder(filePath: string, folderPath: string): boolean {
  if (folderPath.trim() === "") {
    return true;
  }
  const normalizedFolderPath = normalizeFolderPath(folderPath);
  return filePath.startsWith(normalizedFolderPath);
}

function isIgnored(path: string, ignoredFolders: string[]): boolean {
  return ignoredFolders.some((folder) => isInFolder(path, folder));
}

function isDueCard(card: Flashcard, now: Date): boolean {
  const dueTime = Date.parse(card.dueAt);
  if (Number.isNaN(dueTime)) {
    return true;
  }
  return dueTime <= now.getTime();
}

function toTimestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function buildDueQueue(cards: Flashcard[], settings: NoteFlashcardsSettings, now: Date): Flashcard[] {
  const dueCards = cards.filter((card) => isDueCard(card, now));
  if (dueCards.length === 0) {
    return settings.showAllCardsInReview ? cards : [];
  }

  const dueReviewCards = dueCards.filter((card) => card.cardState !== "new");
  const dueNewCards = dueCards
    .filter((card) => card.cardState === "new")
    .sort((a, b) => toTimestamp(a.createdAt) - toTimestamp(b.createdAt));
  const newCardsPerDay = Math.max(0, settings.newCardsPerDay);
  const limitedDueNewCards = newCardsPerDay > 0 ? dueNewCards.slice(0, newCardsPerDay) : [];

  return [...dueReviewCards, ...limitedDueNewCards];
}

function applyStudyFilters(cards: Flashcard[], options: StudySessionOptions): Flashcard[] {
  let filteredCards = [...cards];
  if (options.includeMistakeBookOnly) {
    filteredCards = filteredCards.filter((card) => card.inMistakeBook);
  }
  if (options.excludeMastered) {
    filteredCards = filteredCards.filter((card) => !card.isMastered);
  }
  return filteredCards;
}

export class GenerationService {
  constructor(private readonly vault: Vault, private readonly store: CardStore, private readonly settings: () => NoteFlashcardsSettings) {}

  getFileByPath(path: string): TFile | null {
    const file = this.vault.getAbstractFileByPath(path);
    return file instanceof TFile ? file : null;
  }

  async generateForFile(file: TFile): Promise<number> {
    const settings = this.settings();
    const content = await this.vault.cachedRead(file);
    const sections = parseMarkdownSections(content, file.path);
    const cards = await generateCardsForSections(sections, settings);

    const count = await this.store.replaceCardsForSource(file.path, cards);
    new Notice(GENERATION_COPY.notices.generatedFile(file.basename, count));
    return count;
  }

  async generateForFolder(folderPath: string): Promise<number> {
    const settings = this.settings();
    const files = this.vault.getMarkdownFiles().filter((file) => isInFolder(file.path, folderPath) && !isIgnored(file.path, settings.ignoredFolders));
    let total = 0;

    for (const file of files) {
      total += await this.generateForFile(file);
    }

    new Notice(GENERATION_COPY.notices.generatedFolder(total));
    return total;
  }

  async getCardsForSource(mode: StudySessionOptions["scope"], path?: string): Promise<Flashcard[]> {
    const allCards = await this.store.getCards();
    if (mode === "all" || !path) {
      return allCards;
    }
    if (mode === "current") {
      return allCards.filter((card) => card.sourcePath === path);
    }
    return allCards.filter((card) => isInFolder(card.sourcePath, path));
  }

  async getStudySession(options: StudySessionOptions, sessionCardIds?: string[]): Promise<StudySessionResult> {
    const cards = await this.getCardsForSource(options.scope, options.sourcePath);
    const filteredCards = applyStudyFilters(cards, options);
    const reviewQueue = buildDueQueue(filteredCards, this.settings(), new Date());
    return getStudySession(reviewQueue, options, Math.random, sessionCardIds);
  }
}
