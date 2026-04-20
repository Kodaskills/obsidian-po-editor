import { App, TFile, Notice, Modal } from 'obsidian';
import { CreatePOUseCase } from '../../application/use-cases/CreatePOUseCase';
import { ParsePOUseCase } from '../../application/use-cases/ParsePOUseCase';
import { POConverter } from '../../infrastructure/converters/POConverter';
import { createPOEntry } from '../../domain/entities/POEntry';
import { addEntry } from '../../domain/entities/POFile';
import { getPluralFormSpec } from '../../domain/entities/PluralForms';
import type POEditorPlugin from '../../main';
import { PLURAL_FORMS } from '../../domain/entities/PluralForms';

const LANGUAGE_OPTIONS = Object.entries(PLURAL_FORMS)
    .map(([code, spec]) => ({ code, label: `${spec.examples ?? code} (${code})` }))
    .sort((a, b) => a.label.localeCompare(b.label));

export interface CreatePOCommandOptions {
    targetLanguage: string;
    sourceLanguage?: string;
    fileName?: string;
    customMetadata?: Record<string, string>;
    potTemplatePath?: string;
}

export class CreatePOCommand {
    private app: App;
    private plugin: POEditorPlugin;
    private createPOUseCase: CreatePOUseCase;
    private parsePOUseCase: ParsePOUseCase;
    private poConverter: POConverter;

    constructor(app: App, plugin: POEditorPlugin) {
        this.app = app;
        this.plugin = plugin;
        this.createPOUseCase = new CreatePOUseCase();
        this.parsePOUseCase = new ParsePOUseCase();
        this.poConverter = new POConverter();
    }

    async execute(options?: Partial<CreatePOCommandOptions>): Promise<TFile | null> {
        const settings = this.plugin.settings;
        const targetLanguage = options?.targetLanguage || settings.defaultLanguage;

        const result = this.createPOUseCase.execute({
            targetLanguage,
            sourceLanguage: options?.sourceLanguage,
            customMetadata: options?.customMetadata,
        });

        if (!result.success || !result.poFile) {
            new Notice(`Failed to create PO file: ${result.error}`, 10000);
            return null;
        }

        let poFile = result.poFile;

        // Load entries from POT template if provided
        if (options?.potTemplatePath) {
            const potTFile = this.app.vault.getAbstractFileByPath(options.potTemplatePath);
            if (potTFile instanceof TFile) {
                const potContent = await this.app.vault.read(potTFile);
                const potResult = this.parsePOUseCase.execute({ content: potContent, converter: this.poConverter });
                if (potResult.success && potResult.poFile) {
                    const pluralSpec = getPluralFormSpec(targetLanguage);
                    const nplurals = pluralSpec.nplurals;
                    for (const entry of potResult.poFile.entries) {
                        poFile = addEntry(poFile, createPOEntry(entry.msgid, '', {
                            msgctxt: entry.msgctxt,
                            msgidPlural: entry.msgidPlural,
                            msgstrPlural: entry.msgidPlural ? Array(nplurals).fill('') : undefined,
                            comments: { extracted: entry.comments.extracted, reference: entry.comments.reference },
                            flags: [],
                            obsolete: false,
                        }));
                    }
                }
            }
        }

        const content = this.poConverter.compile(poFile);
        const fileName = options?.fileName || `${targetLanguage}.po`;
        const fullPath = fileName.startsWith('/') ? fileName : `${settings.outputDirectory}/${fileName}`;

        try {
            const file = await this.app.vault.create(fullPath, content);
            new Notice(`Created PO file: ${file.name}`);
            const leaf = this.app.workspace.getLeaf('tab');
            await leaf.openFile(file);
            return file;
        } catch (error) {
            new Notice(`Failed to create file: ${error instanceof Error ? error.message : 'Unknown error'}`, 10000);
            return null;
        }
    }
    
    showDialog(): void {
        const potFiles = this.app.vault.getFiles()
            .filter(f => f.extension === 'pot')
            .map(f => ({ path: f.path, name: f.name }));
        const modal = new CreatePOModal(this.app, potFiles, async (options) => {
            await this.execute(options);
        });
        modal.open();
    }
}

class CreatePOModal extends Modal {
    private onSubmit: (options: CreatePOCommandOptions) => void;
    private potFiles: { path: string; name: string }[];
    private targetLang = 'fr';
    private sourceLang = 'en';
    private fileName = '';
    private potTemplatePath = '';

    constructor(app: App, potFiles: { path: string; name: string }[], onSubmit: (options: CreatePOCommandOptions) => void) {
        super(app);
        this.potFiles = potFiles;
        this.onSubmit = onSubmit;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.createEl('h2', { text: 'Create New PO File' });

        const form = contentEl.createDiv({ attr: { style: 'display: flex; flex-direction: column; gap: 16px;' } });

        this.renderLangSearch(form, 'Target Language', this.targetLang, (code) => {
            this.targetLang = code;
            if (!this.fileName) fileNameInput.placeholder = `${code}.po`;
        });

        this.renderLangSearch(form, 'Source Language', this.sourceLang, (code) => {
            this.sourceLang = code;
        });

        const fileRow = form.createDiv();
        fileRow.createEl('label', { text: 'File Name (optional)', attr: { style: 'display: block; font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px;' } });
        const fileNameInput = fileRow.createEl('input', {
            attr: { type: 'text', placeholder: `${this.targetLang}.po`, style: 'width: 100%; border-radius: 6px; padding: 6px 10px;' }
        });
        fileNameInput.oninput = () => { this.fileName = fileNameInput.value; };

        if (this.potFiles.length > 0) {
            const potRow = form.createDiv();
            potRow.createEl('label', { text: 'POT Template (optional)', attr: { style: 'display: block; font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px;' } });
            const potSelect = potRow.createEl('select', { attr: { style: 'width: 100%; border-radius: 6px; padding: 6px 10px;' } }) as HTMLSelectElement;
            const emptyOpt = document.createElement('option');
            emptyOpt.value = '';
            emptyOpt.textContent = '— None —';
            potSelect.appendChild(emptyOpt);
            this.potFiles.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f.path;
                opt.textContent = f.name;
                potSelect.appendChild(opt);
            });
            potSelect.onchange = () => { this.potTemplatePath = potSelect.value; };
        }

        const btnRow = contentEl.createDiv({ attr: { style: 'display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px;' } });
        btnRow.createEl('button', { text: 'Cancel', cls: 'btn' }).onclick = () => this.close();
        btnRow.createEl('button', { text: 'Create', cls: 'btn btn-primary' }).onclick = () => {
            const options: CreatePOCommandOptions = {
                targetLanguage: this.targetLang,
                sourceLanguage: this.sourceLang,
            };
            if (this.fileName.trim()) options.fileName = this.fileName.trim();
            if (this.potTemplatePath) options.potTemplatePath = this.potTemplatePath;
            this.onSubmit(options);
            this.close();
        };
    }

    private renderLangSearch(parent: HTMLElement, label: string, initial: string, onChange: (code: string) => void): void {
        const wrapper = parent.createDiv();
        wrapper.createEl('label', { text: label, attr: { style: 'display: block; font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px;' } });

        const searchWrap = wrapper.createDiv({ attr: { style: 'position: relative;' } });
        const initialLabel = LANGUAGE_OPTIONS.find(l => l.code === initial)?.label ?? initial;
        const input = searchWrap.createEl('input', {
            attr: { type: 'text', placeholder: 'Search language...', value: initialLabel, style: 'width: 100%; border-radius: 6px; padding: 6px 10px;' }
        });

        const dropdown = searchWrap.createDiv({
            attr: { style: 'display: none; position: absolute; z-index: 1000; width: 100%; max-height: 200px; overflow-y: auto; background: var(--background-primary); border: 1px solid var(--background-modifier-border); border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); top: 100%; left: 0;' }
        });

        let selected = initial;

        const renderOptions = (filter: string) => {
            dropdown.empty();
            const matches = filter
                ? LANGUAGE_OPTIONS.filter(l => l.label.toLowerCase().includes(filter.toLowerCase()) || l.code.toLowerCase().includes(filter.toLowerCase()))
                : LANGUAGE_OPTIONS;
            matches.slice(0, 50).forEach(lang => {
                const opt = dropdown.createDiv({
                    text: lang.label,
                    attr: { style: `padding: 8px 12px; cursor: pointer; font-size: 13px; ${lang.code === selected ? 'background: var(--background-secondary); font-weight: 600;' : ''}` }
                });
                opt.onmouseenter = () => { opt.style.background = 'var(--background-modifier-hover)'; };
                opt.onmouseleave = () => { opt.style.background = lang.code === selected ? 'var(--background-secondary)' : ''; };
                opt.onclick = () => {
                    selected = lang.code;
                    input.value = lang.label;
                    dropdown.style.display = 'none';
                    onChange(lang.code);
                };
            });
            dropdown.style.display = matches.length > 0 ? 'block' : 'none';
        };

        input.oninput = () => renderOptions(input.value);
        input.onfocus = () => renderOptions(input.value);
        input.onblur = () => setTimeout(() => { dropdown.style.display = 'none'; }, 150);
    }

    onClose(): void {
        this.contentEl.empty();
    }
}

export function createCreatePOCommand(app: App, plugin: POEditorPlugin): CreatePOCommand {
    return new CreatePOCommand(app, plugin);
}