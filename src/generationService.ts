import { Notice, TFile, Vault } from "obsidian";
import type { CardStore } from "./cardStore";
import { parseMarkdownSections } from "./noteParser";
import { GENERATION_COPY, generateCardsForSections } from "./generationStrategy";
import { getStudySession } from "./studySession";
import type { Flashcard, NoteFlashcardsSettings, StudySessionOptions, StudySessionResult } from "./types";

function isIgnored(path: string, ignoredFolders: string[]): boolean {
  return ignoredFolders.some((folder) => path.startsWith(folder));
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
    const files = this.vault.getMarkdownFiles().filter((file) => file.path.startsWith(folderPath) && !isIgnored(file.path, settings.ignoredFolders));
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
    return allCards.filter((card) => card.sourcePath.startsWith(path));
  }

  async getStudySession(options: StudySessionOptions, sessionCardIds?: string[]): Promise<StudySessionResult> {
    const cards = await this.getCardsForSource(options.scope, options.sourcePath);
    return getStudySession(cards, options, Math.random, sessionCardIds);
  }
}
