import { App, Editor, MarkdownFileInfo, Menu, Notice, Plugin, PluginManifest, TAbstractFile, TFolder, TFile, WorkspaceLeaf } from "obsidian";
import { CardStore } from "./src/cardStore";
import { GenerationService } from "./src/generationService";
import { DEFAULT_SETTINGS } from "./src/settings";
import { NoteFlashcardsSettingTab } from "./src/settingTab";
import { ReviewView, REVIEW_VIEW_TYPE } from "./src/reviewView";
import { PLUGIN_COPY } from "./src/pluginCopy";
import { activateReviewLeaf, runGenerateCurrentFolder, runGenerateCurrentNote } from "./src/pluginActions";
import { buildSavedPluginData, loadPersistedSettings } from "./src/pluginSettingsState";
import { tryCopyToClipboard } from "./src/clipboard";
import type { NoteFlashcardsSettings } from "./src/types";

export default class NoteFlashcardsPlugin extends Plugin {
  settings: NoteFlashcardsSettings = DEFAULT_SETTINGS;
  private store!: CardStore;
  private generationService!: GenerationService;

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
  }

  async onload(): Promise<void> {
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

    this.registerEvent(this.app.workspace.on("file-menu", (menu: Menu, file: TAbstractFile, _source: string, _leaf?: WorkspaceLeaf) => {
      if (!(file instanceof TFile)) {
        return;
      }
      menu.addItem((item) => item
        .setTitle(PLUGIN_COPY.menu.generateCurrentNote)
        .setIcon("sparkles")
        .onClick(async () => {
          await this.generateFileAndOpenReview(file);
        }));

      menu.addItem((item) => item
        .setTitle(PLUGIN_COPY.menu.generateCurrentFolder)
        .setIcon("folder-open")
        .onClick(async () => {
          const folder = this.requireCurrentFolder(file.parent);
          if (!folder) {
            return;
          }
          await this.generateFolderAndOpenReview(folder.path);
        }));
    }));

    this.registerEvent(this.app.workspace.on("editor-menu", (menu: Menu, _editor: Editor, info: MarkdownFileInfo) => {
      const file = info.file;
      if (!file) {
        return;
      }

      menu.addItem((item) => item
        .setTitle(PLUGIN_COPY.menu.generateCurrentNote)
        .setIcon("sparkles")
        .onClick(async () => {
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

  onunload(): void {
    this.app.workspace.detachLeavesOfType(REVIEW_VIEW_TYPE);
  }

  async loadSettings(): Promise<void> {
    const loaded = await this.loadData();
    this.settings = loadPersistedSettings(loaded);
  }

  async saveSettings(): Promise<void> {
    const existing = await this.loadData();
    await this.saveData(buildSavedPluginData(existing, this.settings));
  }

  async resetAllCards(): Promise<void> {
    await this.store.resetCards();
    new Notice(PLUGIN_COPY.notices.resetCardsDone);
  }

  async resetSettingsToDefault(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS };
    await this.saveSettings();
    new Notice(PLUGIN_COPY.notices.resetSettingsDone);
  }

  private toUserFacingErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message;
    }
    return fallback;
  }

  private async runWithGenerationNotice(action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch (error) {
      console.error("[note-flashcards] generate failed", error);
      const message = this.toUserFacingErrorMessage(error, PLUGIN_COPY.notices.generateFailed);
      const copied = await tryCopyToClipboard(message);
      new Notice(copied ? `${message}（已复制到剪贴板）` : message);
    }
  }

  private async generateFileAndOpenReview(file: TFile): Promise<void> {
    await this.runWithGenerationNotice(async () => {
      await this.generationService.generateForFile(file);
      await this.activateReviewView();
    });
  }

  private async generateFolderAndOpenReview(folderPath: string): Promise<void> {
    await this.runWithGenerationNotice(async () => {
      await this.generationService.generateForFolder(folderPath);
      await this.activateReviewView();
    });
  }

  private async generateCurrentNote(): Promise<void> {
    await runGenerateCurrentNote(this.requireCurrentFile(), (file) => this.generateFileAndOpenReview(file));
  }

  private async generateCurrentFolder(): Promise<void> {
    await runGenerateCurrentFolder(this.requireCurrentFolder(), (folderPath) => this.generateFolderAndOpenReview(folderPath));
  }

  private requireCurrentFile(file = this.app.workspace.getActiveFile()): TFile | null {
    if (!file) {
      new Notice(PLUGIN_COPY.notices.noCurrentNote);
      return null;
    }
    return file;
  }

  private requireCurrentFolder(folder = this.app.workspace.getActiveFile()?.parent): TFolder | null {
    if (!folder) {
      new Notice(PLUGIN_COPY.notices.noCurrentFolder);
      return null;
    }
    return folder;
  }

  private getCurrentFilePath(): string | undefined {
    return this.app.workspace.getActiveFile()?.path;
  }

  private getCurrentFolderPath(): string | undefined {
    return this.getCurrentFolder()?.path;
  }

  private getCurrentFolder(): TFolder | null {
    return this.requireCurrentFolder();
  }

  private async activateReviewView(): Promise<void> {
    await activateReviewLeaf(
      this.app.workspace.getLeavesOfType(REVIEW_VIEW_TYPE)[0],
      (split) => this.app.workspace.getRightLeaf(split),
      (leaf) => this.app.workspace.revealLeaf(leaf),
      (message) => new Notice(message),
      REVIEW_VIEW_TYPE
    );
  }
}
