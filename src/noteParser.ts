import type { ParsedSection } from "./types";

interface SectionDraft {
  heading: string;
  anchorText?: string;
  content: string[];
  listItems: string[];
  startLine?: number;
  endLine?: number;
}

function createDraft(heading = "文档概要", anchorText?: string): SectionDraft {
  return {
    heading,
    anchorText,
    content: [],
    listItems: []
  };
}

export function parseMarkdownSections(markdown: string, sourcePath: string): ParsedSection[] {
  const lines = markdown.split(/\r?\n/);
  const sections: ParsedSection[] = [];
  let currentSection = createDraft();

  const pushSection = () => {
    const content = currentSection.content.join("\n").trim();
    if (!content && currentSection.listItems.length === 0) {
      return;
    }

    sections.push({
      heading: currentSection.heading,
      content,
      listItems: [...currentSection.listItems],
      sourcePath,
      sourceAnchorText: currentSection.anchorText ?? currentSection.heading,
      sourceStartLine: currentSection.startLine,
      sourceEndLine: currentSection.endLine
    });
  };

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trim();
    const headingMatch = /^#{1,6}\s+(.*)$/.exec(line);
    if (headingMatch) {
      pushSection();
      const heading = headingMatch[1].trim();
      currentSection = createDraft(heading, heading);
      currentSection.startLine = lineNumber;
      currentSection.endLine = lineNumber;
      return;
    }

    if (line.length === 0) {
      return;
    }

    if (!currentSection.startLine) {
      currentSection.startLine = lineNumber;
    }
    currentSection.endLine = lineNumber;
    currentSection.anchorText ??= line;

    if (/^[-*+]\s+/.test(line)) {
      currentSection.listItems.push(line.replace(/^[-*+]\s+/, "").trim());
    }

    currentSection.content.push(line);
  });

  pushSection();
  return sections;
}
