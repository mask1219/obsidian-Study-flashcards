import { GENERATION_COPY } from "./generationStrategy";
import type { Flashcard, ParsedSection } from "./types";

export async function generateAiFlashcards(_sections: ParsedSection[]): Promise<Flashcard[]> {
  throw new Error(GENERATION_COPY.errors.aiNotConfigured);
}
