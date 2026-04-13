"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => NoteFlashcardsPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian5 = require("obsidian");

// src/settings.ts
var DEFAULT_SETTINGS = {
  generatorMode: "rule",
  maxCardsPerNote: 12,
  summaryLength: 220,
  aiProvider: "openai-compatible",
  aiApiUrl: "https://api.openai.com/v1/chat/completions",
  aiApiKey: "",
  aiModel: "",
  aiPrompt: "",
  ignoredFolders: [],
  newCardsPerDay: 10,
  showAllCardsInReview: false,
  learningStepsMinutes: [1, 10],
  graduatingIntervalDays: 1,
  easyIntervalDays: 4
};

// src/types.ts
var MISTAKE_AUTO_REMOVE_STREAK = 2;

// src/cardState.ts
function normalizeCard(card) {
  const createdAt = card.createdAt ?? (/* @__PURE__ */ new Date()).toISOString();
  return {
    ...card,
    createdAt,
    dueAt: card.dueAt ?? createdAt,
    intervalDays: card.intervalDays ?? 0,
    easeFactor: card.easeFactor ?? 2.5,
    repetition: card.repetition ?? 0,
    lapseCount: card.lapseCount ?? 0,
    reviewCount: card.reviewCount ?? 0,
    cardState: card.cardState ?? "new",
    learningStep: card.learningStep ?? 0,
    inMistakeBook: card.inMistakeBook ?? false,
    isMastered: card.isMastered ?? false,
    mistakeSuccessStreak: card.mistakeSuccessStreak ?? 0
  };
}
function clearMistakeBookState(card) {
  return {
    ...card,
    inMistakeBook: false,
    mistakeSuccessStreak: 0
  };
}
function setMistakeBookState(card, inMistakeBook) {
  return {
    ...card,
    inMistakeBook,
    isMastered: inMistakeBook ? false : card.isMastered,
    mistakeSuccessStreak: 0
  };
}
function setMasteredState(card, isMastered) {
  return {
    ...card,
    isMastered,
    inMistakeBook: isMastered ? false : card.inMistakeBook,
    mistakeSuccessStreak: isMastered ? 0 : card.mistakeSuccessStreak
  };
}
function isMasteredMistakeCard(card) {
  return card.inMistakeBook && card.mistakeSuccessStreak >= MISTAKE_AUTO_REMOVE_STREAK;
}

// src/cardStore.ts
var DEFAULT_DATA = {
  cards: []
};
function normalizePrefix(prefix) {
  return prefix.endsWith("/") ? prefix : `${prefix}/`;
}
function hasPrefixPath(path, prefix) {
  if (prefix.trim() === "") {
    return true;
  }
  return path.startsWith(normalizePrefix(prefix));
}
var CardStore = class {
  constructor(loadData, saveData) {
    this.loadData = loadData;
    this.saveData = saveData;
  }
  async getData() {
    const data = await this.loadData();
    if (!data || typeof data !== "object") {
      return { ...DEFAULT_DATA, settings: DEFAULT_SETTINGS };
    }
    const persisted = data;
    return {
      cards: Array.isArray(persisted.cards) ? persisted.cards.map((card) => normalizeCard(card)) : [],
      settings: {
        ...DEFAULT_SETTINGS,
        ...persisted.settings ?? {}
      }
    };
  }
  async getCards() {
    const data = await this.getData();
    return data.cards;
  }
  async saveCards(cards) {
    const data = await this.getData();
    await this.saveData({ ...data, cards });
  }
  async replaceCardsForSource(sourcePath, newCards) {
    const data = await this.getData();
    const retained = data.cards.filter((card) => card.sourcePath !== sourcePath);
    await this.saveData({ ...data, cards: [...retained, ...newCards] });
    return newCards.length;
  }
  async getCardsByPrefix(prefix) {
    const cards = await this.getCards();
    return cards.filter((card) => hasPrefixPath(card.sourcePath, prefix));
  }
  async setMistakeBook(cardId, inMistakeBook) {
    const data = await this.getData();
    let updatedCard = null;
    const updated = data.cards.map((card) => {
      if (card.id !== cardId) {
        return card;
      }
      updatedCard = setMistakeBookState(card, inMistakeBook);
      return updatedCard;
    });
    await this.saveData({ ...data, cards: updated });
    return updatedCard;
  }
  async setMastered(cardId, isMastered) {
    const data = await this.getData();
    let updatedCard = null;
    const updated = data.cards.map((card) => {
      if (card.id !== cardId) {
        return card;
      }
      updatedCard = setMasteredState(card, isMastered);
      return updatedCard;
    });
    await this.saveData({ ...data, cards: updated });
    return updatedCard;
  }
  async clearMasteredMistakeCards() {
    const data = await this.getData();
    let removedCount = 0;
    const updated = data.cards.map((card) => {
      if (!isMasteredMistakeCard(card)) {
        return card;
      }
      removedCount += 1;
      return clearMistakeBookState(card);
    });
    await this.saveData({ ...data, cards: updated });
    return removedCount;
  }
  async resetCards() {
    const data = await this.getData();
    await this.saveData({ ...data, cards: [] });
  }
};

// src/generationService.ts
var import_obsidian2 = require("obsidian");

// src/noteParser.ts
function createDraft(heading = "\u6587\u6863\u6982\u8981", anchorText) {
  return {
    heading,
    anchorText,
    content: [],
    listItems: []
  };
}
function parseMarkdownSections(markdown, sourcePath) {
  const lines = markdown.split(/\r?\n/);
  const sections = [];
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
    currentSection.anchorText ?? (currentSection.anchorText = line);
    if (/^[-*+]\s+/.test(line)) {
      currentSection.listItems.push(line.replace(/^[-*+]\s+/, "").trim());
    }
    currentSection.content.push(line);
  });
  pushSection();
  return sections;
}

// src/aiGenerator.ts
var import_obsidian = require("obsidian");

// src/cardFactory.ts
function hashText(input) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
function buildCardId(question, answer, section) {
  const startLine = section.sourceStartLine ?? 0;
  const endLine = section.sourceEndLine ?? 0;
  const fingerprint = hashText(`${section.heading}::${question}::${answer}`);
  return `${section.sourcePath}::${startLine}-${endLine}::${fingerprint}`;
}
function createNewFlashcard(question, answer, section, generatorType) {
  const createdAt = (/* @__PURE__ */ new Date()).toISOString();
  return {
    id: buildCardId(question, answer, section),
    question,
    answer,
    sourcePath: section.sourcePath,
    sourceHeading: section.heading,
    sourceAnchorText: section.sourceAnchorText,
    sourceStartLine: section.sourceStartLine,
    sourceEndLine: section.sourceEndLine,
    generatorType,
    createdAt,
    dueAt: createdAt,
    intervalDays: 0,
    easeFactor: 2.5,
    repetition: 0,
    lapseCount: 0,
    reviewCount: 0,
    cardState: "new",
    learningStep: 0,
    inMistakeBook: false,
    isMastered: false,
    mistakeSuccessStreak: 0
  };
}

// src/aiGenerator.ts
var DEFAULT_SYSTEM_PROMPT = [
  "\u4F60\u662F\u4E00\u4E2A\u4E25\u8C28\u7684\u5B66\u4E60\u5361\u7247\u751F\u6210\u52A9\u624B\u3002",
  "\u4F60\u53EA\u80FD\u57FA\u4E8E\u7528\u6237\u63D0\u4F9B\u7684\u7B14\u8BB0\u5185\u5BB9\u751F\u6210\u95EA\u5361\uFF0C\u4E0D\u8981\u8865\u5145\u5916\u90E8\u77E5\u8BC6\u3002",
  "\u8F93\u51FA\u5FC5\u987B\u662F\u4E25\u683C JSON\uFF0C\u4E0D\u80FD\u8F93\u51FA Markdown \u4EE3\u7801\u5757\u6216\u989D\u5916\u89E3\u91CA\u3002"
].join(" ");
function isConfigured(settings) {
  return settings.aiApiUrl.trim().length > 0 && settings.aiApiKey.trim().length > 0 && settings.aiModel.trim().length > 0;
}
function resolveProviderApiUrl(apiUrl, model) {
  return apiUrl.includes("{model}") ? apiUrl.replace("{model}", encodeURIComponent(model)) : apiUrl;
}
function clip(text, maxLength) {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength).trim()}\u2026`;
}
function extractOpenAiContent(response) {
  const payload = response;
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content.trim();
  }
  if (Array.isArray(content)) {
    return content.map((part) => typeof part?.text === "string" ? part.text : "").join("").trim();
  }
  return "";
}
function extractAnthropicContent(response) {
  const content = response.content;
  if (!Array.isArray(content)) {
    return "";
  }
  return content.filter((part) => part?.type === "text" && typeof part.text === "string").map((part) => part.text).join("").trim();
}
function extractGeminiContent(response) {
  const parts = response.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    return "";
  }
  return parts.map((part) => typeof part?.text === "string" ? part.text : "").join("").trim();
}
function extractProviderContent(response, settings) {
  if (settings.aiProvider === "anthropic") {
    return extractAnthropicContent(response);
  }
  if (settings.aiProvider === "gemini") {
    return extractGeminiContent(response);
  }
  return extractOpenAiContent(response);
}
function stripMarkdownCodeFence(content) {
  const fencedMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(content.trim());
  return fencedMatch ? fencedMatch[1].trim() : content.trim();
}
function extractJsonText(content) {
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
function parseAiResponse(content) {
  try {
    const parsed = JSON.parse(extractJsonText(content));
    if (Array.isArray(parsed)) {
      return { cards: parsed };
    }
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
    return null;
  } catch (_error) {
    return null;
  }
}
function buildUserPrompt(sections, settings) {
  const payload = sections.map((section, index) => ({
    sectionIndex: index,
    heading: section.heading,
    content: section.content,
    listItems: section.listItems
  }));
  const extraPrompt = settings.aiPrompt.trim();
  return [
    `\u8BF7\u6839\u636E\u4E0B\u9762\u7684\u7B14\u8BB0\u5206\u6BB5\u751F\u6210\u6700\u591A ${settings.maxCardsPerNote} \u5F20\u4E2D\u6587\u95EE\u7B54\u95EA\u5361\u3002`,
    `\u6BCF\u5F20\u5361\u7247\u7684 answer \u5C3D\u91CF\u63A7\u5236\u5728 ${settings.summaryLength} \u4E2A\u5B57\u7B26\u4EE5\u5185\u3002`,
    "\u4F18\u5148\u63D0\u70BC\u5B9A\u4E49\u3001\u539F\u7406\u3001\u6B65\u9AA4\u3001\u5BF9\u6BD4\u3001\u5173\u952E\u7ED3\u8BBA\u3002",
    "\u5982\u679C\u67D0\u4E9B\u5185\u5BB9\u4E0D\u9002\u5408\u51FA\u9898\uFF0C\u53EF\u4EE5\u5C11\u51FA\u9898\u3002",
    "\u6BCF\u5F20\u5361\u7247\u90FD\u5FC5\u987B\u5305\u542B sectionIndex\u3001question\u3001answer \u4E09\u4E2A\u5B57\u6BB5\u3002",
    "\u8BF7\u4E25\u683C\u8FD4\u56DE JSON\uFF0C\u683C\u5F0F\u5982\u4E0B\uFF1A",
    '{"cards":[{"sectionIndex":0,"question":"\u95EE\u9898","answer":"\u7B54\u6848"}]}',
    extraPrompt ? `\u989D\u5916\u8981\u6C42\uFF1A${extraPrompt}` : "",
    `sections=${JSON.stringify(payload)}`
  ].filter(Boolean).join("\n");
}
function normalizeCards(payload, sections, settings) {
  if (!payload || !Array.isArray(payload.cards)) {
    return [];
  }
  return payload.cards.slice(0, settings.maxCardsPerNote).flatMap((item) => {
    const card = item;
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
function buildProviderRequest(userPrompt, settings) {
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
                text: `${DEFAULT_SYSTEM_PROMPT}

${userPrompt}`
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
function extractErrorDetail(status, json) {
  const error = json.error;
  if (typeof error?.message === "string" && error.message.trim().length > 0) {
    return error.message;
  }
  const message = json.message;
  if (typeof message === "string" && message.trim().length > 0) {
    return message;
  }
  return `HTTP ${status}`;
}
async function requestProviderContent(userPrompt, settings) {
  const requestConfig = buildProviderRequest(userPrompt, settings);
  let response;
  try {
    response = await (0, import_obsidian.requestUrl)({
      url: requestConfig.url,
      method: "POST",
      contentType: "application/json",
      headers: requestConfig.headers,
      body: requestConfig.body,
      throw: false
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : void 0;
    throw new Error(GENERATION_COPY.errors.aiRequestFailed(detail));
  }
  if (response.status >= 400) {
    throw new Error(GENERATION_COPY.errors.aiRequestFailed(extractErrorDetail(response.status, response.json)));
  }
  return extractProviderContent(response.json, settings);
}
async function generateAiFlashcards(sections, settings) {
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
async function testAiConnection(settings) {
  if (!isConfigured(settings)) {
    throw new Error(GENERATION_COPY.errors.aiNotConfigured);
  }
  const probePrompt = "\u8BF7\u56DE\u590D\u4EFB\u610F\u7B80\u77ED\u6587\u672C\u3002";
  const content = await requestProviderContent(probePrompt, settings);
  if (!content.trim()) {
    throw new Error(GENERATION_COPY.errors.aiInvalidResponse);
  }
}

// src/ruleGenerator.ts
function clip2(text, maxLength) {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength).trim()}\u2026`;
}
function createCard(question, answer, section) {
  return createNewFlashcard(question, answer, section, "rule");
}
function generateRuleFlashcards(sections, summaryLength, maxCardsPerNote) {
  const cards = [];
  for (const section of sections) {
    if (cards.length >= maxCardsPerNote) {
      break;
    }
    if (section.heading && section.content) {
      cards.push(createCard(`\u201C${section.heading}\u201D\u8FD9\u4E00\u8282\u8BB2\u4E86\u4EC0\u4E48\uFF1F`, clip2(section.content, summaryLength), section));
    }
    if (cards.length >= maxCardsPerNote) {
      break;
    }
    if (section.listItems.length > 0) {
      cards.push(createCard(`\u201C${section.heading}\u201D\u7684\u8981\u70B9\u6709\u54EA\u4E9B\uFF1F`, clip2(section.listItems.join("\uFF1B"), summaryLength), section));
    }
    if (cards.length >= maxCardsPerNote) {
      break;
    }
    const definitionMatch = /([^。！？:\n]{2,30})[：:](.+)/.exec(section.content);
    if (definitionMatch) {
      cards.push(createCard(`\u4EC0\u4E48\u662F${definitionMatch[1].trim()}\uFF1F`, clip2(definitionMatch[2].trim(), summaryLength), section));
    }
  }
  return cards.slice(0, maxCardsPerNote);
}

// src/generationStrategy.ts
var GENERATION_COPY = {
  notices: {
    generatedFile: (basename, count) => `\u5DF2\u4E3A ${basename} \u751F\u6210 ${count} \u5F20\u95EA\u5361`,
    generatedFolder: (count) => `\u6279\u91CF\u751F\u6210\u5B8C\u6210\uFF0C\u5171\u751F\u6210 ${count} \u5F20\u95EA\u5361`
  },
  errors: {
    aiNotConfigured: "AI \u751F\u6210\u5C1A\u672A\u914D\u7F6E\uFF0C\u8BF7\u5148\u586B\u5199 AI \u63A5\u53E3\u5730\u5740\u3001API Key \u548C\u6A21\u578B\u540D\u3002",
    aiRequestFailed: (detail) => `AI \u63A5\u53E3\u8C03\u7528\u5931\u8D25${detail ? `\uFF1A${detail}` : ""}`,
    aiInvalidResponse: "AI \u8FD4\u56DE\u5185\u5BB9\u65E0\u6CD5\u89E3\u6790\u4E3A\u95EA\u5361\uFF0C\u8BF7\u786E\u8BA4\u6240\u9009 Provider \u914D\u7F6E\u6B63\u786E\u5E76\u8FD4\u56DE\u6709\u6548 JSON\u3002"
  }
};
async function generateCardsForSections(sections, settings) {
  if (settings.generatorMode === "ai") {
    return generateAiFlashcards(sections, settings);
  }
  if (settings.generatorMode === "hybrid") {
    try {
      return await generateAiFlashcards(sections, settings);
    } catch (_error) {
      return generateRuleFlashcards(sections, settings.summaryLength, settings.maxCardsPerNote);
    }
  }
  return generateRuleFlashcards(sections, settings.summaryLength, settings.maxCardsPerNote);
}

// src/studySession.ts
function shuffleCards(cards, random) {
  const shuffled = [...cards];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}
function sortSequentially(cards) {
  return [...cards].sort((a, b) => {
    const pathCompare = a.sourcePath.localeCompare(b.sourcePath);
    if (pathCompare !== 0) {
      return pathCompare;
    }
    const startLineA = a.sourceStartLine ?? Number.MAX_SAFE_INTEGER;
    const startLineB = b.sourceStartLine ?? Number.MAX_SAFE_INTEGER;
    if (startLineA !== startLineB) {
      return startLineA - startLineB;
    }
    const endLineA = a.sourceEndLine ?? Number.MAX_SAFE_INTEGER;
    const endLineB = b.sourceEndLine ?? Number.MAX_SAFE_INTEGER;
    if (endLineA !== endLineB) {
      return endLineA - endLineB;
    }
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}
function sortBySessionOrder(cards, sessionCardIds) {
  const order = new Map(sessionCardIds.map((id, index) => [id, index]));
  return [...cards].sort((a, b) => (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER));
}
function getStudySession(cards, options, random = Math.random, sessionCardIds) {
  let filteredCards = [...cards];
  if (options.includeMistakeBookOnly) {
    filteredCards = filteredCards.filter((card) => card.inMistakeBook);
  }
  if (options.excludeMastered) {
    filteredCards = filteredCards.filter((card) => !card.isMastered);
  }
  const totalCards = filteredCards.length;
  const orderedCards = sessionCardIds && sessionCardIds.length > 0 ? sortBySessionOrder(filteredCards.filter((card) => sessionCardIds.includes(card.id)), sessionCardIds) : options.orderMode === "sequential" ? sortSequentially(filteredCards) : shuffleCards(filteredCards, random);
  const selectedCards = sessionCardIds && sessionCardIds.length > 0 ? orderedCards : options.countMode === "random10" ? orderedCards.slice(0, 10) : orderedCards;
  return {
    cards: selectedCards,
    totalCards,
    selectedCount: selectedCards.length,
    sessionCardIds: sessionCardIds && sessionCardIds.length > 0 ? selectedCards.map((card) => card.id) : selectedCards.map((card) => card.id)
  };
}

// src/generationService.ts
function normalizeFolderPath(folderPath) {
  return folderPath.endsWith("/") ? folderPath : `${folderPath}/`;
}
function isInFolder(filePath, folderPath) {
  if (folderPath.trim() === "") {
    return true;
  }
  const normalizedFolderPath = normalizeFolderPath(folderPath);
  return filePath.startsWith(normalizedFolderPath);
}
function isIgnored(path, ignoredFolders) {
  return ignoredFolders.some((folder) => isInFolder(path, folder));
}
function isDueCard(card, now) {
  const dueTime = Date.parse(card.dueAt);
  if (Number.isNaN(dueTime)) {
    return true;
  }
  return dueTime <= now.getTime();
}
function toTimestamp(value) {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}
function buildDueQueue(cards, settings, now) {
  const dueCards = cards.filter((card) => isDueCard(card, now));
  if (dueCards.length === 0) {
    return settings.showAllCardsInReview ? cards : [];
  }
  const dueReviewCards = dueCards.filter((card) => card.cardState !== "new");
  const dueNewCards = dueCards.filter((card) => card.cardState === "new").sort((a, b) => toTimestamp(a.createdAt) - toTimestamp(b.createdAt));
  const newCardsPerDay = Math.max(0, settings.newCardsPerDay);
  const limitedDueNewCards = newCardsPerDay > 0 ? dueNewCards.slice(0, newCardsPerDay) : [];
  return [...dueReviewCards, ...limitedDueNewCards];
}
function applyStudyFilters(cards, options) {
  let filteredCards = [...cards];
  if (options.includeMistakeBookOnly) {
    filteredCards = filteredCards.filter((card) => card.inMistakeBook);
  }
  if (options.excludeMastered) {
    filteredCards = filteredCards.filter((card) => !card.isMastered);
  }
  return filteredCards;
}
var GenerationService = class {
  constructor(vault, store, settings) {
    this.vault = vault;
    this.store = store;
    this.settings = settings;
  }
  getFileByPath(path) {
    const file = this.vault.getAbstractFileByPath(path);
    return file instanceof import_obsidian2.TFile ? file : null;
  }
  async generateForFile(file) {
    const settings = this.settings();
    const content = await this.vault.cachedRead(file);
    const sections = parseMarkdownSections(content, file.path);
    const cards = await generateCardsForSections(sections, settings);
    const count = await this.store.replaceCardsForSource(file.path, cards);
    new import_obsidian2.Notice(GENERATION_COPY.notices.generatedFile(file.basename, count));
    return count;
  }
  async generateForFolder(folderPath) {
    const settings = this.settings();
    const files = this.vault.getMarkdownFiles().filter((file) => isInFolder(file.path, folderPath) && !isIgnored(file.path, settings.ignoredFolders));
    let total = 0;
    for (const file of files) {
      total += await this.generateForFile(file);
    }
    new import_obsidian2.Notice(GENERATION_COPY.notices.generatedFolder(total));
    return total;
  }
  async getCardsForSource(mode, path) {
    const allCards = await this.store.getCards();
    if (mode === "all" || !path) {
      return allCards;
    }
    if (mode === "current") {
      return allCards.filter((card) => card.sourcePath === path);
    }
    return allCards.filter((card) => isInFolder(card.sourcePath, path));
  }
  async getStudySession(options, sessionCardIds) {
    const cards = await this.getCardsForSource(options.scope, options.sourcePath);
    const filteredCards = applyStudyFilters(cards, options);
    const reviewQueue = buildDueQueue(filteredCards, this.settings(), /* @__PURE__ */ new Date());
    return getStudySession(reviewQueue, options, Math.random, sessionCardIds);
  }
};

// src/settingTab.ts
var import_obsidian3 = require("obsidian");

// src/settingsState.ts
var DEFAULT_AI_API_URLS = {
  "openai-compatible": "https://api.openai.com/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  "azure-openai": "https://{resource}.openai.azure.com/openai/deployments/{model}/chat/completions?api-version=2024-06-01",
  anthropic: "https://api.anthropic.com/v1/messages",
  gemini: "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
};
var SETTINGS_COPY = {
  generatorMode: {
    name: "\u751F\u6210\u6A21\u5F0F",
    description: "\u9009\u62E9\u89C4\u5219\u751F\u6210\u3001AI \u751F\u6210\u6216\u6DF7\u5408\u6A21\u5F0F",
    options: {
      rule: "\u89C4\u5219",
      ai: "AI",
      hybrid: "\u6DF7\u5408"
    }
  },
  maxCardsPerNote: {
    name: "\u6BCF\u7BC7\u7B14\u8BB0\u6700\u5927\u5361\u7247\u6570",
    description: "\u9650\u5236\u5355\u7BC7\u7B14\u8BB0\u751F\u6210\u7684\u95EA\u5361\u6570\u91CF",
    placeholder: "12"
  },
  aiProvider: {
    name: "AI Provider",
    description: "\u9009\u62E9\u8981\u8C03\u7528\u7684\u6A21\u578B\u5E73\u53F0",
    options: {
      "openai-compatible": "OpenAI \u517C\u5BB9",
      openrouter: "OpenRouter",
      "azure-openai": "Azure OpenAI",
      anthropic: "Anthropic",
      gemini: "Gemini"
    }
  },
  aiApiUrl: {
    name: "AI \u63A5\u53E3\u5730\u5740",
    description: "\u53EF\u81EA\u5B9A\u4E49\u5B8C\u6574\u63A5\u53E3\u5730\u5740\uFF1BGemini \u652F\u6301\u4F7F\u7528 {model} \u5360\u4F4D\u7B26",
    placeholder: "https://api.openai.com/v1/chat/completions"
  },
  aiApiKey: {
    name: "AI API Key",
    description: "\u7528\u4E8E\u8C03\u7528 AI \u6A21\u578B\uFF0C\u5F53\u524D\u4F1A\u968F\u63D2\u4EF6\u8BBE\u7F6E\u4FDD\u5B58\u5728\u672C\u5730",
    placeholder: "sk-..."
  },
  aiModel: {
    name: "AI \u6A21\u578B\u540D",
    description: "\u586B\u5199\u76EE\u6807\u6A21\u578B\u6807\u8BC6\uFF08Azure \u573A\u666F\u586B\u5199 deployment \u540D\u79F0\uFF09",
    placeholder: "gpt-4o-mini"
  },
  aiPrompt: {
    name: "AI \u9644\u52A0\u63D0\u793A\u8BCD",
    description: "\u53EF\u9009\uFF0C\u7528\u4E8E\u8865\u5145\u751F\u6210\u504F\u597D\uFF1B\u63D2\u4EF6\u4ECD\u4F1A\u5F3A\u5236\u8981\u6C42\u8FD4\u56DE JSON",
    placeholder: "\u4F8B\u5982\uFF1A\u66F4\u504F\u5411\u672F\u8BED\u5B9A\u4E49\u3001\u5BF9\u6BD4\u9898\u548C\u6B65\u9AA4\u9898"
  },
  aiConnectionTest: {
    name: "AI \u8FDE\u63A5\u6D4B\u8BD5",
    description: "\u4F7F\u7528\u5F53\u524D Provider\u3001\u63A5\u53E3\u5730\u5740\u3001API Key \u548C\u6A21\u578B\u540D\u8FDB\u884C\u4E00\u6B21\u8FDE\u901A\u6027\u9A8C\u8BC1",
    button: "\u6D4B\u8BD5\u8FDE\u63A5",
    success: "AI \u8FDE\u63A5\u6D4B\u8BD5\u6210\u529F",
    failed: (detail) => `AI \u8FDE\u63A5\u6D4B\u8BD5\u5931\u8D25${detail ? `\uFF1A${detail}` : ""}`
  },
  summaryLength: {
    name: "\u7B54\u6848\u6458\u8981\u957F\u5EA6",
    description: "\u63A7\u5236\u7B54\u6848\u6587\u672C\u7684\u6700\u5927\u957F\u5EA6",
    placeholder: "220"
  },
  newCardsPerDay: {
    name: "\u6BCF\u65E5\u65B0\u5361\u4E0A\u9650",
    description: "\u9650\u5236\u590D\u4E60\u9875\u5F53\u5929\u9996\u6B21\u5C55\u793A\u7684\u65B0\u5361\u6570\u91CF\uFF0C\u4E0D\u5F71\u54CD\u5B9E\u9645\u751F\u6210\u603B\u6570",
    placeholder: "10"
  },
  learningStepsMinutes: {
    name: "\u5B66\u4E60\u6B65\u8FDB\uFF08\u5206\u949F\uFF09",
    description: "\u4F7F\u7528\u9017\u53F7\u5206\u9694\uFF0C\u4F8B\u5982 1,10",
    placeholder: "1,10"
  },
  graduatingIntervalDays: {
    name: "\u6BD5\u4E1A\u95F4\u9694\uFF08\u5929\uFF09",
    description: "\u5B8C\u6210\u5B66\u4E60\u6B65\u8FDB\u540E\u7684\u9ED8\u8BA4\u590D\u4E60\u95F4\u9694",
    placeholder: "1"
  },
  easyIntervalDays: {
    name: "\u7B80\u5355\u95F4\u9694\uFF08\u5929\uFF09",
    description: "\u70B9\u51FB\u201C\u7B80\u5355\u201D\u540E\u76F4\u63A5\u8FDB\u5165\u590D\u4E60\u7684\u95F4\u9694",
    placeholder: "4"
  },
  showAllCardsInReview: {
    name: "\u65E0\u5230\u671F\u5361\u65F6\u663E\u793A\u5168\u90E8",
    description: "\u5F53\u4ECA\u5929\u6CA1\u6709\u5230\u671F\u5361\u65F6\uFF0C\u662F\u5426\u7EE7\u7EED\u6D4F\u89C8\u5168\u90E8\u5361\u7247"
  },
  ignoredFolders: {
    name: "\u5FFD\u7565\u6587\u4EF6\u5939",
    description: "\u4F7F\u7528\u9017\u53F7\u5206\u9694\u591A\u4E2A\u6587\u4EF6\u5939\u524D\u7F00",
    placeholder: "Templates/,Archive/"
  },
  resetCards: {
    name: "\u91CD\u7F6E\u6240\u6709\u5361\u7247\u6570\u636E",
    description: "\u6E05\u7A7A\u5F53\u524D\u63D2\u4EF6\u4FDD\u5B58\u7684\u5168\u90E8\u5361\u7247\u3001\u9519\u9898\u672C\u548C\u5DF2\u638C\u63E1\u72B6\u6001"
  },
  resetSettings: {
    name: "\u6062\u590D\u9ED8\u8BA4\u8BBE\u7F6E",
    description: "\u5C06\u5F53\u524D\u63D2\u4EF6\u8BBE\u7F6E\u6062\u590D\u4E3A\u9ED8\u8BA4\u503C"
  }
};
function parsePositiveInteger(value) {
  const parsed = Number(value);
  return !Number.isNaN(parsed) && parsed > 0 ? parsed : null;
}
function parseNonNegativeInteger(value) {
  const parsed = Number(value);
  return !Number.isNaN(parsed) && parsed >= 0 ? parsed : null;
}
function parsePositiveIntegerList(value) {
  return value.split(",").map((item) => Number(item.trim())).filter((item) => !Number.isNaN(item) && item > 0);
}
function parseStringList(value) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}
function getGeneratorModeOptions() {
  return [
    { value: "rule", label: SETTINGS_COPY.generatorMode.options.rule },
    { value: "ai", label: SETTINGS_COPY.generatorMode.options.ai },
    { value: "hybrid", label: SETTINGS_COPY.generatorMode.options.hybrid }
  ];
}
function getAiProviderOptions() {
  return [
    { value: "openai-compatible", label: SETTINGS_COPY.aiProvider.options["openai-compatible"] },
    { value: "openrouter", label: SETTINGS_COPY.aiProvider.options.openrouter },
    { value: "azure-openai", label: SETTINGS_COPY.aiProvider.options["azure-openai"] },
    { value: "anthropic", label: SETTINGS_COPY.aiProvider.options.anthropic },
    { value: "gemini", label: SETTINGS_COPY.aiProvider.options.gemini }
  ];
}
function getDefaultAiApiUrl(provider) {
  return DEFAULT_AI_API_URLS[provider];
}
async function updateSetting(settings, key, value, saveSettings) {
  settings[key] = value;
  await saveSettings();
}

// src/settingTab.ts
var NoteFlashcardsSettingTab = class extends import_obsidian3.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian3.Setting(containerEl).setName(SETTINGS_COPY.generatorMode.name).setDesc(SETTINGS_COPY.generatorMode.description).addDropdown((dropdown) => {
      for (const option of getGeneratorModeOptions()) {
        dropdown.addOption(option.value, option.label);
      }
      dropdown.setValue(this.plugin.settings.generatorMode).onChange(async (value) => {
        await updateSetting(this.plugin.settings, "generatorMode", value, async () => this.plugin.saveSettings());
      });
    });
    new import_obsidian3.Setting(containerEl).setName(SETTINGS_COPY.maxCardsPerNote.name).setDesc(SETTINGS_COPY.maxCardsPerNote.description).addText((text) => text.setPlaceholder(SETTINGS_COPY.maxCardsPerNote.placeholder).setValue(String(this.plugin.settings.maxCardsPerNote)).onChange(async (value) => {
      const parsed = parsePositiveInteger(value);
      if (parsed !== null) {
        await updateSetting(this.plugin.settings, "maxCardsPerNote", parsed, async () => this.plugin.saveSettings());
      }
    }));
    new import_obsidian3.Setting(containerEl).setName(SETTINGS_COPY.aiProvider.name).setDesc(SETTINGS_COPY.aiProvider.description).addDropdown((dropdown) => {
      for (const option of getAiProviderOptions()) {
        dropdown.addOption(option.value, option.label);
      }
      dropdown.setValue(this.plugin.settings.aiProvider).onChange(async (value) => {
        const nextProvider = value;
        const currentProvider = this.plugin.settings.aiProvider;
        const currentApiUrl = this.plugin.settings.aiApiUrl.trim();
        const currentDefaultApiUrl = getDefaultAiApiUrl(currentProvider);
        const shouldUpdateApiUrl = currentApiUrl.length === 0 || currentApiUrl === currentDefaultApiUrl;
        this.plugin.settings.aiProvider = nextProvider;
        if (shouldUpdateApiUrl) {
          this.plugin.settings.aiApiUrl = getDefaultAiApiUrl(nextProvider);
        }
        await this.plugin.saveSettings();
        this.display();
      });
    });
    new import_obsidian3.Setting(containerEl).setName(SETTINGS_COPY.aiApiUrl.name).setDesc(SETTINGS_COPY.aiApiUrl.description).addText((text) => text.setPlaceholder(getDefaultAiApiUrl(this.plugin.settings.aiProvider)).setValue(this.plugin.settings.aiApiUrl).onChange(async (value) => {
      await updateSetting(this.plugin.settings, "aiApiUrl", value.trim(), async () => this.plugin.saveSettings());
    }));
    new import_obsidian3.Setting(containerEl).setName(SETTINGS_COPY.aiApiKey.name).setDesc(SETTINGS_COPY.aiApiKey.description).addText((text) => text.setPlaceholder(SETTINGS_COPY.aiApiKey.placeholder).setValue(this.plugin.settings.aiApiKey).onChange(async (value) => {
      await updateSetting(this.plugin.settings, "aiApiKey", value.trim(), async () => this.plugin.saveSettings());
    }));
    new import_obsidian3.Setting(containerEl).setName(SETTINGS_COPY.aiModel.name).setDesc(SETTINGS_COPY.aiModel.description).addText((text) => text.setPlaceholder(SETTINGS_COPY.aiModel.placeholder).setValue(this.plugin.settings.aiModel).onChange(async (value) => {
      await updateSetting(this.plugin.settings, "aiModel", value.trim(), async () => this.plugin.saveSettings());
    }));
    new import_obsidian3.Setting(containerEl).setName(SETTINGS_COPY.aiPrompt.name).setDesc(SETTINGS_COPY.aiPrompt.description).addTextArea((text) => text.setPlaceholder(SETTINGS_COPY.aiPrompt.placeholder).setValue(this.plugin.settings.aiPrompt).onChange(async (value) => {
      await updateSetting(this.plugin.settings, "aiPrompt", value.trim(), async () => this.plugin.saveSettings());
    }));
    new import_obsidian3.Setting(containerEl).setName(SETTINGS_COPY.aiConnectionTest.name).setDesc(SETTINGS_COPY.aiConnectionTest.description).addButton((button) => button.setButtonText(SETTINGS_COPY.aiConnectionTest.button).onClick(async () => {
      try {
        await testAiConnection(this.plugin.settings);
        new import_obsidian3.Notice(SETTINGS_COPY.aiConnectionTest.success);
      } catch (error) {
        const detail = error instanceof Error ? error.message : void 0;
        new import_obsidian3.Notice(SETTINGS_COPY.aiConnectionTest.failed(detail));
      }
    }));
    new import_obsidian3.Setting(containerEl).setName(SETTINGS_COPY.summaryLength.name).setDesc(SETTINGS_COPY.summaryLength.description).addText((text) => text.setPlaceholder(SETTINGS_COPY.summaryLength.placeholder).setValue(String(this.plugin.settings.summaryLength)).onChange(async (value) => {
      const parsed = parsePositiveInteger(value);
      if (parsed !== null) {
        await updateSetting(this.plugin.settings, "summaryLength", parsed, async () => this.plugin.saveSettings());
      }
    }));
    new import_obsidian3.Setting(containerEl).setName(SETTINGS_COPY.newCardsPerDay.name).setDesc(SETTINGS_COPY.newCardsPerDay.description).addText((text) => text.setPlaceholder(SETTINGS_COPY.newCardsPerDay.placeholder).setValue(String(this.plugin.settings.newCardsPerDay)).onChange(async (value) => {
      const parsed = parseNonNegativeInteger(value);
      if (parsed !== null) {
        await updateSetting(this.plugin.settings, "newCardsPerDay", parsed, async () => this.plugin.saveSettings());
      }
    }));
    new import_obsidian3.Setting(containerEl).setName(SETTINGS_COPY.learningStepsMinutes.name).setDesc(SETTINGS_COPY.learningStepsMinutes.description).addText((text) => text.setPlaceholder(SETTINGS_COPY.learningStepsMinutes.placeholder).setValue(this.plugin.settings.learningStepsMinutes.join(",")).onChange(async (value) => {
      const steps = parsePositiveIntegerList(value);
      if (steps.length > 0) {
        await updateSetting(this.plugin.settings, "learningStepsMinutes", steps, async () => this.plugin.saveSettings());
      }
    }));
    new import_obsidian3.Setting(containerEl).setName(SETTINGS_COPY.graduatingIntervalDays.name).setDesc(SETTINGS_COPY.graduatingIntervalDays.description).addText((text) => text.setPlaceholder(SETTINGS_COPY.graduatingIntervalDays.placeholder).setValue(String(this.plugin.settings.graduatingIntervalDays)).onChange(async (value) => {
      const parsed = parsePositiveInteger(value);
      if (parsed !== null) {
        await updateSetting(this.plugin.settings, "graduatingIntervalDays", parsed, async () => this.plugin.saveSettings());
      }
    }));
    new import_obsidian3.Setting(containerEl).setName(SETTINGS_COPY.easyIntervalDays.name).setDesc(SETTINGS_COPY.easyIntervalDays.description).addText((text) => text.setPlaceholder(SETTINGS_COPY.easyIntervalDays.placeholder).setValue(String(this.plugin.settings.easyIntervalDays)).onChange(async (value) => {
      const parsed = parsePositiveInteger(value);
      if (parsed !== null) {
        await updateSetting(this.plugin.settings, "easyIntervalDays", parsed, async () => this.plugin.saveSettings());
      }
    }));
    new import_obsidian3.Setting(containerEl).setName(SETTINGS_COPY.showAllCardsInReview.name).setDesc(SETTINGS_COPY.showAllCardsInReview.description).addToggle((toggle) => toggle.setValue(this.plugin.settings.showAllCardsInReview).onChange(async (value) => {
      await updateSetting(this.plugin.settings, "showAllCardsInReview", value, async () => this.plugin.saveSettings());
    }));
    new import_obsidian3.Setting(containerEl).setName(SETTINGS_COPY.ignoredFolders.name).setDesc(SETTINGS_COPY.ignoredFolders.description).addTextArea((text) => text.setPlaceholder(SETTINGS_COPY.ignoredFolders.placeholder).setValue(this.plugin.settings.ignoredFolders.join(",")).onChange(async (value) => {
      await updateSetting(this.plugin.settings, "ignoredFolders", parseStringList(value), async () => this.plugin.saveSettings());
    }));
    new import_obsidian3.Setting(containerEl).setName(SETTINGS_COPY.resetCards.name).setDesc(SETTINGS_COPY.resetCards.description).addButton((button) => button.setButtonText(SETTINGS_COPY.resetCards.name).setWarning().onClick(async () => {
      await this.plugin.resetAllCards();
    }));
    new import_obsidian3.Setting(containerEl).setName(SETTINGS_COPY.resetSettings.name).setDesc(SETTINGS_COPY.resetSettings.description).addButton((button) => button.setButtonText(SETTINGS_COPY.resetSettings.name).onClick(async () => {
      await this.plugin.resetSettingsToDefault();
      this.display();
    }));
  }
};

// src/reviewView.ts
var import_obsidian4 = require("obsidian");

// src/reviewCopy.ts
var REVIEW_COPY = {
  displayName: "Note Flashcards",
  filters: {
    source: "\u6765\u6E90",
    all: "\u5168\u90E8",
    current: "\u5F53\u524D\u7B14\u8BB0",
    folder: "\u5F53\u524D\u6587\u4EF6\u5939",
    mistakes: "\u9519\u9898\u672C"
  },
  buttons: {
    refreshQueue: "\u5237\u65B0\u961F\u5217",
    clearMasteredMistakes: "\u6E05\u7A7A\u5DF2\u638C\u63E1\u9519\u9898",
    clearMasteredMistakesWithCount: (count) => `\u6E05\u7A7A\u5DF2\u638C\u63E1\u9519\u9898\uFF08${count}\uFF09`,
    generateCurrentNote: "\u751F\u6210\u5F53\u524D\u7B14\u8BB0",
    generateCurrentFolder: "\u751F\u6210\u5F53\u524D\u6587\u4EF6\u5939",
    showAllNewCards: "\u67E5\u770B\u5168\u90E8\u65B0\u5361",
    switchToMistakes: "\u5207\u5230\u9519\u9898\u672C",
    flipToAnswer: "\u67E5\u770B\u7B54\u6848",
    flipToQuestion: "\u56DE\u5230\u95EE\u9898",
    openSource: "\u6253\u5F00\u539F\u6587",
    addToMistakes: "\u52A0\u5165\u9519\u9898\u672C",
    removeFromMistakes: "\u79FB\u51FA\u9519\u9898\u672C",
    markMastered: "\u6807\u8BB0\u5DF2\u638C\u63E1",
    unmarkMastered: "\u53D6\u6D88\u5DF2\u638C\u63E1",
    previous: "\u4E0A\u4E00\u5F20",
    next: "\u4E0B\u4E00\u5F20"
  },
  notices: {
    noCurrentNote: "\u5F53\u524D\u6CA1\u6709\u53EF\u7528\u7684\u7B14\u8BB0",
    cannotReadCurrentNote: "\u65E0\u6CD5\u8BFB\u53D6\u5F53\u524D\u7B14\u8BB0",
    noCurrentFolder: "\u5F53\u524D\u6CA1\u6709\u53EF\u7528\u7684\u7236\u6587\u4EF6\u5939",
    sourceNotFound: "\u627E\u4E0D\u5230\u539F\u6587\u7B14\u8BB0",
    removedFromMistakes: "\u5DF2\u79FB\u51FA\u9519\u9898\u672C",
    addedToMistakes: "\u5DF2\u52A0\u5165\u9519\u9898\u672C",
    noMasteredMistakesToClear: "\u5F53\u524D\u6CA1\u6709\u5DF2\u638C\u63E1\u7684\u9519\u9898\u53EF\u6E05\u7406",
    clearedMasteredMistakes: (count) => `\u5DF2\u6E05\u7406 ${count} \u5F20\u5DF2\u638C\u63E1\u9519\u9898`,
    refreshed: "\u95EA\u5361\u5217\u8868\u5DF2\u5237\u65B0"
  },
  cardFace: {
    question: "\u95EE\u9898",
    answer: "\u7B54\u6848"
  },
  stats: {
    queue: "\u5F53\u524D\u961F\u5217",
    sourceTotal: "\u5F53\u524D\u6765\u6E90\u603B\u5361",
    mistakeTotal: "\u9519\u9898\u672C\u603B\u6570",
    priorityMistakes: "\u4F18\u5148\u9519\u9898",
    masteredPendingClear: "\u5DF2\u638C\u63E1\u5F85\u6E05\u7406",
    cardCount: (count) => `${count} \u5F20`
  },
  meta: {
    shortcutHint: "\u7A7A\u683C\u7FFB\u9762 \xB7 \u2190 \u2192 \u5207\u6362",
    dueCount: "\u5F85\u590D\u4E60",
    queueCount: "\u5F53\u524D\u961F\u5217",
    sourceCount: "\u5F53\u524D\u6765\u6E90",
    mistakeCount: "\u9519\u9898\u672C",
    inMistakeBook: "\u9519\u9898\u672C\u4E2D",
    position: "\u7B2C",
    summary: (dueCount, totalCount, totalCards, mistakeBookCount) => `${REVIEW_COPY.meta.dueCount} ${dueCount} \u5F20 \xB7 ${REVIEW_COPY.meta.queueCount} ${totalCount} \u5F20 \xB7 ${REVIEW_COPY.meta.sourceCount} ${totalCards} \u5F20 \xB7 ${REVIEW_COPY.meta.mistakeCount} ${mistakeBookCount} \u5F20`,
    limitedNewCards: (totalNewCards, newCardLimit) => `\u5F53\u524D\u6765\u6E90\u5171\u6709 ${totalNewCards} \u5F20\u65B0\u5361\uFF0C\u6309\u6BCF\u65E5\u65B0\u5361\u4E0A\u9650\u4EC5\u5C55\u793A\u524D ${newCardLimit} \u5F20\u3002`,
    positionLabel: (index, total) => `${REVIEW_COPY.meta.position} ${index} \u5F20 / \u5171 ${total} \u5F20`
  },
  emptyState: {
    mistakesTitle: "\u9519\u9898\u672C\u76EE\u524D\u662F\u7A7A\u7684\u3002",
    mistakesDescription: "\u4F60\u53EF\u4EE5\u5728\u5361\u7247\u64CD\u4F5C\u4E2D\u624B\u52A8\u52A0\u5165\u9519\u9898\u672C\u3002",
    limitedTitle: "\u5F53\u524D\u4F18\u5148\u961F\u5217\u5DF2\u5B8C\u6210\uFF0C\u8FD8\u53EF\u4EE5\u7EE7\u7EED\u67E5\u770B\u5269\u4F59\u65B0\u5361\u3002",
    noCardsTitle: "\u5F53\u524D\u6CA1\u6709\u53EF\u590D\u4E60\u7684\u5361\u7247\u3002",
    noCardsDescription: "\u4F60\u53EF\u4EE5\u5148\u751F\u6210\u5F53\u524D\u7B14\u8BB0\u6216\u5F53\u524D\u6587\u4EF6\u5939\u7684\u95EA\u5361\u3002"
  },
  study: {
    scopeLabel: "\u8303\u56F4",
    countModeLabel: "\u6570\u91CF",
    orderModeLabel: "\u987A\u5E8F",
    onlyMistakesLabel: "\u53EA\u505A\u9519\u9898\u672C",
    excludeMasteredLabel: "\u6392\u9664\u5DF2\u638C\u63E1",
    scope: {
      current: "\u5F53\u524D\u7B14\u8BB0",
      folder: "\u5F53\u524D\u6587\u4EF6\u5939",
      all: "\u5168\u90E8"
    },
    countMode: {
      random10: "\u968F\u673A 10 \u9898",
      all: "\u5168\u90E8"
    },
    orderMode: {
      random: "\u968F\u673A",
      sequential: "\u987A\u5E8F"
    },
    badges: {
      mastered: "\u5DF2\u638C\u63E1",
      mistake: "\u9519\u9898\u672C",
      learning: "\u5B66\u4E60\u4E2D"
    },
    stats: {
      mistakes: "\u9519\u9898\u672C",
      mastered: "\u5DF2\u638C\u63E1",
      learning: "\u5B66\u4E60\u4E2D"
    },
    emptyState: {
      title: "\u5F53\u524D\u6761\u4EF6\u4E0B\u6CA1\u6709\u53EF\u5B66\u4E60\u7684\u5361\u7247\u3002",
      description: "\u4F60\u53EF\u4EE5\u8C03\u6574\u7B5B\u9009\u6761\u4EF6\uFF0C\u6216\u5148\u751F\u6210\u5F53\u524D\u7B14\u8BB0/\u6587\u4EF6\u5939\u7684\u5361\u7247\u3002"
    },
    selectionSummary: (scope, countMode, orderMode, mistakesOnly, excludeMastered) => {
      const filters = [mistakesOnly ? "\u53EA\u505A\u9519\u9898\u672C" : "", excludeMastered ? "\u6392\u9664\u5DF2\u638C\u63E1" : ""].filter(Boolean).join(" \xB7 ");
      return [scope, countMode, orderMode, filters].filter(Boolean).join(" \xB7 ");
    }
  }
};

// src/reviewActions.ts
async function generateForCurrentNoteAction(getCurrentPath, getFileByPath, generateForFile, reloadCards, notify) {
  const currentPath = getCurrentPath();
  if (!currentPath) {
    notify(REVIEW_COPY.notices.noCurrentNote);
    return;
  }
  const file = getFileByPath(currentPath);
  if (!file) {
    notify(REVIEW_COPY.notices.cannotReadCurrentNote);
    return;
  }
  await generateForFile(file);
  await reloadCards();
}
async function generateForCurrentFolderAction(getCurrentFolderPath, generateForFolder, reloadCards, notify) {
  const folderPath = getCurrentFolderPath();
  if (!folderPath) {
    notify(REVIEW_COPY.notices.noCurrentFolder);
    return;
  }
  await generateForFolder(folderPath);
  await reloadCards();
}
async function openSourceNoteAction(card, getFileByPath, openFile, notify) {
  const file = getFileByPath(card.sourcePath);
  if (!file) {
    notify(REVIEW_COPY.notices.sourceNotFound);
    return;
  }
  await openFile(file, card);
}
async function toggleMistakeBookAction(card, setMistakeBook, reloadCards, notify, preferredIndex = 0) {
  await setMistakeBook(card.id, !card.inMistakeBook);
  notify(card.inMistakeBook ? REVIEW_COPY.notices.removedFromMistakes : REVIEW_COPY.notices.addedToMistakes);
  await reloadCards(card.id, preferredIndex);
}
async function toggleMasteredAction(card, setMastered, reloadCards, preferredIndex = 0) {
  await setMastered(card.id, !card.isMastered);
  await reloadCards(card.id, preferredIndex);
}
async function clearMasteredMistakeCardsAction(clearMasteredMistakeCards, reloadCards, notify) {
  const removedCount = await clearMasteredMistakeCards();
  if (removedCount === 0) {
    notify(REVIEW_COPY.notices.noMasteredMistakesToClear);
    return;
  }
  notify(REVIEW_COPY.notices.clearedMasteredMistakes(removedCount));
  await reloadCards();
}

// src/reviewState.ts
function resolveReviewIndex(cards, currentIndex, preferredCardId, preferredIndex = 0) {
  if (cards.length === 0) {
    return 0;
  }
  if (preferredCardId) {
    const matchedIndex = cards.findIndex((card) => card.id === preferredCardId);
    return matchedIndex >= 0 ? matchedIndex : Math.min(preferredIndex, cards.length - 1);
  }
  return Math.min(currentIndex, cards.length - 1);
}
function getWrappedReviewIndex(currentIndex, cardsLength, delta) {
  if (cardsLength === 0) {
    return 0;
  }
  return (currentIndex + delta + cardsLength) % cardsLength;
}

// src/studyViewModel.ts
function getScopeLabel(scope) {
  if (scope === "current") {
    return REVIEW_COPY.study.scope.current;
  }
  if (scope === "folder") {
    return REVIEW_COPY.study.scope.folder;
  }
  return REVIEW_COPY.study.scope.all;
}
function getCountModeLabel(countMode) {
  return countMode === "random10" ? REVIEW_COPY.study.countMode.random10 : REVIEW_COPY.study.countMode.all;
}
function getOrderModeLabel(orderMode) {
  return orderMode === "random" ? REVIEW_COPY.study.orderMode.random : REVIEW_COPY.study.orderMode.sequential;
}
function getCardMeta(card, index, total) {
  return [
    `${index + 1} / ${total}`,
    card.isMastered ? REVIEW_COPY.study.badges.mastered : REVIEW_COPY.study.badges.learning,
    card.inMistakeBook ? REVIEW_COPY.study.badges.mistake : "",
    card.sourcePath,
    card.sourceHeading ?? ""
  ].filter(Boolean).join(" \xB7 ");
}
function getStats(cards) {
  const mistakeCount = cards.filter((card) => card.inMistakeBook).length;
  const masteredCount = cards.filter((card) => card.isMastered).length;
  const learningCount = cards.filter((card) => !card.inMistakeBook && !card.isMastered).length;
  return [
    { label: REVIEW_COPY.study.stats.mistakes, value: String(mistakeCount), className: "note-flashcards-stat-mistake" },
    { label: REVIEW_COPY.study.stats.mastered, value: String(masteredCount), className: "note-flashcards-stat-mastered" },
    { label: REVIEW_COPY.study.stats.learning, value: String(learningCount), className: "note-flashcards-stat-learning" }
  ];
}
function getStudyDisplayState(input) {
  const currentCard = input.cards[input.index];
  return {
    toolbar: {
      scopeOptions: [
        { label: REVIEW_COPY.study.scope.current, value: "current" },
        { label: REVIEW_COPY.study.scope.folder, value: "folder" },
        { label: REVIEW_COPY.study.scope.all, value: "all" }
      ],
      countModeOptions: [
        { label: REVIEW_COPY.study.countMode.random10, value: "random10" },
        { label: REVIEW_COPY.study.countMode.all, value: "all" }
      ],
      orderModeOptions: [
        { label: REVIEW_COPY.study.orderMode.random, value: "random" },
        { label: REVIEW_COPY.study.orderMode.sequential, value: "sequential" }
      ]
    },
    selectionSummary: REVIEW_COPY.study.selectionSummary(
      getScopeLabel(input.scope),
      getCountModeLabel(input.countMode),
      getOrderModeLabel(input.orderMode),
      input.includeMistakeBookOnly,
      input.excludeMastered
    ),
    stats: getStats(input.cards),
    currentCard: currentCard ? {
      title: `${input.flipped ? REVIEW_COPY.cardFace.answer : REVIEW_COPY.cardFace.question} ${input.index + 1}`,
      content: input.flipped ? currentCard.answer : currentCard.question,
      meta: getCardMeta(currentCard, input.index, input.cards.length),
      flipButtonLabel: input.flipped ? REVIEW_COPY.buttons.flipToQuestion : REVIEW_COPY.buttons.flipToAnswer,
      mistakeToggleLabel: currentCard.inMistakeBook ? REVIEW_COPY.buttons.removeFromMistakes : REVIEW_COPY.buttons.addToMistakes,
      masteredToggleLabel: currentCard.isMastered ? REVIEW_COPY.buttons.unmarkMastered : REVIEW_COPY.buttons.markMastered,
      mistakeToggleClass: currentCard.inMistakeBook ? "note-flashcards-mistake-active" : "note-flashcards-mistake-button",
      masteredToggleClass: currentCard.isMastered ? "note-flashcards-mastered-active" : "note-flashcards-mastered-button"
    } : void 0,
    emptyState: {
      title: REVIEW_COPY.study.emptyState.title,
      description: REVIEW_COPY.study.emptyState.description,
      showGenerateCurrentNote: true,
      showGenerateCurrentFolder: true
    },
    navigationLabel: currentCard ? REVIEW_COPY.meta.positionLabel(input.index + 1, input.cards.length) : void 0
  };
}

// src/reviewView.ts
var REVIEW_VIEW_TYPE = "note-flashcards-review";
var ReviewView = class _ReviewView extends import_obsidian4.ItemView {
  constructor(leaf, generationService, cardStore, getCurrentPath, getCurrentFolderPath) {
    super(leaf);
    this.generationService = generationService;
    this.cardStore = cardStore;
    this.getCurrentPath = getCurrentPath;
    this.getCurrentFolderPath = getCurrentFolderPath;
    this.cards = [];
    this.index = 0;
    this.flipped = false;
    this.studyScope = "current";
    this.countMode = "random10";
    this.orderMode = "random";
    this.includeMistakeBookOnly = false;
    this.excludeMastered = false;
    this.totalCards = 0;
    this.selectedCount = 0;
    this.sessionCardIds = [];
    this.lastSessionKey = "";
    this.handleKeydown = (event) => {
      if (!this.isViewActive() || this.shouldIgnoreKeyboardEvent(event)) {
        return;
      }
      if (event.key === " ") {
        event.preventDefault();
        this.toggleCardFace();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        this.showPrevious();
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        this.showNext();
      }
    };
  }
  getViewType() {
    return REVIEW_VIEW_TYPE;
  }
  getDisplayText() {
    return REVIEW_COPY.displayName;
  }
  async onOpen() {
    window.addEventListener("keydown", this.handleKeydown);
    await this.reloadCards();
  }
  async onClose() {
    window.removeEventListener("keydown", this.handleKeydown);
  }
  getStudySourcePath() {
    if (this.studyScope === "current") {
      return this.getCurrentPath();
    }
    if (this.studyScope === "folder") {
      return this.getCurrentFolderPath();
    }
    return void 0;
  }
  applySession(session) {
    this.cards = session.cards;
    this.totalCards = session.totalCards;
    this.selectedCount = session.selectedCount;
    this.sessionCardIds = session.sessionCardIds;
  }
  getSessionKey(sourcePath) {
    return JSON.stringify({
      scope: this.studyScope,
      sourcePath,
      countMode: this.countMode,
      orderMode: this.orderMode,
      includeMistakeBookOnly: this.includeMistakeBookOnly,
      excludeMastered: this.excludeMastered
    });
  }
  async reloadCards(preferredCardId, preferredIndex = 0) {
    const sourcePath = this.getStudySourcePath();
    const sessionKey = this.getSessionKey(sourcePath);
    const shouldReuseSession = this.sessionCardIds.length > 0 && this.countMode === "random10" && sessionKey === this.lastSessionKey;
    const session = await this.generationService.getStudySession({
      scope: this.studyScope,
      sourcePath,
      countMode: this.countMode,
      orderMode: this.orderMode,
      includeMistakeBookOnly: this.includeMistakeBookOnly,
      excludeMastered: this.excludeMastered
    }, shouldReuseSession ? this.sessionCardIds : void 0);
    this.lastSessionKey = sessionKey;
    this.applySession(session);
    this.index = resolveReviewIndex(this.cards, this.index, preferredCardId, preferredIndex);
    this.flipped = false;
    this.render();
  }
  isViewActive() {
    return this.app.workspace.getActiveViewOfType(_ReviewView) === this;
  }
  shouldIgnoreKeyboardEvent(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return false;
    }
    return ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName) || target.isContentEditable;
  }
  toggleCardFace() {
    if (this.cards.length === 0) {
      return;
    }
    this.flipped = !this.flipped;
    this.render();
  }
  showPrevious() {
    if (this.cards.length === 0) {
      return;
    }
    this.index = getWrappedReviewIndex(this.index, this.cards.length, -1);
    this.flipped = false;
    this.render();
  }
  showNext() {
    if (this.cards.length === 0) {
      return;
    }
    this.index = getWrappedReviewIndex(this.index, this.cards.length, 1);
    this.flipped = false;
    this.render();
  }
  async generateForCurrentNote() {
    await generateForCurrentNoteAction(
      this.getCurrentPath,
      (path) => this.generationService.getFileByPath(path),
      (file) => this.generationService.generateForFile(file),
      () => this.reloadCards(),
      (message) => new import_obsidian4.Notice(message)
    );
  }
  async generateForCurrentFolder() {
    await generateForCurrentFolderAction(
      this.getCurrentFolderPath,
      (folderPath) => this.generationService.generateForFolder(folderPath),
      () => this.reloadCards(),
      (message) => new import_obsidian4.Notice(message)
    );
  }
  async openFileAtSource(file, card) {
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.openFile(file);
    const view = leaf.view;
    if (card.sourceAnchorText) {
      view?.setEphemeralState?.({ subpath: `# ${card.sourceAnchorText}` });
      return;
    }
    if (typeof card.sourceStartLine === "number") {
      const line = Math.max(card.sourceStartLine - 1, 0);
      view?.editor?.setCursor?.({ line, ch: 0 });
      view?.editor?.scrollIntoView?.({ from: { line, ch: 0 }, to: { line, ch: 0 } }, true);
    }
  }
  async openSourceNote(card) {
    await openSourceNoteAction(
      card,
      (path) => this.generationService.getFileByPath(path),
      async (file, sourceCard) => await this.openFileAtSource(file, sourceCard),
      (message) => new import_obsidian4.Notice(message)
    );
  }
  async toggleMistakeBook(card) {
    await toggleMistakeBookAction(
      card,
      (cardId, inMistakeBook) => this.cardStore.setMistakeBook(cardId, inMistakeBook),
      (preferredCardId, preferredIndex) => this.reloadCards(preferredCardId, preferredIndex),
      (message) => new import_obsidian4.Notice(message),
      this.index
    );
  }
  async toggleMastered(card) {
    await toggleMasteredAction(
      card,
      (cardId, isMastered) => this.cardStore.setMastered(cardId, isMastered),
      (preferredCardId, preferredIndex) => this.reloadCards(preferredCardId, preferredIndex),
      this.index
    );
  }
  async clearMasteredMistakeCards() {
    await clearMasteredMistakeCardsAction(
      () => this.cardStore.clearMasteredMistakeCards(),
      () => this.reloadCards(),
      (message) => new import_obsidian4.Notice(message)
    );
  }
  getDisplayState() {
    return getStudyDisplayState({
      cards: this.cards,
      index: this.index,
      flipped: this.flipped,
      scope: this.studyScope,
      countMode: this.countMode,
      orderMode: this.orderMode,
      includeMistakeBookOnly: this.includeMistakeBookOnly,
      excludeMastered: this.excludeMastered
    });
  }
  renderEmptyState(contentEl, emptyStateView) {
    const emptyState = contentEl.createDiv({ cls: "note-flashcards-empty-state" });
    emptyState.createEl("p", { text: emptyStateView.title });
    if (emptyStateView.description) {
      emptyState.createEl("p", { text: emptyStateView.description });
    }
    const actions = emptyState.createDiv({ cls: "note-flashcards-empty-actions" });
    if (emptyStateView.showGenerateCurrentNote) {
      new import_obsidian4.ButtonComponent(actions).setButtonText(REVIEW_COPY.buttons.generateCurrentNote).onClick(async () => await this.generateForCurrentNote()).buttonEl.addClass("mod-cta");
    }
    if (emptyStateView.showGenerateCurrentFolder) {
      new import_obsidian4.ButtonComponent(actions).setButtonText(REVIEW_COPY.buttons.generateCurrentFolder).onClick(async () => await this.generateForCurrentFolder());
    }
  }
  renderToolbar(contentEl, display) {
    const toolbar = contentEl.createDiv({ cls: "note-flashcards-toolbar" });
    const filterGroup = toolbar.createDiv({ cls: "note-flashcards-toolbar-group" });
    const generateGroup = toolbar.createDiv({ cls: "note-flashcards-toolbar-group" });
    const utilityGroup = toolbar.createDiv({ cls: "note-flashcards-toolbar-group" });
    new import_obsidian4.Setting(filterGroup).setName(REVIEW_COPY.study.scopeLabel).addDropdown((dropdown) => {
      display.toolbar.scopeOptions.forEach((option) => dropdown.addOption(option.value, option.label));
      dropdown.setValue(this.studyScope).onChange(async (value) => {
        this.studyScope = value;
        await this.reloadCards();
      });
    });
    new import_obsidian4.Setting(filterGroup).setName(REVIEW_COPY.study.countModeLabel).addDropdown((dropdown) => {
      display.toolbar.countModeOptions.forEach((option) => dropdown.addOption(option.value, option.label));
      dropdown.setValue(this.countMode).onChange(async (value) => {
        this.countMode = value;
        await this.reloadCards();
      });
    });
    new import_obsidian4.Setting(filterGroup).setName(REVIEW_COPY.study.orderModeLabel).addDropdown((dropdown) => {
      display.toolbar.orderModeOptions.forEach((option) => dropdown.addOption(option.value, option.label));
      dropdown.setValue(this.orderMode).onChange(async (value) => {
        this.orderMode = value;
        await this.reloadCards();
      });
    });
    new import_obsidian4.Setting(filterGroup).setName(REVIEW_COPY.study.onlyMistakesLabel).addToggle((toggle) => toggle.setValue(this.includeMistakeBookOnly).onChange(async (value) => {
      this.includeMistakeBookOnly = value;
      await this.reloadCards();
    }));
    new import_obsidian4.Setting(filterGroup).setName(REVIEW_COPY.study.excludeMasteredLabel).addToggle((toggle) => toggle.setValue(this.excludeMastered).onChange(async (value) => {
      this.excludeMastered = value;
      await this.reloadCards();
    }));
    new import_obsidian4.ButtonComponent(utilityGroup).setButtonText(REVIEW_COPY.buttons.refreshQueue).onClick(async () => {
      await this.reloadCards();
      new import_obsidian4.Notice(REVIEW_COPY.notices.refreshed);
    });
    new import_obsidian4.ButtonComponent(utilityGroup).setButtonText(REVIEW_COPY.buttons.clearMasteredMistakes).onClick(async () => await this.clearMasteredMistakeCards());
    new import_obsidian4.ButtonComponent(generateGroup).setButtonText(REVIEW_COPY.buttons.generateCurrentNote).onClick(async () => await this.generateForCurrentNote()).buttonEl.addClass("mod-cta", "note-flashcards-toolbar-primary");
    new import_obsidian4.ButtonComponent(generateGroup).setButtonText(REVIEW_COPY.buttons.generateCurrentFolder).onClick(async () => await this.generateForCurrentFolder()).buttonEl.addClass("note-flashcards-toolbar-primary");
  }
  renderMeta(contentEl, display) {
    contentEl.createDiv({ cls: "note-flashcards-meta", text: display.selectionSummary });
    const statsEl = contentEl.createDiv({ cls: "note-flashcards-stats" });
    display.stats.forEach((stat) => {
      const statEl = statsEl.createDiv({ cls: ["note-flashcards-stat", stat.className].filter(Boolean).join(" ") });
      statEl.createDiv({ cls: "note-flashcards-stat-label", text: stat.label });
      statEl.createDiv({ cls: "note-flashcards-stat-value", text: stat.value });
    });
    contentEl.createDiv({ cls: "note-flashcards-meta", text: `${this.selectedCount} / ${this.totalCards}` });
  }
  renderCard(contentEl, cardView) {
    const cardEl = contentEl.createDiv({ cls: "note-flashcards-card" });
    cardEl.onClickEvent(() => this.toggleCardFace());
    cardEl.createDiv({ cls: "note-flashcards-card-title", text: cardView.title });
    cardEl.createDiv({ cls: "note-flashcards-card-content", text: cardView.content });
    contentEl.createDiv({ cls: "note-flashcards-meta", text: cardView.meta });
  }
  renderActions(contentEl, card, cardView) {
    const actions = contentEl.createDiv({ cls: "note-flashcards-actions" });
    new import_obsidian4.ButtonComponent(actions).setButtonText(cardView.flipButtonLabel).onClick(() => this.toggleCardFace()).buttonEl.addClass("mod-cta");
    new import_obsidian4.ButtonComponent(actions).setButtonText(REVIEW_COPY.buttons.openSource).onClick(async () => await this.openSourceNote(card));
    new import_obsidian4.ButtonComponent(actions).setButtonText(cardView.mistakeToggleLabel).onClick(async () => await this.toggleMistakeBook(card)).buttonEl.addClass(cardView.mistakeToggleClass);
    new import_obsidian4.ButtonComponent(actions).setButtonText(cardView.masteredToggleLabel).onClick(async () => await this.toggleMastered(card)).buttonEl.addClass(cardView.masteredToggleClass);
  }
  renderNavigation(contentEl, display) {
    if (!display.navigationLabel) {
      return;
    }
    const nav = contentEl.createDiv({ cls: "note-flashcards-nav" });
    nav.createDiv({ cls: "note-flashcards-nav-label", text: display.navigationLabel });
    new import_obsidian4.ButtonComponent(nav).setButtonText(REVIEW_COPY.buttons.previous).onClick(() => this.showPrevious());
    new import_obsidian4.ButtonComponent(nav).setButtonText(REVIEW_COPY.buttons.next).onClick(() => this.showNext());
  }
  render() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("note-flashcards-view");
    const display = this.getDisplayState();
    this.renderToolbar(contentEl, display);
    this.renderMeta(contentEl, display);
    if (this.cards.length === 0 || !display.currentCard) {
      this.renderEmptyState(contentEl, display.emptyState);
      return;
    }
    const card = this.cards[this.index];
    this.renderCard(contentEl, display.currentCard);
    this.renderActions(contentEl, card, display.currentCard);
    this.renderNavigation(contentEl, display);
  }
};

// src/pluginCopy.ts
var PLUGIN_COPY = {
  notices: {
    noCurrentFolder: "\u5F53\u524D\u6CA1\u6709\u53EF\u7528\u7684\u7236\u6587\u4EF6\u5939",
    noCurrentNote: "\u5F53\u524D\u6CA1\u6709\u53EF\u7528\u7684\u7B14\u8BB0",
    cannotOpenReviewView: "\u65E0\u6CD5\u6253\u5F00\u95EA\u5361\u89C6\u56FE",
    resetCardsDone: "\u5DF2\u91CD\u7F6E\u6240\u6709\u5361\u7247\u6570\u636E",
    resetSettingsDone: "\u5DF2\u6062\u590D\u9ED8\u8BA4\u8BBE\u7F6E"
  },
  menu: {
    generateCurrentNote: "\u751F\u6210\u5F53\u524D\u7B14\u8BB0\u95EA\u5361",
    generateCurrentFolder: "\u751F\u6210\u5F53\u524D\u6587\u4EF6\u5939\u95EA\u5361"
  },
  commands: {
    generateCurrentNote: "\u4ECE\u5F53\u524D\u7B14\u8BB0\u751F\u6210\u95EA\u5361",
    generateCurrentFolder: "\u4ECE\u5F53\u524D\u6587\u4EF6\u5939\u751F\u6210\u95EA\u5361",
    openReview: "\u6253\u5F00\u95EA\u5361\u590D\u4E60\u89C6\u56FE"
  },
  ribbon: {
    openReview: "\u6253\u5F00\u95EA\u5361\u590D\u4E60\u89C6\u56FE"
  }
};

// src/pluginActions.ts
async function runGenerateCurrentNote(file, generateFileAndOpenReview) {
  if (!file) {
    return false;
  }
  await generateFileAndOpenReview(file);
  return true;
}
async function runGenerateCurrentFolder(folder, generateFolderAndOpenReview) {
  if (!folder) {
    return false;
  }
  await generateFolderAndOpenReview(folder.path);
  return true;
}
async function activateReviewLeaf(existingLeaf, getRightLeaf, revealLeaf, notify, reviewViewType) {
  const leaf = existingLeaf ?? getRightLeaf(false);
  if (!leaf) {
    notify(PLUGIN_COPY.notices.cannotOpenReviewView);
    return false;
  }
  await leaf.setViewState({ type: reviewViewType, active: true });
  revealLeaf(leaf);
  return true;
}

// src/pluginSettingsState.ts
function loadPersistedSettings(data) {
  return {
    ...DEFAULT_SETTINGS,
    ...(data && typeof data === "object" ? data.settings : void 0) ?? {}
  };
}
function buildSavedPluginData(data, settings) {
  const existing = data && typeof data === "object" ? data : {};
  return {
    ...existing,
    settings,
    cards: Array.isArray(existing.cards) ? existing.cards : []
  };
}

// main.ts
var NoteFlashcardsPlugin = class extends import_obsidian5.Plugin {
  constructor(app, manifest) {
    super(app, manifest);
    this.settings = DEFAULT_SETTINGS;
  }
  async onload() {
    await this.loadSettings();
    this.store = new CardStore(() => this.loadData(), (data) => this.saveData(data));
    this.generationService = new GenerationService(this.app.vault, this.store, () => this.settings);
    this.registerView(
      REVIEW_VIEW_TYPE,
      (leaf) => new ReviewView(
        leaf,
        this.generationService,
        this.store,
        () => this.getCurrentFilePath(),
        () => this.getCurrentFolderPath()
      )
    );
    this.addSettingTab(new NoteFlashcardsSettingTab(this.app, this));
    this.addRibbonIcon("lucide-layers", PLUGIN_COPY.ribbon.openReview, async () => {
      await this.activateReviewView();
    });
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file, _source, _leaf) => {
      if (!(file instanceof import_obsidian5.TFile)) {
        return;
      }
      menu.addItem((item) => item.setTitle(PLUGIN_COPY.menu.generateCurrentNote).setIcon("sparkles").onClick(async () => {
        await this.generateFileAndOpenReview(file);
      }));
      menu.addItem((item) => item.setTitle(PLUGIN_COPY.menu.generateCurrentFolder).setIcon("folder-open").onClick(async () => {
        const folder = this.requireCurrentFolder(file.parent);
        if (!folder) {
          return;
        }
        await this.generateFolderAndOpenReview(folder.path);
      }));
    }));
    this.registerEvent(this.app.workspace.on("editor-menu", (menu, _editor, info) => {
      const file = info.file;
      if (!file) {
        return;
      }
      menu.addItem((item) => item.setTitle(PLUGIN_COPY.menu.generateCurrentNote).setIcon("sparkles").onClick(async () => {
        await this.generateFileAndOpenReview(file);
      }));
    }));
    this.addCommand({
      id: "generate-flashcards-current-note",
      name: PLUGIN_COPY.commands.generateCurrentNote,
      checkCallback: (checking) => {
        const file = this.requireCurrentFile();
        if (!file) {
          return false;
        }
        if (!checking) {
          void this.generateCurrentNote();
        }
        return true;
      }
    });
    this.addCommand({
      id: "generate-flashcards-current-folder",
      name: PLUGIN_COPY.commands.generateCurrentFolder,
      checkCallback: (checking) => {
        const folder = this.requireCurrentFolder();
        if (!folder) {
          return false;
        }
        if (!checking) {
          void this.generateCurrentFolder();
        }
        return true;
      }
    });
    this.addCommand({
      id: "open-flashcards-review",
      name: PLUGIN_COPY.commands.openReview,
      callback: async () => {
        await this.activateReviewView();
      }
    });
  }
  onunload() {
    this.app.workspace.detachLeavesOfType(REVIEW_VIEW_TYPE);
  }
  async loadSettings() {
    const loaded = await this.loadData();
    this.settings = loadPersistedSettings(loaded);
  }
  async saveSettings() {
    const existing = await this.loadData();
    await this.saveData(buildSavedPluginData(existing, this.settings));
  }
  async resetAllCards() {
    await this.store.resetCards();
    new import_obsidian5.Notice(PLUGIN_COPY.notices.resetCardsDone);
  }
  async resetSettingsToDefault() {
    this.settings = { ...DEFAULT_SETTINGS };
    await this.saveSettings();
    new import_obsidian5.Notice(PLUGIN_COPY.notices.resetSettingsDone);
  }
  async generateFileAndOpenReview(file) {
    await this.generationService.generateForFile(file);
    await this.activateReviewView();
  }
  async generateFolderAndOpenReview(folderPath) {
    await this.generationService.generateForFolder(folderPath);
    await this.activateReviewView();
  }
  async generateCurrentNote() {
    await runGenerateCurrentNote(this.requireCurrentFile(), (file) => this.generateFileAndOpenReview(file));
  }
  async generateCurrentFolder() {
    await runGenerateCurrentFolder(this.requireCurrentFolder(), (folderPath) => this.generateFolderAndOpenReview(folderPath));
  }
  requireCurrentFile(file = this.app.workspace.getActiveFile()) {
    if (!file) {
      new import_obsidian5.Notice(PLUGIN_COPY.notices.noCurrentNote);
      return null;
    }
    return file;
  }
  requireCurrentFolder(folder = this.app.workspace.getActiveFile()?.parent) {
    if (!folder) {
      new import_obsidian5.Notice(PLUGIN_COPY.notices.noCurrentFolder);
      return null;
    }
    return folder;
  }
  getCurrentFilePath() {
    return this.app.workspace.getActiveFile()?.path;
  }
  getCurrentFolderPath() {
    return this.getCurrentFolder()?.path;
  }
  getCurrentFolder() {
    return this.requireCurrentFolder();
  }
  async activateReviewView() {
    await activateReviewLeaf(
      this.app.workspace.getLeavesOfType(REVIEW_VIEW_TYPE)[0],
      (split) => this.app.workspace.getRightLeaf(split),
      (leaf) => this.app.workspace.revealLeaf(leaf),
      (message) => new import_obsidian5.Notice(message),
      REVIEW_VIEW_TYPE
    );
  }
};
