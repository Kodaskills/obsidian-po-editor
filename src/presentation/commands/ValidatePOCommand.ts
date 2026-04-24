import {
  formatValidationResult,
  type ParsePOUseCase,
  type ValidatePOUseCase,
} from "@application/index";
import { type POConverter } from "@infrastructure/index";
import { type App, MarkdownView, Modal, Notice } from "obsidian";

export interface ValidatePOCommandOptions {
  strictMode?: boolean;
  showModal?: boolean;
}

export class ValidatePOCommand {
  constructor(
    private app: App,
    private validatePOUseCase: ValidatePOUseCase,
    private parsePOUseCase: ParsePOUseCase,
    private poConverter: POConverter,
  ) {}

  async execute(
    options?: ValidatePOCommandOptions,
  ): Promise<{ valid: boolean; result: any } | null> {
    const activeFile = this.app.workspace.getActiveFile();

    if (!activeFile || activeFile.extension !== "po") {
      new Notice("No PO file is currently active", 5000);
      return null;
    }

    try {
      const content = await this.app.vault.cachedRead(activeFile);

      const parseResult = this.parsePOUseCase.execute({
        content,
        converter: this.poConverter,
      });

      if (!parseResult.success || !parseResult.poFile) {
        new Notice(`Parse error: ${parseResult.error}`, 10000);
        return null;
      }

      const validationResult = this.validatePOUseCase.execute({
        poFile: parseResult.poFile,
        strictMode: options?.strictMode ?? false,
      });

      const message = formatValidationResult(validationResult);

      if (options?.showModal !== false) {
        this.showValidationModal(message, validationResult.valid);
      } else {
        if (validationResult.valid) {
          new Notice(`✓ PO file is valid (${validationResult.statistics.total} entries)`);
        } else {
          new Notice(`✗ PO file has ${validationResult.errors.length} error(s)`, 10000);
        }
      }

      return {
        valid: validationResult.valid,
        result: validationResult,
      };
    } catch (error) {
      new Notice(
        `Validation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        10000,
      );
      return null;
    }
  }

  private showValidationModal(message: string, isValid: boolean): void {
    const modal = new ValidationResultModal(this.app, message, isValid);
    modal.open();
  }

  validateActiveEntry(): { valid: boolean; error?: string } {
    const activeFile = this.app.workspace.getActiveFile();

    if (!activeFile || activeFile.extension !== "po") {
      return { valid: false, error: "No PO file active" };
    }

    const editor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;

    if (!editor) {
      return { valid: false, error: "No editor available" };
    }

    const selection = editor.getSelection();

    if (!selection) {
      return { valid: false, error: "No text selected" };
    }

    const isValid = this.poConverter.validate(selection);

    return {
      valid: isValid.valid,
      error: isValid.error,
    };
  }
}

class ValidationResultModal extends Modal {
  private message: string;
  private isValid: boolean;

  constructor(app: App, message: string, isValid: boolean) {
    super(app);
    this.message = message;
    this.isValid = isValid;
  }

  onOpen(): void {
    const { contentEl } = this;

    contentEl.createEl("h2", {
      text: this.isValid ? "✓ Validation Passed" : "✗ Validation Failed",
      cls: this.isValid ? "validation-success" : "validation-error",
    });

    contentEl.createEl("pre", {
      text: this.message,
      cls: "validation-output",
    });

    contentEl.createEl("button", {
      text: "Close",
      cls: "btn",
    }).onclick = () => this.close();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
