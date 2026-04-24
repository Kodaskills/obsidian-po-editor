export type NotificationLevel = "info" | "success" | "warning" | "error";

export interface NotificationPort {
  notify(message: string, level?: NotificationLevel, duration?: number): void;
  // Aliases for common notification levels
  success(message: string): void;
  warning(message: string): void;
  error(message: string): void;
  info(message: string): void;
}
