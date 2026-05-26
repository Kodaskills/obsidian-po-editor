import type { ParsePOOutput, POEntryFilter } from "@application/index";
import type { POEntry, POFile, POPluralEntry, POStatistics } from "@domain/index";
import type { TFile } from "obsidian";

import type { CustomAction } from "@/presentation/settings/POSettingsTab";

export const PO_ROW_HEIGHT = 40;
export const NEW_ENTRY_SENTINEL = "__new_entry__" as const;

export interface LanguageStat {
  name: string;
  stats: POStatistics;
  isSource: boolean;
  isPOT?: boolean;
}

export interface FilterOptions {
  totalEntries: number;
  untranslatedCount: number;
  translatedCount: number;
  fuzzyCount: number;
  obsoleteCount: number;
  flagOptions: { flag: string; label: string; count: number }[];
  commentOptions: { comment: string; label: string; count: number }[];
  contextOptions: { context: string; count: number }[];
  languageOptions?: { language: string; isSource: boolean }[];
  typeOptions: { type: string; label: string; count: number }[];
  current: {
    includedStatuses: string[];
    includedFlags: string[];
    includedComments: string[];
    includedContexts: string[];
    includedLanguages: string[];
    includedTypes: string[];
  };
}

export type FilterChangeCallback = (
  key:
    | "includedStatuses"
    | "includedFlags"
    | "includedComments"
    | "includedContexts"
    | "includedLanguages"
    | "includedTypes",
  values: string[],
) => void;

export interface ProjectFile {
  file: TFile;
  poFile: POFile;
  language: string;
  stats: POStatistics;
}

export type EditorMode = "grid" | "text";
export type EditorPanelState = "half" | "full" | "closed" | "overlay";
export type EditorPanelPosition = "bottom" | "top" | "left" | "right";

export interface FileEditorState {
  selectedEntryKey: string | null;
  scrollIndex: number;
  editorPanelState: EditorPanelState;
}

export interface POEntryItem {
  id: string;
  entry: POEntry;
  [key: string]: unknown;
}

export interface POViewFilterState {
  includedStatuses: string[];
  includedFlags: string[];
  includedComments: string[];
  includedContexts: string[];
  includedLanguages: string[];
  includedTypes: string[];
  activeSearch: string;
  fuzzyOnly: boolean;
  missingOnly: boolean;
}

export interface POViewSnapshot {
  file: TFile;
  mainPoFile: POFile;
  siblingPoFiles: ProjectFile[];
  isPOTFile: boolean;
  filters: POViewFilterState;
  editorPanelState: EditorPanelState;
  editorPanelPosition: EditorPanelPosition;
  editorPanelHeightPercent: number;
  quickActions: CustomAction[];
}

export interface POViewQueries {
  getSnapshot(): POViewSnapshot;
  getFilteredEntries(): POEntry[];
  getSourceLanguage(): string;
  getLanguageStats(): LanguageStat[];
  getFilterOptions(): FilterOptions | null;
  buildFilter(): POEntryFilter;
  detectPlaceholders(text: string): string[];
  resolveReferenceText(entry: POEntry): string | string[] | undefined;
}

export interface PONavigationActions {
  selectEntry(entry: POEntry, fromClick?: boolean): void;
  navigateEntry(direction: -1 | 1, currentValue: string): void;
  navigateNextCommand(): void;
  navigatePreviousCommand(): void;
  navigateNextUntranslated(): void;
  confirmAndNextUntranslated(): void;
}

export interface POEntryActions {
  addEntry(): void;
  deleteEntry(entry: POEntry): void;
  markObsolete(entry: POEntry): void;
  toggleFuzzy(entry: POEntry): void;
  convertToPlural(entry: POEntry): void;
  convertToSingular(entry: POEntry): void;
  resizePluralForms(entry: POPluralEntry, count: number): void;
  setLanguagePluralForms(language: string): void;
  updateMsgid(entry: POEntry, newMsgid: string): void;
  updateMsgidPlural(entry: POPluralEntry, newMsgidPlural: string): void;
  updateMsgctxt(entry: POEntry, msgctxt: string | undefined): void;
  applyQuickAction(entry: POEntry, action: CustomAction): void;
}

export interface POTranslationActions {
  saveCurrentTranslation(value: string, advance: boolean, pluralIndex?: number): void;
  updateTranslatorComment(entry: POEntry, comment: string | undefined): void;
  updateReferenceComment(entry: POEntry, reference: string | undefined): void;
  updatePreviousComment(entry: POEntry, previous: string | undefined): void;
}

export interface POEditorLayoutActions {
  setEditorPanelState(state: EditorPanelState): void;
  toggleEditorPanelOverlay(): void;
  setEditorPanelPosition(position: EditorPanelPosition): void;
  setEditorPanelHeight(percent: number): void;
  closeEditorPanel(): void;
}

export interface POVisibilityActions {
  setSearch(search: string): void;
  setFuzzyOnly(value: boolean): void;
  setMissingOnly(value: boolean): void;
  toggleStatsPanel(): void;
  openStatsPanel(): void;
  toggleFiltersPanel(): void;
  openFiltersPanel(): void;
  confirm(message: string): Promise<boolean>;
}

// Aggregated actions for convenience (deprecated - prefer role-specific interfaces)
export interface POViewActions
  extends
    PONavigationActions,
    POEntryActions,
    POTranslationActions,
    POEditorLayoutActions,
    POVisibilityActions {
  exportFile(): void;
  syncEntries(): void;
  setSourceLanguage(language: string): Promise<void>;
  switchToTextMode(): void;
  switchToGridMode(): Promise<void>;
  toggleCurrentFuzzy(): void;
  getOutputDirectory(): string;
  setOutputDirectory(path: string): Promise<void>;
}

export interface IPOStatsPanel {
  clear(): void;
  setStats(stats: LanguageStat[]): void;
  setFilterData(options: FilterOptions, onChange: FilterChangeCallback): void;
  switchToFilters(): void;
  switchToExport(): void;
  switchToSync(): void;
}

export interface SyncSource {
  type: "pot" | "po";
  language: string;
  entries: POEntry[];
}

export type POParser = (content: string) => ParsePOOutput;
