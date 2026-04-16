import { Notice, TFile, Vault } from "obsidian";
import type { CardStore } from "./cardStore";
import { generateAiFlashcardsForMistakeTopic, generateAiTopicFromCard } from "./aiGenerator";
import { resolveMistakeTopic, type MistakeTopicResolution, canGenerateByMistakeTopic } from "./mistakeTopicState";
import { parseMarkdownSections } from "./noteParser";
import { GENERATION_COPY, generateCardsForSections } from "./generationStrategy";
import { REVIEW_COPY } from "./reviewCopy";
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

function buildDueQueue(
  cards: Flashcard[],
  settings: NoteFlashcardsSettings,
  now: Date,
  countMode: StudySessionOptions["countMode"]
): Flashcard[] {
  const dueCards = cards.filter((card) => isDueCard(card, now));
  if (dueCards.length === 0) {
    return settings.showAllCardsInReview ? cards : [];
  }

  const dueReviewCards = dueCards.filter((card) => card.cardState !== "new");
  const dueNewCards = dueCards
    .filter((card) => card.cardState === "new")
    .sort((a, b) => toTimestamp(a.createdAt) - toTimestamp(b.createdAt));
  const newCardsPerDay = Math.max(0, settings.newCardsPerDay);
  // "全部" should show the full due queue instead of being truncated by daily-new limit.
  const limitedDueNewCards = countMode === "all"
    ? dueNewCards
    : (newCardsPerDay > 0 ? dueNewCards.slice(0, newCardsPerDay) : []);

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

export interface MistakeTopicGenerateResult {
  topic: string;
  addedCount: number;
  skippedCount: number;
}

export class GenerationService {
  constructor(private readonly vault: Vault, private readonly store: CardStore, private readonly settings: () => NoteFlashcardsSettings) {}

  getSettingsSnapshot(): NoteFlashcardsSettings {
    return this.settings();
  }

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
    const reviewQueue = buildDueQueue(filteredCards, this.settings(), new Date(), options.countMode);
    return getStudySession(reviewQueue, options, Math.random, sessionCardIds);
  }

  async resolveMistakeTopicForCard(card: Flashcard): Promise<MistakeTopicResolution> {
    return resolveMistakeTopic(card, this.settings(), generateAiTopicFromCard);
  }

  async generateForMistakeTopic(card: Flashcard): Promise<MistakeTopicGenerateResult> {
    if (!card.inMistakeBook) {
      throw new Error(REVIEW_COPY.mistakeTopic.nonMistake);
    }
    const settings = this.settings();
    if (!canGenerateByMistakeTopic(settings)) {
      throw new Error(REVIEW_COPY.mistakeTopic.aiRequired);
    }

    const resolved = await this.resolveMistakeTopicForCard(card);
    if (!resolved.topic) {
      throw new Error(resolved.error ?? REVIEW_COPY.mistakeTopic.noTopic);
    }
    const topic = resolved.topic;

    const generatedCards = await generateAiFlashcardsForMistakeTopic(card, topic, settings, 5);
    const cardsWithSource = generatedCards.map((item) => ({
      ...item,
      generatedFromFlow: "mistake-topic" as const,
      generatedFromCardId: card.id,
      generatedTopic: topic
    }));

    let result;
    try {
      result = await this.store.appendCardsWithDedupe(cardsWithSource);
    } catch (_error) {
      throw new Error(REVIEW_COPY.mistakeTopic.writeFailed);
    }

    return {
      topic,
      addedCount: result.addedCount,
      skippedCount: result.skippedCount
    };
  }
}
