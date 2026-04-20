import { Notice, App, Modal } from 'obsidian';

export type NotificationLevel = 'info' | 'success' | 'warning' | 'error';

export interface Notifier {
    notify(message: string, level?: NotificationLevel, duration?: number): void;
    showModal(modal: Modal): void;
    confirm(message: string, onConfirm: () => void, onCancel?: () => void): void;
}

export class ObsidianNotifier implements Notifier {
    private app: App;
    
    constructor(app: App) {
        this.app = app;
    }
    
    notify(message: string, level: NotificationLevel = 'info', duration: number = 5000): void {
        const prefix = this.getPrefix(level);
        const fullMessage = `[PO Editor] ${prefix}${message}`;
        
        new Notice(fullMessage, duration);
    }
    
    private getPrefix(level: NotificationLevel): string {
        switch (level) {
            case 'success': return '✓ ';
            case 'warning': return '⚠ ';
            case 'error': return '✗ ';
            default: return '';
        }
    }
    
    showModal(modal: Modal): void {
        modal.open();
    }
    
    confirm(message: string, onConfirm: () => void, onCancel?: () => void): void {
        const modal = new ConfirmModal(this.app, message, onConfirm, onCancel);
        modal.open();
    }
    
    success(message: string): void {
        this.notify(message, 'success');
    }
    
    warning(message: string): void {
        this.notify(message, 'warning', 8000);
    }
    
    error(message: string): void {
        this.notify(message, 'error', 10000);
    }
    
    info(message: string): void {
        this.notify(message, 'info');
    }
}

class ConfirmModal extends Modal {
    private message: string;
    private onConfirm: () => void;
    private onCancel: () => void;
    
    constructor(
        app: App,
        message: string,
        onConfirm: () => void,
        onCancel?: () => void
    ) {
        super(app);
        this.message = message;
        this.onConfirm = onConfirm;
        this.onCancel = onCancel ?? (() => {});
    }
    
    onOpen(): void {
        const { contentEl } = this;
        
        contentEl.createEl('p', {
            text: this.message,
            cls: 'confirm-modal-message',
        });
        
        const buttonContainer = contentEl.createDiv({
            cls: 'confirm-modal-buttons',
        });
        
        buttonContainer.createEl('button', {
            text: 'Cancel',
            cls: 'btn',
        }).onclick = () => {
            this.onCancel();
            this.close();
        };
        
        buttonContainer.createEl('button', {
            text: 'Confirm',
            cls: 'btn btn-primary',
        }).onclick = () => {
            this.onConfirm();
            this.close();
        };
    }
    
    onClose(): void {
        this.contentEl.empty();
    }
}

export function createNotifier(app: App): ObsidianNotifier {
    return new ObsidianNotifier(app);
}