import { FORMAT_LABELS, type TranslationFormat } from "@application/index";
import type { ExportFormatCommandOptions } from "@presentation/commands/ExportFormatCommand";
import { type App, Modal, Setting } from "obsidian";

export class ExportFormatModal extends Modal {
  private onSubmit: (options: ExportFormatCommandOptions) => void;
  private formatSelect: HTMLSelectElement;
  private outputFileNameInput: HTMLInputElement;

  constructor(app: App, onSubmit: (options: ExportFormatCommandOptions) => void) {
    super(app);
    this.onSubmit = onSubmit;
    this.formatSelect = {} as HTMLSelectElement;
    this.outputFileNameInput = {} as HTMLInputElement;
  }

  onOpen(): void {
    const { contentEl } = this;

    new Setting(contentEl).setName("Export PO file").setHeading();

    const form = contentEl.createDiv({ cls: "po-export-form" });

    const formatRow = form.createDiv({ cls: "form-row" });
    formatRow.createEl("label", { text: "Target format:" });
    this.formatSelect = formatRow.createEl("select");

    const formats: TranslationFormat[] = ["po", "xliff", "arb", "json", "yaml", "icu"];
    for (const format of formats) {
      const option = activeDocument!.createElement("option");
      option.value = format;
      option.textContent = FORMAT_LABELS[format];
      this.formatSelect.appendChild(option);
    }

    const outputRow = form.createDiv({ cls: "form-row" });
    outputRow.createEl("label", { text: "Output file name:" });
    this.outputFileNameInput = outputRow.createEl("input", {
      type: "text",
      placeholder: "translations.xliff",
    });

    const buttonRow = contentEl.createDiv({ cls: "button-row" });

    buttonRow.createEl("button", { text: "Cancel", cls: "btn" }).onclick = () => this.close();

    buttonRow.createEl("button", { text: "Export", cls: "btn btn-primary" }).onclick = () => {
      this.onSubmit({
        targetFormat: this.formatSelect.value as TranslationFormat,
        outputFileName: this.outputFileNameInput.value || undefined,
      });
      this.close();
    };
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
