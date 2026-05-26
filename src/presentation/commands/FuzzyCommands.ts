import { type ParsePO } from "@application/index";
import { type POEntry } from "@domain/index";
import { type POConverter } from "@infrastructure/index";
import { type App, type Editor, MarkdownView, Notice } from "obsidian";

export interface FuzzyCommandOptions {
  msgid?: string;
  setFuzzy: boolean;
}

export class ToggleFuzzyCommand {
  constructor(
    private app: App,
    private parsePOUseCase: ParsePO,
    private poConverter: POConverter,
  ) {}

  async execute(options: FuzzyCommandOptions): Promise<boolean> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile || activeFile.extension !== "po") {
      new Notice("No PO file is currently active", 5000);
      return false;
    }

    const editor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
    if (!editor && !options?.msgid) {
      new Notice("No editor or msgid specified", 5000);
      return false;
    }

    try {
      const content = await this.app.vault.cachedRead(activeFile);
      const parseResult = await this.parsePOUseCase.execute({
        content,
        converter: this.poConverter,
      });
      if (!parseResult.success || !parseResult.poFile) {
        new Notice(`Parse error: ${parseResult.error}`, 10000);
        return false;
      }

      let targetMsgid = options?.msgid;
      if (!targetMsgid && editor) {
        const selection = editor.getSelection().trim();
        if (selection)
          targetMsgid = this.findMsgidForSelection(parseResult.poFile.entries, selection);
      }
      if (!targetMsgid && editor) {
        targetMsgid = this.findMsgidNearCursor(editor);
      }
      if (!targetMsgid) {
        new Notice(`Could not find entry to ${options.setFuzzy ? "mark" : "unmark"} fuzzy`, 5000);
        return false;
      }

      let updated = false;
      const entries = parseResult.poFile.entries.map((entry) => {
        if (entry.msgid !== targetMsgid) return entry;
        const flags = options.setFuzzy
          ? [...(entry.flags ?? []), "fuzzy" as const]
          : (entry.flags ?? []).filter((f) => f !== "fuzzy");
        updated = options.setFuzzy
          ? !(entry.flags ?? []).includes("fuzzy")
          : (entry.flags ?? []).includes("fuzzy");
        return { ...entry, flags };
      });

      if (!updated) {
        new Notice(
          options.setFuzzy ? "Entry is already marked as fuzzy" : "Entry is not marked as fuzzy",
          5000,
        );
        return false;
      }

      const updatedPoFile = { ...parseResult.poFile, entries };
      await this.app.vault.process(activeFile, () => this.poConverter.compile(updatedPoFile));
      editor?.setSelection(editor.getCursor("from"), editor.getCursor("to"));
      new Notice(
        `${options.setFuzzy ? "Marked" : "Removed"} fuzzy flag: "${targetMsgid.substring(0, 30)}..."`,
      );
      return true;
    } catch (error) {
      new Notice(
        `Failed to ${options.setFuzzy ? "mark" : "unmark"} fuzzy: ${error instanceof Error ? error.message : "Unknown error"}`,
        10000,
      );
      return false;
    }
  }

  private findMsgidForSelection(entries: POEntry[], selection: string): string | undefined {
    const trimmed = selection.trim();
    for (const entry of entries) {
      if (entry.msgid === trimmed || entry.msgstr === trimmed) return entry.msgid;
    }
    return undefined;
  }

  private findMsgidNearCursor(editor: Editor): string | undefined {
    const lines = editor.getValue().split("\n");
    for (let i = editor.getCursor().line; i >= 0; i--) {
      const match = lines[i].trim().match(/^msgid\s+"(.+)"$/);
      if (match) return match[1];
    }
    return undefined;
  }
}
