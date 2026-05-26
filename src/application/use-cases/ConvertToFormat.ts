import { ConverterRegistry } from "@application/index";
import { type ConversionOptions, type TranslationFormat } from "@application/index";
import { type POFile } from "@domain/index";

export interface ConvertToFormatInput {
  poFile: POFile;
  targetFormat: TranslationFormat;
  options?: ConversionOptions;
}

export interface ConvertToFormatOutput {
  success: boolean;
  content?: string;
  error?: string;
  warnings?: string[];
}

export class ConvertToFormat {
  constructor(private readonly registry: ConverterRegistry) {}

  getSupportedFormats(): TranslationFormat[] {
    return this.registry.getSupportedFormats();
  }

  execute(input: ConvertToFormatInput): ConvertToFormatOutput {
    try {
      if (!input.poFile) {
        return { success: false, error: "PO file is required" };
      }

      if (!input.targetFormat) {
        return { success: false, error: "Target format is required" };
      }

      const converter = this.registry.getByFormat(input.targetFormat);
      if (!converter) {
        return { success: false, error: `Unsupported format: ${input.targetFormat}` };
      }

      const warnings: string[] = [];

      if (!converter.supportsPlurals) {
        const hasPlurals = input.poFile.entries.some((e) => "msgidPlural" in e);
        if (hasPlurals) {
          warnings.push("Plural forms may not be fully supported in the target format");
        }
      }

      if (!converter.supportsFuzzyFlags) {
        const hasFuzzy = input.poFile.entries.some((e) => e.flags?.includes("fuzzy"));
        if (hasFuzzy && input.options?.preserveFlags !== false) {
          warnings.push(
            "Fuzzy flags will be preserved but may not be recognized by the target format",
          );
        }
      }

      const content = converter.compile(input.poFile);

      return {
        success: true,
        content,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error converting to format",
      };
    }
  }

  canConvertTo(format: TranslationFormat): boolean {
    return this.registry.getByFormat(format) !== undefined;
  }
}

export function suggestTargetFormat(originalFormat: TranslationFormat): TranslationFormat[] {
  const suggestions: TranslationFormat[] = [];

  if (originalFormat === "po") {
    suggestions.push("xliff", "json", "yaml", "arb");
  } else if (originalFormat.startsWith("xliff")) {
    suggestions.push("po", "json", "yaml");
  } else if (originalFormat === "arb") {
    suggestions.push("po", "json", "xliff");
  } else if (originalFormat === "json" || originalFormat === "yaml") {
    suggestions.push("po", "xliff", "arb");
  }

  return suggestions;
}
