export type GeneratorMode = "rule" | "ai" | "hybrid";
export type AiProvider = "openai-compatible" | "openrouter" | "azure-openai" | "anthropic" | "gemini";
export type CardState = "new" | "learning" | "review";
export type StudyScope = "current" | "folder" | "all";
export type StudyCountMode = "random10" | "all";
export type StudyOrderMode = "random" | "sequential";

export const MISTAKE_AUTO_REMOVE_STREAK = 2;

export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  sourcePath: string;
  sourceHeading?: string;
  sourceAnchorText?: string;
  sourceStartLine?: number;
  sourceEndLine?: number;
  generatorType: GeneratorMode;
  createdAt: string;
  dueAt: string;
  intervalDays: number;
  easeFactor: number;
  repetition: number;
  lapseCount: number;
  reviewCount: number;
  cardState: CardState;
  learningStep: number;
  inMistakeBook: boolean;
  isMastered: boolean;
  mistakeSuccessStreak: number;
  lastReviewedAt?: string;
}

export interface ParsedSection {
  heading: string;
  content: string;
  listItems: string[];
  sourcePath: string;
  sourceAnchorText?: string;
  sourceStartLine?: number;
  sourceEndLine?: number;
}

export interface NoteFlashcardsSettings {
  generatorMode: GeneratorMode;
  maxCardsPerNote: number;
  summaryLength: number;
  aiProvider: AiProvider;
  aiApiUrl: string;
  aiApiKey: string;
  aiModel: string;
  aiPrompt: string;
  ignoredFolders: string[];
  newCardsPerDay: number;
  showAllCardsInReview: boolean;
  learningStepsMinutes: number[];
  graduatingIntervalDays: number;
  easyIntervalDays: number;
}

export interface FlashcardsData {
  cards: Flashcard[];
}

export interface StudySessionOptions {
  scope: StudyScope;
  sourcePath?: string;
  countMode: StudyCountMode;
  orderMode: StudyOrderMode;
  includeMistakeBookOnly: boolean;
  excludeMastered: boolean;
}

export interface StudySessionResult {
  cards: Flashcard[];
  totalCards: number;
  selectedCount: number;
  sessionCardIds: string[];
}
