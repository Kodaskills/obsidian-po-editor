import { type POFile, type TranslationConverter } from "@domain/index";

export interface ParsePOUseCaseInput {
  content: string;
  converter: TranslationConverter;
}

export interface ParsePOUseCaseOutput {
  success: boolean;
  poFile?: POFile;
  error?: string;
}

export class ParsePOUseCase {
  execute(input: ParsePOUseCaseInput): ParsePOUseCaseOutput {
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

      const poFile = input.converter.parse(input.content);

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

  parseWithOptions(
    content: string,
    options: {
      converter: TranslationConverter;
      validateSyntax?: boolean;
      extractMetadata?: boolean;
    },
  ): ParsePOUseCaseOutput {
    const result = this.execute({
      content,
      converter: options.converter,
    });

    if (!result.success || !result.poFile) {
      return result;
    }

    if (options.validateSyntax) {
      const hasEmptyMsgid = result.poFile.entries.some((e) => e.msgid === "" && e.msgstr !== "");
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
