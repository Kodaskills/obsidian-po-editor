export type NotificationLevel = "info" | "success" | "warning" | "error";

export interface Notifier {
  notify(message: string, level?: NotificationLevel, duration?: number): void;
  success(message: string): void;
  warning(message: string): void;
  error(message: string): void;
  info(message: string): void;
}
