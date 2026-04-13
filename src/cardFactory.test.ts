import { describe, expect, it } from "vitest";
import { createNewFlashcard } from "./cardFactory";
import type { ParsedSection } from "./types";

function createSection(overrides: Partial<ParsedSection> = {}): ParsedSection {
  return {
    heading: "概念",
    content: "内容",
    listItems: [],
    sourcePath: "folder/note.md",
    sourceAnchorText: "概念",
    sourceStartLine: 10,
    sourceEndLine: 20,
    ...overrides
  };
}

describe("createNewFlashcard", () => {
  it("builds different ids for cards with same question in different sections", () => {
    const question = "“概念”这一节讲了什么？";
    const answer = "内容";
    const first = createNewFlashcard(question, answer, createSection({ sourceStartLine: 10, sourceEndLine: 20 }), "rule");
    const second = createNewFlashcard(question, answer, createSection({ sourceStartLine: 30, sourceEndLine: 40 }), "rule");

    expect(first.id).not.toBe(second.id);
  });

  it("builds different ids when answers differ at the same location", () => {
    const question = "“概念”这一节讲了什么？";
    const first = createNewFlashcard(question, "内容A", createSection(), "rule");
    const second = createNewFlashcard(question, "内容B", createSection(), "rule");

    expect(first.id).not.toBe(second.id);
  });
});
