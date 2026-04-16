import { MISTAKE_AUTO_REMOVE_STREAK } from "./types";
import type { CardState, Flashcard } from "./types";

export function normalizeCard(card: Flashcard): Flashcard {
  const createdAt = card.createdAt ?? new Date().toISOString();
  const generatedFromFlow = card.generatedFromFlow === "mistake-topic" ? card.generatedFromFlow : undefined;
  const generatedFromCardId = typeof card.generatedFromCardId === "string" && card.generatedFromCardId.trim().length > 0
    ? card.generatedFromCardId
    : undefined;
  const generatedTopic = typeof card.generatedTopic === "string" && card.generatedTopic.trim().length > 0
    ? card.generatedTopic
    : undefined;
  return {
    ...card,
    createdAt,
    dueAt: card.dueAt ?? createdAt,
    intervalDays: card.intervalDays ?? 0,
    easeFactor: card.easeFactor ?? 2.5,
    repetition: card.repetition ?? 0,
    lapseCount: card.lapseCount ?? 0,
    reviewCount: card.reviewCount ?? 0,
    cardState: (card.cardState ?? "new") as CardState,
    learningStep: card.learningStep ?? 0,
    inMistakeBook: card.inMistakeBook ?? false,
    isMastered: card.isMastered ?? false,
    mistakeSuccessStreak: card.mistakeSuccessStreak ?? 0,
    generatedFromFlow,
    generatedFromCardId,
    generatedTopic
  };
}

export function clearMistakeBookState(card: Flashcard): Flashcard {
  return {
    ...card,
    inMistakeBook: false,
    mistakeSuccessStreak: 0
  };
}

export function setMistakeBookState(card: Flashcard, inMistakeBook: boolean): Flashcard {
  return {
    ...card,
    inMistakeBook,
    isMastered: inMistakeBook ? false : card.isMastered,
    mistakeSuccessStreak: 0
  };
}

export function setMasteredState(card: Flashcard, isMastered: boolean): Flashcard {
  return {
    ...card,
    isMastered,
    inMistakeBook: isMastered ? false : card.inMistakeBook,
    mistakeSuccessStreak: isMastered ? 0 : card.mistakeSuccessStreak
  };
}

export function isMasteredMistakeCard(card: Flashcard): boolean {
  return card.inMistakeBook && card.mistakeSuccessStreak >= MISTAKE_AUTO_REMOVE_STREAK;
}
