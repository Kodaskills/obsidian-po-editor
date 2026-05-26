import { type TranslationConverter } from "@application/index";
import {
  createPluralEntry,
  createPOHeader,
  createSingularEntry,
  type POEntry,
  type POFile,
  type POFlag,
} from "@domain/index";
import {
  type GettextComment,
  type GettextEntry,
  type GettextTranslations,
  po as gettextParser,
} from "gettext-parser";

import { toStandardHeader } from "./POHeaderConverter";
import { appendComment, extractString, isValidFlag, parseHeaderString } from "./POParseUtils";
import { POStreamingParser } from "./POStreamingParser";

interface RawEntry {
  msgid: string;
  msgidPlural?: string;
  msgctxt?: string;
  msgstr: string[];
  flags: string[];
  comments: { translator?: string; extracted?: string; reference?: string; previous?: string };
  obsolete: boolean;
}

export class POConverter implements TranslationConverter {
  readonly format = "po" as const;
  readonly displayName: string = "PO (Gettext)";
  readonly supportedExtensions: string[] = [".po"];
  readonly supportsPlurals = true;
  readonly supportsFuzzyFlags = true;

  private readonly streamParser = new POStreamingParser();

  async parseAsync(content: string, onProgress?: (p: number, t: number) => void): Promise<POFile> {
    const res = await this.streamParser.parseInChunks(content, { onProgress });
    return res.poFile;
  }

  parse(content: string): POFile {
    // Synchronous version of the state machine for legacy port compatibility
    const entries: POEntry[] = [];
    let currentEntry: RawEntry | null = null;
    let pluralIndex = 0;
    let lastField: string | null = null;

    const flushEntry = () => {
      if (!currentEntry) return;
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
      currentEntry = { msgid: "", msgstr: [], flags: [], comments: {}, obsolete };
    };

    const lines = content.split("\n");
    for (let line of lines) {
      line = line.trim();
      if (!line) {
        if (currentEntry !== null) {
          const p = currentEntry as RawEntry;
          if (p.msgid !== "" || p.msgstr.length > 0) {
            flushEntry();
            lastField = null;
          }
        }
        continue;
      }

      let isObsoleteLine = false;
      if (line.startsWith("#~")) {
        isObsoleteLine = true;
        line = line.substring(2).trim();
      }

      if (line.startsWith("#")) {
        // If we were in msgstr or something else, a comment starts a NEW entry
        if (lastField === "msgstr" || lastField === "msgstr_plural") {
          flushEntry();
          lastField = null;
        }

        if (!currentEntry) initEntry(isObsoleteLine);
        if (line.startsWith("#,")) {
          currentEntry!.flags.push(
            ...line
              .substring(2)
              .split(",")
              .map((f) => f.trim())
              .filter(Boolean),
          );
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
        } else {
          currentEntry!.comments.translator = appendComment(
            currentEntry!.comments.translator,
            line.substring(1).trim(),
          );
        }
      } else if (line.startsWith("msgctxt")) {
        if (lastField === "msgstr" || lastField === "msgstr_plural") {
          flushEntry();
        }
        if (!currentEntry) initEntry(isObsoleteLine);
        currentEntry!.msgctxt = extractString(line);
        lastField = "msgctxt";
      } else if (line.startsWith("msgid_plural")) {
        if (!currentEntry) initEntry();
        currentEntry!.msgidPlural = extractString(line);
        lastField = "msgid_plural";
      } else if (line.startsWith("msgid")) {
        // Only flush if we already have a msgid (and it's not because of msgctxt)
        if (lastField === "msgstr" || lastField === "msgstr_plural") {
          flushEntry();
        }
        if (!currentEntry) initEntry(isObsoleteLine);
        currentEntry!.msgid = extractString(line);
        lastField = "msgid";
      } else if (line.startsWith("msgstr[")) {
        const match = line.match(/msgstr\[(\d+)\]/);
        if (match) {
          pluralIndex = parseInt(match[1], 10);
          currentEntry!.msgstr[pluralIndex] = extractString(line);
          lastField = "msgstr_plural";
        }
      } else if (line.startsWith("msgstr")) {
        currentEntry!.msgstr[0] = extractString(line);
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

    return {
      charset: "utf-8",
      header: createPOHeader(headerMetadata.Language || "und", {
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
      }),
      entries: filteredEntries,
    };
  }

  compile(poFile: POFile): string {
    try {
      const translations: GettextTranslations = {};
      const obsolete: GettextTranslations = {};

      const entries = poFile.entries || [];
      for (const entry of entries) {
        if (!entry || typeof entry.msgid !== "string") continue;
        const context = entry.msgctxt || "";
        if (entry.obsolete) {
          if (!Object.prototype.hasOwnProperty.call(obsolete, context)) {
            obsolete[context] = {};
          }
          obsolete[context][entry.msgid] = this.toGettextEntry({ ...entry, obsolete: true });
        } else {
          if (!Object.prototype.hasOwnProperty.call(translations, context)) {
            translations[context] = {};
          }
          translations[context][entry.msgid] = this.toGettextEntry(entry);
        }
      }

      const compiled = gettextParser.compile(
        {
          charset: poFile.charset || "utf-8",
          headers: toStandardHeader(poFile.header),
          translations,
          obsolete,
        },
        { foldLength: 76, sort: false, escapeCharacters: true },
      ) as { toString: () => string };

      return "# PO file created with Obsidian PO Editor\n" + compiled.toString();
    } catch (error) {
      console.error("PO Editor: Compilation error", error);
      return "";
    }
  }

  validate(content: string): { valid: boolean; error?: string } {
    try {
      gettextParser.parse(content || "", { validation: true });
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : "Invalid PO syntax",
      };
    }
  }

  parseStream(options?: { defaultCharset?: string }): unknown {
    return gettextParser.createParseStream({
      defaultCharset: options?.defaultCharset || "utf-8",
    });
  }

  private fromGettextEntry(raw: GettextEntry): POEntry {
    const flags = (raw.comments?.flag || "")
      .split(",")
      .map((f: string) => f.trim() as POFlag)
      .filter(Boolean);
    const { flag: _unused, ...comments } = raw.comments || {};
    void _unused;

    if (raw.msgid_plural) {
      return {
        msgid: raw.msgid || "",
        msgctxt: raw.msgctxt,
        msgidPlural: raw.msgid_plural,
        msgstr: Array.isArray(raw.msgstr) ? raw.msgstr : [raw.msgstr || ""],
        flags,
        comments,
        obsolete: !!raw.obsolete,
      };
    } else {
      return {
        msgid: raw.msgid || "",
        msgctxt: raw.msgctxt,
        msgstr: Array.isArray(raw.msgstr) ? raw.msgstr[0] || "" : raw.msgstr || "",
        flags,
        comments,
        obsolete: !!raw.obsolete,
      };
    }
  }

  private toGettextEntry(entry: POEntry): GettextEntry {
    const flags = entry.flags?.join(", ");
    const comments: GettextComment = { ...entry.comments };
    if (flags) {
      comments.flag = flags;
    }

    const result: GettextEntry = {
      msgid: entry.msgid,
      msgstr: "",
      comments,
      obsolete: entry.obsolete,
    };

    if (entry.msgctxt) {
      result.msgctxt = entry.msgctxt;
    }

    if ("msgidPlural" in entry) {
      result.msgid_plural = entry.msgidPlural;
      result.msgstr = entry.msgstr;
    } else {
      result.msgstr = entry.msgstr;
    }

    return result;
  }
}

export function newPOConverter(): POConverter {
  return new POConverter();
}
