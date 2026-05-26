import type { IPOFileIO } from "@application/index";
import { compositeEntryKey, getStatistics, isPluralEntry, type POEntry } from "@domain/index";
import type { POViewController } from "@presentation/index";
import { TFile } from "obsidian";

import { type ProjectFile } from "./POViewTypes";

export class POFileDataManager {
  siblingPoFiles: ProjectFile[] = [];
  sourceTextCache: Map<string, string | string[]> | null = null;

  private projectFilesCache: {
    folderPath: string;
    mtimes: Record<string, number>;
    files: ProjectFile[];
  } | null = null;

  constructor(
    private readonly fileIO: IPOFileIO,
    private readonly controller: POViewController,
  ) {}

  private isProjectFilesCacheValid(file: TFile): boolean {
    const cache = this.projectFilesCache;
    if (!cache || !file.parent) return false;
    if (cache.folderPath !== (file.parent.path ?? "/")) return false;
    for (const child of file.parent.children) {
      if (!(child instanceof TFile)) continue;
      if (child.extension !== "po" && child.extension !== "pot") continue;
      if (child.path === file.path) continue;
      if ((cache.mtimes[child.path] ?? -1) !== child.stat.mtime) return false;
    }
    return true;
  }

  async loadProjectFiles(file: TFile, sourceLanguage: string): Promise<void> {
    if (this.isProjectFilesCacheValid(file)) {
      this.siblingPoFiles = this.projectFilesCache!.files;
      this.buildSourceTextCache(sourceLanguage);
      return;
    }
    if (!file.parent) return;
    this.siblingPoFiles = [];
    const mtimes: Record<string, number> = {};
    for (const child of file.parent.children) {
      if (
        !(child instanceof TFile) ||
        (child.extension !== "po" && child.extension !== "pot") ||
        child.path === file.path
      )
        continue;
      const content = await this.fileIO.readFile({
        path: child.path,
        name: child.name,
        extension: child.extension,
      });
      const result = await this.controller.parse(content);
      if (!result.success || !result.poFile) continue;
      mtimes[child.path] = child.stat.mtime;
      this.siblingPoFiles.push({
        file: child,
        poFile: result.poFile,
        language: result.poFile.header.language || child.basename,
        stats: getStatistics(result.poFile),
      });
    }
    this.projectFilesCache = {
      folderPath: file.parent.path ?? "/",
      mtimes,
      files: this.siblingPoFiles,
    };
    this.buildSourceTextCache(sourceLanguage);
  }

  buildSourceTextCache(sourceLanguage: string): void {
    if (!sourceLanguage) {
      this.sourceTextCache = null;
      return;
    }
    const sourceFile = this.siblingPoFiles.find((f) => f.language === sourceLanguage);
    if (!sourceFile) {
      this.sourceTextCache = null;
      return;
    }
    const cache = new Map<string, string | string[]>();
    for (const entry of sourceFile.poFile.entries) {
      if (isPluralEntry(entry) && entry.msgstr) {
        cache.set(compositeEntryKey(entry), entry.msgstr);
      } else if (!isPluralEntry(entry) && entry.msgstr) {
        cache.set(compositeEntryKey(entry), entry.msgstr);
      }
    }
    this.sourceTextCache = cache;
  }

  resolveReferenceText(entry: POEntry): string | string[] | undefined {
    return this.sourceTextCache?.get(compositeEntryKey(entry));
  }

  invalidateCache(): void {
    this.projectFilesCache = null;
    this.siblingPoFiles = [];
    this.sourceTextCache = null;
  }
}
