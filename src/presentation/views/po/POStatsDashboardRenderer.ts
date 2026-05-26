import { getStatistics } from "@domain/index";
import { setIcon, setTooltip } from "obsidian";

import { getProgress } from "./POEntryHelpers";
import type { POViewQueries } from "./POViewTypes";

export class POStatsDashboardRenderer {
  constructor(
    private readonly queries: POViewQueries,
    private readonly onToggleStats: () => void,
  ) {}

  render(container: HTMLElement): void {
    const snapshot = this.queries.getSnapshot();
    const mainStats = getStatistics(snapshot.mainPoFile);
    const progress = getProgress(mainStats);

    const detailBtn = container.createDiv({ cls: "po-editor-icon-button po-stats-detail-btn" });
    setIcon(detailBtn, "bar-chart");
    setTooltip(detailBtn, "Toggle statistics panel");
    detailBtn.onclick = () => this.onToggleStats();

    this.renderTitle(container, "STATISTICS");

    if (snapshot.isPOTFile) {
      this.renderItem(container, mainStats.total.toString(), "Keys");
      if (mainStats.fuzzy > 0) {
        this.renderSeparator(container);
        this.renderStatusItem(
          container,
          mainStats.fuzzy.toString(),
          "po-stats-status-dot--warning",
          "Fuzzy",
        );
      }
      if (mainStats.obsolete > 0) {
        this.renderSeparator(container);
        this.renderStatusItem(
          container,
          mainStats.obsolete.toString(),
          "po-stats-status-dot--muted",
          "Obsolete",
        );
      }
      return;
    }

    this.renderProgress(container, progress);
    this.renderSeparator(container);
    this.renderStatusItem(
      container,
      mainStats.translated.toString(),
      "po-stats-status-dot--success",
      "Translated",
    );
    this.renderSeparator(container);
    this.renderStatusItem(
      container,
      mainStats.untranslated.toString(),
      mainStats.untranslated > 0 ? "po-stats-status-dot--error" : "po-stats-status-dot--muted",
      "Untranslated",
    );
    if (mainStats.fuzzy > 0) {
      this.renderSeparator(container);
      this.renderStatusItem(
        container,
        mainStats.fuzzy.toString(),
        "po-stats-status-dot--warning",
        "Fuzzy",
      );
    }
    if (mainStats.obsolete > 0) {
      this.renderSeparator(container);
      this.renderStatusItem(
        container,
        mainStats.obsolete.toString(),
        "po-stats-status-dot--muted",
        "Obsolete",
      );
    }
    this.renderSeparator(container);
    this.renderItem(container, mainStats.total.toString(), "Keys");
    this.renderSeparator(container);
    this.renderItem(container, mainStats.wordCount.toLocaleString(), "Words");
    this.renderSeparator(container);
    this.renderItem(container, mainStats.charCount.toLocaleString(), "Chars");
    this.renderSeparator(container);
    this.renderItem(container, mainStats.charCountNoSpaces.toLocaleString(), "No spaces");
    if (mainStats.errors > 0) {
      this.renderSeparator(container);
      this.renderStatusItem(
        container,
        mainStats.errors.toString(),
        "po-stats-status-dot--error",
        "Errors",
      );
    }
  }

  private renderTitle(parent: HTMLElement, text: string): void {
    parent.createSpan({ text, cls: "po-stats-title" });
  }

  private renderProgress(container: HTMLElement, progress: number): void {
    const section = container.createDiv({ cls: "po-stats-progress-section" });
    const track = section.createDiv({ cls: "po-stats-progress-track" });
    const fill = track.createDiv({ cls: "po-stats-progress-fill" });
    fill.style.setProperty("--progress-width", `${progress}%`);
    section.createSpan({ text: `${progress}%`, cls: "po-stats-progress-pct" });
  }

  private renderStatusItem(
    parent: HTMLElement,
    value: string,
    dotClass: string,
    label: string,
  ): void {
    const item = parent.createDiv({ cls: "po-stats-status-item" });
    item.createDiv({ cls: `po-stats-status-dot ${dotClass}` });
    item.createSpan({ text: value, cls: "po-stats-status-value" });
    setTooltip(item, label);
  }

  private renderItem(parent: HTMLElement, value: string, label: string, valueClass = ""): void {
    const item = parent.createDiv({ cls: "po-stats-item" });
    item.createSpan({
      text: value,
      cls: `po-stats-item-value${valueClass ? ` ${valueClass}` : ""}`,
    });
    item.createSpan({ text: label, cls: "po-stats-item-label" });
  }

  private renderSeparator(parent: HTMLElement): void {
    parent.createDiv({ cls: "po-stats-separator" });
  }
}
