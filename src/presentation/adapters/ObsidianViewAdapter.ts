import { type ViewPort } from "@application/index";
import { type FileRef } from "@domain/index";
import { type App, TFile } from "obsidian";

export class ObsidianViewAdapter implements ViewPort {
  constructor(private app: App) {}

  async openFile(fileRef: FileRef): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(fileRef.path);
    if (file instanceof TFile) {
      const leaf = this.app.workspace.getLeaf("tab");
      await leaf.openFile(file);
    }
  }
}
