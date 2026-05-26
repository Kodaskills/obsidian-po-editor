import { type POFile } from "@domain/index";

export type TranslationFormat =
  | "po"
  | "xliff"
  | "xliff12"
  | "xliff20"
  | "xliff21"
  | "arb"
  | "json"
  | "yaml"
  | "icu";

export interface TranslationConverter {
  readonly format: TranslationFormat;
  readonly displayName: string;
  readonly supportedExtensions: string[];
  readonly supportsPlurals: boolean;
  readonly supportsFuzzyFlags: boolean;

  parse(content: string): POFile;
  parseAsync?(
    content: string,
    onProgress?: (processed: number, total: number) => void,
  ): Promise<POFile>;
  compile(poFile: POFile): string;
}

export interface ConversionOptions {
  sourceLanguage?: string;
  targetLanguage?: string;
  preserveComments?: boolean;
  preserveFlags?: boolean;
  preserveReferences?: boolean;
}

export interface ConversionResult {
  success: boolean;
  content?: string;
  error?: string;
  warnings?: string[];
}
