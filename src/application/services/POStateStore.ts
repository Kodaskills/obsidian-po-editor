import { type POFile } from "@domain/index";

type Subscriber = (poFile: POFile) => void;

/**
 * Unified reactive state store for PO file data.
 */
export class POStateStore {
  private poFile: POFile | null = null;
  private subscribers: Subscriber[] = [];

  constructor(initialFile?: POFile) {
    if (initialFile) {
      this.poFile = initialFile;
    }
  }

  get state(): POFile | null {
    return this.poFile;
  }

  setState(newPOFile: POFile): void {
    this.poFile = newPOFile;
    this.notify();
  }

  subscribe(callback: Subscriber): () => void {
    this.subscribers.push(callback);
    if (this.poFile) {
      callback(this.poFile);
    }
    return () => {
      this.subscribers = this.subscribers.filter((s) => s !== callback);
    };
  }

  private notify(): void {
    if (!this.poFile) return;
    for (const callback of this.subscribers) {
      callback(this.poFile);
    }
  }
}
