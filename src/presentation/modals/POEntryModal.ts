import { FuzzyMatchingService } from "@application/services/FuzzyMatchingService";
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
  private fuzzyService: FuzzyMatchingService;
  private allEntries: POEntry[];

  constructor(
    app: App,
    initial: POEntry | undefined,
    allEntries: POEntry[],
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
    this.fuzzyService = new FuzzyMatchingService();
    this.allEntries = allEntries;

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
    new Setting(contentEl).setName(this.draft.msgid ? "Edit Entry" : "Add Entry").setHeading();

    const container = contentEl.createDiv({ cls: "po-entry-modal-container" });

    new Setting(container).setName("Context (msgctxt)").addText((text) =>
      text.setValue(this.draft.msgctxt || "").onChange((v) => {
        this.draft.msgctxt = v || undefined;
      }),
    );

    new Setting(container).setName("Msgid (source)").addTextArea((text) =>
      text.setValue(this.draft.msgid).onChange((v) => {
        this.draft.msgid = v;
        this.renderFuzzySuggestions(suggestionContainer);
      }),
    );

    const suggestionContainer = container.createDiv({ cls: "po-fuzzy-suggestions" });
    this.renderFuzzySuggestions(suggestionContainer);

    if (!this.isPOT) {
      this.msgstrWrapper = container.createDiv();
      if (this.draft.msgidPlural) this.msgstrWrapper.addClass("po-hidden");

      const msgstrSetting = new Setting(this.msgstrWrapper)
        .setName("Msgstr (translation)")
        .addTextArea((text) =>
          text.setValue(this.draft.msgstr).onChange((v) => {
            this.draft.msgstr = v;
          }),
        );
      (msgstrSetting.controlEl.querySelector("textarea") as HTMLTextAreaElement).id =
        "msgstr-textarea";

      new Setting(container)
        .setName("Msgid_plural (source plural)")
        .setDesc("Setting this enables plural forms")
        .addTextArea((text) =>
          text.setValue(this.draft.msgidPlural || "").onChange((v) => {
            const wasPlural = !!this.draft.msgidPlural;
            const isPlural = !!v;
            this.draft.msgidPlural = v || undefined;
            if (this.msgstrWrapper) {
              this.msgstrWrapper.classList.toggle("po-hidden", isPlural);
            }
            if (wasPlural !== isPlural) {
              this.updatePluralUI();
            }
          }),
        );

      this.pluralFieldsContainer = container.createDiv();
      this.updatePluralUI();

      contentEl.createEl("hr", { cls: "po-entry-modal-hr" });

      const flagsWrapper = contentEl.createDiv({ cls: "po-entry-modal-flags-wrap" });
      flagsWrapper.createEl("div", { text: "Flags (#,)", cls: "po-entry-modal-flags-label" });
      const flagGrid = flagsWrapper.createDiv({ cls: "po-entry-modal-flags-grid" });

      const fuzzyBtn = flagGrid.createEl("button", {
        text: "Fuzzy",
        cls: `btn btn-sm po-entry-modal-flag-btn po-entry-modal-flag-btn--fuzzy${this.draft.fuzzy ? " is-active" : ""}`,
      });
      fuzzyBtn.onclick = () => {
        this.draft.fuzzy = !this.draft.fuzzy;
        fuzzyBtn.classList.toggle("is-active", this.draft.fuzzy);
      };

      this.userFlags.forEach(({ flag, label, color }) => {
        const isActive = this.draft.flags.includes(flag);
        const accentColor = color || "var(--interactive-accent)";
        const btn = flagGrid.createEl("button", {
          text: label,
          cls: `btn btn-sm po-entry-modal-flag-btn${isActive ? " is-active" : ""}`,
        });
        btn.style.setProperty("--flag-active-bg", accentColor);
        btn.onclick = () => {
          if (this.draft.flags.includes(flag)) {
            this.draft.flags = this.draft.flags.filter((f) => f !== flag);
          } else {
            this.draft.flags = [...this.draft.flags, flag];
          }
          btn.classList.toggle("is-active", this.draft.flags.includes(flag));
        };
      });
    } else {
      this.pluralFieldsContainer = container.createDiv();
    }

    const commentSection = contentEl.createEl("details");
    commentSection.createEl("summary", { text: "Comments & metadata" });
    const commentGrid = commentSection.createDiv({ cls: "po-entry-modal-comment-grid" });

    this.addCommentSetting(commentGrid, "Translator (#)", "translator");
    this.addCommentSetting(commentGrid, "Extracted (#.) [Read Only]", "extracted", true);
    this.addCommentSetting(commentGrid, "Reference (#:)", "reference");
    this.addCommentSetting(commentGrid, "Previous (#|)", "previous");

    const btnRow = contentEl.createDiv({ cls: "po-modal-btn-row" });
    btnRow.createEl("button", { text: "Cancel", cls: "btn" }).onclick = () => this.close();
    btnRow.createEl("button", { text: "Save", cls: "btn btn-primary" }).onclick = () => {
      if (!this.draft.msgid?.trim()) {
        new Notice("Msgid is required");
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

  private renderFuzzySuggestions(container: HTMLElement) {
    container.empty();
    if (!this.draft.msgid.trim() || this.isPOT) return;

    const matches = this.fuzzyService.findMatches(this.draft.msgid, this.allEntries, 0.6);
    if (matches.length === 0) return;

    container.createEl("div", { text: "Suggestions", cls: "po-fuzzy-label" });
    matches.slice(0, 3).forEach((match) => {
      const row = container.createDiv({ cls: "po-fuzzy-suggestion-row" });
      row.createEl("span", { text: `${(match.score * 100).toFixed(0)}%`, cls: "po-fuzzy-score" });
      row.createEl("span", { text: match.msgstr, cls: "po-fuzzy-msgstr" });
      row.onclick = () => {
        this.draft.msgstr = match.msgstr;
        const textarea = this.contentEl.querySelector("#msgstr-textarea") as HTMLTextAreaElement;
        if (textarea) textarea.value = match.msgstr;
        new Notice("Translation applied");
      };
    });
  }

  private updatePluralUI() {
    const container = this.pluralFieldsContainer;
    container.empty();

    if (this.msgstrWrapper) {
      this.msgstrWrapper.classList.toggle("po-hidden", !!this.draft.msgidPlural);
    }

    if (!this.draft.msgidPlural) return;

    this.renderLanguageSelector(container);

    while (this.draft.msgstrPlural.length < this.nplurals) {
      this.draft.msgstrPlural.push("");
    }
    this.draft.msgstrPlural = this.draft.msgstrPlural.slice(0, this.nplurals);

    const labels = getPluralFormLabels(this.nplurals);
    const list = container.createDiv({ cls: "po-entry-modal-plural-list" });
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
    const wrapper = container.createDiv({ cls: "po-entry-modal-lang-selector" });

    wrapper.createEl("label", { text: "Plural forms language", cls: "po-entry-modal-lang-label" });

    const spec = getPluralFormSpec(this.currentLanguage);
    wrapper.createEl("div", {
      text: `nplurals=${spec.nplurals} · ${pluralFormsHeader(spec)}`,
      cls: "po-entry-modal-lang-spec",
    });

    const searchWrap = wrapper.createDiv({ cls: "po-modal-lang-search-wrap" });
    const input = searchWrap.createEl("input", {
      cls: "po-modal-input",
      attr: {
        type: "text",
        placeholder: "Search language...",
        value:
          LANGUAGE_OPTIONS.find((l) => l.code === this.currentLanguage)?.label ??
          this.currentLanguage,
      },
    });

    const dropdown = searchWrap.createDiv({ cls: "po-modal-lang-dropdown" });

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
          cls: `po-modal-lang-option${lang.code === this.currentLanguage ? " is-selected" : ""}`,
        });
        opt.onclick = () => {
          this.currentLanguage = lang.code;
          const newSpec = getPluralFormSpec(lang.code);
          this.nplurals = newSpec.nplurals;
          this.onHeaderChange({
            "Plural-Forms": pluralFormsHeader(newSpec),
          });
          input.value = lang.label;
          dropdown.classList.remove("is-open");
          this.updatePluralUI();
        };
      });
      dropdown.classList.toggle("is-open", matches.length > 0);
    };

    input.oninput = () => renderOptions(input.value);
    input.onfocus = () => renderOptions(input.value);
    dropdown.addEventListener("mousedown", (e) => e.preventDefault());
    input.addEventListener("focusout", () => dropdown.classList.remove("is-open"));
  }

  private addCommentSetting(
    parent: HTMLElement,
    label: string,
    key: keyof EntryDraft["comments"],
    readOnly: boolean = false,
  ) {
    const row = parent.createDiv({ cls: "po-entry-modal-comment-row" });
    row.createEl("label", { text: label, cls: "po-entry-modal-comment-label" });
    const input = row.createEl("textarea", { cls: "po-entry-modal-comment-input" });
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
