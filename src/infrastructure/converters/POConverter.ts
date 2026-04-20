import { po as gettextParser } from 'gettext-parser';
import type { GettextData, GettextEntry } from 'gettext-parser';
import type { POFile } from '../../domain/entities/POFile';
import type { POEntry } from '../../domain/entities/POEntry';
import type { TranslationConverter } from '../../domain/interfaces/TranslationConverter';
import { parsePOHeader } from '../../domain/entities/POFile';
import { parsePOEntry, serializePOEntry } from '../../domain/entities/POEntry';

export class POConverter implements TranslationConverter {
    readonly format: 'po' = 'po';
    readonly displayName: string = 'PO (Gettext)';
    readonly supportedExtensions: string[] = ['.po'];

    parse(content: string): POFile {
        const parsed: GettextData = gettextParser.parse(content, {
            defaultCharset: 'utf-8',
            validation: true,
        });

        const translations = parsed.translations || {};
        const obsolete = parsed.obsolete || {};

        const entries: POEntry[] = [];

        for (const context of Object.values(translations)) {
            for (const entry of Object.values(context) as GettextEntry[]) {
                if (entry.msgid === '' && !entry.msgid_plural) {
                    continue;
                }
                entries.push(parsePOEntry(entry));
            }
        }

        const obsoleteEntries: POEntry[] = [];

        for (const context of Object.values(obsolete)) {
            for (const entry of Object.values(context) as GettextEntry[]) {
                if (entry.msgid === '' && !entry.msgid_plural) {
                    continue;
                }
                obsoleteEntries.push(parsePOEntry({ ...entry, obsolete: true }));
            }
        }

        const headerMetadata = parsed.headers || {};

        return {
            charset: parsed.charset || 'utf-8',
            header: parsePOHeader(headerMetadata),
            entries,
            obsolete: obsoleteEntries,
        };
    }

    compile(poFile: POFile): string {
        const translations: Record<string, Record<string, GettextEntry>> = {};

        for (const entry of poFile.entries) {
            if (!entry.msgid) continue;

            const context = entry.msgctxt || '';
            if (!translations[context]) {
                translations[context] = {};
            }

            translations[context][entry.msgid] = serializePOEntry(entry);
        }

        const obsolete: Record<string, Record<string, GettextEntry>> = {};

        for (const entry of poFile.obsolete) {
            const context = entry.msgctxt || '';
            if (!obsolete[context]) {
                obsolete[context] = {};
            }

            obsolete[context][entry.msgid] = serializePOEntry({ ...entry, obsolete: true });
        }
        const compiled = gettextParser.compile({
            charset: poFile.charset,
            headers: poFile.header.metadata,
            translations,
            obsolete,
        }, {
            foldLength: 76, // This will wrap lines and create the msgstr "" format you want
            sort: false,
            escapeCharacters: true,
        });

        const headerLine = `# PO file created with Obsidian PO Editor\n`;
        return headerLine + compiled.toString();
    }
    validate(content: string): { valid: boolean; error?: string } {
        try {
            gettextParser.parse(content, { validation: true });
            return { valid: true };
        } catch (error) {
            return {
                valid: false,
                error: error instanceof Error ? error.message : 'Invalid PO syntax',
            };
        }
    }

    parseStream(options?: { defaultCharset?: string }): NodeJS.ReadableStream {
        return gettextParser.createParseStream({
            defaultCharset: options?.defaultCharset || 'utf-8',
        }) as unknown as NodeJS.ReadableStream;
    }
}

export const poConverter = new POConverter();

export function createPOConverter(): POConverter {
    return new POConverter();
}
