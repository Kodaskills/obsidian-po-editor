import { POFile, createPOFile } from '../../domain/entities/POFile';

export interface CreatePOUseCaseInput {
    targetLanguage: string;
    sourceLanguage?: string;
    customMetadata?: Record<string, string>;
}

export interface CreatePOUseCaseOutput {
    success: boolean;
    poFile?: POFile;
    error?: string;
}

export class CreatePOUseCase {
    execute(input: CreatePOUseCaseInput): CreatePOUseCaseOutput {
        try {
            if (!input.targetLanguage || input.targetLanguage.trim() === '') {
                return {
                    success: false,
                    error: 'Target language is required',
                };
            }
            
            const poFile = createPOFile(
                input.targetLanguage,
                input.sourceLanguage,
                { customMetadata: input.customMetadata }
            );
            
            return {
                success: true,
                poFile,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error creating PO file',
            };
        }
    }
}