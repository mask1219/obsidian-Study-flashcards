import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type NoteFlashcardsPlugin from "../main";
import {
  AI_MODEL_ERRORS,
  createAiModelConfig,
  duplicateModelConfig,
  moveModelConfig,
  validateModelConfigForRequest,
  validateModelConfigForSave
} from "./aiModelState";
import { testAiConnection } from "./aiGenerator";
import {
  getAiProviderOptions,
  getDefaultAiApiUrl,
  getGeneratorModeOptions,
  parseNonNegativeInteger,
  parsePositiveInteger,
  parsePositiveIntegerList,
  parseStringList,
  SETTINGS_COPY,
  updateSetting
} from "./settingsState";
import type { AiModelConfig, AiProvider } from "./types";

function getProviderLabel(provider: AiProvider): string {
  const option = getAiProviderOptions().find((item) => item.value === provider);
  return option?.label ?? provider;
}

export class NoteFlashcardsSettingTab extends PluginSettingTab {
  private draftModel: AiModelConfig | null = null;
  private editingModelId: string | null = null;

  constructor(app: App, private readonly plugin: NoteFlashcardsPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    this.ensureDraftIsValid();

    new Setting(containerEl)
      .setName(SETTINGS_COPY.generatorMode.name)
      .setDesc(SETTINGS_COPY.generatorMode.description)
      .addDropdown((dropdown) => {
        for (const option of getGeneratorModeOptions()) {
          dropdown.addOption(option.value, option.label);
        }
        dropdown
          .setValue(this.plugin.settings.generatorMode)
          .onChange(async (value) => {
            await updateSetting(this.plugin.settings, "generatorMode", value as typeof this.plugin.settings.generatorMode, async () => this.plugin.saveSettings());
          });
      });

    new Setting(containerEl)
      .setName(SETTINGS_COPY.maxCardsPerNote.name)
      .setDesc(SETTINGS_COPY.maxCardsPerNote.description)
      .addText((text) => text
        .setPlaceholder(SETTINGS_COPY.maxCardsPerNote.placeholder)
        .setValue(String(this.plugin.settings.maxCardsPerNote))
        .onChange(async (value) => {
          const parsed = parsePositiveInteger(value);
          if (parsed !== null) {
            await updateSetting(this.plugin.settings, "maxCardsPerNote", parsed, async () => this.plugin.saveSettings());
          }
        }));

    this.renderAiModelsSection(containerEl);

    new Setting(containerEl)
      .setName(SETTINGS_COPY.summaryLength.name)
      .setDesc(SETTINGS_COPY.summaryLength.description)
      .addText((text) => text
        .setPlaceholder(SETTINGS_COPY.summaryLength.placeholder)
        .setValue(String(this.plugin.settings.summaryLength))
        .onChange(async (value) => {
          const parsed = parsePositiveInteger(value);
          if (parsed !== null) {
            await updateSetting(this.plugin.settings, "summaryLength", parsed, async () => this.plugin.saveSettings());
          }
        }));

    new Setting(containerEl)
      .setName(SETTINGS_COPY.newCardsPerDay.name)
      .setDesc(SETTINGS_COPY.newCardsPerDay.description)
      .addText((text) => text
        .setPlaceholder(SETTINGS_COPY.newCardsPerDay.placeholder)
        .setValue(String(this.plugin.settings.newCardsPerDay))
        .onChange(async (value) => {
          const parsed = parseNonNegativeInteger(value);
          if (parsed !== null) {
            await updateSetting(this.plugin.settings, "newCardsPerDay", parsed, async () => this.plugin.saveSettings());
          }
        }));

    new Setting(containerEl)
      .setName(SETTINGS_COPY.learningStepsMinutes.name)
      .setDesc(SETTINGS_COPY.learningStepsMinutes.description)
      .addText((text) => text
        .setPlaceholder(SETTINGS_COPY.learningStepsMinutes.placeholder)
        .setValue(this.plugin.settings.learningStepsMinutes.join(","))
        .onChange(async (value) => {
          const steps = parsePositiveIntegerList(value);
          if (steps.length > 0) {
            await updateSetting(this.plugin.settings, "learningStepsMinutes", steps, async () => this.plugin.saveSettings());
          }
        }));

    new Setting(containerEl)
      .setName(SETTINGS_COPY.graduatingIntervalDays.name)
      .setDesc(SETTINGS_COPY.graduatingIntervalDays.description)
      .addText((text) => text
        .setPlaceholder(SETTINGS_COPY.graduatingIntervalDays.placeholder)
        .setValue(String(this.plugin.settings.graduatingIntervalDays))
        .onChange(async (value) => {
          const parsed = parsePositiveInteger(value);
          if (parsed !== null) {
            await updateSetting(this.plugin.settings, "graduatingIntervalDays", parsed, async () => this.plugin.saveSettings());
          }
        }));

    new Setting(containerEl)
      .setName(SETTINGS_COPY.easyIntervalDays.name)
      .setDesc(SETTINGS_COPY.easyIntervalDays.description)
      .addText((text) => text
        .setPlaceholder(SETTINGS_COPY.easyIntervalDays.placeholder)
        .setValue(String(this.plugin.settings.easyIntervalDays))
        .onChange(async (value) => {
          const parsed = parsePositiveInteger(value);
          if (parsed !== null) {
            await updateSetting(this.plugin.settings, "easyIntervalDays", parsed, async () => this.plugin.saveSettings());
          }
        }));

    new Setting(containerEl)
      .setName(SETTINGS_COPY.showAllCardsInReview.name)
      .setDesc(SETTINGS_COPY.showAllCardsInReview.description)
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.showAllCardsInReview)
        .onChange(async (value) => {
          await updateSetting(this.plugin.settings, "showAllCardsInReview", value, async () => this.plugin.saveSettings());
        }));

    new Setting(containerEl)
      .setName(SETTINGS_COPY.ignoredFolders.name)
      .setDesc(SETTINGS_COPY.ignoredFolders.description)
      .addTextArea((text) => text
        .setPlaceholder(SETTINGS_COPY.ignoredFolders.placeholder)
        .setValue(this.plugin.settings.ignoredFolders.join(","))
        .onChange(async (value) => {
          await updateSetting(this.plugin.settings, "ignoredFolders", parseStringList(value), async () => this.plugin.saveSettings());
        }));

    new Setting(containerEl)
      .setName(SETTINGS_COPY.resetCards.name)
      .setDesc(SETTINGS_COPY.resetCards.description)
      .addButton((button) => button
        .setButtonText(SETTINGS_COPY.resetCards.name)
        .setWarning()
        .onClick(async () => {
          await this.plugin.resetAllCards();
        }));

    new Setting(containerEl)
      .setName(SETTINGS_COPY.resetSettings.name)
      .setDesc(SETTINGS_COPY.resetSettings.description)
      .addButton((button) => button
        .setButtonText(SETTINGS_COPY.resetSettings.name)
        .onClick(async () => {
          await this.plugin.resetSettingsToDefault();
          this.clearDraft();
          this.display();
        }));
  }

  private renderAiModelsSection(containerEl: HTMLElement): void {
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

    new Setting(bodyEl)
      .setName(SETTINGS_COPY.activeAiModel.name)
      .setDesc(SETTINGS_COPY.activeAiModel.description)
      .addDropdown((dropdown) => {
        dropdown.addOption("", SETTINGS_COPY.activeAiModel.placeholder);
        for (const config of this.plugin.settings.aiModelConfigs) {
          dropdown.addOption(config.id, config.name || "未命名配置");
        }
        dropdown
          .setValue(this.plugin.settings.activeAiModelId)
          .onChange(async (value) => {
            this.plugin.settings.activeAiModelId = value;
            await this.plugin.saveSettings();
            this.display();
          });
      });

    new Setting(bodyEl)
      .setName(SETTINGS_COPY.aiModelsSection.addButton)
      .addButton((button) => button
        .setButtonText(SETTINGS_COPY.aiModelsSection.addButton)
        .onClick(() => {
          this.editingModelId = null;
          this.draftModel = createAiModelConfig();
          this.display();
        }));

    this.renderModelRows(bodyEl);
    this.renderModelEditor(bodyEl);
  }

  private renderModelRows(containerEl: HTMLElement): void {
    const listEl = containerEl.createDiv({ cls: "note-flashcards-ai-list" });

    if (this.plugin.settings.aiModelConfigs.length === 0) {
      listEl.createEl("p", {
        cls: "note-flashcards-ai-empty",
        text: AI_MODEL_ERRORS.noConfigs
      });
      return;
    }

    for (const [index, config] of this.plugin.settings.aiModelConfigs.entries()) {
      const setting = new Setting(listEl)
        .setName(config.name || "未命名配置")
        .setDesc(`${getProviderLabel(config.provider)} · ${config.model || "未填写模型名"}`);

      setting.settingEl.addClass("note-flashcards-ai-model-row");
      if (this.plugin.settings.activeAiModelId === config.id) {
        setting.nameEl.createSpan({ cls: "note-flashcards-ai-default-tag", text: SETTINGS_COPY.aiModelActions.defaultTag });
      }

      setting.addButton((button) => button
        .setButtonText(SETTINGS_COPY.aiModelActions.edit)
        .onClick(() => {
          this.editingModelId = config.id;
          this.draftModel = { ...config };
          this.display();
        }));

      setting.addButton((button) => button
        .setButtonText(SETTINGS_COPY.aiModelActions.copy)
        .onClick(async () => {
          const next = duplicateModelConfig(config, this.plugin.settings.aiModelConfigs.map((item) => item.name));
          this.plugin.settings.aiModelConfigs = [...this.plugin.settings.aiModelConfigs, next];
          await this.plugin.saveSettings();
          this.display();
        }));

      setting.addButton((button) => button
        .setButtonText(SETTINGS_COPY.aiModelActions.setDefault)
        .onClick(async () => {
          this.plugin.settings.activeAiModelId = config.id;
          await this.plugin.saveSettings();
          this.display();
        }));

      setting.addButton((button) => button
        .setButtonText(SETTINGS_COPY.aiModelActions.moveUp)
        .setDisabled(index === 0)
        .onClick(async () => {
          this.plugin.settings.aiModelConfigs = moveModelConfig(this.plugin.settings.aiModelConfigs, index, index - 1);
          await this.plugin.saveSettings();
          this.display();
        }));

      setting.addButton((button) => button
        .setButtonText(SETTINGS_COPY.aiModelActions.moveDown)
        .setDisabled(index === this.plugin.settings.aiModelConfigs.length - 1)
        .onClick(async () => {
          this.plugin.settings.aiModelConfigs = moveModelConfig(this.plugin.settings.aiModelConfigs, index, index + 1);
          await this.plugin.saveSettings();
          this.display();
        }));

      setting.addButton((button) => button
        .setButtonText(SETTINGS_COPY.aiModelActions.remove)
        .setWarning()
        .onClick(async () => {
          const wasActive = this.plugin.settings.activeAiModelId === config.id;
          this.plugin.settings.aiModelConfigs = this.plugin.settings.aiModelConfigs.filter((item) => item.id !== config.id);

          if (wasActive) {
            this.plugin.settings.activeAiModelId = "";
            if (this.plugin.settings.aiModelConfigs.length > 0) {
              new Notice("已删除当前生效模型，请重新选择当前生效模型。");
            } else {
              new Notice("模型配置已清空，AI 与混合模式当前不可用。");
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

  private renderModelEditor(containerEl: HTMLElement): void {
    if (!this.draftModel) {
      return;
    }
    const draftModel = this.draftModel;

    const editorEl = containerEl.createDiv({ cls: "note-flashcards-ai-editor" });
    new Setting(editorEl).setName("模型配置编辑").setHeading();

    new Setting(editorEl)
      .setName(SETTINGS_COPY.aiModelName.name)
      .addText((text) => text
        .setPlaceholder(SETTINGS_COPY.aiModelName.placeholder)
        .setValue(draftModel.name)
        .onChange((value) => {
          if (this.draftModel) {
            this.draftModel.name = value;
          }
        }));

    new Setting(editorEl)
      .setName(SETTINGS_COPY.aiProvider.name)
      .setDesc(SETTINGS_COPY.aiProvider.description)
      .addDropdown((dropdown) => {
        for (const option of getAiProviderOptions()) {
          dropdown.addOption(option.value, option.label);
        }
        dropdown
          .setValue(draftModel.provider)
          .onChange((value) => {
            if (!this.draftModel) {
              return;
            }
            const nextProvider = value as AiProvider;
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

    new Setting(editorEl)
      .setName(SETTINGS_COPY.aiApiUrl.name)
      .setDesc(SETTINGS_COPY.aiApiUrl.description)
      .addText((text) => text
        .setPlaceholder(getDefaultAiApiUrl(draftModel.provider))
        .setValue(draftModel.apiUrl)
        .onChange((value) => {
          if (this.draftModel) {
            this.draftModel.apiUrl = value;
          }
        }));

    new Setting(editorEl)
      .setName(SETTINGS_COPY.aiApiKey.name)
      .setDesc(SETTINGS_COPY.aiApiKey.description)
      .addText((text) => text
        .setPlaceholder(SETTINGS_COPY.aiApiKey.placeholder)
        .setValue(draftModel.apiKey)
        .onChange((value) => {
          if (this.draftModel) {
            this.draftModel.apiKey = value;
          }
        }));

    new Setting(editorEl)
      .setName(SETTINGS_COPY.aiModel.name)
      .setDesc(SETTINGS_COPY.aiModel.description)
      .addText((text) => text
        .setPlaceholder(SETTINGS_COPY.aiModel.placeholder)
        .setValue(draftModel.model)
        .onChange((value) => {
          if (this.draftModel) {
            this.draftModel.model = value;
          }
        }));

    new Setting(editorEl)
      .setName(SETTINGS_COPY.aiPrompt.name)
      .setDesc(SETTINGS_COPY.aiPrompt.description)
      .addTextArea((text) => text
        .setPlaceholder(SETTINGS_COPY.aiPrompt.placeholder)
        .setValue(draftModel.prompt)
        .onChange((value) => {
          if (this.draftModel) {
            this.draftModel.prompt = value;
          }
        }));

    new Setting(editorEl)
      .setName(SETTINGS_COPY.aiModelActions.save)
      .addButton((button) => button
        .setButtonText(SETTINGS_COPY.aiModelActions.save)
        .setCta()
        .onClick(async () => {
          const draft = this.getNormalizedDraftModel();
          if (!draft) {
            return;
          }

          const validationError = validateModelConfigForSave(draft);
          if (validationError) {
            new Notice(validationError);
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
        }))
      .addButton((button) => button
        .setButtonText(SETTINGS_COPY.aiConnectionTest.button)
        .onClick(async () => {
          const draft = this.getNormalizedDraftModel();
          if (!draft) {
            return;
          }

          const validationError = validateModelConfigForRequest(draft);
          if (validationError) {
            new Notice(validationError);
            return;
          }

          try {
            await testAiConnection(draft);
            new Notice(SETTINGS_COPY.aiConnectionTest.success);
          } catch (error) {
            const detail = error instanceof Error ? error.message : undefined;
            new Notice(SETTINGS_COPY.aiConnectionTest.failed(detail));
          }
        }))
      .addButton((button) => button
        .setButtonText(SETTINGS_COPY.aiModelActions.cancel)
        .onClick(() => {
          this.clearDraft();
          this.display();
        }));
  }

  private getNormalizedDraftModel(): AiModelConfig | null {
    if (!this.draftModel) {
      return null;
    }
    return {
      ...this.draftModel,
      name: this.draftModel.name.trim(),
      apiUrl: this.draftModel.apiUrl.trim(),
      apiKey: this.draftModel.apiKey.trim(),
      model: this.draftModel.model.trim(),
      prompt: this.draftModel.prompt.trim()
    };
  }

  private ensureDraftIsValid(): void {
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

  private clearDraft(): void {
    this.draftModel = null;
    this.editingModelId = null;
  }

  private async handleAiSectionToggle(isOpen: boolean): Promise<void> {
    const nextCollapsed = !isOpen;
    if (nextCollapsed === this.plugin.settings.aiSectionCollapsed) {
      return;
    }
    this.plugin.settings.aiSectionCollapsed = nextCollapsed;
    await this.plugin.saveSettings();
  }
}
