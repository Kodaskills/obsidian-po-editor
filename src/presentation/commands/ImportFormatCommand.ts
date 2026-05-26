import { type ConvertFromFormat } from "@application/index";
import { type TranslationFormat } from "@application/index";
import { type POConverter } from "@infrastructure/index";
import { ImportFormatModal } from "@presentation/modals/ImportFormatModal";
import { type App, Notice, type TFile } from "obsidian";

import type POEditorPlugin from "@/main";

export interface ImportFormatCommandOptions {
  sourceFormat: TranslationFormat;
  sourceFile?: TFile;
  outputFileName?: string;
  preserveComments?: boolean;
  preserveFlags?: boolean;
}

export class ImportFormatCommand {
  constructor(
    private readonly app: App,
    private readonly plugin: POEditorPlugin,
    private readonly convertFromFormatUseCase: ConvertFromFormat,
    private readonly poConverter: POConverter,
  ) {}

  async execute(options: ImportFormatCommandOptions): Promise<TFile | null> {
    const settings = this.plugin.settings;

    if (!options.sourceFile) {
      new Notice("Please select a source file", 5000);
      return null;
    }

    let content: string;
    try {
      content = await this.app.vault.cachedRead(options.sourceFile);
    } catch (error) {
      new Notice(
        `Failed to read file: ${error instanceof Error ? error.message : "Unknown error"}`,
        10000,
      );
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

    for (const warning of result.warnings ?? []) {
      new Notice(`Warning: ${warning}`, 5000);
    }

    const poContent = this.poConverter.compile(result.poFile);

    // Fallback for filename: Use language from imported PO, or source file name, or 'und'
    const language = result.poFile.header.language || options.sourceFile.basename || "und";
    const fileName = options.outputFileName || `${language}.po`;

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
    new ImportFormatModal(this.app, (options) => {
      void this.execute(options);
    }).open();
  }

  getSupportedFormats(): TranslationFormat[] {
    return this.convertFromFormatUseCase.getSupportedFormats();
  }
}
