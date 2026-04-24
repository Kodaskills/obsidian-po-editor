import { ConvertFromFormatUseCase } from "@application/index";
import { FORMAT_LABELS, type TranslationFormat } from "@domain/index";
import {
  ARBConverter,
  ICUConverter,
  JsonConverter,
  POConverter,
  XLIFFConverter,
  YamlConverter,
} from "@infrastructure/index";
import { type App, Modal, Notice, type TFile } from "obsidian";

import type POEditorPlugin from "../../main";

export interface ImportFormatCommandOptions {
  sourceFormat: TranslationFormat;
  sourceFile?: TFile;
  outputFileName?: string;
  preserveComments?: boolean;
  preserveFlags?: boolean;
}

export class ImportFormatCommand {
  private app: App;
  private plugin: POEditorPlugin;
  private convertFromFormatUseCase: ConvertFromFormatUseCase;
  private poConverter: POConverter;

  constructor(app: App, plugin: POEditorPlugin) {
    this.app = app;
    this.plugin = plugin;
    this.convertFromFormatUseCase = new ConvertFromFormatUseCase([
      new POConverter(),
      new XLIFFConverter(),
      new ARBConverter(),
      new JsonConverter(),
      new YamlConverter(),
      new ICUConverter(),
    ]);
    this.poConverter = new POConverter();
  }

  async execute(options: ImportFormatCommandOptions): Promise<TFile | null> {
    const settings = this.plugin.settings;

    let content: string;

    if (options.sourceFile) {
      try {
        content = await this.app.vault.cachedRead(options.sourceFile);
      } catch (error) {
        new Notice(
          `Failed to read file: ${error instanceof Error ? error.message : "Unknown error"}`,
          10000,
        );
        return null;
      }
    } else {
      new Notice("Please select a source file", 5000);
      return null;
    }

    const result = this.convertFromFormatUseCase.execute({
      content,
      sourceFormat: options.sourceFormat,
      options: {
        preserveComments: options.preserveComments ?? settings.preserveComments,
        preserveFlags: options.preserveFlags ?? true,
      },
    });

    if (!result.success || !result.poFile) {
      new Notice(`Import failed: ${result.error}`, 10000);
      return null;
    }

    if (result.warnings && result.warnings.length > 0) {
      for (const warning of result.warnings) {
        new Notice(`Warning: ${warning}`, 5000);
      }
    }

    const poContent = this.poConverter.compile(result.poFile);

    const fileName = options.outputFileName || `${settings.defaultLanguage}.po`;
    const fullPath = fileName.startsWith("/")
      ? fileName
      : `${settings.outputDirectory}/${fileName}`;

    try {
      const file = await this.app.vault.create(fullPath, poContent);
      new Notice(`Imported ${result.poFile.entries.length} entries to ${file.name}`);

      const leaf = this.app.workspace.getLeaf("tab");
      await leaf.openFile(file);

      return file;
    } catch (error) {
      new Notice(
        `Failed to create file: ${error instanceof Error ? error.message : "Unknown error"}`,
        10000,
      );
      return null;
    }
  }

  showDialog(): void {
    const modal = new ImportModal(this.app, async (options) => {
      await this.execute(options);
    });
    modal.open();
  }

  getSupportedFormats(): TranslationFormat[] {
    return this.convertFromFormatUseCase.getSupportedFormats();
  }
}

class ImportModal extends Modal {
  private onSubmit: (options: ImportFormatCommandOptions) => void;
  private formatSelect: HTMLSelectElement;
  private outputFileNameInput: HTMLInputElement;

  constructor(app: App, onSubmit: (options: ImportFormatCommandOptions) => void) {
    super(app);
    this.onSubmit = onSubmit;
    this.formatSelect = {} as HTMLSelectElement;
    this.outputFileNameInput = {} as HTMLInputElement;
  }

  onOpen(): void {
    const { contentEl } = this;

    contentEl.createEl("h2", { text: "Import Translation File" });

    const form = contentEl.createDiv({ cls: "po-import-form" });

    const formatRow = form.createDiv({ cls: "form-row" });
    formatRow.createEl("label", { text: "Source Format:" });
    this.formatSelect = formatRow.createEl("select") as HTMLSelectElement;

    const formats: TranslationFormat[] = ["po", "xliff", "arb", "json", "yaml", "icu"];
    for (const format of formats) {
      const option = document.createElement("option");
      option.value = format;
      option.textContent = FORMAT_LABELS[format];
      this.formatSelect.appendChild(option);
    }

    const fileRow = form.createDiv({ cls: "form-row" });
    fileRow.createEl("label", { text: "Source File:" });

    const outputRow = form.createDiv({ cls: "form-row" });
    outputRow.createEl("label", { text: "Output File Name:" });
    this.outputFileNameInput = outputRow.createEl("input", {
      type: "text",
      placeholder: "translations.po",
    }) as HTMLInputElement;

    const buttonRow = contentEl.createDiv({ cls: "button-row" });

    buttonRow.createEl("button", {
      text: "Cancel",
      cls: "btn",
    }).onclick = () => this.close();

    buttonRow.createEl("button", {
      text: "Import",
      cls: "btn btn-primary",
    }).onclick = () => {
      this.onSubmit({
        sourceFormat: this.formatSelect.value as TranslationFormat,
        outputFileName: this.outputFileNameInput.value || undefined,
      });
      this.close();
    };
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export function createImportFormatCommand(app: App, plugin: POEditorPlugin): ImportFormatCommand {
  return new ImportFormatCommand(app, plugin);
}
