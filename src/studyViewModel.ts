import type { Flashcard, StudyCountMode, StudyOrderMode, StudyScope } from "./types";
import { REVIEW_COPY } from "./reviewCopy";

export interface StudyToolbarOption {
  label: string;
  value: string;
}

export interface StudyToolbarViewModel {
  scopeOptions: StudyToolbarOption[];
  countModeOptions: StudyToolbarOption[];
  orderModeOptions: StudyToolbarOption[];
}

export interface StudyCardViewModel {
  title: string;
  content: string;
  meta: string;
  flipButtonLabel: string;
  mistakeToggleLabel: string;
  masteredToggleLabel: string;
  mistakeToggleClass: string;
  masteredToggleClass: string;
}

export interface StudyEmptyStateViewModel {
  title: string;
  description?: string;
  showGenerateCurrentNote: boolean;
  showGenerateCurrentFolder: boolean;
}

export interface StudyStatViewModel {
  label: string;
  value: string;
  className?: string;
}

export interface StudyDisplayState {
  toolbar: StudyToolbarViewModel;
  selectionSummary: string;
  stats: StudyStatViewModel[];
  currentCard?: StudyCardViewModel;
  emptyState: StudyEmptyStateViewModel;
  navigationLabel?: string;
}

function getScopeLabel(scope: StudyScope): string {
  if (scope === "current") {
    return REVIEW_COPY.study.scope.current;
  }
  if (scope === "folder") {
    return REVIEW_COPY.study.scope.folder;
  }
  return REVIEW_COPY.study.scope.all;
}

function getCountModeLabel(countMode: StudyCountMode): string {
  return countMode === "random10" ? REVIEW_COPY.study.countMode.random10 : REVIEW_COPY.study.countMode.all;
}

function getOrderModeLabel(orderMode: StudyOrderMode): string {
  return orderMode === "random" ? REVIEW_COPY.study.orderMode.random : REVIEW_COPY.study.orderMode.sequential;
}

function getCardMeta(card: Flashcard, index: number, total: number): string {
  return [
    `${index + 1} / ${total}`,
    card.isMastered ? REVIEW_COPY.study.badges.mastered : REVIEW_COPY.study.badges.learning,
    card.inMistakeBook ? REVIEW_COPY.study.badges.mistake : "",
    card.sourcePath,
    card.sourceHeading ?? ""
  ].filter(Boolean).join(" · ");
}

function getStats(cards: Flashcard[]): StudyStatViewModel[] {
  const mistakeCount = cards.filter((card) => card.inMistakeBook).length;
  const masteredCount = cards.filter((card) => card.isMastered).length;
  const learningCount = cards.filter((card) => !card.inMistakeBook && !card.isMastered).length;

  return [
    { label: REVIEW_COPY.study.stats.mistakes, value: String(mistakeCount), className: "note-flashcards-stat-mistake" },
    { label: REVIEW_COPY.study.stats.mastered, value: String(masteredCount), className: "note-flashcards-stat-mastered" },
    { label: REVIEW_COPY.study.stats.learning, value: String(learningCount), className: "note-flashcards-stat-learning" }
  ];
}

export function getStudyDisplayState(input: {
  cards: Flashcard[];
  index: number;
  flipped: boolean;
  scope: StudyScope;
  countMode: StudyCountMode;
  orderMode: StudyOrderMode;
  includeMistakeBookOnly: boolean;
  excludeMastered: boolean;
}): StudyDisplayState {
  const currentCard = input.cards[input.index];

  return {
    toolbar: {
      scopeOptions: [
        { label: REVIEW_COPY.study.scope.current, value: "current" },
        { label: REVIEW_COPY.study.scope.folder, value: "folder" },
        { label: REVIEW_COPY.study.scope.all, value: "all" }
      ],
      countModeOptions: [
        { label: REVIEW_COPY.study.countMode.random10, value: "random10" },
        { label: REVIEW_COPY.study.countMode.all, value: "all" }
      ],
      orderModeOptions: [
        { label: REVIEW_COPY.study.orderMode.random, value: "random" },
        { label: REVIEW_COPY.study.orderMode.sequential, value: "sequential" }
      ]
    },
    selectionSummary: REVIEW_COPY.study.selectionSummary(
      getScopeLabel(input.scope),
      getCountModeLabel(input.countMode),
      getOrderModeLabel(input.orderMode),
      input.includeMistakeBookOnly,
      input.excludeMastered
    ),
    stats: getStats(input.cards),
    currentCard: currentCard ? {
      title: `${input.flipped ? REVIEW_COPY.cardFace.answer : REVIEW_COPY.cardFace.question} ${input.index + 1}`,
      content: input.flipped ? currentCard.answer : currentCard.question,
      meta: getCardMeta(currentCard, input.index, input.cards.length),
      flipButtonLabel: input.flipped ? REVIEW_COPY.buttons.flipToQuestion : REVIEW_COPY.buttons.flipToAnswer,
      mistakeToggleLabel: currentCard.inMistakeBook ? REVIEW_COPY.buttons.removeFromMistakes : REVIEW_COPY.buttons.addToMistakes,
      masteredToggleLabel: currentCard.isMastered ? REVIEW_COPY.buttons.unmarkMastered : REVIEW_COPY.buttons.markMastered,
      mistakeToggleClass: currentCard.inMistakeBook ? "note-flashcards-mistake-active" : "note-flashcards-mistake-button",
      masteredToggleClass: currentCard.isMastered ? "note-flashcards-mastered-active" : "note-flashcards-mastered-button"
    } : undefined,
    emptyState: {
      title: REVIEW_COPY.study.emptyState.title,
      description: REVIEW_COPY.study.emptyState.description,
      showGenerateCurrentNote: true,
      showGenerateCurrentFolder: true
    },
    navigationLabel: currentCard ? REVIEW_COPY.meta.positionLabel(input.index + 1, input.cards.length) : undefined
  };
}
