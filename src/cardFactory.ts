import type { Flashcard, ParsedSection } from "./types";

export function createNewFlashcard(
  question: string,
  answer: string,
  section: ParsedSection,
  generatorType: Flashcard["generatorType"]
): Flashcard {
  const createdAt = new Date().toISOString();
  return {
    id: `${section.sourcePath}::${section.heading}::${question}`,
    question,
    answer,
    sourcePath: section.sourcePath,
    sourceHeading: section.heading,
    sourceAnchorText: section.sourceAnchorText,
    sourceStartLine: section.sourceStartLine,
    sourceEndLine: section.sourceEndLine,
    generatorType,
    createdAt,
    dueAt: createdAt,
    intervalDays: 0,
    easeFactor: 2.5,
    repetition: 0,
    lapseCount: 0,
    reviewCount: 0,
    cardState: "new",
    learningStep: 0,
    inMistakeBook: false,
    isMastered: false,
    mistakeSuccessStreak: 0
  };
}
