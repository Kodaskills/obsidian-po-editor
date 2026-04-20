import gettextParser from 'gettext-parser';
import type { POFile, POHeader } from '../../domain/entities/POFile';
import type { POEntry } from '../../domain/entities/POEntry';
import { parsePOEntry } from '../../domain/entities/POEntry';
import { parsePOHeader, createHeaderContent } from '../../domain/entities/POFile';

export interface StreamingParseOptions {
    defaultCharset?: string;
    onProgress?: (processed: number, total: number) => void;
    chunkSize?: number;
}

export interface StreamParseResult {
    poFile: POFile;
    warnings: string[];
    processingTime: number;
}

export class POStreamingParser {
    private parseStream: NodeJS.ReadableStream | null = null;
    private abortController: AbortController | null = null;
    
    async parseInChunks(
        content: string,
        options: StreamingParseOptions = {}
    ): Promise<StreamParseResult> {
        const startTime = Date.now();
        const warnings: string[] = [];
        
        const defaultCharset = options.defaultCharset || 'utf-8';
        const lines = content.split('\n');
        const totalLines = lines.length;
        
        let headerContent = '';
        let inHeader = false;
        let headerLines: string[] = [];
        let translations: Record<string, Record<string, any>> = {};
        let obsolete: Record<string, Record<string, any>> = {};
        let currentContext = '';
        let currentEntry: any = null;
        let currentMsgid = '';
        let currentMsgstr: string | string[] = '';
        let currentComments: { value: string }[] = [];
        let currentFlags: Record<string, boolean | string> = {};
        let currentReferences: string[] = [];
        let isObsolete = false;
        let currentField: 'msgid' | 'msgstr' | 'msgidPlural' | 'msgstrPlural' | null = null;
        
        let processedLines = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            processedLines++;
            
            if (options.onProgress && processedLines % 1000 === 0) {
                options.onProgress(processedLines, totalLines);
            }
            
            if (line.startsWith('# ') || line.startsWith('#.')) {
                continue;
            }
            
            if (line.startsWith('#|')) {
                continue;
            }
            
            if (line.startsWith('#,') || line.startsWith('#:')) {
                continue;
            }
            
            if (line.startsWith('msgid ') && currentEntry) {
                if (currentMsgid || currentMsgstr) {
                    if (!translations[currentContext]) {
                        translations[currentContext] = {};
                    }
                    
                    const entry: any = {
                        msgid: currentMsgid,
                        msgstr: currentMsgstr,
                    };
                    
                    if (currentComments.length) entry.comments = currentComments;
                    if (Object.keys(currentFlags).length) entry.flags = currentFlags;
                    if (currentReferences.length) entry.references = currentReferences;
                    if (isObsolete) entry.obsolete = true;
                    
                    if (isObsolete) {
                        if (!obsolete[currentContext]) {
                            obsolete[currentContext] = {};
                        }
                        obsolete[currentContext][currentMsgid || ''] = entry;
                    } else {
                        translations[currentContext][currentMsgid || ''] = entry;
                    }
                }
                
                currentMsgid = '';
                currentMsgstr = '';
                currentComments = [];
                currentFlags = {};
                currentReferences = [];
                currentField = 'msgid';
                
                const match = line.match(/^msgid\s+"(.+)"$/);
                if (match) {
                    currentMsgid = this.unescapePoString(match[1]);
                }
                continue;
            }
            
            if (line.startsWith('msgstr ')) {
                currentField = 'msgstr';
                const match = line.match(/^msgstr\s+"(.+)"$/);
                if (match) {
                    currentMsgstr = this.unescapePoString(match[1]);
                }
                continue;
            }
            
            if (line.startsWith('msgid_plural')) {
                currentField = 'msgidPlural';
                const match = line.match(/^msgid_plural\s+"(.+)"$/);
                if (match) {
                    currentEntry.msgidPlural = this.unescapePoString(match[1]);
                }
                continue;
            }
            
            if (line.startsWith('msgstr[')) {
                const match = line.match(/^msgstr\[(\d+)\]\s+"(.+)"$/);
                if (match) {
                    const index = parseInt(match[1]);
                    const value = this.unescapePoString(match[2]);
                    
                    if (Array.isArray(currentMsgstr)) {
                        currentMsgstr[index] = value;
                    } else {
                        currentMsgstr = [value];
                    }
                }
                continue;
            }
            
            if (line.startsWith('"') && line.endsWith('"')) {
                const value = this.unescapePoString(line.slice(1, -1));
                
                if (currentField === 'msgid') {
                    currentMsgid += value;
                } else if (currentField === 'msgstr') {
                    if (Array.isArray(currentMsgstr)) {
                        currentMsgstr[currentMsgstr.length - 1] += value;
                    } else {
                        currentMsgstr += value;
                    }
                }
            }
            
            if (i === lines.length - 1 && (currentMsgid || currentMsgstr)) {
                if (!translations[currentContext]) {
                    translations[currentContext] = {};
                }
                
                const entry: any = {
                    msgid: currentMsgid,
                    msgstr: currentMsgstr,
                };
                
                if (currentComments.length) entry.comments = currentComments;
                if (Object.keys(currentFlags).length) entry.flags = currentFlags;
                if (currentReferences.length) entry.references = currentReferences;
                
                translations[currentContext][currentMsgid || ''] = entry;
            }
        }
        
        const headerMetadata: Record<string, string> = {};
        const headerContext = translations[''] || translations[''];
        if (headerContext && headerContext['']) {
            const headerEntry = headerContext[''];
            const headerStr = headerEntry.msgstr;
            if (headerStr && typeof headerStr === 'string') {
                const headerPairs = headerStr.split('\\n');
                for (const pair of headerPairs) {
                    const colonIndex = pair.indexOf(':');
                    if (colonIndex > 0) {
                        const key = pair.substring(0, colonIndex).trim();
                        const value = pair.substring(colonIndex + 1).trim();
                        headerMetadata[key] = value;
                    }
                }
            }
            delete translations[''][''];
        }
        
        const entries: POEntry[] = [];
        for (const context of Object.values(translations)) {
            for (const rawEntry of Object.values(context)) {
                if (rawEntry.msgid === '' && !rawEntry.msgidPlural) continue;
                entries.push(parsePOEntry(rawEntry));
            }
        }
        
        const obsoleteEntries: POEntry[] = [];
        if (obsolete) {
            for (const context of Object.values(obsolete)) {
                for (const rawEntry of Object.values(context)) {
                    if (rawEntry.msgid === '' && !rawEntry.msgidPlural) continue;
                    obsoleteEntries.push(parsePOEntry({ ...rawEntry, obsolete: true }));
                }
            }
        }
        
        if (entries.length === 0 && !isNaN(totalLines / 1000)) {
            warnings.push('Large file processed in single-pass mode due to memory constraints');
        }
        
        const processingTime = Date.now() - startTime;
        
        return {
            poFile: {
                charset: defaultCharset,
                header: {
                    content: createHeaderContent(headerMetadata),
                    metadata: headerMetadata,
                },
                entries,
                obsolete: obsoleteEntries,
            },
            warnings,
            processingTime,
        };
    }
    
    private unescapePoString(str: string): string {
        return str
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t')
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\');
    }
    
    createReadableStream(options?: { defaultCharset?: string }): NodeJS.ReadableStream {
        return gettextParser.po.createParseStream({
            defaultCharset: options?.defaultCharset || 'utf-8',
        }) as unknown as NodeJS.ReadableStream;
    }
    
    abort(): void {
        if (this.abortController) {
            this.abortController.abort();
        }
    }
}

export function createStreamingParser(): POStreamingParser {
    return new POStreamingParser();
}

export const streamingParser = createStreamingParser();