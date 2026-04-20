import { App, Notice, Editor, TFile, MarkdownView } from 'obsidian';
import { ParsePOUseCase } from '../../application/use-cases/ParsePOUseCase';
import { POConverter } from '../../infrastructure/converters/POConverter';
import type { POEntry } from '../../domain/entities/POEntry';
import type POEditorPlugin from '../../main';

export interface FuzzyCommandOptions {
    msgid?: string;
    fuzzy?: boolean;
}

export class MarkFuzzyCommand {
    private app: App;
    private plugin: POEditorPlugin;
    private parsePOUseCase: ParsePOUseCase;
    private poConverter: POConverter;
    
    constructor(app: App, plugin: POEditorPlugin) {
        this.app = app;
        this.plugin = plugin;
        this.parsePOUseCase = new ParsePOUseCase();
        this.poConverter = new POConverter();
    }
    
    async execute(options?: FuzzyCommandOptions): Promise<boolean> {
        const activeFile = this.app.workspace.getActiveFile();
        
        if (!activeFile || activeFile.extension !== 'po') {
            new Notice('No PO file is currently active', 5000);
            return false;
        }
        
        const editor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;

        if (!editor && !options?.msgid) {
            new Notice('No editor or msgid specified', 5000);
            return false;
        }

        try {
            const content = await this.app.vault.cachedRead(activeFile);

            const parseResult = this.parsePOUseCase.execute({
                content,
                converter: this.poConverter,
            });

            if (!parseResult.success || !parseResult.poFile) {
                new Notice(`Parse error: ${parseResult.error}`, 10000);
                return false;
            }

            let targetMsgid: string | undefined = options?.msgid;

            if (!targetMsgid && editor) {
                const selection = editor.getSelection().trim();
                if (selection) {
                    targetMsgid = this.findMsgidForSelection(parseResult.poFile.entries, selection);
                }
            }

            if (!targetMsgid) {
                targetMsgid = this.findMsgidNearCursor(parseResult.poFile.entries, editor!);
            }

            if (!targetMsgid) {
                new Notice('Could not find entry to mark as fuzzy', 5000);
                return false;
            }

            let updated = false;
            const entries = parseResult.poFile.entries.map(entry => {
                if (entry.msgid === targetMsgid) {
                    const flags = [...entry.flags];
                    if (!flags.includes('fuzzy')) {
                        flags.push('fuzzy');
                        updated = true;
                    }
                    return { ...entry, flags: flags as any };
                }
                return entry;
            });

            if (!updated) {
                new Notice('Entry is already marked as fuzzy', 5000);
                return false;
            }

            const updatedPoFile = { ...parseResult.poFile, entries };
            const newContent = this.poConverter.compile(updatedPoFile);
            await this.app.vault.modify(activeFile, newContent);
            
            editor?.setSelection(
                editor.getCursor('from'),
                editor.getCursor('to')
            );
            
            new Notice(`Marked as fuzzy: "${targetMsgid.substring(0, 30)}..."`);
            
            return true;
        } catch (error) {
            new Notice(`Failed to mark as fuzzy: ${error instanceof Error ? error.message : 'Unknown error'}`, 10000);
            return false;
        }
    }
    
    private findMsgidForSelection(entries: POEntry[], selection: string): string | undefined {
        const trimmed = selection.trim();
        
        for (const entry of entries) {
            if (entry.msgid === trimmed || entry.msgstr === trimmed) {
                return entry.msgid;
            }
        }
        
        return undefined;
    }
    
    private findMsgidNearCursor(entries: POEntry[], editor: Editor): string | undefined {
        const cursor = editor.getCursor();
        const lineNumber = cursor.line;
        
        const lines = editor.getValue().split('\n');
        
        for (let i = lineNumber; i >= 0; i--) {
            const line = lines[i].trim();
            if (line.startsWith('msgid ')) {
                const match = line.match(/^msgid\s+"(.+)"$/);
                if (match) {
                    return match[1];
                }
            }
        }
        
        return undefined;
    }
}

export class UnmarkFuzzyCommand {
    private app: App;
    private plugin: POEditorPlugin;
    private parsePOUseCase: ParsePOUseCase;
    private poConverter: POConverter;
    
    constructor(app: App, plugin: POEditorPlugin) {
        this.app = app;
        this.plugin = plugin;
        this.parsePOUseCase = new ParsePOUseCase();
        this.poConverter = new POConverter();
    }
    
    async execute(options?: FuzzyCommandOptions): Promise<boolean> {
        const activeFile = this.app.workspace.getActiveFile();
        
        if (!activeFile || activeFile.extension !== 'po') {
            new Notice('No PO file is currently active', 5000);
            return false;
        }
        
        const editor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;

        if (!editor && !options?.msgid) {
            new Notice('No editor or msgid specified', 5000);
            return false;
        }

        try {
            const content = await this.app.vault.cachedRead(activeFile);

            const parseResult = this.parsePOUseCase.execute({
                content,
                converter: this.poConverter,
            });

            if (!parseResult.success || !parseResult.poFile) {
                new Notice(`Parse error: ${parseResult.error}`, 10000);
                return false;
            }

            let targetMsgid: string | undefined = options?.msgid;

            if (!targetMsgid && editor) {
                const selection = editor.getSelection().trim();
                if (selection) {
                    targetMsgid = this.findMsgidForSelection(parseResult.poFile.entries, selection);
                }
            }

            if (!targetMsgid) {
                targetMsgid = this.findMsgidNearCursor(parseResult.poFile.entries, editor!);
            }

            if (!targetMsgid) {
                new Notice('Could not find entry to unmark fuzzy', 5000);
                return false;
            }

            let updated = false;
            const entries = parseResult.poFile.entries.map(entry => {
                if (entry.msgid === targetMsgid) {
                    const flags = entry.flags.filter(f => f !== 'fuzzy');
                    if (flags.length !== entry.flags.length) {
                        updated = true;
                    }
                    return { ...entry, flags: flags as any };
                }
                return entry;
            });

            if (!updated) {
                new Notice('Entry is not marked as fuzzy', 5000);
                return false;
            }

            const updatedPoFile = { ...parseResult.poFile, entries };
            const newContent = this.poConverter.compile(updatedPoFile);
            await this.app.vault.modify(activeFile, newContent);
            
            new Notice(`Removed fuzzy flag: "${targetMsgid.substring(0, 30)}..."`);
            
            return true;
        } catch (error) {
            new Notice(`Failed to unmark fuzzy: ${error instanceof Error ? error.message : 'Unknown error'}`, 10000);
            return false;
        }
    }
    
    private findMsgidForSelection(entries: POEntry[], selection: string): string | undefined {
        const trimmed = selection.trim();
        
        for (const entry of entries) {
            if (entry.msgid === trimmed || entry.msgstr === trimmed) {
                return entry.msgid;
            }
        }
        
        return undefined;
    }
    
    private findMsgidNearCursor(entries: POEntry[], editor: Editor): string | undefined {
        const cursor = editor.getCursor();
        const lineNumber = cursor.line;
        
        const lines = editor.getValue().split('\n');
        
        for (let i = lineNumber; i >= 0; i--) {
            const line = lines[i].trim();
            if (line.startsWith('msgid ')) {
                const match = line.match(/^msgid\s+"(.+)"$/);
                if (match) {
                    return match[1];
                }
            }
        }
        
        return undefined;
    }
}

export function createMarkFuzzyCommand(app: App, plugin: POEditorPlugin): MarkFuzzyCommand {
    return new MarkFuzzyCommand(app, plugin);
}

export function createUnmarkFuzzyCommand(app: App, plugin: POEditorPlugin): UnmarkFuzzyCommand {
    return new UnmarkFuzzyCommand(app, plugin);
}