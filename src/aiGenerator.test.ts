import * as obsidian from "obsidian";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AI_MODEL_ERRORS } from "./aiModelState";
import { generateAiFlashcards, generateAiFlashcardsForMistakeTopic, generateAiTopicFromCard, testAiConnection } from "./aiGenerator";
import { GENERATION_COPY } from "./generationStrategy";
import type { AiModelConfig, Flashcard, NoteFlashcardsSettings, ParsedSection } from "./types";

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

function createModelConfig(overrides: Partial<AiModelConfig> = {}): AiModelConfig {
  return {
    id: "model-1",
    name: "测试模型",
    provider: "openai-compatible",
    apiUrl: "https://api.openai.com/v1/chat/completions",
    apiKey: "test-key",
    model: "gpt-4o-mini",
    prompt: "",
    ...overrides
  };
}

function createSettings(overrides: Partial<NoteFlashcardsSettings> = {}, modelOverrides: Partial<AiModelConfig> = {}): NoteFlashcardsSettings {
  const model = createModelConfig(modelOverrides);
  return {
    generatorMode: "ai",
    maxCardsPerNote: 5,
    summaryLength: 20,
    mistakeTopicCardEntryEnabled: true,
    aiModelConfigs: [model],
    activeAiModelId: model.id,
    aiSectionCollapsed: true,
    ignoredFolders: [],
    newCardsPerDay: 10,
    showAllCardsInReview: false,
    learningStepsMinutes: [1, 10],
    graduatingIntervalDays: 1,
    easyIntervalDays: 4,
    ...overrides
  };
}

function createMistakeCard(overrides: Partial<Flashcard> = {}): Flashcard {
  return {
    id: "mistake-1",
    question: "哈希表如何处理冲突？",
    answer: "常见方法有链地址法和开放寻址。",
    sourcePath: "algo.md",
    sourceHeading: "哈希表",
    sourceAnchorText: "冲突处理",
    generatorType: "rule",
    createdAt: "2026-04-10T00:00:00.000Z",
    dueAt: "2026-04-10T00:00:00.000Z",
    intervalDays: 0,
    easeFactor: 2.5,
    repetition: 0,
    lapseCount: 0,
    reviewCount: 0,
    cardState: "new",
    learningStep: 0,
    inMistakeBook: true,
    isMastered: false,
    mistakeSuccessStreak: 0,
    ...overrides
  };
}

describe("generateAiFlashcards", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws when required AI settings are missing", async () => {
    await expect(generateAiFlashcards(SECTIONS, createSettings({}, { apiKey: "" }))).rejects.toThrow("API Key");
  });

  it("throws when no active model is selected", async () => {
    await expect(generateAiFlashcards(SECTIONS, createSettings({ activeAiModelId: "" }))).rejects.toThrow(AI_MODEL_ERRORS.noActiveModel);
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

  it("supports OpenAI-compatible /responses endpoint request and response format", async () => {
    const requestUrlMock = vi.spyOn(obsidian, "requestUrl");
    requestUrlMock.mockResolvedValueOnce({
      status: 200,
      headers: {},
      arrayBuffer: new ArrayBuffer(0),
      text: "",
      json: {
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: "{\"cards\":[{\"sectionIndex\":0,\"question\":\"Responses题目\",\"answer\":\"Responses答案\"}]}"
              }
            ]
          }
        ]
      }
    });

    const cards = await generateAiFlashcards(SECTIONS, createSettings({}, {
      apiUrl: "https://api.openai.com/v1/responses",
      model: "gpt-5.4"
    }));

    expect(requestUrlMock).toHaveBeenCalledWith(expect.objectContaining({
      url: "https://api.openai.com/v1/responses",
      method: "POST"
    }));
    const requestPayload = JSON.parse(((requestUrlMock.mock.calls[0]?.[0] as { body?: string })?.body) ?? "{}") as {
      input?: unknown;
      messages?: unknown;
      instructions?: unknown;
      temperature?: unknown;
    };
    expect(Array.isArray(requestPayload.input)).toBe(true);
    expect(requestPayload.messages).toBeUndefined();
    expect(typeof requestPayload.instructions).toBe("string");
    expect(requestPayload.temperature).toBeUndefined();
    expect(cards[0]).toMatchObject({
      question: "Responses题目",
      answer: "Responses答案",
      sourceHeading: "牛顿第一定律"
    });
  });

  it("falls back to parsing SSE text when /responses JSON decoding fails", async () => {
    const requestUrlMock = vi.spyOn(obsidian, "requestUrl");
    requestUrlMock.mockResolvedValueOnce({
      status: 200,
      headers: {},
      arrayBuffer: new ArrayBuffer(0),
      text: [
        "event: response.output_text.delta",
        "data: {\"delta\":\"{\\\"cards\\\":[{\\\"sectionIndex\\\":0,\\\"question\\\":\\\"SSE题目\\\",\\\"answer\\\":\\\"SSE答案\\\"}]}\"}",
        "",
        "data: [DONE]",
        ""
      ].join("\n"),
      get json() {
        throw new Error("Unexpected token 'e', \"event: res\"... is not valid JSON");
      }
    });

    const cards = await generateAiFlashcards(SECTIONS, createSettings({}, {
      apiUrl: "https://api.openai.com/v1/responses",
      model: "gpt-5.4"
    }));

    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      question: "SSE题目",
      answer: "SSE答案",
      sourceHeading: "牛顿第一定律"
    });
  });

  it("falls back to SSE text when JSON payload is present but has no extractable content", async () => {
    const requestUrlMock = vi.spyOn(obsidian, "requestUrl");
    requestUrlMock.mockResolvedValueOnce({
      status: 200,
      headers: {},
      arrayBuffer: new ArrayBuffer(0),
      text: [
        "event: response.output_text.delta",
        "data: {\"type\":\"response.output_text.delta\",\"delta\":\"{\\\"cards\\\":[{\\\"sectionIndex\\\":0,\\\"question\\\":\\\"SSE兜底题目\\\",\\\"answer\\\":\\\"SSE兜底答案\\\"}]}\"}",
        "",
        "event: response.completed",
        "data: {\"type\":\"response.completed\",\"response\":{\"output_text\":\"ignored\"}}",
        "",
        "data: [DONE]",
        ""
      ].join("\n"),
      json: {}
    });

    const cards = await generateAiFlashcards(SECTIONS, createSettings({}, {
      apiUrl: "https://api.openai.com/v1/responses",
      model: "gpt-5.4"
    }));

    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      question: "SSE兜底题目",
      answer: "SSE兜底答案",
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

    const cards = await generateAiFlashcards(SECTIONS, createSettings({}, {
      provider: "anthropic",
      apiUrl: "https://api.anthropic.com/v1/messages",
      model: "claude-3-7-sonnet-latest"
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

    const cards = await generateAiFlashcards(SECTIONS, createSettings({}, {
      provider: "openrouter",
      apiUrl: "https://openrouter.ai/api/v1/chat/completions",
      model: "openai/gpt-4o-mini"
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

    const cards = await generateAiFlashcards(SECTIONS, createSettings({}, {
      provider: "azure-openai",
      apiUrl: "https://demo.openai.azure.com/openai/deployments/{model}/chat/completions?api-version=2024-06-01",
      model: "gpt-4o-mini-deploy"
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

    const cards = await generateAiFlashcards(SECTIONS, createSettings({}, {
      provider: "gemini",
      apiUrl: "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
      model: "gemini-2.5-flash"
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

  it("surfaces auth failure in Chinese with provider detail", async () => {
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

    const error = await generateAiFlashcards(SECTIONS, createSettings()).catch((value) => value);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("鉴权失败");
    expect((error as Error).message).toContain("Invalid API key");
  });

  it("surfaces rate limit failure in Chinese", async () => {
    vi.spyOn(obsidian, "requestUrl").mockResolvedValueOnce({
      status: 429,
      headers: {},
      arrayBuffer: new ArrayBuffer(0),
      text: "",
      json: {
        error: {
          message: "Rate limit exceeded"
        }
      }
    });

    await expect(generateAiFlashcards(SECTIONS, createSettings())).rejects.toThrow("配额不足");
  });

  it("wraps network exceptions as Chinese network errors", async () => {
    vi.spyOn(obsidian, "requestUrl").mockRejectedValueOnce(new Error("network unreachable"));

    const error = await generateAiFlashcards(SECTIONS, createSettings()).catch((value) => value);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("网络请求失败");
    expect((error as Error).message).toContain("network unreachable");
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

    await expect(testAiConnection(createModelConfig())).resolves.toBeUndefined();
  });

  it("tests /responses provider connection successfully", async () => {
    vi.spyOn(obsidian, "requestUrl").mockResolvedValueOnce({
      status: 200,
      headers: {},
      arrayBuffer: new ArrayBuffer(0),
      text: "",
      json: {
        output_text: "ok"
      }
    });

    await expect(testAiConnection(createModelConfig({
      apiUrl: "https://api.openai.com/v1/responses",
      model: "gpt-5.4"
    }))).resolves.toBeUndefined();
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

    await expect(testAiConnection(createModelConfig())).rejects.toThrow(GENERATION_COPY.errors.aiInvalidResponse);
  });

  it("extracts a topic from AI response for mistake-topic fallback", async () => {
    vi.spyOn(obsidian, "requestUrl").mockResolvedValueOnce({
      status: 200,
      headers: {},
      arrayBuffer: new ArrayBuffer(0),
      text: "",
      json: {
        choices: [
          {
            message: {
              content: "{\"topic\":\"动态规划\"}"
            }
          }
        ]
      }
    });

    await expect(generateAiTopicFromCard(createMistakeCard(), createSettings())).resolves.toBe("动态规划");
  });

  it("generates mistake-topic flashcards with fixed count target", async () => {
    vi.spyOn(obsidian, "requestUrl").mockResolvedValueOnce({
      status: 200,
      headers: {},
      arrayBuffer: new ArrayBuffer(0),
      text: "",
      json: {
        choices: [
          {
            message: {
              content: "{\"cards\":[{\"question\":\"Q1\",\"answer\":\"A1\"},{\"question\":\"Q2\",\"answer\":\"A2\"}]}"
            }
          }
        ]
      }
    });

    const cards = await generateAiFlashcardsForMistakeTopic(createMistakeCard({ sourceHeading: "" }), "哈希表专题", createSettings(), 2);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({
      question: "Q1",
      answer: "A1",
      sourcePath: "algo.md",
      sourceHeading: "哈希表专题",
      generatorType: "ai"
    });
  });

  it("throws when mistake-topic card count is less than target", async () => {
    vi.spyOn(obsidian, "requestUrl").mockResolvedValueOnce({
      status: 200,
      headers: {},
      arrayBuffer: new ArrayBuffer(0),
      text: "",
      json: {
        choices: [
          {
            message: {
              content: "{\"cards\":[{\"question\":\"Q1\",\"answer\":\"A1\"},{\"question\":\"Q2\",\"answer\":\"A2\"}]}"
            }
          }
        ]
      }
    });

    await expect(generateAiFlashcardsForMistakeTopic(createMistakeCard(), "哈希表", createSettings(), 5)).rejects.toThrow("AI 返回卡片数量不足");
  });
});
