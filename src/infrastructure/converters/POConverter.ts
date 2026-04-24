import {
  type POComment,
  type POEntry,
  type POFile,
  type POFlag,
  type TranslationConverter,
} from "@domain/index";
import { type GettextData, type GettextEntry, po as gettextParser } from "gettext-parser";

import { fromStandardHeader, toStandardHeader } from "./POHeaderConverter";

export class POConverter implements TranslationConverter {
  readonly format = "po" as const;
  readonly displayName: string = "PO (Gettext)";
  readonly supportedExtensions: string[] = [".po"];
  readonly supportsPlurals = true;
  readonly supportsFuzzyFlags = true;

  parse(content: string): POFile {
    const parsed: GettextData = gettextParser.parse(content, {
      defaultCharset: "utf-8",
      validation: true,
    });

    const translations = parsed.translations || {};
    const obsolete = parsed.obsolete || {};

    const entries: POEntry[] = [];

    for (const context of Object.values(translations)) {
      for (const entry of Object.values(context) as GettextEntry[]) {
        if (this.isHeaderEntry(entry)) continue;
        entries.push(this.fromGettextEntry(entry));
      }
    }

    const obsoleteEntries: POEntry[] = [];

    for (const context of Object.values(obsolete)) {
      for (const entry of Object.values(context) as GettextEntry[]) {
        if (this.isHeaderEntry(entry)) continue;
        obsoleteEntries.push(this.fromGettextEntry({ ...entry, obsolete: true }));
      }
    }

    const headers = fromStandardHeader(parsed.headers || {});

    return {
      charset: parsed.charset || "utf-8",
      header: headers,
      entries,
      obsolete: obsoleteEntries,
    };
  }

  compile(poFile: POFile): string {
    const translations: Record<string, Record<string, GettextEntry>> = {};

    for (const entry of poFile.entries) {
      if (!entry.msgid) continue;

      const context = entry.msgctxt || "";
      if (!translations[context]) {
        translations[context] = {};
      }

      translations[context][entry.msgid] = this.toGettextEntry(entry);
    }

    const obsolete: Record<string, Record<string, GettextEntry>> = {};

    for (const entry of poFile.obsolete) {
      const context = entry.msgctxt || "";
      if (!obsolete[context]) {
        obsolete[context] = {};
      }

      obsolete[context][entry.msgid] = this.toGettextEntry({ ...entry, obsolete: true });
    }
    const compiled = gettextParser.compile(
      {
        charset: poFile.charset,
        headers: toStandardHeader(poFile.header),
        translations,
        obsolete,
      },
      {
        foldLength: 76,
        sort: false,
        escapeCharacters: true,
      },
    );

    const headerLine = `# PO file created with Obsidian PO Editor\n`;
    return headerLine + compiled.toString();
  }

  validate(content: string): { valid: boolean; error?: string } {
    try {
      gettextParser.parse(content, { validation: true });
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : "Invalid PO syntax",
      };
    }
  }

  parseStream(options?: { defaultCharset?: string }): any {
    return gettextParser.createParseStream({
      defaultCharset: options?.defaultCharset || "utf-8",
    });
  }

  private isHeaderEntry(entry: GettextEntry): boolean {
    return entry.msgid === "" && !entry.msgid_plural;
  }

  private parseFlags(flagStr?: string): POFlag[] {
    if (!flagStr) return [];
    return flagStr.split(",").map((f) => f.trim() as POFlag);
  }

  private parseComments(rawComments?: GettextEntry["comments"]): POComment {
    if (!rawComments) return {};
    const { flag: _flag, ...rest } = rawComments;
    return rest;
  }

  private fromGettextEntry(raw: GettextEntry): POEntry {
    const flags = this.parseFlags(raw.comments?.flag);
    const comments = this.parseComments(raw.comments);

    if (raw.msgid_plural) {
      const msgstrPlural = Array.isArray(raw.msgstr) ? raw.msgstr : [raw.msgstr || ""];
      return {
        msgid: raw.msgid || "",
        msgctxt: raw.msgctxt,
        msgidPlural: raw.msgid_plural,
        msgstr: msgstrPlural,
        flags,
        comments,
        obsolete: !!raw.obsolete,
      };
    } else {
      const msgstr = Array.isArray(raw.msgstr) ? raw.msgstr[0] || "" : raw.msgstr || "";
      return {
        msgid: raw.msgid || "",
        msgctxt: raw.msgctxt,
        msgstr,
        flags,
        comments,
        obsolete: !!raw.obsolete,
      };
    }
  }

  private toGettextEntry(entry: POEntry): GettextEntry {
    const base: any = {
      msgid: entry.msgid,
      comments: { ...entry.comments },
      obsolete: entry.obsolete,
    };
    if (entry?.flags?.length) base.comments.flag = entry.flags.join(", ");
    if (entry.msgctxt) base.msgctxt = entry.msgctxt;

    if ("msgidPlural" in entry) {
      base.msgid_plural = entry.msgidPlural;
      base.msgstr = entry.msgstr;
    } else {
      base.msgstr = entry.msgstr;
    }
    return base as GettextEntry;
  }
}

export function newPOConverter(): POConverter {
  return new POConverter();
}
