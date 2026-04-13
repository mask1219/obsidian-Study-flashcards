import { generateAiFlashcards } from "./aiGenerator";
import { generateRuleFlashcards } from "./ruleGenerator";
import type { Flashcard, NoteFlashcardsSettings, ParsedSection } from "./types";

export const GENERATION_COPY = {
  notices: {
    generatedFile: (basename: string, count: number) => `已为 ${basename} 生成 ${count} 张闪卡`,
    generatedFolder: (count: number) => `批量生成完成，共生成 ${count} 张闪卡`
  },
  errors: {
    aiNotConfigured: "AI 生成尚未配置，请先在后续版本中接入模型提供商。"
  }
} as const;

export async function generateCardsForSections(sections: ParsedSection[], settings: NoteFlashcardsSettings): Promise<Flashcard[]> {
  if (settings.generatorMode === "ai") {
    return generateAiFlashcards(sections);
  }

  if (settings.generatorMode === "hybrid") {
    try {
      return await generateAiFlashcards(sections);
    } catch (_error) {
      return generateRuleFlashcards(sections, settings.summaryLength, settings.maxCardsPerNote);
    }
  }

  return generateRuleFlashcards(sections, settings.summaryLength, settings.maxCardsPerNote);
}
