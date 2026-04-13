import { DEFAULT_SETTINGS } from "./settings";
import { clearMistakeBookState, isMasteredMistakeCard, normalizeCard, setMasteredState, setMistakeBookState } from "./cardState";
import type { Flashcard, FlashcardsData, NoteFlashcardsSettings } from "./types";

const DEFAULT_DATA: FlashcardsData = {
  cards: []
};

interface PersistedData extends FlashcardsData {
  settings?: NoteFlashcardsSettings;
}

function normalizePrefix(prefix: string): string {
  return prefix.endsWith("/") ? prefix : `${prefix}/`;
}

function hasPrefixPath(path: string, prefix: string): boolean {
  if (prefix.trim() === "") {
    return true;
  }
  return path.startsWith(normalizePrefix(prefix));
}

export class CardStore {
  constructor(private readonly loadData: () => Promise<unknown>, private readonly saveData: (data: PersistedData) => Promise<void>) {}

  async getData(): Promise<PersistedData> {
    const data = await this.loadData();
    if (!data || typeof data !== "object") {
      return { ...DEFAULT_DATA, settings: DEFAULT_SETTINGS };
    }

    const persisted = data as PersistedData;
    return {
      cards: Array.isArray(persisted.cards) ? persisted.cards.map((card) => normalizeCard(card)) : [],
      settings: {
        ...DEFAULT_SETTINGS,
        ...(persisted.settings ?? {})
      }
    };
  }

  async getCards(): Promise<Flashcard[]> {
    const data = await this.getData();
    return data.cards;
  }

  async saveCards(cards: Flashcard[]): Promise<void> {
    const data = await this.getData();
    await this.saveData({ ...data, cards });
  }

  async replaceCardsForSource(sourcePath: string, newCards: Flashcard[]): Promise<number> {
    const data = await this.getData();
    const retained = data.cards.filter((card) => card.sourcePath !== sourcePath);
    await this.saveData({ ...data, cards: [...retained, ...newCards] });
    return newCards.length;
  }

  async getCardsByPrefix(prefix: string): Promise<Flashcard[]> {
    const cards = await this.getCards();
    return cards.filter((card) => hasPrefixPath(card.sourcePath, prefix));
  }

  async setMistakeBook(cardId: string, inMistakeBook: boolean): Promise<Flashcard | null> {
    const data = await this.getData();
    let updatedCard: Flashcard | null = null;
    const updated = data.cards.map((card) => {
      if (card.id !== cardId) {
        return card;
      }
      updatedCard = setMistakeBookState(card, inMistakeBook);
      return updatedCard;
    });

    await this.saveData({ ...data, cards: updated });
    return updatedCard;
  }

  async setMastered(cardId: string, isMastered: boolean): Promise<Flashcard | null> {
    const data = await this.getData();
    let updatedCard: Flashcard | null = null;
    const updated = data.cards.map((card) => {
      if (card.id !== cardId) {
        return card;
      }
      updatedCard = setMasteredState(card, isMastered);
      return updatedCard;
    });

    await this.saveData({ ...data, cards: updated });
    return updatedCard;
  }

  async clearMasteredMistakeCards(): Promise<number> {
    const data = await this.getData();
    let removedCount = 0;
    const updated = data.cards.map((card) => {
      if (!isMasteredMistakeCard(card)) {
        return card;
      }
      removedCount += 1;
      return clearMistakeBookState(card);
    });

    await this.saveData({ ...data, cards: updated });
    return removedCount;
  }

  async resetCards(): Promise<void> {
    const data = await this.getData();
    await this.saveData({ ...data, cards: [] });
  }
}
