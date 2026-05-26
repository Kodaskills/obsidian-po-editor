import { type FileRef } from "@application/index";

export interface ViewNavigator {
  openFile(fileRef: FileRef): Promise<void>;
}
