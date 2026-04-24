export interface ConfirmationPort {
  confirm(message: string): Promise<boolean>;
}
