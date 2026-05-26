export interface Confirmer {
  confirm(message: string): Promise<boolean>;
}
