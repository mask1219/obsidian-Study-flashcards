import { createNewFlashcard } from "./cardFactory";
import type { Flashcard, ParsedSection } from "./types";

function clip(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength).trim()}…`;
}

function createCard(question: string, answer: string, section: ParsedSection): Flashcard {
  return createNewFlashcard(question, answer, section, "rule");
}

export function generateRuleFlashcards(sections: ParsedSection[], summaryLength: number, maxCardsPerNote: number): Flashcard[] {
  const cards: Flashcard[] = [];

  for (const section of sections) {
    if (cards.length >= maxCardsPerNote) {
      break;
    }

    if (section.heading && section.content) {
      cards.push(createCard(`“${section.heading}”这一节讲了什么？`, clip(section.content, summaryLength), section));
    }

    if (cards.length >= maxCardsPerNote) {
      break;
    }

    if (section.listItems.length > 0) {
      cards.push(createCard(`“${section.heading}”的要点有哪些？`, clip(section.listItems.join("；"), summaryLength), section));
    }

    if (cards.length >= maxCardsPerNote) {
      break;
    }

    const definitionMatch = /([^。！？:\n]{2,30})[：:](.+)/.exec(section.content);
    if (definitionMatch) {
      cards.push(createCard(`什么是${definitionMatch[1].trim()}？`, clip(definitionMatch[2].trim(), summaryLength), section));
    }
  }

  return cards.slice(0, maxCardsPerNote);
}
