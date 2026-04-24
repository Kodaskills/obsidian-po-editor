import {
  type CreatePOFileUseCase,
  type CreatePOUseCase,
  type FilePort,
  type NotificationPort,
  type ParsePOUseCase,
  type ViewPort,
} from "@application/index";
import {
  addEntryToFile,
  type FileRef,
  type POFile,
  type POHeader,
  type TranslationConverter,
} from "@domain/index";

export interface CreatePOCommandInput {
  filePort: FilePort;
  notificationPort: NotificationPort;
  createPOUseCase: CreatePOUseCase;
  parsePOUseCase: ParsePOUseCase;
  poConverter: TranslationConverter;
  outputDirectory: string;
  createPOFile: CreatePOFileUseCase;
  viewPort: ViewPort;
}

export interface CreatePOCommandOptions {
  header: POHeader;
  fileName?: string;
  potTemplatePath?: string;
}

export class CreatePOCommand {
  constructor(private input: CreatePOCommandInput) {}

  async execute(options: CreatePOCommandOptions): Promise<string | null> {
    const {
      filePort,
      notificationPort,
      createPOUseCase,
      poConverter,
      outputDirectory,
      createPOFile,
      viewPort,
    } = this.input;
    const { header, fileName, potTemplatePath } = options;
    const targetLanguage = header.language;

    // 1. Create base PO file structure
    const result = createPOUseCase.execute({ header, createPOFile });

    if (!result.success || !result.poFile) {
      notificationPort.error(`Failed to create PO file: ${result.error}`);
      return null;
    }

    let poFile = result.poFile;

    // 2. Merge entries from POT template if provided
    if (potTemplatePath) {
      try {
        const potFileRef = await filePort.readByPath(potTemplatePath);
        poFile = await this.mergePotTemplate(poFile, potFileRef);
      } catch (error) {
        notificationPort.error(`Failed to read POT template: ${potTemplatePath}: ${String(error)}`);
      }
    }

    // 3. Compile and write file
    const content = poConverter.compile(poFile);
    const resolvedFileName = fileName || `${targetLanguage}.po`;
    const fullPath = resolvedFileName.startsWith("/")
      ? resolvedFileName
      : `${outputDirectory}/${resolvedFileName}`;

    try {
      await filePort.create(fullPath, content);
      notificationPort.success(`Created PO file: ${resolvedFileName}`);

      // Open the file in Obsidian via ViewPort
      const fileRef = await filePort.getFileByPath(fullPath);
      if (fileRef) {
        await viewPort.openFile(fileRef);
      }
      return fullPath;
    } catch (error) {
      notificationPort.error(
        `Failed to create file: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      return null;
    }
  }

  private async mergePotTemplate(poFile: POFile, potFile: FileRef): Promise<POFile> {
    const { filePort, notificationPort, parsePOUseCase, poConverter } = this.input;
    const potContent = await filePort.read(potFile);
    const potResult = parsePOUseCase.execute({
      content: potContent,
      converter: poConverter,
    });

    if (!potResult.success || !potResult.poFile) {
      notificationPort.warning(`Could not parse POT template ${potFile.path}: ${potResult.error}`);
      return poFile;
    }

    for (const entry of potResult.poFile.entries) {
      poFile = addEntryToFile(poFile, entry);
    }
    return poFile;
  }
}
