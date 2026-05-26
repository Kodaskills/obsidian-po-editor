import { type TranslationConverter } from "@application/index";
import { createPOHeader, createSingularEntry, type POEntry, type POFile } from "@domain/index";
import yaml from "js-yaml";

export class JsonYamlBaseConverter implements TranslationConverter {
  readonly format: "json" | "yaml";
  readonly displayName: string;
  readonly supportedExtensions: string[];
  readonly supportsPlurals = false;
  readonly supportsFuzzyFlags = false;

  constructor(format: "json" | "yaml") {
    this.format = format;
    this.displayName = format === "json" ? "JSON" : "YAML";
    this.supportedExtensions = format === "json" ? [".json"] : [".yaml", ".yml"];
  }

  parse(content: string): POFile {
    let data: Record<string, unknown>;

    if (this.format === "yaml") {
      data = yaml.load(content) as Record<string, unknown>;
    } else {
      data = JSON.parse(content) as Record<string, unknown>;
    }

    const entries = this.extractEntries(data);

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

  private extractEntries(data: Record<string, unknown>): POEntry[] {
    const entries: POEntry[] = [];

    const processObject = (obj: Record<string, unknown>, prefix: string = "") => {
      for (const [key, value] of Object.entries(obj)) {
        if (key.startsWith("@")) continue;
        const fullKey = prefix ? `${prefix}.${key}` : key;

        if (typeof value === "string") {
          const metadata = obj[`@${key}`] as Record<string, string> | undefined;
          const translatorComment = metadata?.description;

          entries.push(
            createSingularEntry(fullKey, value, {
              comments: translatorComment ? { translator: translatorComment } : {},
            }),
          );
        } else if (typeof value === "object" && value !== null) {
          processObject(value as Record<string, unknown>, fullKey);
        }
      }
    };

    processObject(data);
    return entries;
  }

  compile(poFile: POFile): string {
    const data = this.buildObject(poFile.entries);

    if (this.format === "yaml") {
      return yaml.dump(data, {
        indent: 2,
        lineWidth: -1,
        noRefs: true,
      });
    }

    return JSON.stringify(data, null, 2);
  }

  private buildObject(entries: POEntry[]): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const entry of entries) {
      const key = entry.msgid;
      const value = entry.msgstr;

      if (!key) continue;

      const parts = key.split(".");
      let current = result;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!(part in current)) {
          current[part] = {};
        }
        current = current[part] as Record<string, unknown>;
      }

      const lastKey = parts[parts.length - 1];
      current[lastKey] = value;

      if (entry.comments?.translator) {
        const metadataKey = `@${key}`;
        result[metadataKey] = {
          description: entry.comments.translator,
        };
      }
    }

    return result;
  }
}

export class JsonConverter extends JsonYamlBaseConverter {
  constructor() {
    super("json");
  }

  readonly format = "json" as const;
}

export class YamlConverter extends JsonYamlBaseConverter {
  constructor() {
    super("yaml");
  }

  readonly format = "yaml" as const;
}

export function createJsonConverter(): JsonConverter {
  return new JsonConverter();
}

export function createYamlConverter(): YamlConverter {
  return new YamlConverter();
}

export const jsonConverter = createJsonConverter();
export const yamlConverter = createYamlConverter();
