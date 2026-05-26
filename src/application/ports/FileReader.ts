import { type FileRef } from "@application/index";

export interface FileReader {
  read(file: FileRef): Promise<string>;
  readByPath(path: string): Promise<FileRef>;
  getFileByPath(path: string): Promise<FileRef | null>;
  exists(name: string): boolean;
  findByExtension(extension: string, folderPath: string): Promise<FileRef[]>;
  getActiveFile(): FileRef | null;
}
