import { describe, expect, it } from "vitest";
import { generateRuleFlashcards } from "./ruleGenerator";
import type { ParsedSection } from "./types";

function createSection(overrides: Partial<ParsedSection> = {}): ParsedSection {
  return {
    heading: "概念",
    content: "定义：这是一个较长的说明内容，用来测试摘要裁剪和定义提取。",
    listItems: ["要点一", "要点二"],
    sourcePath: "note.md",
    sourceAnchorText: "概念",
    sourceStartLine: 3,
    sourceEndLine: 8,
    ...overrides
  };
}

describe("generateRuleFlashcards", () => {
  it("creates summary and list cards for a section", () => {
    const cards = generateRuleFlashcards([createSection()], 100, 10);

    expect(cards.map((card) => card.question)).toEqual([
      "“概念”这一节讲了什么？",
      "“概念”的要点有哪些？",
      "什么是定义？"
    ]);
    expect(cards[0]).toMatchObject({
      sourceHeading: "概念",
      sourceAnchorText: "概念",
      sourceStartLine: 3,
      sourceEndLine: 8
    });
  });

  it("clips long answers by summary length", () => {
    const [card] = generateRuleFlashcards([createSection({ content: "这是一段非常长非常长非常长的内容" })], 6, 10);

    expect(card.answer).toBe("这是一段非常…");
  });

  it("respects maxCardsPerNote", () => {
    const cards = generateRuleFlashcards([createSection(), createSection({ heading: "第二节" })], 100, 2);

    expect(cards).toHaveLength(2);
  });
});
