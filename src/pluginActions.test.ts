import { describe, expect, it, vi } from "vitest";
import { TFile, TFolder } from "obsidian";
import { activateReviewLeaf, runGenerateCurrentFolder, runGenerateCurrentNote } from "./pluginActions";

describe("pluginActions", () => {
  it("short-circuits current note and folder generation when context is missing", async () => {
    const generateFileAndOpenReview = vi.fn(async () => undefined);
    const generateFolderAndOpenReview = vi.fn(async () => undefined);

    expect(await runGenerateCurrentNote(null, generateFileAndOpenReview)).toBe(false);
    expect(await runGenerateCurrentFolder(null, generateFolderAndOpenReview)).toBe(false);
    expect(generateFileAndOpenReview).not.toHaveBeenCalled();
    expect(generateFolderAndOpenReview).not.toHaveBeenCalled();
  });

  it("routes current note and folder generation through the open-review helpers", async () => {
    const file = new TFile();
    file.path = "folder/note.md";
    const folder = new TFolder();
    folder.path = "folder";
    file.parent = folder;
    const generateFileAndOpenReview = vi.fn(async () => undefined);
    const generateFolderAndOpenReview = vi.fn(async () => undefined);

    expect(await runGenerateCurrentNote(file, generateFileAndOpenReview)).toBe(true);
    expect(await runGenerateCurrentFolder(folder, generateFolderAndOpenReview)).toBe(true);
    expect(generateFileAndOpenReview).toHaveBeenCalledWith(file);
    expect(generateFolderAndOpenReview).toHaveBeenCalledWith("folder");
  });

  it("activates review view through existing or new leaves and stops when none exist", async () => {
    const revealLeaf = vi.fn();
    const notify = vi.fn();
    const existingLeaf = { setViewState: vi.fn(async () => undefined) };
    expect(await activateReviewLeaf(existingLeaf, () => null, revealLeaf, notify, "note-flashcards-review")).toBe(true);
    expect(existingLeaf.setViewState).toHaveBeenCalled();
    expect(revealLeaf).toHaveBeenCalledWith(existingLeaf);

    const newLeaf = { setViewState: vi.fn(async () => undefined) };
    expect(await activateReviewLeaf(undefined, () => newLeaf, revealLeaf, notify, "note-flashcards-review")).toBe(true);
    expect(newLeaf.setViewState).toHaveBeenCalled();
    expect(revealLeaf).toHaveBeenCalledWith(newLeaf);

    expect(await activateReviewLeaf(undefined, () => null, revealLeaf, notify, "note-flashcards-review")).toBe(false);
    expect(notify).toHaveBeenCalled();
  });
});
