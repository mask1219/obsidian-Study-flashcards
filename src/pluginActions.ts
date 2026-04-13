import { PLUGIN_COPY } from "./pluginCopy";
import type { TFile, TFolder } from "obsidian";

interface ReviewLeafLike {
  setViewState: (state: { type: string; active: true }) => Promise<void>;
}

export async function runGenerateCurrentNote(
  file: TFile | null,
  generateFileAndOpenReview: (file: TFile) => Promise<void>
): Promise<boolean> {
  if (!file) {
    return false;
  }

  await generateFileAndOpenReview(file);
  return true;
}

export async function runGenerateCurrentFolder(
  folder: TFolder | null,
  generateFolderAndOpenReview: (folderPath: string) => Promise<void>
): Promise<boolean> {
  if (!folder) {
    return false;
  }

  await generateFolderAndOpenReview(folder.path);
  return true;
}

export async function activateReviewLeaf<TLeaf extends ReviewLeafLike>(
  existingLeaf: TLeaf | undefined,
  getRightLeaf: (split: boolean) => TLeaf | null,
  revealLeaf: (leaf: TLeaf) => void,
  notify: (message: string) => void,
  reviewViewType: string
): Promise<boolean> {
  const leaf = existingLeaf ?? getRightLeaf(false);
  if (!leaf) {
    notify(PLUGIN_COPY.notices.cannotOpenReviewView);
    return false;
  }

  await leaf.setViewState({ type: reviewViewType, active: true });
  revealLeaf(leaf);
  return true;
}
