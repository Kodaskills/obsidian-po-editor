import type { POFile } from '../entities/POFile';

export type TranslationFormat = 'po' | 'xliff' | 'xliff12' | 'xliff20' | 'xliff21' | 'arb' | 'json' | 'yaml' | 'icu';

export interface TranslationConverter {
    readonly format: TranslationFormat;
    readonly displayName: string;
    readonly supportedExtensions: string[];
    
    parse(content: string): POFile;
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

export function normalizeFormat(format: string): TranslationFormat {
    const lower = format.toLowerCase();
    
    if (lower === 'po') return 'po';
    if (lower === 'xliff') return 'xliff';
    if (lower === 'xliff1.2' || lower === 'xliff12') return 'xliff12';
    if (lower === 'xliff2.0' || lower === 'xliff20') return 'xliff20';
    if (lower === 'xliff2.1' || lower === 'xliff21') return 'xliff21';
    if (lower === 'arb') return 'arb';
    if (lower === 'json') return 'json';
    if (lower === 'yaml') return 'yaml';
    if (lower === 'icu' || lower === 'messageformat') return 'icu';
    
    return 'po';
}

export function getFormatByExtension(ext: string): TranslationFormat {
    const lower = ext.toLowerCase().replace('.', '');
    
    switch (lower) {
        case 'po': return 'po';
        case 'xliff':
        case 'xlf': return 'xliff';
        case 'arb': return 'arb';
        case 'json': return 'json';
        case 'yaml':
        case 'yml': return 'yaml';
        default: return 'po';
    }
}

export function getExtensionForFormat(format: TranslationFormat): string {
    switch (format) {
        case 'po': return '.po';
        case 'xliff':
        case 'xliff12':
        case 'xliff20':
        case 'xliff21': return '.xliff';
        case 'arb': return '.arb';
        case 'json': return '.json';
        case 'yaml': return '.yaml';
        case 'icu': return '.json';
        default: return '.po';
    }
}

export const SUPPORTED_FORMATS: TranslationFormat[] = ['po', 'xliff', 'arb', 'json', 'yaml', 'icu'];

export const FORMAT_LABELS: Record<TranslationFormat, string> = {
    'po': 'PO (Gettext)',
    'xliff': 'XLIFF',
    'xliff12': 'XLIFF 1.2',
    'xliff20': 'XLIFF 2.0',
    'xliff21': 'XLIFF 2.1',
    'arb': 'ARB (Flutter)',
    'json': 'JSON',
    'yaml': 'YAML',
    'icu': 'ICU MessageFormat (JSON)',
};