import { type POHeader } from "@domain/index";
import { type App, Modal, Setting } from "obsidian";

export interface HeaderDiff {
  key: string;
  current: string;
  recommended: string;
  isDifferent: boolean;
}

export class HeaderFixModal extends Modal {
  private resolvePromise: ((value: boolean) => void) | null = null;

  constructor(
    app: App,
    private currentHeader: POHeader,
    private recommendedHeader: POHeader,
    private diffs: HeaderDiff[],
  ) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    new Setting(contentEl).setName("Update PO headers").setHeading();
    contentEl.createEl("p", {
      text: "The headers in this PO file seem incorrect or missing. Would you like to update them to the recommended values?",
      cls: "modal-description",
    });

    const diffContainer = contentEl.createDiv({ cls: "header-fix-modal-diff" });

    // Header for columns
    diffContainer.createDiv({ text: "Current", cls: "header-fix-modal-col-label" });
    diffContainer.createDiv({ text: "Recommended", cls: "header-fix-modal-col-label" });

    for (const diff of this.diffs) {
      if (!diff.isDifferent) continue;

      const currentItem = diffContainer.createDiv({ cls: "header-fix-modal-item" });
      currentItem.createDiv({ text: diff.key, cls: "header-fix-modal-item-key" });
      currentItem.createSpan({ text: diff.current || "(missing)" });
      if (!diff.current) currentItem.classList.add("is-missing");
      else currentItem.classList.add("is-changed");

      const recommendedItem = diffContainer.createDiv({ cls: "header-fix-modal-item recommended" });
      recommendedItem.createDiv({ text: diff.key, cls: "header-fix-modal-item-key" });
      recommendedItem.createSpan({ text: diff.recommended });
    }

    const buttonContainer = contentEl.createDiv({
      cls: "button-row",
    });

    buttonContainer.createEl("button", {
      text: "Keep current",
      cls: "btn",
    }).onclick = () => {
      this.resolvePromise?.(false);
      this.close();
    };

    buttonContainer.createEl("button", {
      text: "Update headers",
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
