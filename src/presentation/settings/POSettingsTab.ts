import type {
  EditorPanelPosition,
  EditorPanelState,
  FileEditorState,
} from "@presentation/views/po/POViewTypes";
import { POView } from "@presentation/views/POView";
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
  outputDirectory: string;
  showComments: boolean;
  preserveComments: boolean;
  preserveFlags: boolean;
  preserveReferences: boolean;
  autoValidate: boolean;
  strictMode: boolean;
  promptHeaderFix: boolean;
  showLineNumbers: boolean;
  keyMapping: Record<string, string>;
  quickActions: CustomAction[];
  projectSourceLanguages: Record<string, string>;
  placeholderPatterns: string[];
  editorPanelPosition: EditorPanelPosition;
  editorPanelState: EditorPanelState;
  editorPanelHeightPercent: number;
  fileEditorStates: Record<string, FileEditorState>;
  sourceEditable: boolean;
}

export const DEFAULT_SETTINGS: POEditorSettings = {
  outputDirectory: "/",
  showComments: true,
  preserveComments: true,
  preserveFlags: true,
  preserveReferences: true,
  autoValidate: false,
  strictMode: false,
  promptHeaderFix: true,
  showLineNumbers: true,
  keyMapping: {},
  quickActions: [],
  projectSourceLanguages: {},
  placeholderPatterns: [
    "%\\(\\w+\\)[sdifgexXo%]",
    "%\\d+$[-+#0 ]*(?:\\d+)?(?:\\.\\d+)?[sdifgexXo]",
    "%[-+#0 ]*(?:\\d+)?(?:\\.\\d+)?[sdifgexXo%]",
  ],
  editorPanelPosition: "bottom",
  editorPanelState: "closed",
  editorPanelHeightPercent: 42,
  fileEditorStates: {},
  sourceEditable: false,
};

export class POSettingsTab extends PluginSettingTab {
  plugin: POEditorPlugin;

  constructor(app: App, plugin: POEditorPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  private refreshQuickActions(): void {
    this.plugin.app.workspace.getLeavesOfType("po-view").forEach((leaf) => {
      if (leaf.view instanceof POView) leaf.view.render();
    });
  }

  getAdaptiveColor(index: number, isDarkMode: boolean): string {
    const hue = (index * 137.5) % 360;
    const lightness = isDarkMode ? 65 : 45;
    return `hsl(${hue}, 75%, ${lightness}%)`;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Editor panel position")
      .setDesc("Choose where the editor panel should be placed relative to the entry list.")
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({
            bottom: "Bottom",
            top: "Top",
            left: "Left",
            right: "Right",
          })
          .setValue(this.plugin.settings.editorPanelPosition)
          .onChange(async (value) => {
            this.plugin.settings.editorPanelPosition = value as EditorPanelPosition;
            await this.plugin.saveSettings();
            this.plugin.app.workspace.getLeavesOfType("po-view").forEach((leaf) => {
              if (leaf.view instanceof POView) leaf.view.render();
            });
          }),
      );

    new Setting(containerEl)
      .setName("Prompt for header fix")
      .setDesc(
        "Automatically check for missing or incorrect headers (language, plural-forms) when opening a PO file and prompt for a fix.",
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.promptHeaderFix).onChange(async (value) => {
          this.plugin.settings.promptHeaderFix = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Editable source text")
      .setDesc(
        "Allow double-click editing of msgid, msgctxt, and msgid_plural fields. When disabled, source fields are read-only.",
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.sourceEditable).onChange(async (value) => {
          this.plugin.settings.sourceEditable = value;
          await this.plugin.saveSettings();
          this.plugin.app.workspace.getLeavesOfType("po-view").forEach((leaf) => {
            if (leaf.view instanceof POView) leaf.view.render();
          });
        }),
      );

    new Setting(containerEl).setName("Quick actions (tags)").setHeading();
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
              this.refreshQuickActions();
            }),
        )
        .addText((text) =>
          text
            .setPlaceholder("Flag (#,)")
            .setValue(action.flag || "")
            .onChange(async (v) => {
              this.plugin.settings.quickActions[index] = { ...action, flag: v || undefined };
              await this.plugin.saveSettings();
              this.refreshQuickActions();
            }),
        )
        .addText((text) =>
          text
            .setPlaceholder("Comment (#)")
            .setValue(action.comment || "")
            .onChange(async (v) => {
              this.plugin.settings.quickActions[index] = { ...action, comment: v || undefined };
              await this.plugin.saveSettings();
              this.refreshQuickActions();
            }),
        )
        .addColorPicker((cp) =>
          cp.setValue(action.color || "#cccccc").onChange(async (v) => {
            this.plugin.settings.quickActions[index] = { ...action, color: v };
            await this.plugin.saveSettings();
            this.refreshQuickActions();
          }),
        )
        .addExtraButton((btn) =>
          btn
            .setIcon("trash")
            .setTooltip("Remove action")
            .onClick(async () => {
              this.plugin.settings.quickActions = this.plugin.settings.quickActions.filter(
                (_: CustomAction, i: number) => i !== index,
              );
              await this.plugin.saveSettings();
              this.refreshQuickActions();
              this.display();
            }),
        );

      s.infoEl.remove();
    });

    new Setting(containerEl).addButton((btn) =>
      btn
        .setButtonText("Add quick action")
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
          this.refreshQuickActions();
          this.display();
        }),
    );

    new Setting(containerEl).setName("Placeholder patterns").setHeading();
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
            .setTooltip("Remove pattern")
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
      btn.setButtonText("Add pattern").onClick(async () => {
        this.plugin.settings.placeholderPatterns.push("");
        await this.plugin.saveSettings();
        this.display();
      }),
    );
  }
}
