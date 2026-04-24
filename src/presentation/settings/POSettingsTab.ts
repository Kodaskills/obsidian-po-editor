import { type App, PluginSettingTab, Setting } from "obsidian";

import type POEditorPlugin from "@/main";

export interface CustomAction {
  id: string;
  label: string;
  flag?: string;
  comment?: string;
  color?: string;
}

export interface POEditorSettings {
  defaultLanguage: string;
  outputDirectory: string;
  showComments: boolean;
  preserveComments: boolean;
  preserveFlags: boolean;
  preserveReferences: boolean;
  autoValidate: boolean;
  strictMode: boolean;
  showLineNumbers: boolean;
  keyMapping: Record<string, string>;
  quickActions: CustomAction[];
  projectModeFolders: Record<string, boolean>;
  projectSourceLanguages: Record<string, string>;
  placeholderPatterns: string[];
}

export const DEFAULT_SETTINGS: POEditorSettings = {
  defaultLanguage: "en",
  outputDirectory: "/",
  showComments: true,
  preserveComments: true,
  preserveFlags: true,
  preserveReferences: true,
  autoValidate: false,
  strictMode: false,
  showLineNumbers: true,
  keyMapping: {},
  quickActions: [],
  projectModeFolders: {},
  projectSourceLanguages: {},
  placeholderPatterns: [
    "%\\(\\w+\\)[sdifgexXo%]",
    "%\\d+\\$[-+#0 ]*(?:\\d+)?(?:\\.\\d+)?[sdifgexXo]",
    "%[-+#0 ]*(?:\\d+)?(?:\\.\\d+)?[sdifgexXo%]",
  ],
};

export class POSettingsTab extends PluginSettingTab {
  plugin: POEditorPlugin;

  constructor(app: App, plugin: POEditorPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  getAdaptiveColor(index: number, isDarkMode: boolean): string {
    const hue = (index * 137.5) % 360;
    const lightness = isDarkMode ? 65 : 45;
    return `hsl(${hue}, 75%, ${lightness}%)`;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "PO Editor Settings" });

    new Setting(containerEl).setName("Default Language").addText((text) =>
      text.setValue(this.plugin.settings.defaultLanguage).onChange(async (value) => {
        this.plugin.settings.defaultLanguage = value || "en";
        await this.plugin.saveSettings();
      }),
    );

    containerEl.createEl("h3", { text: "Quick Actions (Tags)" });
    containerEl.createEl("p", {
      text: "Configure buttons to quickly toggle flags (#,) or set translator comments (#).",
      cls: "setting-item-description",
    });

    this.plugin.settings.quickActions.forEach((action: CustomAction, index: number) => {
      const s = new Setting(containerEl)
        .addText((text) =>
          text
            .setPlaceholder("Label")
            .setValue(action.label)
            .onChange(async (v) => {
              this.plugin.settings.quickActions[index] = { ...action, label: v };
              await this.plugin.saveSettings();
            }),
        )
        .addText((text) =>
          text
            .setPlaceholder("Flag (#,)")
            .setValue(action.flag || "")
            .onChange(async (v) => {
              this.plugin.settings.quickActions[index] = { ...action, flag: v || undefined };
              await this.plugin.saveSettings();
            }),
        )
        .addText((text) =>
          text
            .setPlaceholder("Comment (#)")
            .setValue(action.comment || "")
            .onChange(async (v) => {
              this.plugin.settings.quickActions[index] = { ...action, comment: v || undefined };
              await this.plugin.saveSettings();
            }),
        )
        .addColorPicker((cp) =>
          cp.setValue(action.color || "#cccccc").onChange(async (v) => {
            this.plugin.settings.quickActions[index] = { ...action, color: v };
            await this.plugin.saveSettings();
          }),
        )
        .addExtraButton((btn) =>
          btn
            .setIcon("trash")
            .setTooltip("Remove Action")
            .onClick(async () => {
              this.plugin.settings.quickActions = this.plugin.settings.quickActions.filter(
                (_: CustomAction, i: number) => i !== index,
              );
              await this.plugin.saveSettings();
              this.display();
            }),
        );

      s.infoEl.remove();
    });

    new Setting(containerEl).addButton((btn) =>
      btn
        .setButtonText("Add Quick Action")
        .setCta()
        .onClick(async () => {
          this.plugin.settings.quickActions.push({
            id: Date.now().toString(),
            label: "New",
            color: this.getAdaptiveColor(
              this.plugin.settings.quickActions.length,
              this.app.isDarkMode(),
            ),
          });
          await this.plugin.saveSettings();
          this.display();
        }),
    );

    containerEl.createEl("h3", { text: "Placeholder Patterns" });
    containerEl.createEl("p", {
      text: "JavaScript regex patterns used to detect format placeholders in source strings (e.g. %s, %1$s, %(key)s). Detected placeholders appear as clickable chips in translation cells.",
      cls: "setting-item-description",
    });

    this.plugin.settings.placeholderPatterns.forEach((pattern: string, index: number) => {
      const s = new Setting(containerEl)
        .addText((text) =>
          text
            .setPlaceholder("Regex pattern")
            .setValue(pattern)
            .onChange(async (v) => {
              this.plugin.settings.placeholderPatterns[index] = v;
              await this.plugin.saveSettings();
            }),
        )
        .addExtraButton((btn) =>
          btn
            .setIcon("trash")
            .setTooltip("Remove Pattern")
            .onClick(async () => {
              this.plugin.settings.placeholderPatterns =
                this.plugin.settings.placeholderPatterns.filter(
                  (_: string, i: number) => i !== index,
                );
              await this.plugin.saveSettings();
              this.display();
            }),
        );
      s.infoEl.remove();
    });

    new Setting(containerEl).addButton((btn) =>
      btn.setButtonText("Add Pattern").onClick(async () => {
        this.plugin.settings.placeholderPatterns.push("");
        await this.plugin.saveSettings();
        this.display();
      }),
    );
  }
}
