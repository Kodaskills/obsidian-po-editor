import { FORMAT_LABELS, type TranslationFormat } from "@application/index";
import type { POView } from "@presentation/views/POView";
import { Modal, Notice, setIcon, TFolder, Setting, type App } from "obsidian";

interface FormatMeta {
  format: TranslationFormat;
  description: string;
  ext: string;
}

const FORMATS_META: FormatMeta[] = [
  { format: "xliff", description: "Industry standard XLIFF", ext: ".xliff" },
  { format: "arb", description: "Flutter resource bundle", ext: ".arb" },
  { format: "json", description: "Standard JSON format", ext: ".json" },
  { format: "yaml", description: "Readable YAML format", ext: ".yaml" },
  { format: "icu", description: "ICU MessageFormat", ext: ".json" },
];

export class ExportPanelRenderer {
  private selectedFormats: Set<TranslationFormat> = new Set();
  private outputDir: string = "/";
  private view: POView | null = null;

  render(container: HTMLElement, view?: POView): void {
    const newView = view ?? this.view;
    if (newView !== this.view) this.selectedFormats = new Set();
    this.view = newView;
    if (!this.view) return;

    this.outputDir = this.view.getOutputDirectory();

    container.empty();
    container.addClass("po-export-panel");

    this.renderExportSection(container);
  }

  private renderExportSection(container: HTMLElement): void {
    new Setting(container).setName("Export formats").setHeading();

    const cardsContainer = container.createDiv({ cls: "po-export-cards" });

    for (const meta of FORMATS_META) {
      const card = cardsContainer.createDiv({ cls: "po-export-card" });
      card.setAttr("data-format", meta.format);

      if (this.selectedFormats.has(meta.format)) {
        card.addClass("po-export-card-selected");
      }

      const body = card.createDiv({ cls: "po-export-card-body" });
      body.createEl("span", { text: FORMAT_LABELS[meta.format], cls: "po-export-card-title" });
      body.createEl("span", { text: meta.description, cls: "po-export-card-desc" });
      card.createEl("span", { text: meta.ext, cls: "po-export-card-badge" });

      const check = card.createDiv({ cls: "po-export-card-check" });
      setIcon(check, "check");

      card.addEventListener("click", () => {
        this.toggleFormat(meta.format, card);
      });
    }

    new Setting(container).setName("Output directory").setHeading();
    const dirRow = container.createDiv({ cls: "po-export-dir-row" });
    const dirPath = dirRow.createSpan({ cls: "po-export-dir-path", text: this.outputDir || "/" });
    const dirBtn = dirRow.createDiv({ cls: "po-export-dir-btn" });
    setIcon(dirBtn, "folder-open");
    dirBtn.addEventListener("click", () => {
      this.pickDirectory(dirPath);
    });

    const exportBtn = container.createDiv({ cls: "po-export-action-btn" });
    this.updateExportBtn(exportBtn);
  }

  private toggleFormat(format: TranslationFormat, card: HTMLElement): void {
    if (this.selectedFormats.has(format)) {
      this.selectedFormats.delete(format);
      card.removeClass("po-export-card-selected");
    } else {
      this.selectedFormats.add(format);
      card.addClass("po-export-card-selected");
    }
    this.updateExportBtn(
      card.closest(".po-export-panel")?.querySelector(".po-export-action-btn") as HTMLElement,
    );
  }

  private updateExportBtn(btn: HTMLElement | null): void {
    if (!btn) return;
    const count = this.selectedFormats.size;
    btn.empty();
    btn.onclick = null;

    if (count === 0) {
      btn.addClass("po-export-action-btn-disabled");
      btn.createSpan({ text: "Select at least one format", cls: "po-export-action-btn-label" });
      return;
    }

    btn.removeClass("po-export-action-btn-disabled");
    const icon = btn.createDiv({ cls: "po-export-action-btn-icon" });
    setIcon(icon, "download");
    btn.createSpan({ text: `Export (${count})`, cls: "po-export-action-btn-label" });
    btn.onclick = () => this.executeExport(btn);
  }

  private async executeExport(btn: HTMLElement): Promise<void> {
    const view = this.view;
    if (!view) return;
    const formats = Array.from(this.selectedFormats);
    btn.addClass("po-export-action-btn-loading");
    new Notice(`Exporting ${formats.length} format(s)...`);
    for (const format of formats) {
      await view.exportToFormat(format, this.outputDir);
    }
    btn.removeClass("po-export-action-btn-loading");
    new Notice(`Exported ${formats.length} format(s) successfully`);
    this.selectedFormats.clear();
    this.render(btn.closest(".po-export-panel")!, view);
  }

  private pickDirectory(dirPathEl: HTMLElement): void {
    const view = this.view;
    if (!view) return;
    const modal = new FolderPickerModal(view.app, this.outputDir, (selectedPath: string) => {
      this.outputDir = selectedPath;
      dirPathEl.setText(selectedPath || "/");
      void view.setOutputDirectory(selectedPath);
    });
    modal.open();
  }
}

class FolderPickerModal extends Modal {
  constructor(
    app: App,
    private readonly currentPath: string,
    private readonly onSelect: (path: string) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("po-folder-picker-modal");
    new Setting(contentEl).setName("Select output directory").setHeading();

    const allPaths = this.app.vault
      .getAllLoadedFiles()
      .filter((f): f is TFolder => f instanceof TFolder)
      .map((f) => f.path);

    const searchInput = contentEl.createEl("input", {
      cls: "po-folder-picker-search",
      attr: {
        type: "text",
        placeholder: "Filter folders...",
      },
    });

    const list = contentEl.createDiv({ cls: "po-folder-picker-list" });

    const renderList = (query: string) => {
      list.empty();
      const lower = query.toLowerCase();
      const matches = allPaths
        .filter((p) => !lower || p.toLowerCase().includes(lower))
        .slice(0, 20);
      for (const path of matches) {
        const row = list.createDiv({ cls: "po-folder-picker-row" });
        if (path === this.currentPath) row.addClass("po-folder-picker-row-selected");
        const icon = row.createDiv({ cls: "po-folder-picker-icon" });
        setIcon(icon, "folder");
        row.createSpan({ text: path || "/" });
        row.addEventListener("click", () => {
          this.onSelect(path);
          this.close();
        });
      }
    };

    searchInput.addEventListener("input", () => renderList(searchInput.value));
    renderList(this.currentPath);
    window.setTimeout(() => searchInput.focus(), 0);
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
