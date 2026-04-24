import {
  type ConversionOptions,
  isPluralEntry,
  type POFile,
  type TranslationConverter,
  type TranslationFormat,
} from "@domain/index";

export interface ConvertFromFormatUseCaseInput {
  content: string;
  sourceFormat: TranslationFormat;
  options?: ConversionOptions;
}

export interface ConvertFromFormatUseCaseOutput {
  success: boolean;
  poFile?: POFile;
  error?: string;
  warnings?: string[];
}

export class ConvertFromFormatUseCase {
  private converters: Map<TranslationFormat, TranslationConverter>;

  constructor(converters: TranslationConverter[]) {
    this.converters = new Map();
    for (const converter of converters) {
      this.converters.set(converter.format, converter);
    }

    const xliffConverter = this.findBestXliffConverter();
    if (xliffConverter) {
      this.converters.set("xliff12", xliffConverter);
      this.converters.set("xliff20", xliffConverter);
      this.converters.set("xliff21", xliffConverter);
    }
  }

  private findBestXliffConverter(): TranslationConverter | undefined {
    return this.converters.get("xliff");
  }

  registerConverter(converter: TranslationConverter): void {
    this.converters.set(converter.format, converter);
  }

  getSupportedFormats(): TranslationFormat[] {
    return Array.from(this.converters.keys());
  }

  execute(input: ConvertFromFormatUseCaseInput): ConvertFromFormatUseCaseOutput {
    try {
      if (!input.content || input.content.trim() === "") {
        return {
          success: false,
          error: "Content is required",
        };
      }

      if (!input.sourceFormat) {
        return {
          success: false,
          error: "Source format is required",
        };
      }

      const converter = this.findConverter(input.sourceFormat);
      if (!converter) {
        return {
          success: false,
          error: `Unsupported format: ${input.sourceFormat}`,
        };
      }

      const warnings: string[] = [];

      const poFile = converter.parse(input.content);

      if (input.sourceFormat !== "po") {
        const hasNoTranslations = poFile.entries.every((e) =>
          isPluralEntry(e) ? e.msgstr.every((s) => !s.trim()) : !e.msgstr.trim(),
        );
        if (hasNoTranslations) {
          warnings.push("No translations found in source file - only msgid will be available");
        }

        if (!input.options?.preserveComments) {
          const hasComments = poFile.entries.some(
            (e) => e.comments?.translator || e.comments?.extracted || e.comments?.reference,
          );
          if (hasComments) {
            warnings.push("Comments from source file were not preserved");
          }
        }
      }

      return {
        success: true,
        poFile,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error converting from format",
      };
    }
  }

  private findConverter(format: TranslationFormat): TranslationConverter | undefined {
    if (format.startsWith("xliff")) {
      return this.converters.get("xliff");
    }
    return this.converters.get(format);
  }

  canConvertFrom(format: TranslationFormat): boolean {
    return this.findConverter(format) !== undefined;
  }

  detectFormat(content: string, filename?: string): TranslationFormat | null {
    if (filename) {
      const ext = filename.split(".").pop()?.toLowerCase();
      if (ext === "po") return "po";
      if (ext === "xliff" || ext === "xlf") return "xliff";
      if (ext === "arb") return "arb";
      if (ext === "json") return "json";
      if (ext === "yaml" || ext === "yml") return "yaml";
    }

    const trimmed = content.trim();

    if (trimmed.startsWith("#") || trimmed.startsWith("msgid ")) {
      return "po";
    }

    if (trimmed.startsWith("<?xml") || trimmed.includes("<xliff")) {
      return "xliff";
    }

    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        JSON.parse(content);
        if (content.includes('"@@locale"') || content.includes('"@locale"')) {
          return "arb";
        }
        return "json";
      } catch {
        return null;
      }
    }

    return null;
  }
}
