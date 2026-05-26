import {
  entriesMatch,
  getLanguageDisplayName,
  getPluralFormLabels,
  isPluralEntry,
  type POEntry,
} from "@domain/index";
import type {
  EditorPanelState,
  POEntryActions,
  POTranslationActions,
  POEditorLayoutActions,
  PONavigationActions,
  POVisibilityActions,
  POViewQueries,
} from "@presentation/index";
import { setIcon, setTooltip } from "obsidian";

import { PluralFormsEditor } from "./PluralFormsEditor";
import {
  makeInlineEditable,
  renderCommentSection,
  renderEntryActions,
  renderExtraCommentsSection,
} from "./POEditorPanelShared";
import { isFuzzy as isEntryFuzzy, isMissing as isEntryMissing } from "./POEntryHelpers";
import { NEW_ENTRY_SENTINEL, type POViewSnapshot } from "./POViewTypes";
import { TranslationTextarea } from "./TranslationTextarea";

const NEW_ENTRY_PLACEHOLDER = NEW_ENTRY_SENTINEL;

type Actions = POEntryActions &
  POTranslationActions &
  POEditorLayoutActions &
  PONavigationActions &
  POVisibilityActions;

export class POEditorPanelRenderer {
  private readonly pluralFormsEditor: PluralFormsEditor;
  private readonly translationTextarea: TranslationTextarea;

  constructor(
    private readonly queries: POViewQueries,
    private readonly actions: Actions,
  ) {
    this.pluralFormsEditor = new PluralFormsEditor(queries, actions);
    this.translationTextarea = new TranslationTextarea(queries, actions);
  }

  render(container: HTMLElement, entry: POEntry | null, shouldFocus = false): void {
    this.renderResizeHandle(container);

    if (!entry) {
      container.createDiv({ cls: "po-editor-empty", text: "Select an entry to edit" });
      return;
    }

    const snapshot = this.queries.getSnapshot();
    const filteredEntries = this.queries.getFilteredEntries();
    const index = filteredEntries.findIndex((e) => entriesMatch(e, entry));

    const sourceLanguage = this.queries.getSourceLanguage();
    const isFuzzy = isEntryFuzzy(entry);
    const isMissing = isEntryMissing(entry);

    this.renderHeader(
      container,
      entry,
      isMissing,
      isFuzzy,
      snapshot.editorPanelState,
      sourceLanguage,
    );

    const isNewEntry = entry.msgid === NEW_ENTRY_PLACEHOLDER;

    if (snapshot.isPOTFile) {
      this.renderPOTLayout(container, entry, isNewEntry, isFuzzy, filteredEntries, index);
      return;
    }

    if (snapshot.editorPanelPosition === "bottom") {
      this.renderSplitLayout(
        container,
        entry,
        isNewEntry,
        snapshot,
        filteredEntries,
        index,
        sourceLanguage,
        shouldFocus,
      );
    } else {
      this.renderStackedLayout(container, entry, isNewEntry, snapshot, sourceLanguage, shouldFocus);
    }
  }

  private renderPOTLayout(
    container: HTMLElement,
    entry: POEntry,
    isNewEntry: boolean,
    isFuzzy: boolean,
    filteredEntries: POEntry[],
    index: number,
  ): void {
    const content = container.createDiv({ cls: "po-editor-content" });
    if (isNewEntry) {
      const { msgidEl } = this.renderEntryIdSection(content, entry);
      window.requestAnimationFrame(() => {
        msgidEl.focus();
        const range = activeDocument!.createRange();
        range.selectNodeContents(msgidEl);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      });
    }
    if (!isNewEntry) {
      this.renderEntryIdSection(content, entry);
    }
    if (isPluralEntry(entry)) {
      const pluralHeader = content.createDiv({ cls: "po-editor-plural-header" });
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
    }
    renderCommentSection(content, entry, this.actions);
    renderExtraCommentsSection(content, entry, this.actions);

    const footer = container.createDiv({ cls: "po-editor-footer-actions" });
    const footerLeft = footer.createDiv({ cls: "po-editor-footer-actions-left" });

    const fuzzy = footerLeft.createDiv({
      cls: `po-editor-fuzzy-toggle ${isFuzzy ? "is-active" : ""} po-editor-icon-button`,
    });
    setIcon(fuzzy, isFuzzy ? "cloud" : "cloud-off");
    setTooltip(fuzzy, isFuzzy ? "Clear fuzzy flag" : "Mark as fuzzy");
    fuzzy.onclick = () => this.actions.toggleFuzzy(entry);

    if (isPluralEntry(entry)) {
      const toSingular = footerLeft.createDiv({ cls: "po-editor-icon-button" });
      setIcon(toSingular, "minimize");
      setTooltip(toSingular, "Convert to singular");
      toSingular.onclick = () => this.actions.convertToSingular(entry);
    } else {
      const toPlural = footerLeft.createDiv({ cls: "po-editor-icon-button" });
      setIcon(toPlural, "list");
      setTooltip(toPlural, "Convert to plural");
      toPlural.onclick = () => this.actions.convertToPlural(entry);
    }

    renderEntryActions(footerLeft, entry, this.actions);

    const prev = footer.createEl("button", {
      cls: "po-editor-save-button",
      attr: { disabled: index === 0 ? "" : null },
    });
    setIcon(prev.createSpan(), "chevron-left");
    prev.createSpan({ text: "Previous" });
    setTooltip(prev, "Previous entry (Alt+↑)");
    prev.onclick = () => {
      if (index > 0) this.actions.navigateEntry(-1, "");
    };

    const next = footer.createEl("button", {
      cls: "po-editor-save-button",
      attr: { disabled: index === filteredEntries.length - 1 ? "" : null },
    });
    setIcon(next.createSpan(), "chevron-right");
    next.createSpan({ text: "Next" });
    setTooltip(next, "Next entry (Alt+↓)");
    next.onclick = () => {
      if (index < filteredEntries.length - 1) this.actions.navigateEntry(1, "");
    };
  }

  private renderStackedLayout(
    container: HTMLElement,
    entry: POEntry,
    isNewEntry: boolean,
    snapshot: POViewSnapshot,
    sourceLanguage: string,
    shouldFocus = false,
  ): void {
    const content = container.createDiv({ cls: "po-editor-content" });
    if (isNewEntry) {
      const { msgidEl } = this.renderEntryIdSection(content, entry);
      window.requestAnimationFrame(() => {
        msgidEl.focus();
        const range = activeDocument!.createRange();
        range.selectNodeContents(msgidEl);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      });
    }
    this.renderSourceSection(content, entry, sourceLanguage);

    const filteredEntries = this.queries.getFilteredEntries();
    const index = filteredEntries.findIndex((e) => entriesMatch(e, entry));

    if (isPluralEntry(entry)) {
      const textareas = this.pluralFormsEditor.render(
        content,
        entry,
        snapshot,
        snapshot.quickActions,
      );
      this.renderValidationActions(
        container,
        textareas,
        index === 0,
        index === filteredEntries.length - 1,
        index,
        filteredEntries.length,
      );
      if (!isNewEntry && shouldFocus) window.requestAnimationFrame(() => textareas[0]?.focus());
    } else {
      const textarea = this.translationTextarea.render(
        content,
        entry,
        entry.msgstr,
        snapshot.quickActions,
      );
      this.renderValidationActions(
        container,
        [textarea],
        index === 0,
        index === filteredEntries.length - 1,
        index,
        filteredEntries.length,
      );
      if (!isNewEntry && shouldFocus) window.requestAnimationFrame(() => textarea.focus());
    }
  }

  private renderSplitLayout(
    container: HTMLElement,
    entry: POEntry,
    isNewEntry: boolean,
    snapshot: POViewSnapshot,
    filteredEntries: POEntry[],
    index: number,
    sourceLanguage: string,
    shouldFocus = false,
  ): void {
    const body = container.createDiv({ cls: "po-editor-split-body" });

    const sourceCol = body.createDiv({ cls: "po-editor-source-col" });
    sourceCol.createSpan({
      cls: "po-editor-section-label",
      text: sourceLanguage
        ? (getLanguageDisplayName(sourceLanguage) ?? sourceLanguage.toUpperCase())
        : "SOURCE",
    });

    const sourceMeta = sourceCol.createDiv({ cls: "po-editor-source-key-row" });
    sourceMeta.createSpan({ cls: "po-editor-source-key-label", text: "msgid" });
    const msgidEl = sourceMeta.createSpan({ cls: "po-editor-source-key-value", text: entry.msgid });
    setTooltip(msgidEl, "Double-click to edit");
    makeInlineEditable(msgidEl, entry, "msgid", this.actions);
    if (isNewEntry) {
      msgidEl.contentEditable = "true";
      window.requestAnimationFrame(() => {
        msgidEl.focus();
        const range = activeDocument!.createRange();
        range.selectNodeContents(msgidEl);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      });
    }

    const sourceContent = sourceCol.createDiv({ cls: "po-editor-source-content" });
    if (sourceLanguage) {
      const refFound = this.queries.resolveReferenceText(entry);
      if (refFound) {
        if (Array.isArray(refFound)) {
          const labels = getPluralFormLabels(refFound.length);
          for (let i = 0; i < refFound.length; i++) {
            const row = sourceContent.createDiv({ cls: "po-editor-source-plural-row" });
            row.createSpan({
              cls: "po-editor-source-plural-label",
              text: labels[i] ?? `Form ${i}`,
            });
            if (refFound[i]) {
              const body = row.createSpan({ cls: "po-editor-source-body" });
              body.textContent = refFound[i];
            } else {
              row.createSpan({ cls: "po-editor-badge po-editor-badge--missing", text: "Missing" });
            }
          }
        } else {
          sourceContent.createDiv({ cls: "po-editor-source-body", text: refFound });
        }
      } else {
        sourceContent.createDiv({
          cls: "po-editor-source-empty",
          text: "No reference text found for this entry.",
        });
      }
    } else {
      sourceContent.createDiv({
        cls: "po-editor-source-empty",
        text: "Select a reference language to enable source comparison.",
      });
    }

    if (entry.comments?.extracted) {
      const note = sourceContent.createDiv({ cls: "po-editor-dev-note" });
      const noteHeader = note.createDiv({ cls: "po-editor-dev-note-header" });
      setIcon(noteHeader.createDiv(), "info");
      setTooltip(noteHeader, "Developer Note");
      noteHeader.createSpan({ text: "Developer Note" });
      note.createSpan({ cls: "po-editor-dev-note-text", text: entry.comments.extracted });
    }

    const targetCol = body.createDiv({ cls: "po-editor-target-col" });

    if (isPluralEntry(entry)) {
      const textareas = this.pluralFormsEditor.render(
        targetCol,
        entry,
        snapshot,
        snapshot.quickActions,
      );
      this.renderValidationActions(
        container,
        textareas,
        index === 0,
        index === filteredEntries.length - 1,
        index,
        filteredEntries.length,
      );
      if (!isNewEntry && shouldFocus) window.requestAnimationFrame(() => textareas[0]?.focus());
    } else {
      const textarea = this.translationTextarea.render(
        targetCol,
        entry,
        entry.msgstr,
        snapshot.quickActions,
      );
      this.renderValidationActions(
        container,
        [textarea],
        index === 0,
        index === filteredEntries.length - 1,
        index,
        filteredEntries.length,
      );
      if (!isNewEntry && shouldFocus) window.requestAnimationFrame(() => textarea.focus());
    }
  }

  private renderResizeHandle(container: HTMLElement): void {
    const handle = container.createDiv({
      cls: "po-editor-resize-handle",
      attr: { title: "Resize editor panel" },
    });
    handle.createDiv({ cls: "po-editor-resize-handle-bar" });
    const beginResize = (startEvent: PointerEvent | MouseEvent, capturePointer: boolean): void => {
      const split = container.parentElement;
      if (!split) return;
      startEvent.preventDefault();
      if (capturePointer && "setPointerCapture" in handle) {
        handle.setPointerCapture((startEvent as PointerEvent).pointerId);
      }
      const pos = this.queries.getSnapshot().editorPanelPosition;
      const isHorizontal = pos === "left" || pos === "right";
      activeDocument!.body.addClass("po-editor-resizing");
      if (isHorizontal) activeDocument!.body.addClass("po-editor-resizing--horizontal");

      const resize = (moveEvent: PointerEvent | MouseEvent) => {
        const rect = split.getBoundingClientRect();
        const snapshot = this.queries.getSnapshot();
        const pos = snapshot.editorPanelPosition;
        let percent: number;
        if (pos === "bottom") {
          percent = ((rect.bottom - moveEvent.clientY) / rect.height) * 100;
        } else if (pos === "top") {
          percent = ((moveEvent.clientY - rect.top) / rect.height) * 100;
        } else if (pos === "right") {
          percent = ((rect.right - moveEvent.clientX) / rect.width) * 100;
        } else {
          percent = ((moveEvent.clientX - rect.left) / rect.width) * 100;
        }
        this.actions.setEditorPanelHeight(percent);
      };
      const stop = () => {
        activeDocument!.body.removeClass("po-editor-resizing");
        activeDocument!.body.removeClass("po-editor-resizing--horizontal");
        window.removeEventListener("pointermove", resize as EventListener);
        window.removeEventListener("pointerup", stop);
        window.removeEventListener("mousemove", resize as EventListener);
        window.removeEventListener("mouseup", stop);
      };

      if (capturePointer) {
        window.addEventListener("pointermove", resize as EventListener);
        window.addEventListener("pointerup", stop);
      } else {
        window.addEventListener("mousemove", resize as EventListener);
        window.addEventListener("mouseup", stop);
      }
    };

    handle.onpointerdown = (event) => beginResize(event, true);
  }

  private renderHeader(
    container: HTMLElement,
    entry: POEntry,
    isMissing: boolean,
    isFuzzy: boolean,
    panelState: EditorPanelState,
    _sourceLanguage: string,
  ): void {
    const header = container.createDiv({ cls: "po-editor-header" });

    const meta = header.createDiv({ cls: "po-editor-header-meta" });
    const snapshot = this.queries.getSnapshot();
    if (!snapshot.isPOTFile) {
      if (isMissing)
        meta.createSpan({ cls: "po-editor-badge po-editor-badge--missing", text: "Missing" });
      if (isFuzzy)
        meta.createSpan({ cls: "po-editor-badge po-editor-badge--fuzzy", text: "Fuzzy" });
    }

    if (entry.msgctxt) {
      const chip = meta.createSpan({ cls: "po-editor-source-key-chip", text: entry.msgctxt });
      setTooltip(chip, "Double-click to edit context");
      makeInlineEditable(chip, entry, "msgctxt", this.actions);
    } else {
      const setupAddBtn = () => {
        const btn = meta.createDiv({ cls: "po-editor-add-context-btn" });
        setIcon(btn, "tag");
        setTooltip(btn, "Add context (msgctxt)");
        btn.onclick = () => {
          btn.remove();
          const chip = meta.createSpan({ cls: "po-editor-source-key-chip" });
          chip.contentEditable = "true";
          chip.focus();
          chip.onblur = () => {
            const val = chip.textContent?.trim() || undefined;
            chip.contentEditable = "false";
            if (val) {
              this.actions.updateMsgctxt(entry, val);
            } else {
              chip.remove();
              setupAddBtn();
            }
          };
          chip.onkeydown = (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              chip.blur();
            }
            if (e.key === "Escape") {
              chip.remove();
              setupAddBtn();
            }
          };
        };
      };
      setupAddBtn();
    }

    const actions = header.createDiv({ cls: "po-editor-header-actions" });

    const expand = actions.createDiv({
      cls: "po-editor-icon-button",
    });
    setIcon(expand, panelState === "overlay" ? "minimize" : "fullscreen");
    setTooltip(expand, panelState === "overlay" ? "Exit fullscreen" : "Fullscreen");
    expand.onclick = () => this.actions.toggleEditorPanelOverlay();

    const close = actions.createDiv({
      cls: "po-editor-icon-button",
    });
    setIcon(close, "x");
    setTooltip(close, "Close panel");
    close.onclick = () => this.actions.setEditorPanelState("closed");
  }

  private renderEntryIdSection(
    container: HTMLElement,
    entry: POEntry,
  ): { msgidEl: HTMLElement; errorEl: HTMLElement | null } {
    const section = container.createDiv({ cls: "po-editor-entry-id-section" });
    section.createDiv({ cls: "po-editor-section-label", text: "msgid" });
    const msgidEl = section.createDiv({ cls: "po-editor-entry-id-value", text: entry.msgid });
    setTooltip(msgidEl, "Double-click to edit");
    makeInlineEditable(msgidEl, entry, "msgid", this.actions);
    const isPlaceholder = entry.msgid === NEW_ENTRY_PLACEHOLDER;
    if (isPlaceholder) {
      msgidEl.contentEditable = "true";
    }
    let errorEl: HTMLElement | null = null;
    if (isPlaceholder) {
      errorEl = section.createDiv({ cls: "po-editor-validation-error", text: "msgid is required" });
    }
    return { msgidEl, errorEl };
  }

  private renderSourceSection(
    container: HTMLElement,
    entry: POEntry,
    sourceLanguage: string,
  ): void {
    const section = container.createDiv({ cls: "po-editor-source-section" });
    const sourceMeta = section.createDiv({ cls: "po-editor-source-meta" });
    sourceMeta.createSpan({
      cls: "po-editor-section-label",
      text: sourceLanguage
        ? (getLanguageDisplayName(sourceLanguage) ?? sourceLanguage.toUpperCase())
        : "SOURCE",
    });

    if (sourceLanguage) {
      const refFound = this.queries.resolveReferenceText(entry);
      if (refFound) {
        if (Array.isArray(refFound)) {
          const labels = getPluralFormLabels(refFound.length);
          for (let i = 0; i < refFound.length; i++) {
            const row = section.createDiv({ cls: "po-editor-source-plural-row" });
            row.createSpan({
              cls: "po-editor-source-plural-label",
              text: labels[i] ?? `Form ${i}`,
            });
            if (refFound[i]) {
              const body = row.createSpan({ cls: "po-editor-source-body" });
              body.textContent = refFound[i];
            } else {
              row.createSpan({ cls: "po-editor-badge po-editor-badge--missing", text: "Missing" });
            }
          }
        } else {
          section.createDiv({ cls: "po-editor-source-body", text: refFound });
        }
      } else {
        section.createDiv({
          cls: "po-editor-source-empty",
          text: "No reference text found for this entry.",
        });
      }
      const msgidRow = section.createDiv({ cls: "po-editor-source-msgid-row" });
      msgidRow.createSpan({ cls: "po-editor-source-msgid-label", text: "msgid" });
      const msgidEl = msgidRow.createDiv({
        cls: "po-editor-source-msgid-value",
        text: entry.msgid,
      });
      setTooltip(msgidEl, "Double-click to edit");
      makeInlineEditable(msgidEl, entry, "msgid", this.actions);
    } else {
      const msgidEl = section.createDiv({ cls: "po-editor-source-body", text: entry.msgid });
      setTooltip(msgidEl, "Double-click to edit");
      makeInlineEditable(msgidEl, entry, "msgid", this.actions);
    }

    if (entry.comments?.extracted) {
      const note = section.createDiv({ cls: "po-editor-dev-note" });
      const noteHeader = note.createDiv({ cls: "po-editor-dev-note-header" });
      setIcon(noteHeader.createDiv(), "info");
      setTooltip(noteHeader, "Developer Note");
      noteHeader.createSpan({ text: "Developer Note" });
      note.createSpan({ cls: "po-editor-dev-note-text", text: entry.comments.extracted });
    }
  }

  private renderValidationActions(
    container: HTMLElement,
    textareas: HTMLTextAreaElement[],
    isFirst: boolean,
    isLast: boolean,
    entryIndex?: number,
    totalCount?: number,
  ): void {
    let currentValue = textareas.map((ta) => ta.value).join("");

    const footer = container.createDiv({ cls: "po-editor-footer-actions" });

    const charCount = footer.createDiv({ cls: "po-editor-char-count" });
    if (entryIndex !== undefined && totalCount !== undefined) {
      charCount.createSpan({
        cls: "po-editor-entry-index",
        text: `${entryIndex + 1} / ${totalCount}`,
      });
    }
    const badgeTotal = charCount.createSpan({ cls: "po-editor-char-badge" });
    const badgeNoSp = charCount.createSpan({ cls: "po-editor-char-badge" });
    setTooltip(badgeTotal, "Total characters");
    setTooltip(badgeNoSp, "Characters excluding whitespace");
    const updateCount = () => {
      const total = currentValue.length;
      const noSpaces = currentValue.replace(/\s/g, "").length;
      badgeTotal.textContent = `${total} ch`;
      badgeNoSp.textContent = `${noSpaces} no sp`;
    };
    updateCount();

    for (const ta of textareas) {
      ta.addEventListener("input", () => {
        currentValue = textareas.map((t) => t.value).join("");
        updateCount();
      });
    }

    const prev = footer.createEl("button", {
      cls: "po-editor-save-button",
      attr: { disabled: isFirst ? "" : null },
    });
    setIcon(prev.createSpan(), "chevron-left");
    prev.createSpan({ text: "Previous" });
    setTooltip(prev, "Previous entry (Alt+↑)");
    prev.onclick = () => {
      if (!isFirst) this.actions.navigateEntry(-1, currentValue);
    };

    const next = footer.createEl("button", {
      cls: "po-editor-save-button",
      attr: { disabled: isLast ? "" : null },
    });
    setIcon(next.createSpan(), "chevron-right");
    next.createSpan({ text: "Next" });
    setTooltip(next, "Next entry (Alt+↓)");
    next.onclick = () => {
      if (!isLast) this.actions.navigateEntry(1, currentValue);
    };
  }
}
