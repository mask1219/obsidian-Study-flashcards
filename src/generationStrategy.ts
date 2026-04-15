import { generateAiFlashcards } from "./aiGenerator";
import { generateRuleFlashcards } from "./ruleGenerator";
import type { Flashcard, NoteFlashcardsSettings, ParsedSection } from "./types";

export const GENERATION_COPY = {
  notices: {
    generatedFile: (basename: string, count: number) => `已为 ${basename} 生成 ${count} 张闪卡`,
    generatedFolder: (count: number) => `批量生成完成，共生成 ${count} 张闪卡`
  },
  errors: {
    aiRequestFailed: (detail?: string) => `AI 接口调用失败${detail ? `：${detail}` : ""}`,
    aiInvalidResponse: "AI 返回内容无法解析为闪卡，请确认所选 Provider 配置正确并返回有效 JSON。"
  }
} as const;

export async function generateCardsForSections(sections: ParsedSection[], settings: NoteFlashcardsSettings): Promise<Flashcard[]> {
  if (settings.generatorMode === "ai") {
    return generateAiFlashcards(sections, settings);
  }

  if (settings.generatorMode === "hybrid") {
    return generateAiFlashcards(sections, settings);
  }

  return generateRuleFlashcards(sections, settings.summaryLength, settings.maxCardsPerNote);
}
