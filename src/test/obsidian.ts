export class Notice {
  constructor(_message: string) {}
}

export class TAbstractFile {
  path = "";
}

export class TFolder extends TAbstractFile {
  parent: TFolder | null = null;
}

export class TFile extends TAbstractFile {
  basename = "";
  parent: TFolder | null = null;
}

export class WorkspaceLeaf {
  view: unknown = null;
  async setViewState(_state: unknown): Promise<void> {}
  async openFile(_file: unknown): Promise<void> {}
}

class ChainableMenuItem {
  setTitle(_title: string): this {
    return this;
  }

  setIcon(_icon: string): this {
    return this;
  }

  onClick(_handler: () => void | Promise<void>): this {
    return this;
  }
}

export class Menu {
  addItem(callback: (item: ChainableMenuItem) => void): void {
    callback(new ChainableMenuItem());
  }
}

export class Plugin {
  app: unknown;
  manifest: unknown;

  constructor(app: unknown, manifest: unknown) {
    this.app = app;
    this.manifest = manifest;
  }

  async loadData(): Promise<unknown> {
    return {};
  }

  async saveData(_data: unknown): Promise<void> {}

  registerView(): void {}
  addSettingTab(): void {}
  addRibbonIcon(): void {}
  registerEvent(): void {}
  addCommand(): void {}
}

export class PluginSettingTab {
  containerEl = {
    empty(): void {}
  };

  constructor(public app: App, public plugin: Plugin) {}
}

export class ItemView {
  app = {
    workspace: {
      getActiveViewOfType: () => null
    }
  };

  constructor(public leaf: WorkspaceLeaf) {}

  getViewType(): string {
    return "";
  }

  getDisplayText(): string {
    return "";
  }
}

export class ButtonComponent {
  setButtonText(_text: string): this {
    return this;
  }

  setWarning(): this {
    return this;
  }

  onClick(_handler: () => void | Promise<void>): this {
    return this;
  }
}
export class Setting {
  constructor(_containerEl: unknown) {}

  setName(_name: string): this {
    return this;
  }

  setDesc(_desc: string): this {
    return this;
  }

  addText(_callback: (text: { setPlaceholder: (value: string) => unknown; setValue: (value: string) => unknown; onChange: (handler: (value: string) => void | Promise<void>) => unknown }) => void): this {
    return this;
  }

  addTextArea(_callback: (text: { setPlaceholder: (value: string) => unknown; setValue: (value: string) => unknown; onChange: (handler: (value: string) => void | Promise<void>) => unknown }) => void): this {
    return this;
  }

  addDropdown(_callback: (dropdown: { addOption: (value: string, label: string) => unknown; setValue: (value: string) => unknown; onChange: (handler: (value: string) => void | Promise<void>) => unknown }) => void): this {
    return this;
  }

  addToggle(_callback: (toggle: { setValue: (value: boolean) => unknown; onChange: (handler: (value: boolean) => void | Promise<void>) => unknown }) => void): this {
    return this;
  }

  addButton(_callback: (button: ButtonComponent) => void): this {
    return this;
  }
}

export type App = {
  workspace: {
    getActiveFile?: () => TFile | null;
    getLeavesOfType?: (_type: string) => WorkspaceLeaf[];
    getRightLeaf?: (_split: boolean) => WorkspaceLeaf | null;
    revealLeaf?: (_leaf: WorkspaceLeaf) => void;
    detachLeavesOfType?: (_type: string) => void;
    on?: (..._args: unknown[]) => unknown;
  };
  vault?: unknown;
};
export type Editor = unknown;
export type MarkdownFileInfo = { file?: TFile | null };
export type PluginManifest = unknown;
export type Vault = unknown;
