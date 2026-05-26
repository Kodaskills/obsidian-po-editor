import type { FileRef } from "./FileRef";

export interface IPOFileIO {
  readFile(file: FileRef): Promise<string>;
  writeFile(file: FileRef, content: string): Promise<void>;
  upsertFile(path: string, content: string): Promise<void>;
}
