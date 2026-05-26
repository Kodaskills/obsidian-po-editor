import { entriesMatch, getLanguageDisplayName, type POEntry } from "@domain/index";
import { setIcon, setTooltip } from "obsidian";
import { vlist, type VList } from "vlist";

import {
  isFuzzy as isEntryFuzzy,
  isMissing as isEntryMissing,
  entryKey as helpersEntryKey,
  hasMissingPlaceholders,
} from "./POEntryHelpers";
import { POStatsDashboardRenderer } from "./POStatsDashboardRenderer";
import { buildFilteredItems } from "./POViewSelectors";
import {
  PO_ROW_HEIGHT,
  type POEntryItem,
  type PONavigationActions,
  type POVisibilityActions,
  type POViewQueries,
} from "./POViewTypes";

export interface POEntryListRenderResult {
  list: VList<POEntryItem>;
  container: HTMLElement;
  filteredEntries: POEntry[];
  sourceMap: Map<string, string>;
  refresh(selectedEntry: POEntry | null): POEntry[];
}

export class POEntryListRenderer {
  private searchTimer: ReturnType<typeof window.setTimeout> | null = null;

  constructor(
    private readonly queries: POViewQueries,
    private readonly actions: PONavigationActions &
      POVisibilityActions & { setSourceLanguage(language: string): Promise<void> },
    private readonly statsRenderer: POStatsDashboardRenderer,
  ) {}

  render(container: HTMLElement, selectedEntry: POEntry | null): POEntryListRenderResult {
    const snapshot = this.queries.getSnapshot();
    const toolbar = container.createDiv({ cls: "po-toolbar" });
    const topRow = toolbar.createDiv({ cls: "po-toolbar-top" });

    this.renderProjectControls(topRow);

    const statsEl = topRow.createDiv({ cls: "po-toolbar-stats" });
    this.statsRenderer.render(statsEl);

    this.renderSearchRow(toolbar);

    const table = container.createDiv({ cls: "po-list-table" });

    const listContainer = table.createDiv({ cls: "po-vlist-container" });
    let sourceLanguage = this.queries.getSourceLanguage();
    let listData = buildFilteredItems(snapshot, sourceLanguage);
    let sourceMap = listData.sourceMap;
    let filteredEntries = listData.entries;
    let currentSelectedEntry = selectedEntry;

    const list = vlist<POEntryItem>({
      container: listContainer,
      items: listData.items,
      item: {
        height: PO_ROW_HEIGHT,
        template: (item, index) => this.renderRow(item, index, currentSelectedEntry),
      },
      interactive: false,
    }).build();

    return {
      list,
      container: listContainer,
      filteredEntries,
      sourceMap,
      refresh: (newSelectedEntry: POEntry | null) => {
        currentSelectedEntry = newSelectedEntry;
        sourceLanguage = this.queries.getSourceLanguage();
        const fresh = buildFilteredItems(this.queries.getSnapshot(), sourceLanguage);
        sourceMap = fresh.sourceMap;
        filteredEntries = fresh.entries;
        list.setItems(fresh.items);
        return filteredEntries;
      },
    };
  }

  private renderProjectControls(topRow: HTMLElement): void {
    const snapshot = this.queries.getSnapshot();
    if (snapshot.isPOTFile) {
      topRow.createEl("span", { text: "POT template", cls: "po-pot-badge" });
    }
  }

  private renderSearchRow(toolbar: HTMLElement): void {
    const snapshot = this.queries.getSnapshot();
    const searchRow = toolbar.createDiv({ cls: "po-toolbar-search-row" });

    if (snapshot.siblingPoFiles.length > 0) {
      searchRow.createSpan({ cls: "po-ref-lang-label", text: "Ref:" });
      const select = searchRow.createEl("select", { cls: "po-ref-lang-select" });
      const sourceLanguage = this.queries.getSourceLanguage();
      const none = select.createEl("option", {
        text: "NONE",
        attr: { value: "" },
      });
      if (!sourceLanguage) none.selected = true;
      for (const file of snapshot.siblingPoFiles) {
        if (file.file.extension === "pot") continue;
        const displayName = getLanguageDisplayName(file.language);
        const option = select.createEl("option", {
          text: displayName ? `${file.language.toUpperCase()} - ${displayName}` : file.language,
          attr: { value: file.language },
        });
        if (file.language === sourceLanguage) option.selected = true;
      }
      select.onchange = () => void this.actions.setSourceLanguage(select.value);
    }

    const searchBar = searchRow.createDiv({ cls: "po-search-bar" });

    const searchInput = searchBar.createEl("input", {
      cls: "po-search-input",
      attr: { type: "text", placeholder: "Search..." },
    });
    searchInput.value = snapshot.filters.activeSearch;
    searchInput.oninput = () => {
      if (this.searchTimer !== null) window.clearTimeout(this.searchTimer);
      this.searchTimer = window.setTimeout(() => {
        this.searchTimer = null;
        this.actions.setSearch(searchInput.value.trim());
      }, 300);
    };

    const btnGroup = searchRow.createDiv({
      cls: "po-toolbar-btn-group po-toolbar-btn-group-right",
    });

    const activeFilters = [
      snapshot.filters.includedStatuses.length > 0,
      snapshot.filters.includedFlags.length > 0,
      snapshot.filters.includedComments.length > 0,
      snapshot.filters.includedContexts.length > 0,
      snapshot.filters.includedLanguages.length > 0,
    ].filter(Boolean).length;
    const filterButton = btnGroup.createDiv({
      cls: "po-editor-icon-button po-editor-filter-btn",
      attr: {
        title: `Filter${activeFilters > 0 ? ` (${activeFilters} active)` : ""}`,
      },
    });
    setIcon(filterButton, "list-filter");
    filterButton.createSpan({ cls: "po-editor-filter-label", text: "Filters" });
    if (activeFilters > 0) {
      filterButton.classList.add("has-active-filters");
      filterButton.createSpan({
        text: activeFilters.toString(),
        cls: "po-filter-active-count",
      });
    }
    filterButton.onclick = () => this.actions.toggleFiltersPanel();
  }

  private renderRow(item: POEntryItem, index: number, selectedEntry: POEntry | null): HTMLElement {
    const entry = item.entry;
    const isFuzzy = isEntryFuzzy(entry);
    const isMissing = isEntryMissing(entry);
    const isObsolete = !!entry.obsolete;
    const isSelected = selectedEntry !== null && entriesMatch(selectedEntry, entry);
    const hasPlaceholderIssue =
      !isMissing && hasMissingPlaceholders(entry, (t) => this.queries.detectPlaceholders(t));
    const row = activeDocument!.createElement("div");
    row.className = ["po-list-row", isSelected ? "po-list-row--selected" : ""]
      .filter(Boolean)
      .join(" ");
    row.dataset.entryId = helpersEntryKey(entry);
    row.dataset.status = isObsolete
      ? "obsolete"
      : isMissing
        ? "missing"
        : isFuzzy
          ? "fuzzy"
          : "done";

    const idRow = row.createDiv({ cls: "po-list-entry-id-row" });
    const idText = idRow.createDiv({ cls: "po-list-entry-id-text" });
    idText.createDiv({ cls: "po-list-entry-id", text: entry.msgid });
    if (entry.msgctxt) {
      idText.createSpan({ cls: "po-list-entry-key", text: entry.msgctxt });
    }

    if (hasPlaceholderIssue) {
      const warn = idRow.createDiv({ cls: "po-list-placeholder-warn" });
      setIcon(warn, "alert-triangle");
      setTooltip(warn, "Missing placeholders");
    }

    row.onclick = () => this.actions.selectEntry(entry, true);
    return row;
  }
}
