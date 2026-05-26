import { type POFile, type POHeader } from "@domain/index";

export type CreatePOFile = (header: POHeader) => POFile;

export interface CreatePOInput {
  header: POHeader;
  createPOFile: CreatePOFile;
}

export interface CreatePOOutput {
  success: boolean;
  poFile?: POFile;
  error?: Error;
}

export class CreatePO {
  execute(input: CreatePOInput): CreatePOOutput {
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
