import { type Confirmer } from "@application/index";
import { ConfirmModal } from "@presentation/index";
import { type App } from "obsidian";

export class ObsidianConfirmer implements Confirmer {
  constructor(private app: App) {}
  async confirm(message: string): Promise<boolean> {
    const modal = new ConfirmModal(this.app, message);
    return await modal.confirm();
  }
}
