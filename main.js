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
  mistakeTopicCardEntryEnabled: true,
  aiModelConfigs: [],
  activeAiModelId: "",
  aiSectionCollapsed: true,
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
  const generatedFromFlow = card.generatedFromFlow === "mistake-topic" ? card.generatedFromFlow : void 0;
  const generatedFromCardId = typeof card.generatedFromCardId === "string" && card.generatedFromCardId.trim().length > 0 ? card.generatedFromCardId : void 0;
  const generatedTopic = typeof card.generatedTopic === "string" && card.generatedTopic.trim().length > 0 ? card.generatedTopic : void 0;
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
    mistakeSuccessStreak: card.mistakeSuccessStreak ?? 0,
    generatedFromFlow,
    generatedFromCardId,
    generatedTopic
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
function normalizeDedupText(input) {
  return input.toLowerCase().replace(/\s+/g, " ").trim();
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
  async appendCardsWithDedupe(newCards) {
    if (newCards.length === 0) {
      return { addedCount: 0, skippedCount: 0 };
    }
    const data = await this.getData();
    const questionSignatures = new Set(data.cards.map((card) => normalizeDedupText(card.question)));
    const qaSignatures = new Set(data.cards.map((card) => `${normalizeDedupText(card.question)}::${normalizeDedupText(card.answer)}`));
    const appendableCards = [];
    let skippedCount = 0;
    for (const card of newCards) {
      const questionSignature = normalizeDedupText(card.question);
      const qaSignature = `${questionSignature}::${normalizeDedupText(card.answer)}`;
      if (questionSignatures.has(questionSignature) || qaSignatures.has(qaSignature)) {
        skippedCount += 1;
        continue;
      }
      questionSignatures.add(questionSignature);
      qaSignatures.add(qaSignature);
      appendableCards.push(card);
    }
    if (appendableCards.length > 0) {
      await this.saveData({ ...data, cards: [...data.cards, ...appendableCards] });
    }
    return {
      addedCount: appendableCards.length,
      skippedCount
    };
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

// src/aiGenerator.ts
var import_obsidian = require("obsidian");

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
  mistakeTopicCardEntry: {
    name: "\u9519\u9898\u4E3B\u9898\u5B9A\u5411\u751F\u6210\u5165\u53E3",
    description: "\u5728\u590D\u4E60\u9519\u9898\u65F6\u663E\u793A\u201C\u6309\u9519\u9898\u4E3B\u9898\u751F\u6210\u5B66\u4E60\u5361\u7247\u201D\u533A\u5757"
  },
  maxCardsPerNote: {
    name: "\u6BCF\u7BC7\u7B14\u8BB0\u6700\u5927\u5361\u7247\u6570",
    description: "\u9650\u5236\u5355\u7BC7\u7B14\u8BB0\u751F\u6210\u7684\u95EA\u5361\u6570\u91CF",
    placeholder: "12"
  },
  aiModelsSection: {
    name: "AI \u6A21\u578B\u914D\u7F6E",
    description: "\u7EF4\u62A4\u591A\u4E2A\u6A21\u578B\u914D\u7F6E\u5E76\u9009\u62E9\u5F53\u524D\u751F\u6548\u6A21\u578B\uFF0C\u751F\u6210\u65F6\u5C06\u76F4\u63A5\u4F7F\u7528\u5F53\u524D\u751F\u6548\u6A21\u578B\u3002",
    addButton: "\u65B0\u589E\u6A21\u578B\u914D\u7F6E"
  },
  activeAiModel: {
    name: "\u5F53\u524D\u751F\u6548\u6A21\u578B",
    description: "\u751F\u6210\u95EA\u5361\u65F6\u4F1A\u76F4\u63A5\u4F7F\u7528\u8BE5\u6A21\u578B\uFF0C\u4E0D\u4F1A\u4E8C\u6B21\u8BE2\u95EE",
    placeholder: "\u8BF7\u9009\u62E9\u6A21\u578B\u914D\u7F6E",
    none: "\u672A\u9009\u62E9"
  },
  aiModelName: {
    name: "\u914D\u7F6E\u540D\u79F0",
    placeholder: "\u4F8B\u5982\uFF1AOpenAI-\u4E3B\u914D\u7F6E"
  },
  aiProvider: {
    name: "Provider",
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
    description: "\u53EF\u81EA\u5B9A\u4E49\u5B8C\u6574\u63A5\u53E3\u5730\u5740\uFF1BGemini/Azure \u652F\u6301 {model} \u5360\u4F4D\u7B26\uFF0CAzure \u9700\u5C06 {resource} \u66FF\u6362\u4E3A\u771F\u5B9E\u8D44\u6E90\u540D",
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
    description: "\u53EF\u76F4\u63A5\u5728\u6A21\u578B\u5217\u8868\u6216\u7F16\u8F91\u533A\u9A8C\u8BC1\u6307\u5B9A\u6A21\u578B\u914D\u7F6E\u7684\u8FDE\u901A\u6027",
    button: "\u6D4B\u8BD5\u8FDE\u63A5",
    loading: "\u6D4B\u8BD5\u4E2D...",
    success: "AI \u8FDE\u63A5\u6D4B\u8BD5\u6210\u529F",
    failed: (detail) => `AI \u8FDE\u63A5\u6D4B\u8BD5\u5931\u8D25${detail ? `\uFF1A${detail}` : ""}`
  },
  aiModelActions: {
    edit: "\u7F16\u8F91",
    copy: "\u590D\u5236",
    setDefault: "\u8BBE\u4E3A\u9ED8\u8BA4",
    moveUp: "\u4E0A\u79FB",
    moveDown: "\u4E0B\u79FB",
    remove: "\u5220\u9664",
    save: "\u4FDD\u5B58\u6A21\u578B\u914D\u7F6E",
    cancel: "\u53D6\u6D88\u7F16\u8F91",
    defaultTag: "\u5F53\u524D\u751F\u6548"
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

// src/aiModelState.ts
var SUPPORTED_PROVIDERS = /* @__PURE__ */ new Set(["openai-compatible", "openrouter", "azure-openai", "anthropic", "gemini"]);
var REQUIRED_FIELD_LABELS = {
  name: "\u914D\u7F6E\u540D\u79F0",
  provider: "Provider",
  apiUrl: "API URL",
  apiKey: "API Key",
  model: "\u6A21\u578B\u540D"
};
var ALLOWED_MODEL_PLACEHOLDER = "{model}";
var URL_PLACEHOLDER_PATTERN = /\{[^}]+\}/g;
var AI_MODEL_ERRORS = {
  noConfigs: "\u672A\u914D\u7F6E\u4EFB\u4F55 AI \u6A21\u578B\uFF0C\u8BF7\u5148\u65B0\u589E\u6A21\u578B\u914D\u7F6E\u3002",
  noActiveModel: "\u672A\u9009\u62E9\u5F53\u524D\u751F\u6548\u6A21\u578B\uFF0C\u8BF7\u5148\u5728\u8BBE\u7F6E\u9875\u9009\u62E9\u3002",
  activeModelNotFound: "\u5F53\u524D\u751F\u6548\u6A21\u578B\u4E0D\u5B58\u5728\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9\u3002",
  unsupportedProvider: "Provider \u4E0D\u652F\u6301\uFF0C\u8BF7\u68C0\u67E5\u6A21\u578B\u914D\u7F6E\u3002",
  missingFields: (fields) => `\u6A21\u578B\u914D\u7F6E\u7F3A\u5C11\u5FC5\u586B\u9879\uFF1A${fields.join("\u3001")}`,
  invalidApiUrl: "API URL \u683C\u5F0F\u65E0\u6548\uFF0C\u8BF7\u586B\u5199\u5B8C\u6574\u7684 http(s) \u5730\u5740\u3002",
  invalidApiProtocol: "API URL \u4EC5\u652F\u6301 http(s) \u534F\u8BAE\u3002",
  unresolvedUrlPlaceholders: (tokens) => `API URL \u5B58\u5728\u672A\u66FF\u6362\u5360\u4F4D\u7B26\uFF1A${tokens.join("\u3001")}\uFF0C\u8BF7\u586B\u5199\u771F\u5B9E\u5730\u5740\u3002`
};
function getAllowedUrlPlaceholders(provider) {
  if (provider === "azure-openai" || provider === "gemini") {
    return /* @__PURE__ */ new Set([ALLOWED_MODEL_PLACEHOLDER]);
  }
  return /* @__PURE__ */ new Set();
}
function getUnresolvedUrlPlaceholders(apiUrl, provider) {
  const matched = apiUrl.match(URL_PLACEHOLDER_PATTERN);
  if (!matched) {
    return [];
  }
  const allowed = getAllowedUrlPlaceholders(provider);
  const unresolved = matched.filter((token) => !allowed.has(token));
  return Array.from(new Set(unresolved));
}
function createAiModelId() {
  return `model-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function createAiModelConfig(provider = "openai-compatible") {
  return {
    id: createAiModelId(),
    name: "",
    provider,
    apiUrl: getDefaultAiApiUrl(provider),
    apiKey: "",
    model: "",
    prompt: ""
  };
}
function isSupportedProvider(value) {
  return typeof value === "string" && SUPPORTED_PROVIDERS.has(value);
}
function sanitizeAiModelConfig(data) {
  if (!data || typeof data !== "object") {
    return null;
  }
  const candidate = data;
  if (!isSupportedProvider(candidate.provider)) {
    return null;
  }
  return {
    id: typeof candidate.id === "string" && candidate.id.trim().length > 0 ? candidate.id : createAiModelId(),
    name: typeof candidate.name === "string" ? candidate.name.trim() : "",
    provider: candidate.provider,
    apiUrl: typeof candidate.apiUrl === "string" ? candidate.apiUrl.trim() : "",
    apiKey: typeof candidate.apiKey === "string" ? candidate.apiKey.trim() : "",
    model: typeof candidate.model === "string" ? candidate.model.trim() : "",
    prompt: typeof candidate.prompt === "string" ? candidate.prompt.trim() : ""
  };
}
function sanitizeAiModelConfigs(data) {
  if (!Array.isArray(data)) {
    return [];
  }
  return data.flatMap((item) => {
    const config = sanitizeAiModelConfig(item);
    return config ? [config] : [];
  });
}
function getMissingRequiredFields(config) {
  const fields = [];
  if (!config.name.trim()) {
    fields.push(REQUIRED_FIELD_LABELS.name);
  }
  if (!config.provider || !isSupportedProvider(config.provider)) {
    fields.push(REQUIRED_FIELD_LABELS.provider);
  }
  if (!config.apiUrl.trim()) {
    fields.push(REQUIRED_FIELD_LABELS.apiUrl);
  }
  if (!config.apiKey.trim()) {
    fields.push(REQUIRED_FIELD_LABELS.apiKey);
  }
  if (!config.model.trim()) {
    fields.push(REQUIRED_FIELD_LABELS.model);
  }
  return fields;
}
function validateModelConfigForSave(config) {
  const missing = getMissingRequiredFields(config);
  return missing.length > 0 ? AI_MODEL_ERRORS.missingFields(missing) : null;
}
function validateModelConfigForRequest(config) {
  const missing = getMissingRequiredFields({ ...config, name: config.name || "tmp" });
  const requestFields = missing.filter((field) => field !== REQUIRED_FIELD_LABELS.name);
  if (requestFields.length > 0) {
    return AI_MODEL_ERRORS.missingFields(requestFields);
  }
  if (!isSupportedProvider(config.provider)) {
    return AI_MODEL_ERRORS.unsupportedProvider;
  }
  let parsedUrl;
  try {
    parsedUrl = new URL(config.apiUrl.trim());
  } catch {
    return AI_MODEL_ERRORS.invalidApiUrl;
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return AI_MODEL_ERRORS.invalidApiProtocol;
  }
  const unresolvedPlaceholders = getUnresolvedUrlPlaceholders(config.apiUrl.trim(), config.provider);
  if (unresolvedPlaceholders.length > 0) {
    return AI_MODEL_ERRORS.unresolvedUrlPlaceholders(unresolvedPlaceholders);
  }
  return null;
}
function getActiveAiModel(settings) {
  if (settings.aiModelConfigs.length === 0 || !settings.activeAiModelId.trim()) {
    return null;
  }
  return settings.aiModelConfigs.find((config) => config.id === settings.activeAiModelId) ?? null;
}
function getActiveAiModelOrThrow(settings) {
  if (settings.aiModelConfigs.length === 0) {
    throw new Error(AI_MODEL_ERRORS.noConfigs);
  }
  if (!settings.activeAiModelId.trim()) {
    throw new Error(AI_MODEL_ERRORS.noActiveModel);
  }
  const active = getActiveAiModel(settings);
  if (!active) {
    throw new Error(AI_MODEL_ERRORS.activeModelNotFound);
  }
  const validationError = validateModelConfigForRequest(active);
  if (validationError) {
    throw new Error(validationError);
  }
  return active;
}
function buildCopyName(baseName, existingNames) {
  const normalizedBase = baseName.trim() || "\u672A\u547D\u540D\u914D\u7F6E";
  const firstCandidate = `${normalizedBase}-\u526F\u672C`;
  if (!existingNames.includes(firstCandidate)) {
    return firstCandidate;
  }
  let suffix = 2;
  while (existingNames.includes(`${normalizedBase}-\u526F\u672C${suffix}`)) {
    suffix += 1;
  }
  return `${normalizedBase}-\u526F\u672C${suffix}`;
}
function duplicateModelConfig(config, existingNames) {
  return {
    ...config,
    id: createAiModelId(),
    name: buildCopyName(config.name, existingNames)
  };
}
function moveModelConfig(configs, from, to) {
  if (from < 0 || from >= configs.length || to < 0 || to >= configs.length || from === to) {
    return configs;
  }
  const next = [...configs];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

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

// src/ruleGenerator.ts
function clip(text, maxLength) {
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
      cards.push(createCard(`\u201C${section.heading}\u201D\u8FD9\u4E00\u8282\u8BB2\u4E86\u4EC0\u4E48\uFF1F`, clip(section.content, summaryLength), section));
    }
    if (cards.length >= maxCardsPerNote) {
      break;
    }
    if (section.listItems.length > 0) {
      cards.push(createCard(`\u201C${section.heading}\u201D\u7684\u8981\u70B9\u6709\u54EA\u4E9B\uFF1F`, clip(section.listItems.join("\uFF1B"), summaryLength), section));
    }
    if (cards.length >= maxCardsPerNote) {
      break;
    }
    const definitionMatch = /([^。！？:\n]{2,30})[：:](.+)/.exec(section.content);
    if (definitionMatch) {
      cards.push(createCard(`\u4EC0\u4E48\u662F${definitionMatch[1].trim()}\uFF1F`, clip(definitionMatch[2].trim(), summaryLength), section));
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
    aiRequestFailed: (detail) => `AI \u63A5\u53E3\u8C03\u7528\u5931\u8D25${detail ? `\uFF1A${detail}` : ""}`,
    aiInvalidResponse: "AI \u8FD4\u56DE\u5185\u5BB9\u65E0\u6CD5\u89E3\u6790\u4E3A\u95EA\u5361\uFF0C\u8BF7\u786E\u8BA4\u6240\u9009 Provider \u914D\u7F6E\u6B63\u786E\u5E76\u8FD4\u56DE\u6709\u6548 JSON\u3002"
  }
};
async function generateCardsForSections(sections, settings) {
  if (settings.generatorMode === "ai") {
    return generateAiFlashcards(sections, settings);
  }
  if (settings.generatorMode === "hybrid") {
    return generateAiFlashcards(sections, settings);
  }
  return generateRuleFlashcards(sections, settings.summaryLength, settings.maxCardsPerNote);
}

// src/aiGenerator.ts
var DEFAULT_SYSTEM_PROMPT = [
  "\u4F60\u662F\u4E00\u4E2A\u4E25\u8C28\u7684\u5B66\u4E60\u5361\u7247\u751F\u6210\u52A9\u624B\u3002",
  "\u4F60\u53EA\u80FD\u57FA\u4E8E\u7528\u6237\u63D0\u4F9B\u7684\u7B14\u8BB0\u5185\u5BB9\u751F\u6210\u95EA\u5361\uFF0C\u4E0D\u8981\u8865\u5145\u5916\u90E8\u77E5\u8BC6\u3002",
  "\u8F93\u51FA\u5FC5\u987B\u662F\u4E25\u683C JSON\uFF0C\u4E0D\u80FD\u8F93\u51FA Markdown \u4EE3\u7801\u5757\u6216\u989D\u5916\u89E3\u91CA\u3002"
].join(" ");
function resolveProviderApiUrl(apiUrl, model) {
  return apiUrl.includes("{model}") ? apiUrl.replace("{model}", encodeURIComponent(model)) : apiUrl;
}
function isResponsesEndpoint(apiUrl) {
  try {
    return /\/responses\/?$/.test(new URL(apiUrl).pathname);
  } catch {
    return false;
  }
}
function clip2(text, maxLength) {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength).trim()}\u2026`;
}
function collectResponsesText(value) {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectResponsesText(item));
  }
  if (!value || typeof value !== "object") {
    return [];
  }
  const payload = value;
  return [
    ...collectResponsesText(payload.output_text),
    ...collectResponsesText(payload.text),
    ...collectResponsesText(payload.content),
    ...collectResponsesText(payload.output),
    ...collectResponsesText(payload.delta),
    ...collectResponsesText(payload.message)
  ];
}
function extractOpenAiResponsesContent(response) {
  const payload = response;
  return [
    ...collectResponsesText(payload.output_text),
    ...collectResponsesText(payload.output)
  ].join("").trim();
}
function extractOpenAiContent(response) {
  const responsesContent = extractOpenAiResponsesContent(response);
  if (responsesContent) {
    return responsesContent;
  }
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
function extractOpenAiStreamContent(payload) {
  const chatDelta = payload.choices?.[0]?.delta?.content;
  if (typeof chatDelta === "string") {
    return chatDelta.trim();
  }
  if (Array.isArray(chatDelta)) {
    return chatDelta.map((part) => typeof part?.text === "string" ? part.text : "").join("").trim();
  }
  const directDelta = payload.delta;
  if (typeof directDelta === "string") {
    return directDelta.trim();
  }
  return "";
}
function extractStreamEventError(payload) {
  const directError = payload.error;
  if (typeof directError === "string" && directError.trim().length > 0) {
    return directError.trim();
  }
  const nestedMessage = directError?.message;
  if (typeof nestedMessage === "string" && nestedMessage.trim().length > 0) {
    return nestedMessage.trim();
  }
  const message = payload.message;
  if (typeof message === "string" && message.trim().length > 0) {
    return message.trim();
  }
  return "";
}
function readSseDataFrames(buffer) {
  const chunks = buffer.split(/\r?\n\r?\n/);
  const rest = chunks.pop() ?? "";
  return { frames: chunks, rest };
}
function parseStreamFrame(frame) {
  const dataLines = frame.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart());
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
    return { isDone: false, payload };
  } catch {
    return { isDone: false, payload: null };
  }
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
function extractProviderContent(response, provider) {
  if (provider === "anthropic") {
    return extractAnthropicContent(response);
  }
  if (provider === "gemini") {
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
  } catch {
    return null;
  }
}
function parseAiTopicResponse(content) {
  const cleaned = stripMarkdownCodeFence(content).trim();
  if (!cleaned) {
    return "";
  }
  try {
    const parsed = JSON.parse(extractJsonText(cleaned));
    if (typeof parsed.topic === "string") {
      return parsed.topic.trim();
    }
  } catch {
  }
  return cleaned.split("\n").map((line) => line.trim()).find((line) => line.length > 0) ?? "";
}
function buildUserPrompt(sections, settings, modelConfig) {
  const payload = sections.map((section, index) => ({
    sectionIndex: index,
    heading: section.heading,
    content: section.content,
    listItems: section.listItems
  }));
  const extraPrompt = modelConfig.prompt.trim();
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
    const answer = typeof card.answer === "string" ? clip2(card.answer.trim(), settings.summaryLength) : "";
    const section = sections[sectionIndex];
    if (!section || !question || !answer) {
      return [];
    }
    return [createNewFlashcard(question, answer, section, "ai")];
  });
}
function normalizeMistakeTopicCards(payload, section, maxCards, summaryLength) {
  if (!payload || !Array.isArray(payload.cards)) {
    return [];
  }
  return payload.cards.slice(0, maxCards).flatMap((item) => {
    const card = item;
    const question = typeof card.question === "string" ? card.question.trim() : "";
    const answer = typeof card.answer === "string" ? clip2(card.answer.trim(), summaryLength) : "";
    if (!question || !answer) {
      return [];
    }
    return [createNewFlashcard(question, answer, section, "ai")];
  });
}
function buildProviderRequest(userPrompt, config) {
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
    const useResponsesApi2 = isResponsesEndpoint(apiUrl);
    return {
      url: apiUrl,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json"
      },
      body: JSON.stringify({
        model,
        ...useResponsesApi2 ? {
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
        }
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
      ...useResponsesApi ? {
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
      }
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
function appendRawDetail(base, rawDetail) {
  return rawDetail.trim().length > 0 ? `${base}\uFF08${rawDetail}\uFF09` : base;
}
function toHttpErrorMessage(status, rawDetail) {
  if (status === 401 || status === 403) {
    return appendRawDetail("\u9274\u6743\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5 API Key \u6216\u8D26\u53F7\u6743\u9650", rawDetail);
  }
  if (status === 429) {
    return appendRawDetail("\u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41\u6216\u914D\u989D\u4E0D\u8DB3\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5", rawDetail);
  }
  if (status >= 500) {
    return appendRawDetail("\u6A21\u578B\u670D\u52A1\u5F02\u5E38\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5", rawDetail);
  }
  return appendRawDetail("\u8BF7\u6C42\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u6A21\u578B\u914D\u7F6E\u6216\u63A5\u53E3\u72B6\u6001", rawDetail || `HTTP ${status}`);
}
function toNetworkErrorMessage(error) {
  const rawMessage = error instanceof Error ? error.message : "";
  const normalized = rawMessage.toLowerCase();
  if (normalized.includes("timeout")) {
    return appendRawDetail("\u7F51\u7EDC\u8D85\u65F6\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u6216\u7A0D\u540E\u91CD\u8BD5", rawMessage);
  }
  if (normalized.includes("network") || normalized.includes("unreachable") || normalized.includes("enotfound")) {
    return appendRawDetail("\u7F51\u7EDC\u8BF7\u6C42\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u8FDE\u63A5\u548C API URL", rawMessage);
  }
  return appendRawDetail("\u7F51\u7EDC\u8BF7\u6C42\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u8FDE\u63A5\u548C API URL", rawMessage);
}
function extractProviderContentFromSseText(rawText, provider) {
  if (!rawText.trim()) {
    return "";
  }
  const { frames } = readSseDataFrames(`${rawText}

`);
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
    const payloadWithResponse = parsed.payload;
    const content = extractProviderContent(payloadWithResponse.response ?? parsed.payload, provider);
    if (content) {
      completedResponseContent = content;
    }
  }
  const mergedContent = merged.trim();
  return mergedContent || completedResponseContent.trim();
}
async function requestProviderContent(userPrompt, config) {
  const requestConfig = buildProviderRequest(userPrompt, config);
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
    throw new Error(GENERATION_COPY.errors.aiRequestFailed(toNetworkErrorMessage(error)));
  }
  const responseText = typeof response.text === "string" ? response.text : "";
  let responseJson = null;
  let responseJsonError = null;
  try {
    responseJson = response.json;
  } catch (error) {
    responseJsonError = error instanceof Error ? error : new Error(String(error));
  }
  if (response.status >= 400) {
    const rawDetail = responseJson !== null ? extractErrorDetail(response.status, responseJson) : extractErrorDetailFromRawText(response.status, responseText || responseJsonError?.message || "");
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
        return extractProviderContent(parsedResponse, config.provider);
      }
    } catch {
      return responseText.trim();
    }
  }
  if (responseJsonError) {
    throw responseJsonError;
  }
  return "";
}
function extractErrorDetailFromRawText(status, text) {
  const trimmed = text.trim();
  if (!trimmed) {
    return `HTTP ${status}`;
  }
  try {
    return extractErrorDetail(status, JSON.parse(trimmed));
  } catch {
    return trimmed.length > 300 ? `${trimmed.slice(0, 300)}\u2026` : trimmed;
  }
}
async function generateAiFlashcards(sections, settings) {
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
async function generateAiTopicFromCard(card, settings) {
  const modelConfig = getActiveAiModelOrThrow(settings);
  const sourceContext = [
    card.sourceHeading ? `sourceHeading=${card.sourceHeading}` : "",
    card.sourceAnchorText ? `sourceAnchorText=${card.sourceAnchorText}` : "",
    `question=${card.question}`,
    `answer=${card.answer}`
  ].filter(Boolean).join("\n");
  const prompt = [
    "\u8BF7\u57FA\u4E8E\u4EE5\u4E0B\u9519\u9898\u4FE1\u606F\u8BC6\u522B\u4E00\u4E2A\u6700\u6838\u5FC3\u7684\u5B66\u4E60\u4E3B\u9898\u3002",
    '\u53EA\u8FD4\u56DE JSON\uFF1A{"topic":"\u4E3B\u9898"}',
    "\u4E3B\u9898\u5FC5\u987B\u7B80\u6D01\uFF082-24\u5B57\uFF09\uFF0C\u4E0D\u8981\u8F93\u51FA\u89E3\u91CA\u3002",
    sourceContext
  ].join("\n");
  const content = await requestProviderContent(prompt, modelConfig);
  const topic = parseAiTopicResponse(content);
  if (!topic) {
    throw new Error("AI \u672A\u8FD4\u56DE\u53EF\u7528\u4E3B\u9898\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002");
  }
  return topic;
}
async function generateAiFlashcardsForMistakeTopic(card, topic, settings, targetCount = 5) {
  const modelConfig = getActiveAiModelOrThrow(settings);
  const section = {
    heading: card.sourceHeading?.trim() || topic,
    content: [card.question, card.answer].filter(Boolean).join("\n"),
    listItems: [],
    sourcePath: card.sourcePath,
    sourceAnchorText: card.sourceAnchorText,
    sourceStartLine: card.sourceStartLine,
    sourceEndLine: card.sourceEndLine
  };
  const prompt = [
    `\u4F60\u6B63\u5728\u4E3A\u9519\u9898\u4E3B\u9898\u201C${topic}\u201D\u751F\u6210\u8865\u5F3A\u95EA\u5361\u3002`,
    `\u8BF7\u4E25\u683C\u751F\u6210 ${targetCount} \u5F20\u4E2D\u6587\u95EE\u7B54\u5361\u7247\u3002`,
    `\u6BCF\u5F20\u5361\u7247 answer \u5C3D\u91CF\u63A7\u5236\u5728 ${settings.summaryLength} \u5B57\u4EE5\u5185\u3002`,
    "\u4E0D\u8981\u91CD\u590D\u539F\u9519\u9898\u8868\u8FF0\uFF0C\u4F18\u5148\u8986\u76D6\u5B9A\u4E49\u3001\u6613\u9519\u70B9\u3001\u5BF9\u6BD4\u3001\u5E94\u7528\u573A\u666F\u3002",
    '\u4EC5\u8F93\u51FA JSON\uFF0C\u683C\u5F0F\uFF1A{"cards":[{"question":"\u95EE\u9898","answer":"\u7B54\u6848"}]}',
    `\u9519\u9898\u95EE\u9898\uFF1A${card.question}`,
    `\u9519\u9898\u7B54\u6848\uFF1A${card.answer}`,
    modelConfig.prompt.trim().length > 0 ? `\u989D\u5916\u8981\u6C42\uFF1A${modelConfig.prompt.trim()}` : ""
  ].filter(Boolean).join("\n");
  const content = await requestProviderContent(prompt, modelConfig);
  const cards = normalizeMistakeTopicCards(parseAiResponse(content), section, targetCount, settings.summaryLength);
  if (cards.length === 0) {
    throw new Error(GENERATION_COPY.errors.aiInvalidResponse);
  }
  if (cards.length < targetCount) {
    throw new Error(`AI \u8FD4\u56DE\u5361\u7247\u6570\u91CF\u4E0D\u8DB3\uFF1A\u671F\u671B ${targetCount} \u5F20\uFF0C\u5B9E\u9645 ${cards.length} \u5F20\u3002`);
  }
  return cards;
}
async function testAiConnection(modelConfig) {
  const validationError = validateModelConfigForRequest(modelConfig);
  if (validationError) {
    throw new Error(validationError);
  }
  const probePrompt = "\u53EA\u56DE\u590D ok\u3002";
  const content = await requestProviderContent(probePrompt, modelConfig);
  if (!content.trim()) {
    throw new Error(GENERATION_COPY.errors.aiInvalidResponse);
  }
}

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
    generateFailed: "\u751F\u6210\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u6A21\u578B\u914D\u7F6E\u3001\u7F51\u7EDC\u6216\u7B14\u8BB0\u5185\u5BB9\u3002",
    removedFromMistakes: "\u5DF2\u79FB\u51FA\u9519\u9898\u672C",
    addedToMistakes: "\u5DF2\u52A0\u5165\u9519\u9898\u672C",
    noMasteredMistakesToClear: "\u5F53\u524D\u6CA1\u6709\u5DF2\u638C\u63E1\u7684\u9519\u9898\u53EF\u6E05\u7406",
    clearedMasteredMistakes: (count) => `\u5DF2\u6E05\u7406 ${count} \u5F20\u5DF2\u638C\u63E1\u9519\u9898`,
    refreshed: "\u95EA\u5361\u5217\u8868\u5DF2\u5237\u65B0",
    mistakeTopicGenerated: (count) => `\u5DF2\u65B0\u589E ${count} \u5F20\u4E0E\u5F53\u524D\u9519\u9898\u4E3B\u9898\u76F8\u5173\u7684\u5B66\u4E60\u5361\u7247\u3002`,
    mistakeTopicGeneratedPartial: (addedCount, skippedCount) => `\u5DF2\u65B0\u589E ${addedCount} \u5F20\u5361\u7247\uFF0C\u8DF3\u8FC7 ${skippedCount} \u5F20\u91CD\u590D\u5361\u7247\u3002`,
    mistakeTopicAllDuplicated: "\u5F53\u524D\u4E3B\u9898\u76F8\u5173\u5361\u7247\u5DF2\u5B58\u5728\uFF0C\u672C\u6B21\u672A\u65B0\u589E\u5361\u7247\u3002"
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
  },
  mistakeTopic: {
    title: "\u9519\u9898\u4E3B\u9898\u5361\u7247\u533A\u5757",
    topicLabel: "\u5F53\u524D\u4E3B\u9898",
    loading: "\u6B63\u5728\u8BC6\u522B\u5F53\u524D\u9519\u9898\u4E3B\u9898...",
    generateButton: "\u6309\u9519\u9898\u4E3B\u9898\u751F\u6210\u5B66\u4E60\u5361\u7247",
    generatingButton: "\u751F\u6210\u4E2D...",
    noTopic: "\u5F53\u524D\u9519\u9898\u6682\u672A\u8BC6\u522B\u5230\u53EF\u7528\u4E3B\u9898\u3002",
    nonMistake: "\u5F53\u524D\u5361\u7247\u4E0D\u5728\u9519\u9898\u672C\u4E2D\uFF0C\u65E0\u6CD5\u89E6\u53D1\u8BE5\u80FD\u529B\u3002",
    aiRequired: "\u8BE5\u80FD\u529B\u9700\u8981\u53EF\u7528\u7684 AI \u751F\u6210\u80FD\u529B\uFF0C\u8BF7\u5207\u6362\u5230 AI \u6216\u6DF7\u5408\u6A21\u5F0F\u3002",
    noAiModel: "\u5F53\u524D\u672A\u914D\u7F6E\u53EF\u7528 AI \u6A21\u578B\uFF0C\u6682\u65F6\u65E0\u6CD5\u6309\u9519\u9898\u4E3B\u9898\u751F\u6210\u5361\u7247\u3002",
    writeFailed: "\u5361\u7247\u5DF2\u751F\u6210\uFF0C\u4F46\u5199\u5165\u672C\u5730\u5361\u7247\u5E93\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002"
  }
};

// src/mistakeTopicState.ts
var TOPIC_HINT_KEYWORDS = ["\u8868", "\u6811", "\u56FE", "\u7B97\u6CD5", "\u5B9A\u5F8B", "\u516C\u5F0F", "\u51FD\u6570", "\u534F\u8BAE", "\u6A21\u578B", "\u7ED3\u6784", "\u6982\u5FF5", "\u539F\u7406", "\u7CFB\u7EDF"];
var QUESTION_STOP_WORDS = /* @__PURE__ */ new Set([
  "\u4EC0\u4E48",
  "\u54EA\u4E9B",
  "\u54EA\u4E2A",
  "\u54EA\u9879",
  "\u5982\u4F55",
  "\u4E3A\u4EC0\u4E48",
  "\u600E\u4E48",
  "\u662F\u5426",
  "\u53EF\u4EE5",
  "\u4E0D\u80FD",
  "\u6B63\u786E",
  "\u9519\u8BEF",
  "\u4EE5\u4E0B",
  "\u5173\u4E8E",
  "\u7684\u662F",
  "\u6709\u54EA",
  "\u8BF7\u95EE"
]);
var GENERIC_TOPIC_PATTERNS = ["\u8FD9\u9053\u9898", "\u672C\u9898", "\u4E0B\u5217", "\u4E0B\u8FF0", "\u95EE\u9898", "\u9009\u9879"];
function stripMarkdown(text) {
  return text.replace(/`[^`]*`/g, " ").replace(/\[[^\]]*\]\([^)]+\)/g, " ").replace(/[>*#_\-\n\r\t]/g, " ").replace(/\s+/g, " ").trim();
}
function normalizeTopicCandidate(raw) {
  const cleaned = stripMarkdown(raw).replace(/^[：:;；,.，。!?！？()[\]【】\s]+/g, "").replace(/[：:;；,.，。!?！？()[\]【】\s]+$/g, "").replace(/^关于/g, "").trim();
  if (cleaned.length < 2 || cleaned.length > 24) {
    return null;
  }
  return cleaned;
}
function trimPossessiveSuffix(candidate) {
  const parts = candidate.split("\u7684");
  if (parts.length < 2) {
    return candidate;
  }
  const prefix = parts[0].trim();
  const suffix = parts.slice(1).join("\u7684").trim();
  if (prefix.length >= 2 && suffix.length <= 4) {
    return prefix;
  }
  return candidate;
}
function scoreQuestionToken(token) {
  if (QUESTION_STOP_WORDS.has(token)) {
    return -1;
  }
  if (GENERIC_TOPIC_PATTERNS.some((pattern) => token.includes(pattern))) {
    return -1;
  }
  if (/^请/.test(token)) {
    return -1;
  }
  let score = token.length;
  if (TOPIC_HINT_KEYWORDS.some((keyword) => token.includes(keyword))) {
    score += 6;
  }
  if (/^[A-Za-z]/.test(token)) {
    score += 2;
  }
  return score;
}
function extractTopicFromQuestion(question) {
  const normalizedQuestion = stripMarkdown(question);
  const topicBeforeQuestionPattern = /([\u4e00-\u9fa5A-Za-z0-9#+-]{2,24})(?:的)?(?:是什么|是啥|作用|特点|原理|步骤|复杂度|区别|定义|如何|为什么|怎么|有哪些|包括|属于)/;
  const match = topicBeforeQuestionPattern.exec(normalizedQuestion);
  if (match?.[1]) {
    const candidate = normalizeTopicCandidate(trimPossessiveSuffix(match[1].replace(/^(请问|关于)/, "").trim()));
    if (candidate) {
      return candidate;
    }
  }
  const tokens = normalizedQuestion.match(/[A-Za-z][A-Za-z0-9#+-]{1,20}|[\u4e00-\u9fa5]{2,12}/g) ?? [];
  const ranked = tokens.map((token) => ({ token, score: scoreQuestionToken(token) })).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score);
  const best = ranked[0]?.token;
  return best ? normalizeTopicCandidate(best) : null;
}
function toAiFallbackError(message) {
  if (message === AI_MODEL_ERRORS.noConfigs || message === AI_MODEL_ERRORS.noActiveModel || message === AI_MODEL_ERRORS.activeModelNotFound || message.startsWith("\u6A21\u578B\u914D\u7F6E\u7F3A\u5C11\u5FC5\u586B\u9879")) {
    return REVIEW_COPY.mistakeTopic.noAiModel;
  }
  return message;
}
function canGenerateByMistakeTopic(settings) {
  return settings.generatorMode === "ai" || settings.generatorMode === "hybrid";
}
async function resolveMistakeTopic(card, settings, resolveAiTopic) {
  const sourceHeadingTopic = normalizeTopicCandidate(card.sourceHeading ?? "");
  if (sourceHeadingTopic) {
    return { topic: sourceHeadingTopic, source: "sourceHeading" };
  }
  const sourceAnchorTopic = normalizeTopicCandidate(card.sourceAnchorText ?? "");
  if (sourceAnchorTopic) {
    return { topic: sourceAnchorTopic, source: "sourceAnchorText" };
  }
  const questionTopic = extractTopicFromQuestion(card.question);
  if (questionTopic) {
    return { topic: questionTopic, source: "question" };
  }
  if (!canGenerateByMistakeTopic(settings)) {
    return {
      topic: null,
      source: null,
      error: REVIEW_COPY.mistakeTopic.noTopic
    };
  }
  try {
    const aiTopic = normalizeTopicCandidate(await resolveAiTopic(card, settings));
    if (aiTopic) {
      return { topic: aiTopic, source: "ai" };
    }
    return {
      topic: null,
      source: null,
      error: REVIEW_COPY.mistakeTopic.noTopic
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : REVIEW_COPY.mistakeTopic.noTopic;
    return {
      topic: null,
      source: null,
      error: toAiFallbackError(detail)
    };
  }
}

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
function buildDueQueue(cards, settings, now, countMode) {
  const dueCards = cards.filter((card) => isDueCard(card, now));
  if (dueCards.length === 0) {
    return settings.showAllCardsInReview ? cards : [];
  }
  const dueReviewCards = dueCards.filter((card) => card.cardState !== "new");
  const dueNewCards = dueCards.filter((card) => card.cardState === "new").sort((a, b) => toTimestamp(a.createdAt) - toTimestamp(b.createdAt));
  const newCardsPerDay = Math.max(0, settings.newCardsPerDay);
  const limitedDueNewCards = countMode === "all" ? dueNewCards : newCardsPerDay > 0 ? dueNewCards.slice(0, newCardsPerDay) : [];
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
  getSettingsSnapshot() {
    return this.settings();
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
    const reviewQueue = buildDueQueue(filteredCards, this.settings(), /* @__PURE__ */ new Date(), options.countMode);
    return getStudySession(reviewQueue, options, Math.random, sessionCardIds);
  }
  async resolveMistakeTopicForCard(card) {
    return resolveMistakeTopic(card, this.settings(), generateAiTopicFromCard);
  }
  async generateForMistakeTopic(card) {
    if (!card.inMistakeBook) {
      throw new Error(REVIEW_COPY.mistakeTopic.nonMistake);
    }
    const settings = this.settings();
    if (!canGenerateByMistakeTopic(settings)) {
      throw new Error(REVIEW_COPY.mistakeTopic.aiRequired);
    }
    const resolved = await this.resolveMistakeTopicForCard(card);
    if (!resolved.topic) {
      throw new Error(resolved.error ?? REVIEW_COPY.mistakeTopic.noTopic);
    }
    const topic = resolved.topic;
    const generatedCards = await generateAiFlashcardsForMistakeTopic(card, topic, settings, 5);
    const cardsWithSource = generatedCards.map((item) => ({
      ...item,
      generatedFromFlow: "mistake-topic",
      generatedFromCardId: card.id,
      generatedTopic: topic
    }));
    let result;
    try {
      result = await this.store.appendCardsWithDedupe(cardsWithSource);
    } catch {
      throw new Error(REVIEW_COPY.mistakeTopic.writeFailed);
    }
    return {
      topic,
      addedCount: result.addedCount,
      skippedCount: result.skippedCount
    };
  }
};

// src/settingTab.ts
var import_obsidian3 = require("obsidian");
function getProviderLabel(provider) {
  const option = getAiProviderOptions().find((item) => item.value === provider);
  return option?.label ?? provider;
}
var NoteFlashcardsSettingTab = class extends import_obsidian3.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.draftModel = null;
    this.editingModelId = null;
    this.isConnectionTestRunning = false;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    this.ensureDraftIsValid();
    new import_obsidian3.Setting(containerEl).setName(SETTINGS_COPY.generatorMode.name).setDesc(SETTINGS_COPY.generatorMode.description).addDropdown((dropdown) => {
      for (const option of getGeneratorModeOptions()) {
        dropdown.addOption(option.value, option.label);
      }
      dropdown.setValue(this.plugin.settings.generatorMode).onChange(async (value) => {
        await updateSetting(this.plugin.settings, "generatorMode", value, async () => this.plugin.saveSettings());
      });
    });
    new import_obsidian3.Setting(containerEl).setName(SETTINGS_COPY.mistakeTopicCardEntry.name).setDesc(SETTINGS_COPY.mistakeTopicCardEntry.description).addToggle((toggle) => toggle.setValue(this.plugin.settings.mistakeTopicCardEntryEnabled).onChange(async (value) => {
      await updateSetting(this.plugin.settings, "mistakeTopicCardEntryEnabled", value, async () => this.plugin.saveSettings());
    }));
    new import_obsidian3.Setting(containerEl).setName(SETTINGS_COPY.maxCardsPerNote.name).setDesc(SETTINGS_COPY.maxCardsPerNote.description).addText((text) => text.setPlaceholder(SETTINGS_COPY.maxCardsPerNote.placeholder).setValue(String(this.plugin.settings.maxCardsPerNote)).onChange(async (value) => {
      const parsed = parsePositiveInteger(value);
      if (parsed !== null) {
        await updateSetting(this.plugin.settings, "maxCardsPerNote", parsed, async () => this.plugin.saveSettings());
      }
    }));
    this.renderAiModelsSection(containerEl);
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
      this.clearDraft();
      this.display();
    }));
  }
  renderAiModelsSection(containerEl) {
    const detailsEl = containerEl.createEl("details", { cls: "note-flashcards-ai-section" });
    detailsEl.open = !this.plugin.settings.aiSectionCollapsed;
    detailsEl.addEventListener("toggle", () => {
      void this.handleAiSectionToggle(detailsEl.open);
    });
    detailsEl.createEl("summary", {
      cls: "note-flashcards-ai-summary",
      text: SETTINGS_COPY.aiModelsSection.name
    });
    const bodyEl = detailsEl.createDiv({ cls: "note-flashcards-ai-body" });
    bodyEl.createEl("p", {
      cls: "note-flashcards-ai-description",
      text: SETTINGS_COPY.aiModelsSection.description
    });
    new import_obsidian3.Setting(bodyEl).setName(SETTINGS_COPY.activeAiModel.name).setDesc(SETTINGS_COPY.activeAiModel.description).addDropdown((dropdown) => {
      dropdown.addOption("", SETTINGS_COPY.activeAiModel.placeholder);
      for (const config of this.plugin.settings.aiModelConfigs) {
        dropdown.addOption(config.id, config.name || "\u672A\u547D\u540D\u914D\u7F6E");
      }
      dropdown.setValue(this.plugin.settings.activeAiModelId).onChange(async (value) => {
        this.plugin.settings.activeAiModelId = value;
        await this.plugin.saveSettings();
        this.display();
      });
    });
    new import_obsidian3.Setting(bodyEl).setName(SETTINGS_COPY.aiModelsSection.addButton).addButton((button) => button.setButtonText(SETTINGS_COPY.aiModelsSection.addButton).onClick(() => {
      this.editingModelId = null;
      this.draftModel = createAiModelConfig();
      this.display();
    }));
    this.renderModelRows(bodyEl);
    this.renderModelEditor(bodyEl);
  }
  renderModelRows(containerEl) {
    const listEl = containerEl.createDiv({ cls: "note-flashcards-ai-list" });
    if (this.plugin.settings.aiModelConfigs.length === 0) {
      listEl.createEl("p", {
        cls: "note-flashcards-ai-empty",
        text: AI_MODEL_ERRORS.noConfigs
      });
      return;
    }
    for (const [index, config] of this.plugin.settings.aiModelConfigs.entries()) {
      const setting = new import_obsidian3.Setting(listEl).setName(config.name || "\u672A\u547D\u540D\u914D\u7F6E").setDesc(`${getProviderLabel(config.provider)} \xB7 ${config.model || "\u672A\u586B\u5199\u6A21\u578B\u540D"}`);
      setting.settingEl.addClass("note-flashcards-ai-model-row");
      if (this.plugin.settings.activeAiModelId === config.id) {
        setting.nameEl.createSpan({ cls: "note-flashcards-ai-default-tag", text: SETTINGS_COPY.aiModelActions.defaultTag });
      }
      setting.addButton((button) => button.setButtonText(SETTINGS_COPY.aiModelActions.edit).onClick(() => {
        this.editingModelId = config.id;
        this.draftModel = { ...config };
        this.display();
      }));
      setting.addButton((button) => {
        this.syncConnectionTestButton(button);
        button.onClick(async () => {
          await this.runConnectionTestWithLoading(config, button);
        });
      });
      setting.addButton((button) => button.setButtonText(SETTINGS_COPY.aiModelActions.copy).onClick(async () => {
        const next = duplicateModelConfig(config, this.plugin.settings.aiModelConfigs.map((item) => item.name));
        this.plugin.settings.aiModelConfigs = [...this.plugin.settings.aiModelConfigs, next];
        await this.plugin.saveSettings();
        this.display();
      }));
      setting.addButton((button) => button.setButtonText(SETTINGS_COPY.aiModelActions.setDefault).onClick(async () => {
        this.plugin.settings.activeAiModelId = config.id;
        await this.plugin.saveSettings();
        this.display();
      }));
      setting.addButton((button) => button.setButtonText(SETTINGS_COPY.aiModelActions.moveUp).setDisabled(index === 0).onClick(async () => {
        this.plugin.settings.aiModelConfigs = moveModelConfig(this.plugin.settings.aiModelConfigs, index, index - 1);
        await this.plugin.saveSettings();
        this.display();
      }));
      setting.addButton((button) => button.setButtonText(SETTINGS_COPY.aiModelActions.moveDown).setDisabled(index === this.plugin.settings.aiModelConfigs.length - 1).onClick(async () => {
        this.plugin.settings.aiModelConfigs = moveModelConfig(this.plugin.settings.aiModelConfigs, index, index + 1);
        await this.plugin.saveSettings();
        this.display();
      }));
      setting.addButton((button) => button.setButtonText(SETTINGS_COPY.aiModelActions.remove).setWarning().onClick(async () => {
        const wasActive = this.plugin.settings.activeAiModelId === config.id;
        this.plugin.settings.aiModelConfigs = this.plugin.settings.aiModelConfigs.filter((item) => item.id !== config.id);
        if (wasActive) {
          this.plugin.settings.activeAiModelId = "";
          if (this.plugin.settings.aiModelConfigs.length > 0) {
            new import_obsidian3.Notice("\u5DF2\u5220\u9664\u5F53\u524D\u751F\u6548\u6A21\u578B\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9\u5F53\u524D\u751F\u6548\u6A21\u578B\u3002");
          } else {
            new import_obsidian3.Notice("\u6A21\u578B\u914D\u7F6E\u5DF2\u6E05\u7A7A\uFF0CAI \u4E0E\u6DF7\u5408\u6A21\u5F0F\u5F53\u524D\u4E0D\u53EF\u7528\u3002");
          }
        }
        if (this.editingModelId === config.id) {
          this.clearDraft();
        }
        await this.plugin.saveSettings();
        this.display();
      }));
    }
  }
  renderModelEditor(containerEl) {
    if (!this.draftModel) {
      return;
    }
    const draftModel = this.draftModel;
    const editorEl = containerEl.createDiv({ cls: "note-flashcards-ai-editor" });
    new import_obsidian3.Setting(editorEl).setName("\u6A21\u578B\u914D\u7F6E\u7F16\u8F91").setHeading();
    new import_obsidian3.Setting(editorEl).setName(SETTINGS_COPY.aiModelName.name).addText((text) => text.setPlaceholder(SETTINGS_COPY.aiModelName.placeholder).setValue(draftModel.name).onChange((value) => {
      if (this.draftModel) {
        this.draftModel.name = value;
      }
    }));
    new import_obsidian3.Setting(editorEl).setName(SETTINGS_COPY.aiProvider.name).setDesc(SETTINGS_COPY.aiProvider.description).addDropdown((dropdown) => {
      for (const option of getAiProviderOptions()) {
        dropdown.addOption(option.value, option.label);
      }
      dropdown.setValue(draftModel.provider).onChange((value) => {
        if (!this.draftModel) {
          return;
        }
        const nextProvider = value;
        const currentProvider = this.draftModel.provider;
        const currentApiUrl = this.draftModel.apiUrl.trim();
        const currentDefaultApiUrl = getDefaultAiApiUrl(currentProvider);
        const shouldUpdateApiUrl = currentApiUrl.length === 0 || currentApiUrl === currentDefaultApiUrl;
        this.draftModel.provider = nextProvider;
        if (shouldUpdateApiUrl) {
          this.draftModel.apiUrl = getDefaultAiApiUrl(nextProvider);
        }
        this.display();
      });
    });
    new import_obsidian3.Setting(editorEl).setName(SETTINGS_COPY.aiApiUrl.name).setDesc(SETTINGS_COPY.aiApiUrl.description).addText((text) => text.setPlaceholder(getDefaultAiApiUrl(draftModel.provider)).setValue(draftModel.apiUrl).onChange((value) => {
      if (this.draftModel) {
        this.draftModel.apiUrl = value;
      }
    }));
    new import_obsidian3.Setting(editorEl).setName(SETTINGS_COPY.aiApiKey.name).setDesc(SETTINGS_COPY.aiApiKey.description).addText((text) => text.setPlaceholder(SETTINGS_COPY.aiApiKey.placeholder).setValue(draftModel.apiKey).onChange((value) => {
      if (this.draftModel) {
        this.draftModel.apiKey = value;
      }
    }));
    new import_obsidian3.Setting(editorEl).setName(SETTINGS_COPY.aiModel.name).setDesc(SETTINGS_COPY.aiModel.description).addText((text) => text.setPlaceholder(SETTINGS_COPY.aiModel.placeholder).setValue(draftModel.model).onChange((value) => {
      if (this.draftModel) {
        this.draftModel.model = value;
      }
    }));
    new import_obsidian3.Setting(editorEl).setName(SETTINGS_COPY.aiPrompt.name).setDesc(SETTINGS_COPY.aiPrompt.description).addTextArea((text) => text.setPlaceholder(SETTINGS_COPY.aiPrompt.placeholder).setValue(draftModel.prompt).onChange((value) => {
      if (this.draftModel) {
        this.draftModel.prompt = value;
      }
    }));
    new import_obsidian3.Setting(editorEl).setName(SETTINGS_COPY.aiModelActions.save).addButton((button) => button.setButtonText(SETTINGS_COPY.aiModelActions.save).setCta().onClick(async () => {
      const draft = this.getNormalizedDraftModel();
      if (!draft) {
        return;
      }
      const validationError = validateModelConfigForSave(draft);
      if (validationError) {
        new import_obsidian3.Notice(validationError);
        return;
      }
      const existingIndex = this.plugin.settings.aiModelConfigs.findIndex((item) => item.id === draft.id);
      if (existingIndex === -1) {
        this.plugin.settings.aiModelConfigs = [...this.plugin.settings.aiModelConfigs, draft];
      } else {
        const next = [...this.plugin.settings.aiModelConfigs];
        next[existingIndex] = draft;
        this.plugin.settings.aiModelConfigs = next;
      }
      await this.plugin.saveSettings();
      this.clearDraft();
      this.display();
    })).addButton((button) => {
      this.syncConnectionTestButton(button);
      button.onClick(async () => {
        const draft = this.getNormalizedDraftModel();
        if (!draft) {
          return;
        }
        await this.runConnectionTestWithLoading(draft, button);
      });
    }).addButton((button) => button.setButtonText(SETTINGS_COPY.aiModelActions.cancel).onClick(() => {
      this.clearDraft();
      this.display();
    }));
  }
  getNormalizedDraftModel() {
    if (!this.draftModel) {
      return null;
    }
    return this.normalizeModelConfig(this.draftModel);
  }
  normalizeModelConfig(config) {
    return {
      ...config,
      name: config.name.trim(),
      apiUrl: config.apiUrl.trim(),
      apiKey: config.apiKey.trim(),
      model: config.model.trim(),
      prompt: config.prompt.trim()
    };
  }
  syncConnectionTestButton(button) {
    button.setButtonText(this.isConnectionTestRunning ? SETTINGS_COPY.aiConnectionTest.loading : SETTINGS_COPY.aiConnectionTest.button).setDisabled(this.isConnectionTestRunning);
  }
  async runConnectionTestWithLoading(modelConfig, button) {
    if (this.isConnectionTestRunning) {
      return;
    }
    this.isConnectionTestRunning = true;
    this.syncConnectionTestButton(button);
    try {
      await this.runConnectionTest(modelConfig);
    } finally {
      this.isConnectionTestRunning = false;
      this.display();
    }
  }
  async runConnectionTest(modelConfig) {
    const normalizedModel = this.normalizeModelConfig(modelConfig);
    const validationError = validateModelConfigForRequest(normalizedModel);
    if (validationError) {
      new import_obsidian3.Notice(validationError);
      return;
    }
    try {
      await testAiConnection(normalizedModel);
      new import_obsidian3.Notice(SETTINGS_COPY.aiConnectionTest.success);
    } catch (error) {
      const detail = error instanceof Error ? error.message : void 0;
      new import_obsidian3.Notice(SETTINGS_COPY.aiConnectionTest.failed(detail));
    }
  }
  ensureDraftIsValid() {
    if (!this.draftModel) {
      return;
    }
    if (!this.editingModelId) {
      return;
    }
    const exists = this.plugin.settings.aiModelConfigs.some((item) => item.id === this.editingModelId);
    if (!exists) {
      this.clearDraft();
    }
  }
  clearDraft() {
    this.draftModel = null;
    this.editingModelId = null;
  }
  async handleAiSectionToggle(isOpen) {
    const nextCollapsed = !isOpen;
    if (nextCollapsed === this.plugin.settings.aiSectionCollapsed) {
      return;
    }
    this.plugin.settings.aiSectionCollapsed = nextCollapsed;
    await this.plugin.saveSettings();
  }
};

// src/reviewView.ts
var import_obsidian4 = require("obsidian");

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
async function generateByMistakeTopicAction(card, generateForMistakeTopic, reloadCards, notify, preferredIndex = 0) {
  const result = await generateForMistakeTopic(card);
  if (result.addedCount === 0) {
    notify(REVIEW_COPY.notices.mistakeTopicAllDuplicated);
  } else if (result.skippedCount > 0) {
    notify(REVIEW_COPY.notices.mistakeTopicGeneratedPartial(result.addedCount, result.skippedCount));
  } else {
    notify(REVIEW_COPY.notices.mistakeTopicGenerated(result.addedCount));
  }
  await reloadCards(card.id, preferredIndex);
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

// src/clipboard.ts
function getRuntimeRequire() {
  const candidate = globalThis.require;
  return typeof candidate === "function" ? candidate : null;
}
async function tryCopyToClipboard(text) {
  if (!text.trim()) {
    return false;
  }
  try {
    if (typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function") {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
  }
  try {
    const runtimeRequire = getRuntimeRequire();
    if (!runtimeRequire) {
      return false;
    }
    const electron = runtimeRequire("electron");
    if (typeof electron.clipboard?.writeText === "function") {
      electron.clipboard.writeText(text);
      return true;
    }
  } catch {
    return false;
  }
  return false;
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
    this.mistakeTopicKey = "";
    this.mistakeTopicResolution = null;
    this.mistakeTopicLoading = false;
    this.isGeneratingMistakeTopic = false;
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
  onClose() {
    window.removeEventListener("keydown", this.handleKeydown);
    return Promise.resolve();
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
    try {
      await generateForCurrentNoteAction(
        this.getCurrentPath,
        (path) => this.generationService.getFileByPath(path),
        (file) => this.generationService.generateForFile(file),
        () => this.reloadCards(),
        (message) => new import_obsidian4.Notice(message)
      );
    } catch (error) {
      const message = error instanceof Error && error.message.trim().length > 0 ? error.message : REVIEW_COPY.notices.generateFailed;
      console.error("[note-flashcards] generate current note failed", error);
      const copied = await tryCopyToClipboard(message);
      new import_obsidian4.Notice(copied ? `${message}\uFF08\u5DF2\u590D\u5236\u5230\u526A\u8D34\u677F\uFF09` : message);
    }
  }
  async generateForCurrentFolder() {
    try {
      await generateForCurrentFolderAction(
        this.getCurrentFolderPath,
        (folderPath) => this.generationService.generateForFolder(folderPath),
        () => this.reloadCards(),
        (message) => new import_obsidian4.Notice(message)
      );
    } catch (error) {
      const message = error instanceof Error && error.message.trim().length > 0 ? error.message : REVIEW_COPY.notices.generateFailed;
      console.error("[note-flashcards] generate current folder failed", error);
      const copied = await tryCopyToClipboard(message);
      new import_obsidian4.Notice(copied ? `${message}\uFF08\u5DF2\u590D\u5236\u5230\u526A\u8D34\u677F\uFF09` : message);
    }
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
      this.openFileAtSource.bind(this),
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
  hashFingerprint(input) {
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  }
  getActiveModelFingerprint(settings) {
    const activeConfig = settings.aiModelConfigs.find((config) => config.id === settings.activeAiModelId);
    if (!activeConfig) {
      return "no-active-model";
    }
    return this.hashFingerprint([
      activeConfig.provider,
      activeConfig.apiUrl,
      activeConfig.model,
      activeConfig.prompt,
      activeConfig.apiKey
    ].join("::"));
  }
  getMistakeTopicKey(card) {
    const settings = this.generationService.getSettingsSnapshot();
    return [
      card.id,
      settings.generatorMode,
      settings.activeAiModelId,
      settings.aiModelConfigs.length,
      this.getActiveModelFingerprint(settings)
    ].join("::");
  }
  ensureMistakeTopicResolution(card) {
    const key = this.getMistakeTopicKey(card);
    if (this.mistakeTopicKey === key && (this.mistakeTopicLoading || this.mistakeTopicResolution)) {
      return;
    }
    this.mistakeTopicKey = key;
    this.mistakeTopicLoading = true;
    this.mistakeTopicResolution = null;
    void this.resolveMistakeTopic(card, key);
  }
  async resolveMistakeTopic(card, key) {
    try {
      const resolution = await this.generationService.resolveMistakeTopicForCard(card);
      if (this.mistakeTopicKey !== key) {
        return;
      }
      this.mistakeTopicResolution = resolution;
    } catch (error) {
      if (this.mistakeTopicKey !== key) {
        return;
      }
      this.mistakeTopicResolution = {
        topic: null,
        source: null,
        error: error instanceof Error ? error.message : REVIEW_COPY.mistakeTopic.noTopic
      };
    } finally {
      if (this.mistakeTopicKey === key) {
        this.mistakeTopicLoading = false;
      }
      this.render();
    }
  }
  async generateByMistakeTopic(card) {
    if (this.isGeneratingMistakeTopic) {
      return;
    }
    this.isGeneratingMistakeTopic = true;
    this.render();
    try {
      await generateByMistakeTopicAction(
        card,
        (targetCard) => this.generationService.generateForMistakeTopic(targetCard),
        (preferredCardId, preferredIndex) => this.reloadCards(preferredCardId, preferredIndex),
        (message) => new import_obsidian4.Notice(message),
        this.index
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : REVIEW_COPY.mistakeTopic.noTopic;
      const copied = await tryCopyToClipboard(message);
      new import_obsidian4.Notice(copied ? `${message}\uFF08\u5DF2\u590D\u5236\u5230\u526A\u8D34\u677F\uFF09` : message);
    } finally {
      this.isGeneratingMistakeTopic = false;
      this.render();
    }
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
      new import_obsidian4.ButtonComponent(actions).setButtonText(REVIEW_COPY.buttons.generateCurrentNote).onClick(() => {
        void this.generateForCurrentNote();
      }).buttonEl.addClass("mod-cta");
    }
    if (emptyStateView.showGenerateCurrentFolder) {
      new import_obsidian4.ButtonComponent(actions).setButtonText(REVIEW_COPY.buttons.generateCurrentFolder).onClick(() => {
        void this.generateForCurrentFolder();
      });
    }
  }
  renderToolbar(contentEl, display) {
    const toolbar = contentEl.createDiv({ cls: "note-flashcards-toolbar" });
    const filterGroup = toolbar.createDiv({ cls: "note-flashcards-toolbar-group" });
    const generateGroup = toolbar.createDiv({ cls: "note-flashcards-toolbar-group" });
    const utilityGroup = toolbar.createDiv({ cls: "note-flashcards-toolbar-group" });
    new import_obsidian4.Setting(filterGroup).setName(REVIEW_COPY.study.scopeLabel).addDropdown((dropdown) => {
      for (const option of display.toolbar.scopeOptions) {
        dropdown.addOption(option.value, option.label);
      }
      dropdown.setValue(this.studyScope);
      dropdown.onChange((value) => {
        this.studyScope = value;
        void this.reloadCards();
      });
    });
    new import_obsidian4.Setting(filterGroup).setName(REVIEW_COPY.study.countModeLabel).addDropdown((dropdown) => {
      for (const option of display.toolbar.countModeOptions) {
        dropdown.addOption(option.value, option.label);
      }
      dropdown.setValue(this.countMode);
      dropdown.onChange((value) => {
        this.countMode = value;
        void this.reloadCards();
      });
    });
    new import_obsidian4.Setting(filterGroup).setName(REVIEW_COPY.study.orderModeLabel).addDropdown((dropdown) => {
      for (const option of display.toolbar.orderModeOptions) {
        dropdown.addOption(option.value, option.label);
      }
      dropdown.setValue(this.orderMode);
      dropdown.onChange((value) => {
        this.orderMode = value;
        void this.reloadCards();
      });
    });
    new import_obsidian4.Setting(filterGroup).setName(REVIEW_COPY.study.onlyMistakesLabel).addToggle((toggle) => toggle.setValue(this.includeMistakeBookOnly).onChange((value) => {
      this.includeMistakeBookOnly = value;
      void this.reloadCards();
    }));
    new import_obsidian4.Setting(filterGroup).setName(REVIEW_COPY.study.excludeMasteredLabel).addToggle((toggle) => toggle.setValue(this.excludeMastered).onChange((value) => {
      this.excludeMastered = value;
      void this.reloadCards();
    }));
    new import_obsidian4.ButtonComponent(utilityGroup).setButtonText(REVIEW_COPY.buttons.refreshQueue).onClick(() => {
      void this.reloadCards();
      new import_obsidian4.Notice(REVIEW_COPY.notices.refreshed);
    });
    new import_obsidian4.ButtonComponent(utilityGroup).setButtonText(REVIEW_COPY.buttons.clearMasteredMistakes).onClick(() => {
      void this.clearMasteredMistakeCards();
    });
    new import_obsidian4.ButtonComponent(generateGroup).setButtonText(REVIEW_COPY.buttons.generateCurrentNote).onClick(() => {
      void this.generateForCurrentNote();
    }).buttonEl.addClass("mod-cta", "note-flashcards-toolbar-primary");
    new import_obsidian4.ButtonComponent(generateGroup).setButtonText(REVIEW_COPY.buttons.generateCurrentFolder).onClick(() => {
      void this.generateForCurrentFolder();
    }).buttonEl.addClass("note-flashcards-toolbar-primary");
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
  renderMistakeTopicSection(contentEl, card) {
    const settings = this.generationService.getSettingsSnapshot();
    if (!settings.mistakeTopicCardEntryEnabled || !card.inMistakeBook) {
      return;
    }
    this.ensureMistakeTopicResolution(card);
    const section = contentEl.createDiv({ cls: "note-flashcards-mistake-topic" });
    section.createDiv({ cls: "note-flashcards-mistake-topic-title", text: REVIEW_COPY.mistakeTopic.title });
    if (this.mistakeTopicLoading) {
      section.createDiv({ cls: "note-flashcards-mistake-topic-meta", text: REVIEW_COPY.mistakeTopic.loading });
      return;
    }
    const topic = this.mistakeTopicResolution?.topic;
    if (topic) {
      section.createDiv({ cls: "note-flashcards-mistake-topic-topic", text: `${REVIEW_COPY.mistakeTopic.topicLabel}\uFF1A${topic}` });
    } else {
      section.createDiv({
        cls: "note-flashcards-mistake-topic-meta",
        text: this.mistakeTopicResolution?.error ?? REVIEW_COPY.mistakeTopic.noTopic
      });
    }
    if (settings.generatorMode === "rule") {
      section.createDiv({ cls: "note-flashcards-mistake-topic-meta", text: REVIEW_COPY.mistakeTopic.aiRequired });
      return;
    }
    if (!topic) {
      return;
    }
    const actions = section.createDiv({ cls: "note-flashcards-mistake-topic-actions" });
    const button = new import_obsidian4.ButtonComponent(actions).setButtonText(this.isGeneratingMistakeTopic ? REVIEW_COPY.mistakeTopic.generatingButton : REVIEW_COPY.mistakeTopic.generateButton).onClick(() => {
      void this.generateByMistakeTopic(card);
    });
    button.buttonEl.addClass("mod-cta");
    if (this.isGeneratingMistakeTopic) {
      button.buttonEl.addClass("is-disabled");
    }
  }
  renderActions(contentEl, card, cardView) {
    const actions = contentEl.createDiv({ cls: "note-flashcards-actions" });
    new import_obsidian4.ButtonComponent(actions).setButtonText(cardView.flipButtonLabel).onClick(() => this.toggleCardFace()).buttonEl.addClass("mod-cta");
    new import_obsidian4.ButtonComponent(actions).setButtonText(REVIEW_COPY.buttons.openSource).onClick(() => {
      void this.openSourceNote(card);
    });
    new import_obsidian4.ButtonComponent(actions).setButtonText(cardView.mistakeToggleLabel).onClick(() => {
      void this.toggleMistakeBook(card);
    }).buttonEl.addClass(cardView.mistakeToggleClass);
    new import_obsidian4.ButtonComponent(actions).setButtonText(cardView.masteredToggleLabel).onClick(() => {
      void this.toggleMastered(card);
    }).buttonEl.addClass(cardView.masteredToggleClass);
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
    this.renderMistakeTopicSection(contentEl, card);
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
    generateFailed: "\u751F\u6210\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u6A21\u578B\u914D\u7F6E\u3001\u7F51\u7EDC\u6216\u7B14\u8BB0\u5185\u5BB9\u3002",
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
  const rawSettings = (data && typeof data === "object" ? data.settings : void 0) ?? {};
  const aiModelConfigs = sanitizeAiModelConfigs(rawSettings.aiModelConfigs);
  const activeAiModelId = typeof rawSettings.activeAiModelId === "string" ? rawSettings.activeAiModelId : "";
  return {
    generatorMode: rawSettings.generatorMode ?? DEFAULT_SETTINGS.generatorMode,
    maxCardsPerNote: rawSettings.maxCardsPerNote ?? DEFAULT_SETTINGS.maxCardsPerNote,
    summaryLength: rawSettings.summaryLength ?? DEFAULT_SETTINGS.summaryLength,
    mistakeTopicCardEntryEnabled: typeof rawSettings.mistakeTopicCardEntryEnabled === "boolean" ? rawSettings.mistakeTopicCardEntryEnabled : DEFAULT_SETTINGS.mistakeTopicCardEntryEnabled,
    aiModelConfigs,
    activeAiModelId: aiModelConfigs.some((config) => config.id === activeAiModelId) ? activeAiModelId : "",
    aiSectionCollapsed: typeof rawSettings.aiSectionCollapsed === "boolean" ? rawSettings.aiSectionCollapsed : DEFAULT_SETTINGS.aiSectionCollapsed,
    ignoredFolders: rawSettings.ignoredFolders ?? DEFAULT_SETTINGS.ignoredFolders,
    newCardsPerDay: rawSettings.newCardsPerDay ?? DEFAULT_SETTINGS.newCardsPerDay,
    showAllCardsInReview: rawSettings.showAllCardsInReview ?? DEFAULT_SETTINGS.showAllCardsInReview,
    learningStepsMinutes: rawSettings.learningStepsMinutes ?? DEFAULT_SETTINGS.learningStepsMinutes,
    graduatingIntervalDays: rawSettings.graduatingIntervalDays ?? DEFAULT_SETTINGS.graduatingIntervalDays,
    easyIntervalDays: rawSettings.easyIntervalDays ?? DEFAULT_SETTINGS.easyIntervalDays
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
    this.addRibbonIcon("lucide-layers", PLUGIN_COPY.ribbon.openReview, () => {
      void this.activateReviewView();
    });
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file, _source, _leaf) => {
      if (!(file instanceof import_obsidian5.TFile)) {
        return;
      }
      menu.addItem((item) => item.setTitle(PLUGIN_COPY.menu.generateCurrentNote).setIcon("sparkles").onClick(() => {
        void this.generateFileAndOpenReview(file);
      }));
      menu.addItem((item) => item.setTitle(PLUGIN_COPY.menu.generateCurrentFolder).setIcon("folder-open").onClick(() => {
        const folder = this.requireCurrentFolder(file.parent);
        if (!folder) {
          return;
        }
        void this.generateFolderAndOpenReview(folder.path);
      }));
    }));
    this.registerEvent(this.app.workspace.on("editor-menu", (menu, _editor, info) => {
      const file = info.file;
      if (!file) {
        return;
      }
      menu.addItem((item) => item.setTitle(PLUGIN_COPY.menu.generateCurrentNote).setIcon("sparkles").onClick(() => {
        void this.generateFileAndOpenReview(file);
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
      callback: () => {
        void this.activateReviewView();
      }
    });
  }
  onunload() {
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
  toUserFacingErrorMessage(error, fallback) {
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message;
    }
    return fallback;
  }
  async runWithGenerationNotice(action) {
    try {
      await action();
    } catch (error) {
      console.error("[note-flashcards] generate failed", error);
      const message = this.toUserFacingErrorMessage(error, PLUGIN_COPY.notices.generateFailed);
      const copied = await tryCopyToClipboard(message);
      new import_obsidian5.Notice(copied ? `${message}\uFF08\u5DF2\u590D\u5236\u5230\u526A\u8D34\u677F\uFF09` : message);
    }
  }
  async generateFileAndOpenReview(file) {
    await this.runWithGenerationNotice(async () => {
      await this.generationService.generateForFile(file);
      await this.activateReviewView();
    });
  }
  async generateFolderAndOpenReview(folderPath) {
    await this.runWithGenerationNotice(async () => {
      await this.generationService.generateForFolder(folderPath);
      await this.activateReviewView();
    });
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
      (leaf) => {
        void this.app.workspace.revealLeaf(leaf);
      },
      (message) => new import_obsidian5.Notice(message),
      REVIEW_VIEW_TYPE
    );
  }
};
