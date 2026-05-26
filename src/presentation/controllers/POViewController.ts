import {
  type ConvertToFormat,
  type ConvertToFormatOutput,
  POFileMutationService,
  type ParsePO,
  type ParsePOOutput,
  type SyncPOFiles,
  type SyncPOFilesInput,
  type SyncPOFilesOutput,
  type TranslationConverter,
  type TranslationFormat,
} from "@application/index";
import { type POFile } from "@domain/index";

export class POViewController {
  constructor(
    private readonly parseUseCase: ParsePO,
    private readonly syncUseCase: SyncPOFiles,
    private readonly convertToFormatUseCase: ConvertToFormat,
    private readonly compiler: TranslationConverter,
    readonly mutationService: POFileMutationService,
  ) {}

  async parse(
    content: string,
    onProgress?: (processed: number, total: number) => void,
  ): Promise<ParsePOOutput> {
    return await this.parseUseCase.execute({ content, converter: this.compiler, onProgress });
  }

  compile(poFile: POFile): string {
    return this.compiler.compile(poFile);
  }

  synchronize(input: SyncPOFilesInput): SyncPOFilesOutput {
    return this.syncUseCase.execute(input);
  }

  exportToFormat(poFile: POFile, targetFormat: TranslationFormat): ConvertToFormatOutput {
    return this.convertToFormatUseCase.execute({ poFile, targetFormat });
  }
}
