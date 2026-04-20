import { Plugin, Notice, TFile } from 'obsidian';
import {
    POSettingsTab,
    POEditorSettings,
    DEFAULT_SETTINGS,
    POView,
    createCreatePOCommand,
    createValidatePOCommand
} from './presentation';

export default class POEditorPlugin extends Plugin {
    settings!: POEditorSettings;

    async onload() {
        await this.loadSettings();

        // Add Ribbon Icon to Sidebar
        this.addRibbonIcon('languages', 'Create New PO File', () => {
            const command = createCreatePOCommand(this.app, this);
            command.showDialog();
        });

        // Add to File Explorer Context Menu
        this.registerEvent(
            this.app.workspace.on('file-menu', (menu, file) => {
                menu.addItem((item) => {
                    item.setTitle('New PO File')
                        .setIcon('languages')
                        .onClick(() => {
                            const command = createCreatePOCommand(this.app, this);
                            // If clicked on a folder, we could potentially pass it to the command
                            command.showDialog();
                        });
                });
            })
        );

        this.registerView('po-view', (leaf) => new POView(leaf, this));
        this.registerExtensions(['po', 'pot'], 'po-view');

        this.addSettingTab(new POSettingsTab(this.app, this));

        this.registerCommands();

    }

    private registerCommands() {
        this.addCommand({
            id: 'po-create',
            name: 'Create PO File',
            callback: () => {
                const command = createCreatePOCommand(this.app, this);
                command.showDialog();
            }
        });

        this.addCommand({
            id: 'po-view-active',
            name: 'View Active PO File',
            callback: async () => {
                const file = this.app.workspace.getActiveFile();
                if (!file || file.extension !== 'po') {
                    new Notice('Open a .po file first');
                    return;
                }
                const leaf = this.app.workspace.getLeaf('tab');
                await leaf.openFile(file);
            }
        });

        this.addCommand({
            id: 'po-validate',
            name: 'Validate PO File',
            callback: async () => {
                const command = createValidatePOCommand(this.app, this);
                await command.execute();
            }
        });
    }

    async onunload() {}

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}
