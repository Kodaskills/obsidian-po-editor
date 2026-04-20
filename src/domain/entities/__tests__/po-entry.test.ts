import { describe, it, expect } from 'vitest';
import { parsePOEntry, serializePOEntry, createPOEntry } from '../POEntry';

// ===== DONNÉES LOCALES POUR CE FICHIER =====

// Test cases pour parsePOEntry
const parseTestCases = [
    {
        name: 'basic entry with msgid and msgstr',
        input: { msgid: 'Hello', msgstr: 'Bonjour' },
        expected: {
            msgid: 'Hello',
            msgstr: 'Bonjour',
            flags: [],
            comments: {},
            obsolete: false,
        },
    },
    {
        name: 'fuzzy entry',
        input: { msgid: 'World', msgstr: '', comments: { flag: 'fuzzy' } },
        expected: {
            msgid: 'World',
            msgstr: '',
            flags: ['fuzzy'],
            comments: {},
            obsolete: false,
        },
    },
    {
        name: 'entry with msgctxt',
        input: { msgid: 'OK', msgstr: 'OK', msgctxt: 'Button' },
        expected: {
            msgid: 'OK',
            msgstr: 'OK',
            msgctxt: 'Button',
            flags: [],
            comments: {},
            obsolete: false,
        },
    },
    {
        name: 'entry with translator comment',
        input: { msgid: 'Hello', msgstr: 'Bonjour', comments: { translator: 'Test translation' } },
        expected: {
            msgid: 'Hello',
            msgstr: 'Bonjour',
            flags: [],
            comments: { translator: 'Test translation' },
            obsolete: false,
        },
    },
    {
        name: 'plural entry',
        input: { msgid: 'one file', msgid_plural: 'many files', msgstr: ['un fichier', 'plusieurs fichiers'] },
        expected: {
            msgid: 'one file',
            msgidPlural: 'many files',
            msgstr: 'un fichier',
            msgstrPlural: ['un fichier', 'plusieurs fichiers'],
            flags: [],
            comments: {},
            obsolete: false,
        },
    },
    {
        name: 'obsolete entry',
        input: { msgid: 'old', msgstr: 'ancien', obsolete: true },
        expected: {
            msgid: 'old',
            msgstr: 'ancien',
            flags: [],
            comments: {},
            obsolete: true,
        },
    },
    {
        name: 'entry with multiple flags',
        input: { msgid: 'printf', msgstr: '%s', comments: { flag: 'c-format, python-format' } },
        expected: {
            msgid: 'printf',
            msgstr: '%s',
            flags: ['c-format', 'python-format'],
            comments: {},
            obsolete: false,
        },
    },
    {
        name: 'entry with extracted comment',
        input: { msgid: 'Test', msgstr: 'Test', comments: { extracted: 'This is extracted' } },
        expected: {
            msgid: 'Test',
            msgstr: 'Test',
            flags: [],
            comments: { extracted: 'This is extracted' },
            obsolete: false,
        },
    },
];

// Test cases pour serializePOEntry
const serializeTestCases = [
    {
        name: 'basic entry serialization',
        input: { msgid: 'Hello', msgstr: 'Bonjour', flags: [], comments: {}, obsolete: false },
        expected: { msgid: 'Hello', msgstr: ['Bonjour'] },
    },
    {
        name: 'entry with msgctxt',
        input: { msgid: 'OK', msgstr: 'OK', msgctxt: 'Button', flags: [], comments: {}, obsolete: false },
        expected: { msgid: 'OK', msgstr: ['OK'], msgctxt: 'Button' },
    },
    {
        name: 'plural entry serialization',
        input: { 
            msgid: 'one file', 
            msgstr: 'un fichier',
            msgidPlural: 'many files',
            msgstrPlural: ['un fichier', 'plusieurs fichiers'],
            flags: [], 
            comments: {}, 
            obsolete: false 
        },
        expected: { 
            msgid: 'one file', 
            msgid_plural: 'many files',
            msgstr: ['un fichier', 'plusieurs fichiers'] 
        },
    },
    {
        name: 'entry with translator comment serializes correctly',
        input: { 
            msgid: 'Hello', 
            msgstr: 'Bonjour', 
            flags: [], 
            comments: { translator: 'Test translation' }, 
            obsolete: false 
        },
        expected: { 
            msgid: 'Hello', 
            msgstr: ['Bonjour'],
            comments: { translator: 'Test translation' },
        },
    },
    {
        name: 'entry with flag serializes correctly',
        input: { msgid: 'Fuzzy', msgstr: '', flags: ['fuzzy'], comments: {}, obsolete: false },
        expected: { msgid: 'Fuzzy', msgstr: [''], comments: { flag: 'fuzzy' } },
    },
];

// Test cases pour createPOEntry
const createTestCases = [
    {
        name: 'create basic entry',
        input: { msgid: 'Hello', msgstr: 'Bonjour' },
        check: (entry: any) => {
            expect(entry.msgid).toBe('Hello');
            expect(entry.msgstr).toBe('Bonjour');
            expect(entry.flags).toEqual([]);
            expect(entry.obsolete).toBe(false);
        },
    },
    {
        name: 'create entry with options',
        input: { msgid: 'Test', msgstr: ' Essai ', flags: ['fuzzy'] },
        check: (entry: any) => {
            expect(entry.msgid).toBe('Test');
            expect(entry.msgstr).toBe(' Essai ');
            expect(entry.flags).toEqual(['fuzzy']);
            expect(entry.obsolete).toBe(false);
        },
    },
    {
        name: 'create entry with empty msgid defaults to empty string',
        input: { msgid: '', msgstr: 'test' },
        check: (entry: any) => {
            expect(entry.msgid).toBe('');
        },
    },
];

// ===== TESTS =====

describe('parsePOEntry', () => {
    parseTestCases.forEach(({ name, input, expected }) => {
        it(name, () => {
            const result = parsePOEntry(input);
            expect(result.msgid).toBe(expected.msgid);
            expect(result.msgstr).toBe(expected.msgstr);
            expect(result.flags).toEqual(expected.flags);
            expect(result.comments).toEqual(expected.comments);
            expect(result.obsolete).toBe(expected.obsolete);
            if (expected.msgctxt !== undefined) {
                expect(result.msgctxt).toBe(expected.msgctxt);
            }
            if (expected.msgidPlural !== undefined) {
                expect(result.msgidPlural).toBe(expected.msgidPlural);
            }
            if (expected.msgstrPlural !== undefined) {
                expect(result.msgstrPlural).toEqual(expected.msgstrPlural);
            }
        });
    });
});

describe('serializePOEntry', () => {
    serializeTestCases.forEach(({ name, input, expected }) => {
        it(name, () => {
            const result = serializePOEntry(input);
            expect(result.msgid).toBe(expected.msgid);
            expect(result.msgstr).toEqual(expected.msgstr);
            if (expected.msgctxt !== undefined) {
                expect(result.msgctxt).toBe(expected.msgctxt);
            }
            if (expected.msgid_plural !== undefined) {
                expect(result.msgid_plural).toBe(expected.msgid_plural);
            }
            if (expected.comments !== undefined) {
                expect(result.comments).toEqual(expected.comments);
            }
        });
    });
});

describe('createPOEntry', () => {
    createTestCases.forEach(({ name, input, check }) => {
        it(name, () => {
            const entry = createPOEntry(input.msgid, input.msgstr, input as any);
            check(entry);
        });
    });
});