import { type FileRef } from "@domain/index";

export interface FilePort {
  read(file: FileRef): Promise<string>;
  write(file: FileRef, content: string): Promise<void>;
  create(name: string, content: string): Promise<FileRef>;
  exists(name: string): boolean;
  readByPath(path: string): Promise<FileRef>;
  getFileByPath(path: string): Promise<FileRef | null>;
  findByExtension(extension: string, folderPath: string): Promise<FileRef[]>;
  getActiveFile(): FileRef | null;
}
