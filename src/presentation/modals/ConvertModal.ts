import { FORMAT_LABELS, type TranslationFormat } from "@application/index";
import { type App, Modal, Setting } from "obsidian";

export type ConvertMode = "import" | "export";

export interface ConvertModalResult {
  mode: ConvertMode;
  format: TranslationFormat;
  fileName?: string;
}

export class ConvertModal extends Modal {
  private result: ConvertModalResult | null = null;
  private mode: ConvertMode;
  private onSubmit: (result: ConvertModalResult) => void;
  private onGeneratePOT?: () => void;
  private formatSelect: HTMLSelectElement;
  private fileNameInput: HTMLInputElement;

  constructor(
    app: App,
    mode: ConvertMode,
    onSubmit: (result: ConvertModalResult) => void,
    onGeneratePOT?: () => void,
  ) {
    super(app);
    this.mode = mode;
    this.onSubmit = onSubmit;
    this.onGeneratePOT = onGeneratePOT;
    this.formatSelect = {} as HTMLSelectElement;
    this.fileNameInput = {} as HTMLInputElement;
  }

  onOpen(): void {
    const { contentEl } = this;

    const isImport = this.mode === "import";

    new Setting(contentEl)
      .setName(isImport ? "Import Translation File" : "Export PO File")
      .setHeading();

    const form = contentEl.createDiv({ cls: "convert-modal-form" });

    const formatRow = form.createDiv({ cls: "form-row" });
    formatRow.createEl("label", {
      text: isImport ? "Source Format:" : "Target Format:",
    });

    this.formatSelect = formatRow.createEl("select", {
      cls: "format-select",
    });

    const formats = this.getAvailableFormats();
    for (const format of formats) {
      const option = activeDocument!.createElement("option");
      option.value = format;
      option.textContent = FORMAT_LABELS[format];
      this.formatSelect.appendChild(option);
    }

    if (!isImport) {
      this.formatSelect.value = "xliff";
    }

    const fileNameRow = form.createDiv({ cls: "form-row" });
    fileNameRow.createEl("label", { text: "File name (optional):" });

    this.fileNameInput = fileNameRow.createEl("input", {
      type: "text",
      placeholder: isImport ? "output.po" : "translations.xliff",
      cls: "file-name-input",
    });

    const buttonRow = contentEl.createDiv({ cls: "button-row" });

    buttonRow.createEl("button", {
      text: "Cancel",
      cls: "btn",
    }).onclick = () => {
      this.close();
    };

    const submitButton = buttonRow.createEl("button", {
      text: isImport ? "Import" : "Export",
      cls: "btn btn-primary",
    });

    submitButton.onclick = () => {
      this.result = {
        mode: this.mode,
        format: this.formatSelect.value as TranslationFormat,
        fileName: this.fileNameInput.value || undefined,
      };
      this.onSubmit(this.result);
      this.close();
    };

    if (!isImport && this.onGeneratePOT) {
      contentEl.createEl("hr", {
        attr: {
          style:
            "margin: 16px 0; border: none; border-top: 1px solid var(--background-modifier-border);",
        },
      });
      const potRow = contentEl.createDiv({ cls: "po-convert-modal-pot-row" });
      potRow.createDiv({
        text: "Generate POT template from source language",
        cls: "po-convert-modal-pot-desc",
      });
      const potBtn = potRow.createEl("button", { cls: "btn", text: "Generate POT" });
      potBtn.onclick = () => {
        this.onGeneratePOT?.();
        this.close();
      };
    }
  }

  private getAvailableFormats(): TranslationFormat[] {
    if (this.mode === "import") {
      return ["po", "xliff", "arb", "json", "yaml", "icu"];
    }
    return ["xliff", "arb", "json", "yaml"];
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export function showConvertModal(
  app: App,
  mode: ConvertMode,
  onSubmit: (result: ConvertModalResult) => void,
): void {
  const modal = new ConvertModal(app, mode, onSubmit);
  modal.open();
}
