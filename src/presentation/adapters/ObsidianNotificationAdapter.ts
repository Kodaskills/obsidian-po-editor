import { type NotificationLevel, type NotificationPort } from "@application/index";
import { Notice } from "obsidian";

export class ObsidianNotificationAdapter implements NotificationPort {
  notify(message: string, level: NotificationLevel = "info", duration = 5000): void {
    const prefix = this.getPrefix(level);
    new Notice(`[PO Editor] ${prefix}${message}`, duration);
  }

  private getPrefix(level: NotificationLevel): string {
    switch (level) {
      case "success":
        return "✓ ";
      case "warning":
        return "⚠ ";
      case "error":
        return "✗ ";
      default:
        return "ℹ ";
    }
  }

  success(message: string): void {
    this.notify(message, "success");
  }

  warning(message: string): void {
    this.notify(message, "warning", 8000);
  }

  error(message: string): void {
    this.notify(message, "error", 10000);
  }

  info(message: string): void {
    this.notify(message, "info");
  }
}
