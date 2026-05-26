import { type FileReader, type FileWriter } from "@application/index";
import { type FileRef } from "@application/index";
import { type App, TFile } from "obsidian";

export class ObsidianFileAccess implements FileReader, FileWriter {
  constructor(private app: App) {}

  private toFileRef(tfile: TFile): FileRef {
    return { path: tfile.path, name: tfile.name, extension: tfile.extension };
  }

  private toTFile(ref: FileRef): TFile | null {
    const file = this.app.vault.getAbstractFileByPath(ref.path);
    return file instanceof TFile ? file : null;
  }

  async read(file: FileRef): Promise<string> {
    const tfile = this.toTFile(file);
    if (!tfile) throw new Error(`File not found: ${file.path}`);
    return await this.app.vault.cachedRead(tfile);
  }

  async readByPath(path: string): Promise<FileRef> {
    const ref = await this.getFileByPath(path);
    if (!ref) throw new Error(`File not found: ${path}`);
    return ref;
  }

  async write(file: FileRef, content: string): Promise<void> {
    const tfile = this.toTFile(file);
    if (!tfile) throw new Error(`File not found: ${file.path}`);
    await this.app.vault.process(tfile, () => content);
  }

  async create(name: string, content: string): Promise<FileRef> {
    if (this.exists(name)) throw new Error(`File already exists: ${name}`);
    const tfile = await this.app.vault.create(name, content);
    return this.toFileRef(tfile);
  }

  async findByExtension(extension: string, folderPath: string): Promise<FileRef[]> {
    const ext = extension.startsWith(".") ? extension.slice(1) : extension;
    const prefix = folderPath.endsWith("/") ? folderPath : `${folderPath}/`;
    const allFiles = this.app.vault.getAllLoadedFiles();
    return allFiles
      .filter(
        (f): f is TFile => f instanceof TFile && f.extension === ext && f.path.startsWith(prefix),
      )
      .map((f) => ({ path: f.path, name: f.name, extension: f.extension }));
  }

  async getFileByPath(path: string): Promise<FileRef | null> {
    const file = this.app.vault.getAbstractFileByPath(path);
    return file instanceof TFile ? this.toFileRef(file) : null;
  }

  exists(name: string): boolean {
    return !!this.app.vault.getAbstractFileByPath(name);
  }

  getActiveFile(): FileRef | null {
    const file = this.app.workspace.getActiveFile();
    return file ? this.toFileRef(file) : null;
  }
}
