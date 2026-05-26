import type { FileAccess, FileRef, IPOFileIO } from "@application/index";

export class POFileIO implements IPOFileIO {
  constructor(private readonly fileAccess: FileAccess) {}

  async readFile(file: FileRef): Promise<string> {
    return this.fileAccess.read(file);
  }

  async writeFile(file: FileRef, content: string): Promise<void> {
    return this.fileAccess.write(file, content);
  }

  async upsertFile(path: string, content: string): Promise<void> {
    const existing = await this.fileAccess.getFileByPath(path);
    if (existing) {
      await this.fileAccess.write(existing, content);
    } else {
      await this.fileAccess.create(path, content);
    }
  }
}
