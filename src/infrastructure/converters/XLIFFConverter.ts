import type { POFile } from '../../domain/entities/POFile';
import type { POEntry } from '../../domain/entities/POEntry';
import type { TranslationConverter } from '../../domain/interfaces/TranslationConverter';

export class XLIFFConverter implements TranslationConverter {
    readonly format: 'xliff' = 'xliff';
    readonly displayName: string = 'XLIFF';
    readonly supportedExtensions: string[] = ['.xliff', '.xlf'];

    parse(content: string): POFile {
        const entries: POEntry[] = [];
        const sourceLang = this.extractAttr(content, 'source-language') || 'en';
        const targetLang = this.extractAttr(content, 'target-language') || 'und';

        const unitRegex = /<trans-unit[^>]*id="([^"]*)"[^>]*>([\s\S]*?)<\/trans-unit>/g;
        let match: RegExpExecArray | null;

        while ((match = unitRegex.exec(content)) !== null) {
            const unitContent = match[2];
            const source = this.extractTag(unitContent, 'source');
            const target = this.extractTag(unitContent, 'target');
            const note = this.extractTag(unitContent, 'note');
            const state = this.extractAttr(unitContent, 'state') || 'new';
            const isFuzzy = state === 'needs-adaptation' || state === 'needs-review-translation';

            if (source) {
                entries.push({
                    msgid: this.unescapeXml(source),
                    msgstr: target ? this.unescapeXml(target) : '',
                    comments: note ? { translator: this.unescapeXml(note) } : {},
                    flags: isFuzzy ? ['fuzzy'] : [],
                    obsolete: false,
                    msgidPlural: undefined,
                    msgstrPlural: [],
                });
            }
        }

        return {
            charset: 'utf-8',
            header: {
                content: '',
                metadata: {
                    'Language': targetLang,
                    'X-Source-Language': sourceLang,
                    'Content-Type': 'text/plain; charset=UTF-8',
                    'X-Generator': 'Obsidian PO Editor',
                },
            },
            entries,
            obsolete: [],
        };
    }

    compile(poFile: POFile): string {
        const targetLang = poFile.header.metadata['Language'] || 'und';
        const sourceLang = poFile.header.metadata['X-Source-Language'] || 'en';

        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += `<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n`;
        xml += `  <file original="messages" source-language="${sourceLang}" target-language="${targetLang}" datatype="plaintext">\n`;
        xml += `    <body>\n`;

        for (const entry of poFile.entries) {
            const id = this.escapeXml(entry.msgid);
            const source = this.escapeXml(entry.msgid);
            const target = this.escapeXml(entry.msgstr);
            const state = entry.flags.includes('fuzzy') ? 'needs-adaptation' : 'final';

            xml += `      <trans-unit id="${id}">\n`;
            xml += `        <source>${source}</source>\n`;
            xml += `        <target state="${state}">${target}</target>\n`;
            if (entry.comments.translator) {
                xml += `        <note>${this.escapeXml(entry.comments.translator)}</note>\n`;
            }
            xml += `      </trans-unit>\n`;
        }

        xml += `    </body>\n`;
        xml += `  </file>\n`;
        xml += `</xliff>\n`;

        return xml;
    }

    private extractTag(content: string, tag: string): string | undefined {
        const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
        const match = regex.exec(content);
        return match ? match[1] : undefined;
    }

    private extractAttr(content: string, attr: string): string | undefined {
        const regex = new RegExp(`${attr}="([^"]*)"`, 'i');
        const match = regex.exec(content);
        return match ? match[1] : undefined;
    }

    private escapeXml(str: string): string {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    private unescapeXml(str: string): string {
        return str
            .replace(/&apos;/g, "'")
            .replace(/&quot;/g, '"')
            .replace(/&gt;/g, '>')
            .replace(/&lt;/g, '<')
            .replace(/&amp;/g, '&');
    }
}

export function createXLIFFConverter(): XLIFFConverter {
    return new XLIFFConverter();
}

export const xliffConverter = createXLIFFConverter();
