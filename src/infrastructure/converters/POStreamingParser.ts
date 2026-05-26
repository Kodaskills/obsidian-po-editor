import {
  createPluralEntry,
  createPOHeader,
  createSingularEntry,
  type POEntry,
  type POFile,
} from "@domain/index";

import { appendComment, extractString, isValidFlag, parseHeaderString } from "./POParseUtils";

export interface StreamingParseOptions {
  defaultCharset?: string;
  onProgress?: (processed: number, total: number) => void;
  yieldInterval?: number; // How many entries to process before yielding to UI
}

export interface StreamParseResult {
  poFile: POFile;
  warnings: string[];
  processingTime: number;
}

type ParserState =
  | "START"
  | "COMMENT"
  | "MSGCTXT"
  | "MSGID"
  | "MSGID_PLURAL"
  | "MSGSTR"
  | "MSGSTR_PLURAL"
  | "STRING_CONTINUATION";

interface RawEntry {
  msgid: string;
  msgidPlural?: string;
  msgctxt?: string;
  msgstr: string[];
  flags: string[];
  comments: { translator?: string; extracted?: string; reference?: string; previous?: string };
  obsolete: boolean;
}

export class POStreamingParser {
  private abortController: AbortController | null = null;

  async parseInChunks(
    content: string,
    options: StreamingParseOptions = {},
  ): Promise<StreamParseResult> {
    const startTime = Date.now();
    const yieldInterval = options.yieldInterval || 500;
    const entries: POEntry[] = [];
    const warnings: string[] = [];

    let currentEntry: RawEntry | null = null;
    let state: ParserState = "START";
    let lastField: "msgid" | "msgid_plural" | "msgctxt" | "msgstr" | "msgstr_plural" | null = null;
    let pluralIndex = 0;

    const flushEntry = () => {
      if (!currentEntry) return;
      if (currentEntry.msgid === "" && currentEntry.msgstr[0] && entries.length === 0) {
        // This is the header, we'll handle it separately if needed or keep as metadata
      }

      const flags = currentEntry.flags.filter(isValidFlag);
      if (currentEntry.msgidPlural) {
        entries.push(
          createPluralEntry(currentEntry.msgid, currentEntry.msgidPlural, currentEntry.msgstr, {
            msgctxt: currentEntry.msgctxt,
            flags,
            comments: currentEntry.comments,
            obsolete: currentEntry.obsolete,
          }),
        );
      } else {
        entries.push(
          createSingularEntry(currentEntry.msgid, currentEntry.msgstr[0] || "", {
            msgctxt: currentEntry.msgctxt,
            flags,
            comments: currentEntry.comments,
            obsolete: currentEntry.obsolete,
          }),
        );
      }
      currentEntry = null;
    };

    const initEntry = (obsolete = false) => {
      if (currentEntry) flushEntry();
      currentEntry = {
        msgid: "",
        msgstr: [],
        flags: [],
        comments: {},
        obsolete,
      };
    };

    // Fast character-based iteration
    let pos = 0;
    const len = content.length;
    let entryCount = 0;

    while (pos < len) {
      // Yield to UI thread periodically
      if (entryCount > 0 && entryCount % yieldInterval === 0) {
        // eslint-disable-next-line obsidianmd/prefer-window-timers
        await new Promise((resolve) => setTimeout(resolve, 0));
        if (options.onProgress) options.onProgress(pos, len);
      }

      // Find end of line
      let eol = content.indexOf("\n", pos);
      if (eol === -1) eol = len;

      let line = content.substring(pos, eol).trim();
      pos = eol + 1;

      if (!line) {
        if (currentEntry) {
          flushEntry();
          state = "START";
        }
        continue;
      }

      // Handle Obsolete
      let isObsoleteLine = false;
      if (line.startsWith("#~")) {
        isObsoleteLine = true;
        line = line.substring(2).trim();
      }

      if (line.startsWith("#")) {
        if (state !== "COMMENT" && state !== "START") {
          flushEntry();
        }

        if (!currentEntry) initEntry(isObsoleteLine);

        if (line.startsWith("#,")) {
          const flags = line
            .substring(2)
            .split(",")
            .map((f) => f.trim())
            .filter(Boolean);
          currentEntry!.flags.push(...flags);
        } else if (line.startsWith("#:")) {
          currentEntry!.comments.reference = appendComment(
            currentEntry!.comments.reference,
            line.substring(2).trim(),
          );
        } else if (line.startsWith("#.")) {
          currentEntry!.comments.extracted = appendComment(
            currentEntry!.comments.extracted,
            line.substring(2).trim(),
          );
        } else if (line.startsWith("#|")) {
          currentEntry!.comments.previous = appendComment(
            currentEntry!.comments.previous,
            line.substring(2).trim(),
          );
        } else if (line.startsWith("# ")) {
          currentEntry!.comments.translator = appendComment(
            currentEntry!.comments.translator,
            line.substring(2).trim(),
          );
        } else {
          currentEntry!.comments.translator = appendComment(
            currentEntry!.comments.translator,
            line.substring(1).trim(),
          );
        }
        state = "COMMENT";
      } else if (line.startsWith("msgctxt")) {
        if (state !== "COMMENT" && state !== "START") flushEntry();
        if (!currentEntry) initEntry(isObsoleteLine);
        currentEntry!.msgctxt = extractString(line);
        state = "MSGCTXT";
        lastField = "msgctxt";
      } else if (line.startsWith("msgid_plural")) {
        if (!currentEntry) initEntry();
        currentEntry!.msgidPlural = extractString(line);
        state = "MSGID_PLURAL";
        lastField = "msgid_plural";
      } else if (line.startsWith("msgid")) {
        if (state !== "COMMENT" && state !== "MSGCTXT" && state !== "START") flushEntry();
        if (!currentEntry) initEntry(isObsoleteLine);
        currentEntry!.msgid = extractString(line);
        state = "MSGID";
        lastField = "msgid";
        entryCount++;
      } else if (line.startsWith("msgstr[")) {
        if (!currentEntry) initEntry();
        const match = line.match(/msgstr\[(\d+)\]/);
        if (match) {
          pluralIndex = parseInt(match[1], 10);
          currentEntry!.msgstr[pluralIndex] = extractString(line);
          state = "MSGSTR_PLURAL";
          lastField = "msgstr_plural";
        }
      } else if (line.startsWith("msgstr")) {
        if (!currentEntry) initEntry();
        currentEntry!.msgstr[0] = extractString(line);
        state = "MSGSTR";
        lastField = "msgstr";
      } else if (line.startsWith('"')) {
        if (!currentEntry) continue;
        const val = extractString(line);
        const entry = currentEntry as RawEntry;
        if (lastField === "msgid") entry.msgid += val;
        else if (lastField === "msgctxt") entry.msgctxt += val;
        else if (lastField === "msgid_plural") entry.msgidPlural += val;
        else if (lastField === "msgstr") entry.msgstr[0] += val;
        else if (lastField === "msgstr_plural") entry.msgstr[pluralIndex] += val;
      }
    }

    flushEntry();

    // Process Header from entries with empty msgid
    let headerMetadata: Record<string, string> = {};
    const filteredEntries: POEntry[] = [];

    for (const entry of entries) {
      if (entry.msgid === "") {
        const headerStr = Array.isArray(entry.msgstr) ? entry.msgstr[0] : entry.msgstr;
        headerMetadata = { ...headerMetadata, ...parseHeaderString(headerStr) };
      } else {
        filteredEntries.push(entry);
      }
    }

    const header = createPOHeader(headerMetadata.Language || "und", {
      contentType: headerMetadata["Content-Type"],
      contentTransferEncoding: headerMetadata["Content-Transfer-Encoding"],
      pluralForms: headerMetadata["Plural-Forms"],
      projectIdVersion: headerMetadata["Project-Id-Version"],
      poRevisionDate: headerMetadata["PO-Revision-Date"],
      mimeVersion: headerMetadata["MIME-Version"],
      xGenerator: headerMetadata["X-Generator"],
      lastTranslator: headerMetadata["Last-Translator"],
      languageTeam: headerMetadata["Language-Team"],
      reportMsgidBugsTo: headerMetadata["Report-Msgid-Bugs-To"],
      potCreationDate: headerMetadata["POT-Creation-Date"],
    });

    return {
      poFile: {
        charset: options.defaultCharset || "utf-8",
        header,
        entries: filteredEntries,
      },
      warnings,
      processingTime: Date.now() - startTime,
    };
  }

  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }
}
