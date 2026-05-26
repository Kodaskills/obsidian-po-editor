import { type ConvertToFormat, type ParsePO } from "@application/index";
import { getExtensionForFormat, type TranslationFormat } from "@application/index";
import { type POConverter } from "@infrastructure/index";
import { ExportFormatModal } from "@presentation/modals/ExportFormatModal";
import { type App, Notice } from "obsidian";

import type POEditorPlugin from "@/main";

export interface ExportFormatCommandOptions {
  targetFormat: TranslationFormat;
  outputFileName?: string;
  preserveComments?: boolean;
  preserveFlags?: boolean;
}

export class ExportFormatCommand {
  constructor(
    private readonly app: App,
    private readonly plugin: POEditorPlugin,
    private readonly convertToFormatUseCase: ConvertToFormat,
    private readonly parsePOUseCase: ParsePO,
    private readonly poConverter: POConverter,
  ) {}

  async execute(options: ExportFormatCommandOptions): Promise<string | null> {
    const activeFile = this.app.workspace.getActiveFile();

    if (!activeFile || activeFile.extension !== "po") {
      new Notice("No PO file is currently active", 5000);
      return null;
    }

    try {
      const content = await this.app.vault.cachedRead(activeFile);

      const parseResult = await this.parsePOUseCase.execute({
        content,
        converter: this.poConverter,
      });

      if (!parseResult.success || !parseResult.poFile) {
        new Notice(`Parse error: ${parseResult.error}`, 10000);
        return null;
      }

      const result = this.convertToFormatUseCase.execute({
        poFile: parseResult.poFile,
        targetFormat: options.targetFormat,
        options: {
          preserveComments: options.preserveComments ?? this.plugin.settings.preserveComments,
          preserveFlags: options.preserveFlags ?? true,
        },
      });

      if (!result.success || !result.content) {
        new Notice(`Export failed: ${result.error}`, 10000);
        return null;
      }

      for (const warning of result.warnings ?? []) {
        new Notice(`Warning: ${warning}`, 5000);
      }

      const ext = getExtensionForFormat(options.targetFormat).replace(".", "");
      const fileName = options.outputFileName || `${activeFile.basename}.${ext}`;
      const fullPath = `${this.plugin.settings.outputDirectory}/${fileName}`;

      const file = await this.app.vault.create(fullPath, result.content);
      new Notice(`Exported to ${file.name}`);

      return result.content;
    } catch (error) {
      new Notice(
        `Export failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        10000,
      );
      return null;
    }
  }

  showDialog(): void {
    new ExportFormatModal(this.app, (options) => {
      void this.execute(options);
    }).open();
  }

  getSupportedFormats(): TranslationFormat[] {
    return this.convertToFormatUseCase.getSupportedFormats();
  }
}
