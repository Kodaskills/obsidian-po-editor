import { describe, it, expect } from 'vitest';
import { ConvertToFormatUseCase, suggestTargetFormat } from '../ConvertToFormatUseCase';
import { poConverter } from '../../../infrastructure/converters/POConverter';
import { jsonConverter } from '../../../infrastructure/converters/JsonYamlConverter';

// ===== DONNÉES LOCALES POUR CE FICHIER =====

const convertTestCases = [
    {
        name: 'convert to JSON successfully',
        input: {
            poFile: {
                charset: 'utf-8',
                header: { content: '', metadata: { 'Content-Type': 'text/plain; charset=UTF-8' } },
                entries: [
                    { msgid: 'Hello', msgstr: 'Bonjour', flags: [], comments: {}, obsolete: false },
                ],
                obsolete: [],
            },
            targetFormat: 'json' as const,
        },
        expectedSuccess: true,
    },
    {
        name: 'convert to YAML successfully',
        input: {
            poFile: {
                charset: 'utf-8',
                header: { content: '', metadata: { 'Content-Type': 'text/plain; charset=UTF-8' } },
                entries: [
                    { msgid: 'Hello', msgstr: 'Bonjour', flags: [], comments: {}, obsolete: false },
                ],
                obsolete: [],
            },
            targetFormat: 'yaml' as const,
        },
        expectedSuccess: true,
    },
    {
        name: 'convert to XLIFF successfully',
        input: {
            poFile: {
                charset: 'utf-8',
                header: { content: '', metadata: { 'Content-Type': 'text/plain; charset=UTF-8' } },
                entries: [
                    { msgid: 'Hello', msgstr: 'Bonjour', flags: [], comments: {}, obsolete: false },
                ],
                obsolete: [],
            },
            targetFormat: 'xliff' as const,
        },
        expectedSuccess: true,
    },
    {
        name: 'missing PO file returns error',
        input: {
            poFile: null as any,
            targetFormat: 'json' as const,
        },
        expectedSuccess: false,
        expectedError: 'PO file is required',
    },
    {
        name: 'missing target format returns error',
        input: {
            poFile: { charset: 'utf-8', header: { content: '', metadata: {} }, entries: [], obsolete: [] },
            targetFormat: undefined as any,
        },
        expectedSuccess: false,
        expectedError: 'Target format is required',
    },
    {
        name: 'unsupported format returns error',
        input: {
            poFile: { charset: 'utf-8', header: { content: '', metadata: {} }, entries: [], obsolete: [] },
            targetFormat: 'invalid-format' as any,
        },
        expectedSuccess: false,
        expectedError: 'Unsupported format',
    },
    {
        name: 'plural forms generate warning',
        input: {
            poFile: {
                charset: 'utf-8',
                header: { content: '', metadata: { 'Content-Type': 'text/plain; charset=UTF-8' } },
                entries: [
                    { 
                        msgid: 'one file', 
                        msgstr: 'un fichier',
                        msgidPlural: 'many files',
                        msgstrPlural: ['un fichier', 'plusieurs fichiers'],
                        flags: [], 
                        comments: {}, 
                        obsolete: false 
                    },
                ],
                obsolete: [],
            },
            targetFormat: 'json' as const,
        },
        expectedSuccess: true,
        expectedWarning: 'Plural forms',
    },
    {
        name: 'fuzzy flags generate warning',
        input: {
            poFile: {
                charset: 'utf-8',
                header: { content: '', metadata: { 'Content-Type': 'text/plain; charset=UTF-8' } },
                entries: [
                    { msgid: 'Hello', msgstr: 'Bonjour', flags: ['fuzzy'], comments: {}, obsolete: false },
                ],
                obsolete: [],
            },
            targetFormat: 'json' as const,
        },
        expectedSuccess: true,
        expectedWarning: 'Fuzzy',
    },
];

const suggestTestCases = [
    { name: 'from PO suggests all formats', input: 'po', expected: ['xliff', 'json', 'yaml', 'arb'] },
    { name: 'from JSON suggests alternatives', input: 'json', expected: ['po', 'xliff', 'arb'] },
    { name: 'from YAML suggests alternatives', input: 'yaml', expected: ['po', 'xliff', 'arb'] },
    { name: 'from XLIFF suggests alternatives', input: 'xliff-1.2', expected: ['po', 'json', 'yaml'] },
    { name: 'from ARB suggests alternatives', input: 'arb', expected: ['po', 'json', 'xliff'] },
];

// ===== TESTS =====

describe('ConvertToFormatUseCase.execute', () => {
    convertTestCases.forEach(({ name, input, expectedSuccess, expectedError, expectedWarning }) => {
        it(name, () => {
            const useCase = new ConvertToFormatUseCase([poConverter, jsonConverter]);
            const result = useCase.execute(input as any);
            
            expect(result.success).toBe(expectedSuccess);
            
            if (expectedError) {
                expect(result.error).toContain(expectedError);
            }
            
            if (expectedWarning) {
                expect(result.warnings?.some(w => w.includes(expectedWarning))).toBe(true);
            }
        });
    });
});

describe('ConvertToFormatUseCase.getSupportedFormats', () => {
    it('returns registered formats', () => {
        const useCase = new ConvertToFormatUseCase([poConverter, jsonConverter]);
        const formats = useCase.getSupportedFormats();
        
        expect(formats).toContain('po');
        expect(formats).toContain('json');
    });
});

describe('ConvertToFormatUseCase.canConvertTo', () => {
    it('returns true for supported formats', () => {
        const useCase = new ConvertToFormatUseCase([poConverter, jsonConverter]);
        
        expect(useCase.canConvertTo('po')).toBe(true);
        expect(useCase.canConvertTo('json')).toBe(true);
    });

    it('returns false for unsupported formats', () => {
        const useCase = new ConvertToFormatUseCase([poConverter]);
        
        expect(useCase.canConvertTo('unknown')).toBe(false);
    });
});

describe('suggestTargetFormat', () => {
    suggestTestCases.forEach(({ name, input, expected }) => {
        it(name, () => {
            const result = suggestTargetFormat(input as any);
            expect(result).toEqual(expected);
        });
    });
});