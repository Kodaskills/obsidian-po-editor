import {
  createPluralEntry,
  createPOHeader,
  createSingularEntry,
  isPluralEntry,
  type POEntry,
  type POFile,
  type TranslationConverter,
} from "@domain/index";

export interface ARBPluralEntry {
  key: string;
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

export interface ARBICUEntry {
  key: string;
  message: string;
  placeholders: string[];
}

export interface ARBMetadata {
  type?: string;
  description?: string;
  placeholders?: Record<string, ARBPlaceholder>;
  plural?: ARBPluralForms;
}

export interface ARBPlaceholder {
  type: string;
  example?: string;
}

export interface ARBPluralForms {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
}

export class ARBEnhancedConverter implements TranslationConverter {
  readonly format = "arb" as const;
  readonly displayName: string = "ARB (Flutter) - Enhanced";
  readonly supportedExtensions: string[] = [".arb"];
  readonly supportsPlurals = true;
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
      const metadataKey = `@${key}`;
      const rawMetadata = json[metadataKey] as ARBMetadata | undefined;

      if (!translation || typeof translation !== "string") continue;

      const translatorComment = rawMetadata?.description;
      const flags: string[] = [];

      if (rawMetadata?.type === "plural") {
        flags.push("fuzzy");

        const pluralForms = rawMetadata.plural;
        if (pluralForms) {
          const pluralMsgs = [
            pluralForms.zero,
            pluralForms.one,
            pluralForms.two,
            pluralForms.few,
            pluralForms.many,
            translation,
          ].filter((v): v is string => !!v);

          if (pluralMsgs.length > 1) {
            entries.push(
              createPluralEntry(key, key, pluralMsgs, {
                comments: translatorComment ? { translator: translatorComment } : {},
                flags: flags as any,
              }),
            );
            continue;
          }
        }
      }

      if (rawMetadata?.type === "icu") {
        flags.push("icu-format");
      }

      if (rawMetadata?.placeholders) {
        flags.push("icu-format");
      }

      entries.push(
        createSingularEntry(key, translation, {
          comments: translatorComment ? { translator: translatorComment } : {},
          flags: flags as any,
        }),
      );
    }

    const header = createPOHeader(locale, {
      contentType: "text/plain; charset=UTF-8",
      xGenerator: "Obsidian PO Editor (Enhanced)",
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
      const source = entry.msgid;
      const translation = entry.msgstr;

      if (!source) continue;

      if (isPluralEntry(entry)) {
        const pluralForms: Record<string, string> = {};
        const forms = entry.msgstr;

        if (forms[0]) pluralForms.zero = forms[0];
        if (forms[1]) pluralForms.one = forms[1];
        if (forms[2]) pluralForms.two = forms[2];
        if (forms[3]) pluralForms.few = forms[3];
        if (forms[4]) pluralForms.many = forms[4];

        result[source] = forms[forms.length - 1] || translation;
        result[`@${source}`] = {
          type: "plural",
          ...pluralForms,
        };

        if (entry.comments?.translator) {
          result[`@${source}`].description = entry.comments.translator;
        }
      } else {
        result[source] = translation;

        const metadata: Record<string, any> = {};

        if (entry.comments?.translator) {
          metadata.description = entry.comments.translator;
        }

        if ((entry.flags ?? []).includes("icu-format")) {
          metadata.type = "icu";
        }

        if (Object.keys(metadata).length > 0) {
          result[`@${source}`] = metadata;
        }
      }
    }

    return JSON.stringify(result, null, 2);
  }

  detectPluralForm(_key: string, metadata: ARBMetadata): boolean {
    return metadata.type === "plural" || !!metadata.plural;
  }

  extractPlaceholders(metadata: ARBMetadata): string[] {
    if (!metadata.placeholders) return [];
    return Object.keys(metadata.placeholders);
  }
}

export function createARBEnhancedConverter(): ARBEnhancedConverter {
  return new ARBEnhancedConverter();
}

export const arbEnhancedConverter = createARBEnhancedConverter();
