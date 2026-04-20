import { TFile, Vault } from 'obsidian';

export interface FileService {
    read(file: TFile): Promise<string>;
    write(file: TFile, content: string): Promise<void>;
    create(name: string, content: string): Promise<TFile>;
    exists(name: string): boolean;
    findByExtension(extension: string): TFile[];
    getActiveFile(): TFile | null;
}

export class ObsidianFileService implements FileService {
    private vault: Vault;
    
    constructor(vault: Vault) {
        this.vault = vault;
    }
    
    async read(file: TFile): Promise<string> {
        try {
            return await this.vault.cachedRead(file);
        } catch (error) {
            throw new Error(`Failed to read file ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    async write(file: TFile, content: string): Promise<void> {
        try {
            await this.vault.modify(file, content);
        } catch (error) {
            throw new Error(`Failed to write file ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    async create(name: string, content: string): Promise<TFile> {
        try {
            const exists = this.vault.getAbstractFileByPath(name);
            if (exists) {
                throw new Error(`File already exists: ${name}`);
            }
            return await this.vault.create(name, content);
        } catch (error) {
            if (error instanceof Error && error.message.includes('File already exists')) {
                throw error;
            }
            throw new Error(`Failed to create file ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    exists(name: string): boolean {
        return this.vault.getAbstractFileByPath(name) !== null;
    }
    
    findByExtension(extension: string): TFile[] {
        const normalizedExt = extension.startsWith('.') ? extension.slice(1) : extension;
        return this.vault.getFiles().filter(f => 
            f instanceof TFile && f.extension === normalizedExt
        ) as TFile[];
    }
    
    getActiveFile(): TFile | null {
        return this.app.workspace.getActiveFile();
    }
    
    get app(): import('obsidian').App {
        return (this as any).app as import('obsidian').App;
    }
}

export function createFileService(vault: Vault): ObsidianFileService {
    return new ObsidianFileService(vault);
}

export interface FilePickerOptions {
    title?: string;
    defaultPath?: string;
    filter?: (file: TFile) => boolean;
}

export class FilePickerService {
    private vault: Vault;
    
    constructor(vault: Vault) {
        this.vault = vault;
    }
    
    async pickFile(options?: FilePickerOptions): Promise<TFile | null> {
        return new Promise((resolve) => {
            const modal = new (require('obsidian').FileSuggestModal)(this.vault, (file: TFile) => {
                resolve(file);
            }, () => {
                resolve(null);
            });
            if (options?.title) {
                modal.setPlaceholder(options.title);
            }
            modal.open();
        });
    }
    
    pickDirectory(): Promise<string | null> {
        return new Promise((resolve) => {
            const modal = new (require('obsidian').FolderSuggestModal)(this.vault, (folder: any) => {
                resolve(folder.path);
            }, () => {
                resolve(null);
            });
            modal.open();
        });
    }
}