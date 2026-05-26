import { POTextEditor } from "@/presentation/editor/POTextEditor";

import type { POViewActions } from "./POViewTypes";

export class POTextModeRenderer {
  constructor(private readonly actions: POViewActions) {}

  render(root: HTMLElement, content: string, editable = false): POTextEditor {
    const container = root.createDiv({ cls: "po-text-mode-container" });
    const editorContainer = container.createDiv({ cls: "po-text-mode-editor" });
    return new POTextEditor(editorContainer, content, undefined, editable);
  }
}
