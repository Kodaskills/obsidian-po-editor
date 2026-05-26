import { type FileRef } from "@application/index";

export interface FileWriter {
  write(file: FileRef, content: string): Promise<void>;
  create(name: string, content: string): Promise<FileRef>;
}
