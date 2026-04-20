import type { POFile } from '../../domain/entities/POFile';
import type { TranslationConverter, ConversionOptions, ConversionResult, TranslationFormat } from '../../domain/interfaces/TranslationConverter';

export interface ConvertToFormatUseCaseInput {
    poFile: POFile;
    targetFormat: TranslationFormat;
    options?: ConversionOptions;
}

export interface ConvertToFormatUseCaseOutput {
    success: boolean;
    content?: string;
    error?: string;
    warnings?: string[];
}

export class ConvertToFormatUseCase {
    private converters: Map<TranslationFormat, TranslationConverter>;
    
    constructor(converters: TranslationConverter[]) {
        this.converters = new Map();
        for (const converter of converters) {
            this.converters.set(converter.format, converter);
        }
    }
    
    registerConverter(converter: TranslationConverter): void {
        this.converters.set(converter.format, converter);
    }
    
    getSupportedFormats(): TranslationFormat[] {
        return Array.from(this.converters.keys());
    }
    
    execute(input: ConvertToFormatUseCaseInput): ConvertToFormatUseCaseOutput {
        try {
            if (!input.poFile) {
                return {
                    success: false,
                    error: 'PO file is required',
                };
            }
            
            if (!input.targetFormat) {
                return {
                    success: false,
                    error: 'Target format is required',
                };
            }
            
            const converter = this.converters.get(input.targetFormat);
            if (!converter) {
                return {
                    success: false,
                    error: `Unsupported format: ${input.targetFormat}`,
                };
            }
            
            const warnings: string[] = [];
            
            if (input.targetFormat !== 'po') {
                const hasPlurals = input.poFile.entries.some(e => e.msgidPlural);
                if (hasPlurals) {
                    warnings.push('Plural forms may not be fully supported in the target format');
                }
                
                const hasFuzzy = input.poFile.entries.some(e => e.flags.includes('fuzzy'));
                if (hasFuzzy && input.options?.preserveFlags !== false) {
                    warnings.push('Fuzzy flags will be preserved but may not be recognized by the target format');
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
                error: error instanceof Error ? error.message : 'Unknown error converting to format',
            };
        }
    }
    
    canConvertTo(format: TranslationFormat): boolean {
        return this.converters.has(format);
    }
}

export function suggestTargetFormat(originalFormat: TranslationFormat): TranslationFormat[] {
    const suggestions: TranslationFormat[] = [];
    
    if (originalFormat === 'po') {
        suggestions.push('xliff', 'json', 'yaml', 'arb');
    } else if (originalFormat.startsWith('xliff')) {
        suggestions.push('po', 'json', 'yaml');
    } else if (originalFormat === 'arb') {
        suggestions.push('po', 'json', 'xliff');
    } else if (originalFormat === 'json' || originalFormat === 'yaml') {
        suggestions.push('po', 'xliff', 'arb');
    }
    
    return suggestions;
}