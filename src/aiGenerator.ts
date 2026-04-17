import { requestUrl } from "obsidian";
import { getActiveAiModelOrThrow, validateModelConfigForRequest } from "./aiModelState";
import { createNewFlashcard } from "./cardFactory";
import { GENERATION_COPY } from "./generationStrategy";
import type { AiModelConfig, Flashcard, NoteFlashcardsSettings, ParsedSection } from "./types";

type AiFlashcardPayload = {
  sectionIndex?: unknown;
  question?: unknown;
  answer?: unknown;
};

type AiResponsePayload = {
  cards?: unknown;
};

type AiTopicPayload = {
  topic?: unknown;
};

type OpenAiCompatibleResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string }>;
    };
  }>;
  output_text?: unknown;
  output?: unknown;
};

const DEFAULT_SYSTEM_PROMPT = [
  "你是一个严谨的学习卡片生成助手。",
  "你只能基于用户提供的笔记内容生成闪卡，不要补充外部知识。",
  "输出必须是严格 JSON，不能输出 Markdown 代码块或额外解释。"
].join(" ");

function resolveProviderApiUrl(apiUrl: string, model: string): string {
  return apiUrl.includes("{model}") ? apiUrl.replace("{model}", encodeURIComponent(model)) : apiUrl;
}

type OpenAiStreamProbeMode = "responses" | "chat-completions";
type RuntimeRequire = (id: string) => unknown;

function isResponsesEndpoint(apiUrl: string): boolean {
  try {
    return /\/responses\/?$/.test(new URL(apiUrl).pathname);
  } catch (_error) {
    return false;
  }
}

function getOpenAiStreamProbeMode(config: AiModelConfig, apiUrl: string): OpenAiStreamProbeMode | null {
  if (config.provider !== "openai-compatible" && config.provider !== "openrouter") {
    return null;
  }
  try {
    const pathname = new URL(apiUrl).pathname;
    if (/\/responses\/?$/.test(pathname)) {
      return "responses";
    }
    if (/\/chat\/completions\/?$/.test(pathname)) {
      return "chat-completions";
    }
  } catch (_error) {
    return null;
  }
  return null;
}

function getBrowserFetch():
  ((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) | null {
  if (typeof window === "undefined" || typeof window.fetch !== "function") {
    return null;
  }
  return window.fetch.bind(window);
}

function getRuntimeRequire(): RuntimeRequire | null {
  if (typeof require === "function") {
    return require as RuntimeRequire;
  }
  const candidate = (globalThis as { require?: unknown }).require;
  return typeof candidate === "function" ? candidate as RuntimeRequire : null;
}

function getNodeHttpRequest(protocol: string): ((options: unknown, callback: (response: unknown) => void) => {
  on: (event: string, listener: (error: unknown) => void) => void;
  setTimeout?: (timeout: number, callback: () => void) => void;
  destroy?: (error?: Error) => void;
  write: (chunk: string) => void;
  end: () => void;
}) | null {
  const runtimeRequire = getRuntimeRequire();
  if (!runtimeRequire) {
    return null;
  }

  try {
    if (protocol === "https:") {
      const httpsModule = runtimeRequire("https") as { request?: unknown };
      return typeof httpsModule.request === "function"
        ? httpsModule.request as (options: unknown, callback: (response: unknown) => void) => {
          on: (event: string, listener: (error: unknown) => void) => void;
          setTimeout?: (timeout: number, callback: () => void) => void;
          destroy?: (error?: Error) => void;
          write: (chunk: string) => void;
          end: () => void;
        }
        : null;
    }

    if (protocol === "http:") {
      const httpModule = runtimeRequire("http") as { request?: unknown };
      return typeof httpModule.request === "function"
        ? httpModule.request as (options: unknown, callback: (response: unknown) => void) => {
          on: (event: string, listener: (error: unknown) => void) => void;
          setTimeout?: (timeout: number, callback: () => void) => void;
          destroy?: (error?: Error) => void;
          write: (chunk: string) => void;
          end: () => void;
        }
        : null;
    }
  } catch (_error) {
    return null;
  }

  return null;
}

function clip(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength).trim()}…`;
}

function collectResponsesText(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectResponsesText(item));
  }
  if (!value || typeof value !== "object") {
    return [];
  }

  const payload = value as {
    text?: unknown;
    output_text?: unknown;
    content?: unknown;
    output?: unknown;
    delta?: unknown;
    message?: unknown;
  };
  return [
    ...collectResponsesText(payload.output_text),
    ...collectResponsesText(payload.text),
    ...collectResponsesText(payload.content),
    ...collectResponsesText(payload.output),
    ...collectResponsesText(payload.delta),
    ...collectResponsesText(payload.message)
  ];
}

function extractOpenAiResponsesContent(response: unknown): string {
  const payload = response as OpenAiCompatibleResponse;
  return [
    ...collectResponsesText(payload.output_text),
    ...collectResponsesText(payload.output)
  ].join("").trim();
}

function extractOpenAiContent(response: unknown): string {
  const responsesContent = extractOpenAiResponsesContent(response);
  if (responsesContent) {
    return responsesContent;
  }

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

function extractOpenAiStreamContent(payload: unknown): string {
  const chatDelta = (payload as { choices?: Array<{ delta?: { content?: string | Array<{ text?: string }> } }> })
    .choices?.[0]?.delta?.content;
  if (typeof chatDelta === "string") {
    return chatDelta.trim();
  }
  if (Array.isArray(chatDelta)) {
    return chatDelta
      .map((part) => typeof part?.text === "string" ? part.text : "")
      .join("")
      .trim();
  }

  const directDelta = (payload as { delta?: unknown }).delta;
  if (typeof directDelta === "string") {
    return directDelta.trim();
  }

  return "";
}

function extractStreamEventError(payload: unknown): string {
  const directError = (payload as { error?: unknown }).error;
  if (typeof directError === "string" && directError.trim().length > 0) {
    return directError.trim();
  }
  const nestedMessage = (directError as { message?: unknown } | undefined)?.message;
  if (typeof nestedMessage === "string" && nestedMessage.trim().length > 0) {
    return nestedMessage.trim();
  }
  const message = (payload as { message?: unknown }).message;
  if (typeof message === "string" && message.trim().length > 0) {
    return message.trim();
  }
  return "";
}

function buildStreamingProbeBody(body: string): string | null {
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body) as Record<string, unknown>;
  } catch (_error) {
    return null;
  }

  payload.stream = true;

  return JSON.stringify(payload);
}

function readSseDataFrames(buffer: string): { frames: string[]; rest: string } {
  const chunks = buffer.split(/\r?\n\r?\n/);
  const rest = chunks.pop() ?? "";
  return { frames: chunks, rest };
}

async function cancelReader(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> {
  try {
    await reader.cancel();
  } catch (_error) {
    // Ignore cancel errors when stream is already closed.
  }
}

function parseStreamFrame(frame: string): { isDone: boolean; payload: Record<string, unknown> | null } {
  const dataLines = frame
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart());

  if (dataLines.length === 0) {
    return { isDone: false, payload: null };
  }

  const data = dataLines.join("\n").trim();
  if (!data) {
    return { isDone: false, payload: null };
  }
  if (data === "[DONE]") {
    return { isDone: true, payload: null };
  }

  try {
    const payload = JSON.parse(data);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return { isDone: false, payload: null };
    }
    return { isDone: false, payload: payload as Record<string, unknown> };
  } catch (_error) {
    return { isDone: false, payload: null };
  }
}

async function readStreamingProbeContent(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const { frames, rest } = readSseDataFrames(buffer);
      buffer = rest;

      for (const frame of frames) {
        const parsed = parseStreamFrame(frame);
        if (parsed.isDone) {
          await cancelReader(reader);
          return "ok";
        }
        if (!parsed.payload) {
          continue;
        }
        const eventError = extractStreamEventError(parsed.payload);
        if (eventError) {
          throw new Error(eventError);
        }

        const streamed = extractOpenAiStreamContent(parsed.payload);
        await cancelReader(reader);
        return streamed || "ok";
      }
    }

    buffer += decoder.decode();
    const { frames } = readSseDataFrames(buffer);
    for (const frame of frames) {
      const parsed = parseStreamFrame(frame);
      if (parsed.isDone) {
        return "ok";
      }
      if (!parsed.payload) {
        continue;
      }
      const eventError = extractStreamEventError(parsed.payload);
      if (eventError) {
        throw new Error(eventError);
      }
      const streamed = extractOpenAiStreamContent(parsed.payload);
      if (streamed) {
        return streamed;
      }
      return "ok";
    }
  } finally {
    reader.releaseLock();
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

function extractProviderContent(response: unknown, provider: AiModelConfig["provider"]): string {
  if (provider === "anthropic") {
    return extractAnthropicContent(response);
  }
  if (provider === "gemini") {
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

function parseAiTopicResponse(content: string): string {
  const cleaned = stripMarkdownCodeFence(content).trim();
  if (!cleaned) {
    return "";
  }

  try {
    const parsed = JSON.parse(extractJsonText(cleaned)) as AiTopicPayload;
    if (typeof parsed.topic === "string") {
      return parsed.topic.trim();
    }
  } catch (_error) {
    // Fallback to plain text mode.
  }

  return cleaned
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0) ?? "";
}

function buildUserPrompt(sections: ParsedSection[], settings: NoteFlashcardsSettings, modelConfig: AiModelConfig): string {
  const payload = sections.map((section, index) => ({
    sectionIndex: index,
    heading: section.heading,
    content: section.content,
    listItems: section.listItems
  }));
  const extraPrompt = modelConfig.prompt.trim();

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

function normalizeMistakeTopicCards(
  payload: AiResponsePayload | null,
  section: ParsedSection,
  maxCards: number,
  summaryLength: number
): Flashcard[] {
  if (!payload || !Array.isArray(payload.cards)) {
    return [];
  }

  return payload.cards
    .slice(0, maxCards)
    .flatMap((item) => {
      const card = item as { question?: unknown; answer?: unknown };
      const question = typeof card.question === "string" ? card.question.trim() : "";
      const answer = typeof card.answer === "string" ? clip(card.answer.trim(), summaryLength) : "";
      if (!question || !answer) {
        return [];
      }
      return [createNewFlashcard(question, answer, section, "ai")];
    });
}

function buildProviderRequest(userPrompt: string, config: AiModelConfig): {
  url: string;
  headers: Record<string, string>;
  body: string;
} {
  const apiUrl = config.apiUrl.trim();
  const model = config.model.trim();
  const apiKey = config.apiKey.trim();

  if (config.provider === "anthropic") {
    return {
      url: apiUrl,
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

  if (config.provider === "gemini") {
    return {
      url: resolveProviderApiUrl(apiUrl, model),
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

  if (config.provider === "azure-openai") {
    return {
      url: resolveProviderApiUrl(apiUrl, model),
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

  if (config.provider === "openrouter") {
    const useResponsesApi = isResponsesEndpoint(apiUrl);
    return {
      url: apiUrl,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json"
      },
      body: JSON.stringify({
        model,
        ...(useResponsesApi ? {
          stream: false,
          instructions: DEFAULT_SYSTEM_PROMPT,
          input: [
            {
              role: "user",
              content: userPrompt
            }
          ]
        } : {
          stream: false,
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
      })
    };
  }

  const useResponsesApi = isResponsesEndpoint(apiUrl);
  return {
    url: apiUrl,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json"
    },
    body: JSON.stringify({
      model,
      ...(useResponsesApi ? {
        stream: false,
        instructions: DEFAULT_SYSTEM_PROMPT,
        input: [
          {
            role: "user",
            content: userPrompt
          }
        ]
      } : {
        stream: false,
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

function appendRawDetail(base: string, rawDetail: string): string {
  return rawDetail.trim().length > 0 ? `${base}（${rawDetail}）` : base;
}

function toHttpErrorMessage(status: number, rawDetail: string): string {
  if (status === 401 || status === 403) {
    return appendRawDetail("鉴权失败，请检查 API Key 或账号权限", rawDetail);
  }
  if (status === 429) {
    return appendRawDetail("请求过于频繁或配额不足，请稍后重试", rawDetail);
  }
  if (status >= 500) {
    return appendRawDetail("模型服务异常，请稍后重试", rawDetail);
  }
  return appendRawDetail("请求失败，请检查模型配置或接口状态", rawDetail || `HTTP ${status}`);
}

function toNetworkErrorMessage(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : "";
  const normalized = rawMessage.toLowerCase();
  if (normalized.includes("timeout")) {
    return appendRawDetail("网络超时，请检查网络或稍后重试", rawMessage);
  }
  if (normalized.includes("network") || normalized.includes("unreachable") || normalized.includes("enotfound")) {
    return appendRawDetail("网络请求失败，请检查网络连接和 API URL", rawMessage);
  }
  return appendRawDetail("网络请求失败，请检查网络连接和 API URL", rawMessage);
}

function extractProviderContentFromSseText(rawText: string, provider: AiModelConfig["provider"]): string {
  if (!rawText.trim()) {
    return "";
  }
  const { frames } = readSseDataFrames(`${rawText}\n\n`);
  let merged = "";
  let completedResponseContent = "";

  for (const frame of frames) {
    const parsed = parseStreamFrame(frame);
    if (parsed.isDone) {
      break;
    }
    if (!parsed.payload) {
      continue;
    }
    const eventError = extractStreamEventError(parsed.payload);
    if (eventError) {
      throw new Error(GENERATION_COPY.errors.aiRequestFailed(toHttpErrorMessage(400, eventError)));
    }

    const streamed = extractOpenAiStreamContent(parsed.payload);
    if (streamed) {
      merged += streamed;
      continue;
    }

    const payloadWithResponse = parsed.payload as { response?: unknown };
    const content = extractProviderContent(payloadWithResponse.response ?? parsed.payload, provider);
    if (content) {
      completedResponseContent = content;
    }
  }

  const mergedContent = merged.trim();
  return mergedContent || completedResponseContent.trim();
}

async function requestProviderContent(userPrompt: string, config: AiModelConfig): Promise<string> {
  const requestConfig = buildProviderRequest(userPrompt, config);
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
    throw new Error(GENERATION_COPY.errors.aiRequestFailed(toNetworkErrorMessage(error)));
  }

  const responseText = typeof response.text === "string" ? response.text : "";
  let responseJson: Record<string, unknown> | null = null;
  let responseJsonError: Error | null = null;

  try {
    responseJson = response.json;
  } catch (error) {
    responseJsonError = error instanceof Error ? error : new Error(String(error));
  }

  if (response.status >= 400) {
    const rawDetail = responseJson !== null
      ? extractErrorDetail(response.status, responseJson)
      : extractErrorDetailFromRawText(response.status, responseText || responseJsonError?.message || "");
    throw new Error(GENERATION_COPY.errors.aiRequestFailed(toHttpErrorMessage(response.status, rawDetail)));
  }

  if (responseJson !== null) {
    const contentFromJson = extractProviderContent(responseJson, config.provider);
    if (contentFromJson.trim()) {
      return contentFromJson;
    }
  }

  if (responseText.trim()) {
    const sseContent = extractProviderContentFromSseText(responseText, config.provider);
    if (sseContent) {
      return sseContent;
    }
    try {
      const parsedResponse = JSON.parse(responseText);
      if (parsedResponse && typeof parsedResponse === "object" && !Array.isArray(parsedResponse)) {
        return extractProviderContent(parsedResponse as Record<string, unknown>, config.provider);
      }
    } catch (_error) {
      return responseText.trim();
    }
  }

  if (responseJsonError) {
    throw responseJsonError;
  }
  return "";
}

function extractErrorDetailFromRawText(status: number, text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return `HTTP ${status}`;
  }
  try {
    return extractErrorDetail(status, JSON.parse(trimmed) as unknown);
  } catch (_error) {
    return trimmed.length > 300 ? `${trimmed.slice(0, 300)}…` : trimmed;
  }
}

async function extractFetchErrorDetail(status: number, response: Response): Promise<string> {
  return extractErrorDetailFromRawText(status, await response.text());
}

async function requestProviderContentByStreamingProbe(userPrompt: string, config: AiModelConfig): Promise<string | null> {
  const apiUrl = config.apiUrl.trim();
  const streamMode = getOpenAiStreamProbeMode(config, apiUrl);
  if (!streamMode) {
    return null;
  }

  const browserFetch = getBrowserFetch();
  if (!browserFetch) {
    return null;
  }

  const requestConfig = buildProviderRequest(userPrompt, config);
  const streamingBody = buildStreamingProbeBody(requestConfig.body);
  if (!streamingBody) {
    return null;
  }

  let response: Response;
  try {
    response = await browserFetch(requestConfig.url, {
      method: "POST",
      headers: {
        Accept: "text/event-stream",
        "Content-Type": "application/json",
        ...requestConfig.headers
      },
      body: streamingBody
    });
  } catch (_error) {
    // Keep compatibility when browser fetch is blocked (for example CORS).
    return null;
  }

  if (!response.ok) {
    const rawDetail = await extractFetchErrorDetail(response.status, response);
    throw new Error(GENERATION_COPY.errors.aiRequestFailed(toHttpErrorMessage(response.status, rawDetail)));
  }

  if (!response.body) {
    return null;
  }

  try {
    const streamed = await readStreamingProbeContent(response.body);
    return streamed || null;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "stream_error";
    throw new Error(GENERATION_COPY.errors.aiRequestFailed(toHttpErrorMessage(400, detail)));
  }
}

async function requestProviderContentByNodeStreamingProbe(userPrompt: string, config: AiModelConfig): Promise<string | null> {
  const apiUrl = config.apiUrl.trim();
  const streamMode = getOpenAiStreamProbeMode(config, apiUrl);
  if (!streamMode) {
    return null;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(apiUrl);
  } catch (_error) {
    return null;
  }

  const nodeRequest = getNodeHttpRequest(parsedUrl.protocol);
  if (!nodeRequest) {
    return null;
  }

  const requestConfig = buildProviderRequest(userPrompt, config);
  const streamingBody = buildStreamingProbeBody(requestConfig.body);
  if (!streamingBody) {
    return null;
  }

  const contentLength = typeof Buffer !== "undefined"
    ? Buffer.byteLength(streamingBody).toString()
    : String(streamingBody.length);

  return await new Promise<string | null>((resolve, reject) => {
    let settled = false;

    const settleResolve = (value: string | null): void => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(value);
    };

    const settleReject = (error: Error): void => {
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    };

    const request = nodeRequest({
      protocol: parsedUrl.protocol,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port ? Number(parsedUrl.port) : undefined,
      path: `${parsedUrl.pathname}${parsedUrl.search}`,
      method: "POST",
      headers: {
        Accept: "text/event-stream",
        "Content-Type": "application/json",
        "Content-Length": contentLength,
        ...requestConfig.headers
      }
    }, (response) => {
      const stream = response as {
        statusCode?: number;
        setEncoding?: (encoding: string) => void;
        on: (event: string, listener: (chunk?: string) => void) => void;
        destroy?: () => void;
      };
      const status = stream.statusCode ?? 0;
      let rawText = "";
      let buffer = "";

      if (typeof stream.setEncoding === "function") {
        stream.setEncoding("utf8");
      }

      if (status >= 400) {
        stream.on("data", (chunk = "") => {
          rawText += chunk;
        });
        stream.on("end", () => {
          const rawDetail = extractErrorDetailFromRawText(status, rawText);
          settleReject(new Error(GENERATION_COPY.errors.aiRequestFailed(toHttpErrorMessage(status, rawDetail))));
        });
        stream.on("error", () => {
          settleResolve(null);
        });
        return;
      }

      stream.on("data", (chunk = "") => {
        if (settled) {
          return;
        }
        rawText += chunk;
        buffer += chunk;

        const { frames, rest } = readSseDataFrames(buffer);
        buffer = rest;
        for (const frame of frames) {
          const parsed = parseStreamFrame(frame);
          if (parsed.isDone) {
            stream.destroy?.();
            settleResolve("ok");
            return;
          }
          if (!parsed.payload) {
            continue;
          }

          const eventError = extractStreamEventError(parsed.payload);
          if (eventError) {
            settleReject(new Error(GENERATION_COPY.errors.aiRequestFailed(toHttpErrorMessage(400, eventError))));
            return;
          }

          const streamed = extractOpenAiStreamContent(parsed.payload);
          if (streamed) {
            stream.destroy?.();
            settleResolve(streamed);
            return;
          }
        }
      });

      stream.on("end", () => {
        if (settled) {
          return;
        }

        const pending = buffer.trim();
        if (pending.length > 0) {
          const parsed = parseStreamFrame(pending);
          if (parsed.isDone) {
            settleResolve("ok");
            return;
          }
          if (parsed.payload) {
            const eventError = extractStreamEventError(parsed.payload);
            if (eventError) {
              settleReject(new Error(GENERATION_COPY.errors.aiRequestFailed(toHttpErrorMessage(400, eventError))));
              return;
            }
            const streamed = extractOpenAiStreamContent(parsed.payload);
            if (streamed) {
              settleResolve(streamed);
              return;
            }
          }
        }

        try {
          const parsed = JSON.parse(rawText) as unknown;
          const content = extractProviderContent(parsed, config.provider);
          settleResolve(content || null);
        } catch (_error) {
          settleResolve(null);
        }
      });

      stream.on("error", () => {
        settleResolve(null);
      });
    });

    request.on("error", () => {
      settleResolve(null);
    });
    request.setTimeout?.(15_000, () => {
      request.destroy?.(new Error("timeout"));
      settleResolve(null);
    });
    request.write(streamingBody);
    request.end();
  });
}

export async function generateAiFlashcards(sections: ParsedSection[], settings: NoteFlashcardsSettings): Promise<Flashcard[]> {
  const modelConfig = getActiveAiModelOrThrow(settings);

  if (sections.length === 0) {
    return [];
  }

  const content = await requestProviderContent(buildUserPrompt(sections, settings, modelConfig), modelConfig);
  const cards = normalizeCards(parseAiResponse(content), sections, settings);
  if (cards.length === 0) {
    throw new Error(GENERATION_COPY.errors.aiInvalidResponse);
  }

  return cards;
}

export async function generateAiTopicFromCard(card: Flashcard, settings: NoteFlashcardsSettings): Promise<string> {
  const modelConfig = getActiveAiModelOrThrow(settings);
  const sourceContext = [
    card.sourceHeading ? `sourceHeading=${card.sourceHeading}` : "",
    card.sourceAnchorText ? `sourceAnchorText=${card.sourceAnchorText}` : "",
    `question=${card.question}`,
    `answer=${card.answer}`
  ].filter(Boolean).join("\n");
  const prompt = [
    "请基于以下错题信息识别一个最核心的学习主题。",
    "只返回 JSON：{\"topic\":\"主题\"}",
    "主题必须简洁（2-24字），不要输出解释。",
    sourceContext
  ].join("\n");

  const content = await requestProviderContent(prompt, modelConfig);
  const topic = parseAiTopicResponse(content);
  if (!topic) {
    throw new Error("AI 未返回可用主题，请稍后重试。");
  }
  return topic;
}

export async function generateAiFlashcardsForMistakeTopic(
  card: Flashcard,
  topic: string,
  settings: NoteFlashcardsSettings,
  targetCount = 5
): Promise<Flashcard[]> {
  const modelConfig = getActiveAiModelOrThrow(settings);
  const section: ParsedSection = {
    heading: card.sourceHeading?.trim() || topic,
    content: [card.question, card.answer].filter(Boolean).join("\n"),
    listItems: [],
    sourcePath: card.sourcePath,
    sourceAnchorText: card.sourceAnchorText,
    sourceStartLine: card.sourceStartLine,
    sourceEndLine: card.sourceEndLine
  };
  const prompt = [
    `你正在为错题主题“${topic}”生成补强闪卡。`,
    `请严格生成 ${targetCount} 张中文问答卡片。`,
    `每张卡片 answer 尽量控制在 ${settings.summaryLength} 字以内。`,
    "不要重复原错题表述，优先覆盖定义、易错点、对比、应用场景。",
    "仅输出 JSON，格式：{\"cards\":[{\"question\":\"问题\",\"answer\":\"答案\"}]}",
    `错题问题：${card.question}`,
    `错题答案：${card.answer}`,
    modelConfig.prompt.trim().length > 0 ? `额外要求：${modelConfig.prompt.trim()}` : ""
  ].filter(Boolean).join("\n");

  const content = await requestProviderContent(prompt, modelConfig);
  const cards = normalizeMistakeTopicCards(parseAiResponse(content), section, targetCount, settings.summaryLength);
  if (cards.length === 0) {
    throw new Error(GENERATION_COPY.errors.aiInvalidResponse);
  }
  if (cards.length < targetCount) {
    throw new Error(`AI 返回卡片数量不足：期望 ${targetCount} 张，实际 ${cards.length} 张。`);
  }
  return cards;
}

export async function testAiConnection(modelConfig: AiModelConfig): Promise<void> {
  const validationError = validateModelConfigForRequest(modelConfig);
  if (validationError) {
    throw new Error(validationError);
  }

  const probePrompt = "只回复 ok。";
  const content = await requestProviderContent(probePrompt, modelConfig);
  if (!content.trim()) {
    throw new Error(GENERATION_COPY.errors.aiInvalidResponse);
  }
}
