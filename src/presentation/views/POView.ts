import { type ConvertToFormatUseCase, type ParsePOUseCase } from "@application/index";
import {
  addEntryToFile,
  createPluralEntry,
  createSingularEntry,
  getPluralFormLabels,
  getStatistics,
  isPluralEntry,
  type POEntry,
  type POFile,
  type POStatistics,
  parseNplurals,
  removeEntry,
  updateEntry,
} from "@domain/index";
import { type POConverter } from "@infrastructure/index";
import { ConvertModal, type CustomAction, POEntryModal } from "@presentation/index";
import {
  type FilterChangeCallback,
  type FilterOptions,
  type LanguageStat,
  PO_STATS_VIEW_TYPE,
  POStatsView,
} from "./POStatsView";
import {
  type App,
  Modal,
  Notice,
  setIcon,
  TextFileView,
  TFile,
  type WorkspaceLeaf,
} from "obsidian";

import type POEditorPlugin from "../../main";
import { POTextEditor } from "../editor/POTextEditor";

interface ProjectFile {
  file: TFile;
  poFile: POFile;
  language: string;
  stats: POStatistics;
}

export class POView extends TextFileView {
  private mainPoFile!: POFile;
  private siblingPoFiles: ProjectFile[] = [];
  private plugin: POEditorPlugin;
  private isProjectMode: boolean = false;
  private includedStatuses: string[] = [];
  private includedFlags: string[] = [];
  private includedComments: string[] = [];
  private includedContexts: string[] = [];
  private includedLanguages: string[] = [];
  private editorMode: "grid" | "text" = "grid";
  private poTextEditor: POTextEditor | null = null;
  private pendingTextContent: string = "";
  private activeSearch: string = "";
  private rowRenderer: (() => void) | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    plugin: POEditorPlugin,
    private poConverter: POConverter,
    private parseUseCase: ParsePOUseCase,
    private convertToFormatUseCase: ConvertToFormatUseCase,
  ) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return "po-view";
  }
  getDisplayText(): string {
    return this.file?.name || "PO Editor";
  }
  canAcceptExtension(ext: string): boolean {
    return ext === "po" || ext === "pot";
  }
  get isPOTFile(): boolean {
    return this.file?.extension === "pot";
  }
  clear(): void {
    if (this.poTextEditor) {
      this.poTextEditor.destroy();
      this.poTextEditor = null;
    }
    this.editorMode = "grid";
    this.pendingTextContent = "";
    this.contentEl.empty();
  }

  async setViewData(data: string, _clear: boolean): Promise<void> {
    if (this.poTextEditor) {
      this.poTextEditor.destroy();
      this.poTextEditor = null;
    }
    this.editorMode = "grid";
    this.pendingTextContent = "";
    const parseResult = this.parseUseCase.execute({ content: data, converter: this.poConverter });
    if (parseResult.success && parseResult.poFile) {
      this.mainPoFile = parseResult.poFile;
      this.loadProjectPreference();
      await this.loadProjectFiles();
      this.render();
    }
  }

  getViewData(): string {
    if (this.editorMode === "text") {
      if (this.poTextEditor) return this.poTextEditor.getValue();
      if (this.pendingTextContent) return this.pendingTextContent;
    }
    if (!this.mainPoFile) return "";
    if (this.isPOTFile) {
      const stripped: POFile = {
        ...this.mainPoFile,
        header: {
          ...this.mainPoFile.header,
          contentType: "text/plain; charset=UTF-8",
          contentTransferEncoding: "8bit",
          mimeVersion: "1.0",
          xGenerator: "Obsidian PO Editor",
        },
        entries: this.mainPoFile.entries.map((e) => {
          if (isPluralEntry(e)) {
            return createPluralEntry(e.msgid, e.msgidPlural, e.msgstr, {
              msgctxt: e.msgctxt,
              comments: { extracted: e.comments?.extracted, reference: e.comments?.reference },
              flags: e.flags ?? [],
              obsolete: e.obsolete,
            });
          } else {
            return createSingularEntry(e.msgid, "", {
              msgctxt: e.msgctxt,
              comments: { extracted: e.comments?.extracted, reference: e.comments?.reference },
              flags: e.flags ?? [],
              obsolete: e.obsolete,
            });
          }
        }),
        obsolete: [],
      };
      return this.poConverter.compile(stripped);
    }
    return this.poConverter.compile(this.mainPoFile);
  }

  private loadProjectPreference(): void {
    const folderPath = this.file?.parent?.path ?? "/";
    this.isProjectMode = this.plugin.settings.projectModeFolders[folderPath] === true;
  }

  private async toggleProjectMode(): Promise<void> {
    this.isProjectMode = !this.isProjectMode;
    const folderPath = this.file?.parent?.path ?? "/";
    this.plugin.settings.projectModeFolders = {
      ...this.plugin.settings.projectModeFolders,
      [folderPath]: this.isProjectMode,
    };
    await this.plugin.saveSettings();
    if (this.isProjectMode) await this.loadProjectFiles();
    this.render();
  }

  private switchToTextMode(): void {
    this.pendingTextContent = this.poConverter.compile(this.mainPoFile);
    this.editorMode = "text";
    this.render();
  }

  private switchToGridMode(): void {
    const content = this.poTextEditor ? this.poTextEditor.getValue() : this.pendingTextContent;
    const result = this.parseUseCase.execute({ content, converter: this.poConverter });
    if (result.success && result.poFile) {
      this.mainPoFile = result.poFile;
      this.editorMode = "grid";
      this.pendingTextContent = "";
      this.render();
      this.requestSave();
    } else {
      new Notice(`Invalid PO content: ${result.error ?? "parse error"}`);
    }
  }

  private async loadProjectFiles(): Promise<void> {
    if (!this.file?.parent) return;
    this.siblingPoFiles = [];
    for (const child of this.file.parent.children) {
      if (child instanceof TFile && child.extension === "po" && child.path !== this.file.path) {
        const content = await this.app.vault.read(child);
        const result = this.parseUseCase.execute({ content, converter: this.poConverter });
        if (result.success && result.poFile) {
          this.siblingPoFiles.push({
            file: child,
            poFile: result.poFile,
            language: result.poFile.header.language || child.basename,
            stats: getStatistics(result.poFile),
          });
        }
      }
    }
  }

  render(): void {
    if (this.editorMode === "text" && this.poTextEditor) {
      this.pendingTextContent = this.poTextEditor.getValue();
      this.poTextEditor.destroy();
      this.poTextEditor = null;
    }
    this.contentEl.empty();
    if (!this.file || !this.mainPoFile) return;

    const container = this.contentEl.createDiv({
      cls: "po-view-container",
      attr: {
        style:
          this.editorMode === "text"
            ? "padding: 20px 20px 0 20px; display: flex; flex-direction: column; height: 100%; box-sizing: border-box; user-select: text;"
            : "padding: 20px; user-select: text;",
      },
    });

    // Header
    const header = container.createDiv({
      attr: {
        style:
          "display: flex; align-items: center; gap: 8px; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 1px solid var(--background-modifier-border);",
      },
    });
    const titleContainer = header.createDiv({
      attr: { style: "display: flex; align-items: center; gap: 12px; flex-shrink: 0;" },
    });
    setIcon(titleContainer.createDiv(), "languages");
    titleContainer.createEl("h2", { text: this.file.name, attr: { style: "margin: 0;" } });
    if (this.isPOTFile) {
      titleContainer.createEl("span", {
        text: "POT Template",
        attr: {
          style:
            "font-size: 11px; font-weight: 600; background: var(--text-accent); color: white; padding: 2px 8px; border-radius: 10px; opacity: 0.8;",
        },
      });
    }

    const filesInFolder =
      this.file.parent?.children.filter((c) => c instanceof TFile && c.extension === "po").length ||
      0;
    if (filesInFolder > 1) {
      const modeToggle = titleContainer.createEl("button", {
        cls: "btn btn-sm",
        text: this.isProjectMode ? "👥 Project Mode" : "📄 Single File",
        attr: {
          style: `border-radius: 20px; background: ${this.isProjectMode ? "var(--interactive-accent)" : "var(--background-secondary)"}; color: ${this.isProjectMode ? "white" : "var(--text-muted)"};`,
        },
      });
      modeToggle.onclick = () => this.toggleProjectMode();

      if (this.isProjectMode) {
        const sourceLang = this.getSourceLanguage();
        const allLangs = [
          ...(this.file?.extension === "po"
            ? [
                {
                  code: this.mainPoFile?.header?.language || this.file.basename,
                  file: this.file.path,
                },
              ]
            : []),
          ...this.siblingPoFiles.map((s) => ({ code: s.language, file: s.file.path })),
        ];
        const sourceBtn = titleContainer.createEl("button", {
          cls: "btn btn-sm",
          attr: {
            style:
              "border-radius: 20px; background: var(--background-secondary); color: var(--interactive-accent); display: flex; align-items: center; gap: 4px;",
          },
        });
        const iconEl = sourceBtn.createDiv();
        setIcon(iconEl, "shield-check");
        sourceBtn.createSpan({ text: sourceLang });

        const dropdown = titleContainer.createDiv({
          attr: {
            style:
              "display: none; position: absolute; z-index: 1000; background: var(--background-primary); border: 1px solid var(--background-modifier-border); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); padding: 4px 0; margin-top: 4px; min-width: 140px; left: 0;",
          },
        });
        allLangs.forEach((l) => {
          const opt = dropdown.createDiv({
            text: l.code,
            attr: {
              style: `padding: 6px 12px; cursor: pointer; font-size: 13px; ${l.code === sourceLang ? "font-weight: 600; color: var(--interactive-accent);" : ""}`,
            },
          });
          opt.onmouseenter = () => {
            opt.style.background = "var(--background-modifier-hover)";
          };
          opt.onmouseleave = () => {
            opt.style.background = "";
          };
          opt.onclick = () => {
            void this.setSourceLanguage(l.code);
            dropdown.style.display = "none";
          };
        });
        sourceBtn.onclick = (e) => {
          e.stopPropagation();
          dropdown.style.display = dropdown.style.display === "none" ? "block" : "none";
        };
        document.addEventListener(
          "click",
          () => {
            dropdown.style.display = "none";
          },
          { once: true },
        );
      }
    }

    if (this.editorMode !== "text") {
      const statsEl = header.createDiv({
        attr: { style: "display: flex; align-items: center; gap: 0;" },
      });
      this.renderStatsDashboard(statsEl);
    }

    const rightSection = header.createDiv({
      attr: { style: "display: flex; align-items: center; gap: 8px; margin-left: auto; flex-shrink: 0;" },
    });

    const iconBtn = (
      parent: HTMLElement,
      icon: string,
      title: string,
      cls = "btn",
    ): HTMLButtonElement => {
      const btn = parent.createEl("button", {
        cls,
        attr: {
          title,
          style: "display: flex; align-items: center; justify-content: center; padding: 4px 6px;",
        },
      });
      setIcon(btn, icon);
      return btn;
    };

    if (this.editorMode !== "text") {
      iconBtn(rightSection, "bar-chart-horizontal", "Details", "btn btn-sm").onclick = () =>
        void this.openStatsPanel();
      rightSection.createDiv({
        attr: { style: "width: 1px; height: 16px; background: var(--background-modifier-border); flex-shrink: 0;" },
      });
    }

    iconBtn(rightSection, "plus", "New entry", "btn btn-primary").onclick = () =>
      this.openAddEntryModal();
    if (this.isProjectMode || this.file?.parent) {
      iconBtn(rightSection, "refresh-cw", "Sync entries").onclick = () => this.openSyncModal();
    }
    iconBtn(rightSection, "upload", "Export").onclick = () => this.openExportModal();
    const toggleBtn = iconBtn(
      rightSection,
      this.editorMode === "text" ? "layout-grid" : "code",
      this.editorMode === "text" ? "Switch to grid" : "Switch to text",
    );
    toggleBtn.onclick = () => {
      if (this.editorMode === "text") {
        this.switchToGridMode();
      } else {
        this.switchToTextMode();
      }
    };

    if (this.editorMode === "text") {
      const editorContainer = container.createDiv({
        attr: { style: "flex: 1; overflow: hidden; min-height: 0; margin-top: 16px;" },
      });
      this.poTextEditor = new POTextEditor(editorContainer, this.pendingTextContent);
      return;
    }

    this.syncPanel();

    const searchRow = container.createDiv({
      attr: { style: "display: flex; align-items: center; gap: 8px; margin-bottom: 16px;" },
    });
    const searchInput = searchRow.createEl("input", {
      cls: "po-search-input",
      attr: { type: "text", placeholder: "Search...", style: "flex: 1; border-radius: 8px;" },
    });
    searchInput.value = this.activeSearch;
    searchInput.oninput = () => {
      this.activeSearch = searchInput.value;
      this.rowRenderer?.();
    };

    const activeFilterCount = [
      this.includedStatuses.length > 0,
      this.includedFlags.length > 0,
      this.includedComments.length > 0,
      this.includedContexts.length > 0,
      this.includedLanguages.length > 0,
    ].filter(Boolean).length;

    const filterBtn = searchRow.createEl("button", {
      cls: "btn",
      attr: {
        style: `display: flex; align-items: center; gap: 5px; flex-shrink: 0;${activeFilterCount > 0 ? " color: var(--interactive-accent);" : ""}`,
      },
    });
    setIcon(filterBtn.createDiv(), "filter");
    if (activeFilterCount > 0) {
      filterBtn.createSpan({
        text: activeFilterCount.toString(),
        attr: {
          style:
            "font-size: 10px; font-weight: 700; background: var(--interactive-accent); color: white; border-radius: 8px; padding: 1px 5px; line-height: 1.4;",
        },
      });
    }
    filterBtn.onclick = () => void this.openFiltersPanel();

    const listContainer = container.createDiv({
      cls: "po-entry-list",
      attr: { style: "border-radius: 8px; overflow: hidden;" },
    });
    this.renderGrid(listContainer);
  }

  private renderStatsDashboard(container: HTMLElement): void {
    const mainStats = getStatistics(this.mainPoFile);

    const totalSiblingFiles =
      this.file?.parent?.children.filter(
        (c) =>
          c instanceof TFile &&
          (c as TFile).extension === "po" &&
          (c as TFile).path !== this.file?.path,
      ).length ?? 0;
    const totalFiles = totalSiblingFiles + 1;

    const allParsedStats = [mainStats, ...this.siblingPoFiles.map((s) => s.stats)];
    const avgProgress =
      this.isProjectMode && totalFiles > 1
        ? Math.round(
            allParsedStats.reduce(
              (acc, s) => acc + (s.total > 0 ? (s.translated / s.total) * 100 : 0),
              0,
            ) / totalFiles,
          )
        : mainStats.total > 0
          ? Math.round((mainStats.translated / mainStats.total) * 100)
          : 0;

    // Separator + GLOBAL label before progress bar
    this.renderStatBarSep(container);
    container.createSpan({
      text: "GLOBAL",
      attr: {
        style:
          "font-size: 9px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.8px; white-space: nowrap;",
      },
    });

    // Progress section — inline in header, no wrapper box
    const progressSection = container.createDiv({
      attr: { style: "display: flex; align-items: center; gap: 8px; flex-shrink: 0;" },
    });
    const barTrack = progressSection.createDiv({
      attr: {
        style:
          "width: 80px; height: 5px; background: var(--background-modifier-border); border-radius: 3px; overflow: hidden;",
      },
    });
    barTrack.createDiv({
      attr: {
        style: `width: ${avgProgress}%; height: 100%; background: var(--text-success); border-radius: 3px; transition: width 0.4s ease;`,
      },
    });
    progressSection.createSpan({
      text: `${avgProgress}%`,
      attr: { style: "font-size: 12px; font-weight: 600; color: var(--text-success); white-space: nowrap;" },
    });

    if (this.isPOTFile) {
      this.renderStatBarItem(container, mainStats.total.toString(), "Keys");
      return;
    }

    this.renderStatBarSep(container);
    this.renderStatBarItem(container, mainStats.translated.toString(), "Translated", "var(--text-success)");
    this.renderStatBarSep(container);
    const untranslated = mainStats.total - mainStats.translated;
    this.renderStatBarItem(
      container,
      untranslated.toString(),
      "Untranslated",
      untranslated > 0 ? "var(--text-warning)" : "var(--text-muted)",
    );
    this.renderStatBarSep(container);
    this.renderStatBarItem(container, mainStats.total.toString(), this.isProjectMode ? "Keys/lang" : "Keys");
    this.renderStatBarSep(container);
    this.renderStatBarItem(container, mainStats.wordCount.toLocaleString(), "Words");
    this.renderStatBarSep(container);
    this.renderStatBarItem(container, mainStats.charCount.toLocaleString(), "Chars");

    if (mainStats.fuzzy > 0) {
      this.renderStatBarSep(container);
      this.renderStatBarItem(container, mainStats.fuzzy.toString(), "Fuzzy", "var(--text-warning)");
    }
    if (mainStats.errors > 0) {
      this.renderStatBarSep(container);
      this.renderStatBarItem(container, mainStats.errors.toString(), "Errors", "var(--text-error)");
    }
    if (mainStats.obsolete > 0) {
      this.renderStatBarSep(container);
      this.renderStatBarItem(container, mainStats.obsolete.toString(), "Obsolete", "var(--text-faint)");
    }
  }

  getLanguageStats(): LanguageStat[] {
    if (!this.mainPoFile) return [];
    const mainStats = getStatistics(this.mainPoFile);
    const sourceLang = this.getSourceLanguage();
    const mainName = this.mainPoFile.header.language || this.file?.basename || "Current";
    const result: LanguageStat[] = [
      { name: mainName, stats: mainStats, isSource: mainName === sourceLang },
      ...this.siblingPoFiles.map((s) => ({
        name: s.language,
        stats: s.stats,
        isSource: s.language === sourceLang,
      })),
    ];
    return result.sort((a, b) => {
      if (a.isSource && !b.isSource) return -1;
      if (!a.isSource && b.isSource) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  syncWithPanel(panel: POStatsView): void {
    const allStats = this.getLanguageStats();
    const stats =
      this.includedLanguages.length > 0
        ? allStats.filter((s) => this.includedLanguages.includes(s.name))
        : allStats;
    panel.setStats(stats);
    const onChange: FilterChangeCallback = (key, values) => {
      switch (key) {
        case "includedStatuses": this.includedStatuses = values; break;
        case "includedFlags": this.includedFlags = values; break;
        case "includedComments": this.includedComments = values; break;
        case "includedContexts": this.includedContexts = values; break;
        case "includedLanguages": this.includedLanguages = values; this.render(); return;
      }
      this.rowRenderer?.();
      panel.updateFilterOptions(this.buildFilterOptions());
    };
    panel.setFilterData(this.buildFilterOptions(), onChange);
  }

  private syncPanel(): void {
    const existing = this.app.workspace.getLeavesOfType(PO_STATS_VIEW_TYPE);
    const view = existing[0]?.view;
    if (view instanceof POStatsView) {
      this.syncWithPanel(view);
    }
  }

  private buildFilterOptions(): FilterOptions {
    const mainStats = getStatistics(this.mainPoFile);
    const entries = this.mainPoFile?.entries ?? [];

    const untranslatedCount = entries.filter((e) => {
      if (isPluralEntry(e)) return !e.msgstr.some((s) => s.trim() !== "");
      return e.msgstr.trim() === "";
    }).length;

    const flagQAs = this.plugin.settings.quickActions.filter(
      (qa): qa is typeof qa & { flag: string } => qa.flag !== undefined,
    );
    const aggregatedFlagCounts = this.isProjectMode
      ? this.getAggregatedFlagCounts()
      : mainStats.flags;
    const flagOptions = flagQAs.map((qa) => ({
      flag: qa.flag,
      label: qa.label,
      count: aggregatedFlagCounts[qa.flag] ?? 0,
    }));

    const commentQAs = this.plugin.settings.quickActions.filter(
      (qa): qa is typeof qa & { comment: string } => qa.comment !== undefined && !qa.flag,
    );
    let allComments: string[] = [];
    if (this.isProjectMode) {
      const allFiles = [this.mainPoFile, ...this.siblingPoFiles.map((s) => s.poFile)];
      for (const poFile of allFiles) {
        if (!poFile) continue;
        for (const entry of poFile.entries) {
          if (entry.comments?.translator) allComments.push(entry.comments.translator);
        }
      }
    } else {
      allComments = entries.map((e) => e.comments?.translator).filter((c): c is string => !!c);
    }
    allComments = [...new Set(allComments)].sort();

    const commentOptions: FilterOptions["commentOptions"] = [];
    const existingComments = new Set(allComments);
    commentQAs.forEach((qa) => {
      const count = allComments.filter((c) => c === qa.comment).length;
      if (count > 0 || this.activeCommentFilter === qa.comment) {
        commentOptions.push({ comment: qa.comment, label: qa.label, count });
        existingComments.delete(qa.comment);
      }
    });
    existingComments.forEach((c) => {
      commentOptions.push({ comment: c, label: c, count: allComments.filter((x) => x === c).length });
    });

    const contextCounts = new Map<string, number>();
    entries.forEach((e) => {
      if (e.msgctxt) contextCounts.set(e.msgctxt, (contextCounts.get(e.msgctxt) ?? 0) + 1);
    });
    const contextOptions = [...contextCounts.entries()]
      .map(([context, count]) => ({ context, count }))
      .sort((a, b) => a.context.localeCompare(b.context));

    const aggregatedStats = this.isProjectMode
      ? this.getAggregatedProjectStats()
      : { fuzzy: mainStats.fuzzy, comments: 0 };

    const languageOptions = this.isProjectMode
      ? this.getLanguageStats().map((l) => ({ language: l.name, isSource: l.isSource }))
      : undefined;

    return {
      totalEntries: mainStats.total,
      untranslatedCount,
      translatedCount: mainStats.translated,
      fuzzyCount: aggregatedStats.fuzzy,
      flagOptions,
      commentOptions,
      contextOptions,
      languageOptions,
      current: {
        includedStatuses: this.includedStatuses,
        includedFlags: this.includedFlags,
        includedComments: this.includedComments,
        includedContexts: this.includedContexts,
        includedLanguages: this.includedLanguages,
      },
    };
  }

  private async openFiltersPanel(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(PO_STATS_VIEW_TYPE);
    let leaf = existing[0];
    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false) ?? this.app.workspace.getLeaf("split");
      await leaf.setViewState({ type: PO_STATS_VIEW_TYPE, active: true });
    }
    this.app.workspace.revealLeaf(leaf);
    const view = leaf.view;
    if (view instanceof POStatsView) {
      this.syncWithPanel(view);
      view.switchToFilters();
    }
  }

  private async openStatsPanel(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(PO_STATS_VIEW_TYPE);
    let leaf = existing[0];
    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false) ?? this.app.workspace.getLeaf("split");
      await leaf.setViewState({ type: PO_STATS_VIEW_TYPE, active: true });
    }
    this.app.workspace.revealLeaf(leaf);
    const view = leaf.view;
    if (view instanceof POStatsView) {
      view.setStats(this.getLanguageStats());
    }
  }

  private renderStatBarItem(
    parent: HTMLElement,
    val: string,
    label: string,
    color = "var(--text-normal)",
  ): void {
    const item = parent.createDiv({
      attr: { style: "display: flex; align-items: baseline; gap: 4px; white-space: nowrap;" },
    });
    item.createSpan({
      text: val,
      attr: { style: `font-size: 13px; font-weight: 600; color: ${color};` },
    });
    item.createSpan({
      text: label,
      attr: { style: "font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-weight: 500;" },
    });
  }

  private renderStatBarSep(parent: HTMLElement): void {
    parent.createDiv({
      attr: {
        style:
          "width: 1px; height: 16px; background: var(--background-modifier-border); margin: 0 12px; flex-shrink: 0;",
      },
    });
  }

  private renderGrid(container: HTMLElement): void {
    const detectPlaceholders = (text: string): string[] => {
      const patterns = this.plugin.settings.placeholderPatterns ?? [];
      const found: string[] = [];
      for (const pat of patterns) {
        if (!pat) continue;
        try {
          const matches = text.match(new RegExp(pat, "g"));
          if (matches) found.push(...matches);
        } catch {}
      }
      return [...new Set(found)];
    };

    const renderChips = (
      parent: HTMLElement,
      placeholders: string[],
      area: HTMLTextAreaElement,
      onChange: (v: string) => void,
    ) => {
      if (placeholders.length === 0) return;
      const row = parent.createDiv({
        attr: { style: "display: flex; flex-wrap: wrap; gap: 3px; padding: 0 10px 6px;" },
      });
      placeholders.forEach((ph) => {
        const chip = row.createEl("button", {
          text: ph,
          attr: {
            style:
              "font-size: 10px; font-family: monospace; padding: 1px 5px; border-radius: 3px; background: var(--background-modifier-border); color: var(--text-accent); cursor: pointer; border: none; line-height: 1.4;",
          },
        });
        chip.onclick = (e) => {
          e.preventDefault();
          const start = area.selectionStart ?? area.value.length;
          const end = area.selectionEnd ?? area.value.length;
          area.value = area.value.substring(0, start) + ph + area.value.substring(end);
          area.selectionStart = area.selectionEnd = start + ph.length;
          area.focus();
          onChange(area.value);
        };
      });
    };

    const makeLangCell = (
      parent: HTMLElement,
      value: string,
      isMain: boolean,
      onChange: (v: string) => void,
      placeholders: string[] = [],
      isMissing: boolean = false,
      isSource: boolean = false,
      readOnly: boolean = false,
      hasFuzzy: boolean = false,
      translatorComment?: string,
    ): HTMLTextAreaElement => {
      const bg = isMain
        ? "var(--background-secondary-alt)"
        : isMissing
          ? "rgba(var(--color-red-rgb, 220,60,60), 0.07)"
          : "var(--background-secondary)";
      const topBorder = isSource
        ? " border-top: 2px solid var(--interactive-accent);"
        : " border-top: 2px solid transparent;";
      const fuzzyBorder = hasFuzzy ? " border-left: 3px solid #f39c12;" : "";
      const wrapper = parent.createDiv({
        attr: {
          style: `position: relative; display: flex; flex-direction: column; padding: 6px 8px;${isMain ? topBorder : ` border-left: 1px solid var(--background-modifier-border);${topBorder}`}${fuzzyBorder}`,
        },
      });
      if (isMissing)
        wrapper.createDiv({
          text: "⚠ Missing",
          attr: {
            style:
              "font-size: 9px; font-weight: 600; color: var(--text-error); text-transform: uppercase; letter-spacing: 0.5px; padding: 0 2px 3px;",
          },
        });
      const area = wrapper.createEl("textarea", {
        cls: "po-grid-input",
        attr: {
          style: `width: 100%; min-height: 48px; background: ${bg}; border: 1px solid transparent; border-radius: 6px; font-size: 13px; resize: none; padding: 8px 10px; transition: background 0.15s, border-color 0.15s;${readOnly ? " opacity: 0.75; cursor: default;" : ""}`,
        },
      });
      area.value = value;
      if (readOnly) {
        area.readOnly = true;
      } else {
        const editIcon = wrapper.createDiv({
          attr: {
            style:
              "position: absolute; top: 10px; right: 14px; opacity: 0; transition: opacity 0.15s; pointer-events: none; color: var(--text-muted);",
          },
        });
        setIcon(editIcon, "pencil");
        area.onfocus = () => {
          area.style.background = "var(--background-primary)";
          area.style.borderColor = "var(--interactive-accent)";
          editIcon.style.opacity = "0";
        };
        area.onblur = () => {
          area.style.background = bg;
          area.style.borderColor = "transparent";
        };
        wrapper.onmouseenter = () => {
          if (document.activeElement !== area) {
            editIcon.style.opacity = "0.5";
            area.style.borderColor = "var(--background-modifier-border)";
          }
        };
        wrapper.onmouseleave = () => {
          editIcon.style.opacity = "0";
          if (document.activeElement !== area) area.style.borderColor = "transparent";
        };
        area.onchange = () => onChange(area.value);
        renderChips(wrapper, placeholders, area, onChange);
      }
      if (translatorComment) {
        const commentWrap = wrapper.createDiv({
          attr: {
            style:
              "display: flex; align-items: flex-start; gap: 4px; padding-top: 6px; border-top: 1px solid var(--background-modifier-border); margin-top: 4px;",
          },
        });
        const commentIcon = commentWrap.createDiv({
          attr: { style: "flex-shrink: 0; color: var(--text-muted);" },
        });
        setIcon(commentIcon, "message-circle");
        commentWrap.createSpan({
          text:
            translatorComment.length > 30
              ? `${translatorComment.substring(0, 30)}...`
              : translatorComment,
          attr: {
            style:
              "font-size: 11px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;",
          },
        });
      }
      return area;
    };

    const makePluralCell = (
      parent: HTMLElement,
      pluralValues: string[],
      labels: string[],
      isMain: boolean,
      onChange: (i: number, v: string) => void,
      placeholders: string[] = [],
      isMissing: boolean = false,
      isSource: boolean = false,
      readOnly: boolean = false,
      hasFuzzy: boolean = false,
      translatorComment?: string,
    ): void => {
      const bg = isMain
        ? "var(--background-secondary-alt)"
        : isMissing
          ? "rgba(var(--color-red-rgb, 220,60,60), 0.07)"
          : "var(--background-secondary)";
      const topBorder = isSource
        ? " border-top: 2px solid var(--interactive-accent);"
        : " border-top: 2px solid transparent;";
      const fuzzyBorder = hasFuzzy ? " border-left: 3px solid #f39c12;" : "";
      const cell = parent.createDiv({
        attr: {
          style: `display: flex; flex-direction: column; gap: 4px; padding: 6px 8px;${isMain ? topBorder : ` border-left: 1px solid var(--background-modifier-border);${topBorder}`}${fuzzyBorder}`,
        },
      });
      if (isMissing)
        cell.createDiv({
          text: "⚠ Missing",
          attr: {
            style:
              "font-size: 9px; font-weight: 600; color: var(--text-error); text-transform: uppercase; letter-spacing: 0.5px; padding: 0 2px 2px;",
          },
        });
      pluralValues.forEach((val, i) => {
        const wrap = cell.createDiv({
          attr: {
            style: `display: flex; flex-direction: column; background: ${bg}; border: 1px solid transparent; border-radius: 6px; transition: border-color 0.15s;${readOnly ? " opacity: 0.75;" : ""}`,
          },
        });
        wrap.createDiv({
          text: labels[i] ?? `[${i}]`,
          attr: {
            style:
              "font-size: 9px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; padding: 4px 10px 0; letter-spacing: 0.5px;",
          },
        });
        const area = wrap.createEl("textarea", {
          cls: "po-grid-input",
          attr: {
            style: `width: 100%; min-height: 32px; background: transparent; border: none; font-size: 13px; resize: none; padding: 2px 10px 6px; outline: none;${readOnly ? " cursor: default;" : ""}`,
          },
        });
        area.value = val;
        if (readOnly) {
          area.readOnly = true;
        } else {
          area.onfocus = () => {
            wrap.style.borderColor = "var(--interactive-accent)";
            wrap.style.background = "var(--background-primary)";
          };
          area.onblur = () => {
            wrap.style.borderColor = "transparent";
            wrap.style.background = bg;
          };
          area.onmouseenter = () => {
            if (document.activeElement !== area)
              wrap.style.borderColor = "var(--background-modifier-border)";
          };
          area.onmouseleave = () => {
            if (document.activeElement !== area) wrap.style.borderColor = "transparent";
          };
          area.onchange = () => onChange(i, area.value);
          renderChips(wrap, placeholders, area, (v) => onChange(i, v));
        }
      });
      if (translatorComment) {
        const commentWrap = cell.createDiv({
          attr: {
            style:
              "display: flex; align-items: flex-start; gap: 4px; padding-top: 6px; border-top: 1px solid var(--background-modifier-border); margin-top: 4px;",
          },
        });
        const commentIcon = commentWrap.createDiv({
          attr: { style: "flex-shrink: 0; color: var(--text-muted);" },
        });
        setIcon(commentIcon, "message-circle");
        commentWrap.createSpan({
          text:
            translatorComment.length > 30
              ? `${translatorComment.substring(0, 30)}...`
              : translatorComment,
          attr: {
            style:
              "font-size: 11px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;",
          },
        });
      }
    };

    const renderRows = () => {
      container.empty();
      const term = this.activeSearch;
      const entries = this.mainPoFile?.entries;
      const isTranslated = (e: POEntry) => {
        if (isPluralEntry(e)) {
          return e.msgstr.some((s) => s.trim() !== "");
        } else {
          return e.msgstr.trim() !== "";
        }
      };
      let filtered = entries;

      // Status: show only entries matching any included status (empty = no filter)
      if (this.includedStatuses.length > 0) {
        const matchesStatus = (e: POEntry, status: string): boolean => {
          if (status === "untranslated") {
            if (!isTranslated(e)) return true;
            if (this.isProjectMode) {
              return this.siblingPoFiles.some((spf) => {
                const sib = spf.poFile.entries.find(
                  (s) => s.msgid === e.msgid && s.msgctxt === e.msgctxt,
                );
                return !sib || !isTranslated(sib);
              });
            }
            return false;
          }
          if (status === "translated") return isTranslated(e);
          if (status === "fuzzy") {
            if ((e.flags ?? []).includes("fuzzy")) return true;
            if (this.isProjectMode) {
              return this.siblingPoFiles.some((spf) => {
                const sib = spf.poFile.entries.find(
                  (s) => s.msgid === e.msgid && s.msgctxt === e.msgctxt,
                );
                return (sib?.flags ?? []).includes("fuzzy");
              });
            }
            return false;
          }
          return false;
        };
        filtered = filtered.filter((e) => this.includedStatuses.some((s) => matchesStatus(e, s)));
      }

      // Flags: show only entries with any included flag (empty = no filter)
      if (this.includedFlags.length > 0) {
        if (this.isProjectMode) {
          filtered = filtered.filter((e) =>
            this.includedFlags.some((flag) => {
              if ((e.flags ?? []).includes(flag as any)) return true;
              return this.siblingPoFiles.some((spf) => {
                const sib = spf.poFile.entries.find(
                  (s) => s.msgid === e.msgid && s.msgctxt === e.msgctxt,
                );
                return (sib?.flags ?? []).includes(flag as any);
              });
            }),
          );
        } else {
          filtered = filtered.filter((e) =>
            this.includedFlags.some((f) => (e.flags ?? []).includes(f as any)),
          );
        }
      }

      // Comments: show only entries with any included comment (empty = no filter)
      if (this.includedComments.length > 0) {
        if (this.isProjectMode) {
          filtered = filtered.filter((e) => {
            if (this.includedComments.some((c) => e.comments?.translator === c)) return true;
            return this.siblingPoFiles.some((spf) => {
              const sib = spf.poFile.entries.find(
                (s) => s.msgid === e.msgid && s.msgctxt === e.msgctxt,
              );
              return this.includedComments.some((c) => sib?.comments?.translator === c);
            });
          });
        } else {
          filtered = filtered.filter((e) =>
            this.includedComments.some((c) => e.comments?.translator === c),
          );
        }
      }

      // Contexts: show only entries in any included context (empty = no filter)
      if (this.includedContexts.length > 0) {
        filtered = filtered.filter((e) =>
          this.includedContexts.some((ctx) => e.msgctxt === ctx),
        );
      }
      if (term) {
        const t = term.toLowerCase();
        filtered = filtered.filter((e) => {
          const msgstrText = isPluralEntry(e) ? e.msgstr.join(" ") : e.msgstr;
          return e.msgid.toLowerCase().includes(t) || msgstrText.toLowerCase().includes(t);
        });
      }
      const isPOT = this.isPOTFile;
      let languages = isPOT
        ? []
        : [
            { id: "main", label: this.mainPoFile?.header.language || "Current" },
            ...(this.isProjectMode
              ? this.siblingPoFiles.map((s, i) => ({ id: `spf-${i}`, label: s.language }))
              : []),
          ];
      if (this.isProjectMode && this.includedLanguages.length > 0) {
        languages = languages.filter((l) => this.includedLanguages.includes(l.label));
      }
      const gridTemplate = isPOT ? "1fr 80px" : `250px repeat(${languages.length}, 1fr) 120px`;

      const sourceLang = this.isProjectMode
        ? this.getSourceLanguage()
        : this.mainPoFile?.header.language || "";
      const headerRow = container.createDiv({
        cls: "po-entry-item",
        attr: {
          style: `background: var(--background-secondary); font-weight: bold; grid-template-columns: ${gridTemplate}; padding: 10px 16px;`,
        },
      });
      headerRow.createDiv({ text: "Source" });
      languages.forEach((l) => {
        const isSource = l.label === sourceLang || (!this.isProjectMode && l.id === "main");
        const cell = headerRow.createDiv({
          attr: { style: "display: flex; align-items: center; justify-content: center; gap: 5px;" },
        });
        if (isSource) {
          const iconEl = cell.createDiv({
            attr: { style: "color: var(--interactive-accent); flex-shrink: 0;" },
          });
          setIcon(iconEl, "shield-check");
          cell.createSpan({
            text: l.label,
            attr: { style: "color: var(--interactive-accent); font-weight: 700;" },
          });
        } else {
          cell.createSpan({ text: l.label });
        }
      });
      headerRow.createDiv();

      filtered.forEach((entry) => {
        const isPOT = this.isPOTFile;
        const entryHasFuzzy = (entry.flags ?? []).includes("fuzzy");

        const item = container.createDiv({
          cls: "po-entry-item",
          attr: {
            style: `grid-template-columns: ${gridTemplate}; border-bottom: 1px solid var(--background-modifier-border); padding: 4px 16px; align-items: stretch;${entryHasFuzzy ? " background: rgba(243,156,18,0.1);" : ""}`,
          },
        });

        // Source cell with inline translator comment
        const sourceCell = item.createDiv({
          attr: {
            style:
              "padding: 10px 12px 10px 0; border-right: 1px solid var(--background-modifier-border); display: flex; flex-direction: column; gap: 6px;",
          },
        });
        if (entry.msgctxt)
          sourceCell.createEl("span", {
            text: entry.msgctxt,
            attr: {
              style: "font-size: 9px; color: var(--text-accent); text-transform: uppercase;",
            },
          });
        sourceCell.createEl("div", {
          text: entry.msgid,
          attr: { style: "font-weight: 500; font-size: 13px;" },
        });

        // Inline translator comment
        const commentWrap = sourceCell.createDiv({
          attr: {
            style:
              "display: flex; align-items: flex-start; gap: 4px; border-top: 1px solid var(--background-modifier-border); padding-top: 6px;",
          },
        });
        const commentIcon = commentWrap.createDiv({
          attr: {
            style: "color: var(--text-muted); opacity: 0.5; flex-shrink: 0; margin-top: 1px;",
          },
        });
        setIcon(commentIcon, "message-circle");
        const commentArea = commentWrap.createEl("textarea", {
          attr: {
            placeholder: "Translator comment...",
            style:
              "flex: 1; font-size: 10px; color: var(--text-muted); font-style: italic; background: transparent; border: none; resize: none; min-height: 18px; max-height: 60px; line-height: 1.4; font-family: inherit; padding: 0; outline: none; overflow: hidden;",
          },
        });
        commentArea.value = entry.comments?.translator || "";
        commentArea.onfocus = () => {
          commentArea.style.color = "var(--text-normal)";
          commentArea.style.fontStyle = "normal";
          commentIcon.style.opacity = "1";
        };
        commentArea.onblur = () => {
          commentArea.style.color = "var(--text-muted)";
          commentArea.style.fontStyle = "italic";
          commentIcon.style.opacity = "0.5";
          const newComment = commentArea.value.trim() || undefined;
          if (newComment !== (entry.comments?.translator || undefined)) {
            if (!this.mainPoFile) return;
            this.mainPoFile = updateEntry(this.mainPoFile, entry.msgid, (current) => {
              const comments = { ...current.comments, translator: newComment };
              if (isPluralEntry(current)) {
                return createPluralEntry(current.msgid, current.msgidPlural, current.msgstr, {
                  ...current,
                  comments,
                });
              } else {
                return createSingularEntry(current.msgid, current.msgstr, {
                  ...current,
                  comments,
                });
              }
            });
            this.requestSave();
            this.render();
          }
        };

        // Detect placeholders once per entry (from source msgid)
        const placeholders = detectPlaceholders(entry.msgid);
        const mainLang = this.mainPoFile?.header.language || this.file?.basename;

        const mainLangVisible =
          !this.isProjectMode ||
          this.includedLanguages.length === 0 ||
          this.includedLanguages.includes(mainLang ?? "");

        // Translation cells — hidden for POT files
        if (!isPOT && mainLangVisible) {
          if (isPluralEntry(entry)) {
            const nplurals = this.getNplurals();
            const labels = getPluralFormLabels(nplurals);
            const pluralValues = Array.from(
              { length: nplurals },
              (_, i) => entry.msgstr?.[i] ?? "",
            );
            makePluralCell(
              item,
              pluralValues,
              labels,
              true,
              (i, v) => {
                if (!this.mainPoFile) return;
                this.mainPoFile = updateEntry(this.mainPoFile, entry.msgid, (e) => {
                  if (!isPluralEntry(e)) return e;
                  const updated = [...(e.msgstr ?? Array(nplurals).fill(""))];
                  updated[i] = v;
                  return createPluralEntry(e.msgid, e.msgidPlural, updated, e);
                });
                this.requestSave();
              },
              placeholders,
              false,
              mainLang === sourceLang,
              false,
              false,
              entry.comments?.translator,
            );
          } else {
            makeLangCell(
              item,
              entry.msgstr,
              true,
              (v) => {
                if (!this.mainPoFile) return;
                this.mainPoFile = updateEntry(this.mainPoFile, entry.msgid, (e) =>
                  createSingularEntry(e.msgid, v, e),
                );
                this.requestSave();
              },
              placeholders,
              false,
              mainLang === sourceLang,
              false,
              false,
              entry.comments?.translator,
            );
          }
        }

        // Sibling translation cells — never shown for POT
        if (!isPOT && this.isProjectMode) {
          this.siblingPoFiles.forEach((spf) => {
            if (
              this.includedLanguages.length > 0 &&
              !this.includedLanguages.includes(spf.language)
            )
              return;
            const siblingEntry = spf.poFile.entries.find(
              (e) => e.msgid === entry.msgid && e.msgctxt === entry.msgctxt,
            );
            const sibLang = spf.language;
            const siblingFuzzy = (siblingEntry?.flags ?? []).includes("fuzzy");
            const siblingComment = siblingEntry?.comments?.translator;
            if (isPluralEntry(entry)) {
              const sibNplurals = parseNplurals(spf.poFile.header.pluralForms ?? "");
              const sibLabels = getPluralFormLabels(sibNplurals);
              const pluralValues = Array.from(
                { length: sibNplurals },
                (_, i) =>
                  (siblingEntry && isPluralEntry(siblingEntry)
                    ? siblingEntry.msgstr?.[i]
                    : undefined) ?? "",
              );
              makePluralCell(
                item,
                pluralValues,
                sibLabels,
                false,
                async (i, v) => {
                  const updated =
                    siblingEntry && isPluralEntry(siblingEntry)
                      ? [...siblingEntry.msgstr]
                      : Array(sibNplurals).fill("");
                  updated[i] = v;
                  if (siblingEntry && isPluralEntry(siblingEntry)) {
                    spf.poFile = updateEntry(spf.poFile, entry.msgid, (e) => {
                      if (!isPluralEntry(e)) return e;
                      return createPluralEntry(e.msgid, e.msgidPlural, updated, e);
                    });
                  } else {
                    spf.poFile = addEntryToFile(spf.poFile, entry);
                  }
                  await this.saveProjectFile(spf);
                },
                placeholders,
                !siblingEntry,
                sibLang === sourceLang,
                false,
                siblingFuzzy,
                siblingComment,
              );
            } else {
              makeLangCell(
                item,
                siblingEntry && !isPluralEntry(siblingEntry) ? siblingEntry.msgstr : "",
                false,
                async (v) => {
                  if (siblingEntry && !isPluralEntry(siblingEntry)) {
                    spf.poFile = updateEntry(spf.poFile, entry.msgid, (e) =>
                      createSingularEntry(e.msgid, v, e),
                    );
                  } else {
                    spf.poFile = addEntryToFile(spf.poFile, entry);
                  }
                  await this.saveProjectFile(spf);
                },
                placeholders,
                !siblingEntry,
                sibLang === sourceLang,
                false,
                siblingFuzzy,
                siblingComment,
              );
            }
          });
        }

        const actions = item.createDiv({
          attr: {
            style:
              "display: flex; flex-direction: column; gap: 6px; padding: 8px 0; padding-left: 12px; border-left: 1px solid var(--background-modifier-border); align-items: flex-end; justify-content: flex-start;",
          },
        });

        // Row 1: management
        const mgmtGroup = actions.createDiv({ attr: { style: "display: flex; gap: 3px;" } });
        const editBtn = mgmtGroup.createEl("button", { cls: "btn btn-sm" });
        setIcon(editBtn, "pencil");
        editBtn.onclick = () => this.openEditEntryModal(entry);
        const delBtn = mgmtGroup.createEl("button", {
          cls: "btn btn-sm",
          attr: { style: "color: var(--text-error);" },
        });
        setIcon(delBtn, "trash");
        delBtn.onclick = () => this.deleteEntry(entry);

        // Row 2: flags + comments — hidden for POT
        if (!isPOT) {
          const tagsStack = actions.createDiv({
            attr: {
              style: "display: flex; flex-direction: column; gap: 3px; align-items: flex-end;",
            },
          });

          const flagQAs = this.plugin.settings.quickActions.filter((qa: CustomAction) => !!qa.flag);
          const flagsGroup = tagsStack.createDiv({
            attr: { style: "display: flex; gap: 3px; flex-wrap: wrap; justify-content: flex-end;" },
          });
          const isFuzzy = entry?.flags?.includes("fuzzy");
          const fuzzyBtn = flagsGroup.createEl("button", {
            cls: "btn btn-sm",
            text: "F",
            attr: {
              title: "Fuzzy",
              style: `width: 20px; height: 20px; padding: 0; font-size: 9px; font-weight: bold; background: ${isFuzzy ? "#f39c12" : "transparent"}; color: ${isFuzzy ? "white" : "#f39c12"}; border-color: ${isFuzzy ? "transparent" : "var(--background-modifier-border)"};`,
            },
          });
          fuzzyBtn.onclick = () => this.toggleFuzzy(entry);
          flagQAs.forEach((qa: CustomAction) => {
            const isActive = entry?.flags?.includes(qa.flag as "fuzzy");
            const btn = flagsGroup.createEl("button", {
              cls: "btn btn-sm",
              text: qa.label.charAt(0),
              attr: {
                title: `flag: ${qa.label}`,
                style: `width: 20px; height: 20px; padding: 0; font-size: 9px; background: ${isActive ? qa.color || "var(--interactive-accent)" : "transparent"}; color: ${isActive ? "white" : qa.color || "var(--text-muted)"}; border-color: ${isActive ? "transparent" : "var(--background-modifier-border)"};`,
              },
            });
            btn.onclick = () => this.applyQuickAction(entry, qa);
          });

          const commentQAs = this.plugin.settings.quickActions.filter(
            (qa: CustomAction) => !!qa.comment && !qa.flag,
          );
          if (commentQAs.length > 0) {
            const commentsGroup = tagsStack.createDiv({
              attr: {
                style: "display: flex; gap: 3px; flex-wrap: wrap; justify-content: flex-end;",
              },
            });
            commentQAs.forEach((qa: CustomAction) => {
              const isActive = entry.comments?.translator === qa.comment;
              const btn = commentsGroup.createEl("button", {
                cls: "btn btn-sm",
                text: qa.label.charAt(0),
                attr: {
                  title: `comment: ${qa.label}`,
                  style: `width: 20px; height: 20px; padding: 0; font-size: 9px; background: ${isActive ? qa.color || "var(--interactive-accent)" : "transparent"}; color: ${isActive ? "white" : qa.color || "var(--text-muted)"}; border-color: ${isActive ? "transparent" : "var(--background-modifier-border)"};`,
                },
              });
              btn.onclick = () => this.applyQuickAction(entry, qa);
            });
          }
        }
      });
    };
    this.rowRenderer = renderRows;
    renderRows();
  }

  private toggleFuzzy(entry: POEntry): void {
    if (!this.mainPoFile) return;
    this.mainPoFile = updateEntry(this.mainPoFile, entry.msgid, (current) => {
      const hasFuzzy = (current?.flags ?? []).includes("fuzzy" as any);
      const flags = hasFuzzy
        ? (current?.flags ?? []).filter((f) => f !== ("fuzzy" as any))
        : [...(current?.flags ?? []), "fuzzy" as any];
      if (isPluralEntry(current)) {
        return createPluralEntry(current.msgid, current.msgidPlural, current.msgstr, {
          ...current,
          flags: flags as any,
        });
      } else {
        return createSingularEntry(current.msgid, current.msgstr, {
          ...current,
          flags: flags as any,
        });
      }
    });
    this.requestSave();
    this.render();
  }

  private applyQuickAction(entry: POEntry, action: CustomAction): void {
    if (!this.mainPoFile) return;
    this.mainPoFile = updateEntry(this.mainPoFile, entry.msgid, (current) => {
      let flags = [...(current?.flags ?? [])];
      const comments = { ...current.comments };
      if (action.flag) {
        if (flags.includes(action.flag as any)) flags = flags.filter((f) => f !== action.flag);
        else flags.push(action.flag as any);
      }
      if (action.comment) {
        if (comments.translator === action.comment) delete comments.translator;
        else comments.translator = action.comment;
      }
      if (isPluralEntry(current)) {
        return createPluralEntry(current.msgid, current.msgidPlural, current.msgstr, {
          ...current,
          flags: flags as any,
          comments,
        });
      } else {
        return createSingularEntry(current.msgid, current.msgstr, {
          ...current,
          flags: flags as any,
          comments,
        });
      }
    });
    this.requestSave();
    this.render();
  }

  private async saveProjectFile(projFile: ProjectFile): Promise<void> {
    await this.app.vault.modify(projFile.file, this.poConverter.compile(projFile.poFile));
    projFile.stats = getStatistics(projFile.poFile);
    new Notice(`Saved ${projFile.language}`);
    this.render();
  }

  private getSourceLanguage(): string {
    const folderPath = this.file?.parent?.path ?? "/";
    return (
      this.plugin.settings.projectSourceLanguages[folderPath] ??
      this.mainPoFile?.header.language ??
      this.file?.basename ??
      ""
    );
  }

  private async setSourceLanguage(lang: string): Promise<void> {
    const folderPath = this.file?.parent?.path ?? "/";
    this.plugin.settings.projectSourceLanguages = {
      ...this.plugin.settings.projectSourceLanguages,
      [folderPath]: lang,
    };
    await this.plugin.saveSettings();
    this.render();
  }

  private getNplurals(): number {
    const pluralForms = this.mainPoFile?.header.pluralForms ?? "";
    return parseNplurals(pluralForms);
  }

  private getCurrentLanguage(): string {
    return this.mainPoFile?.header.language ?? "en";
  }

  private getAggregatedProjectStats(): { fuzzy: number; comments: number } {
    let fuzzyCount = 0;
    let commentsCount = 0;

    const allFiles = [this.mainPoFile, ...this.siblingPoFiles.map((s) => s.poFile)];
    for (const poFile of allFiles) {
      if (!poFile) continue;
      for (const entry of poFile.entries) {
        if ((entry.flags ?? []).includes("fuzzy")) fuzzyCount++;
        if (entry.comments?.translator) commentsCount++;
      }
    }

    return { fuzzy: fuzzyCount, comments: commentsCount };
  }

  private getAggregatedFlagCounts(): Record<string, number> {
    const counts: Record<string, number> = {};

    const allFiles = [this.mainPoFile, ...this.siblingPoFiles.map((s) => s.poFile)];
    for (const poFile of allFiles) {
      if (!poFile) continue;
      for (const entry of poFile.entries) {
        for (const flag of entry.flags ?? []) {
          counts[flag] = (counts[flag] ?? 0) + 1;
        }
      }
    }

    return counts;
  }

  private updateFileHeader(updates: Record<string, string>): void {
    if (!this.mainPoFile) return;
    this.mainPoFile = {
      ...this.mainPoFile,
      header: {
        ...this.mainPoFile.header,
        ...updates,
      },
    };
    this.requestSave();
  }

  private openAddEntryModal(): void {
    new POEntryModal(
      this.app,
      undefined,
      (updatedEntry) => {
        if (!this.mainPoFile) return;
        this.mainPoFile = addEntryToFile(this.mainPoFile, updatedEntry);
        this.requestSave();
        this.render();
      },
      this.plugin.settings.quickActions,
      this.getNplurals(),
      this.getCurrentLanguage(),
      (updates) => this.updateFileHeader(updates),
      this.isPOTFile,
    ).open();
  }

  private openEditEntryModal(entry: POEntry): void {
    new POEntryModal(
      this.app,
      entry,
      (updatedEntry) => {
        if (!this.mainPoFile) return;
        this.mainPoFile = updateEntry(this.mainPoFile, entry.msgid, () => updatedEntry);
        this.requestSave();
        this.render();
      },
      this.plugin.settings.quickActions,
      this.getNplurals(),
      this.getCurrentLanguage(),
      (updates) => this.updateFileHeader(updates),
      this.isPOTFile,
    ).open();
  }

  private deleteEntry(entry: POEntry): void {
    if (!this.mainPoFile) return;
    this.mainPoFile = removeEntry(this.mainPoFile, entry.msgid);
    this.requestSave();
    this.render();
  }

  private async generatePOT(): Promise<void> {
    if (!this.file || !this.mainPoFile) return;

    const sourceLang = this.getSourceLanguage();
    const mainLang = this.mainPoFile.header.language || this.file.basename;

    let sourcePoFile: POFile;
    let sourceBasename: string;
    if (mainLang === sourceLang || !this.isProjectMode) {
      sourcePoFile = this.mainPoFile;
      sourceBasename = this.file.basename.replace(/\.po$/, "");
    } else {
      const sourceSibling = this.siblingPoFiles.find((s) => s.language === sourceLang);
      if (!sourceSibling) {
        new Notice("Source language file not found");
        return;
      }
      sourcePoFile = sourceSibling.poFile;
      sourceBasename = sourceSibling.file.basename.replace(/\.po$/, "");
    }

    const potEntries = sourcePoFile.entries.map((e) => {
      if (isPluralEntry(e)) {
        const nPlurals = e.msgstr?.length ?? 2;
        return createPluralEntry(e.msgid, e.msgidPlural, Array(Math.max(nPlurals, 1)).fill(""), {
          msgctxt: e.msgctxt,
          comments: { extracted: e.comments?.extracted, reference: e.comments?.reference },
          flags: e.flags ?? [],
          obsolete: e.obsolete,
        });
      } else {
        return createSingularEntry(e.msgid, "", {
          msgctxt: e.msgctxt,
          comments: { extracted: e.comments?.extracted, reference: e.comments?.reference },
          flags: e.flags ?? [],
          obsolete: e.obsolete,
        });
      }
    });

    const potFile: POFile = {
      charset: "utf-8",
      header: {
        ...this.mainPoFile.header,
        contentType: "text/plain; charset=UTF-8",
        contentTransferEncoding: "8bit",
        poRevisionDate: new Date().toISOString().replace(/\.\d{3}Z$/, "+0000"),
        mimeVersion: "1.0",
        xGenerator: "Obsidian PO Editor",
      },
      entries: potEntries,
      obsolete: [],
    };

    const folderPath = this.file.parent?.path;
    const potPath = `${(folderPath === "/" ? "" : `${folderPath}/`) + sourceBasename}.pot`;
    try {
      const existing = this.app.vault.getAbstractFileByPath(potPath);
      if (existing instanceof TFile) {
        await this.app.vault.modify(existing, this.poConverter.compile(potFile));
      } else {
        await this.app.vault.create(potPath, this.poConverter.compile(potFile));
      }
      new Notice(`POT generated: ${potPath}`);
    } catch {
      new Notice("Failed to generate POT file");
    }
  }

  private async synchronizeEntries(customSource?: SyncSource): Promise<void> {
    if (!this.mainPoFile || !this.isProjectMode) return;

    const sourceLang = customSource?.language ?? this.getSourceLanguage();
    const mainLang = this.mainPoFile.header.language || this.file?.basename || "";

    let sourceEntries: POEntry[];
    if (customSource?.entries) {
      sourceEntries = customSource.entries;
    } else if (mainLang === sourceLang) {
      sourceEntries = this.mainPoFile.entries;
    } else {
      const sourceSibling = this.siblingPoFiles.find((s) => s.language === sourceLang);
      sourceEntries = sourceSibling?.poFile.entries ?? this.mainPoFile.entries;
    }

    let syncCount = 0;

    // Sync non-source siblings
    for (const spf of this.siblingPoFiles) {
      if (spf.language === sourceLang) continue;
      const tgtNplurals = parseNplurals(spf.poFile.header.pluralForms ?? "");
      let changed = false;
      for (const src of sourceEntries) {
        if (spf.poFile.entries.find((e) => e.msgid === src.msgid && e.msgctxt === src.msgctxt))
          continue;
        const newEntry = isPluralEntry(src)
          ? createPluralEntry(
              src.msgid,
              src.msgidPlural,
              Array(Math.max(1, tgtNplurals)).fill(""),
              {
                msgctxt: src.msgctxt,
                comments: {},
                flags: [],
                obsolete: false,
              },
            )
          : createSingularEntry(src.msgid, "", {
              msgctxt: src.msgctxt,
              comments: {},
              flags: [],
              obsolete: false,
            });
        spf.poFile = addEntryToFile(spf.poFile, newEntry);
        syncCount++;
        changed = true;
      }
      if (changed) {
        await this.app.vault.modify(spf.file, this.poConverter.compile(spf.poFile));
        spf.stats = getStatistics(spf.poFile);
      }
    }

    // Sync main file if not source
    if (mainLang !== sourceLang) {
      const mainNplurals = this.getNplurals();
      let changed = false;
      for (const src of sourceEntries) {
        if (this.mainPoFile.entries.find((e) => e.msgid === src.msgid && e.msgctxt === src.msgctxt))
          continue;
        const newEntry = isPluralEntry(src)
          ? createPluralEntry(
              src.msgid,
              src.msgidPlural,
              Array(Math.max(1, mainNplurals)).fill(""),
              {
                msgctxt: src.msgctxt,
                comments: {},
                flags: [],
                obsolete: false,
              },
            )
          : createSingularEntry(src.msgid, "", {
              msgctxt: src.msgctxt,
              comments: {},
              flags: [],
              obsolete: false,
            });
        this.mainPoFile = addEntryToFile(this.mainPoFile, newEntry);
        syncCount++;
        changed = true;
      }
      if (changed) this.requestSave();
    }

    new Notice(
      syncCount > 0
        ? `Synced ${syncCount} missing entr${syncCount > 1 ? "ies" : "y"}`
        : "Already in sync",
    );
    this.render();
  }

  private openSyncModal(): void {
    if (!this.file?.parent) return;

    new SyncModal(
      this.app,
      this.file.parent.children
        .filter((f): f is TFile => f instanceof TFile && f.extension === "pot")
        .map((f) => ({ file: f, path: f.path, name: f.name })),
      this.siblingPoFiles.map((s) => ({ language: s.language, file: s.file })),
      this.getSourceLanguage(),
      this.isProjectMode,
      async (source) => {
        await this.synchronizeEntries(source);
      },
      this.parseUseCase,
      this.poConverter,
    ).open();
  }

  private openExportModal(): void {
    new ConvertModal(
      this.app,
      "export",
      async (result) => {
        if (!this.mainPoFile || !this.file) return;

        // Strip all translations before export
        const stripped: POFile = {
          ...this.mainPoFile,
          entries: this.mainPoFile.entries.map((e) => {
            if (isPluralEntry(e)) {
              return createPluralEntry(e.msgid, e.msgidPlural, ["", ""], {
                msgctxt: e.msgctxt,
                comments: e.comments,
                flags: e.flags,
                obsolete: e.obsolete,
              });
            } else {
              return createSingularEntry(e.msgid, "", {
                msgctxt: e.msgctxt,
                comments: e.comments,
                flags: e.flags,
                obsolete: e.obsolete,
              });
            }
          }),
        };

        const converted = this.convertToFormatUseCase.execute({
          poFile: stripped,
          targetFormat: result.format,
        });
        if (!converted.success || !converted.content) {
          new Notice(`Export failed: ${converted.error}`);
          return;
        }

        const ext =
          result.format === "arb"
            ? "arb"
            : result.format === "json" || result.format === "icu"
              ? "json"
              : result.format === "yaml"
                ? "yaml"
                : result.format.startsWith("xliff")
                  ? "xliff"
                  : result.format;
        const fileName = result.fileName || `${this.file.basename}.${ext}`;
        const folderPath = this.file.parent?.path;
        const outPath = (folderPath === "/" ? "" : `${folderPath}/`) + fileName;
        try {
          const existing = this.app.vault.getAbstractFileByPath(outPath);
          if (existing instanceof TFile) {
            await this.app.vault.modify(existing, converted.content);
          } else {
            await this.app.vault.create(outPath, converted.content);
          }
          new Notice(`Exported: ${outPath}`);
        } catch {
          new Notice("Export failed: could not write file");
        }
      },
      () => this.generatePOT(),
    ).open();
  }
}

interface SyncSource {
  type: "pot" | "po";
  language: string;
  entries: POEntry[];
}

class SyncModal extends Modal {
  private potFiles: { file: TFile; path: string; name: string }[];
  private poFiles: { language: string; file: TFile }[];
  private defaultSourceLang: string;
  private onSubmit: (source: SyncSource) => void;
  private selectedType: "pot" | "po";
  private isProjectMode: boolean;
  private parseUseCase: ParsePOUseCase;
  private poConverter: POConverter;

  constructor(
    app: App,
    potFiles: { file: TFile; path: string; name: string }[],
    poFiles: { language: string; file: TFile }[],
    defaultSourceLang: string,
    isProjectMode: boolean,
    onSubmit: (source: SyncSource) => void,
    parseUseCase: ParsePOUseCase,
    poConverter: POConverter,
  ) {
    super(app);
    this.potFiles = potFiles;
    this.poFiles = poFiles;
    this.defaultSourceLang = defaultSourceLang;
    this.isProjectMode = isProjectMode;
    this.onSubmit = onSubmit;
    this.selectedType = isProjectMode ? "po" : "pot";
    this.parseUseCase = parseUseCase;
    this.poConverter = poConverter;
  }

  async onOpen(): Promise<void> {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "Sync Entries" });

    const form = contentEl.createDiv({
      attr: { style: "display: flex; flex-direction: column; gap: 16px; padding: 8px 0;" },
    });

    const sourceSelectRow = form.createDiv();
    const sourceLabel = sourceSelectRow.createEl("label", {
      text: "Source",
      attr: {
        style:
          "display: block; font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px;",
      },
    });
    const sourceSelect = sourceSelectRow.createEl("select", {
      attr: { style: "width: 100%; border-radius: 6px; padding: 6px 10px;" },
    }) as HTMLSelectElement;

    if (!this.isProjectMode) {
      sourceLabel.createSpan({ text: " (POT File)" });
      for (const pf of this.potFiles) {
        sourceSelect.createEl("option", { value: pf.path, text: pf.name });
      }
    } else {
      const typeRow = form.createDiv();
      typeRow.createEl("label", {
        text: "Source Type",
        attr: {
          style:
            "display: block; font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 8px;",
        },
      });
      const optionsRow = typeRow.createDiv({
        attr: { style: "display: flex; gap: 16px;" },
      });

      const createRadio = (value: "pot" | "po", label: string) => {
        const wrapper = optionsRow.createDiv({
          attr: { style: "display: flex; align-items: center; gap: 6px;" },
        });
        const radio = wrapper.createEl("input", {
          attr: { type: "radio", name: "syncType", value },
        });
        wrapper.createSpan({ text: label, attr: { style: "font-size: 13px;" } });
        radio.onchange = () => {
          this.selectedType = value;
          if (value === "po") {
            renderPoOptions();
          } else {
            renderPotOptions();
          }
        };
        return radio;
      };

      const poRadio = createRadio("po", "From Language File");
      poRadio.checked = true;
      createRadio("pot", "From POT File");

      const renderPoOptions = () => {
        sourceSelect.empty();
        const defaultLang = this.defaultSourceLang;
        for (const pf of this.poFiles) {
          const opt = sourceSelect.createEl("option", {
            value: pf.language,
            text: pf.language + (pf.language === defaultLang ? " (source)" : ""),
          });
          if (pf.language === defaultLang) {
            opt.selected = true;
          }
        }
      };

      const renderPotOptions = () => {
        sourceSelect.empty();
        for (const pf of this.potFiles) {
          sourceSelect.createEl("option", { value: pf.path, text: pf.name });
        }
      };

      renderPoOptions();
    }

    const btnRow = form.createDiv({
      attr: { style: "display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px;" },
    });
    btnRow.createEl("button", {
      cls: "btn",
      text: "Cancel",
      attr: { style: "padding: 6px 16px;" },
    }).onclick = () => this.close();
    btnRow.createEl("button", {
      cls: "btn btn-primary",
      text: "Sync",
      attr: { style: "padding: 6px 16px;" },
    }).onclick = async () => {
      const sourceLang = sourceSelect.value;
      let entries: POEntry[] = [];
      const syncType = this.isProjectMode ? this.selectedType : "pot";

      if (syncType === "pot") {
        const potFile = this.potFiles.find((f) => f.path === sourceLang);
        if (potFile) {
          const content = await this.app.vault.read(potFile.file);
          const parseResult = this.parseUseCase.execute({
            content,
            converter: this.poConverter,
          });
          if (parseResult.success && parseResult.poFile) {
            entries = parseResult.poFile.entries;
          }
        }
      } else {
        const poFile = this.poFiles.find((f) => f.language === sourceLang);
        if (poFile) {
          const content = await this.app.vault.read(poFile.file);
          const parseResult = this.parseUseCase.execute({
            content,
            converter: this.poConverter,
          });
          if (parseResult.success && parseResult.poFile) {
            entries = parseResult.poFile.entries;
          }
        }
      }

      this.onSubmit({ type: syncType, language: sourceLang, entries });
      this.close();
    };
  }
}
