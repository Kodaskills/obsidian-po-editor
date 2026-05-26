import { type App, Modal } from "obsidian";

export class ConfirmModal extends Modal {
  private resolvePromise: ((value: boolean) => void) | null = null;

  constructor(
    app: App,
    private message: string,
  ) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("p", {
      text: this.message,
      cls: "confirm-modal-message",
    });

    const buttonContainer = contentEl.createDiv({
      cls: "confirm-modal-buttons",
    });

    buttonContainer.createEl("button", {
      text: "Cancel",
      cls: "btn",
    }).onclick = () => {
      this.resolvePromise?.(false);
      this.close();
    };

    buttonContainer.createEl("button", {
      text: "Confirm",
      cls: "btn btn-primary",
    }).onclick = () => {
      this.resolvePromise?.(true);
      this.close();
    };
  }

  onClose(): void {
    this.contentEl.empty();
  }

  confirm(): Promise<boolean> {
    const pr = Promise.withResolvers<boolean>();
    this.resolvePromise = pr.resolve;
    this.open();
    return pr.promise;
  }
}
