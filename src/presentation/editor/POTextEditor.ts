import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";

import { poLanguage } from "./poLanguage";

const obsidianTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontFamily: "var(--font-monospace, monospace)",
    fontSize: "13px",
    background: "var(--background-primary)",
    color: "var(--text-normal)",
  },
  ".cm-scroller": {
    fontFamily: "inherit",
  },
  ".cm-content": {
    padding: "8px 0",
    caretColor: "var(--text-normal)",
  },
  ".cm-gutters": {
    background: "var(--background-secondary)",
    color: "var(--text-faint)",
    border: "none",
    borderRight: "1px solid var(--background-modifier-border)",
  },
  ".cm-activeLine": { background: "var(--background-modifier-hover)" },
  ".cm-activeLineGutter": { background: "var(--background-modifier-hover)" },
  "&.cm-focused .cm-cursor": { borderLeftColor: "var(--text-normal)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    background: "var(--text-selection)",
  },
  ".cm-lineNumbers .cm-gutterElement": { minWidth: "3ch" },
});

export class POTextEditor {
  private view: EditorView;

  constructor(container: HTMLElement, content: string, onChange?: (value: string) => void) {
    const extensions = [
      lineNumbers(),
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      poLanguage,
      syntaxHighlighting(defaultHighlightStyle),
      obsidianTheme,
      EditorView.lineWrapping,
      EditorView.editable.of(false),
    ];

    if (onChange) {
      extensions.push(
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString());
          }
        }),
      );
    }

    this.view = new EditorView({
      state: EditorState.create({ doc: content, extensions }),
      parent: container,
    });
  }

  getValue(): string {
    return this.view.state.doc.toString();
  }

  setValue(content: string): void {
    this.view.dispatch({
      changes: { from: 0, to: this.view.state.doc.length, insert: content },
    });
  }

  destroy(): void {
    this.view.destroy();
  }
}
