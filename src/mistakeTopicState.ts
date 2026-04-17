import { AI_MODEL_ERRORS } from "./aiModelState";
import { REVIEW_COPY } from "./reviewCopy";
import type { Flashcard, NoteFlashcardsSettings } from "./types";

export type MistakeTopicSource = "sourceHeading" | "sourceAnchorText" | "question" | "ai";

export interface MistakeTopicResolution {
  topic: string | null;
  source: MistakeTopicSource | null;
  error?: string;
}

const TOPIC_HINT_KEYWORDS = ["表", "树", "图", "算法", "定律", "公式", "函数", "协议", "模型", "结构", "概念", "原理", "系统"];
const QUESTION_STOP_WORDS = new Set([
  "什么",
  "哪些",
  "哪个",
  "哪项",
  "如何",
  "为什么",
  "怎么",
  "是否",
  "可以",
  "不能",
  "正确",
  "错误",
  "以下",
  "关于",
  "的是",
  "有哪",
  "请问"
]);
const GENERIC_TOPIC_PATTERNS = ["这道题", "本题", "下列", "下述", "问题", "选项"];

function stripMarkdown(text: string): string {
  return text
    .replace(/`[^`]*`/g, " ")
    .replace(/\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/[>*#_\-\n\r\t]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTopicCandidate(raw: string): string | null {
  const cleaned = stripMarkdown(raw)
    .replace(/^[：:;；,.，。!?！？()[\]【】\s]+/g, "")
    .replace(/[：:;；,.，。!?！？()[\]【】\s]+$/g, "")
    .replace(/^关于/g, "")
    .trim();
  if (cleaned.length < 2 || cleaned.length > 24) {
    return null;
  }
  return cleaned;
}

function trimPossessiveSuffix(candidate: string): string {
  const parts = candidate.split("的");
  if (parts.length < 2) {
    return candidate;
  }
  const prefix = parts[0].trim();
  const suffix = parts.slice(1).join("的").trim();
  if (prefix.length >= 2 && suffix.length <= 4) {
    return prefix;
  }
  return candidate;
}

function scoreQuestionToken(token: string): number {
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

function extractTopicFromQuestion(question: string): string | null {
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
  const ranked = tokens
    .map((token) => ({ token, score: scoreQuestionToken(token) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
  const best = ranked[0]?.token;
  return best ? normalizeTopicCandidate(best) : null;
}

function toAiFallbackError(message: string): string {
  if (
    message === AI_MODEL_ERRORS.noConfigs
    || message === AI_MODEL_ERRORS.noActiveModel
    || message === AI_MODEL_ERRORS.activeModelNotFound
    || message.startsWith("模型配置缺少必填项")
  ) {
    return REVIEW_COPY.mistakeTopic.noAiModel;
  }
  return message;
}

export function canGenerateByMistakeTopic(settings: NoteFlashcardsSettings): boolean {
  return settings.generatorMode === "ai" || settings.generatorMode === "hybrid";
}

export async function resolveMistakeTopic(
  card: Flashcard,
  settings: NoteFlashcardsSettings,
  resolveAiTopic: (card: Flashcard, settings: NoteFlashcardsSettings) => Promise<string>
): Promise<MistakeTopicResolution> {
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
