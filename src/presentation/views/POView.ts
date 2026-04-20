import { TextFileView, TFile, Notice, WorkspaceLeaf, setIcon } from 'obsidian';
import { POFile, getStatistics, POStatistics, addEntry, removeEntry, updateEntry } from '../../domain/entities/POFile';
import { parseNplurals, getPluralFormLabels } from '../../domain/entities/PluralForms';
import { POEntry, createPOEntry } from '../../domain/entities/POEntry';
import { POConverter } from '../../infrastructure/converters/POConverter';
import { XLIFFConverter } from '../../infrastructure/converters/XLIFFConverter';
import { ARBConverter } from '../../infrastructure/converters/ARBConverter';
import { JsonConverter, YamlConverter } from '../../infrastructure/converters/JsonYamlConverter';
import { ICUConverter } from '../../infrastructure/converters/ICUConverter';
import { ParsePOUseCase } from '../../application/use-cases/ParsePOUseCase';
import { ConvertToFormatUseCase } from '../../application/use-cases/ConvertToFormatUseCase';
import { POEntryModal } from '../modals/POEntryModal';
import { ConvertModal } from '../modals/ConvertModal';
import type POEditorPlugin from '../../main';
import type { CustomAction } from '../settings/POSettingsTab';

interface ProjectFile {
    file: TFile;
    poFile: POFile;
    language: string;
    stats: POStatistics;
}

export class POView extends TextFileView {
    private mainPoFile: POFile | null = null;
    private siblingPoFiles: ProjectFile[] = [];
    private poConverter: POConverter;
    private parseUseCase: ParsePOUseCase;
    private plugin: POEditorPlugin;
    private isProjectMode: boolean = false;
    private showFullStats: boolean = false;
    private activeFilter: string = 'all';
    private activeContext: string = '';

    constructor(leaf: WorkspaceLeaf, plugin: POEditorPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.poConverter = new POConverter();
        this.parseUseCase = new ParsePOUseCase();
    }

    getViewType(): string { return 'po-view'; }
    getDisplayText(): string { return this.file?.name || 'PO Editor'; }
    canAcceptExtension(ext: string): boolean { return ext === 'po' || ext === 'pot'; }
    get isPOTFile(): boolean { return this.file?.extension === 'pot'; }
    clear(): void { this.mainPoFile = null; this.contentEl.empty(); }

    async setViewData(data: string, clear: boolean): Promise<void> {
        const parseResult = this.parseUseCase.execute({ content: data, converter: this.poConverter });
        if (parseResult.success && parseResult.poFile) {
            this.mainPoFile = parseResult.poFile;
            this.loadProjectPreference();
            await this.loadProjectFiles();
            this.render();
        }
    }

    getViewData(): string {
        if (!this.mainPoFile) return '';
        if (this.isPOTFile) {
            const stripped: POFile = {
                ...this.mainPoFile,
                header: {
                    content: '',
                    metadata: {
                        'Content-Type': 'text/plain; charset=UTF-8',
                        'Content-Transfer-Encoding': '8bit',
                        'MIME-Version': '1.0',
                        'X-Generator': 'Obsidian PO Editor',
                    },
                },
                entries: this.mainPoFile.entries.map(e => createPOEntry(e.msgid, '', {
                    msgctxt: e.msgctxt,
                    msgidPlural: e.msgidPlural,
                    comments: { extracted: e.comments.extracted, reference: e.comments.reference },
                    flags: [],
                    obsolete: false,
                })),
                obsolete: [],
            };
            return this.poConverter.compile(stripped);
        }
        return this.poConverter.compile(this.mainPoFile);
    }

    private loadProjectPreference(): void {
        const folderPath = this.file?.parent?.path ?? '/';
        this.isProjectMode = this.plugin.settings.projectModeFolders[folderPath] === true;
    }

    private async toggleProjectMode(): Promise<void> {
        this.isProjectMode = !this.isProjectMode;
        const folderPath = this.file?.parent?.path ?? '/';
        this.plugin.settings.projectModeFolders = {
            ...this.plugin.settings.projectModeFolders,
            [folderPath]: this.isProjectMode,
        };
        await this.plugin.saveSettings();
        if (this.isProjectMode) await this.loadProjectFiles();
        this.render();
    }

    private async loadProjectFiles(): Promise<void> {
        if (!this.file || !this.file.parent) return;
        this.siblingPoFiles = [];
        for (const child of this.file.parent.children) {
            if (child instanceof TFile && child.extension === 'po' && child.path !== this.file.path) {
                const content = await this.app.vault.read(child);
                const result = this.parseUseCase.execute({ content, converter: this.poConverter });
                if (result.success && result.poFile) {
                    this.siblingPoFiles.push({
                        file: child,
                        poFile: result.poFile,
                        language: result.poFile.header.metadata['Language'] || child.basename,
                        stats: getStatistics(result.poFile)
                    });
                }
            }
        }
    }

    render(): void {
        this.contentEl.empty();
        if (!this.file || !this.mainPoFile) return;

        const container = this.contentEl.createDiv({ cls: 'po-view-container', attr: { style: 'padding: 20px; user-select: text;' } });

        // Header
        const header = container.createDiv({ attr: { style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 1px solid var(--background-modifier-border);' } });
        const titleContainer = header.createDiv({ attr: { style: 'display: flex; align-items: center; gap: 12px;' } });
        setIcon(titleContainer.createDiv(), 'languages');
        titleContainer.createEl('h2', { text: this.file.name, attr: { style: 'margin: 0;' } });
        if (this.isPOTFile) {
            titleContainer.createEl('span', { text: 'POT Template', attr: { style: 'font-size: 11px; font-weight: 600; background: var(--text-accent); color: white; padding: 2px 8px; border-radius: 10px; opacity: 0.8;' } });
        }

        const filesInFolder = this.file.parent?.children.filter(c => c instanceof TFile && c.extension === 'po').length || 0;
        if (filesInFolder > 1) {
            const modeToggle = titleContainer.createEl('button', {
                cls: 'btn btn-sm',
                text: this.isProjectMode ? '👥 Project Mode' : '📄 Single File',
                attr: { style: `border-radius: 20px; background: ${this.isProjectMode ? 'var(--interactive-accent)' : 'var(--background-secondary)'}; color: ${this.isProjectMode ? 'white' : 'var(--text-muted)'};` }
            });
            modeToggle.onclick = () => this.toggleProjectMode();

            if (this.isProjectMode) {
                const sourceLang = this.getSourceLanguage();
                const allLangs = [
                    ...(this.file?.extension === 'po' ? [{ code: this.mainPoFile!.header.metadata['Language'] || this.file.basename, file: this.file.path }] : []),
                    ...this.siblingPoFiles.map(s => ({ code: s.language, file: s.file.path })),
                ];
                const sourceBtn = titleContainer.createEl('button', {
                    cls: 'btn btn-sm',
                    attr: { style: 'border-radius: 20px; background: var(--background-secondary); color: var(--interactive-accent); display: flex; align-items: center; gap: 4px;' },
                });
                const iconEl = sourceBtn.createDiv();
                setIcon(iconEl, 'shield-check');
                sourceBtn.createSpan({ text: sourceLang });

                const dropdown = titleContainer.createDiv({ attr: { style: 'display: none; position: absolute; z-index: 1000; background: var(--background-primary); border: 1px solid var(--background-modifier-border); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); padding: 4px 0; margin-top: 4px; min-width: 140px;' } });
                allLangs.forEach(l => {
                    const opt = dropdown.createDiv({
                        text: l.code,
                        attr: { style: `padding: 6px 12px; cursor: pointer; font-size: 13px; ${l.code === sourceLang ? 'font-weight: 600; color: var(--interactive-accent);' : ''}` }
                    });
                    opt.onmouseenter = () => { opt.style.background = 'var(--background-modifier-hover)'; };
                    opt.onmouseleave = () => { opt.style.background = ''; };
                    opt.onclick = () => { this.setSourceLanguage(l.code); dropdown.style.display = 'none'; };
                });
                sourceBtn.onclick = (e) => {
                    e.stopPropagation();
                    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
                };
                document.addEventListener('click', () => { dropdown.style.display = 'none'; }, { once: true });
            }
        }

        const actions = header.createDiv({ attr: { style: 'display: flex; gap: 8px;' } });
        actions.createEl('button', { cls: 'btn btn-primary', text: '+ Entry' }).onclick = () => this.openAddEntryModal();
        if (this.isProjectMode) {
            actions.createEl('button', { cls: 'btn', text: 'Sync' }).onclick = () => this.synchronizeEntries();
        }
        actions.createEl('button', { cls: 'btn', text: 'Export' }).onclick = () => this.openExportModal();

        this.renderStatsDashboard(container);

        const searchRow = container.createDiv({ attr: { style: 'display: flex; align-items: center; gap: 8px; margin-bottom: 16px;' } });
        const searchInput = searchRow.createEl('input', { cls: 'po-search-input', attr: { type: 'text', placeholder: 'Search...', style: 'flex: 1; border-radius: 8px;' } });

        const mainStats = getStatistics(this.mainPoFile!);
        type FilterId = 'all' | 'untranslated' | 'translated' | 'fuzzy';
        const filters: { id: FilterId; label: string; count: number; color?: string }[] = this.isPOTFile
            ? [{ id: 'all', label: 'All', count: mainStats.total }]
            : [
                { id: 'all', label: 'All', count: mainStats.total },
                { id: 'untranslated', label: 'Untranslated', count: mainStats.untranslated },
                { id: 'translated', label: 'Translated', count: mainStats.translated },
                { id: 'fuzzy', label: 'Fuzzy', count: mainStats.fuzzy, color: '#f39c12' },
                ...this.plugin.settings.quickActions
                    .filter(qa => !!qa.flag)
                    .map(qa => ({
                        id: qa.flag as FilterId,
                        label: qa.label,
                        count: mainStats.flags[qa.flag!] ?? 0,
                        color: qa.color,
                    })),
            ];

        const filterBtns: HTMLButtonElement[] = [];
        filters.forEach(f => {
            const isActive = this.activeFilter === f.id;
            const color = f.color || 'var(--interactive-accent)';
            const btn = searchRow.createEl('button', {
                cls: 'btn btn-sm',
                attr: {
                    style: `border-radius: 20px; white-space: nowrap; background: ${isActive ? color : 'var(--background-secondary)'}; color: ${isActive ? 'white' : 'var(--text-muted)'};`,
                },
            });
            btn.createSpan({ text: f.label });
            if (f.count > 0 || f.id === 'all') {
                btn.createSpan({ text: ` ${f.count}`, attr: { style: `font-size: 10px; opacity: ${isActive ? '0.8' : '0.6'};` } });
            }
            btn.onclick = () => {
                this.activeFilter = f.id;
                filterBtns.forEach((b, i) => {
                    const fi = filters[i];
                    const fc = fi.color || 'var(--interactive-accent)';
                    const active = this.activeFilter === fi.id;
                    b.style.background = active ? fc : 'var(--background-secondary)';
                    b.style.color = active ? 'white' : 'var(--text-muted)';
                });
                searchInput.oninput?.(new Event('input'));
            };
            filterBtns.push(btn);
        });

        // Context filter select
        const contexts = [...new Set(
            this.mainPoFile!.entries.map(e => e.msgctxt).filter((c): c is string => !!c)
        )].sort();
        if (contexts.length > 0) {
            const ctxSelect = searchRow.createEl('select', {
                attr: { style: 'border-radius: 8px; padding: 4px 8px; background: var(--background-secondary); color: var(--text-normal); border: 1px solid var(--background-modifier-border); font-size: 13px;' }
            }) as HTMLSelectElement;
            const allOpt = document.createElement('option');
            allOpt.value = '';
            allOpt.textContent = 'All contexts';
            ctxSelect.appendChild(allOpt);
            contexts.forEach(ctx => {
                const opt = document.createElement('option');
                opt.value = ctx;
                opt.textContent = ctx;
                if (ctx === this.activeContext) opt.selected = true;
                ctxSelect.appendChild(opt);
            });
            ctxSelect.value = this.activeContext;
            ctxSelect.onchange = () => {
                this.activeContext = ctxSelect.value;
                searchInput.oninput?.(new Event('input'));
            };
        }

        const listContainer = container.createDiv({ cls: 'po-entry-list', attr: { style: 'border-radius: 8px; overflow: hidden;' } });
        this.renderGrid(listContainer, searchInput);
    }

    private renderStatsDashboard(container: HTMLElement): void {
        const mainStats = getStatistics(this.mainPoFile!);

        // Count ALL PO files in folder for accurate avg denominator
        const totalSiblingFiles = this.file?.parent?.children.filter(
            c => c instanceof TFile && (c as TFile).extension === 'po' && (c as TFile).path !== this.file!.path
        ).length ?? 0;
        const totalFiles = totalSiblingFiles + 1;

        const allParsedStats = [mainStats, ...this.siblingPoFiles.map(s => s.stats)];
        // percentage-based avg: unparsed/empty files count as 0%
        const avgProgress = this.isProjectMode && totalFiles > 1
            ? Math.round(allParsedStats.reduce((acc, s) => acc + (s.total > 0 ? (s.translated / s.total) * 100 : 0), 0) / totalFiles)
            : (mainStats.total > 0 ? Math.round((mainStats.translated / mainStats.total) * 100) : 0);

        const displayStats = mainStats;
        const progress = avgProgress;

        const dashboard = container.createDiv({ attr: { style: 'margin-bottom: 24px; background: var(--background-secondary-alt); border-radius: 12px; padding: 20px; border: 1px solid var(--background-modifier-border);' } });

        const cardGrid = dashboard.createDiv({ attr: { style: 'display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 16px;' } });

        if (this.isPOTFile) {
            this.renderStatCard(cardGrid, displayStats.total.toString(), 'Keys', 'var(--text-normal)', 'list');
            return;
        }

        this.renderStatCard(cardGrid, `${progress}%`, this.isProjectMode ? 'Project Avg.' : 'Completion', 'var(--text-success)', 'check-circle');
        this.renderStatCard(cardGrid, displayStats.total.toString(), 'Keys', 'var(--text-normal)', 'list');
        this.renderStatCard(cardGrid, displayStats.wordCount.toLocaleString(), 'Words', 'var(--text-accent)', 'type');
        this.renderStatCard(cardGrid, displayStats.charCount.toLocaleString(), 'Chars', 'var(--text-accent)', 'text', displayStats.charCountNoSpaces.toLocaleString() + ' no sp.');
        if (displayStats.fuzzy > 0) this.renderStatCard(cardGrid, displayStats.fuzzy.toString(), 'Fuzzy', 'var(--text-warning)', 'alert-circle');

        const progressContainer = dashboard.createDiv({ attr: { style: 'margin-top: 24px;' } });
        const barBg = progressContainer.createDiv({ attr: { style: 'height: 8px; background: var(--background-modifier-border); border-radius: 4px; overflow: hidden; display: flex;' } });
        barBg.createDiv({ attr: { style: `width: ${progress}%; background: var(--text-success); transition: width 0.5s ease;` } });

        if (this.isProjectMode) {
            const detailsToggle = dashboard.createEl('div', {
                attr: { style: 'margin-top: 16px; border-top: 1px solid var(--background-modifier-border); padding-top: 12px; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; color: var(--text-accent); font-size: 12px;' }
            });
            setIcon(detailsToggle, this.showFullStats ? 'chevron-up' : 'chevron-down');
            detailsToggle.createSpan({ text: this.showFullStats ? 'Hide Detailed Breakdown' : 'Show Detailed Breakdown' });
            detailsToggle.onclick = () => { this.showFullStats = !this.showFullStats; this.render(); };

            if (this.showFullStats) {
                const breakdown = dashboard.createDiv({ attr: { style: 'margin-top: 20px;' } });

                const cols = '100px 1fr 50px 55px 75px 50px 65px 70px 75px';
                const headerRow = breakdown.createDiv({ attr: { style: `display: grid; grid-template-columns: ${cols}; gap: 8px; font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; padding: 0 0 6px; border-bottom: 1px solid var(--background-modifier-border); margin-bottom: 8px;` } });
                ['Language', 'Progress', '%', 'Keys', 'Done', 'Fuzzy', 'Words', 'Chars', 'Chars (no sp.)'].forEach(h => headerRow.createDiv({ text: h }));

                const languages = [
                    { name: this.mainPoFile!.header.metadata['Language'] || 'Current', stats: mainStats, isMain: true },
                    ...this.siblingPoFiles.map(s => ({ name: s.language, stats: s.stats, isMain: false })),
                ];
                languages.forEach(lang => {
                    const p = lang.stats.total > 0 ? Math.round((lang.stats.translated / lang.stats.total) * 100) : 0;
                    const row = breakdown.createDiv({ attr: { style: `display: grid; grid-template-columns: ${cols}; gap: 8px; align-items: center; font-size: 12px; padding: 4px 0;` } });
                    row.createDiv({ text: lang.name, attr: { style: `font-weight: ${lang.isMain ? '600' : 'normal'}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;` } });
                    const miniBarBg = row.createDiv({ attr: { style: 'height: 6px; background: var(--background-modifier-border); border-radius: 3px; overflow: hidden;' } });
                    miniBarBg.createDiv({ attr: { style: `width: ${p}%; background: var(--text-success); height: 100%;` } });
                    row.createDiv({ text: `${p}%`, attr: { style: 'color: var(--text-muted);' } });
                    row.createDiv({ text: lang.stats.total.toString(), attr: { style: 'color: var(--text-muted);' } });
                    row.createDiv({ text: `${lang.stats.translated}/${lang.stats.total}`, attr: { style: 'color: var(--text-success);' } });
                    row.createDiv({ text: lang.stats.fuzzy > 0 ? lang.stats.fuzzy.toString() : '—', attr: { style: `color: ${lang.stats.fuzzy > 0 ? 'var(--text-warning)' : 'var(--text-faint)'};` } });
                    row.createDiv({ text: lang.stats.wordCount.toLocaleString(), attr: { style: 'color: var(--text-muted);' } });
                    row.createDiv({ text: lang.stats.charCount.toLocaleString(), attr: { style: 'color: var(--text-muted);' } });
                    row.createDiv({ text: lang.stats.charCountNoSpaces.toLocaleString(), attr: { style: 'color: var(--text-faint);' } });
                });
            }
        } else {
            // Single file: show non-redundant extras only if meaningful
            const extras: string[] = [];
            if (displayStats.errors > 0) extras.push(`${displayStats.errors} error${displayStats.errors > 1 ? 's' : ''}`);
            if (displayStats.obsolete > 0) extras.push(`${displayStats.obsolete} obsolete`);
            if (extras.length > 0) {
                dashboard.createDiv({
                    text: extras.join(' · '),
                    attr: { style: 'margin-top: 12px; font-size: 11px; color: var(--text-faint); text-align: center;' }
                });
            }
        }
    }

    private renderStatCard(parent: HTMLElement, val: string, label: string, color: string, icon: string, subtitle?: string): void {
        const card = parent.createDiv({ attr: { style: 'background: var(--background-primary); padding: 16px; border-radius: 8px; border: 1px solid var(--background-modifier-border); display: flex; flex-direction: column; gap: 4px;' } });
        const top = card.createDiv({ attr: { style: 'display: flex; justify-content: space-between; align-items: center; width: 100%;' } });
        top.createDiv({ text: val, attr: { style: `font-size: 22px; font-weight: bold; color: ${color};` } });
        setIcon(top.createDiv({ attr: { style: 'opacity: 0.2;' } }), icon);
        card.createDiv({ text: label, attr: { style: 'font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-weight: 600;' } });
        if (subtitle) card.createDiv({ text: subtitle, attr: { style: 'font-size: 10px; color: var(--text-faint);' } });
    }

    private renderGrid(container: HTMLElement, searchInput: HTMLInputElement): void {
        const detectPlaceholders = (text: string): string[] => {
            const patterns = this.plugin.settings.placeholderPatterns ?? [];
            const found: string[] = [];
            for (const pat of patterns) {
                if (!pat) continue;
                try {
                    const matches = text.match(new RegExp(pat, 'g'));
                    if (matches) found.push(...matches);
                } catch {}
            }
            return [...new Set(found)];
        };

        const renderChips = (parent: HTMLElement, placeholders: string[], area: HTMLTextAreaElement, onChange: (v: string) => void) => {
            if (placeholders.length === 0) return;
            const row = parent.createDiv({ attr: { style: 'display: flex; flex-wrap: wrap; gap: 3px; padding: 0 10px 6px;' } });
            placeholders.forEach(ph => {
                const chip = row.createEl('button', {
                    text: ph,
                    attr: { style: 'font-size: 10px; font-family: monospace; padding: 1px 5px; border-radius: 3px; background: var(--background-modifier-border); color: var(--text-accent); cursor: pointer; border: none; line-height: 1.4;' },
                });
                chip.onclick = (e) => {
                    e.preventDefault();
                    const start = area.selectionStart ?? area.value.length;
                    const end = area.selectionEnd ?? area.value.length;
                    area.value = area.value.substring(0, start) + ph + area.value.substring(end);
                    area.selectionStart = area.selectionEnd = start + ph.length;
                    area.focus();
                    onChange(area.value);
                };
            });
        };

        const makeLangCell = (
            parent: HTMLElement,
            value: string,
            isMain: boolean,
            onChange: (v: string) => void,
            placeholders: string[] = [],
            isMissing: boolean = false,
            isSource: boolean = false,
            readOnly: boolean = false,
        ): HTMLTextAreaElement => {
            const bg = isMain
                ? 'var(--background-secondary-alt)'
                : isMissing ? 'rgba(var(--color-red-rgb, 220,60,60), 0.07)' : 'var(--background-secondary)';
            const topBorder = isSource ? ' border-top: 2px solid var(--interactive-accent);' : ' border-top: 2px solid transparent;';
            const wrapper = parent.createDiv({ attr: { style: `position: relative; display: flex; flex-direction: column; padding: 6px 8px;${isMain ? topBorder : ' border-left: 1px solid var(--background-modifier-border);' + topBorder}` } });
            if (isMissing) wrapper.createDiv({ text: '⚠ Missing', attr: { style: 'font-size: 9px; font-weight: 600; color: var(--text-error); text-transform: uppercase; letter-spacing: 0.5px; padding: 0 2px 3px;' } });
            const area = wrapper.createEl('textarea', {
                cls: 'po-grid-input',
                attr: { style: `width: 100%; min-height: 48px; background: ${bg}; border: 1px solid transparent; border-radius: 6px; font-size: 13px; resize: none; padding: 8px 10px; transition: background 0.15s, border-color 0.15s;${readOnly ? ' opacity: 0.75; cursor: default;' : ''}` },
            });
            area.value = value;
            if (readOnly) {
                area.readOnly = true;
            } else {
                const editIcon = wrapper.createDiv({ attr: { style: 'position: absolute; top: 10px; right: 14px; opacity: 0; transition: opacity 0.15s; pointer-events: none; color: var(--text-muted);' } });
                setIcon(editIcon, 'pencil');
                area.onfocus = () => { area.style.background = 'var(--background-primary)'; area.style.borderColor = 'var(--interactive-accent)'; editIcon.style.opacity = '0'; };
                area.onblur = () => { area.style.background = bg; area.style.borderColor = 'transparent'; };
                wrapper.onmouseenter = () => { if (document.activeElement !== area) { editIcon.style.opacity = '0.5'; area.style.borderColor = 'var(--background-modifier-border)'; } };
                wrapper.onmouseleave = () => { editIcon.style.opacity = '0'; if (document.activeElement !== area) area.style.borderColor = 'transparent'; };
                area.onchange = () => onChange(area.value);
                renderChips(wrapper, placeholders, area, onChange);
            }
            return area;
        };

        const makePluralCell = (
            parent: HTMLElement,
            pluralValues: string[],
            labels: string[],
            isMain: boolean,
            onChange: (i: number, v: string) => void,
            placeholders: string[] = [],
            isMissing: boolean = false,
            isSource: boolean = false,
            readOnly: boolean = false,
        ): void => {
            const bg = isMain
                ? 'var(--background-secondary-alt)'
                : isMissing ? 'rgba(var(--color-red-rgb, 220,60,60), 0.07)' : 'var(--background-secondary)';
            const topBorder = isSource ? ' border-top: 2px solid var(--interactive-accent);' : ' border-top: 2px solid transparent;';
            const cell = parent.createDiv({ attr: { style: `display: flex; flex-direction: column; gap: 4px; padding: 6px 8px;${isMain ? topBorder : ' border-left: 1px solid var(--background-modifier-border);' + topBorder}` } });
            if (isMissing) cell.createDiv({ text: '⚠ Missing', attr: { style: 'font-size: 9px; font-weight: 600; color: var(--text-error); text-transform: uppercase; letter-spacing: 0.5px; padding: 0 2px 2px;' } });
            pluralValues.forEach((val, i) => {
                const wrap = cell.createDiv({ attr: { style: `display: flex; flex-direction: column; background: ${bg}; border: 1px solid transparent; border-radius: 6px; transition: border-color 0.15s;${readOnly ? ' opacity: 0.75;' : ''}` } });
                wrap.createDiv({ text: labels[i] ?? `[${i}]`, attr: { style: 'font-size: 9px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; padding: 4px 10px 0; letter-spacing: 0.5px;' } });
                const area = wrap.createEl('textarea', {
                    cls: 'po-grid-input',
                    attr: { style: `width: 100%; min-height: 32px; background: transparent; border: none; font-size: 13px; resize: none; padding: 2px 10px 6px; outline: none;${readOnly ? ' cursor: default;' : ''}` },
                });
                area.value = val;
                if (readOnly) {
                    area.readOnly = true;
                } else {
                    area.onfocus = () => { wrap.style.borderColor = 'var(--interactive-accent)'; wrap.style.background = 'var(--background-primary)'; };
                    area.onblur = () => { wrap.style.borderColor = 'transparent'; wrap.style.background = bg; };
                    area.onmouseenter = () => { if (document.activeElement !== area) wrap.style.borderColor = 'var(--background-modifier-border)'; };
                    area.onmouseleave = () => { if (document.activeElement !== area) wrap.style.borderColor = 'transparent'; };
                    area.onchange = () => onChange(i, area.value);
                    renderChips(wrap, placeholders, area, (v) => onChange(i, v));
                }
            });
        };

        const renderRows = (term: string = '') => {
            container.empty();
            const entries = this.mainPoFile!.entries;
            const isTranslated = (e: POEntry) =>
                e.msgstr.trim() !== '' || (e.msgstrPlural?.some(s => s.trim() !== '') ?? false);
            let filtered = entries;
            switch (this.activeFilter) {
                case 'untranslated': filtered = entries.filter(e => {
                    if (!isTranslated(e)) return true;
                    if (this.isProjectMode) {
                        return this.siblingPoFiles.some(spf => {
                            const sib = spf.poFile.entries.find(s => s.msgid === e.msgid && s.msgctxt === e.msgctxt);
                            return !sib || !isTranslated(sib);
                        });
                    }
                    return false;
                }); break;
                case 'translated':   filtered = entries.filter(e => isTranslated(e)); break;
                case 'fuzzy':        filtered = entries.filter(e => e.flags.includes('fuzzy')); break;
                default:
                    if (this.activeFilter !== 'all') {
                        filtered = entries.filter(e => e.flags.includes(this.activeFilter as any));
                    }
                    break;
            }
            if (this.activeContext) {
                filtered = filtered.filter(e => e.msgctxt === this.activeContext);
            }
            if (term) {
                const t = term.toLowerCase();
                filtered = filtered.filter(e => e.msgid.toLowerCase().includes(t) || e.msgstr.toLowerCase().includes(t));
            }
            const isPOT = this.isPOTFile;
            const languages = isPOT ? [] : [{ id: 'main', label: this.mainPoFile!.header.metadata['Language'] || 'Current' }, ...(this.isProjectMode ? this.siblingPoFiles.map((s, i) => ({ id: `spf-${i}`, label: s.language })) : [])];
            const gridTemplate = isPOT ? '1fr 80px' : `250px repeat(${languages.length}, 1fr) 120px`;

            const sourceLang = this.isProjectMode ? this.getSourceLanguage() : (this.mainPoFile!.header.metadata['Language'] || '');
            const headerRow = container.createDiv({ cls: 'po-entry-item', attr: { style: `background: var(--background-secondary); font-weight: bold; grid-template-columns: ${gridTemplate}; padding: 10px 16px;` } });
            headerRow.createDiv({ text: 'Source' });
            languages.forEach(l => {
                const isSource = l.label === sourceLang || (!this.isProjectMode && l.id === 'main');
                const cell = headerRow.createDiv({ attr: { style: 'display: flex; align-items: center; justify-content: center; gap: 5px;' } });
                if (isSource) {
                    const iconEl = cell.createDiv({ attr: { style: 'color: var(--interactive-accent); flex-shrink: 0;' } });
                    setIcon(iconEl, 'shield-check');
                    cell.createSpan({ text: l.label, attr: { style: 'color: var(--interactive-accent); font-weight: 700;' } });
                } else {
                    cell.createSpan({ text: l.label });
                }
            });
            headerRow.createDiv();

            filtered.forEach((entry) => {
                const item = container.createDiv({ cls: 'po-entry-item', attr: { style: `grid-template-columns: ${gridTemplate}; border-bottom: 1px solid var(--background-modifier-border); padding: 4px 16px; align-items: stretch;` } });
                if (entry.flags.includes('fuzzy')) item.addClass('po-entry-fuzzy');

                // Source cell with inline translator comment
                const sourceCell = item.createDiv({ attr: { style: 'padding: 10px 12px 10px 0; border-right: 1px solid var(--background-modifier-border); display: flex; flex-direction: column; gap: 6px;' } });
                if (entry.msgctxt) sourceCell.createEl('span', { text: entry.msgctxt, attr: { style: 'font-size: 9px; color: var(--text-accent); text-transform: uppercase;' } });
                sourceCell.createEl('div', { text: entry.msgid, attr: { style: 'font-weight: 500; font-size: 13px;' } });

                // Inline translator comment
                const commentWrap = sourceCell.createDiv({ attr: { style: 'display: flex; align-items: flex-start; gap: 4px; border-top: 1px solid var(--background-modifier-border); padding-top: 6px;' } });
                const commentIcon = commentWrap.createDiv({ attr: { style: 'color: var(--text-muted); opacity: 0.5; flex-shrink: 0; margin-top: 1px;' } });
                setIcon(commentIcon, 'message-circle');
                const commentArea = commentWrap.createEl('textarea', {
                    attr: {
                        placeholder: 'Translator comment...',
                        style: 'flex: 1; font-size: 10px; color: var(--text-muted); font-style: italic; background: transparent; border: none; resize: none; min-height: 18px; max-height: 60px; line-height: 1.4; font-family: inherit; padding: 0; outline: none; overflow: hidden;',
                    }
                });
                commentArea.value = entry.comments?.translator || '';
                commentArea.onfocus = () => {
                    commentArea.style.color = 'var(--text-normal)';
                    commentArea.style.fontStyle = 'normal';
                    commentIcon.style.opacity = '1';
                };
                commentArea.onblur = () => {
                    commentArea.style.color = 'var(--text-muted)';
                    commentArea.style.fontStyle = 'italic';
                    commentIcon.style.opacity = '0.5';
                    const newComment = commentArea.value.trim() || undefined;
                    if (newComment !== (entry.comments?.translator || undefined)) {
                        if (!this.mainPoFile) return;
                        this.mainPoFile = updateEntry(this.mainPoFile, entry.msgid, (current) =>
                            createPOEntry(current.msgid, current.msgstr, {
                                ...current,
                                comments: { ...current.comments, translator: newComment },
                            })
                        );
                        this.requestSave();
                        this.render();
                    }
                };

                // Detect placeholders once per entry (from source msgid)
                const placeholders = detectPlaceholders(entry.msgid);
                const mainLang = this.mainPoFile!.header.metadata['Language'] || this.file!.basename;

                // Translation cells — hidden for POT files
                if (!isPOT) {
                    if (entry.msgidPlural) {
                        const nplurals = this.getNplurals();
                        const labels = getPluralFormLabels(nplurals);
                        const pluralValues = Array.from({ length: nplurals }, (_, i) => entry.msgstrPlural?.[i] ?? '');
                        makePluralCell(item, pluralValues, labels, true, (i, v) => {
                            if (!this.mainPoFile) return;
                            this.mainPoFile = updateEntry(this.mainPoFile, entry.msgid, (e) => {
                                const updated = [...(e.msgstrPlural ?? Array(nplurals).fill(''))];
                                updated[i] = v;
                                return createPOEntry(e.msgid, e.msgstr, { ...e, msgstrPlural: updated });
                            });
                            this.requestSave();
                        }, placeholders, false, mainLang === sourceLang);
                    } else {
                        makeLangCell(item, entry.msgstr, true, (v) => {
                            if (!this.mainPoFile) return;
                            this.mainPoFile = updateEntry(this.mainPoFile, entry.msgid, (e) =>
                                createPOEntry(e.msgid, v, e)
                            );
                            this.requestSave();
                        }, placeholders, false, mainLang === sourceLang);
                    }
                }

                // Sibling translation cells — never shown for POT
                if (!isPOT && this.isProjectMode) {
                    this.siblingPoFiles.forEach(spf => {
                        const siblingEntry = spf.poFile.entries.find(e => e.msgid === entry.msgid && e.msgctxt === entry.msgctxt);
                        const sibLang = spf.language;
                        if (entry.msgidPlural) {
                            const sibNplurals = parseNplurals(spf.poFile.header.metadata['Plural-Forms'] ?? '');
                            const sibLabels = getPluralFormLabels(sibNplurals);
                            const pluralValues = Array.from({ length: sibNplurals }, (_, i) => siblingEntry?.msgstrPlural?.[i] ?? '');
                            makePluralCell(item, pluralValues, sibLabels, false, async (i, v) => {
                                const updated = [...(siblingEntry?.msgstrPlural ?? Array(sibNplurals).fill(''))];
                                updated[i] = v;
                                if (siblingEntry) {
                                    spf.poFile = updateEntry(spf.poFile, entry.msgid, (e) =>
                                        createPOEntry(e.msgid, e.msgstr, { ...e, msgidPlural: entry.msgidPlural, msgstrPlural: updated })
                                    );
                                } else {
                                    spf.poFile = addEntry(spf.poFile, createPOEntry(entry.msgid, '', { msgctxt: entry.msgctxt, msgidPlural: entry.msgidPlural, msgstrPlural: updated, comments: {}, flags: [], obsolete: false }));
                                }
                                await this.saveProjectFile(spf);
                            }, placeholders, !siblingEntry, sibLang === sourceLang);
                        } else {
                            makeLangCell(item, siblingEntry?.msgstr ?? '', false, async (v) => {
                                if (siblingEntry) {
                                    spf.poFile = updateEntry(spf.poFile, entry.msgid, (e) =>
                                        createPOEntry(e.msgid, v, e)
                                    );
                                } else {
                                    spf.poFile = addEntry(spf.poFile, createPOEntry(entry.msgid, v, { msgctxt: entry.msgctxt, comments: {}, flags: [], obsolete: false }));
                                }
                                await this.saveProjectFile(spf);
                            }, placeholders, !siblingEntry, sibLang === sourceLang);
                        }
                    });
                }

                const actions = item.createDiv({ attr: { style: 'display: flex; flex-direction: column; gap: 6px; padding: 8px 0; padding-left: 12px; border-left: 1px solid var(--background-modifier-border); align-items: flex-end; justify-content: flex-start;' } });

                // Row 1: management
                const mgmtGroup = actions.createDiv({ attr: { style: 'display: flex; gap: 3px;' } });
                const editBtn = mgmtGroup.createEl('button', { cls: 'btn btn-sm' }); setIcon(editBtn, 'pencil');
                editBtn.onclick = () => this.openEditEntryModal(entry);
                const delBtn = mgmtGroup.createEl('button', { cls: 'btn btn-sm', attr: { style: 'color: var(--text-error);' } }); setIcon(delBtn, 'trash');
                delBtn.onclick = () => this.deleteEntry(entry);

                // Row 2: flags + comments — hidden for POT
                if (!isPOT) {
                    const tagsStack = actions.createDiv({ attr: { style: 'display: flex; flex-direction: column; gap: 3px; align-items: flex-end;' } });

                    const flagQAs = this.plugin.settings.quickActions.filter((qa: CustomAction) => !!qa.flag);
                    const flagsGroup = tagsStack.createDiv({ attr: { style: 'display: flex; gap: 3px; flex-wrap: wrap; justify-content: flex-end;' } });
                    const isFuzzy = entry.flags.includes('fuzzy');
                    const fuzzyBtn = flagsGroup.createEl('button', { cls: 'btn btn-sm', text: 'F', attr: { title: 'Fuzzy', style: `width: 20px; height: 20px; padding: 0; font-size: 9px; font-weight: bold; background: ${isFuzzy ? '#f39c12' : 'transparent'}; color: ${isFuzzy ? 'white' : '#f39c12'}; border-color: ${isFuzzy ? 'transparent' : 'var(--background-modifier-border)'};` } });
                    fuzzyBtn.onclick = () => this.toggleFuzzy(entry);
                    flagQAs.forEach((qa: CustomAction) => {
                        const isActive = entry.flags.includes(qa.flag as 'fuzzy');
                        const btn = flagsGroup.createEl('button', { cls: 'btn btn-sm', text: qa.label.charAt(0), attr: { title: qa.label, style: `width: 20px; height: 20px; padding: 0; font-size: 9px; background: ${isActive ? (qa.color || 'var(--interactive-accent)') : 'transparent'}; color: ${isActive ? 'white' : (qa.color || 'var(--text-muted)')}; border-color: ${isActive ? 'transparent' : 'var(--background-modifier-border)'};` } });
                        btn.onclick = () => this.applyQuickAction(entry, qa);
                    });

                    const commentQAs = this.plugin.settings.quickActions.filter((qa: CustomAction) => !!qa.comment && !qa.flag);
                    if (commentQAs.length > 0) {
                        const commentsGroup = tagsStack.createDiv({ attr: { style: 'display: flex; gap: 3px; flex-wrap: wrap; justify-content: flex-end;' } });
                        commentQAs.forEach((qa: CustomAction) => {
                            const isActive = entry.comments?.translator === qa.comment;
                            const btn = commentsGroup.createEl('button', { cls: 'btn btn-sm', text: qa.label.charAt(0), attr: { title: qa.label, style: `width: 20px; height: 20px; padding: 0; font-size: 9px; background: ${isActive ? (qa.color || 'var(--interactive-accent)') : 'transparent'}; color: ${isActive ? 'white' : (qa.color || 'var(--text-muted)')}; border-color: ${isActive ? 'transparent' : 'var(--background-modifier-border)'};` } });
                            btn.onclick = () => this.applyQuickAction(entry, qa);
                        });
                    }
                }
            });
        };
        searchInput.oninput = () => renderRows(searchInput.value);
        renderRows();
    }

    private toggleFuzzy(entry: POEntry): void {
        if (!this.mainPoFile) return;
        this.mainPoFile = updateEntry(this.mainPoFile, entry.msgid, (current) => {
            const hasFuzzy = current.flags.includes('fuzzy' as any);
            const flags = hasFuzzy
                ? current.flags.filter(f => f !== ('fuzzy' as any))
                : [...current.flags, 'fuzzy' as any];
            return createPOEntry(current.msgid, current.msgstr, { ...current, flags });
        });
        this.requestSave();
        this.render();
    }

    private applyQuickAction(entry: POEntry, action: CustomAction): void {
        if (!this.mainPoFile) return;
        this.mainPoFile = updateEntry(this.mainPoFile, entry.msgid, (current) => {
            let flags = [...current.flags];
            const comments = { ...current.comments };
            if (action.flag) {
                if (flags.includes(action.flag as any)) flags = flags.filter(f => f !== action.flag);
                else flags.push(action.flag as any);
            }
            if (action.comment) {
                if (comments.translator === action.comment) delete comments.translator;
                else comments.translator = action.comment;
            }
            return createPOEntry(current.msgid, current.msgstr, { ...current, flags, comments });
        });
        this.requestSave();
        this.render();
    }

    private async saveProjectFile(projFile: ProjectFile): Promise<void> {
        await this.app.vault.modify(projFile.file, this.poConverter.compile(projFile.poFile));
        projFile.stats = getStatistics(projFile.poFile);
        new Notice(`Saved ${projFile.language}`);
        this.render();
    }

    private getSourceLanguage(): string {
        const folderPath = this.file?.parent?.path ?? '/';
        return this.plugin.settings.projectSourceLanguages[folderPath]
            ?? this.mainPoFile?.header.metadata['Language']
            ?? this.file?.basename
            ?? '';
    }

    private async setSourceLanguage(lang: string): Promise<void> {
        const folderPath = this.file?.parent?.path ?? '/';
        this.plugin.settings.projectSourceLanguages = {
            ...this.plugin.settings.projectSourceLanguages,
            [folderPath]: lang,
        };
        await this.plugin.saveSettings();
        this.render();
    }

    private getNplurals(): number {
        const pluralForms = this.mainPoFile?.header.metadata['Plural-Forms'] ?? '';
        return parseNplurals(pluralForms);
    }

    private getCurrentLanguage(): string {
        return this.mainPoFile?.header.metadata['Language'] ?? 'en';
    }

    private updateFileHeader(updates: Record<string, string>): void {
        if (!this.mainPoFile) return;
        this.mainPoFile = {
            ...this.mainPoFile,
            header: {
                ...this.mainPoFile.header,
                metadata: { ...this.mainPoFile.header.metadata, ...updates },
            },
        };
        this.requestSave();
    }

    private openAddEntryModal(): void {
        new POEntryModal(
            this.app, undefined,
            (updatedEntry) => {
                if (!this.mainPoFile) return;
                this.mainPoFile = addEntry(this.mainPoFile, updatedEntry);
                this.requestSave();
                this.render();
            },
            this.plugin.settings.quickActions,
            this.getNplurals(),
            this.getCurrentLanguage(),
            (updates) => this.updateFileHeader(updates),
            this.isPOTFile,
        ).open();
    }

    private openEditEntryModal(entry: POEntry): void {
        new POEntryModal(
            this.app, entry,
            (updatedEntry) => {
                if (!this.mainPoFile) return;
                this.mainPoFile = updateEntry(this.mainPoFile, entry.msgid, () => updatedEntry);
                this.requestSave();
                this.render();
            },
            this.plugin.settings.quickActions,
            this.getNplurals(),
            this.getCurrentLanguage(),
            (updates) => this.updateFileHeader(updates),
            this.isPOTFile,
        ).open();
    }

    private deleteEntry(entry: POEntry): void {
        if (!this.mainPoFile) return;
        this.mainPoFile = removeEntry(this.mainPoFile, entry.msgid);
        this.requestSave();
        this.render();
    }

    private async generatePOT(): Promise<void> {
        if (!this.file || !this.mainPoFile) return;

        const sourceLang = this.getSourceLanguage();
        const mainLang = this.mainPoFile.header.metadata['Language'] || this.file.basename;

        let sourcePoFile: POFile;
        let sourceBasename: string;
        if (mainLang === sourceLang || !this.isProjectMode) {
            sourcePoFile = this.mainPoFile;
            sourceBasename = this.file.basename.replace(/\.po$/, '');
        } else {
            const sourceSibling = this.siblingPoFiles.find(s => s.language === sourceLang);
            if (!sourceSibling) { new Notice('Source language file not found'); return; }
            sourcePoFile = sourceSibling.poFile;
            sourceBasename = sourceSibling.file.basename.replace(/\.po$/, '');
        }

        const potEntries = sourcePoFile.entries.map(e => {
            const nPlurals = e.msgstrPlural?.length ?? (e.msgidPlural ? 2 : 0);
            return createPOEntry(e.msgid, '', {
                msgctxt: e.msgctxt,
                msgidPlural: e.msgidPlural,
                msgstrPlural: e.msgidPlural ? Array(Math.max(nPlurals, 1)).fill('') : undefined,
                comments: { extracted: e.comments.extracted, reference: e.comments.reference },
                flags: [],
                obsolete: false,
            });
        });

        const potFile: POFile = {
            charset: 'utf-8',
            header: {
                content: '',
                metadata: {
                    'Content-Type': 'text/plain; charset=UTF-8',
                    'Content-Transfer-Encoding': '8bit',
                    'POT-Creation-Date': new Date().toISOString().replace(/\.\d{3}Z$/, '+0000'),
                    'MIME-Version': '1.0',
                    'X-Generator': 'Obsidian PO Editor',
                },
            },
            entries: potEntries,
            obsolete: [],
        };

        const folderPath = this.file.parent!.path;
        const potPath = (folderPath === '/' ? '' : folderPath + '/') + sourceBasename + '.pot';
        try {
            const existing = this.app.vault.getAbstractFileByPath(potPath);
            if (existing instanceof TFile) {
                await this.app.vault.modify(existing, this.poConverter.compile(potFile));
            } else {
                await this.app.vault.create(potPath, this.poConverter.compile(potFile));
            }
            new Notice(`POT generated: ${potPath}`);
        } catch {
            new Notice('Failed to generate POT file');
        }
    }

    private async synchronizeEntries(): Promise<void> {
        if (!this.mainPoFile || !this.isProjectMode) return;

        const sourceLang = this.getSourceLanguage();
        const mainLang = this.mainPoFile.header.metadata['Language'] || this.file?.basename || '';

        let sourceEntries: POEntry[];
        if (mainLang === sourceLang) {
            sourceEntries = this.mainPoFile.entries;
        } else {
            const sourceSibling = this.siblingPoFiles.find(s => s.language === sourceLang);
            sourceEntries = sourceSibling?.poFile.entries ?? this.mainPoFile.entries;
        }

        let syncCount = 0;

        // Sync non-source siblings
        for (const spf of this.siblingPoFiles) {
            if (spf.language === sourceLang) continue;
            const tgtNplurals = parseNplurals(spf.poFile.header.metadata['Plural-Forms'] ?? '');
            let changed = false;
            for (const src of sourceEntries) {
                if (spf.poFile.entries.find(e => e.msgid === src.msgid && e.msgctxt === src.msgctxt)) continue;
                spf.poFile = addEntry(spf.poFile, createPOEntry(src.msgid, '', {
                    msgctxt: src.msgctxt,
                    msgidPlural: src.msgidPlural,
                    msgstrPlural: src.msgidPlural ? Array(Math.max(1, tgtNplurals)).fill('') : undefined,
                    comments: {},
                    flags: [],
                    obsolete: false,
                }));
                syncCount++;
                changed = true;
            }
            if (changed) {
                await this.app.vault.modify(spf.file, this.poConverter.compile(spf.poFile));
                spf.stats = getStatistics(spf.poFile);
            }
        }

        // Sync main file if not source
        if (mainLang !== sourceLang) {
            const mainNplurals = this.getNplurals();
            let changed = false;
            for (const src of sourceEntries) {
                if (this.mainPoFile.entries.find(e => e.msgid === src.msgid && e.msgctxt === src.msgctxt)) continue;
                this.mainPoFile = addEntry(this.mainPoFile, createPOEntry(src.msgid, '', {
                    msgctxt: src.msgctxt,
                    msgidPlural: src.msgidPlural,
                    msgstrPlural: src.msgidPlural ? Array(Math.max(1, mainNplurals)).fill('') : undefined,
                    comments: {},
                    flags: [],
                    obsolete: false,
                }));
                syncCount++;
                changed = true;
            }
            if (changed) this.requestSave();
        }

        new Notice(syncCount > 0 ? `Synced ${syncCount} missing entr${syncCount > 1 ? 'ies' : 'y'}` : 'Already in sync');
        this.render();
    }

    private openExportModal(): void {
        new ConvertModal(this.app, 'export', async (result) => {
            if (!this.mainPoFile || !this.file) return;

            // Strip all translations before export
            const stripped: POFile = {
                ...this.mainPoFile,
                entries: this.mainPoFile.entries.map(e => createPOEntry(e.msgid, '', {
                    msgctxt: e.msgctxt,
                    msgidPlural: e.msgidPlural,
                    msgstrPlural: e.msgidPlural ? ['', ''] : undefined,
                    comments: e.comments,
                    flags: e.flags,
                    obsolete: e.obsolete,
                })),
            };

            const convertUseCase = new ConvertToFormatUseCase([
                new POConverter(), new XLIFFConverter(), new ARBConverter(),
                new JsonConverter(), new YamlConverter(), new ICUConverter(),
            ]);
            const converted = convertUseCase.execute({ poFile: stripped, targetFormat: result.format });
            if (!converted.success || !converted.content) {
                new Notice(`Export failed: ${converted.error}`);
                return;
            }

            const ext = result.format === 'arb' ? 'arb' : result.format === 'json' || result.format === 'icu' ? 'json' : result.format === 'yaml' ? 'yaml' : result.format.startsWith('xliff') ? 'xliff' : result.format;
            const fileName = result.fileName || `${this.file.basename}.${ext}`;
            const folderPath = this.file.parent!.path;
            const outPath = (folderPath === '/' ? '' : folderPath + '/') + fileName;
            try {
                const existing = this.app.vault.getAbstractFileByPath(outPath);
                if (existing instanceof TFile) {
                    await this.app.vault.modify(existing, converted.content);
                } else {
                    await this.app.vault.create(outPath, converted.content);
                }
                new Notice(`Exported: ${outPath}`);
            } catch {
                new Notice('Export failed: could not write file');
            }
        }, () => this.generatePOT()).open();
    }
}
