import { type POFile, type POHeader } from "@domain/index";

export type CreatePOFileUseCase = (header: POHeader) => POFile;

export interface CreatePOUseCaseInput {
  header: POHeader;
  createPOFile: CreatePOFileUseCase;
}

export interface CreatePOUseCaseOutput {
  success: boolean;
  poFile?: POFile;
  error?: Error;
}

export class CreatePOUseCase {
  execute(input: CreatePOUseCaseInput): CreatePOUseCaseOutput {
    try {
      const { createPOFile, header } = input;
      const poFile = createPOFile(header);
      return { success: true, poFile };
    } catch (caught) {
      const error = caught instanceof Error ? caught : new Error(String(caught));
      return { success: false, error };
    }
  }
}
