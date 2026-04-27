import { type POStatistics } from "@domain/index";
import { ItemView, setIcon, type WorkspaceLeaf } from "obsidian";

import { POView } from "./POView";

export const PO_STATS_VIEW_TYPE = "po-stats-view";
export type PanelMode = "stats" | "filters";

export interface LanguageStat {
  name: string;
  stats: POStatistics;
  isSource: boolean;
}

export interface FilterOptions {
  totalEntries: number;
  untranslatedCount: number;
  translatedCount: number;
  fuzzyCount: number;
  flagOptions: { flag: string; label: string; count: number }[];
  commentOptions: { comment: string; label: string; count: number }[];
  contextOptions: { context: string; count: number }[];
  languageOptions?: { language: string; isSource: boolean }[];
  current: {
    includedStatuses: string[];
    includedFlags: string[];
    includedComments: string[];
    includedContexts: string[];
    includedLanguages: string[];
  };
}

export type FilterChangeCallback = (
  key:
    | "includedStatuses"
    | "includedFlags"
    | "includedComments"
    | "includedContexts"
    | "includedLanguages",
  values: string[],
) => void;

export class POStatsView extends ItemView {
  private languageStats: LanguageStat[] = [];
  private hasData = false;
  private mode: PanelMode = "stats";
  private filterOptions: FilterOptions | null = null;
  private onFilterChange: FilterChangeCallback | null = null;
  private statsSearch: string = "";
  private statsTags: string[] = [];

  getViewType(): string {
    return PO_STATS_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "PO Statistics";
  }

  getIcon(): string {
    return "bar-chart-horizontal";
  }

  async onOpen(): Promise<void> {
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => this.refreshFromActiveLeaf()),
    );
    this.registerEvent(
      this.app.workspace.on("layout-change", () => this.refreshFromActiveLeaf()),
    );
    this.refreshFromActiveLeaf();
  }

  refreshFromActiveLeaf(): void {
    const leaf = this.app.workspace.getMostRecentLeaf();
    const view = leaf?.view;
    if (view instanceof POView) {
      view.syncWithPanel(this);
      return;
    }
    this.renderContent();
  }

  setStats(stats: LanguageStat[]): void {
    this.languageStats = stats;
    this.hasData = true;
    if (this.mode === "stats") this.renderContent();
  }

  setFilterData(options: FilterOptions, onChange: FilterChangeCallback): void {
    this.filterOptions = options;
    this.onFilterChange = onChange;
    if (this.mode === "filters") this.renderContent();
  }

  switchToFilters(): void {
    this.mode = "filters";
    this.renderContent();
  }

  showFilters(options: FilterOptions, onChange: FilterChangeCallback): void {
    this.setFilterData(options, onChange);
    this.switchToFilters();
  }

  updateFilterOptions(options: FilterOptions): void {
    this.filterOptions = options;
    if (this.mode === "filters") this.renderContent();
  }

  private renderContent(): void {
    const root = this.containerEl.children[1] as HTMLElement;
    root.empty();
    root.style.cssText =
      "padding: 0; display: flex; flex-direction: column; height: 100%; overflow: hidden;";

    const tabBar = root.createDiv({
      attr: {
        style:
          "display: flex; border-bottom: 1px solid var(--background-modifier-border); padding: 0 8px; flex-shrink: 0;",
      },
    });

    const makeTab = (label: string, icon: string, mode: PanelMode) => {
      const isActive = this.mode === mode;
      const tab = tabBar.createDiv({
        attr: {
          style: `display: flex; align-items: center; gap: 5px; padding: 8px 10px; font-size: 12px; cursor: pointer; border-bottom: 2px solid ${isActive ? "var(--interactive-accent)" : "transparent"}; color: ${isActive ? "var(--text-normal)" : "var(--text-muted)"}; margin-bottom: -1px; user-select: none;`,
        },
      });
      const iconEl = tab.createDiv({ attr: { style: "display: flex; align-items: center;" } });
      setIcon(iconEl, icon);
      tab.createSpan({ text: label });
      tab.onclick = () => {
        this.mode = mode;
        this.renderContent();
      };
    };

    makeTab("Stats", "bar-chart-horizontal", "stats");
    makeTab("Filters", "filter", "filters");

    const content = root.createDiv({
      attr: { style: "padding: 12px; overflow-y: auto; flex: 1;" },
    });

    if (this.mode === "stats") {
      this.renderStatsContent(content);
    } else {
      this.renderFilterContent(content);
    }
  }

  private renderStatsContent(root: HTMLElement): void {
    if (!this.hasData || this.languageStats.length === 0) {
      root.createDiv({
        text: "Open a PO file to see statistics.",
        attr: { style: "color: var(--text-muted); font-size: 12px; padding: 8px 0;" },
      });
      return;
    }

    // Search + tag row
    const searchWrap = root.createDiv({
      attr: {
        style:
          "display: flex; flex-wrap: wrap; align-items: center; gap: 4px; padding: 4px 6px; border: 1px solid var(--background-modifier-border); border-radius: 6px; background: var(--background-primary); margin-bottom: 10px; cursor: text;",
      },
    });

    const renderTags = () => {
      searchWrap.empty();
      this.statsTags.forEach((tag) => {
        const chip = searchWrap.createDiv({
          attr: {
            style:
              "display: flex; align-items: center; gap: 3px; background: var(--interactive-accent); color: white; border-radius: 4px; padding: 1px 6px; font-size: 11px; font-weight: 500; white-space: nowrap;",
          },
        });
        chip.createSpan({ text: tag });
        const x = chip.createSpan({
          text: "×",
          attr: { style: "cursor: pointer; opacity: 0.8; font-size: 13px; line-height: 1;" },
        });
        x.onclick = (e) => {
          e.stopPropagation();
          this.statsTags = this.statsTags.filter((t) => t !== tag);
          renderCards();
          renderTags();
        };
      });

      const input = searchWrap.createEl("input", {
        attr: {
          type: "text",
          placeholder: this.statsTags.length === 0 ? "Search languages..." : "",
          style:
            "flex: 1; min-width: 80px; border: none; outline: none; background: transparent; font-size: 12px; padding: 0; color: var(--text-normal);",
          value: this.statsSearch,
        },
      }) as HTMLInputElement;
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
        cardsContainer.createDiv({
          text: "No languages match.",
          attr: { style: "color: var(--text-muted); font-size: 12px; padding: 8px 0;" },
        });
        return;
      }

      visible.forEach((lang) => {
      const p =
        lang.stats.total > 0
          ? Math.round((lang.stats.translated / lang.stats.total) * 100)
          : 0;

      const card = root.createDiv({
        attr: {
          style:
            "margin-bottom: 14px; padding: 10px 12px; border-radius: 6px; background: var(--background-secondary); border: 1px solid var(--background-modifier-border);",
        },
      });

      const headerRow = card.createDiv({
        attr: {
          style:
            "display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;",
        },
      });
      const nameWrap = headerRow.createDiv({
        attr: { style: "display: flex; align-items: center; gap: 5px; overflow: hidden;" },
      });
      if (lang.isSource) {
        const iconEl = nameWrap.createDiv({
          attr: { style: "color: var(--text-success); flex-shrink: 0;" },
        });
        setIcon(iconEl, "shield-check");
      }
      nameWrap.createSpan({
        text: lang.name,
        attr: {
          style: `font-size: 12px; font-weight: ${lang.isSource ? "700" : "600"}; color: ${lang.isSource ? "var(--text-success)" : "var(--text-normal)"}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`,
        },
      });
      headerRow.createSpan({
        text: `${p}%`,
        attr: {
          style: `font-size: 11px; font-weight: 600; color: ${p === 100 ? "var(--text-success)" : p > 50 ? "var(--text-normal)" : "var(--text-warning)"}; flex-shrink: 0;`,
        },
      });

      const barTrack = card.createDiv({
        attr: {
          style:
            "height: 4px; background: var(--background-modifier-border); border-radius: 2px; overflow: hidden; margin-bottom: 10px;",
        },
      });
      barTrack.createDiv({
        attr: {
          style: `width: ${p}%; height: 100%; background: var(--text-success); border-radius: 2px; transition: width 0.4s ease;`,
        },
      });

      const grid = card.createDiv({
        attr: { style: "display: grid; grid-template-columns: 1fr 1fr; gap: 4px 8px;" },
      });

      this.renderStatRow(grid, "Keys", `${lang.stats.translated} / ${lang.stats.total}`);
      this.renderStatRow(grid, "Words", lang.stats.wordCount.toLocaleString());
      this.renderStatRow(grid, "Chars", lang.stats.charCount.toLocaleString());
      this.renderStatRow(grid, "Chars (no sp.)", lang.stats.charCountNoSpaces.toLocaleString());
      if (lang.stats.fuzzy > 0) {
        this.renderStatRow(grid, "Fuzzy", lang.stats.fuzzy.toString(), "var(--text-warning)");
      }
      if (lang.stats.errors > 0) {
        this.renderStatRow(grid, "Errors", lang.stats.errors.toString(), "var(--text-error)");
      }
      if (lang.stats.obsolete > 0) {
        this.renderStatRow(grid, "Obsolete", lang.stats.obsolete.toString(), "var(--text-faint)");
      }
    });
    };

    renderTags();
    renderCards();
  }

  private renderFilterContent(root: HTMLElement): void {
    if (!this.filterOptions || !this.onFilterChange) {
      root.createDiv({
        text: "Open a PO file to configure filters.",
        attr: { style: "color: var(--text-muted); font-size: 12px; padding: 8px 0;" },
      });
      return;
    }

    const opts = this.filterOptions;
    const onChange = this.onFilterChange;

    const badgeStyle =
      "font-size: 10px; font-weight: 600; background: var(--background-modifier-border); color: var(--text-muted); border-radius: 6px; padding: 1px 6px; flex-shrink: 0;";

    const renderSection = (
      sectionLabel: string,
      totalCount: number,
      options: { value: string; label: string; count: number }[],
      includedValues: string[],
      key: "includedStatuses" | "includedFlags" | "includedComments" | "includedContexts" | "includedLanguages",
      isFirst: boolean,
    ) => {
      if (!isFirst) {
        root.createEl("hr", {
          attr: {
            style:
              "border: none; border-top: 1px solid var(--background-modifier-border); margin: 10px 0;",
          },
        });
      }

      // Title row: [LABEL – reset]  [total badge]
      const titleRow = root.createDiv({
        attr: { style: "display: flex; align-items: center; gap: 0; margin-bottom: 6px;" },
      });
      const titleGroup = titleRow.createDiv({
        attr: { style: "display: flex; align-items: center; gap: 5px; flex: 1; min-width: 0;" },
      });
      titleGroup.createSpan({
        text: sectionLabel,
        attr: {
          style:
            "font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.6px;",
        },
      });
      if (includedValues.length > 0) {
        const resetLink = titleGroup.createSpan({
          text: "– reset",
          attr: {
            style:
              "font-size: 10px; color: var(--text-accent); cursor: pointer; opacity: 0.8; flex-shrink: 0;",
          },
        });
        resetLink.onclick = () => onChange(key, []);
      }
      titleRow.createSpan({
        text: totalCount.toString(),
        attr: { style: badgeStyle },
      });

      // Checkbox: unchecked by default = no filter; check = include only those
      options.forEach(({ value, label, count }) => {
        const row = root.createDiv({
          attr: {
            style:
              "display: flex; align-items: center; gap: 8px; padding: 4px 2px; cursor: pointer;",
          },
        });
        const cb = row.createEl("input", {
          attr: { type: "checkbox", style: "flex-shrink: 0; cursor: pointer;" },
        }) as HTMLInputElement;
        cb.checked = includedValues.includes(value);
        row.createSpan({
          text: label,
          attr: { style: "font-size: 12px; color: var(--text-normal); flex: 1;" },
        });
        row.createSpan({
          text: count.toString(),
          attr: { style: badgeStyle },
        });

        const toggle = () => {
          const newIncluded = cb.checked
            ? [...includedValues, value]
            : includedValues.filter((v) => v !== value);
          onChange(key, newIncluded);
        };
        cb.onchange = toggle;
        row.onclick = (e) => {
          if (e.target !== cb) {
            cb.checked = !cb.checked;
            toggle();
          }
        };
      });
    };

    renderSection(
      "Status",
      opts.totalEntries,
      [
        { value: "untranslated", label: "Untranslated", count: opts.untranslatedCount },
        { value: "translated", label: "Translated", count: opts.translatedCount },
        { value: "fuzzy", label: "Fuzzy", count: opts.fuzzyCount },
      ],
      opts.current.includedStatuses,
      "includedStatuses",
      true,
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
    valueColor = "var(--text-normal)",
  ): void {
    parent.createSpan({
      text: label,
      attr: { style: "font-size: 11px; color: var(--text-muted);" },
    });
    parent.createSpan({
      text: value,
      attr: { style: `font-size: 11px; color: ${valueColor}; font-weight: 500; text-align: right;` },
    });
  }
}
