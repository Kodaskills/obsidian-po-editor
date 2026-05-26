import { createPOFile } from "@domain/index";
import { CompositionRoot } from "@infrastructure/index";
import {
  CreatePOCommand,
  CreatePOModal,
  DEFAULT_SETTINGS,
  ToggleFuzzyCommand,
  type POEditorSettings,
  PO_STATS_VIEW_TYPE,
  POSettingsTab,
  POStatsView,
  POView,
  ValidatePOCommand,
  type EditorMode,
} from "@presentation/index";
import { Plugin, setIcon, addIcon, TFile, TFolder } from "obsidian";

export default class POEditorPlugin extends Plugin {
  settings!: POEditorSettings;
  private root!: CompositionRoot;
  private readonly langCache = new Map<string, string>();
  private decorateTimer: ReturnType<typeof window.setTimeout> | null = null;
  private statusBarModeEl: HTMLElement | null = null;

  async onload() {
    await this.loadSettings();
    this.root = new CompositionRoot(this.app);

    addIcon(
      "po",
      `<svg viewBox="0 0 32 32" fill="none">
        <defs>
          <linearGradient id="po-editor-logo-grad" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stop-color="#8b5cf6"/>
            <stop offset="50%" stop-color="#2e9bde"/>
            <stop offset="100%" stop-color="#8b5cf6"/>
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill="url(#po-editor-logo-grad)"/>
        <rect x="2" y="2" width="28" height="28" rx="7" fill="var(--background-primary)"/>
        <text
          x="16" y="16"
          text-anchor="middle"
          dominant-baseline="central"
          font-family="Georgia, 'Times New Roman', serif"
          font-size="16"
          font-weight="600"
          letter-spacing="-0.5"
        ><tspan fill="currentColor">p</tspan><tspan fill="#8b5cf6">o</tspan></text>
      </svg>`,
    );

    this.registerView(
      "po-view",
      (leaf) =>
        new POView(
          leaf,
          this,
          this.root.poViewController,
          this.root.poFileIO,
          this.root.poStateStore,
        ),
    );

    this.registerView(PO_STATS_VIEW_TYPE, (leaf) => new POStatsView(leaf));
    this.registerExtensions(["po", "pot"], "po-view");
    this.addSettingTab(new POSettingsTab(this.app, this));
    this.registerCommands();

    this.statusBarModeEl = this.addStatusBarItem();
    this.statusBarModeEl.addClass("po-statusbar-mode-el");
    this.statusBarModeEl.addClass("po-hidden");
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        const view = this.app.workspace.getActiveViewOfType(POView);
        this.updateModeStatusBar(view ? view.currentEditorMode : null, view ?? null);
      }),
    );

    this.app.workspace.onLayoutReady(() => this.scheduleDecorate());
    this.registerEvent(this.app.workspace.on("layout-change", () => this.scheduleDecorate()));
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof TFile && (file.extension === "po" || file.extension === "pot")) {
          this.langCache.delete(file.path);
          const el = this.app.workspace.containerEl.querySelector<HTMLElement>(
            `[data-path="${CSS.escape(file.path)}"]`,
          );
          if (el) el.removeAttribute("data-po-lang");
          this.scheduleDecorate();
        }
      }),
    );

    this.addRibbonIcon("po", "Create new PO file", () => {
      void this.showCreateModal();
    });

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, abstractFile) => {
        const path =
          abstractFile instanceof TFolder ? abstractFile.path : abstractFile.parent?.path;
        menu.addItem((item) => {
          item
            .setTitle("PO · new file")
            .setIcon("po")
            .onClick(() => {
              void this.showCreateModal(path);
            });
        });
      }),
    );
  }

  updateModeStatusBar(mode: EditorMode | null, view: POView | null): void {
    const el = this.statusBarModeEl;
    if (!el) return;
    el.empty();
    if (!mode || !view) {
      el.addClass("po-hidden");
      return;
    }
    el.removeClass("po-hidden");
    const isText = mode === "text";
    const inner = el.createSpan({ cls: "po-statusbar-mode-inner" });
    setIcon(inner.createSpan(), isText ? "layout-grid" : "code");
    inner.createSpan({ text: isText ? "PO Editor" : "PO Source" });
    el.title = isText ? "Switch to visual editor" : "Switch to PO source";
    el.onclick = () => {
      if (isText) void view.switchToGridMode();
      else view.switchToTextMode();
    };
  }

  async openStatsPanel(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(PO_STATS_VIEW_TYPE);
    let leaf = existing[0];
    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false) ?? this.app.workspace.getLeaf("split");
      await leaf.setViewState({ type: PO_STATS_VIEW_TYPE, active: true });
    }
    void this.app.workspace.revealLeaf(leaf);
  }

  onCreate() {
    if (!this.app.workspace.layoutReady) return;
  }

  async showCreateModal(folderPath?: string) {
    const { root } = this;
    const command = new CreatePOCommand({
      filePort: root.fileAdapter,
      notificationPort: root.notificationAdapter,
      viewPort: root.viewAdapter,
      poConverter: root.poConverter,
      outputDirectory: this.settings.outputDirectory,
      createPOFile,
      createPOUseCase: root.createPOUseCase,
      parsePOUseCase: root.parsePOUseCase,
    });

    const potFiles = folderPath ? await root.fileAdapter.findByExtension("pot", folderPath) : [];

    new CreatePOModal(this.app, potFiles, (options) => {
      void command.execute(options);
    }).open();
  }

  private registerCommands() {
    const { root } = this;

    this.addCommand({
      id: "po-create",
      name: "Create PO file",
      callback: async () => await this.showCreateModal(),
    });

    this.addCommand({
      id: "po-validate",
      name: "Validate PO file",
      callback: async () => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "po") {
          root.notificationAdapter.info("Open a .po file first");
          return;
        }
        const command = new ValidatePOCommand(
          this.app,
          root.validatePOUseCase,
          root.parsePOUseCase,
          root.poConverter,
        );
        await command.execute();
      },
    });

    this.addCommand({
      id: "po-view-active",
      name: "View active PO file",
      callback: async () => {
        const file = root.fileAdapter.getActiveFile();
        if (!file || file.extension !== "po") {
          root.notificationAdapter.info("Open a .po file first");
          return;
        }
        const tfile = this.app.vault.getAbstractFileByPath(file.path);
        if (tfile instanceof TFile) {
          const leaf = this.app.workspace.getLeaf("tab");
          await leaf.openFile(tfile);
        }
      },
    });

    this.addCommand({
      id: "po-stats",
      icon: "po",
      name: "Open PO statistics panel",
      callback: async () => await this.openStatsPanel(),
    });

    const toggleFuzzy = new ToggleFuzzyCommand(this.app, root.parsePOUseCase, root.poConverter);

    this.addCommand({
      id: "po-mark-fuzzy",
      name: "Mark entry as fuzzy",
      callback: async () => await toggleFuzzy.execute({ setFuzzy: true }),
    });

    this.addCommand({
      id: "po-unmark-fuzzy",
      name: "Unmark entry as fuzzy",
      callback: async () => await toggleFuzzy.execute({ setFuzzy: false }),
    });

    this.addCommand({
      id: "po-navigate-next",
      name: "Navigate to next entry",
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(POView);
        if (!view) return false;
        if (!checking) view.navigateNextCommand();
        return true;
      },
    });

    this.addCommand({
      id: "po-navigate-previous",
      name: "Navigate to previous entry",
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(POView);
        if (!view) return false;
        if (!checking) view.navigatePreviousCommand();
        return true;
      },
    });

    this.addCommand({
      id: "po-navigate-next-untranslated",
      name: "Navigate to next untranslated entry",
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(POView);
        if (!view) return false;
        if (!checking) view.navigateNextUntranslated();
        return true;
      },
    });

    this.addCommand({
      id: "po-confirm-and-next",
      name: "Confirm translation and go to next untranslated",
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(POView);
        if (!view) return false;
        if (!checking) view.confirmAndNextUntranslated();
        return true;
      },
    });

    this.addCommand({
      id: "po-toggle-fuzzy-entry",
      name: "Toggle fuzzy flag on current entry",
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(POView);
        if (!view) return false;
        if (!checking) view.toggleCurrentFuzzy();
        return true;
      },
    });

    this.addCommand({
      id: "po-close-editor",
      name: "Close editor panel",
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(POView);
        if (!view) return false;
        if (!checking) view.closeEditorPanel();
        return true;
      },
    });
  }

  private scheduleDecorate(): void {
    if (this.decorateTimer !== null) window.clearTimeout(this.decorateTimer);
    this.decorateTimer = window.setTimeout(() => {
      this.decorateTimer = null;
      void this.decorateExplorer();
    }, 200);
  }

  private async decorateExplorer(): Promise<void> {
    const titles = this.app.workspace.containerEl.querySelectorAll<HTMLElement>(
      '.nav-file-title[data-path$=".po"], .nav-file-title[data-path$=".pot"]',
    );

    for (const titleEl of Array.from(titles)) {
      if (titleEl.hasAttribute("data-po-lang")) continue;
      const path = titleEl.getAttribute("data-path");
      if (!path) continue;

      let lang = this.langCache.get(path);
      if (lang === undefined) {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile) {
          lang = await this.extractLanguage(file);
          this.langCache.set(path, lang);
        }
      }

      const isPOT = path.endsWith(".pot");
      titleEl.setAttribute("data-po-lang", isPOT ? "POT" : (lang ?? ""));
      if (!isPOT && !lang) continue;

      this.applyLanguageBadge(titleEl, isPOT ? "POT" : lang!, isPOT);
    }
  }

  private async extractLanguage(file: TFile): Promise<string> {
    try {
      // Use cachedRead to avoid redundant I/O and benefit from Obsidian's memory cache
      const content = await this.app.vault.cachedRead(file);
      // Headers are always at the top of PO files. Usually within the first 1-2KB.
      const headerSnippet = content.substring(0, 2048);
      const match = headerSnippet.match(/"Language:\s*([^\\]+)\\n"/);
      return match?.[1]?.trim().slice(0, 2).toUpperCase() ?? "";
    } catch (e) {
      console.error(`PO Editor: Failed to extract language from ${file.path}`, e);
      return "";
    }
  }

  private applyLanguageBadge(titleEl: HTMLElement, lang: string, isPOT = false): void {
    const existing = titleEl.querySelector(".po-nav-lang-badge");
    if (existing) {
      if (existing.textContent === lang) return;
      existing.remove();
    }

    const badge = activeDocument!.createElement("span");
    badge.className = isPOT ? "po-nav-lang-badge po-nav-lang-badge--pot" : "po-nav-lang-badge";
    badge.textContent = lang;

    const titleContent = titleEl.querySelector(".nav-file-title-content");
    if (titleContent) {
      titleEl.insertBefore(badge, titleContent);
    } else {
      titleEl.insertBefore(badge, titleEl.firstChild);
    }
  }

  onunload() {
    if (this.decorateTimer !== null) {
      window.clearTimeout(this.decorateTimer);
      this.decorateTimer = null;
    }
  }

  async loadSettings() {
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...((await this.loadData()) as Partial<POEditorSettings>),
    };
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
