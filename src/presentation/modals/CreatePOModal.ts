import { type FileRef } from "@application/index";
import { createPOHeader, PLURAL_FORMS } from "@domain/index";
import { type CreatePOCommandOptions } from "@presentation/index";
import { type App, Modal, Setting } from "obsidian";

const LANGUAGE_OPTIONS = Object.entries(PLURAL_FORMS)
  .map(([code, spec]) => ({ code, label: `${spec.examples ?? code} (${code})` }))
  .sort((a, b) => a.label.localeCompare(b.label));

export class CreatePOModal extends Modal {
  private onSubmit: (options: CreatePOCommandOptions) => void;
  private potFiles: FileRef[];
  private targetLang = "";
  private fileName = "";
  private potTemplatePath = "";

  constructor(app: App, potFiles: FileRef[], onSubmit: (options: CreatePOCommandOptions) => void) {
    super(app);
    this.potFiles = potFiles;
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;
    new Setting(contentEl).setName("Create new PO file").setHeading();

    const form = contentEl.createDiv({ cls: "po-modal-form" });

    this.renderLangSearch(form, "Target Language", this.targetLang, (code) => {
      this.targetLang = code;
      if (!this.fileName) fileNameInput.placeholder = `${code}.po`;
    });

    const fileRow = form.createDiv();
    fileRow.createEl("label", { text: "File name (optional)", cls: "po-modal-form-label" });
    const fileNameInput = fileRow.createEl("input", {
      cls: "po-modal-input",
      attr: { type: "text", placeholder: `${this.targetLang}.po` },
    });
    fileNameInput.oninput = () => {
      this.fileName = fileNameInput.value;
    };

    if (this.potFiles.length > 0) {
      const potRow = form.createDiv();
      potRow.createEl("label", { text: "POT template (optional)", cls: "po-modal-form-label" });
      const potSelect = potRow.createEl("select", { cls: "po-modal-select" });
      const emptyOpt = activeDocument!.createElement("option");
      emptyOpt.value = "";
      emptyOpt.textContent = "— none —";
      potSelect.appendChild(emptyOpt);
      this.potFiles.forEach((f) => {
        const opt = activeDocument!.createElement("option");
        opt.value = f.path;
        opt.textContent = f.name;
        potSelect.appendChild(opt);
      });
      potSelect.onchange = () => {
        this.potTemplatePath = potSelect.value;
      };
    }

    const btnRow = contentEl.createDiv({ cls: "po-modal-btn-row" });
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
    wrapper.createEl("label", { text: label, cls: "po-modal-form-label" });

    const searchWrap = wrapper.createDiv({ cls: "po-modal-lang-search-wrap" });
    const initialLabel = LANGUAGE_OPTIONS.find((l) => l.code === initial)?.label ?? initial;
    const input = searchWrap.createEl("input", {
      cls: "po-modal-input",
      attr: { type: "text", placeholder: "Search language...", value: initialLabel },
    });

    const dropdown = searchWrap.createDiv({ cls: "po-modal-lang-dropdown" });

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
          cls: `po-modal-lang-option${lang.code === selected ? " is-selected" : ""}`,
        });
        opt.onclick = () => {
          selected = lang.code;
          input.value = lang.label;
          dropdown.classList.remove("is-open");
          onChange(lang.code);
        };
      });
      dropdown.classList.toggle("is-open", matches.length > 0);
    };

    input.oninput = () => renderOptions(input.value);
    input.onfocus = () => renderOptions(input.value);
    input.onblur = () =>
      window.setTimeout(() => {
        dropdown.classList.remove("is-open");
      }, 150);
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
