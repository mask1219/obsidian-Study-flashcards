import { App, PluginSettingTab, Setting } from "obsidian";
import type NoteFlashcardsPlugin from "../main";
import {
  getGeneratorModeOptions,
  parseNonNegativeInteger,
  parsePositiveInteger,
  parsePositiveIntegerList,
  parseStringList,
  SETTINGS_COPY,
  updateSetting
} from "./settingsState";

export class NoteFlashcardsSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: NoteFlashcardsPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

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
          this.display();
        }));
  }
}
