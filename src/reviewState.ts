import type { Flashcard } from "./types";

export function resolveReviewIndex(cards: Flashcard[], currentIndex: number, preferredCardId?: string, preferredIndex = 0): number {
  if (cards.length === 0) {
    return 0;
  }

  if (preferredCardId) {
    const matchedIndex = cards.findIndex((card) => card.id === preferredCardId);
    return matchedIndex >= 0 ? matchedIndex : Math.min(preferredIndex, cards.length - 1);
  }

  return Math.min(currentIndex, cards.length - 1);
}

export function getWrappedReviewIndex(currentIndex: number, cardsLength: number, delta: number): number {
  if (cardsLength === 0) {
    return 0;
  }

  return (currentIndex + delta + cardsLength) % cardsLength;
}
