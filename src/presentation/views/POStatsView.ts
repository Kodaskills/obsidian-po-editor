import type { SyncOrphanStrategy } from "@application/index";
import { ItemView, Notice, setIcon, Setting } from "obsidian";

import { ExportPanelRenderer } from "./po/ExportPanelRenderer";
import type {
  FilterChangeCallback,
  FilterOptions,
  IPOStatsPanel,
  LanguageStat,
} from "./po/POViewTypes";
import { StatsDashboardRenderer } from "./po/StatsDashboardRenderer";
import { POView } from "./POView";

export const PO_STATS_VIEW_TYPE = "po-stats-view";
export type PanelMode = "stats" | "filters" | "export" | "sync";

export class POStatsView extends ItemView implements IPOStatsPanel {
  private languageStats: LanguageStat[] = [];
  private hasData = false;
  private mode: PanelMode = "stats";
  private filterOptions: FilterOptions | null = null;
  private onFilterChange: FilterChangeCallback | null = null;
  private statsSearch: string = "";
  private statsTags: string[] = [];
  private readonly exportRenderer = new ExportPanelRenderer();
  private readonly dashboardRenderer = new StatsDashboardRenderer();
  private activePOView: POView | null = null;
  private tabBarEl: HTMLElement | null = null;
  private contentAreaEl: HTMLElement | null = null;

  getViewType(): string {
    return PO_STATS_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "PO statistics";
  }

  getIcon(): string {
    return "po";
  }

  async onOpen(): Promise<void> {
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => this.refreshFromActiveLeaf()),
    );
    this.registerEvent(this.app.workspace.on("layout-change", () => this.refreshFromActiveLeaf()));
    this.refreshFromActiveLeaf();
  }

  clear(): void {
    this.languageStats = [];
    this.hasData = false;
    this.filterOptions = null;
    this.tabBarEl = null;
    this.contentAreaEl = null;
    this.renderContent();
  }

  refreshFromActiveLeaf(): void {
    const leaf = this.app.workspace.getMostRecentLeaf();
    const view = leaf?.view;
    if (view instanceof POView) {
      this.activePOView = view;
      view.syncWithPanel(this);
      return;
    }
    this.renderContent();
  }

  setStats(stats: LanguageStat[]): void {
    this.languageStats = stats;
    this.hasData = true;
    if (this.mode === "stats") this.refreshContentArea();
    else if (!this.contentAreaEl) this.renderContent();
  }

  setFilterData(options: FilterOptions, onChange: FilterChangeCallback): void {
    this.filterOptions = options;
    this.onFilterChange = onChange;
    if (this.mode === "filters") this.refreshContentArea();
    else if (!this.contentAreaEl) this.renderContent();
  }

  switchToFilters(): void {
    this.mode = "filters";
    this.renderContent();
  }

  switchToExport(): void {
    this.mode = "export";
    this.renderContent();
  }

  switchToSync(): void {
    this.mode = "sync";
    this.renderContent();
  }

  showFilters(options: FilterOptions, onChange: FilterChangeCallback): void {
    this.filterOptions = options;
    this.onFilterChange = onChange;
    this.switchToFilters();
  }

  updateFilterOptions(options: FilterOptions): void {
    this.filterOptions = options;
    if (this.mode === "filters") this.refreshContentArea();
  }

  private refreshContentArea(): void {
    if (!this.contentAreaEl) {
      this.renderContent();
      return;
    }
    this.contentAreaEl.empty();
    this.renderModeContent(this.contentAreaEl);
  }

  private renderContent(): void {
    const root = this.containerEl.children[1] as HTMLElement;
    root.empty();
    root.classList.add("po-stats-view-root");

    this.tabBarEl = root.createDiv({ cls: "po-stats-tab-bar" });

    const makeTab = (label: string, icon: string, mode: PanelMode) => {
      const tab = this.tabBarEl!.createDiv({
        cls: `po-stats-tab${this.mode === mode ? " is-active" : ""}`,
      });
      const iconEl = tab.createDiv({ cls: "po-stats-tab-icon" });
      setIcon(iconEl, icon);
      tab.createSpan({ text: label });
      tab.onclick = () => {
        this.mode = mode;
        this.renderContent();
      };
    };

    makeTab("Stats", "chart-no-axes-column", "stats");
    makeTab("Filters", "list-filter", "filters");
    makeTab("Export", "download", "export");
    makeTab("Sync", "refresh-cw", "sync");

    this.contentAreaEl = root.createDiv({ cls: "po-stats-content" });

    this.renderModeContent(this.contentAreaEl);
  }

  private renderModeContent(container: HTMLElement): void {
    if (this.mode === "stats") {
      this.renderStatsContent(container);
    } else if (this.mode === "filters") {
      this.renderFilterContent(container);
    } else if (this.mode === "sync") {
      this.renderSyncContent(container);
    } else {
      this.exportRenderer.render(container, this.activePOView ?? undefined);
    }
  }

  private renderEmptyState(root: HTMLElement, icon: string, message: string): void {
    const el = root.createDiv({ cls: "po-stats-empty" });
    const iconEl = el.createDiv({ cls: "po-stats-empty-icon" });
    setIcon(iconEl, icon);
    el.createDiv({ text: message, cls: "po-stats-empty-text" });
  }

  private renderSyncContent(root: HTMLElement): void {
    const view = this.activePOView;
    if (!view) {
      this.renderEmptyState(root, "refresh-cw", "Open a PO file to sync msgid.");
      return;
    }

    const { poFiles, potFiles } = view.getAvailableFiles();

    let sourceType: "pot" | "po" = "pot";

    const typeRow = root.createDiv({ cls: "po-sync-type-row" });

    const makeTypeCard = (type: "pot" | "po", label: string, desc: string, icon: string) => {
      const card = typeRow.createDiv({
        cls: `po-export-card${sourceType === type ? " po-export-card-selected" : ""}`,
      });
      const iconEl = card.createDiv({ cls: "po-sync-type-card-icon" });
      setIcon(iconEl, icon);
      const body = card.createDiv({ cls: "po-export-card-body" });
      body.createEl("span", { text: label, cls: "po-export-card-title" });
      body.createEl("span", { text: desc, cls: "po-export-card-desc" });
      card.onclick = () => {
        if (sourceType === type) return;
        sourceType = type;
        typeRow
          .querySelectorAll<HTMLElement>(".po-export-card")
          .forEach((c) => c.removeClass("po-export-card-selected"));
        card.addClass("po-export-card-selected");
        populateSelect();
      };
    };

    makeTypeCard("pot", "POT Template", "From a .pot template file", "file-text");
    makeTypeCard("po", "PO File", "From another .po translation", "languages");

    const select = root.createEl("select", { cls: "po-sync-select" });

    const populateSelect = () => {
      select.empty();
      const files = sourceType === "pot" ? potFiles : poFiles;
      if (files.length === 0) {
        select.createEl("option", {
          value: "",
          text: `(no ${sourceType === "pot" ? "POT" : "PO"} files)`,
          attr: { disabled: "true" },
        });
      } else {
        for (const f of files) {
          select.createEl("option", { value: f.path, text: f.name });
        }
      }
    };
    populateSelect();

    new Setting(root).setName("On missing entries").setHeading();

    let orphanStrategy: SyncOrphanStrategy = "add-only";

    const orphanRow = root.createDiv({ cls: "po-sync-orphan-row" });

    const strategyMeta: { value: SyncOrphanStrategy; label: string; desc: string; icon: string }[] =
      [
        {
          value: "add-only",
          label: "Add only",
          desc: "Add untranslated entries",
          icon: "plus-circle",
        },
        {
          value: "mark-obsolete-end",
          label: "Archive",
          desc: "Mark as obsolete (end of file)",
          icon: "archive",
        },
        { value: "delete", label: "Delete", desc: "Remove missing entries", icon: "trash-2" },
      ];

    for (const meta of strategyMeta) {
      const card = orphanRow.createDiv({
        cls: `po-export-card${orphanStrategy === meta.value ? " po-export-card-selected" : ""}`,
      });
      const iconEl = card.createDiv({ cls: "po-sync-type-card-icon" });
      setIcon(iconEl, meta.icon);
      const body = card.createDiv({ cls: "po-export-card-body" });
      body.createEl("span", { text: meta.label, cls: "po-export-card-title" });
      body.createEl("span", { text: meta.desc, cls: "po-export-card-desc" });
      card.onclick = () => {
        orphanStrategy = meta.value;
        orphanRow
          .querySelectorAll<HTMLElement>(".po-export-card")
          .forEach((c) => c.removeClass("po-export-card-selected"));
        card.addClass("po-export-card-selected");
      };
    }

    const hasSources = potFiles.length > 0 || poFiles.length > 0;
    const syncBtn = root.createDiv({
      cls: `po-sync-btn${hasSources ? "" : " is-disabled"}`,
    });
    const syncIcon = syncBtn.createDiv({ cls: "po-sync-btn-icon" });
    setIcon(syncIcon, "refresh-cw");
    syncBtn.createSpan({ text: "Sync MsgID", cls: "po-sync-btn-label" });

    if (hasSources) {
      syncBtn.onclick = async () => {
        syncBtn.classList.add("is-loading");
        const filePath = select.value;
        const allFiles = [...potFiles, ...poFiles];
        const file = allFiles.find((f) => f.path === filePath);
        if (file) {
          new Notice(`Syncing msgid from ${file.name}...`);
          await view.syncFromFile(file, orphanStrategy);
        }
        root.empty();
        this.renderSyncContent(root);
      };
    }
  }

  private renderStatsContent(root: HTMLElement): void {
    if (!this.hasData || this.languageStats.length === 0) {
      this.renderEmptyState(root, "chart-no-axes-column", "Open a PO file to see statistics.");
      return;
    }

    this.dashboardRenderer.render(root, this.languageStats);
    root.createEl("hr", { cls: "po-filter-hr" });

    const searchWrap = root.createDiv({ cls: "po-stats-search-wrap" });

    const renderTags = () => {
      searchWrap.empty();
      this.statsTags.forEach((tag) => {
        const chip = searchWrap.createDiv({ cls: "po-stats-tag" });
        chip.createSpan({ text: tag });
        const x = chip.createSpan({ text: "×", cls: "po-stats-tag-x" });
        x.onclick = (e) => {
          e.stopPropagation();
          this.statsTags = this.statsTags.filter((t) => t !== tag);
          renderCards();
          renderTags();
        };
      });

      const input = searchWrap.createEl("input", {
        cls: "po-stats-search-input",
        attr: {
          type: "text",
          placeholder: this.statsTags.length === 0 ? "Search languages..." : "",
          value: this.statsSearch,
        },
      });
      input.value = this.statsSearch;

      input.oninput = () => {
        this.statsSearch = input.value;
        renderCards();
      };
      input.onkeydown = (e) => {
        if (e.key === "Enter" && this.statsSearch.trim()) {
          const term = this.statsSearch.trim();
          const match = this.languageStats.find((l) =>
            l.name.toLowerCase().includes(term.toLowerCase()),
          );
          if (match && !this.statsTags.includes(match.name)) {
            this.statsTags = [...this.statsTags, match.name];
            this.statsSearch = "";
            renderCards();
            renderTags();
          }
        } else if (e.key === "Backspace" && !this.statsSearch && this.statsTags.length > 0) {
          this.statsTags = this.statsTags.slice(0, -1);
          renderCards();
          renderTags();
        }
      };
      searchWrap.onclick = () => input.focus();
    };

    const cardsContainer = root.createDiv();

    const renderCards = () => {
      cardsContainer.empty();
      const term = this.statsSearch.toLowerCase();
      const visible = this.languageStats.filter((lang) => {
        if (this.statsTags.length > 0) return this.statsTags.includes(lang.name);
        if (term) return lang.name.toLowerCase().includes(term);
        return true;
      });

      if (visible.length === 0) {
        cardsContainer.createDiv({ text: "No languages match.", cls: "po-stats-empty" });
        return;
      }

      visible.forEach((lang) => {
        const card = cardsContainer.createDiv({ cls: "po-stats-card" });

        const headerRow = card.createDiv({ cls: "po-stats-card-header" });
        const nameWrap = headerRow.createDiv({ cls: "po-stats-card-name-wrap" });
        if (lang.isSource) {
          const iconEl = nameWrap.createDiv({ cls: "po-stats-source-icon" });
          setIcon(iconEl, "shield-check");
        }
        nameWrap.createSpan({
          text: lang.name,
          cls: `po-stats-card-name${lang.isSource ? " is-source" : ""}`,
        });

        const grid = card.createDiv({ cls: "po-stats-row-grid" });

        if (lang.isPOT) {
          headerRow.createSpan({ text: "POT", cls: "po-stats-pct is-faint" });
          this.renderStatRow(grid, "Keys", lang.stats.total.toString());
          if (lang.stats.fuzzy > 0) {
            this.renderStatRow(grid, "Fuzzy", lang.stats.fuzzy.toString(), "is-warning");
          }
          if (lang.stats.obsolete > 0) {
            this.renderStatRow(grid, "Obsolete", lang.stats.obsolete.toString(), "is-faint");
          }
        } else {
          const p =
            lang.stats.total > 0 ? Math.round((lang.stats.translated / lang.stats.total) * 100) : 0;
          const pctClass = p === 100 ? "is-full" : p > 50 ? "is-mid" : "is-low";
          const barTrack = headerRow.createDiv({ cls: "po-stats-bar-track" });
          const barFill = barTrack.createDiv({ cls: "po-stats-bar-fill" });
          barFill.style.setProperty("--bar-width", `${p}%`);
          headerRow.createSpan({ text: `${p}%`, cls: `po-stats-pct ${pctClass}` });
          this.renderStatRow(grid, "Keys", `${lang.stats.translated} / ${lang.stats.total}`);
          this.renderStatRow(grid, "Singular", lang.stats.singularEntries.toLocaleString());
          this.renderStatRow(grid, "Plural", lang.stats.pluralEntries.toLocaleString());
          this.renderStatRow(grid, "Translated", lang.stats.translated.toLocaleString());
          this.renderStatRow(grid, "Untranslated", lang.stats.untranslated.toLocaleString());
          this.renderStatRow(grid, "Words", lang.stats.wordCount.toLocaleString());
          this.renderStatRow(grid, "Chars", lang.stats.charCount.toLocaleString());
          this.renderStatRow(grid, "No spaces", lang.stats.charCountNoSpaces.toLocaleString());
          if (lang.stats.fuzzy > 0) {
            this.renderStatRow(grid, "Fuzzy", lang.stats.fuzzy.toString(), "is-warning");
          }
          if (lang.stats.obsolete > 0) {
            this.renderStatRow(grid, "Obsolete", lang.stats.obsolete.toString(), "is-faint");
          }
          if (lang.stats.errors > 0) {
            this.renderStatRow(grid, "Errors", lang.stats.errors.toString(), "is-error");
          }
        }
      });
    };

    renderTags();
    renderCards();
  }

  private renderFilterContent(root: HTMLElement): void {
    if (!this.filterOptions || !this.onFilterChange) {
      this.renderEmptyState(root, "list-filter", "Open a PO file to configure filters.");
      return;
    }

    const opts = this.filterOptions;
    const onChange = this.onFilterChange;

    const renderSection = (
      sectionLabel: string,
      totalCount: number,
      options: {
        value: string;
        label: string;
        count: number;
        renderLabel?: (parent: HTMLElement) => void;
      }[],
      includedValues: string[],
      key:
        | "includedStatuses"
        | "includedFlags"
        | "includedComments"
        | "includedContexts"
        | "includedLanguages"
        | "includedTypes",
      isFirst: boolean,
    ) => {
      if (!isFirst) {
        root.createEl("hr", { cls: "po-filter-hr" });
      }

      const titleRow = root.createDiv({ cls: "po-filter-title-row" });
      const titleGroup = titleRow.createDiv({ cls: "po-filter-title-group" });
      titleGroup.createSpan({ text: sectionLabel, cls: "po-filter-section-label" });
      if (includedValues.length > 0) {
        const resetLink = titleGroup.createSpan({ text: "– reset", cls: "po-stats-reset" });
        resetLink.onclick = () => onChange(key, []);
      }
      titleRow.createSpan({ text: totalCount.toString(), cls: "po-filter-count-badge" });

      options.forEach(({ value, label, count, renderLabel }) => {
        const row = root.createDiv({ cls: "po-filter-row" });
        const cb = row.createEl("input", {
          cls: "po-filter-checkbox",
          attr: { type: "checkbox" },
        });
        cb.checked = includedValues.includes(value);
        row.classList.toggle("po-filter-row--active", cb.checked);

        if (renderLabel) {
          renderLabel(row);
        } else {
          row.createSpan({ text: label, cls: "po-filter-row-label" });
        }

        row.createSpan({ text: count.toString(), cls: "po-filter-count-badge" });

        const toggle = () => {
          cb.checked = !cb.checked;
          row.classList.toggle("po-filter-row--active", cb.checked);
          const newIncluded = cb.checked
            ? [...includedValues, value]
            : includedValues.filter((v) => v !== value);
          onChange(key, newIncluded);
        };
        row.onclick = (e) => {
          if (e.target !== cb) {
            toggle();
          }
        };
        cb.onchange = (e) => {
          e.stopPropagation();
          row.classList.toggle("po-filter-row--active", cb.checked);
          const newIncluded = cb.checked
            ? [...includedValues, value]
            : includedValues.filter((v) => v !== value);
          onChange(key, newIncluded);
        };
      });
    };

    const statusOptions = [
      { value: "untranslated", label: "Untranslated" },
      { value: "translated", label: "Translated" },
      { value: "fuzzy", label: "Fuzzy" },
      { value: "obsolete", label: "Obsolete" },
    ];

    renderSection(
      "Status",
      opts.totalEntries,
      statusOptions.map((opt) => ({
        value: opt.value,
        label: "",
        count: opts[`${opt.value}Count` as keyof typeof opts] as number,
        renderLabel: (parent: HTMLElement) => {
          const wrap = parent.createDiv({ cls: "po-filter-status-wrap" });
          wrap.createDiv({ cls: `po-filter-status-dot is-${opt.value}` });
          wrap.createSpan({ text: opt.label, cls: "po-filter-status-label" });
        },
      })),
      opts.current.includedStatuses,
      "includedStatuses",
      true,
    );

    renderSection(
      "Type",
      opts.totalEntries,
      opts.typeOptions.map((opt) => ({
        value: opt.type,
        label: opt.label,
        count: opt.count,
      })),
      opts.current.includedTypes,
      "includedTypes",
      false,
    );

    if (opts.flagOptions.length > 0) {
      renderSection(
        "Flags",
        opts.flagOptions.reduce((acc, f) => acc + f.count, 0),
        opts.flagOptions.map((f) => ({ value: f.flag, label: f.label, count: f.count })),
        opts.current.includedFlags,
        "includedFlags",
        false,
      );
    }

    if (opts.commentOptions.length > 0) {
      renderSection(
        "Comments",
        opts.commentOptions.reduce((acc, c) => acc + c.count, 0),
        opts.commentOptions.map((c) => ({ value: c.comment, label: c.label, count: c.count })),
        opts.current.includedComments,
        "includedComments",
        false,
      );
    }

    if (opts.contextOptions.length > 0) {
      renderSection(
        "Contexts",
        opts.contextOptions.reduce((acc, c) => acc + c.count, 0),
        opts.contextOptions.map((c) => ({ value: c.context, label: c.context, count: c.count })),
        opts.current.includedContexts,
        "includedContexts",
        false,
      );
    }

    if (opts.languageOptions && opts.languageOptions.length > 0) {
      renderSection(
        "Languages",
        opts.languageOptions.length,
        opts.languageOptions.map((l) => ({
          value: l.language,
          label: l.isSource ? `${l.language} ★` : l.language,
          count: 0,
        })),
        opts.current.includedLanguages,
        "includedLanguages",
        false,
      );
    }
  }

  private renderStatRow(
    parent: HTMLElement,
    label: string,
    value: string,
    valueModifier = "",
  ): void {
    parent.createSpan({ text: label, cls: "po-stats-row-label" });
    parent.createSpan({
      text: value,
      cls: `po-stats-row-value${valueModifier ? ` ${valueModifier}` : ""}`,
    });
  }
}
