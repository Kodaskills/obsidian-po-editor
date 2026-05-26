import type { LanguageStat } from "./POViewTypes";

export class StatsDashboardRenderer {
  render(container: HTMLElement, stats: LanguageStat[]): void {
    const dashboard = container.createDiv({ cls: "po-dashboard-grid" });

    // Summary Card
    const totalTranslated = stats.reduce((acc, s) => acc + s.stats.translated, 0);
    const totalUntranslated = stats.reduce((acc, s) => acc + s.stats.untranslated, 0);
    const totalObsolete = stats.reduce((acc, s) => acc + s.stats.obsolete, 0);
    const totalFuzzy = stats.reduce((acc, s) => acc + s.stats.fuzzy, 0);
    const totalErrors = stats.reduce((acc, s) => acc + s.stats.errors, 0);
    const totalKeys = stats.reduce((acc, s) => acc + s.stats.total, 0);
    const totalChars = stats.reduce((acc, s) => acc + (s.stats.charCount || 0), 0);
    const totalCharsNoSpace = stats.reduce((acc, s) => acc + (s.stats.charCountNoSpaces || 0), 0);
    const totalPlural = stats.reduce((acc, s) => acc + (s.stats.pluralEntries || 0), 0);
    const totalSingular = stats.reduce((acc, s) => acc + (s.stats.singularEntries || 0), 0);

    const completion = totalKeys > 0 ? Math.round((totalTranslated / totalKeys) * 100) : 0;

    const summaryCard = dashboard.createDiv({ cls: "po-dashboard-card po-summary-card" });
    summaryCard.createDiv({ text: "Project Progress", cls: "po-dashboard-card-title" });

    const progressWrap = summaryCard.createDiv({ cls: "po-dashboard-progress-wrap" });
    const barTrack = progressWrap.createDiv({ cls: "po-stats-bar-track" });
    const barFill = barTrack.createDiv({ cls: "po-stats-bar-fill" });
    barFill.style.setProperty("--bar-width", `${completion}%`);
    progressWrap.createSpan({ text: `${completion}%`, cls: "po-dashboard-progress-pct" });

    const statsGrid = summaryCard.createDiv({ cls: "po-stats-row-grid" });
    this.renderStatRow(statsGrid, "Total Keys", totalKeys.toLocaleString());
    this.renderStatRow(statsGrid, "Singular", totalSingular.toLocaleString());
    this.renderStatRow(statsGrid, "Plural", totalPlural.toLocaleString());
    this.renderStatRow(statsGrid, "Translated", totalTranslated.toLocaleString());
    this.renderStatRow(statsGrid, "Untranslated", totalUntranslated.toLocaleString());
    if (totalFuzzy > 0) this.renderStatRow(statsGrid, "Fuzzy", totalFuzzy.toLocaleString());
    if (totalObsolete > 0)
      this.renderStatRow(statsGrid, "Obsolete", totalObsolete.toLocaleString());
    this.renderStatRow(statsGrid, "Total Chars", totalChars.toLocaleString());
    this.renderStatRow(statsGrid, "Non-space Chars", totalCharsNoSpace.toLocaleString());
    this.renderStatRow(statsGrid, "Languages", stats.length.toString());

    // Review Queue Card
    if (totalErrors > 0) {
      const reviewCard = dashboard.createDiv({ cls: "po-dashboard-card po-review-card" });
      const title = reviewCard.createDiv({ text: "Review Queue", cls: "po-dashboard-card-title" });
      title.setAttribute("title", "Entries containing validation errors.");
      const reviewGrid = reviewCard.createDiv({ cls: "po-stats-row-grid" });
      this.renderStatRow(reviewGrid, "Error Items", totalErrors.toLocaleString());
    }
  }

  private renderStatRow(parent: HTMLElement, label: string, value: string): void {
    parent.createSpan({ text: label, cls: "po-stats-row-label" });
    parent.createSpan({ text: value, cls: "po-stats-row-value" });
  }
}
