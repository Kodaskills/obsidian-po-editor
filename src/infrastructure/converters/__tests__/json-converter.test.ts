import { describe, it, expect } from 'vitest';
import { jsonConverter } from '../JsonYamlConverter';

// ===== DONNÉES LOCALES POUR CE FICHIER =====

const parseTestCases = [
    {
        name: 'flat JSON',
        input: `{
  "hello": "Bonjour",
  "goodbye": "Au revoir"
}`,
        check: (result: any) => {
            expect(result.entries).toHaveLength(2);
            expect(result.entries.find((e: any) => e.msgid === 'hello')?.msgstr).toBe('Bonjour');
            expect(result.entries.find((e: any) => e.msgid === 'goodbye')?.msgstr).toBe('Au revoir');
        },
    },
    {
        name: 'nested JSON with dot notation',
        input: `{
  "greeting": {
    "hello": "Bonjour",
    "goodbye": "Au revoir"
  }
}`,
        check: (result: any) => {
            expect(result.entries).toHaveLength(2);
            expect(result.entries.find((e: any) => e.msgid === 'greeting.hello')?.msgstr).toBe('Bonjour');
            expect(result.entries.find((e: any) => e.msgid === 'greeting.goodbye')?.msgstr).toBe('Au revoir');
        },
    },
    {
        name: 'JSON with metadata description',
        input: `{
  "hello": "Bonjour",
  "@hello": {
    "description": "Greeting message"
  }
}`,
        check: (result: any) => {
            const entry = result.entries.find((e: any) => e.msgid === 'hello');
            expect(entry.msgstr).toBe('Bonjour');
            expect(entry.comments.translator).toBe('Greeting message');
        },
    },
    {
        name: 'empty JSON object',
        input: `{}`,
        check: (result: any) => {
            expect(result.entries).toHaveLength(0);
        },
    },
    {
        name: 'JSON with only metadata keys',
        input: `{
  "@locale": "fr",
  "@last_modified": "2024-01-01"
}`,
        check: (result: any) => {
            expect(result.entries).toHaveLength(0);
        },
    },
    {
        name: 'deeply nested JSON',
        input: `{
  "a": {
    "b": {
      "c": "value"
    }
  }
}`,
        check: (result: any) => {
            expect(result.entries).toHaveLength(1);
            expect(result.entries[0].msgid).toBe('a.b.c');
            expect(result.entries[0].msgstr).toBe('value');
        },
    },
    {
        name: 'JSON with escaped quotes - actual JSON parsing handles this',
        input: `{
  "test": "Hello \\"World\\""
}`,
        check: (result: any) => {
            // JSON.parse handles the escaping, so we get the actual string
            expect(result.entries[0].msgstr).toBe('Hello "World"');
        },
    },
];

const compileTestCases = [
    {
        name: 'simple entries to JSON',
        input: {
            entries: [
                { msgid: 'hello', msgstr: 'Bonjour', flags: [], comments: {}, obsolete: false },
                { msgid: 'goodbye', msgstr: 'Au revoir', flags: [], comments: {}, obsolete: false },
            ],
        },
        check: (result: string) => {
            const parsed = JSON.parse(result);
            expect(parsed.hello).toBe('Bonjour');
            expect(parsed.goodbye).toBe('Au revoir');
        },
    },
    {
        name: 'nested entries to JSON',
        input: {
            entries: [
                { msgid: 'greeting.hello', msgstr: 'Bonjour', flags: [], comments: {}, obsolete: false },
            ],
        },
        check: (result: string) => {
            const parsed = JSON.parse(result);
            expect(parsed.greeting.hello).toBe('Bonjour');
        },
    },
    {
        name: 'entries with translator comment',
        input: {
            entries: [
                { 
                    msgid: 'hello', 
                    msgstr: 'Bonjour', 
                    flags: [], 
                    comments: { translator: 'A greeting' }, 
                    obsolete: false 
                },
            ],
        },
        check: (result: string) => {
            const parsed = JSON.parse(result);
            expect(parsed.hello).toBe('Bonjour');
            expect(parsed['@hello'].description).toBe('A greeting');
        },
    },
    {
        name: 'empty entries array',
        input: { entries: [] },
        check: (result: string) => {
            const parsed = JSON.parse(result);
            expect(Object.keys(parsed).filter(k => !k.startsWith('@'))).toHaveLength(0);
        },
    },
];

// ===== TESTS =====

describe('JsonConverter.parse', () => {
    parseTestCases.forEach(({ name, input, check }) => {
        it(name, () => {
            const result = jsonConverter.parse(input);
            check(result);
        });
    });
});

describe('JsonConverter.compile', () => {
    compileTestCases.forEach(({ name, input, check }) => {
        it(name, () => {
            const result = jsonConverter.compile(input as any);
            check(result);
        });
    });
});

describe('JsonConverter roundtrip', () => {
    it('parse then compile preserves basic values', () => {
        const original = '{"hello": "Bonjour", "world": "Monde"}';
        const parsed = jsonConverter.parse(original);
        const compiled = jsonConverter.compile(parsed);
        
        const originalParsed = JSON.parse(original);
        const compiledParsed = JSON.parse(compiled);
        
        expect(compiledParsed.hello).toBe(originalParsed.hello);
        expect(compiledParsed.world).toBe(originalParsed.world);
    });
});