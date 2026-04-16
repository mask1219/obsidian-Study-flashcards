import { ButtonComponent, ItemView, Notice, Setting, WorkspaceLeaf } from "obsidian";
import type { Flashcard, StudyCountMode, StudyOrderMode, StudyScope, StudySessionResult } from "./types";
import type { GenerationService } from "./generationService";
import type { CardStore } from "./cardStore";
import { REVIEW_COPY } from "./reviewCopy";
import {
  clearMasteredMistakeCardsAction,
  generateByMistakeTopicAction,
  generateForCurrentFolderAction,
  generateForCurrentNoteAction,
  openSourceNoteAction,
  toggleMasteredAction,
  toggleMistakeBookAction
} from "./reviewActions";
import type { MistakeTopicResolution } from "./mistakeTopicState";
import { getWrappedReviewIndex, resolveReviewIndex } from "./reviewState";
import { getStudyDisplayState, type StudyCardViewModel, type StudyDisplayState, type StudyEmptyStateViewModel } from "./studyViewModel";

export const REVIEW_VIEW_TYPE = "note-flashcards-review";

export class ReviewView extends ItemView {
  private cards: Flashcard[] = [];
  private index = 0;
  private flipped = false;
  private studyScope: StudyScope = "current";
  private countMode: StudyCountMode = "random10";
  private orderMode: StudyOrderMode = "random";
  private includeMistakeBookOnly = false;
  private excludeMastered = false;
  private totalCards = 0;
  private selectedCount = 0;
  private sessionCardIds: string[] = [];
  private lastSessionKey = "";
  private mistakeTopicKey = "";
  private mistakeTopicResolution: MistakeTopicResolution | null = null;
  private mistakeTopicLoading = false;
  private isGeneratingMistakeTopic = false;
  private readonly handleKeydown = (event: KeyboardEvent): void => {
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

  constructor(
    leaf: WorkspaceLeaf,
    private readonly generationService: GenerationService,
    private readonly cardStore: CardStore,
    private readonly getCurrentPath: () => string | undefined,
    private readonly getCurrentFolderPath: () => string | undefined
  ) {
    super(leaf);
  }

  getViewType(): string {
    return REVIEW_VIEW_TYPE;
  }

  getDisplayText(): string {
    return REVIEW_COPY.displayName;
  }

  async onOpen(): Promise<void> {
    window.addEventListener("keydown", this.handleKeydown);
    await this.reloadCards();
  }

  async onClose(): Promise<void> {
    window.removeEventListener("keydown", this.handleKeydown);
  }

  private getStudySourcePath(): string | undefined {
    if (this.studyScope === "current") {
      return this.getCurrentPath();
    }
    if (this.studyScope === "folder") {
      return this.getCurrentFolderPath();
    }
    return undefined;
  }

  private applySession(session: StudySessionResult): void {
    this.cards = session.cards;
    this.totalCards = session.totalCards;
    this.selectedCount = session.selectedCount;
    this.sessionCardIds = session.sessionCardIds;
  }

  private getSessionKey(sourcePath: string | undefined): string {
    return JSON.stringify({
      scope: this.studyScope,
      sourcePath,
      countMode: this.countMode,
      orderMode: this.orderMode,
      includeMistakeBookOnly: this.includeMistakeBookOnly,
      excludeMastered: this.excludeMastered
    });
  }

  async reloadCards(preferredCardId?: string, preferredIndex = 0): Promise<void> {
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
    }, shouldReuseSession ? this.sessionCardIds : undefined);
    this.lastSessionKey = sessionKey;
    this.applySession(session);
    this.index = resolveReviewIndex(this.cards, this.index, preferredCardId, preferredIndex);
    this.flipped = false;
    this.render();
  }

  private isViewActive(): boolean {
    return this.app.workspace.getActiveViewOfType(ReviewView) === this;
  }

  private shouldIgnoreKeyboardEvent(event: KeyboardEvent): boolean {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return false;
    }
    return ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName) || target.isContentEditable;
  }

  private toggleCardFace(): void {
    if (this.cards.length === 0) {
      return;
    }
    this.flipped = !this.flipped;
    this.render();
  }

  private showPrevious(): void {
    if (this.cards.length === 0) {
      return;
    }
    this.index = getWrappedReviewIndex(this.index, this.cards.length, -1);
    this.flipped = false;
    this.render();
  }

  private showNext(): void {
    if (this.cards.length === 0) {
      return;
    }
    this.index = getWrappedReviewIndex(this.index, this.cards.length, 1);
    this.flipped = false;
    this.render();
  }

  private async generateForCurrentNote(): Promise<void> {
    await generateForCurrentNoteAction(
      this.getCurrentPath,
      (path) => this.generationService.getFileByPath(path),
      (file) => this.generationService.generateForFile(file as never),
      () => this.reloadCards(),
      (message) => new Notice(message)
    );
  }

  private async generateForCurrentFolder(): Promise<void> {
    await generateForCurrentFolderAction(
      this.getCurrentFolderPath,
      (folderPath) => this.generationService.generateForFolder(folderPath),
      () => this.reloadCards(),
      (message) => new Notice(message)
    );
  }

  private async openFileAtSource(file: unknown, card: Flashcard): Promise<void> {
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.openFile(file as never);
    const view = leaf.view as {
      setEphemeralState?: (state: { subpath: string }) => void;
      editor?: {
        setCursor?: (position: { line: number; ch: number }) => void;
        scrollIntoView?: (range: { from: { line: number; ch: number }; to: { line: number; ch: number } }, center?: boolean) => void;
      };
    } | null;

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

  private async openSourceNote(card: Flashcard): Promise<void> {
    await openSourceNoteAction(
      card,
      (path) => this.generationService.getFileByPath(path),
      async (file, sourceCard) => await this.openFileAtSource(file, sourceCard),
      (message) => new Notice(message)
    );
  }

  private async toggleMistakeBook(card: Flashcard): Promise<void> {
    await toggleMistakeBookAction(
      card,
      (cardId, inMistakeBook) => this.cardStore.setMistakeBook(cardId, inMistakeBook),
      (preferredCardId, preferredIndex) => this.reloadCards(preferredCardId, preferredIndex),
      (message) => new Notice(message),
      this.index
    );
  }

  private async toggleMastered(card: Flashcard): Promise<void> {
    await toggleMasteredAction(
      card,
      (cardId, isMastered) => this.cardStore.setMastered(cardId, isMastered),
      (preferredCardId, preferredIndex) => this.reloadCards(preferredCardId, preferredIndex),
      this.index
    );
  }

  private async clearMasteredMistakeCards(): Promise<void> {
    await clearMasteredMistakeCardsAction(
      () => this.cardStore.clearMasteredMistakeCards(),
      () => this.reloadCards(),
      (message) => new Notice(message)
    );
  }

  private hashFingerprint(input: string): string {
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  }

  private getActiveModelFingerprint(settings: ReturnType<GenerationService["getSettingsSnapshot"]>): string {
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

  private getMistakeTopicKey(card: Flashcard): string {
    const settings = this.generationService.getSettingsSnapshot();
    return [
      card.id,
      settings.generatorMode,
      settings.activeAiModelId,
      settings.aiModelConfigs.length,
      this.getActiveModelFingerprint(settings)
    ].join("::");
  }

  private ensureMistakeTopicResolution(card: Flashcard): void {
    const key = this.getMistakeTopicKey(card);
    if (this.mistakeTopicKey === key && (this.mistakeTopicLoading || this.mistakeTopicResolution)) {
      return;
    }
    this.mistakeTopicKey = key;
    this.mistakeTopicLoading = true;
    this.mistakeTopicResolution = null;
    void this.resolveMistakeTopic(card, key);
  }

  private async resolveMistakeTopic(card: Flashcard, key: string): Promise<void> {
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

  private async generateByMistakeTopic(card: Flashcard): Promise<void> {
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
        (message) => new Notice(message),
        this.index
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : REVIEW_COPY.mistakeTopic.noTopic;
      new Notice(message);
    } finally {
      this.isGeneratingMistakeTopic = false;
      this.render();
    }
  }

  private getDisplayState(): StudyDisplayState {
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

  private renderEmptyState(contentEl: HTMLElement, emptyStateView: StudyEmptyStateViewModel): void {
    const emptyState = contentEl.createDiv({ cls: "note-flashcards-empty-state" });
    emptyState.createEl("p", { text: emptyStateView.title });
    if (emptyStateView.description) {
      emptyState.createEl("p", { text: emptyStateView.description });
    }

    const actions = emptyState.createDiv({ cls: "note-flashcards-empty-actions" });
    if (emptyStateView.showGenerateCurrentNote) {
      new ButtonComponent(actions)
        .setButtonText(REVIEW_COPY.buttons.generateCurrentNote)
        .onClick(async () => await this.generateForCurrentNote())
        .buttonEl.addClass("mod-cta");
    }

    if (emptyStateView.showGenerateCurrentFolder) {
      new ButtonComponent(actions)
        .setButtonText(REVIEW_COPY.buttons.generateCurrentFolder)
        .onClick(async () => await this.generateForCurrentFolder());
    }
  }

  private renderToolbar(contentEl: HTMLElement, display: StudyDisplayState): void {
    const toolbar = contentEl.createDiv({ cls: "note-flashcards-toolbar" });
    const filterGroup = toolbar.createDiv({ cls: "note-flashcards-toolbar-group" });
    const generateGroup = toolbar.createDiv({ cls: "note-flashcards-toolbar-group" });
    const utilityGroup = toolbar.createDiv({ cls: "note-flashcards-toolbar-group" });

    new Setting(filterGroup)
      .setName(REVIEW_COPY.study.scopeLabel)
      .addDropdown((dropdown) => {
        display.toolbar.scopeOptions.forEach((option) => dropdown.addOption(option.value, option.label));
        dropdown.setValue(this.studyScope).onChange(async (value) => {
          this.studyScope = value as StudyScope;
          await this.reloadCards();
        });
      });

    new Setting(filterGroup)
      .setName(REVIEW_COPY.study.countModeLabel)
      .addDropdown((dropdown) => {
        display.toolbar.countModeOptions.forEach((option) => dropdown.addOption(option.value, option.label));
        dropdown.setValue(this.countMode).onChange(async (value) => {
          this.countMode = value as StudyCountMode;
          await this.reloadCards();
        });
      });

    new Setting(filterGroup)
      .setName(REVIEW_COPY.study.orderModeLabel)
      .addDropdown((dropdown) => {
        display.toolbar.orderModeOptions.forEach((option) => dropdown.addOption(option.value, option.label));
        dropdown.setValue(this.orderMode).onChange(async (value) => {
          this.orderMode = value as StudyOrderMode;
          await this.reloadCards();
        });
      });

    new Setting(filterGroup)
      .setName(REVIEW_COPY.study.onlyMistakesLabel)
      .addToggle((toggle) => toggle.setValue(this.includeMistakeBookOnly).onChange(async (value) => {
        this.includeMistakeBookOnly = value;
        await this.reloadCards();
      }));

    new Setting(filterGroup)
      .setName(REVIEW_COPY.study.excludeMasteredLabel)
      .addToggle((toggle) => toggle.setValue(this.excludeMastered).onChange(async (value) => {
        this.excludeMastered = value;
        await this.reloadCards();
      }));

    new ButtonComponent(utilityGroup)
      .setButtonText(REVIEW_COPY.buttons.refreshQueue)
      .onClick(async () => {
        await this.reloadCards();
        new Notice(REVIEW_COPY.notices.refreshed);
      });

    new ButtonComponent(utilityGroup)
      .setButtonText(REVIEW_COPY.buttons.clearMasteredMistakes)
      .onClick(async () => await this.clearMasteredMistakeCards());

    new ButtonComponent(generateGroup)
      .setButtonText(REVIEW_COPY.buttons.generateCurrentNote)
      .onClick(async () => await this.generateForCurrentNote())
      .buttonEl.addClass("mod-cta", "note-flashcards-toolbar-primary");

    new ButtonComponent(generateGroup)
      .setButtonText(REVIEW_COPY.buttons.generateCurrentFolder)
      .onClick(async () => await this.generateForCurrentFolder())
      .buttonEl.addClass("note-flashcards-toolbar-primary");
  }

  private renderMeta(contentEl: HTMLElement, display: StudyDisplayState): void {
    contentEl.createDiv({ cls: "note-flashcards-meta", text: display.selectionSummary });

    const statsEl = contentEl.createDiv({ cls: "note-flashcards-stats" });
    display.stats.forEach((stat) => {
      const statEl = statsEl.createDiv({ cls: ["note-flashcards-stat", stat.className].filter(Boolean).join(" ") });
      statEl.createDiv({ cls: "note-flashcards-stat-label", text: stat.label });
      statEl.createDiv({ cls: "note-flashcards-stat-value", text: stat.value });
    });

    contentEl.createDiv({ cls: "note-flashcards-meta", text: `${this.selectedCount} / ${this.totalCards}` });
  }

  private renderCard(contentEl: HTMLElement, cardView: StudyCardViewModel): void {
    const cardEl = contentEl.createDiv({ cls: "note-flashcards-card" });
    cardEl.onClickEvent(() => this.toggleCardFace());

    cardEl.createDiv({ cls: "note-flashcards-card-title", text: cardView.title });
    cardEl.createDiv({ cls: "note-flashcards-card-content", text: cardView.content });
    contentEl.createDiv({ cls: "note-flashcards-meta", text: cardView.meta });
  }

  private renderMistakeTopicSection(contentEl: HTMLElement, card: Flashcard): void {
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
      section.createDiv({ cls: "note-flashcards-mistake-topic-topic", text: `${REVIEW_COPY.mistakeTopic.topicLabel}：${topic}` });
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
    const button = new ButtonComponent(actions)
      .setButtonText(this.isGeneratingMistakeTopic ? REVIEW_COPY.mistakeTopic.generatingButton : REVIEW_COPY.mistakeTopic.generateButton)
      .onClick(async () => await this.generateByMistakeTopic(card));
    button.buttonEl.addClass("mod-cta");
    if (this.isGeneratingMistakeTopic) {
      button.buttonEl.addClass("is-disabled");
    }
  }

  private renderActions(contentEl: HTMLElement, card: Flashcard, cardView: StudyCardViewModel): void {
    const actions = contentEl.createDiv({ cls: "note-flashcards-actions" });
    new ButtonComponent(actions)
      .setButtonText(cardView.flipButtonLabel)
      .onClick(() => this.toggleCardFace())
      .buttonEl.addClass("mod-cta");

    new ButtonComponent(actions)
      .setButtonText(REVIEW_COPY.buttons.openSource)
      .onClick(async () => await this.openSourceNote(card));

    new ButtonComponent(actions)
      .setButtonText(cardView.mistakeToggleLabel)
      .onClick(async () => await this.toggleMistakeBook(card))
      .buttonEl.addClass(cardView.mistakeToggleClass);

    new ButtonComponent(actions)
      .setButtonText(cardView.masteredToggleLabel)
      .onClick(async () => await this.toggleMastered(card))
      .buttonEl.addClass(cardView.masteredToggleClass);
  }

  private renderNavigation(contentEl: HTMLElement, display: StudyDisplayState): void {
    if (!display.navigationLabel) {
      return;
    }

    const nav = contentEl.createDiv({ cls: "note-flashcards-nav" });
    nav.createDiv({ cls: "note-flashcards-nav-label", text: display.navigationLabel });
    new ButtonComponent(nav)
      .setButtonText(REVIEW_COPY.buttons.previous)
      .onClick(() => this.showPrevious());
    new ButtonComponent(nav)
      .setButtonText(REVIEW_COPY.buttons.next)
      .onClick(() => this.showNext());
  }

  private render(): void {
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
}
