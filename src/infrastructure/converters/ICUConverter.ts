import { parse } from '@formatjs/icu-messageformat-parser';
import type { POFile } from '../../domain/entities/POFile';
import type { POEntry } from '../../domain/entities/POEntry';
import type { TranslationConverter } from '../../domain/interfaces/TranslationConverter';

export interface ICUParseResult {
    success: boolean;
    ast?: any;
    error?: string;
}

export class ICUConverter implements TranslationConverter {
    readonly format: 'icu' = 'icu';
    readonly displayName: string = 'ICU MessageFormat (JSON)';
    readonly supportedExtensions: string[] = ['.json'];
    
    parse(content: string): POFile {
        const json = JSON.parse(content);
        const entries: POEntry[] = [];
        
        if (Array.isArray(json)) {
            for (const item of json) {
                if (typeof item === 'object' && item !== null) {
                    const id = item.id || item.key || item.msgid;
                    const value = item.value || item.message || item.msgstr;
                    
                    if (id && value) {
                        const validation = this.validateMessage(value);
                        
                        const flags: string[] = [];
                        if (validation.success) {
                            flags.push('icu-format');
                        }
                        
                        entries.push({
                            msgid: id,
                            msgstr: value,
                            comments: {},
                            flags: flags as any,
                            obsolete: false,
                            msgidPlural: undefined,
                            msgstrPlural: [],
                        });
                    }
                }
            }
        } else if (typeof json === 'object' && json !== null) {
            for (const [key, value] of Object.entries(json)) {
                if (key.startsWith('@')) continue;
                
                const message = value as string;
                if (message && typeof message === 'string') {
                    const validation = this.validateMessage(message);
                    
                    const flags: string[] = [];
                    if (validation.success) {
                        flags.push('icu-format');
                    }
                    
                    entries.push({
                        msgid: key,
                        msgstr: message,
                        comments: {},
                        flags: flags as any,
                        obsolete: false,
                        msgidPlural: undefined,
                        msgstrPlural: [],
                    });
                }
            }
        }
        
        const metadata: Record<string, string> = {
            'Content-Type': 'text/plain; charset=UTF-8',
            'X-Format': 'ICU MessageFormat',
            'X-Generator': 'Obsidian PO Editor',
        };
        
        return {
            charset: 'utf-8',
            header: {
                content: 'ICU MessageFormat converted to PO',
                metadata,
            },
            entries,
            obsolete: [],
        };
    }
    
    compile(poFile: POFile): string {
        const result: Record<string, any> = {};
        
        for (const entry of poFile.entries) {
            const key = entry.msgid;
            const value = entry.msgstr;
            
            if (key && value) {
                result[key] = value;
            }
        }
        
        return JSON.stringify(result, null, 2);
    }
    
    validateMessage(message: string): ICUParseResult {
        try {
            const ast = parse(message);
            return {
                success: true,
                ast,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Invalid ICU MessageFormat',
            };
        }
    }
    
    validateEntry(entry: POEntry): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        
        const validation = this.validateMessage(entry.msgid);
        if (!validation.success && entry.msgid) {
            errors.push(`Invalid ICU format in msgid: ${validation.error}`);
        }
        
        const targetValidation = this.validateMessage(entry.msgstr);
        if (!targetValidation.success && entry.msgstr) {
            errors.push(`Invalid ICU format in msgstr: ${targetValidation.error}`);
        }
        
        return {
            valid: errors.length === 0,
            errors,
        };
    }
    
    extractPlaceholders(message: string): string[] {
        try {
            const ast = parse(message);
            return this.extractFromAST(ast);
        } catch {
            return [];
        }
    }
    
    private extractFromAST(ast: any): string[] {
        const placeholders: string[] = [];
        
        if (Array.isArray(ast)) {
            for (const node of ast) {
                if (node.type === 'argument' && node.id) {
                    placeholders.push(node.id.name || node.id);
                }
                if (node.children) {
                    placeholders.push(...this.extractFromAST(node.children));
                }
            }
        }
        
        return placeholders;
    }
}

export function createICUConverter(): ICUConverter {
    return new ICUConverter();
}

export const icuConverter = createICUConverter();