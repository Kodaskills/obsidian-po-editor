import type { POEntry } from './POEntry';
import { getPluralFormSpec, pluralFormsHeader } from './PluralForms';

export interface POFile {
    readonly charset: string;
    readonly header: POHeader;
    readonly entries: POEntry[];
    readonly obsolete: POEntry[];
}

export interface POHeader {
    readonly content: string;
    readonly metadata: Record<string, string>;
}

export const PO_HEADER_FIELDS = [
    'Project-Id-Version',
    'Report-Msgid-Bugs-To',
    'POT-Creation-Date',
    'PO-Revision-Date',
    'Last-Translator',
    'Language-Team',
    'Language',
    'Content-Type',
    'Content-Transfer-Encoding',
    'Plural-Forms',
    'MIME-Version',
    'X-Generator'
];

export interface POStatistics {
    total: number;
    translated: number;
    untranslated: number;
    fuzzy: number;
    obsolete: number;
    wordCount: number;
    charCount: number;
    charCountNoSpaces: number;
    translatedWordCount: number;
    flags: Record<string, number>;
    errors: number;
}

export function getStatistics(file: POFile): POStatistics {
    const stats: POStatistics = {
        total: file.entries.length,
        translated: 0,
        untranslated: 0,
        fuzzy: 0,
        obsolete: file.obsolete.length,
        wordCount: 0,
        charCount: 0,
        charCountNoSpaces: 0,
        translatedWordCount: 0,
        flags: {},
        errors: 0
    };

    for (const entry of file.entries) {
        const countText = (t: string) => ({
            words: t.trim().split(/\s+/).filter(w => w.length > 0).length,
            chars: t.length,
            charsNoSpaces: t.replace(/\s/g, '').length,
        });

        const src = countText(entry.msgid);
        stats.wordCount += src.words;
        stats.charCount += src.chars;
        stats.charCountNoSpaces += src.charsNoSpaces;

        if (entry.msgidPlural) {
            const p = countText(entry.msgidPlural);
            stats.wordCount += p.words;
            stats.charCount += p.chars;
            stats.charCountNoSpaces += p.charsNoSpaces;
        }

        if (entry.msgstr.trim() || (entry.msgstrPlural && entry.msgstrPlural.some(s => s.trim()))) {
            stats.translated++;
            stats.translatedWordCount += src.words;
        } else {
            stats.untranslated++;
        }

        // Count flags
        entry.flags.forEach(flag => {
            stats.flags[flag] = (stats.flags[flag] || 0) + 1;
            if (flag === 'fuzzy') stats.fuzzy++;
        });

        // Simple error detection: empty msgid with content
        if (!entry.msgid.trim() && (entry.msgstr.trim() || entry.msgctxt)) {
            stats.errors++;
        }
    }

    return stats;
}

export function createPOFile(
    targetLanguage: string,
    sourceLanguage: string = 'en',
    options?: { customMetadata?: Record<string, string> }
): POFile {
    const pluralSpec = getPluralFormSpec(targetLanguage);
    const metadata: Record<string, string> = {
        'Content-Type': 'text/plain; charset=UTF-8',
        'Content-Transfer-Encoding': '8bit',
        'Language': targetLanguage,
        'Plural-Forms': pluralFormsHeader(pluralSpec),
        'Project-Id-Version': '1.0.0',
        'PO-Revision-Date': new Date().toISOString().replace(/:\d{3}$/, '+0000'),
        'MIME-Version': '1.0',
        'X-Generator': 'Obsidian PO Editor',
    };

    if (options?.customMetadata) {
        Object.assign(metadata, options.customMetadata);
    }

    return {
        charset: 'utf-8',
        header: { content: '', metadata },
        entries: [],
        obsolete: [],
    };
}

export function parsePOHeader(headers: Record<string, string>): { content: string; metadata: Record<string, string> } {
    return {
        content: '',
        metadata: headers,
    };
}

export function createHeaderContent(metadata: Record<string, string>): string {
    const lines = Object.entries(metadata).map(([key, value]) => `${key}: ${value}`);
    return lines.join('\n');
}

export function findEntryByMsgid(file: POFile, msgid: string): POEntry | undefined {
    return file.entries.find(e => e.msgid === msgid);
}

export function findObsoleteByMsgid(file: POFile, msgid: string): POEntry | undefined {
    return file.obsolete.find(e => e.msgid === msgid);
}

export function addEntry(file: POFile, entry: POEntry): POFile {
    return {
        ...file,
        entries: [...file.entries, entry],
    };
}

export function removeEntry(file: POFile, msgid: string): POFile {
    return {
        ...file,
        entries: file.entries.filter(e => e.msgid !== msgid),
    };
}

export function updateEntry(file: POFile, msgid: string, updater: (entry: POEntry) => POEntry): POFile {
    return {
        ...file,
        entries: file.entries.map(e => e.msgid === msgid ? updater(e) : e),
    };
}
