import { DEFAULT_SETTINGS } from "./settings";
import type { NoteFlashcardsSettings } from "./types";

export function loadPersistedSettings(data: unknown): NoteFlashcardsSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...((data && typeof data === "object" ? (data as { settings?: Partial<NoteFlashcardsSettings> }).settings : undefined) ?? {})
  };
}

export function buildSavedPluginData(data: unknown, settings: NoteFlashcardsSettings): { settings: NoteFlashcardsSettings; cards: unknown[] } & Record<string, unknown> {
  const existing = data && typeof data === "object" ? data as Record<string, unknown> & { cards?: unknown[] } : {};
  return {
    ...existing,
    settings,
    cards: Array.isArray(existing.cards) ? existing.cards : []
  };
}
