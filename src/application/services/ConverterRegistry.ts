import { type TranslationConverter, type TranslationFormat } from "@application/index";

export class ConverterRegistry {
  private readonly byFormat = new Map<TranslationFormat, TranslationConverter>();
  private readonly byExtension = new Map<string, TranslationConverter>();

  register(converter: TranslationConverter): void {
    this.byFormat.set(converter.format, converter);
    for (const ext of converter.supportedExtensions) {
      this.byExtension.set(ext.toLowerCase().replace(".", ""), converter);
    }
  }

  getByFormat(format: TranslationFormat): TranslationConverter | undefined {
    if (format === "xliff12" || format === "xliff20" || format === "xliff21") {
      return this.byFormat.get("xliff");
    }
    return this.byFormat.get(format);
  }

  getByExtension(ext: string): TranslationConverter | undefined {
    return this.byExtension.get(ext.toLowerCase().replace(".", ""));
  }

  getAll(): ReadonlyArray<TranslationConverter> {
    return Array.from(this.byFormat.values());
  }

  getSupportedFormats(): TranslationFormat[] {
    return Array.from(this.byFormat.keys());
  }

  detectFormat(content: string, filename?: string): TranslationFormat | undefined {
    if (filename) {
      const ext = filename.split(".").pop()?.toLowerCase();
      if (ext) {
        const converter = this.getByExtension(ext);
        if (converter) return converter.format;
      }
    }

    const trimmed = content.trim();

    if (trimmed.startsWith("#") || trimmed.startsWith("msgid ")) return "po";

    if (trimmed.startsWith("<?xml") || trimmed.includes("<xliff")) return "xliff";

    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        JSON.parse(content);
        if (content.includes('"@@locale"') || content.includes('"@locale"')) return "arb";
        return "json";
      } catch {
        return undefined;
      }
    }

    return undefined;
  }
}
