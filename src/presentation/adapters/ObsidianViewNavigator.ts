import { type ViewNavigator } from "@application/index";
import { type FileRef } from "@application/index";
import { type App, TFile } from "obsidian";

export class ObsidianViewNavigator implements ViewNavigator {
  constructor(private app: App) {}

  async openFile(fileRef: FileRef): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(fileRef.path);
    if (file instanceof TFile) {
      const leaf = this.app.workspace.getLeaf("tab");
      await leaf.openFile(file);
    }
  }
}
