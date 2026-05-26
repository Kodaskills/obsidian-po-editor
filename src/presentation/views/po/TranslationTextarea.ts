import { getLanguageDisplayName, type POEntry } from "@domain/index";
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
  renderCommentSection,
  renderEntryActions,
  renderExtraCommentsSection,
  renderPlaceholderChips,
  renderQuickActionsPanel,
  renderFuzzySuggestionsPanel,
  debounce,
} from "./POEditorPanelShared";
import { isFuzzy as isEntryFuzzy } from "./POEntryHelpers";

type Actions = POEntryActions &
  POTranslationActions &
  POEditorLayoutActions &
  PONavigationActions &
  POVisibilityActions;

export class TranslationTextarea {
  constructor(
    private readonly queries: POViewQueries,
    private readonly actions: Actions,
  ) {}

  render(
    container: HTMLElement,
    entry: POEntry,
    initialValue: string,
    quickActions: CustomAction[],
  ): HTMLTextAreaElement {
    const snapshot = this.queries.getSnapshot();
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

    const sourcePlaceholders = this.queries.detectPlaceholders(entry.msgid);
    const qaContainer = section.createDiv();

    const inputRow = section.createDiv({ cls: "po-editor-input-row" });
    let currentValue = initialValue;
    const textarea = inputRow.createEl("textarea", {
      cls: "po-editor-textarea",
      attr: { placeholder: "Enter translation..." },
    });
    textarea.value = currentValue;

    renderFuzzySuggestionsPanel(section, entry, textarea, this.queries.getFilteredEntries());

    const fuzzy = targetTools.createDiv({
      cls: `po-editor-fuzzy-toggle ${isFuzzy ? "is-active" : ""} po-editor-icon-button`,
    });
    setIcon(fuzzy, isFuzzy ? "cloud" : "cloud-off");
    setTooltip(fuzzy, isFuzzy ? "Clear fuzzy flag" : "Mark as fuzzy");
    fuzzy.onclick = () => {
      this.actions.saveCurrentTranslation(textarea.value, false);
      this.actions.toggleFuzzy(entry);
    };

    const toPlural = targetTools.createDiv({ cls: "po-editor-icon-button" });
    setIcon(toPlural, "list");
    setTooltip(toPlural, "Convert to plural");
    toPlural.onclick = () => this.actions.convertToPlural(entry);

    renderEntryActions(targetTools, entry, this.actions);

    if (quickActions.length > 0) {
      renderQuickActionsPanel(inputRow, entry, textarea, quickActions, this.actions);
    }

    textarea.onkeydown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        this.actions.saveCurrentTranslation(textarea.value, true);
      } else if (event.altKey && event.key === "ArrowUp") {
        event.preventDefault();
        this.actions.navigateEntry(-1, textarea.value);
      } else if (event.altKey && event.key === "ArrowDown") {
        event.preventDefault();
        this.actions.navigateEntry(1, textarea.value);
      } else if (event.key === "Escape") {
        event.preventDefault();
        this.actions.setEditorPanelState("closed");
      }
    };

    const checkQA = () => {
      qaContainer.empty();
      if (sourcePlaceholders.length === 0) return;
      const targetPlaceholders = this.queries.detectPlaceholders(currentValue);
      const missing = sourcePlaceholders.filter(
        (placeholder) => !targetPlaceholders.includes(placeholder),
      );
      if (missing.length > 0) {
        const qa = qaContainer.createDiv({ cls: "po-editor-qa" });
        setIcon(qa.createDiv({ cls: "po-editor-qa-icon" }), "alert-triangle");
        qa.createSpan({ text: `Missing placeholders: ${missing.join(", ")}` });
      }
    };
    checkQA();
    renderPlaceholderChips(section, sourcePlaceholders, textarea, (value) => {
      currentValue = value;
      checkQA();
    });

    renderCommentSection(section, entry, this.actions);
    renderExtraCommentsSection(section, entry, this.actions);

    const debouncedSave = debounce(
      ((value: string) => {
        this.actions.saveCurrentTranslation(value, false);
      }) as (...args: unknown[]) => void,
      300,
    );
    let saveFlashTimer: ReturnType<typeof window.setTimeout> | null = null;
    textarea.oninput = () => {
      currentValue = textarea.value;
      checkQA();
      debouncedSave(currentValue);
      if (saveFlashTimer !== null) window.clearTimeout(saveFlashTimer);
      textarea.classList.remove("is-saved");
      saveFlashTimer = window.setTimeout(() => {
        saveFlashTimer = null;
        textarea.classList.add("is-saved");
      }, 400);
    };
    textarea.addEventListener("animationend", () => textarea.classList.remove("is-saved"));

    return textarea;
  }
}
