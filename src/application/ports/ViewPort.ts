import { type FileRef } from "@domain/index";

export interface ViewPort {
  openFile(fileRef: FileRef): Promise<void>;
}
