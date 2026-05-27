import { type IPOFileIO, type TranslationFormat } from "@application/index";
import { POStateStore } from "@application/services/POStateStore";
import { type SyncOrphanStrategy } from "@application/use-cases/SyncPOFiles";
import {
  entriesMatch,
  isPluralEntry,
  parseNplurals,
  PLURAL_FORMS,
  type POEntry,
  type POFile,
  type POFlag,
  type POPluralEntry,
} from "@domain/index";
import {
  buildFilter,
  buildFilterOptions,
  buildLanguageStats,
  type FilterChangeCallback,
  type FilterOptions,
  type IPOStatsPanel,
  type LanguageStat,
  PO_STATS_VIEW_TYPE,
  POStatsView,
  type EditorMode,
  type EditorPanelState,
  type EditorPanelPosition,
  PO_ROW_HEIGHT,
  type POEntryItem,
  type POViewActions,
  type POViewFilterState,
  type POViewQueries,
  type POViewSnapshot,
  NEW_ENTRY_SENTINEL,
  POTextModeRenderer,
  POStatsDashboardRenderer,
  POEntryListRenderer,
  POEditorPanelRenderer,
  type POViewController,
  POTextEditor,
  ConfirmModal,
  HeaderFixModal,
  type HeaderDiff,
  POFileDataManager,
  POFileSyncManager,
} from "@presentation/index";
import { Menu, Notice, TextFileView, TFile, type WorkspaceLeaf } from "obsidian";
import type { VList } from "vlist";

import type POEditorPlugin from "@/main";
import type { CustomAction } from "@/presentation/settings/POSettingsTab";

import {
  isFuzzy as isEntryFuzzy,
  isMissing as isEntryMissing,
  entryKey as helpersEntryKey,
} from "./po/POEntryHelpers";
import { type SyncSource } from "./po/POViewTypes";

export class POView extends TextFileView implements POViewQueries, POViewActions {
  private mainPoFile: POFile | null = null;
  private editorMode: EditorMode = "grid";
  private poTextEditor: POTextEditor | null = null;
  private pendingTextContent = "";
  private selectedEntry: POEntry | null = null;
  private filteredEntries: POEntry[] = [];
  private editorPanelEl: HTMLElement | null = null;
  private splitEl: HTMLElement | null = null;
  private vlistInstance: VList<POEntryItem> | null = null;
  private vlistContainerEl: HTMLElement | null = null;
  private rowRenderer: (() => void) | null = null;
  private editorPanelState: EditorPanelState;
  private preOverlayPanelState: EditorPanelState = "half";
  private editorPanelHeightPercent: number;
  private saveLayoutTimer: ReturnType<typeof window.setTimeout> | null = null;
  private statsViewReference: POStatsView | null = null;
  private readonly dataManager: POFileDataManager;
  private readonly syncManager: POFileSyncManager;

  getPlugin(): POEditorPlugin {
    return this.plugin;
  }
  private filters: POViewFilterState = {
    includedStatuses: [],
    includedFlags: [],
    includedComments: [],
    includedContexts: [],
    includedLanguages: [],
    includedTypes: [],
    activeSearch: "",
    fuzzyOnly: false,
    missingOnly: false,
  };

  private compiledPatterns: { source: readonly string[]; regexes: RegExp[] } | null = null;
  private readonly statsDashboardRenderer = new POStatsDashboardRenderer(this, () =>
    this.toggleStatsPanel(),
  );
  private readonly listRenderer = new POEntryListRenderer(this, this, this.statsDashboardRenderer);
  private readonly editorPanelRenderer = new POEditorPanelRenderer(this, this);
  private readonly textModeRenderer = new POTextModeRenderer(this);
  private static readonly MIN_EDITOR_PANEL_HEIGHT = 260;
  private static readonly MIN_LIST_PANEL_WIDTH = 200;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: POEditorPlugin,
    private readonly controller: POViewController,
    private readonly fileIO: IPOFileIO,
    private readonly stateStore: POStateStore,
  ) {
    super(leaf);
    this.editorPanelState = plugin.settings.editorPanelState;
    this.editorPanelHeightPercent = plugin.settings.editorPanelHeightPercent;
    this.dataManager = new POFileDataManager(fileIO, controller);
    this.syncManager = new POFileSyncManager(fileIO, controller);
  }

  getViewType(): string {
    return "po-view";
  }

  onload(): void {
    super.onload();
    this.addAction("plus", "New entry", () => this.addEntry());
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (!this.file) return;
        if (file instanceof TFile && (file.extension === "po" || file.extension === "pot")) {
          if (file.parent?.path === this.file.parent?.path && file.path !== this.file.path) {
            this.dataManager.invalidateCache();
            void this.loadProjectFiles();
          }
        }
      }),
    );
  }

  onunload(): void {
    if (this.saveLayoutTimer !== null) window.clearTimeout(this.saveLayoutTimer);
    this.saveFileState();
    super.onunload();
  }

  onMoreOptionsMenu(menu: Menu): void {
    menu.addItem((item) =>
      item
        .setTitle("PO · sync msgid")
        .setIcon("refresh-cw")
        .setSection("po-editor")
        .onClick(() => this.syncEntries()),
    );
    menu.addItem((item) =>
      item
        .setTitle("PO · export")
        .setIcon("upload")
        .setSection("po-editor")
        .onClick(() => this.exportFile()),
    );
  }

  private async validateHeaders(): Promise<void> {
    if (!this.mainPoFile || !this.file) return;

    const currentHeader = this.mainPoFile.header;
    const expectedLanguage = this.file.basename;
    const svc = this.controller.mutationService;

    const recommendedPlurals = svc.getPluralFormsHeader(expectedLanguage);

    const diffs: HeaderDiff[] = [];

    const langDiff: HeaderDiff = {
      key: "Language",
      current: currentHeader.language || "",
      recommended: expectedLanguage,
      isDifferent: currentHeader.language !== expectedLanguage,
    };

    const pluralDiff: HeaderDiff = {
      key: "Plural-Forms",
      current: currentHeader.pluralForms || "",
      recommended: recommendedPlurals,
      isDifferent: currentHeader.pluralForms !== recommendedPlurals,
    };

    diffs.push(langDiff, pluralDiff);

    const isUnd = currentHeader.language === "und";
    const normalizedLang = expectedLanguage.toLowerCase().replace("_", "-");
    const isKnownLanguage = !!(
      PLURAL_FORMS[normalizedLang] || PLURAL_FORMS[normalizedLang.split("-")[0]]
    );
    const hasDiff = langDiff.isDifferent || pluralDiff.isDifferent;

    if (isUnd || (isKnownLanguage && hasDiff && this.plugin.settings.promptHeaderFix)) {
      const recommendedHeader = svc.createPOHeader(expectedLanguage, {
        ...currentHeader,
        language: expectedLanguage,
        pluralForms: recommendedPlurals,
      });

      const modal = new HeaderFixModal(this.app, currentHeader, recommendedHeader, diffs);
      const shouldUpdate = await modal.confirm();
      if (shouldUpdate) {
        this.mainPoFile = svc.updateHeader(this.mainPoFile, recommendedHeader);
        this.requestSave();
      }
    }
  }

  private renderLoading(): void {
    this.contentEl.empty();
    const loadingContainer = this.contentEl.createDiv({ cls: "po-loading-container" });
    loadingContainer.createDiv({ cls: "po-loading-spinner" });
    loadingContainer.createDiv({ cls: "po-loading-text", text: "Loading PO file..." });
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

  get currentEditorMode(): EditorMode {
    return this.editorMode;
  }

  clear(): void {
    this.destroyTextEditor();
    this.editorMode = "grid";
    this.pendingTextContent = "";
    this.contentEl.empty();
  }

  setViewData(data: string, _clear: boolean): void {
    this.destroyTextEditor();
    this.editorMode = "grid";
    this.pendingTextContent = "";
    this.renderLoading();
    void this.loadViewData(data);
  }

  private async loadViewData(data: string): Promise<void> {
    await new Promise((resolve) => window.requestAnimationFrame(resolve));

    const parseResult = await this.controller.parse(data, (processed, total) => {
      const percent = Math.round((processed / total) * 100);
      const textEl = this.contentEl.querySelector(".po-loading-text");
      if (textEl) textEl.textContent = `Parsing entries... ${percent}%`;
    });

    if (!parseResult.success || !parseResult.poFile) {
      new Notice("Failed to parse PO file: " + (parseResult.error || "Unknown error"));
      return;
    }

    this.mainPoFile = parseResult.poFile;
    this.stateStore.setState(this.mainPoFile);
    this.register(
      this.stateStore.subscribe((poFile) => {
        this.mainPoFile = poFile;
      }),
    );
    await this.validateHeaders();
    await this.loadProjectFiles();
    this.restoreFileState();
    this.render();
    this.restoreScrollPosition();
    this.plugin.updateModeStatusBar(this.editorMode, this);
  }

  getViewData(): string {
    if (this.editorMode === "text") {
      if (this.poTextEditor) return this.poTextEditor.getValue();
      if (this.pendingTextContent) return this.pendingTextContent;
    }
    if (!this.mainPoFile || !this.mainPoFile.entries) return "";
    return this.controller.compile(
      this.isPOTFile ? this.syncManager.toPOTFile(this.mainPoFile) : this.mainPoFile,
    );
  }

  render(): void {
    if (!this.file || !this.mainPoFile) return;
    this.preserveSelectedEntry();
    this.captureTextEditorContent();
    this.destroyVirtualList();
    this.contentEl.empty();
    this.editorPanelEl = null;
    this.splitEl = null;

    if (this.editorMode === "text") {
      this.poTextEditor = this.textModeRenderer.render(
        this.contentEl,
        this.pendingTextContent,
        this.plugin.settings.sourceEditable,
      );
      return;
    }

    this.syncPanel();
    const position = this.plugin.settings.editorPanelPosition;
    const split = this.contentEl.createDiv({ cls: "po-split po-split--" + position });
    this.splitEl = split;

    const renderList = (container: HTMLElement) => {
      const listPanel = container.createDiv({ cls: "po-list-panel" });
      const listResult = this.listRenderer.render(listPanel, this.selectedEntry);
      this.applySplitSizeConstraints();
      this.vlistInstance = listResult.list;
      this.vlistContainerEl = listResult.container;
      this.filteredEntries = listResult.filteredEntries;
      this.rowRenderer = () => {
        this.filteredEntries = listResult.refresh(this.selectedEntry);
      };
    };

    const renderEditor = (container: HTMLElement) => {
      this.editorPanelEl = container.createDiv({ cls: "po-editor-panel" });
      this.editorPanelRenderer.render(this.editorPanelEl, this.selectedEntry);
    };

    if (position === "left" || position === "right") {
      const innerRow = split.createDiv({ cls: "po-split-inner" });
      if (position === "left") {
        renderEditor(innerRow);
        renderList(innerRow);
      } else {
        renderList(innerRow);
        renderEditor(innerRow);
      }
      const toolbar = innerRow.querySelector<HTMLElement>(".po-toolbar");
      if (toolbar) split.insertBefore(toolbar, innerRow);
    } else if (position === "top") {
      renderEditor(split);
      renderList(split);
    } else {
      renderList(split);
      renderEditor(split);
    }

    this.applySplitState();
  }

  getSnapshot(): POViewSnapshot {
    if (!this.file || !this.mainPoFile) {
      throw new Error("POView snapshot requested before a PO file is loaded.");
    }
    return {
      file: this.file,
      mainPoFile: this.mainPoFile,
      siblingPoFiles: this.dataManager.siblingPoFiles,
      isPOTFile: this.isPOTFile,
      filters: this.filters,
      editorPanelState: this.editorPanelState,
      editorPanelPosition: this.plugin.settings.editorPanelPosition,
      editorPanelHeightPercent: this.editorPanelHeightPercent,
      quickActions: this.plugin.settings.quickActions,
      sourceEditable: this.plugin.settings.sourceEditable,
    };
  }

  buildFilter() {
    return buildFilter(this.filters);
  }

  getFilterOptions(): FilterOptions | null {
    if (!this.mainPoFile || !this.file) return null;
    return buildFilterOptions(this.getSnapshot(), this.getSourceLanguage());
  }

  getLanguageStats(): LanguageStat[] {
    if (!this.mainPoFile || !this.file) return [];
    return buildLanguageStats(this.getSnapshot(), this.getSourceLanguage());
  }

  syncWithPanel(panel: IPOStatsPanel): void {
    this.statsViewReference = panel instanceof POStatsView ? panel : null;
    if (!this.mainPoFile || !this.file) {
      panel.clear();
      return;
    }
    const stats = this.getLanguageStats();
    panel.setStats(stats);
    const opts = this.getFilterOptions();
    if (opts) {
      panel.setFilterData(opts, this.createPanelFilterCallback(panel));
    }
  }

  detectPlaceholders(text: string): string[] {
    const patterns = this.plugin.settings.placeholderPatterns ?? [];
    if (this.compiledPatterns?.source !== patterns) {
      const regexes: RegExp[] = [];
      for (const pattern of patterns) {
        if (!pattern) continue;
        try {
          regexes.push(new RegExp(pattern, "g"));
        } catch {
          // Invalid user-defined regexes are ignored.
        }
      }
      this.compiledPatterns = { source: patterns, regexes };
    }
    const found: string[] = [];
    for (const regex of this.compiledPatterns.regexes) {
      const matches = text.match(regex);
      if (matches) found.push(...matches);
    }
    return [...new Set(found)];
  }

  resolveReferenceText(entry: POEntry): string | string[] | undefined {
    return this.dataManager.resolveReferenceText(entry);
  }

  getFilteredEntries(): POEntry[] {
    return this.filteredEntries;
  }

  getSourceLanguage(): string {
    const folderPath = this.file?.parent?.path ?? "/";
    return this.plugin.settings.projectSourceLanguages[folderPath] ?? "";
  }

  async setSourceLanguage(language: string): Promise<void> {
    const folderPath = this.file?.parent?.path ?? "/";
    this.plugin.settings.projectSourceLanguages = {
      ...this.plugin.settings.projectSourceLanguages,
      [folderPath]: language || "",
    };
    await this.plugin.saveSettings();
    this.dataManager.invalidateCache();
    await this.loadProjectFiles();
    this.render();
  }

  switchToTextMode(): void {
    if (!this.mainPoFile) return;
    this.pendingTextContent = this.controller.compile(this.mainPoFile);
    this.editorMode = "text";
    this.render();
    this.plugin.updateModeStatusBar("text", this);
  }

  async switchToGridMode(): Promise<void> {
    const content = this.poTextEditor ? this.poTextEditor.getValue() : this.pendingTextContent;
    const result = await this.controller.parse(content);
    if (!result.success || !result.poFile) {
      new Notice(`Invalid PO content: ${result.error ?? "parse error"}`);
      return;
    }
    this.mainPoFile = result.poFile;
    this.editorMode = "grid";
    this.pendingTextContent = "";
    this.render();
    this.requestSave();
    this.plugin.updateModeStatusBar("grid", this);
  }

  setSearch(search: string): void {
    this.filters = { ...this.filters, activeSearch: search };
    this.refreshRows();
  }

  setFuzzyOnly(value: boolean): void {
    this.filters = { ...this.filters, fuzzyOnly: value };
    this.refreshRows();
    this.splitEl?.querySelector(".po-filter-toggle--fuzzy")?.classList.toggle("active", value);
  }

  setMissingOnly(value: boolean): void {
    this.filters = { ...this.filters, missingOnly: value };
    this.refreshRows();
    this.splitEl?.querySelector(".po-filter-toggle--missing")?.classList.toggle("active", value);
  }

  addEntry(): void {
    if (!this.mainPoFile) return;
    const svc = this.controller.mutationService;
    const entry = svc.createSingularEntry(NEW_ENTRY_SENTINEL, "");
    this.mainPoFile = svc.addEntry(this.mainPoFile, entry);
    this.selectedEntry = entry;
    this.requestSave();
    this.refreshRows();
  }

  deleteEntry(entry: POEntry): void {
    if (!this.mainPoFile) return;
    if (this.selectedEntry && entriesMatch(this.selectedEntry, entry)) {
      this.selectedEntry = null;
    }
    this.mainPoFile = this.controller.mutationService.removeEntry(this.mainPoFile, entry.msgid);
    this.requestSave();
    this.refreshRows();
  }

  updateMsgid(entry: POEntry, newMsgid: string): void {
    if (!this.mainPoFile) return;
    const svc = this.controller.mutationService;
    const key = helpersEntryKey(entry);
    this.mainPoFile = svc.updateMsgid(this.mainPoFile, key, entry, newMsgid);
    this.selectedEntry =
      this.mainPoFile.entries.find(
        (e) =>
          helpersEntryKey(e) ===
          helpersEntryKey(
            isPluralEntry(entry)
              ? svc.createPluralEntry(newMsgid, entry.msgidPlural, entry.msgstr, entry)
              : svc.createSingularEntry(newMsgid, entry.msgstr, entry),
          ),
      ) ?? null;
    this.requestSave();
    this.preserveSelectedEntry();
    this.refreshRows();
    this.renderEditorPanel();
  }

  updateMsgidPlural(entry: POPluralEntry, newMsgidPlural: string): void {
    if (!this.mainPoFile) return;
    this.mainPoFile = this.controller.mutationService.updateMsgidPlural(
      this.mainPoFile,
      entry.msgid,
      newMsgidPlural,
    );
    this.requestSave();
    this.preserveSelectedEntry();
    this.refreshRows();
    this.renderEditorPanel();
  }

  updateMsgctxt(entry: POEntry, msgctxt: string | undefined): void {
    if (!this.mainPoFile) return;
    const svc = this.controller.mutationService;
    const oldKey = helpersEntryKey(entry);
    this.mainPoFile = svc.updateMsgctxt(this.mainPoFile, oldKey, entry, msgctxt);
    const newKey = `${entry.msgid}@@${msgctxt ?? ""}`;
    this.selectedEntry = this.mainPoFile.entries.find((e) => helpersEntryKey(e) === newKey) ?? null;
    this.requestSave();
    this.preserveSelectedEntry();
    this.refreshRows();
    this.renderEditorPanel();
  }

  exportFile(): void {
    this.openExportModal();
  }

  syncEntries(): void {
    void this.openSidePanel().then((panel) => {
      if (panel) {
        panel.switchToSync();
      }
    });
  }

  toggleStatsPanel(): void {
    const leaf = this.app.workspace.getLeavesOfType(PO_STATS_VIEW_TYPE)[0];
    if (leaf && leaf.view.containerEl.isShown()) {
      leaf.detach();
      this.app.workspace.rightSplit.collapse();
    } else {
      this.openStatsPanel();
    }
  }

  openStatsPanel(): void {
    void this.openSidePanel().then((panel) => {
      if (panel) panel.setStats(this.getLanguageStats());
    });
  }

  toggleFiltersPanel(): void {
    const leaf = this.app.workspace.getLeavesOfType(PO_STATS_VIEW_TYPE)[0];
    if (leaf && leaf.view.containerEl.isShown()) {
      leaf.detach();
      this.app.workspace.rightSplit.collapse();
    } else {
      this.openFiltersPanel();
    }
  }

  openFiltersPanel(): void {
    void this.openSidePanel().then((panel) => {
      if (!panel) return;
      this.syncWithPanel(panel);
      panel.switchToFilters();
    });
  }

  selectEntry(entry: POEntry, fromClick = false): void {
    if (this.selectedEntry?.msgid === NEW_ENTRY_SENTINEL || this.selectedEntry?.msgid === "") {
      new Notice("Set a msgid before switching entries.");
      return;
    }
    const previous = this.selectedEntry;
    this.selectedEntry = entry;
    this.updateVisibleSelection(previous, entry);

    const index = this.findFilteredEntryIndex(entry);
    if (!fromClick && index >= 0) this.vlistInstance?.scrollToIndex(index, "center");

    if (fromClick && this.editorPanelState === "closed") {
      this.editorPanelState = "half";
      this.applySplitState();
      this.plugin.settings.editorPanelState = "half";
      void this.plugin.saveSettings();
    }

    this.renderEditorPanel(true);
    this.saveFileState();
  }

  saveCurrentTranslation(value: string, advance: boolean, pluralIndex?: number): void {
    if (!this.selectedEntry || !this.mainPoFile) return;
    if (this.selectedEntry.msgid === NEW_ENTRY_SENTINEL || this.selectedEntry.msgid === "") return;
    const entry = this.selectedEntry;
    const idx = pluralIndex ?? 0;
    const current = isPluralEntry(entry) ? (entry.msgstr[idx] ?? "") : entry.msgstr;
    const nextEntry = advance ? this.filteredEntries[this.findFilteredEntryIndex(entry) + 1] : null;

    if (value !== current) {
      this.mainPoFile = this.controller.mutationService.saveTranslation(
        this.mainPoFile,
        entry.msgid,
        value,
        idx,
      );
      this.requestSave();
      this.rowRenderer?.();
      this.syncPanel();
      this.preserveSelectedEntry();
    }

    if (nextEntry) this.selectEntry(nextEntry);
  }

  navigateEntry(direction: -1 | 1, currentValue: string): void {
    this.saveCurrentTranslation(currentValue, false);
    if (!this.selectedEntry) return;
    const next = this.filteredEntries[this.findFilteredEntryIndex(this.selectedEntry) + direction];
    if (next) this.selectEntry(next);
  }

  navigateNextCommand(): void {
    this.navigateEntry(1, this.getCurrentEditorValue());
  }

  navigatePreviousCommand(): void {
    this.navigateEntry(-1, this.getCurrentEditorValue());
  }

  navigateNextUntranslated(): void {
    if (!this.mainPoFile) return;
    const entries = this.filteredEntries;
    const startIdx = this.selectedEntry ? this.findFilteredEntryIndex(this.selectedEntry) : -1;
    const needsAttention = (e: POEntry) => isEntryMissing(e) || isEntryFuzzy(e);

    for (let i = startIdx + 1; i < entries.length; i++) {
      if (needsAttention(entries[i])) {
        this.selectEntry(entries[i]);
        return;
      }
    }
    for (let i = 0; i < startIdx; i++) {
      if (needsAttention(entries[i])) {
        new Notice("Wrapped to beginning");
        this.selectEntry(entries[i]);
        return;
      }
    }
    new Notice("All entries translated");
  }

  confirmAndNextUntranslated(): void {
    if (!this.selectedEntry) {
      this.navigateNextUntranslated();
      return;
    }
    const value = this.getCurrentEditorValue();
    this.saveCurrentTranslation(value, false);
    if (isEntryFuzzy(this.selectedEntry)) {
      this.toggleFuzzy(this.selectedEntry);
    }
    this.navigateNextUntranslated();
  }

  toggleCurrentFuzzy(): void {
    if (this.selectedEntry) this.toggleFuzzy(this.selectedEntry);
  }

  closeEditorPanel(): void {
    this.setEditorPanelState("closed");
  }

  private getCurrentEditorValue(): string {
    const active = activeDocument!.activeElement;
    if (active?.instanceOf(HTMLTextAreaElement) && active.closest(".po-editor-panel")) {
      return active.value;
    }
    if (!this.selectedEntry) return "";
    return isPluralEntry(this.selectedEntry)
      ? (this.selectedEntry.msgstr[0] ?? "")
      : this.selectedEntry.msgstr;
  }

  private applyMutation(mutator: (poFile: POFile) => POFile): void {
    if (!this.mainPoFile) return;
    this.mainPoFile = mutator(this.mainPoFile);
    this.requestSave();
    this.preserveSelectedEntry();
    this.refreshRows();
    this.renderEditorPanel();
  }

  toggleFuzzy(entry: POEntry): void {
    this.applyMutation((poFile) =>
      this.controller.mutationService.toggleFuzzy(poFile, entry.msgid),
    );
  }

  markObsolete(entry: POEntry): void {
    this.applyMutation((poFile) =>
      this.controller.mutationService.markObsolete(poFile, entry.msgid),
    );
  }

  applyQuickAction(entry: POEntry, action: CustomAction): void {
    this.applyMutation((poFile) =>
      this.controller.mutationService.applyQuickAction(poFile, entry.msgid, {
        flag: action.flag as POFlag | undefined,
        comment: action.comment,
      }),
    );
  }

  private updateCommentField(
    entry: POEntry,
    field: "translator" | "reference" | "previous",
    value: string | undefined,
  ): void {
    this.applyMutation((poFile) =>
      this.controller.mutationService.updateCommentField(poFile, entry.msgid, field, value),
    );
  }

  updateTranslatorComment(entry: POEntry, comment: string | undefined): void {
    this.updateCommentField(entry, "translator", comment);
  }

  updateReferenceComment(entry: POEntry, reference: string | undefined): void {
    this.updateCommentField(entry, "reference", reference);
  }

  updatePreviousComment(entry: POEntry, previous: string | undefined): void {
    this.updateCommentField(entry, "previous", previous);
  }

  convertToPlural(entry: POEntry): void {
    if (!this.mainPoFile || isPluralEntry(entry)) return;
    const nplurals = this.getNplurals();
    this.applyMutation((poFile) =>
      this.controller.mutationService.convertToPlural(poFile, entry.msgid, nplurals),
    );
  }

  convertToSingular(entry: POEntry): void {
    if (!this.mainPoFile || !isPluralEntry(entry)) return;
    this.applyMutation((poFile) =>
      this.controller.mutationService.convertToSingular(poFile, entry.msgid),
    );
  }

  resizePluralForms(entry: POPluralEntry, count: number): void {
    this.applyMutation((poFile) =>
      this.controller.mutationService.resizePluralForms(poFile, entry.msgid, count),
    );
  }

  setLanguagePluralForms(language: string): void {
    this.applyMutation((poFile) =>
      this.controller.mutationService.setLanguagePluralForms(
        poFile,
        language,
        this.selectedEntry?.msgid,
      ),
    );
  }

  confirm(message: string): Promise<boolean> {
    const modal = new ConfirmModal(this.app, message);
    return modal.confirm();
  }

  setEditorPanelState(state: EditorPanelState): void {
    if (this.selectedEntry?.msgid === NEW_ENTRY_SENTINEL || this.selectedEntry?.msgid === "") {
      new Notice("Set a msgid before closing the panel.");
      return;
    }
    this.editorPanelState = state;
    this.applySplitState();
    if (state === "full") {
      this.editorPanelHeightPercent = this.getMaxEditorPanelHeightPercent();
      this.applySplitState();
    }
    if (state !== "overlay") {
      this.plugin.settings.editorPanelState = state;
      void this.plugin.saveSettings();
    }
    this.renderEditorPanel();
  }

  toggleEditorPanelOverlay(): void {
    if (this.editorPanelState === "overlay") {
      this.setEditorPanelState(this.preOverlayPanelState);
    } else {
      this.preOverlayPanelState =
        this.editorPanelState === "closed" ? "half" : this.editorPanelState;
      this.setEditorPanelState("overlay");
    }
  }

  setEditorPanelPosition(position: EditorPanelPosition): void {
    this.plugin.settings.editorPanelPosition = position;
    void this.plugin.saveSettings();
    this.render();
  }

  setEditorPanelHeight(percent: number): void {
    this.editorPanelHeightPercent = Math.min(
      this.getMaxEditorPanelHeightPercent(),
      Math.max(this.getMinEditorPanelHeightPercent(), percent),
    );
    this.applySplitState();
    if (this.saveLayoutTimer !== null) window.clearTimeout(this.saveLayoutTimer);
    this.saveLayoutTimer = window.setTimeout(() => {
      this.saveLayoutTimer = null;
      this.plugin.settings.editorPanelHeightPercent = this.editorPanelHeightPercent;
      void this.plugin.saveSettings();
    }, 500);
  }

  getOutputDirectory(): string {
    return this.plugin.settings.outputDirectory;
  }

  async setOutputDirectory(path: string): Promise<void> {
    this.plugin.settings.outputDirectory = path;
    await this.plugin.saveSettings();
  }

  private saveFileState(): void {
    if (!this.file?.path || !this.mainPoFile) return;
    const selectedEntryKey = this.selectedEntry ? helpersEntryKey(this.selectedEntry) : null;
    const scrollIndex = this.vlistInstance?.getScrollPosition() ?? 0;
    this.plugin.settings.fileEditorStates[this.file.path] = {
      selectedEntryKey,
      scrollIndex: Math.round(scrollIndex / PO_ROW_HEIGHT),
      editorPanelState: this.editorPanelState === "overlay" ? "half" : this.editorPanelState,
    };
    void this.plugin.saveSettings();
  }

  private restoreFileState(): void {
    if (!this.file?.path || !this.mainPoFile) return;
    const state = this.plugin.settings.fileEditorStates[this.file.path];
    if (!state) return;
    if (state.selectedEntryKey) {
      const entry = this.mainPoFile.entries.find(
        (e) => helpersEntryKey(e) === state.selectedEntryKey,
      );
      if (entry) this.selectedEntry = entry;
    }
    this.editorPanelState = state.editorPanelState;
  }

  private restoreScrollPosition(): void {
    if (!this.file?.path) return;
    const state = this.plugin.settings.fileEditorStates[this.file.path];
    if (!state) return;
    void window.requestAnimationFrame(() => {
      if (state.selectedEntryKey && this.selectedEntry) {
        const index = this.findFilteredEntryIndex(this.selectedEntry);
        if (index >= 0) {
          this.vlistInstance?.scrollToIndex(index, "center");
          return;
        }
      }
      const clampedIndex = Math.min(state.scrollIndex, this.filteredEntries.length - 1);
      if (clampedIndex > 0) this.vlistInstance?.scrollToIndex(clampedIndex, "start");
    });
  }

  private async loadProjectFiles(): Promise<void> {
    if (!this.file) return;
    await this.dataManager.loadProjectFiles(this.file, this.getSourceLanguage());
  }

  private createPanelFilterCallback(_panel: IPOStatsPanel): FilterChangeCallback {
    return (key, values) => {
      this.filters = { ...this.filters, [key]: values };
      this.refreshRows();
    };
  }

  private syncPanel(): void {
    if (this.statsViewReference) {
      this.syncWithPanel(this.statsViewReference);
      return;
    }
    const view = this.app.workspace.getLeavesOfType(PO_STATS_VIEW_TYPE)[0]?.view;
    if (view instanceof POStatsView) this.syncWithPanel(view);
  }

  private async openSidePanel(): Promise<IPOStatsPanel | null> {
    let leaf = this.app.workspace.getLeavesOfType(PO_STATS_VIEW_TYPE)[0];
    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false) ?? this.app.workspace.getLeaf("split");
      await leaf.setViewState({ type: PO_STATS_VIEW_TYPE, active: true });
    }
    void this.app.workspace.revealLeaf(leaf);
    return leaf.view instanceof POStatsView ? leaf.view : null;
  }

  getAvailableFiles(): { poFiles: TFile[]; potFiles: TFile[] } {
    if (!this.file?.parent) return { poFiles: [], potFiles: [] };
    const children = this.file.parent.children;
    const poFiles = children.filter((f): f is TFile => f instanceof TFile && f.extension === "po");
    const potFiles = children.filter(
      (f): f is TFile => f instanceof TFile && f.extension === "pot",
    );
    return { poFiles, potFiles };
  }

  private async synchronizeEntries(
    customSource?: SyncSource,
    orphanStrategy?: SyncOrphanStrategy,
  ): Promise<void> {
    if (!this.mainPoFile || !this.file) return;
    const result = await this.syncManager.synchronizeEntries(
      this.mainPoFile,
      this.file,
      this.dataManager.siblingPoFiles,
      this.getSourceLanguage(),
      orphanStrategy,
      customSource,
    );
    this.mainPoFile = result.mainPoFile;
    this.dataManager.siblingPoFiles = result.siblingPoFiles;
    new Notice(result.message);
    this.render();
  }

  async exportToFormat(format: TranslationFormat, outputDir?: string): Promise<void> {
    if (!this.mainPoFile || !this.file) return;
    const result = await this.syncManager.exportToFormat(
      this.mainPoFile,
      this.file,
      format,
      outputDir,
    );
    if (!result.success) {
      new Notice(`Export failed: ${result.error ?? "unknown error"}`);
      return;
    }
    const ext = this.syncManager.getExportExtension(format);
    const fileName = `${this.file.basename}.${ext}`;
    const folderPath = outputDir ?? this.file.parent?.path;
    new Notice(`Exported: ${(folderPath === "/" ? "" : `${folderPath}/`) + fileName}`);
  }

  private openExportModal(): void {
    void this.openSidePanel().then((panel) => {
      if (panel) {
        panel.switchToExport();
      }
    });
  }

  async generatePOT(sourceFile?: TFile): Promise<void> {
    if (!this.file || !this.mainPoFile) return;
    const potResult = await this.syncManager.generatePOT(
      this.mainPoFile,
      this.file,
      this.dataManager.siblingPoFiles,
      this.getSourceLanguage(),
      sourceFile,
    );
    if (!potResult.success) {
      new Notice(sourceFile ? "Failed to generate POT file" : "Source language file not found");
      return;
    }
    new Notice(`POT generated: ${potResult.path}`);
  }

  async syncFromFile(sourceFile: TFile, orphanStrategy?: SyncOrphanStrategy): Promise<void> {
    if (!this.mainPoFile || !this.file) return;
    try {
      const result = await this.syncManager.syncFromFile(
        this.mainPoFile,
        this.file,
        sourceFile,
        this.dataManager.siblingPoFiles,
        this.getSourceLanguage(),
        orphanStrategy,
      );
      this.mainPoFile = result.mainPoFile;
      this.dataManager.siblingPoFiles = result.siblingPoFiles;
      new Notice(result.message);
      this.render();
    } catch {
      new Notice("Failed to parse source file");
    }
  }

  private updateFileHeader(updates: Record<string, string>): void {
    if (!this.mainPoFile) return;
    this.mainPoFile = { ...this.mainPoFile, header: { ...this.mainPoFile.header, ...updates } };
    this.requestSave();
  }

  private getNplurals(): number {
    return parseNplurals(this.mainPoFile?.header.pluralForms ?? "");
  }

  private getCurrentLanguage(): string {
    return this.mainPoFile?.header.language ?? "en";
  }

  private preserveSelectedEntry(): void {
    if (!this.selectedEntry || !this.mainPoFile) return;
    this.selectedEntry =
      this.mainPoFile.entries.find((entry) => entriesMatch(entry, this.selectedEntry!)) ?? null;
  }

  private findFilteredEntryIndex(entry: POEntry): number {
    return this.filteredEntries.findIndex((candidate) => entriesMatch(candidate, entry));
  }

  private updateVisibleSelection(previous: POEntry | null, next: POEntry): void {
    if (!this.vlistContainerEl) return;
    if (previous) {
      const row = this.findVisibleRow(previous);
      row?.classList.remove("po-list-row--selected");
    }
    const nextRow = this.findVisibleRow(next);
    nextRow?.classList.add("po-list-row--selected");
  }

  private findVisibleRow(entry: POEntry): HTMLElement | null {
    const key = helpersEntryKey(entry);
    return (
      this.vlistContainerEl?.querySelector<HTMLElement>(`[data-entry-id="${CSS.escape(key)}"]`) ??
      null
    );
  }

  private renderEditorPanel(shouldFocus = false): void {
    if (!this.editorPanelEl) return;
    this.editorPanelEl.empty();
    this.editorPanelRenderer.render(this.editorPanelEl, this.selectedEntry, shouldFocus);
  }

  private refreshRows(): void {
    this.rowRenderer?.();
    this.syncPanel();
    this.renderEditorPanel();
  }

  private applySplitState(): void {
    if (!this.splitEl) return;
    const position = this.plugin.settings.editorPanelPosition;
    this.splitEl.classList.toggle("po-split--editor-full", this.editorPanelState === "full");
    this.splitEl.classList.toggle("po-split--editor-closed", this.editorPanelState === "closed");
    this.splitEl.classList.toggle("po-split--editor-overlay", this.editorPanelState === "overlay");
    this.applySplitSizeConstraints();
    const varName =
      position === "left" || position === "right"
        ? "--po-editor-panel-width"
        : "--po-editor-panel-height";
    this.splitEl.style.setProperty(varName, this.editorPanelHeightPercent + "%");
  }

  private applySplitSizeConstraints(): void {
    if (!this.splitEl) return;
    const position = this.plugin.settings.editorPanelPosition;
    const isHorizontal = position === "left" || position === "right";
    if (isHorizontal) {
      this.splitEl.style.setProperty(
        "--po-editor-panel-min-width",
        `${POView.MIN_EDITOR_PANEL_HEIGHT}px`,
      );
      this.splitEl.style.setProperty(
        "--po-editor-panel-max-width",
        `calc(100% - ${POView.MIN_LIST_PANEL_WIDTH}px)`,
      );
      this.splitEl.style.setProperty(
        "--po-list-panel-min-width",
        `${POView.MIN_LIST_PANEL_WIDTH}px`,
      );
      return;
    }
    const toolbar = this.splitEl.querySelector<HTMLElement>(".po-toolbar");
    const statsRow = this.splitEl.querySelector<HTMLElement>(".po-toolbar-stats");
    const toolbarHeight = toolbar?.offsetHeight ?? 104;
    const statsRowHeight =
      statsRow && toolbar
        ? Math.ceil(statsRow.getBoundingClientRect().bottom - toolbar.getBoundingClientRect().top)
        : 44;
    const listMinHeight = Math.max(
      88,
      Math.ceil(this.editorPanelState === "full" ? statsRowHeight : toolbarHeight),
    );
    this.splitEl.style.setProperty("--po-list-panel-min-height", `${listMinHeight}px`);
    this.splitEl.style.setProperty(
      "--po-editor-panel-min-height",
      `${POView.MIN_EDITOR_PANEL_HEIGHT}px`,
    );
    this.splitEl.style.setProperty(
      "--po-editor-panel-max-height",
      `calc(100% - ${listMinHeight}px)`,
    );
  }

  private getMinEditorPanelHeightPercent(): number {
    if (!this.splitEl) return 24;
    const position = this.plugin.settings.editorPanelPosition;
    const isHorizontal = position === "left" || position === "right";
    const rect = this.splitEl.getBoundingClientRect();
    const splitSize = isHorizontal ? rect.width : rect.height;
    if (splitSize <= 0) return 24;
    return Math.min(60, (POView.MIN_EDITOR_PANEL_HEIGHT / splitSize) * 100);
  }

  private getMaxEditorPanelHeightPercent(): number {
    if (!this.splitEl) return 88;
    const position = this.plugin.settings.editorPanelPosition;
    const isHorizontal = position === "left" || position === "right";
    const rect = this.splitEl.getBoundingClientRect();
    if (isHorizontal) {
      const splitWidth = rect.width;
      if (splitWidth <= 0) return 88;
      const maxPercent = ((splitWidth - POView.MIN_LIST_PANEL_WIDTH) / splitWidth) * 100;
      return Math.min(85, Math.max(24, maxPercent));
    }
    const splitHeight = rect.height;
    if (splitHeight <= 0) return 88;
    const toolbar = this.splitEl.querySelector<HTMLElement>(".po-toolbar");
    const statsRow = this.splitEl.querySelector<HTMLElement>(".po-toolbar-stats");
    const toolbarHeight = toolbar?.offsetHeight ?? 104;
    const statsRowHeight =
      statsRow && toolbar
        ? Math.ceil(statsRow.getBoundingClientRect().bottom - toolbar.getBoundingClientRect().top)
        : 44;
    const reservedHeight =
      this.editorPanelState === "full" ? Math.max(88, statsRowHeight) : Math.max(88, toolbarHeight);
    const maxPercent = ((splitHeight - reservedHeight) / splitHeight) * 100;
    return Math.min(92, Math.max(24, maxPercent));
  }

  private captureTextEditorContent(): void {
    if (this.editorMode !== "text" || !this.poTextEditor) return;
    this.pendingTextContent = this.poTextEditor.getValue();
    this.destroyTextEditor();
  }

  private destroyTextEditor(): void {
    this.poTextEditor?.destroy();
    this.poTextEditor = null;
  }

  private destroyVirtualList(): void {
    this.vlistInstance?.destroy();
    this.vlistInstance = null;
    this.vlistContainerEl = null;
    this.rowRenderer = null;
  }
}
