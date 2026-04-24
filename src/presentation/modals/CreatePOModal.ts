import { createPOHeader, type FileRef, PLURAL_FORMS } from "@domain/index";
import { type CreatePOCommandOptions } from "@presentation/index";
import { type App, Modal } from "obsidian";

const LANGUAGE_OPTIONS = Object.entries(PLURAL_FORMS)
  .map(([code, spec]) => ({ code, label: `${spec.examples ?? code} (${code})` }))
  .sort((a, b) => a.label.localeCompare(b.label));

export class CreatePOModal extends Modal {
  private onSubmit: (options: CreatePOCommandOptions) => void;
  private potFiles: FileRef[];
  private targetLang = "";
  private sourceLang = "en";
  private fileName = "";
  private potTemplatePath = "";

  constructor(app: App, potFiles: FileRef[], onSubmit: (options: CreatePOCommandOptions) => void) {
    super(app);
    this.potFiles = potFiles;
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "Create New PO File" });

    const form = contentEl.createDiv({
      attr: { style: "display: flex; flex-direction: column; gap: 16px;" },
    });

    this.renderLangSearch(form, "Target Language", this.targetLang, (code) => {
      this.targetLang = code;
      if (!this.fileName) fileNameInput.placeholder = `${code}.po`;
    });

    this.renderLangSearch(form, "Source Language", this.sourceLang, (code) => {
      this.sourceLang = code;
    });

    const fileRow = form.createDiv();
    fileRow.createEl("label", {
      text: "File Name (optional)",
      attr: {
        style:
          "display: block; font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px;",
      },
    });
    const fileNameInput = fileRow.createEl("input", {
      attr: {
        type: "text",
        placeholder: `${this.targetLang}.po`,
        style: "width: 100%; border-radius: 6px; padding: 6px 10px;",
      },
    });
    fileNameInput.oninput = () => {
      this.fileName = fileNameInput.value;
    };

    if (this.potFiles.length > 0) {
      const potRow = form.createDiv();
      potRow.createEl("label", {
        text: "POT Template (optional)",
        attr: {
          style:
            "display: block; font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px;",
        },
      });
      const potSelect = potRow.createEl("select", {
        attr: { style: "width: 100%; border-radius: 6px; padding: 6px 10px;" },
      }) as HTMLSelectElement;
      const emptyOpt = document.createElement("option");
      emptyOpt.value = "";
      emptyOpt.textContent = "— None —";
      potSelect.appendChild(emptyOpt);
      this.potFiles.forEach((f) => {
        const opt = document.createElement("option");
        opt.value = f.path;
        opt.textContent = f.name;
        potSelect.appendChild(opt);
      });
      potSelect.onchange = () => {
        this.potTemplatePath = potSelect.value;
      };
    }

    const btnRow = contentEl.createDiv({
      attr: { style: "display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px;" },
    });
    btnRow.createEl("button", { text: "Cancel", cls: "btn" }).onclick = () => this.close();
    btnRow.createEl("button", { text: "Create", cls: "btn btn-primary" }).onclick = () => {
      const options: CreatePOCommandOptions = {
        header: createPOHeader(this.targetLang),
      };
      if (this.fileName.trim()) options.fileName = this.fileName.trim();
      if (this.potTemplatePath) options.potTemplatePath = this.potTemplatePath;
      this.onSubmit(options);
      this.close();
    };
  }

  private renderLangSearch(
    parent: HTMLElement,
    label: string,
    initial: string,
    onChange: (code: string) => void,
  ): void {
    const wrapper = parent.createDiv();
    wrapper.createEl("label", {
      text: label,
      attr: {
        style:
          "display: block; font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px;",
      },
    });

    const searchWrap = wrapper.createDiv({ attr: { style: "position: relative;" } });
    const initialLabel = LANGUAGE_OPTIONS.find((l) => l.code === initial)?.label ?? initial;
    const input = searchWrap.createEl("input", {
      attr: {
        type: "text",
        placeholder: "Search language...",
        value: initialLabel,
        style: "width: 100%; border-radius: 6px; padding: 6px 10px;",
      },
    });

    const dropdown = searchWrap.createDiv({
      attr: {
        style:
          "display: none; position: absolute; z-index: 1000; width: 100%; max-height: 200px; overflow-y: auto; background: var(--background-primary); border: 1px solid var(--background-modifier-border); border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); top: 100%; left: 0;",
      },
    });

    let selected = initial;

    const renderOptions = (filter: string) => {
      dropdown.empty();
      const matches = filter
        ? LANGUAGE_OPTIONS.filter(
            (l) =>
              l.label.toLowerCase().includes(filter.toLowerCase()) ||
              l.code.toLowerCase().includes(filter.toLowerCase()),
          )
        : LANGUAGE_OPTIONS;
      matches.slice(0, 50).forEach((lang) => {
        const opt = dropdown.createDiv({
          text: lang.label,
          attr: {
            style: `padding: 8px 12px; cursor: pointer; font-size: 13px; ${lang.code === selected ? "background: var(--background-secondary); font-weight: 600;" : ""}`,
          },
        });
        opt.onmouseenter = () => {
          opt.style.background = "var(--background-modifier-hover)";
        };
        opt.onmouseleave = () => {
          opt.style.background = lang.code === selected ? "var(--background-secondary)" : "";
        };
        opt.onclick = () => {
          selected = lang.code;
          input.value = lang.label;
          dropdown.style.display = "none";
          onChange(lang.code);
        };
      });
      dropdown.style.display = matches.length > 0 ? "block" : "none";
    };

    input.oninput = () => renderOptions(input.value);
    input.onfocus = () => renderOptions(input.value);
    input.onblur = () =>
      setTimeout(() => {
        dropdown.style.display = "none";
      }, 150);
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
