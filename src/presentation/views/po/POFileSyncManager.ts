import type { IPOFileIO, SyncOrphanStrategy, TranslationFormat } from "@application/index";
import { isPluralEntry, parseNplurals, type POEntry, type POFile } from "@domain/index";
import { getStatistics } from "@domain/index";
import type { POViewController } from "@presentation/index";
import { TFile } from "obsidian";

import type { ProjectFile, SyncSource } from "./POViewTypes";

export interface SyncResult {
  mainPoFile: POFile;
  siblingPoFiles: ProjectFile[];
  message: string;
}

export class POFileSyncManager {
  constructor(
    private readonly fileIO: IPOFileIO,
    private readonly controller: POViewController,
  ) {}

  async exportToFormat(
    mainPoFile: POFile,
    file: TFile,
    format: TranslationFormat,
    outputDir?: string,
  ): Promise<{ success: boolean; error?: string }> {
    const potFile = this.toPOTFile(mainPoFile);
    const converted = this.controller.exportToFormat(potFile, format);
    if (!converted.success || !converted.content) {
      return { success: false, error: converted.error };
    }

    const ext = this.getExportExtension(format);
    const fileName = `${file.basename}.${ext}`;
    const folderPath = outputDir ?? file.parent?.path;
    const outPath = (folderPath === "/" ? "" : `${folderPath}/`) + fileName;
    try {
      await this.fileIO.upsertFile(outPath, converted.content);
      return { success: true };
    } catch {
      return { success: false, error: "could not write file" };
    }
  }

  async generatePOT(
    mainPoFile: POFile,
    file: TFile,
    siblingPoFiles: ProjectFile[],
    sourceLanguage: string,
    sourceFile?: TFile,
  ): Promise<{ success: boolean; path?: string }> {
    let source: { poFile: POFile; basename: string } | null;

    if (sourceFile) {
      const content = await this.fileIO.readFile({
        path: sourceFile.path,
        name: sourceFile.name,
        extension: sourceFile.extension,
      });
      const result = await this.controller.parse(content);
      if (!result.success || !result.poFile) return { success: false };
      source = {
        poFile: result.poFile,
        basename: sourceFile.basename.replace(/\.(po|pot)$/, ""),
      };
    } else {
      const mainLanguage = mainPoFile.header.language || file.basename;
      source =
        mainLanguage === sourceLanguage
          ? { poFile: mainPoFile, basename: file.basename.replace(/\.po$/, "") }
          : this.getSourceSibling(siblingPoFiles, sourceLanguage);
      if (!source) return { success: false };
    }

    const potFile: POFile = {
      charset: "utf-8",
      header: {
        ...mainPoFile.header,
        contentType: "text/plain; charset=UTF-8",
        contentTransferEncoding: "8bit",
        poRevisionDate: new Date().toISOString().replace(/\.\d{3}Z$/, "+0000"),
        mimeVersion: "1.0",
        xGenerator: "Obsidian PO Editor",
      },
      entries: this.toTemplateEntries(source.poFile.entries),
    };

    const folderPath = file.parent?.path;
    const potPath = `${(folderPath === "/" ? "" : `${folderPath}/`) + source.basename}.pot`;
    try {
      await this.fileIO.upsertFile(potPath, this.controller.compile(potFile));
      return { success: true, path: potPath };
    } catch {
      return { success: false };
    }
  }

  async syncFromFile(
    mainPoFile: POFile,
    file: TFile,
    sourceFile: TFile,
    siblingPoFiles: ProjectFile[],
    sourceLanguage: string,
    orphanStrategy?: SyncOrphanStrategy,
  ): Promise<SyncResult> {
    const content = await this.fileIO.readFile({
      path: sourceFile.path,
      name: sourceFile.name,
      extension: sourceFile.extension,
    });
    const result = await this.controller.parse(content);
    if (!result.success || !result.poFile) {
      throw new Error("Failed to parse source file");
    }
    const source: SyncSource = {
      type: sourceFile.extension === "pot" ? "pot" : "po",
      language: result.poFile.header.language || sourceFile.basename,
      entries: result.poFile.entries,
    };
    return this.synchronizeEntries(
      mainPoFile,
      file,
      siblingPoFiles,
      sourceLanguage,
      orphanStrategy,
      source,
    );
  }

  async synchronizeEntries(
    mainPoFile: POFile,
    file: TFile,
    siblingPoFiles: ProjectFile[],
    sourceLanguage: string,
    orphanStrategy?: SyncOrphanStrategy,
    customSource?: SyncSource,
  ): Promise<SyncResult> {
    const mainLanguage = mainPoFile.header.language || file.basename || "";
    const sourceEntries = this.resolveSyncSourceEntries(
      mainPoFile,
      siblingPoFiles,
      sourceLanguage,
      mainLanguage,
      customSource,
    );
    const mainTarget =
      mainLanguage !== sourceLanguage
        ? [{ language: mainLanguage, poFile: mainPoFile, nplurals: this.getNplurals(mainPoFile) }]
        : [];

    const { results, totalAdded, totalOrphaned } = this.controller.synchronize({
      sourceEntries,
      targets: [...mainTarget],
      orphanStrategy,
    });

    for (const result of results) {
      if (result.addedCount === 0 && result.orphanedCount === 0) continue;
      const sibling = siblingPoFiles.find((sf) => sf.language === result.language);
      if (sibling) {
        sibling.poFile = result.updatedFile;
        sibling.stats = getStatistics(result.updatedFile);
        await this.fileIO.writeFile(
          { path: sibling.file.path, name: sibling.file.name, extension: sibling.file.extension },
          this.controller.compile(result.updatedFile),
        );
      } else if (result.language === mainLanguage) {
        mainPoFile = result.updatedFile;
      }
    }

    const parts: string[] = [];
    if (totalAdded > 0) parts.push(`Added ${totalAdded} entr${totalAdded > 1 ? "ies" : "y"}`);
    if (totalOrphaned > 0) {
      const action = orphanStrategy === "delete" ? "Deleted" : "Archived";
      parts.push(`${action} ${totalOrphaned} entr${totalOrphaned > 1 ? "ies" : "y"}`);
    }
    const message = parts.length > 0 ? parts.join(", ") : "Already in sync";

    return { mainPoFile, siblingPoFiles, message };
  }

  private resolveSyncSourceEntries(
    mainPoFile: POFile,
    siblingPoFiles: ProjectFile[],
    sourceLanguage: string,
    mainLanguage: string,
    customSource?: SyncSource,
  ): POEntry[] {
    if (customSource?.entries) return customSource.entries;
    if (mainLanguage === sourceLanguage) return mainPoFile.entries ?? [];
    return (
      siblingPoFiles.find((file) => file.language === sourceLanguage)?.poFile.entries ??
      mainPoFile.entries ??
      []
    );
  }

  private getSourceSibling(
    siblingPoFiles: ProjectFile[],
    sourceLanguage: string,
  ): { poFile: POFile; basename: string } | null {
    const source = siblingPoFiles.find((file) => file.language === sourceLanguage);
    if (!source) return null;
    return { poFile: source.poFile, basename: source.file.basename.replace(/\.po$/, "") };
  }

  toPOTFile(poFile: POFile): POFile {
    return {
      ...poFile,
      header: {
        ...poFile.header,
        contentType: "text/plain; charset=UTF-8",
        contentTransferEncoding: "8bit",
        mimeVersion: "1.0",
        xGenerator: "Obsidian PO Editor",
      },
      entries: this.toTemplateEntries(poFile.entries),
    };
  }

  private toTemplateEntries(entries: POEntry[]): POEntry[] {
    const svc = this.controller.mutationService;
    return entries.map((entry) => {
      if (isPluralEntry(entry)) {
        const emptyMsgstr = Array.from({ length: entry.msgstr.length }, () => "");
        return svc.createPluralEntry(entry.msgid, entry.msgidPlural, emptyMsgstr, {
          msgctxt: entry.msgctxt,
          comments: { extracted: entry.comments?.extracted, reference: entry.comments?.reference },
          flags: entry.flags ?? [],
          obsolete: entry.obsolete,
        });
      }
      return svc.createSingularEntry(entry.msgid, "", {
        msgctxt: entry.msgctxt,
        comments: { extracted: entry.comments?.extracted, reference: entry.comments?.reference },
        flags: entry.flags ?? [],
        obsolete: entry.obsolete,
      });
    });
  }

  private readonly FORMAT_EXTENSIONS: Record<string, string> = {
    arb: "arb",
    json: "json",
    icu: "json",
    yaml: "yaml",
  };

  getExportExtension(format: string): string {
    return this.FORMAT_EXTENSIONS[format] ?? format;
  }

  private getNplurals(mainPoFile: POFile): number {
    return parseNplurals(mainPoFile.header.pluralForms ?? "");
  }
}
