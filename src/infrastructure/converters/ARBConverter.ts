import {
  createPOHeader,
  type POEntry,
  type POFile,
  type TranslationConverter,
} from "@domain/index";

export class ARBConverter implements TranslationConverter {
  readonly format = "arb" as const;
  readonly displayName: string = "ARB (Flutter)";
  readonly supportedExtensions: string[] = [".arb"];
  readonly supportsPlurals = false;
  readonly supportsFuzzyFlags = false;

  parse(content: string): POFile {
    const json = JSON.parse(content);
    const locale = json["@@locale"] || json["@locale"] || "und";

    const entries: POEntry[] = [];

    for (const [key, value] of Object.entries(json)) {
      if (key.startsWith("@@") || key.startsWith("@")) {
        continue;
      }

      const translation = value as string;
      const metadata = json[`@${key}`] as any;

      const translatorComment = metadata?.description;
      const flags: string[] = [];

      if (metadata?.type === "plural") {
        flags.push("icu-format");
      }

      if (translation) {
        entries.push({
          msgid: key,
          msgstr: translation,
          comments: translatorComment ? { translator: translatorComment } : {},
          flags: flags as any,
          obsolete: false,
        });
      }
    }

    const header = createPOHeader(locale, {
      contentType: "text/plain; charset=UTF-8",
      xGenerator: "Obsidian PO Editor",
    });

    return {
      charset: "utf-8",
      header,
      entries,
      obsolete: [],
    };
  }

  compile(poFile: POFile): string {
    const locale = poFile.header.language || "und";

    const result: Record<string, any> = {
      "@@locale": locale,
      "@@last_modified": new Date().toISOString(),
    };

    for (const entry of poFile.entries) {
      const source = entry.msgid || "";
      const translation = entry.msgstr;

      if (source) {
        result[source] = translation;

        if (entry.comments?.translator) {
          result[`@${source}`] = {
            description: entry.comments.translator,
          };
        }

        if ("msgidPlural" in entry) {
          result[`@${source}`] = {
            ...result[`@${source}`],
            type: "plural",
          };
        }
      }
    }

    return JSON.stringify(result, null, 2);
  }
}

export function createARBConverter(): ARBConverter {
  return new ARBConverter();
}

export const arbConverter = createARBConverter();
