import {
  createPluralEntry,
  createPOHeader,
  createSingularEntry,
  type POEntry,
  type POFile,
} from "@domain/index";
import gettextParser from "gettext-parser";

export interface StreamingParseOptions {
  defaultCharset?: string;
  onProgress?: (processed: number, total: number) => void;
  chunkSize?: number;
}

export interface StreamParseResult {
  poFile: POFile;
  warnings: string[];
  processingTime: number;
}

export class POStreamingParser {
  private abortController: AbortController | null = null;

  async parseInChunks(
    content: string,
    options: StreamingParseOptions = {},
  ): Promise<StreamParseResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    const defaultCharset = options.defaultCharset || "utf-8";
    const lines = content.split("\n");
    const totalLines = lines.length;

    const _headerContent = "";
    const _inHeader = false;
    const _headerLines: string[] = [];
    const translations: Record<string, Record<string, any>> = {};
    const obsolete: Record<string, Record<string, any>> = {};
    const currentContext = "";
    const currentEntry: any = null;
    let currentMsgid = "";
    let currentMsgstr: string | string[] = "";
    let currentComments: { value: string }[] = [];
    let currentFlags: Record<string, boolean | string> = {};
    let currentReferences: string[] = [];
    const isObsolete = false;
    let currentField: "msgid" | "msgstr" | "msgidPlural" | "msgstrPlural" | null = null;

    let processedLines = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      processedLines++;

      if (options.onProgress && processedLines % 1000 === 0) {
        options.onProgress(processedLines, totalLines);
      }

      if (line.startsWith("# ") || line.startsWith("#.")) {
        continue;
      }

      if (line.startsWith("#|")) {
        continue;
      }

      if (line.startsWith("#,") || line.startsWith("#:")) {
        continue;
      }

      if (line.startsWith("msgid ") && currentEntry) {
        if (currentMsgid || currentMsgstr) {
          if (!translations[currentContext]) {
            translations[currentContext] = {};
          }

          const entry: any = {
            msgid: currentMsgid,
            msgstr: currentMsgstr,
          };

          if (currentComments.length) entry.comments = currentComments;
          if (Object.keys(currentFlags).length) entry.flags = currentFlags;
          if (currentReferences.length) entry.references = currentReferences;
          if (isObsolete) entry.obsolete = true;

          if (isObsolete) {
            if (!obsolete[currentContext]) {
              obsolete[currentContext] = {};
            }
            obsolete[currentContext][currentMsgid || ""] = entry;
          } else {
            translations[currentContext][currentMsgid || ""] = entry;
          }
        }

        currentMsgid = "";
        currentMsgstr = "";
        currentComments = [];
        currentFlags = {};
        currentReferences = [];
        currentField = "msgid";

        const match = line.match(/^msgid\s+"(.+)"$/);
        if (match) {
          currentMsgid = this.unescapePoString(match[1]);
        }
        continue;
      }

      if (line.startsWith("msgstr ")) {
        currentField = "msgstr";
        const match = line.match(/^msgstr\s+"(.+)"$/);
        if (match) {
          currentMsgstr = this.unescapePoString(match[1]);
        }
        continue;
      }

      if (line.startsWith("msgid_plural")) {
        currentField = "msgidPlural";
        const match = line.match(/^msgid_plural\s+"(.+)"$/);
        if (match) {
          currentEntry.msgidPlural = this.unescapePoString(match[1]);
        }
        continue;
      }

      if (line.startsWith("msgstr[")) {
        const match = line.match(/^msgstr\[(\d+)\]\s+"(.+)"$/);
        if (match) {
          const index = parseInt(match[1], 10);
          const value = this.unescapePoString(match[2]);

          if (Array.isArray(currentMsgstr)) {
            currentMsgstr[index] = value;
          } else {
            currentMsgstr = [value];
          }
        }
        continue;
      }

      if (line.startsWith('"') && line.endsWith('"')) {
        const value = this.unescapePoString(line.slice(1, -1));

        if (currentField === "msgid") {
          currentMsgid += value;
        } else if (currentField === "msgstr") {
          if (Array.isArray(currentMsgstr)) {
            currentMsgstr[currentMsgstr.length - 1] += value;
          } else {
            currentMsgstr += value;
          }
        }
      }

      if (i === lines.length - 1 && (currentMsgid || currentMsgstr)) {
        if (!translations[currentContext]) {
          translations[currentContext] = {};
        }

        const entry: any = {
          msgid: currentMsgid,
          msgstr: currentMsgstr,
        };

        if (currentComments.length) entry.comments = currentComments;
        if (Object.keys(currentFlags).length) entry.flags = currentFlags;
        if (currentReferences.length) entry.references = currentReferences;

        translations[currentContext][currentMsgid || ""] = entry;
      }
    }

    const headerMetadata: Record<string, string> = {};
    const headerContext = translations[""];
    if (headerContext?.[""]) {
      const headerEntry = headerContext[""];
      const headerStr = headerEntry.msgstr;
      if (headerStr && typeof headerStr === "string") {
        const headerPairs = headerStr.split("\\n");
        for (const pair of headerPairs) {
          const colonIndex = pair.indexOf(":");
          if (colonIndex > 0) {
            const key = pair.substring(0, colonIndex).trim();
            const value = pair.substring(colonIndex + 1).trim();
            headerMetadata[key] = value;
          }
        }
      }
      delete translations[""][""];
    }

    const entries: POEntry[] = [];
    for (const context of Object.values(translations)) {
      for (const rawEntry of Object.values(context)) {
        if (rawEntry.msgid === "" && !rawEntry.msgidPlural) continue;

        const flags = (
          rawEntry.flags
            ? typeof rawEntry.flags === "string"
              ? rawEntry.flags.split(",").map((f: string) => f.trim())
              : Object.keys(rawEntry.flags)
            : []
        ) as any[];
        const comments = rawEntry.comments || {};

        if (rawEntry.msgidPlural) {
          entries.push(
            createPluralEntry(
              rawEntry.msgid,
              rawEntry.msgidPlural,
              Array.isArray(rawEntry.msgstr) ? rawEntry.msgstr : [rawEntry.msgstr || ""],
              {
                flags,
                comments,
              },
            ),
          );
        } else {
          entries.push(
            createSingularEntry(
              rawEntry.msgid,
              Array.isArray(rawEntry.msgstr) ? rawEntry.msgstr[0] || "" : rawEntry.msgstr || "",
              {
                flags,
                comments,
              },
            ),
          );
        }
      }
    }

    const obsoleteEntries: POEntry[] = [];
    if (obsolete) {
      for (const context of Object.values(obsolete)) {
        for (const rawEntry of Object.values(context)) {
          if (rawEntry.msgid === "" && !rawEntry.msgidPlural) continue;

          const flags = (
            rawEntry.flags
              ? typeof rawEntry.flags === "string"
                ? rawEntry.flags.split(",").map((f: string) => f.trim())
                : Object.keys(rawEntry.flags)
              : []
          ) as any[];
          const comments = rawEntry.comments || {};

          if (rawEntry.msgidPlural) {
            obsoleteEntries.push(
              createPluralEntry(
                rawEntry.msgid,
                rawEntry.msgidPlural,
                Array.isArray(rawEntry.msgstr) ? rawEntry.msgstr : [rawEntry.msgstr || ""],
                {
                  flags,
                  comments,
                  obsolete: true,
                },
              ),
            );
          } else {
            obsoleteEntries.push(
              createSingularEntry(
                rawEntry.msgid,
                Array.isArray(rawEntry.msgstr) ? rawEntry.msgstr[0] || "" : rawEntry.msgstr || "",
                {
                  flags,
                  comments,
                  obsolete: true,
                },
              ),
            );
          }
        }
      }
    }

    if (entries.length === 0 && !Number.isNaN(totalLines / 1000)) {
      warnings.push("Large file processed in single-pass mode due to memory constraints");
    }

    const processingTime = Date.now() - startTime;

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
        charset: defaultCharset,
        header,
        entries,
        obsolete: obsoleteEntries,
      },
      warnings,
      processingTime,
    };
  }

  private unescapePoString(str: string): string {
    return str
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }

  createReadableStream(options?: { defaultCharset?: string }): any {
    return gettextParser.po.createParseStream({
      defaultCharset: options?.defaultCharset || "utf-8",
    });
  }

  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }
}

export function createStreamingParser(): POStreamingParser {
  return new POStreamingParser();
}

export const streamingParser = createStreamingParser();
