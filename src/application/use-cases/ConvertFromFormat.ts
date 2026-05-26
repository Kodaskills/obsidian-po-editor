import { ConverterRegistry } from "@application/index";
import { type ConversionOptions, type TranslationFormat } from "@application/index";
import { isPluralEntry, type POFile } from "@domain/index";

export interface ConvertFromFormatInput {
  content: string;
  sourceFormat: TranslationFormat;
  options?: ConversionOptions;
}

export interface ConvertFromFormatOutput {
  success: boolean;
  poFile?: POFile;
  error?: string;
  warnings?: string[];
}

export class ConvertFromFormat {
  constructor(private readonly registry: ConverterRegistry) {}

  getSupportedFormats(): TranslationFormat[] {
    return this.registry.getSupportedFormats();
  }

  execute(input: ConvertFromFormatInput): ConvertFromFormatOutput {
    try {
      if (!input.content || input.content.trim() === "") {
        return { success: false, error: "Content is required" };
      }

      if (!input.sourceFormat) {
        return { success: false, error: "Source format is required" };
      }

      const converter = this.registry.getByFormat(input.sourceFormat);
      if (!converter) {
        return { success: false, error: `Unsupported format: ${input.sourceFormat}` };
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

  canConvertFrom(format: TranslationFormat): boolean {
    return this.registry.getByFormat(format) !== undefined;
  }

  detectFormat(content: string, filename?: string): TranslationFormat | null {
    return this.registry.detectFormat(content, filename) ?? null;
  }
}
