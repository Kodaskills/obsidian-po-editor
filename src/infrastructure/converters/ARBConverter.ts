import { convertFromArb, parseToArb } from 'arb-convert';
import type { POFile } from '../../domain/entities/POFile';
import type { POEntry } from '../../domain/entities/POEntry';
import type { TranslationConverter } from '../../domain/interfaces/TranslationConverter';

export class ARBConverter implements TranslationConverter {
    readonly format: 'arb' = 'arb';
    readonly displayName: string = 'ARB (Flutter)';
    readonly supportedExtensions: string[] = ['.arb'];
    
    parse(content: string): POFile {
        const json = JSON.parse(content);
        const locale = json['@@locale'] || json['@locale'] || 'und';
        
        const entries: POEntry[] = [];
        
        for (const [key, value] of Object.entries(json)) {
            if (key.startsWith('@@') || key.startsWith('@')) {
                continue;
            }
            
            const translation = value as string;
            const metadata = json[`@${key}`] as any;
            
            const translatorComment = metadata?.description;
            const flags: string[] = [];

            if (metadata?.type === 'plural') {
                flags.push('icu-format');
            }

            if (translation) {
                entries.push({
                    msgid: key,
                    msgstr: translation,
                    comments: translatorComment ? { translator: translatorComment } : {},
                    flags: flags as any,
                    obsolete: false,
                    msgidPlural: undefined,
                    msgstrPlural: [],
                });
            }
        }
        
        const metadata: Record<string, string> = {
            'Content-Type': 'text/plain; charset=UTF-8',
            'Language': locale,
            'X-Generator': 'Obsidian PO Editor',
        };
        
        return {
            charset: 'utf-8',
            header: {
                content: 'ARB converted to PO',
                metadata,
            },
            entries,
            obsolete: [],
        };
    }
    
    compile(poFile: POFile): string {
        const locale = poFile.header.metadata['Language'] || 'und';
        
        const result: Record<string, any> = {
            '@@locale': locale,
            '@@last_modified': new Date().toISOString(),
        };
        
        for (const entry of poFile.entries) {
            const source = entry.msgid || '';
            const translation = entry.msgstr;
            
            if (source) {
                result[source] = translation;
                
                if (entry.comments.translator) {
                    result[`@${source}`] = {
                        description: entry.comments.translator,
                    };
                }
                
                if (entry.msgidPlural) {
                    result[`@${source}`] = {
                        ...result[`@${source}`],
                        type: 'plural',
                    };
                }
            }
        }
        
        return JSON.stringify(result, null, 2);
    }
    
    convertFrom(content: string, targetFormat: 'xliff-1.2' | 'xliff-2.0' | 'gettext'): string {
        return (convertFromArb as Function)(targetFormat, { source: content });
    }

    convertTo(arbContent: string, poContent: string): string {
        return (parseToArb as Function)({ source: arbContent, target: poContent });
    }
}

export function createARBConverter(): ARBConverter {
    return new ARBConverter();
}

export const arbConverter = createARBConverter();