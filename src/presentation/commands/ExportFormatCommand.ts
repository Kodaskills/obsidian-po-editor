import { App, TFile, Notice, Modal } from 'obsidian';
import { ConvertToFormatUseCase } from '../../application/use-cases/ConvertToFormatUseCase';
import { ParsePOUseCase } from '../../application/use-cases/ParsePOUseCase';
import { POConverter } from '../../infrastructure/converters/POConverter';
import { XLIFFConverter } from '../../infrastructure/converters/XLIFFConverter';
import { ARBConverter } from '../../infrastructure/converters/ARBConverter';
import { JsonConverter, YamlConverter } from '../../infrastructure/converters/JsonYamlConverter';
import { ICUConverter } from '../../infrastructure/converters/ICUConverter';
import { TranslationFormat, FORMAT_LABELS } from '../../domain/interfaces/TranslationConverter';
import type POEditorPlugin from '../../main';

export interface ExportFormatCommandOptions {
    targetFormat: TranslationFormat;
    outputFileName?: string;
    preserveComments?: boolean;
    preserveFlags?: boolean;
}

export class ExportFormatCommand {
    private app: App;
    private plugin: POEditorPlugin;
    private convertToFormatUseCase: ConvertToFormatUseCase;
    private parsePOUseCase: ParsePOUseCase;
    private poConverter: POConverter;
    
    constructor(app: App, plugin: POEditorPlugin) {
        this.app = app;
        this.plugin = plugin;
        this.convertToFormatUseCase = new ConvertToFormatUseCase([
            new POConverter(),
            new XLIFFConverter(),
            new ARBConverter(),
            new JsonConverter(),
            new YamlConverter(),
            new ICUConverter(),
        ]);
        this.parsePOUseCase = new ParsePOUseCase();
        this.poConverter = new POConverter();
    }
    
    async execute(options: ExportFormatCommandOptions): Promise<string | null> {
        const activeFile = this.app.workspace.getActiveFile();
        
        if (!activeFile || activeFile.extension !== 'po') {
            new Notice('No PO file is currently active', 5000);
            return null;
        }
        
        try {
            const content = await this.app.vault.cachedRead(activeFile);
            
            const parseResult = this.parsePOUseCase.execute({
                content,
                converter: this.poConverter,
            });
            
            if (!parseResult.success || !parseResult.poFile) {
                new Notice(`Parse error: ${parseResult.error}`, 10000);
                return null;
            }
            
            const result = this.convertToFormatUseCase.execute({
                poFile: parseResult.poFile,
                targetFormat: options.targetFormat,
                options: {
                    preserveComments: options.preserveComments ?? this.plugin.settings.preserveComments,
                    preserveFlags: options.preserveFlags ?? true,
                },
            });
            
            if (!result.success || !result.content) {
                new Notice(`Export failed: ${result.error}`, 10000);
                return null;
            }
            
            if (result.warnings && result.warnings.length > 0) {
                for (const warning of result.warnings) {
                    new Notice(`Warning: ${warning}`, 5000);
                }
            }
            
            const fileName = options.outputFileName || `${activeFile.basename}.${this.getExtension(options.targetFormat)}`;
            const fullPath = `${this.plugin.settings.outputDirectory}/${fileName}`;
            
            const file = await this.app.vault.create(fullPath, result.content);
            new Notice(`Exported to ${file.name}`);
            
            return result.content;
        } catch (error) {
            new Notice(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 10000);
            return null;
        }
    }
    
    private getExtension(format: TranslationFormat): string {
        switch (format) {
            case 'po': return 'po';
            case 'xliff':
            case 'xliff12':
            case 'xliff20':
            case 'xliff21':
                return 'xliff';
            case 'arb': return 'arb';
            case 'json': return 'json';
            case 'yaml': return 'yaml';
            case 'icu': return 'json';
            default: return 'txt';
        }
    }
    
    showDialog(): void {
        const modal = new ExportModal(this.app, async (options) => {
            await this.execute(options);
        });
        modal.open();
    }
    
    getSupportedFormats(): TranslationFormat[] {
        return this.convertToFormatUseCase.getSupportedFormats();
    }
}

class ExportModal extends Modal {
    private onSubmit: (options: ExportFormatCommandOptions) => void;
    private formatSelect: HTMLSelectElement;
    private outputFileNameInput: HTMLInputElement;
    
    constructor(app: App, onSubmit: (options: ExportFormatCommandOptions) => void) {
        super(app);
        this.onSubmit = onSubmit;
        this.formatSelect = {} as HTMLSelectElement;
        this.outputFileNameInput = {} as HTMLInputElement;
    }
    
    onOpen(): void {
        const { contentEl } = this;
        
        contentEl.createEl('h2', { text: 'Export PO File' });
        
        const form = contentEl.createDiv({ cls: 'po-export-form' });
        
        const formatRow = form.createDiv({ cls: 'form-row' });
        formatRow.createEl('label', { text: 'Target Format:' });
        this.formatSelect = formatRow.createEl('select') as HTMLSelectElement;
        
        const formats: TranslationFormat[] = ['po', 'xliff', 'arb', 'json', 'yaml', 'icu'];
        for (const format of formats) {
            const option = document.createElement('option');
            option.value = format;
            option.textContent = FORMAT_LABELS[format];
            this.formatSelect.appendChild(option);
        }
        
        const outputRow = form.createDiv({ cls: 'form-row' });
        outputRow.createEl('label', { text: 'Output File Name:' });
        this.outputFileNameInput = outputRow.createEl('input', {
            type: 'text',
            placeholder: 'translations.xliff',
        }) as HTMLInputElement;
        
        const buttonRow = contentEl.createDiv({ cls: 'button-row' });
        
        buttonRow.createEl('button', {
            text: 'Cancel',
            cls: 'btn',
        }).onclick = () => this.close();
        
        buttonRow.createEl('button', {
            text: 'Export',
            cls: 'btn btn-primary',
        }).onclick = () => {
            this.onSubmit({
                targetFormat: this.formatSelect.value as TranslationFormat,
                outputFileName: this.outputFileNameInput.value || undefined,
            });
            this.close();
        };
    }
    
    onClose(): void {
        this.contentEl.empty();
    }
}

export function createExportFormatCommand(app: App, plugin: POEditorPlugin): ExportFormatCommand {
    return new ExportFormatCommand(app, plugin);
}