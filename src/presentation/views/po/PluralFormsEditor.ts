import {
  getLanguageDisplayName,
  getPluralFormLabels,
  getPluralFormSpec,
  pluralFormsHeader,
  PLURAL_FORMS,
  type POPluralEntry,
} from "@domain/index";
import type {
  CustomAction,
  POEntryActions,
  POTranslationActions,
  POEditorLayoutActions,
  PONavigationActions,
  POVisibilityActions,
  POViewQueries,
} from "@presentation/index";
import { setIcon, setTooltip } from "obsidian";

import {
  makeInlineEditable,
  renderCommentSection,
  renderEntryActions,
  renderExtraCommentsSection,
  renderPlaceholderChips,
  renderQuickActionsPanel,
  debounce,
} from "./POEditorPanelShared";
import { isFuzzy as isEntryFuzzy } from "./POEntryHelpers";
import type { POViewSnapshot } from "./POViewTypes";

type Actions = POEntryActions &
  POTranslationActions &
  POEditorLayoutActions &
  PONavigationActions &
  POVisibilityActions;

export class PluralFormsEditor {
  constructor(
    private readonly queries: POViewQueries,
    private readonly actions: Actions,
  ) {}

  render(
    container: HTMLElement,
    entry: POPluralEntry,
    snapshot: POViewSnapshot,
    quickActions: CustomAction[],
  ): HTMLTextAreaElement[] {
    const section = container.createDiv({ cls: "po-editor-target-section" });
    const meta = section.createDiv({ cls: "po-editor-target-meta" });
    const metaLeft = meta.createDiv({ cls: "po-editor-target-meta-left" });
    const langCode = snapshot.mainPoFile.header.language || snapshot.file.basename;
    metaLeft.createSpan({
      cls: "po-editor-section-label",
      text: getLanguageDisplayName(langCode) ?? langCode.toUpperCase(),
    });
    if (entry.msgctxt) {
      metaLeft.createSpan({ cls: "po-editor-source-key-chip", text: entry.msgctxt });
    }
    const targetTools = meta.createDiv({ cls: "po-editor-target-tools" });
    const isFuzzy = isEntryFuzzy(entry);

    const nplurals = entry.msgstr.length;

    const sourcePlaceholders = this.queries.detectPlaceholders(entry.msgid);
    const qaContainer = section.createDiv();

    const pluralHeader = section.createDiv({ cls: "po-editor-plural-header" });
    pluralHeader.createSpan({ cls: "po-editor-section-label", text: "Plural" });
    const pluralMsgidEl = pluralHeader.createDiv({
      cls: "po-editor-plural-msgid",
      text: entry.msgidPlural,
    });
    setTooltip(pluralMsgidEl, "Double-click to edit");
    makeInlineEditable(pluralMsgidEl, entry, "msgid_plural", this.actions);
    if (!entry.msgidPlural) {
      pluralMsgidEl.contentEditable = "true";
      pluralHeader.createDiv({
        cls: "po-editor-validation-error",
        text: "msgid_plural is required",
      });
    }

    const labels = getPluralFormLabels(nplurals);
    const textareas: HTMLTextAreaElement[] = [];

    for (let i = 0; i < nplurals; i++) {
      const formRow = section.createDiv({ cls: "po-editor-plural-form-row" });
      const label = formRow.createSpan({ cls: "po-editor-plural-form-label" });
      label.createSpan({
        cls: "po-editor-plural-form-tag",
        text: (labels[i] ?? `Form ${i}`).toUpperCase(),
      });
      const inputRow = formRow.createDiv({ cls: "po-editor-input-row" });
      const textarea = inputRow.createEl("textarea", {
        cls: "po-editor-textarea",
        attr: { placeholder: `Enter ${(labels[i] ?? `form ${i}`).toLowerCase()} translation...` },
      });
      textarea.value = entry.msgstr[i] ?? "";
      const debouncedSavePlural = debounce(
        ((value: string) => {
          this.actions.saveCurrentTranslation(value, false, i);
        }) as (...args: unknown[]) => void,
        300,
      );
      let saveFlashTimer: ReturnType<typeof window.setTimeout> | null = null;
      textarea.oninput = () => {
        debouncedSavePlural(textarea.value);
        checkQA();
        if (saveFlashTimer !== null) window.clearTimeout(saveFlashTimer);
        textarea.classList.remove("is-saved");
        saveFlashTimer = window.setTimeout(() => {
          saveFlashTimer = null;
          textarea.classList.add("is-saved");
        }, 400);
      };
      textarea.addEventListener("animationend", () => textarea.classList.remove("is-saved"));
      textareas.push(textarea);
    }

    const fuzzy = targetTools.createDiv({
      cls: `po-editor-fuzzy-toggle ${isFuzzy ? "is-active" : ""} po-editor-icon-button`,
    });
    setIcon(fuzzy, isFuzzy ? "cloud" : "cloud-off");
    setTooltip(fuzzy, isFuzzy ? "Clear fuzzy flag" : "Mark as fuzzy");
    fuzzy.onclick = () => {
      this.actions.saveCurrentTranslation(textareas[0]?.value ?? "", false);
      this.actions.toggleFuzzy(entry);
    };

    const toSingular = targetTools.createDiv({ cls: "po-editor-icon-button" });
    setIcon(toSingular, "minimize");
    setTooltip(toSingular, "Convert to singular");
    toSingular.onclick = () => this.actions.convertToSingular(entry);

    renderEntryActions(targetTools, entry, this.actions);

    if (quickActions.length > 0) {
      const firstInputRow = textareas[0]?.closest(".po-editor-input-row") as HTMLElement;
      if (firstInputRow) {
        renderQuickActionsPanel(firstInputRow, entry, textareas[0], quickActions, this.actions);
      }
    }

    const checkQA = () => {
      qaContainer.empty();
      if (sourcePlaceholders.length === 0) return;
      for (let fi = 0; fi < textareas.length; fi++) {
        const targetPlaceholders = this.queries.detectPlaceholders(textareas[fi]?.value ?? "");
        const missing = sourcePlaceholders.filter((p) => !targetPlaceholders.includes(p));
        if (missing.length > 0) {
          const qa = qaContainer.createDiv({ cls: "po-editor-qa" });
          setIcon(qa.createDiv({ cls: "po-editor-qa-icon" }), "alert-triangle");
          const formLabel = labels[fi] ?? `Form ${fi}`;
          const msg = `${formLabel}: Missing ${missing.join(", ")}`;
          setTooltip(qa, msg);
          qa.createSpan({ text: msg });
        }
      }
    };
    checkQA();
    renderPlaceholderChips(section, sourcePlaceholders, textareas[0], (value) => {
      textareas[0].value = value;
      textareas[0].dispatchEvent(new Event("input"));
    });

    renderCommentSection(section, entry, this.actions);
    renderExtraCommentsSection(section, entry, this.actions);

    const currentLang = this.queries.getSnapshot().mainPoFile.header.language;
    this.renderPluralFormsDropdown(section, entry, currentLang);

    textareas[0].onkeydown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        this.actions.saveCurrentTranslation(textareas[0].value, true);
      } else if (event.altKey && event.key === "ArrowUp") {
        event.preventDefault();
        this.actions.navigateEntry(-1, textareas[0].value);
      } else if (event.altKey && event.key === "ArrowDown") {
        event.preventDefault();
        this.actions.navigateEntry(1, textareas[0].value);
      } else if (event.key === "Escape") {
        event.preventDefault();
        this.actions.setEditorPanelState("closed");
      }
    };

    for (let i = 1; i < textareas.length; i++) {
      const ta = textareas[i];
      ta.onkeydown = (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          this.actions.setEditorPanelState("closed");
        }
      };
    }

    return textareas;
  }

  private renderPluralFormsDropdown(
    container: HTMLElement,
    entry: POPluralEntry,
    currentLang: string | undefined,
  ): void {
    const langOptions = Object.entries(PLURAL_FORMS)
      .map(([code, spec]) => ({ code, label: `${spec.examples ?? code} (${code})` }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const formsControls = container.createDiv({ cls: "po-editor-plural-forms-controls" });

    const spec = currentLang ? getPluralFormSpec(currentLang) : null;
    if (spec) {
      formsControls.createDiv({
        cls: "po-editor-plural-forms-spec",
        text: `nplurals=${spec.nplurals} · ${pluralFormsHeader(spec)}`,
      });
    }

    const searchWrap = formsControls.createDiv({ cls: "po-editor-plural-forms-search" });
    const input = searchWrap.createEl("input", {
      cls: "po-editor-plural-forms-input",
      attr: {
        type: "text",
        placeholder: "Change plural forms by language search",
        value: currentLang
          ? (langOptions.find((l) => l.code === currentLang)?.label ?? currentLang)
          : "",
      },
    });

    const dropdown = searchWrap.createDiv({ cls: "po-editor-plural-forms-dropdown" });

    const showDropdown = () => {
      const rect = input.getBoundingClientRect();
      dropdown.style.setProperty("--dropdown-top", `${rect.bottom}px`);
      dropdown.style.setProperty("--dropdown-left", `${rect.left}px`);
      dropdown.style.setProperty("--dropdown-width", `${rect.width}px`);
      activeDocument!.body.appendChild(dropdown);
    };

    const hideDropdown = () => {
      if (dropdown.parentNode === activeDocument!.body) {
        searchWrap.appendChild(dropdown);
      }
      dropdown.classList.remove("is-open");
    };

    const renderOptions = (filter: string) => {
      dropdown.empty();
      const originalValue = input.value;
      const matches = filter
        ? langOptions.filter(
            (l) =>
              l.label.toLowerCase().includes(filter.toLowerCase()) ||
              l.code.toLowerCase().includes(filter.toLowerCase()),
          )
        : langOptions;
      matches.slice(0, 40).forEach((lang) => {
        const opt = dropdown.createDiv({
          cls: `po-editor-plural-forms-option${lang.code === currentLang ? " is-selected" : ""}`,
          text: lang.label,
        });
        opt.onclick = async () => {
          if (lang.code !== currentLang) {
            const spec = getPluralFormSpec(lang.code);
            const confirmed = await this.actions.confirm(
              `Change plural forms language to ${lang.label}?\n\nThis will update the file header to:\n${pluralFormsHeader(spec)}\n\nAll entries will be resized to ${spec.nplurals} plural form${spec.nplurals > 1 ? "s" : ""}.`,
            );
            if (!confirmed) {
              input.value = originalValue;
              return;
            }
          }
          this.actions.setLanguagePluralForms(lang.code);
          input.value = lang.label;
          hideDropdown();
        };
      });
      if (matches.length > 0) {
        showDropdown();
        dropdown.classList.add("is-open");
      } else {
        hideDropdown();
      }
    };

    const repositionDropdown = () => {
      if (dropdown.parentNode === activeDocument!.body && dropdown.classList.contains("is-open")) {
        const rect = input.getBoundingClientRect();
        dropdown.style.setProperty("--dropdown-top", `${rect.bottom}px`);
        dropdown.style.setProperty("--dropdown-left", `${rect.left}px`);
        dropdown.style.setProperty("--dropdown-width", `${rect.width}px`);
      }
    };

    input.oninput = () => renderOptions(input.value);
    input.onfocus = () => renderOptions(input.value);
    dropdown.addEventListener("mousedown", (e) => e.preventDefault());
    input.addEventListener("focusout", () => hideDropdown());
    input.onkeydown = (e) => {
      if (e.key === "Escape") hideDropdown();
    };

    const scrollParent = input.closest(".po-editor-content");
    scrollParent?.addEventListener("scroll", repositionDropdown, { passive: true });
    window.addEventListener("resize", repositionDropdown);
  }
}
