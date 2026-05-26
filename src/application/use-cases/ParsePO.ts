import { type TranslationConverter } from "@application/index";
import { type POFile } from "@domain/index";

export interface ParsePOInput {
  content: string;
  converter: TranslationConverter;
  onProgress?: (processed: number, total: number) => void;
}

export interface ParsePOOutput {
  success: boolean;
  poFile?: POFile;
  error?: string;
}

export class ParsePO {
  async execute(input: ParsePOInput): Promise<ParsePOOutput> {
    try {
      if (!input.content || input.content.trim() === "") {
        return {
          success: false,
          error: "Content is empty",
        };
      }

      if (!input.converter) {
        return {
          success: false,
          error: "Converter is required",
        };
      }

      // Preference for async parser if available (Ultra Performance)
      let poFile: POFile;
      if (input.converter.parseAsync) {
        poFile = await input.converter.parseAsync(input.content, input.onProgress);
      } else {
        poFile = input.converter.parse(input.content);
      }

      return {
        success: true,
        poFile,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error parsing content",
      };
    }
  }

  async parseWithOptions(
    content: string,
    options: {
      converter: TranslationConverter;
      validateSyntax?: boolean;
      extractMetadata?: boolean;
      onProgress?: (processed: number, total: number) => void;
    },
  ): Promise<ParsePOOutput> {
    const result = await this.execute({
      content,
      converter: options.converter,
      onProgress: options.onProgress,
    });

    if (!result.success || !result.poFile) {
      return result;
    }

    if (options.validateSyntax) {
      // Yield slightly during validation if many entries
      const entries = result.poFile.entries;
      const hasEmptyMsgid = entries.some((e) => e.msgid === "" && e.msgstr !== "");

      if (hasEmptyMsgid) {
        return {
          success: false,
          error: "Syntax error: empty msgid with non-empty msgstr",
        };
      }
    }

    return result;
  }
}
