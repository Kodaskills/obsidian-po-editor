import { type TranslationConverter } from "@application/index";
import { createPOHeader, createSingularEntry, type POEntry, type POFile } from "@domain/index";
import { parse } from "@formatjs/icu-messageformat-parser";

import { isValidFlag } from "./POParseUtils";

export interface ICUParseResult {
  success: boolean;
  ast?: unknown;
  error?: string;
}

export class ICUConverter implements TranslationConverter {
  readonly format = "icu" as const;
  readonly displayName: string = "ICU MessageFormat (JSON)";
  readonly supportedExtensions: string[] = [".json"];
  readonly supportsPlurals = false;
  readonly supportsFuzzyFlags = false;

  parse(content: string): POFile {
    const json: unknown = JSON.parse(content);
    const entries: POEntry[] = [];

    if (Array.isArray(json)) {
      const items = json as Array<{
        id?: string;
        key?: string;
        msgid?: string;
        value?: string;
        message?: string;
        msgstr?: string;
      }>;
      for (const item of items) {
        if (typeof item === "object" && item !== null) {
          const id = item.id || item.key || item.msgid;
          const value = item.value || item.message || item.msgstr;

          if (id && value) {
            const validation = this.validateMessage(value);

            const flags: string[] = [];
            if (validation.success) {
              flags.push("icu-format");
            }

            entries.push(
              createSingularEntry(id, value, {
                flags: flags.filter(isValidFlag),
              }),
            );
          }
        }
      }
    } else if (typeof json === "object" && json !== null) {
      const obj = json as Record<string, unknown>;
      for (const [key, value] of Object.entries(obj)) {
        if (key.startsWith("@")) continue;

        const message = value as string;
        if (message && typeof message === "string") {
          const validation = this.validateMessage(message);

          const flags: string[] = [];
          if (validation.success) {
            flags.push("icu-format");
          }

          entries.push(
            createSingularEntry(key, message, {
              flags: flags.filter(isValidFlag),
            }),
          );
        }
      }
    }

    const header = createPOHeader("und", {
      contentType: "text/plain; charset=UTF-8",
      xGenerator: "Obsidian PO Editor",
    });

    return {
      charset: "utf-8",
      header,
      entries,
    };
  }

  compile(poFile: POFile): string {
    const result: Record<string, unknown> = {};

    for (const entry of poFile.entries) {
      const key = entry.msgid;
      const value = entry.msgstr;

      if (key && value) {
        result[key] = value;
      }
    }

    return JSON.stringify(result, null, 2);
  }

  validateMessage(message: string): ICUParseResult {
    try {
      const ast = parse(message);
      return {
        success: true,
        ast,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Invalid ICU MessageFormat",
      };
    }
  }

  validateEntry(entry: POEntry): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    const validation = this.validateMessage(entry.msgid);
    if (!validation.success && entry.msgid) {
      errors.push(`Invalid ICU format in msgid: ${validation.error}`);
    }

    const msgstr = Array.isArray(entry.msgstr) ? entry.msgstr[0] : entry.msgstr;
    const targetValidation = this.validateMessage(msgstr);
    if (!targetValidation.success && msgstr) {
      errors.push(`Invalid ICU format in msgstr: ${targetValidation.error}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  extractPlaceholders(message: string): string[] {
    try {
      const ast = parse(message);
      return this.extractFromAST(ast);
    } catch {
      return [];
    }
  }

  private extractFromAST(ast: unknown): string[] {
    const placeholders: string[] = [];

    const nodes = ast as Array<{
      type?: string;
      id?: string | { name?: string };
      children?: unknown[];
    }>;
    if (Array.isArray(nodes)) {
      for (const node of nodes) {
        if (node.type === "argument" && node.id) {
          if (typeof node.id === "string") {
            placeholders.push(node.id);
          } else {
            placeholders.push(node.id.name ?? "");
          }
        }
        if (node.children) {
          placeholders.push(...this.extractFromAST(node.children));
        }
      }
    }

    return placeholders;
  }
}
