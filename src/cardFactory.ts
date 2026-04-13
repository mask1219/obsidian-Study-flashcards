import type { Flashcard, ParsedSection } from "./types";

function hashText(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function buildCardId(question: string, answer: string, section: ParsedSection): string {
  const startLine = section.sourceStartLine ?? 0;
  const endLine = section.sourceEndLine ?? 0;
  const fingerprint = hashText(`${section.heading}::${question}::${answer}`);
  return `${section.sourcePath}::${startLine}-${endLine}::${fingerprint}`;
}

export function createNewFlashcard(
  question: string,
  answer: string,
  section: ParsedSection,
  generatorType: Flashcard["generatorType"]
): Flashcard {
  const createdAt = new Date().toISOString();
  return {
    id: buildCardId(question, answer, section),
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
