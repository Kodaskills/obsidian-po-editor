import {
  createPluralEntry,
  createSingularEntry,
  getPluralFormLabels,
  getPluralFormSpec,
  isPluralEntry,
  PLURAL_FORMS,
  type POEntry,
  type POFlag,
  pluralFormsHeader,
} from "@domain/index";
import { type CustomAction } from "@presentation/index";
import { type App, Modal, Notice, Setting } from "obsidian";

interface EntryDraft {
  msgid: string;
  msgstr: string;
  msgctxt?: string;
  msgidPlural?: string;
  msgstrPlural: string[];
  comments: {
    translator?: string;
    extracted?: string;
    reference?: string;
    previous?: string;
  };
  flags: string[];
  fuzzy: boolean;
  obsolete: boolean;
}

const LANGUAGE_OPTIONS: { code: string; label: string }[] = Object.entries(PLURAL_FORMS)
  .map(([code, spec]) => ({ code, label: `${spec.examples ?? code} (${code})` }))
  .sort((a, b) => a.label.localeCompare(b.label));

export class POEntryModal extends Modal {
  private draft: EntryDraft;
  private onSave: (entry: POEntry) => void;
  private onHeaderChange: (updates: Record<string, string>) => void;
  private pluralFieldsContainer!: HTMLDivElement;
  private msgstrWrapper: HTMLDivElement | null = null;
  private userFlags: { flag: string; label: string; color?: string }[];
  private stickyFlags: string[];
  private currentLanguage: string;
  private nplurals: number;
  private isPOT: boolean;

  constructor(
    app: App,
    initial: POEntry | undefined,
    onSave: (entry: POEntry) => void,
    quickActions: CustomAction[] = [],
    nplurals: number = 2,
    currentLanguage: string = "en",
    onHeaderChange: (updates: Record<string, string>) => void = () => {},
    isPOT: boolean = false,
  ) {
    super(app);
    this.onSave = onSave;
    this.onHeaderChange = onHeaderChange;
    this.nplurals = nplurals;
    this.currentLanguage = currentLanguage;
    this.isPOT = isPOT;

    // fuzzy handled as dedicated control — exclude from userFlags
    // this.userFlags = quickActions
    //   .filter((qa) => !!qa.flag && qa.flag !== "fuzzy")
    //   .map((qa) => ({ flag: qa.flag!, label: qa.label, color: qa.color }))

    this.userFlags = quickActions
      .filter(
        (qa): qa is CustomAction & { flag: string } => qa.flag !== undefined && qa.flag !== "fuzzy",
      )
      .map((qa) => ({
        flag: qa.flag,
        label: qa.label,
        color: qa.color,
      }));

    const userFlagValues = new Set(this.userFlags.map((f) => f.flag));

    if (initial) {
      // fuzzy excluded from both stickyFlags and userFlags — handled separately
      this.stickyFlags = (initial.flags ?? []).filter(
        (f) => !userFlagValues.has(f) && f !== "fuzzy",
      );
      this.draft = {
        msgid: initial.msgid,
        msgstr: isPluralEntry(initial) ? "" : initial.msgstr,
        msgctxt: initial.msgctxt,
        msgidPlural: isPluralEntry(initial) ? initial.msgidPlural : undefined,
        msgstrPlural: isPluralEntry(initial) ? [...initial.msgstr] : [],
        comments: { ...initial.comments },
        flags: (initial.flags ?? []).filter((f) => userFlagValues.has(f)),
        fuzzy: (initial.flags ?? []).includes("fuzzy"),
        obsolete: initial.obsolete ?? false,
      };
    } else {
      this.stickyFlags = [];
      this.draft = {
        msgid: "",
        msgstr: "",
        comments: {},
        flags: [],
        fuzzy: false,
        msgstrPlural: [],
        obsolete: false,
      };
    }
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: this.draft.msgid ? "Edit Entry" : "Add Entry" });

    const container = contentEl.createDiv({
      cls: "po-entry-modal-container",
      attr: { style: "display: flex; flex-direction: column; gap: 12px;" },
    });

    new Setting(container).setName("Context (msgctxt)").addText((text) =>
      text.setValue(this.draft.msgctxt || "").onChange((v) => {
        this.draft.msgctxt = v || undefined;
      }),
    );

    new Setting(container).setName("msgid (Source)").addTextArea((text) =>
      text.setValue(this.draft.msgid).onChange((v) => {
        this.draft.msgid = v;
      }),
    );

    if (!this.isPOT) {
      // msgstr hidden when plural mode active
      this.msgstrWrapper = container.createDiv();
      new Setting(this.msgstrWrapper).setName("msgstr (Translation)").addTextArea((text) =>
        text.setValue(this.draft.msgstr).onChange((v) => {
          this.draft.msgstr = v;
        }),
      );
      this.msgstrWrapper.style.display = this.draft.msgidPlural ? "none" : "block";

      new Setting(container)
        .setName("msgid_plural (Source Plural)")
        .setDesc("Setting this enables plural forms")
        .addTextArea((text) =>
          text.setValue(this.draft.msgidPlural || "").onChange((v) => {
            const wasPlural = !!this.draft.msgidPlural;
            const isPlural = !!v;
            this.draft.msgidPlural = v || undefined;
            if (this.msgstrWrapper) {
              this.msgstrWrapper.style.display = isPlural ? "none" : "block";
            }
            if (wasPlural !== isPlural) {
              this.updatePluralUI();
            }
          }),
        );

      this.pluralFieldsContainer = container.createDiv();
      this.updatePluralUI();

      // Separator before flags
      contentEl.createEl("hr", {
        attr: {
          style:
            "margin: 16px 0 12px; border: none; border-top: 1px solid var(--background-modifier-border);",
        },
      });

      // Fuzzy — core flag, always visible
      const flagsWrapper = contentEl.createDiv({ attr: { style: "margin-bottom: 12px;" } });
      flagsWrapper.createEl("div", {
        text: "Flags (#,)",
        attr: {
          style: "font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 8px;",
        },
      });
      const flagGrid = flagsWrapper.createDiv({
        attr: { style: "display: flex; flex-wrap: wrap; gap: 8px;" },
      });

      const fuzzyColor = "#f39c12";
      const fuzzyBtn = flagGrid.createEl("button", {
        text: "Fuzzy",
        cls: "btn btn-sm",
        attr: {
          style: `border-radius: 20px; background: ${this.draft.fuzzy ? fuzzyColor : "var(--background-secondary)"}; color: ${this.draft.fuzzy ? "white" : "var(--text-muted)"};`,
        },
      });
      fuzzyBtn.onclick = () => {
        this.draft.fuzzy = !this.draft.fuzzy;
        fuzzyBtn.style.background = this.draft.fuzzy ? fuzzyColor : "var(--background-secondary)";
        fuzzyBtn.style.color = this.draft.fuzzy ? "white" : "var(--text-muted)";
      };

      this.userFlags.forEach(({ flag, label, color }) => {
        const isActive = this.draft.flags.includes(flag);
        const accentColor = color || "var(--interactive-accent)";
        const btn = flagGrid.createEl("button", {
          text: label,
          cls: "btn btn-sm",
          attr: {
            style: `border-radius: 20px; background: ${isActive ? accentColor : "var(--background-secondary)"}; color: ${isActive ? "white" : "var(--text-muted)"};`,
          },
        });
        btn.onclick = () => {
          if (this.draft.flags.includes(flag)) {
            this.draft.flags = this.draft.flags.filter((f) => f !== flag);
          } else {
            this.draft.flags = [...this.draft.flags, flag];
          }
          const active = this.draft.flags.includes(flag);
          btn.style.background = active ? accentColor : "var(--background-secondary)";
          btn.style.color = active ? "white" : "var(--text-muted)";
        };
      });
    } else {
      // POT: placeholder for pluralFieldsContainer (updatePluralUI references it)
      this.pluralFieldsContainer = container.createDiv();
    }

    const commentSection = contentEl.createEl("details");
    commentSection.createEl("summary", { text: "Comments & Metadata" });
    const commentGrid = commentSection.createDiv({
      attr: { style: "display: grid; grid-template-columns: 1fr; gap: 8px; margin-top: 8px;" },
    });

    this.addCommentSetting(commentGrid, "Translator (#)", "translator");
    this.addCommentSetting(commentGrid, "Extracted (#.) [Read Only]", "extracted", true);
    this.addCommentSetting(commentGrid, "Reference (#:)", "reference");
    this.addCommentSetting(commentGrid, "Previous (#|)", "previous");

    const btnRow = contentEl.createDiv({
      attr: { style: "display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px;" },
    });
    btnRow.createEl("button", { text: "Cancel", cls: "btn" }).onclick = () => this.close();
    btnRow.createEl("button", { text: "Save", cls: "btn btn-primary" }).onclick = () => {
      if (!this.draft.msgid?.trim()) {
        new Notice("msgid is required");
        return;
      }
      if (this.isPOT) {
        this.onSave(
          createSingularEntry(this.draft.msgid, "", {
            msgctxt: this.draft.msgctxt,
            comments: {},
            flags: [],
            obsolete: false,
          }),
        );
      } else {
        const allFlags = [
          ...this.stickyFlags,
          ...(this.draft.fuzzy ? ["fuzzy"] : []),
          ...this.draft.flags,
        ] as POFlag[];
        if (this.draft.msgidPlural) {
          this.onSave(
            createPluralEntry(this.draft.msgid, this.draft.msgidPlural, this.draft.msgstrPlural, {
              msgctxt: this.draft.msgctxt,
              comments: this.draft.comments,
              flags: allFlags,
              obsolete: this.draft.obsolete,
            }),
          );
        } else {
          this.onSave(
            createSingularEntry(this.draft.msgid, this.draft.msgstr, {
              msgctxt: this.draft.msgctxt,
              comments: this.draft.comments,
              flags: allFlags,
              obsolete: this.draft.obsolete,
            }),
          );
        }
      }
      this.close();
    };
  }

  private updatePluralUI() {
    const container = this.pluralFieldsContainer;
    container.empty();

    if (this.msgstrWrapper) {
      this.msgstrWrapper.style.display = this.draft.msgidPlural ? "none" : "block";
    }

    if (!this.draft.msgidPlural) return;

    // Language selector (only shown for plural entries)
    this.renderLanguageSelector(container);

    // Ensure correct number of plural slots
    while (this.draft.msgstrPlural.length < this.nplurals) {
      this.draft.msgstrPlural.push("");
    }
    this.draft.msgstrPlural = this.draft.msgstrPlural.slice(0, this.nplurals);

    const labels = getPluralFormLabels(this.nplurals);
    const list = container.createDiv({
      attr: { style: "display: flex; flex-direction: column; gap: 8px; margin-top: 8px;" },
    });
    this.draft.msgstrPlural.forEach((val, i) => {
      new Setting(list)
        .setName(`msgstr[${i}] — ${labels[i] ?? `Form ${i}`}`)
        .addTextArea((text) => {
          text.setValue(val).onChange((v) => {
            this.draft.msgstrPlural[i] = v;
          });
        });
    });
  }

  private renderLanguageSelector(container: HTMLElement) {
    const wrapper = container.createDiv({
      attr: {
        style:
          "display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; padding: 12px; background: var(--background-secondary-alt); border-radius: 8px; border: 1px solid var(--background-modifier-border);",
      },
    });

    wrapper.createEl("label", {
      text: "Plural Forms Language",
      attr: { style: "font-size: 12px; font-weight: 600; color: var(--text-muted);" },
    });

    const spec = getPluralFormSpec(this.currentLanguage);
    wrapper.createEl("div", {
      text: `nplurals=${spec.nplurals} · ${pluralFormsHeader(spec)}`,
      attr: { style: "font-size: 11px; color: var(--text-faint); font-family: monospace;" },
    });

    const searchWrap = wrapper.createDiv({ attr: { style: "position: relative;" } });
    const input = searchWrap.createEl("input", {
      attr: {
        type: "text",
        placeholder: "Search language...",
        value:
          LANGUAGE_OPTIONS.find((l) => l.code === this.currentLanguage)?.label ??
          this.currentLanguage,
        style: "width: 100%; border-radius: 6px; padding: 6px 10px;",
      },
    });

    const dropdown = searchWrap.createDiv({
      attr: {
        style:
          "display: none; position: absolute; z-index: 1000; width: 100%; max-height: 200px; overflow-y: auto; background: var(--background-primary); border: 1px solid var(--background-modifier-border); border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); top: 100%; left: 0;",
      },
    });

    const renderOptions = (filter: string) => {
      dropdown.empty();
      const matches = filter
        ? LANGUAGE_OPTIONS.filter(
            (l) =>
              l.label.toLowerCase().includes(filter.toLowerCase()) ||
              l.code.toLowerCase().includes(filter.toLowerCase()),
          )
        : LANGUAGE_OPTIONS;
      matches.slice(0, 40).forEach((lang) => {
        const opt = dropdown.createDiv({
          text: lang.label,
          attr: {
            style: `padding: 8px 12px; cursor: pointer; font-size: 13px; ${lang.code === this.currentLanguage ? "background: var(--background-secondary); font-weight: 600;" : ""}`,
          },
        });
        opt.onmouseenter = () => {
          opt.style.background = "var(--background-modifier-hover)";
        };
        opt.onmouseleave = () => {
          opt.style.background =
            lang.code === this.currentLanguage ? "var(--background-secondary)" : "";
        };
        opt.onclick = () => {
          this.currentLanguage = lang.code;
          const newSpec = getPluralFormSpec(lang.code);
          this.nplurals = newSpec.nplurals;
          this.onHeaderChange({
            "Plural-Forms": pluralFormsHeader(newSpec),
          });
          input.value = lang.label;
          dropdown.style.display = "none";
          this.updatePluralUI();
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

  private addCommentSetting(
    parent: HTMLElement,
    label: string,
    key: keyof EntryDraft["comments"],
    readOnly: boolean = false,
  ) {
    const row = parent.createDiv({
      attr: { style: "display: flex; flex-direction: column; gap: 4px;" },
    });
    row.createEl("label", {
      text: label,
      attr: { style: "font-size: 12px; color: var(--text-muted);" },
    });
    const input = row.createEl("textarea", { attr: { style: "width: 100%; min-height: 40px;" } });
    if (readOnly) input.setAttribute("readonly", "true");
    input.value = this.draft.comments[key] || "";
    input.onchange = () => {
      if (readOnly) return;
      this.draft.comments[key] = input.value || undefined;
    };
  }

  onClose() {
    this.contentEl.empty();
  }
}
