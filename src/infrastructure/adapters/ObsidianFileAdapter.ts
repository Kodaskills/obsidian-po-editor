import { type FilePort } from "@application/index";
import { type FileRef } from "@domain/index";
import { type App, TFile } from "obsidian";

export class ObsidianFileAdapter implements FilePort {
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
    await this.app.vault.modify(tfile, content);
  }

  async create(name: string, content: string): Promise<FileRef> {
    if (this.exists(name)) throw new Error(`File already exists: ${name}`);
    const tfile = await this.app.vault.create(name, content);
    return this.toFileRef(tfile);
  }

  async findByExtension(extension: string, folderPath: string): Promise<FileRef[]> {
    const ext = extension.startsWith(".") ? extension.slice(1) : extension;
    const adapter = this.app.vault.adapter;
    const result: FileRef[] = [];

    async function recurse(currentPath: string) {
      const listed = await adapter.list(currentPath);
      for (const file of listed.files) {
        if (file.endsWith(`.${ext}`)) {
          result.push({ path: file, name: file, extension: ext });
        }
      }
      for (const subfolder of listed.folders) {
        await recurse(subfolder);
      }
    }

    await recurse(folderPath);
    return result;
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
