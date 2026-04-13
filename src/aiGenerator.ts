import { requestUrl } from "obsidian";
import { createNewFlashcard } from "./cardFactory";
import { GENERATION_COPY } from "./generationStrategy";
import type { Flashcard, NoteFlashcardsSettings, ParsedSection } from "./types";

type AiFlashcardPayload = {
  sectionIndex?: unknown;
  question?: unknown;
  answer?: unknown;
};

type AiResponsePayload = {
  cards?: unknown;
};

type OpenAiCompatibleResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string }>;
    };
  }>;
};

const DEFAULT_SYSTEM_PROMPT = [
  "你是一个严谨的学习卡片生成助手。",
  "你只能基于用户提供的笔记内容生成闪卡，不要补充外部知识。",
  "输出必须是严格 JSON，不能输出 Markdown 代码块或额外解释。"
].join(" ");

function isConfigured(settings: NoteFlashcardsSettings): boolean {
  return settings.aiApiUrl.trim().length > 0 && settings.aiApiKey.trim().length > 0 && settings.aiModel.trim().length > 0;
}

function resolveProviderApiUrl(apiUrl: string, model: string): string {
  return apiUrl.includes("{model}") ? apiUrl.replace("{model}", encodeURIComponent(model)) : apiUrl;
}

function clip(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength).trim()}…`;
}

function extractOpenAiContent(response: unknown): string {
  const payload = response as OpenAiCompatibleResponse;
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content.trim();
  }
  if (Array.isArray(content)) {
    return content.map((part) => typeof part?.text === "string" ? part.text : "").join("").trim();
  }
  return "";
}

function extractAnthropicContent(response: unknown): string {
  const content = (response as { content?: Array<{ type?: string; text?: string }> }).content;
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text as string)
    .join("")
    .trim();
}

function extractGeminiContent(response: unknown): string {
  const parts = (response as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
    .candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    return "";
  }
  return parts.map((part) => typeof part?.text === "string" ? part.text : "").join("").trim();
}

function extractProviderContent(response: unknown, settings: NoteFlashcardsSettings): string {
  if (settings.aiProvider === "anthropic") {
    return extractAnthropicContent(response);
  }
  if (settings.aiProvider === "gemini") {
    return extractGeminiContent(response);
  }
  return extractOpenAiContent(response);
}

function stripMarkdownCodeFence(content: string): string {
  const fencedMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(content.trim());
  return fencedMatch ? fencedMatch[1].trim() : content.trim();
}

function extractJsonText(content: string): string {
  const cleaned = stripMarkdownCodeFence(content);
  const firstObject = cleaned.indexOf("{");
  const lastObject = cleaned.lastIndexOf("}");
  if (firstObject !== -1 && lastObject > firstObject) {
    return cleaned.slice(firstObject, lastObject + 1);
  }
  const firstArray = cleaned.indexOf("[");
  const lastArray = cleaned.lastIndexOf("]");
  if (firstArray !== -1 && lastArray > firstArray) {
    return JSON.stringify({ cards: JSON.parse(cleaned.slice(firstArray, lastArray + 1)) });
  }
  return cleaned;
}

function parseAiResponse(content: string): AiResponsePayload | null {
  try {
    const parsed = JSON.parse(extractJsonText(content)) as unknown;
    if (Array.isArray(parsed)) {
      return { cards: parsed };
    }
    if (parsed && typeof parsed === "object") {
      return parsed as AiResponsePayload;
    }
    return null;
  } catch (_error) {
    return null;
  }
}

function buildUserPrompt(sections: ParsedSection[], settings: NoteFlashcardsSettings): string {
  const payload = sections.map((section, index) => ({
    sectionIndex: index,
    heading: section.heading,
    content: section.content,
    listItems: section.listItems
  }));
  const extraPrompt = settings.aiPrompt.trim();

  return [
    `请根据下面的笔记分段生成最多 ${settings.maxCardsPerNote} 张中文问答闪卡。`,
    `每张卡片的 answer 尽量控制在 ${settings.summaryLength} 个字符以内。`,
    "优先提炼定义、原理、步骤、对比、关键结论。",
    "如果某些内容不适合出题，可以少出题。",
    "每张卡片都必须包含 sectionIndex、question、answer 三个字段。",
    "请严格返回 JSON，格式如下：",
    "{\"cards\":[{\"sectionIndex\":0,\"question\":\"问题\",\"answer\":\"答案\"}]}",
    extraPrompt ? `额外要求：${extraPrompt}` : "",
    `sections=${JSON.stringify(payload)}`
  ].filter(Boolean).join("\n");
}

function normalizeCards(
  payload: AiResponsePayload | null,
  sections: ParsedSection[],
  settings: NoteFlashcardsSettings
): Flashcard[] {
  if (!payload || !Array.isArray(payload.cards)) {
    return [];
  }

  return payload.cards
    .slice(0, settings.maxCardsPerNote)
    .flatMap((item) => {
      const card = item as AiFlashcardPayload;
      const sectionIndex = typeof card.sectionIndex === "number" ? card.sectionIndex : -1;
      const question = typeof card.question === "string" ? card.question.trim() : "";
      const answer = typeof card.answer === "string" ? clip(card.answer.trim(), settings.summaryLength) : "";
      const section = sections[sectionIndex];

      if (!section || !question || !answer) {
        return [];
      }

      return [createNewFlashcard(question, answer, section, "ai")];
    });
}

function buildProviderRequest(userPrompt: string, settings: NoteFlashcardsSettings): {
  url: string;
  headers: Record<string, string>;
  body: string;
} {
  const model = settings.aiModel.trim();
  const apiKey = settings.aiApiKey.trim();

  if (settings.aiProvider === "anthropic") {
    return {
      url: settings.aiApiUrl.trim(),
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 1600,
        system: DEFAULT_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: userPrompt
          }
        ]
      })
    };
  }

  if (settings.aiProvider === "gemini") {
    return {
      url: resolveProviderApiUrl(settings.aiApiUrl.trim(), model),
      headers: {
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${DEFAULT_SYSTEM_PROMPT}\n\n${userPrompt}`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2
        }
      })
    };
  }

  if (settings.aiProvider === "azure-openai") {
    return {
      url: resolveProviderApiUrl(settings.aiApiUrl.trim(), model),
      headers: {
        "api-key": apiKey
      },
      body: JSON.stringify({
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: DEFAULT_SYSTEM_PROMPT
          },
          {
            role: "user",
            content: userPrompt
          }
        ]
      })
    };
  }

  if (settings.aiProvider === "openrouter") {
    return {
      url: settings.aiApiUrl.trim(),
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: DEFAULT_SYSTEM_PROMPT
          },
          {
            role: "user",
            content: userPrompt
          }
        ]
      })
    };
  }

  return {
    url: settings.aiApiUrl.trim(),
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: DEFAULT_SYSTEM_PROMPT
        },
        {
          role: "user",
          content: userPrompt
        }
      ]
    })
  };
}

function extractErrorDetail(status: number, json: unknown): string {
  const error = (json as { error?: { message?: string }; message?: string }).error;
  if (typeof error?.message === "string" && error.message.trim().length > 0) {
    return error.message;
  }
  const message = (json as { message?: string }).message;
  if (typeof message === "string" && message.trim().length > 0) {
    return message;
  }
  return `HTTP ${status}`;
}

async function requestProviderContent(userPrompt: string, settings: NoteFlashcardsSettings): Promise<string> {
  const requestConfig = buildProviderRequest(userPrompt, settings);
  let response;
  try {
    response = await requestUrl({
      url: requestConfig.url,
      method: "POST",
      contentType: "application/json",
      headers: requestConfig.headers,
      body: requestConfig.body,
      throw: false
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : undefined;
    throw new Error(GENERATION_COPY.errors.aiRequestFailed(detail));
  }

  if (response.status >= 400) {
    throw new Error(GENERATION_COPY.errors.aiRequestFailed(extractErrorDetail(response.status, response.json)));
  }

  return extractProviderContent(response.json, settings);
}

export async function generateAiFlashcards(sections: ParsedSection[], settings: NoteFlashcardsSettings): Promise<Flashcard[]> {
  if (!isConfigured(settings)) {
    throw new Error(GENERATION_COPY.errors.aiNotConfigured);
  }

  if (sections.length === 0) {
    return [];
  }

  const content = await requestProviderContent(buildUserPrompt(sections, settings), settings);
  const cards = normalizeCards(parseAiResponse(content), sections, settings);
  if (cards.length === 0) {
    throw new Error(GENERATION_COPY.errors.aiInvalidResponse);
  }

  return cards;
}

export async function testAiConnection(settings: NoteFlashcardsSettings): Promise<void> {
  if (!isConfigured(settings)) {
    throw new Error(GENERATION_COPY.errors.aiNotConfigured);
  }

  const probePrompt = "请回复任意简短文本。";
  const content = await requestProviderContent(probePrompt, settings);
  if (!content.trim()) {
    throw new Error(GENERATION_COPY.errors.aiInvalidResponse);
  }
}
