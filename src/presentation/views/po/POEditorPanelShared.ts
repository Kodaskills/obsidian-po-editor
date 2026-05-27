import { FuzzyMatchingService } from "@application/services/FuzzyMatchingService";
import { isPluralEntry, type POEntry } from "@domain/index";
import type { POPluralEntry } from "@domain/index";
import type { CustomAction, POEntryActions, POTranslationActions } from "@presentation/index";
import { setIcon, setTooltip } from "obsidian";

const fuzzyService = new FuzzyMatchingService();

export function renderFuzzySuggestionsPanel(
  container: HTMLElement,
  entry: POEntry,
  textarea: HTMLTextAreaElement,
  allEntries: POEntry[],
): void {
  if (isPluralEntry(entry)) return;

  const matches = fuzzyService.findMatches(entry.msgid, allEntries, 0.6);
  if (matches.length === 0) return;

  const panel = container.createDiv({ cls: "po-editor-fuzzy-panel" });
  panel.createDiv({ cls: "po-editor-fuzzy-panel-label", text: "Suggestions" });

  matches.slice(0, 3).forEach((match) => {
    const row = panel.createDiv({ cls: "po-editor-fuzzy-row" });
    row.createSpan({ text: `${(match.score * 100).toFixed(0)}%`, cls: "po-editor-fuzzy-score" });
    row.createSpan({ text: match.msgstr, cls: "po-editor-fuzzy-msgstr" });
    row.onclick = () => {
      textarea.value = match.msgstr;
      textarea.dispatchEvent(new Event("input"));
    };
  });
}

export function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: unknown[]) => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  }) as T;
}

export function makeInlineEditable(
  element: HTMLElement,
  entry: POEntry,
  field: "msgid" | "msgid_plural" | "msgctxt",
  actions: POEntryActions,
  editable = true,
): void {
  if (!editable) return;
  const originalValue =
    field === "msgid"
      ? entry.msgid
      : field === "msgid_plural"
        ? (entry as POPluralEntry).msgidPlural
        : (entry.msgctxt ?? "");

  element.ondblclick = () => {
    element.contentEditable = "true";
    element.focus();
    const range = activeDocument!.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  element.onblur = () => {
    if (element.contentEditable !== "true") return;
    const newValue = element.textContent ?? "";
    if (newValue !== originalValue) {
      if (field === "msgid" && !newValue.trim()) {
        element.textContent = originalValue;
        return;
      }
      element.contentEditable = "false";
      if (field === "msgid") {
        actions.updateMsgid(entry, newValue);
      } else if (field === "msgid_plural") {
        actions.updateMsgidPlural(entry as POPluralEntry, newValue);
      } else {
        actions.updateMsgctxt(entry, newValue.trim() || undefined);
      }
    } else {
      element.contentEditable = "false";
    }
  };

  element.onkeydown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      element.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      element.textContent = originalValue;
      element.contentEditable = "false";
    }
  };
}

export function renderEntryActions(
  container: HTMLElement,
  entry: POEntry,
  actions: POEntryActions,
): void {
  const isObsolete = !!entry.obsolete;
  const obsoleteBtn = container.createDiv({ cls: "po-editor-icon-button" });
  setIcon(obsoleteBtn, "locate-off");
  setTooltip(obsoleteBtn, isObsolete ? "Restore from obsolete" : "Mark as obsolete");
  obsoleteBtn.onclick = () => {
    actions.markObsolete(entry);
  };

  const deleteBtn = container.createDiv({ cls: "po-editor-icon-button po-editor-delete-btn" });
  setIcon(deleteBtn, "trash");
  setTooltip(deleteBtn, "Delete entry");
  deleteBtn.onclick = () => {
    actions.deleteEntry(entry);
  };
}

export function renderCommentSection(
  container: HTMLElement,
  entry: POEntry,
  actions: POTranslationActions,
): void {
  const hasContent = !!entry.comments?.translator;
  const section = container.createDiv({
    cls: hasContent
      ? "po-editor-comment po-editor-comment--translator"
      : "po-editor-comment po-editor-comment--translator is-empty",
  });
  setIcon(section.createDiv({ cls: "po-editor-comment-icon" }), "message-circle");
  setTooltip(section, hasContent ? "Translator comment" : "Click to add translator comment");
  const area = section.createEl("textarea", {
    cls: "po-editor-comment-input",
    attr: { placeholder: "Translator comment..." },
  });
  area.value = entry.comments?.translator ?? "";

  section.onclick = () => {
    if (section.hasClass("is-empty")) {
      section.removeClass("is-empty");
      area.style.removeProperty("pointer-events");
      area.focus();
    }
  };

  area.onblur = () => {
    const nextComment = area.value.trim() || undefined;
    if (nextComment !== (entry.comments?.translator || undefined)) {
      actions.updateTranslatorComment(entry, nextComment);
    }
    if (!area.value.trim()) {
      section.addClass("is-empty");
    }
  };
}

export function renderReferenceComment(
  container: HTMLElement,
  entry: POEntry,
  actions: POTranslationActions,
): void {
  const section = container.createDiv({ cls: "po-editor-comment" });
  setIcon(section.createDiv({ cls: "po-editor-comment-icon" }), "link");
  setTooltip(section, "Source reference (#:)");
  const area = section.createEl("textarea", {
    cls: "po-editor-comment-input",
    attr: { placeholder: "Source reference..." },
  });
  area.value = entry.comments?.reference ?? "";
  area.onblur = () => {
    const nextRef = area.value.trim() || undefined;
    if (nextRef !== (entry.comments?.reference || undefined)) {
      actions.updateReferenceComment(entry, nextRef);
    }
  };
}

export function renderPreviousComment(
  container: HTMLElement,
  entry: POEntry,
  actions: POTranslationActions,
): void {
  const section = container.createDiv({ cls: "po-editor-comment" });
  setIcon(section.createDiv({ cls: "po-editor-comment-icon" }), "history");
  setTooltip(section, "Previous string (#|)");
  const area = section.createEl("textarea", {
    cls: "po-editor-comment-input",
    attr: { placeholder: "Previous string..." },
  });
  area.value = entry.comments?.previous ?? "";
  area.onblur = () => {
    const nextPrev = area.value.trim() || undefined;
    if (nextPrev !== (entry.comments?.previous || undefined)) {
      actions.updatePreviousComment(entry, nextPrev);
    }
  };
}

export function renderPlaceholderChips(
  container: HTMLElement,
  placeholders: string[],
  textarea: HTMLTextAreaElement,
  onChange: (value: string) => void,
): void {
  if (placeholders.length === 0) return;

  const row = container.createDiv({ cls: "po-editor-placeholder-row" });
  row.createSpan({ cls: "po-editor-placeholder-label", text: "Insert:" });
  for (const placeholder of placeholders) {
    const chip = row.createEl("button", {
      cls: "po-editor-placeholder-chip",
      text: placeholder,
      attr: { title: "Click to insert placeholder at cursor" },
    });
    chip.onclick = (event) => {
      event.preventDefault();
      const start = textarea.selectionStart ?? textarea.value.length;
      const end = textarea.selectionEnd ?? textarea.value.length;
      textarea.value = `${textarea.value.slice(0, start)}${placeholder}${textarea.value.slice(end)}`;
      textarea.selectionStart = textarea.selectionEnd = start + placeholder.length;
      textarea.focus();
      onChange(textarea.value);
      textarea.dispatchEvent(new Event("input"));
    };
  }
}

export function renderExtraCommentsSection(
  container: HTMLElement,
  entry: POEntry,
  actions: POTranslationActions,
): HTMLElement {
  const wrapper = container.createDiv({ cls: "po-editor-extra-comments is-collapsed" });
  renderReferenceComment(wrapper, entry, actions);
  renderPreviousComment(wrapper, entry, actions);

  const extraCount = [entry.comments?.reference, entry.comments?.previous].filter(Boolean).length;
  const moreToggle = container.createDiv({ cls: "po-editor-more-toggle" });
  moreToggle.createSpan({ text: `Comments${extraCount > 0 ? ` (${extraCount})` : ""}` });
  setIcon(moreToggle.createSpan({ cls: "po-editor-more-chevron" }), "chevron-down");
  moreToggle.onclick = () => {
    wrapper.toggleClass("is-collapsed", !wrapper.hasClass("is-collapsed"));
    moreToggle.toggleClass("is-open", !moreToggle.hasClass("is-open"));
  };

  return wrapper;
}

export function renderQuickActionsPanel(
  container: HTMLElement,
  entry: POEntry,
  textarea: HTMLTextAreaElement,
  quickActions: CustomAction[],
  actions: POEntryActions & POTranslationActions,
): void {
  const panel = container.createDiv({ cls: "po-editor-quick-panel" });

  const flagActions = quickActions.filter((a) => a.flag);
  const commentOnlyActions = quickActions.filter((a) => a.comment && !a.flag);
  const otherActions = quickActions.filter((a) => !a.flag && !a.comment);
  const groupConfigs = [
    { actions: flagActions, label: "#F", description: "Flag actions" },
    { actions: commentOnlyActions, label: "#C", description: "Comment-only actions" },
    { actions: otherActions, label: "" },
  ].filter((g) => g.actions.length > 0);

  for (let i = 0; i < groupConfigs.length; i++) {
    const { actions: groupActions, label, description } = groupConfigs[i];
    if (i > 0) panel.createDiv({ cls: "po-editor-quick-panel-sep" });
    if (label) {
      const labelEl = panel.createDiv({ cls: "po-editor-quick-panel-group-label", text: label });
      if (description) setTooltip(labelEl, description);
    }
    for (const action of groupActions) {
      const flagActive = action.flag ? (entry.flags ?? []).includes(action.flag as never) : true;
      const commentActive = action.comment ? entry.comments?.translator === action.comment : true;
      const isActive = flagActive && commentActive;
      const color = action.color ?? "var(--text-muted)";
      const btn = panel.createEl("button", {
        cls: `po-editor-quick-action-btn${isActive ? " is-active" : ""}`,
      });
      btn.style.setProperty("--action-color", color);
      setTooltip(btn, action.label);
      btn.onclick = () => {
        actions.saveCurrentTranslation(textarea.value, false);
        actions.applyQuickAction(entry, action);
      };
    }
  }
}
