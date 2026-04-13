import { describe, expect, it } from "vitest";
import { parseMarkdownSections } from "./noteParser";

describe("parseMarkdownSections", () => {
  it("returns empty array for empty markdown", () => {
    expect(parseMarkdownSections("", "note.md")).toEqual([]);
  });

  it("uses document summary for content before first heading", () => {
    const sections = parseMarkdownSections("第一段\n第二段", "note.md");

    expect(sections).toEqual([
      {
        heading: "文档概要",
        content: "第一段\n第二段",
        listItems: [],
        sourcePath: "note.md",
        sourceAnchorText: "第一段",
        sourceStartLine: 1,
        sourceEndLine: 2
      }
    ]);
  });

  it("splits sections by headings and preserves list items", () => {
    const markdown = [
      "# 第一节",
      "第一节内容",
      "- 列表一",
      "- 列表二",
      "## 第二节",
      "第二节内容"
    ].join("\n");

    const sections = parseMarkdownSections(markdown, "note.md");

    expect(sections).toEqual([
      {
        heading: "第一节",
        content: "第一节内容\n- 列表一\n- 列表二",
        listItems: ["列表一", "列表二"],
        sourcePath: "note.md",
        sourceAnchorText: "第一节",
        sourceStartLine: 1,
        sourceEndLine: 4
      },
      {
        heading: "第二节",
        content: "第二节内容",
        listItems: [],
        sourcePath: "note.md",
        sourceAnchorText: "第二节",
        sourceStartLine: 5,
        sourceEndLine: 6
      }
    ]);
  });

  it("keeps document summary anchored to first non-empty line when headings appear later", () => {
    const markdown = [
      "",
      "开头说明",
      "# 第一节",
      "第一节内容"
    ].join("\n");

    const sections = parseMarkdownSections(markdown, "note.md");

    expect(sections[0]).toEqual({
      heading: "文档概要",
      content: "开头说明",
      listItems: [],
      sourcePath: "note.md",
      sourceAnchorText: "开头说明",
      sourceStartLine: 2,
      sourceEndLine: 2
    });
  });
});
