import type { Flashcard, StudySessionOptions, StudySessionResult } from "./types";

function shuffleCards(cards: Flashcard[], random: () => number): Flashcard[] {
  const shuffled = [...cards];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function sortSequentially(cards: Flashcard[]): Flashcard[] {
  return [...cards].sort((a, b) => {
    const pathCompare = a.sourcePath.localeCompare(b.sourcePath);
    if (pathCompare !== 0) {
      return pathCompare;
    }

    const startLineA = a.sourceStartLine ?? Number.MAX_SAFE_INTEGER;
    const startLineB = b.sourceStartLine ?? Number.MAX_SAFE_INTEGER;
    if (startLineA !== startLineB) {
      return startLineA - startLineB;
    }

    const endLineA = a.sourceEndLine ?? Number.MAX_SAFE_INTEGER;
    const endLineB = b.sourceEndLine ?? Number.MAX_SAFE_INTEGER;
    if (endLineA !== endLineB) {
      return endLineA - endLineB;
    }

    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

function sortBySessionOrder(cards: Flashcard[], sessionCardIds: string[]): Flashcard[] {
  const order = new Map(sessionCardIds.map((id, index) => [id, index]));
  return [...cards].sort((a, b) => (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER));
}

export function getStudySession(
  cards: Flashcard[],
  options: StudySessionOptions,
  random: () => number = Math.random,
  sessionCardIds?: string[]
): StudySessionResult {
  let filteredCards = [...cards];

  if (options.includeMistakeBookOnly) {
    filteredCards = filteredCards.filter((card) => card.inMistakeBook);
  }

  if (options.excludeMastered) {
    filteredCards = filteredCards.filter((card) => !card.isMastered);
  }

  const totalCards = filteredCards.length;
  const orderedCards = sessionCardIds && sessionCardIds.length > 0
    ? sortBySessionOrder(filteredCards.filter((card) => sessionCardIds.includes(card.id)), sessionCardIds)
    : options.orderMode === "sequential"
      ? sortSequentially(filteredCards)
      : shuffleCards(filteredCards, random);

  const selectedCards = sessionCardIds && sessionCardIds.length > 0
    ? orderedCards
    : options.countMode === "random10"
      ? orderedCards.slice(0, 10)
      : orderedCards;

  return {
    cards: selectedCards,
    totalCards,
    selectedCount: selectedCards.length,
    sessionCardIds: sessionCardIds && sessionCardIds.length > 0 ? selectedCards.map((card) => card.id) : selectedCards.map((card) => card.id)
  };
}
