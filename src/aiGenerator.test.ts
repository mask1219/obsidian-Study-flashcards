import * as obsidian from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generateAiFlashcards, testAiConnection } from "./aiGenerator";
import { GENERATION_COPY } from "./generationStrategy";
import type { NoteFlashcardsSettings, ParsedSection } from "./types";

const SECTIONS: ParsedSection[] = [
  {
    heading: "牛顿第一定律",
    content: "物体在不受外力时保持静止或匀速直线运动。",
    listItems: ["惯性", "不受外力"],
    sourcePath: "physics.md",
    sourceStartLine: 1,
    sourceEndLine: 4
  },
  {
    heading: "牛顿第二定律",
    content: "力等于质量乘以加速度。",
    listItems: ["F=ma"],
    sourcePath: "physics.md",
    sourceStartLine: 5,
    sourceEndLine: 8
  }
];

function createSettings(overrides: Partial<NoteFlashcardsSettings> = {}): NoteFlashcardsSettings {
  return {
    generatorMode: "ai",
    maxCardsPerNote: 5,
    summaryLength: 20,
    aiProvider: "openai-compatible",
    aiApiUrl: "https://api.openai.com/v1/chat/completions",
    aiApiKey: "test-key",
    aiModel: "gpt-4o-mini",
    aiPrompt: "",
    ignoredFolders: [],
    newCardsPerDay: 10,
    showAllCardsInReview: false,
    learningStepsMinutes: [1, 10],
    graduatingIntervalDays: 1,
    easyIntervalDays: 4,
    ...overrides
  };
}

describe("generateAiFlashcards", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws when required AI settings are missing", async () => {
    await expect(generateAiFlashcards(SECTIONS, createSettings({ aiApiKey: "" }))).rejects.toThrow(GENERATION_COPY.errors.aiNotConfigured);
  });

  it("creates AI flashcards from a valid OpenAI-compatible response", async () => {
    const requestUrlMock = vi.spyOn(obsidian, "requestUrl");
    requestUrlMock.mockResolvedValueOnce({
      status: 200,
      headers: {},
      arrayBuffer: new ArrayBuffer(0),
      text: "",
      json: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                cards: [
                  {
                    sectionIndex: 0,
                    question: "什么是牛顿第一定律？",
                    answer: "物体在不受外力时保持静止或匀速直线运动。"
                  },
                  {
                    sectionIndex: 1,
                    question: "牛顿第二定律的公式是什么？",
                    answer: "力等于质量乘以加速度。"
                  }
                ]
              })
            }
          }
        ]
      }
    });

    const cards = await generateAiFlashcards(SECTIONS, createSettings());

    expect(requestUrlMock).toHaveBeenCalledWith(expect.objectContaining({
      url: "https://api.openai.com/v1/chat/completions",
      method: "POST"
    }));
    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({
      question: "什么是牛顿第一定律？",
      generatorType: "ai",
      sourcePath: "physics.md",
      sourceHeading: "牛顿第一定律"
    });
  });

  it("clips long answers by summary length", async () => {
    const requestUrlMock = vi.spyOn(obsidian, "requestUrl");
    requestUrlMock.mockResolvedValueOnce({
      status: 200,
      headers: {},
      arrayBuffer: new ArrayBuffer(0),
      text: "",
      json: {
        choices: [
          {
            message: {
              content: "{\"cards\":[{\"sectionIndex\":0,\"question\":\"问\",\"answer\":\"这是一个非常长非常长非常长的答案，用来测试摘要截断能力。\"}]}"
            }
          }
        ]
      }
    });

    const cards = await generateAiFlashcards(SECTIONS, createSettings({ summaryLength: 8 }));

    expect(cards[0]?.answer).toBe("这是一个非常长非…");
  });

  it("supports Anthropic provider request and response format", async () => {
    const requestUrlMock = vi.spyOn(obsidian, "requestUrl");
    requestUrlMock.mockResolvedValueOnce({
      status: 200,
      headers: {},
      arrayBuffer: new ArrayBuffer(0),
      text: "",
      json: {
        content: [
          {
            type: "text",
            text: "{\"cards\":[{\"sectionIndex\":0,\"question\":\"Anthropic题目\",\"answer\":\"Anthropic答案\"}]}"
          }
        ]
      }
    });

    const cards = await generateAiFlashcards(SECTIONS, createSettings({
      aiProvider: "anthropic",
      aiApiUrl: "https://api.anthropic.com/v1/messages",
      aiModel: "claude-3-7-sonnet-latest"
    }));

    expect(requestUrlMock).toHaveBeenCalledWith(expect.objectContaining({
      url: "https://api.anthropic.com/v1/messages",
      headers: expect.objectContaining({
        "x-api-key": "test-key",
        "anthropic-version": "2023-06-01"
      })
    }));
    expect(cards[0]).toMatchObject({
      question: "Anthropic题目",
      answer: "Anthropic答案"
    });
  });

  it("supports OpenRouter provider with OpenAI-compatible payload", async () => {
    const requestUrlMock = vi.spyOn(obsidian, "requestUrl");
    requestUrlMock.mockResolvedValueOnce({
      status: 200,
      headers: {},
      arrayBuffer: new ArrayBuffer(0),
      text: "",
      json: {
        choices: [
          {
            message: {
              content: "{\"cards\":[{\"sectionIndex\":0,\"question\":\"OpenRouter题目\",\"answer\":\"OpenRouter答案\"}]}"
            }
          }
        ]
      }
    });

    const cards = await generateAiFlashcards(SECTIONS, createSettings({
      aiProvider: "openrouter",
      aiApiUrl: "https://openrouter.ai/api/v1/chat/completions",
      aiModel: "openai/gpt-4o-mini"
    }));

    expect(requestUrlMock).toHaveBeenCalledWith(expect.objectContaining({
      url: "https://openrouter.ai/api/v1/chat/completions",
      headers: expect.objectContaining({
        Authorization: "Bearer test-key"
      })
    }));
    expect(cards[0]).toMatchObject({
      question: "OpenRouter题目",
      answer: "OpenRouter答案"
    });
  });

  it("supports Azure OpenAI provider with deployment URL placeholder", async () => {
    const requestUrlMock = vi.spyOn(obsidian, "requestUrl");
    requestUrlMock.mockResolvedValueOnce({
      status: 200,
      headers: {},
      arrayBuffer: new ArrayBuffer(0),
      text: "",
      json: {
        choices: [
          {
            message: {
              content: "{\"cards\":[{\"sectionIndex\":1,\"question\":\"Azure题目\",\"answer\":\"Azure答案\"}]}"
            }
          }
        ]
      }
    });

    const cards = await generateAiFlashcards(SECTIONS, createSettings({
      aiProvider: "azure-openai",
      aiApiUrl: "https://demo.openai.azure.com/openai/deployments/{model}/chat/completions?api-version=2024-06-01",
      aiModel: "gpt-4o-mini-deploy"
    }));

    expect(requestUrlMock).toHaveBeenCalledWith(expect.objectContaining({
      url: "https://demo.openai.azure.com/openai/deployments/gpt-4o-mini-deploy/chat/completions?api-version=2024-06-01",
      headers: expect.objectContaining({
        "api-key": "test-key"
      })
    }));
    expect(cards[0]).toMatchObject({
      question: "Azure题目",
      answer: "Azure答案",
      sourceHeading: "牛顿第二定律"
    });
  });

  it("supports Gemini provider response and model placeholder URL", async () => {
    const requestUrlMock = vi.spyOn(obsidian, "requestUrl");
    requestUrlMock.mockResolvedValueOnce({
      status: 200,
      headers: {},
      arrayBuffer: new ArrayBuffer(0),
      text: "",
      json: {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: "{\"cards\":[{\"sectionIndex\":1,\"question\":\"Gemini题目\",\"answer\":\"Gemini答案\"}]}"
                }
              ]
            }
          }
        ]
      }
    });

    const cards = await generateAiFlashcards(SECTIONS, createSettings({
      aiProvider: "gemini",
      aiApiUrl: "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
      aiModel: "gemini-2.5-flash"
    }));

    expect(requestUrlMock).toHaveBeenCalledWith(expect.objectContaining({
      url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      headers: expect.objectContaining({
        "x-goog-api-key": "test-key"
      })
    }));
    expect(cards[0]).toMatchObject({
      question: "Gemini题目",
      answer: "Gemini答案",
      sourceHeading: "牛顿第二定律"
    });
  });

  it("throws when the model response is not valid JSON cards", async () => {
    const requestUrlMock = vi.spyOn(obsidian, "requestUrl");
    requestUrlMock.mockResolvedValueOnce({
      status: 200,
      headers: {},
      arrayBuffer: new ArrayBuffer(0),
      text: "",
      json: {
        choices: [
          {
            message: {
              content: "不是合法 JSON"
            }
          }
        ]
      }
    });

    await expect(generateAiFlashcards(SECTIONS, createSettings())).rejects.toThrow(GENERATION_COPY.errors.aiInvalidResponse);
  });

  it("surfaces API failure details from the provider", async () => {
    const requestUrlMock = vi.spyOn(obsidian, "requestUrl");
    requestUrlMock.mockResolvedValueOnce({
      status: 401,
      headers: {},
      arrayBuffer: new ArrayBuffer(0),
      text: "",
      json: {
        error: {
          message: "Invalid API key"
        }
      }
    });

    await expect(generateAiFlashcards(SECTIONS, createSettings())).rejects.toThrow("Invalid API key");
  });

  it("wraps network exceptions as provider call errors", async () => {
    vi.spyOn(obsidian, "requestUrl").mockRejectedValueOnce(new Error("network unreachable"));

    await expect(generateAiFlashcards(SECTIONS, createSettings())).rejects.toThrow("network unreachable");
  });

  it("tests provider connection successfully", async () => {
    vi.spyOn(obsidian, "requestUrl").mockResolvedValueOnce({
      status: 200,
      headers: {},
      arrayBuffer: new ArrayBuffer(0),
      text: "",
      json: {
        choices: [
          {
            message: {
              content: "ok"
            }
          }
        ]
      }
    });

    await expect(testAiConnection(createSettings())).resolves.toBeUndefined();
  });

  it("fails provider connection when response has no content", async () => {
    vi.spyOn(obsidian, "requestUrl").mockResolvedValueOnce({
      status: 200,
      headers: {},
      arrayBuffer: new ArrayBuffer(0),
      text: "",
      json: {
        choices: []
      }
    });

    await expect(testAiConnection(createSettings())).rejects.toThrow(GENERATION_COPY.errors.aiInvalidResponse);
  });
});
