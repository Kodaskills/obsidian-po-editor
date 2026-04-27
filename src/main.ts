import {
  ConvertFromFormatUseCase,
  ConvertToFormatUseCase,
  CreatePOUseCase,
  type FilePort,
  type NotificationPort,
  ParsePOUseCase,
  ValidatePOUseCase,
  type ViewPort,
} from "@application/index";
import { createPOFile } from "@domain/index";
import {
  ARBConverter,
  ARBEnhancedConverter,
  ICUConverter,
  JsonConverter,
  ObsidianFileAdapter,
  POConverter,
  XLIFFConverter,
  YamlConverter,
} from "@infrastructure/index";
import {
  CreatePOCommand,
  CreatePOModal,
  DEFAULT_SETTINGS,
  MarkFuzzyCommand,
  ObsidianNotificationAdapter,
  ObsidianViewAdapter,
  type POEditorSettings,
  PO_STATS_VIEW_TYPE,
  POSettingsTab,
  POStatsView,
  POView,
  UnmarkFuzzyCommand,
  ValidatePOCommand,
} from "@presentation/index";
import { Plugin, TFile, TFolder } from "obsidian";

export default class POEditorPlugin extends Plugin {
  settings!: POEditorSettings;

  private fileAdapter!: FilePort;
  private notificationAdapter!: NotificationPort;
  private viewAdapter!: ViewPort;
  private poConverter!: POConverter;
  private createPOUseCase!: CreatePOUseCase;
  private parsePOUseCase!: ParsePOUseCase;
  private validatePOUseCase!: ValidatePOUseCase;
  private convertToFormatUseCase!: ConvertToFormatUseCase;
  private convertFromFormatUseCase!: ConvertFromFormatUseCase;

  async onload() {
    await this.loadSettings();

    this.fileAdapter = new ObsidianFileAdapter(this.app);
    this.notificationAdapter = new ObsidianNotificationAdapter();
    this.viewAdapter = new ObsidianViewAdapter(this.app);
    this.poConverter = new POConverter();
    this.createPOUseCase = new CreatePOUseCase();
    this.parsePOUseCase = new ParsePOUseCase();
    this.validatePOUseCase = new ValidatePOUseCase();

    const allConverters = [
      this.poConverter,
      new XLIFFConverter(),
      new ARBConverter(),
      new ARBEnhancedConverter(),
      new JsonConverter(),
      new YamlConverter(),
      new ICUConverter(),
    ];
    this.convertToFormatUseCase = new ConvertToFormatUseCase(allConverters);
    this.convertFromFormatUseCase = new ConvertFromFormatUseCase(allConverters);

    this.registerView(
      "po-view",
      (leaf) =>
        new POView(leaf, this, this.poConverter, this.parsePOUseCase, this.convertToFormatUseCase),
    );

    this.registerView(PO_STATS_VIEW_TYPE, (leaf) => new POStatsView(leaf));

    this.registerExtensions(["po", "pot"], "po-view");

    this.addSettingTab(new POSettingsTab(this.app, this));

    this.registerCommands();

    this.addRibbonIcon("languages", "Create new PO file", () => {
      this.showCreateModal();
    });

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, abstractFile) => {
        const path =
          abstractFile instanceof TFolder ? abstractFile.path : abstractFile.parent?.path;
        menu.addItem((item) => {
          item
            .setTitle("New PO File")
            .setIcon("languages")
            .onClick(() => {
              this.showCreateModal(path);
            });
        });
      }),
    );
  }

  async openStatsPanel(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(PO_STATS_VIEW_TYPE);
    let leaf = existing[0];
    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false) ?? this.app.workspace.getLeaf("split");
      await leaf.setViewState({ type: PO_STATS_VIEW_TYPE, active: true });
    }
    this.app.workspace.revealLeaf(leaf);
  }

  onCreate() {
    if (!this.app.workspace.layoutReady) {
      // Workspace is still loading, do nothing
      return;
    }
  }

  private async showCreateModal(folderPath?: string) {
    const command = new CreatePOCommand({
      filePort: this.fileAdapter,
      notificationPort: this.notificationAdapter,
      viewPort: this.viewAdapter,
      poConverter: this.poConverter,
      outputDirectory: this.settings.outputDirectory,
      createPOFile: createPOFile,
      createPOUseCase: this.createPOUseCase,
      parsePOUseCase: this.parsePOUseCase,
    });

    // Get POT files from the folder (if provided) for better performance
    // Potentially large folders can slow down the modal
    // Give to the user the recommended tips to avoid this
    // (creating on a small directory, small vault, or using  ribbon action and sync after)
    const potFiles = folderPath ? await this.fileAdapter.findByExtension("pot", folderPath) : [];

    const modal = new CreatePOModal(this.app, potFiles, async (options) => {
      await command.execute(options);
    });
    modal.open();
  }

  private registerCommands() {
    this.addCommand({
      id: "po-create",
      name: "Create PO File",
      callback: async () => await this.showCreateModal(),
    });

    this.addCommand({
      id: "po-validate",
      name: "Validate PO File",
      callback: async () => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "po") {
          this.notificationAdapter.info("Open a .po file first");
          return;
        }
        const command = new ValidatePOCommand(
          this.app,
          this.validatePOUseCase,
          this.parsePOUseCase,
          this.poConverter,
        );
        await command.execute();
      },
    });

    this.addCommand({
      id: "po-view-active",
      name: "View Active PO File",
      callback: async () => {
        const file = this.fileAdapter.getActiveFile();
        if (!file || file.extension !== "po") {
          this.notificationAdapter.info("Open a .po file first");
          return;
        }
        const leaf = this.app.workspace.getLeaf("tab");
        await leaf.openFile(file as TFile);
      },
    });

    this.addCommand({
      id: "po-stats",
      icon: "languages",
      name: "Open PO Statistics panel",
      callback: async () => await this.openStatsPanel(),
    });

    this.addCommand({
      id: "po-mark-fuzzy",
      name: "Mark entry as fuzzy",
      callback: async () => {
        const cmd = new MarkFuzzyCommand(this.app, this.parsePOUseCase, this.poConverter);
        await cmd.execute();
      },
    });

    this.addCommand({
      id: "po-unmark-fuzzy",
      name: "Unmark entry as fuzzy",
      callback: async () => {
        const cmd = new UnmarkFuzzyCommand(this.app, this.parsePOUseCase, this.poConverter);
        await cmd.execute();
      },
    });
  }

  async loadSettings() {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) };
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
