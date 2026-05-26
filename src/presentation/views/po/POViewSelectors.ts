import { filterEntries, type POEntryFilter } from "@application/index";
import {
  getLanguageDisplayName,
  getStatistics,
  isPluralEntry,
  type POEntry,
  type POFile,
  type POStatistics,
} from "@domain/index";
import { type TFile } from "obsidian";

import {
  isFuzzy as isEntryFuzzy,
  isMissing as isEntryMissing,
  entryKey as helpersEntryKey,
  entryRenderId,
} from "./POEntryHelpers";
import type {
  FilterOptions,
  LanguageStat,
  POEntryItem,
  POViewFilterState,
  POViewSnapshot,
  ProjectFile,
} from "./POViewTypes";

export function buildFilter(filters: POViewFilterState): POEntryFilter {
  return {
    statuses: filters.includedStatuses,
    flags: filters.includedFlags,
    comments: filters.includedComments,
    contexts: filters.includedContexts,
    types: filters.includedTypes,
    search: filters.activeSearch || undefined,
  };
}

export function buildFilteredItems(
  snapshot: POViewSnapshot,
  sourceLanguage: string,
): {
  entries: POEntry[];
  items: POEntryItem[];
  sourceMap: Map<string, string>;
} {
  const filter = buildFilter(snapshot.filters);
  const projectContext = {
    siblingEntries: snapshot.siblingPoFiles.map((s) => ({
      language: s.language,
      entries: s.poFile.entries,
    })),
  };

  let entries = filterEntries(snapshot.mainPoFile.entries, filter, projectContext);
  entries = entries.filter((e) => e.msgid !== "");

  if (!snapshot.filters.includedStatuses.includes("obsolete")) {
    entries = entries.filter((e) => !e.obsolete);
  }

  if (snapshot.filters.fuzzyOnly || snapshot.filters.missingOnly) {
    entries = entries.filter((entry) => {
      const fuzzy = isEntryFuzzy(entry);
      const missing = isEntryMissing(entry);
      if (snapshot.filters.fuzzyOnly && snapshot.filters.missingOnly) return fuzzy || missing;
      if (snapshot.filters.fuzzyOnly) return fuzzy;
      return missing;
    });
  }

  const sourceMap = buildSourceMap(snapshot.siblingPoFiles, sourceLanguage);

  const items: POEntryItem[] = Array.from({ length: entries.length });
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    items[i] = { id: entryRenderId(entry), entry };
  }

  return { entries, sourceMap, items };
}

export function buildLanguageStats(
  snapshot: POViewSnapshot,
  sourceLanguage: string,
  mainStats?: POStatistics | null,
): LanguageStat[] {
  const getName = (poFile: POFile, file: TFile) => {
    const lang = poFile.header.language;
    return lang && lang !== "und" ? (getLanguageDisplayName(lang) ?? lang) : file.basename;
  };

  const mainCode = snapshot.mainPoFile.header.language || snapshot.file.basename;
  const mainName = getName(snapshot.mainPoFile, snapshot.file);
  const result: LanguageStat[] = [
    {
      name: mainName,
      stats: mainStats ?? getStatistics(snapshot.mainPoFile),
      isSource: mainCode === sourceLanguage,
      isPOT: snapshot.isPOTFile,
    },
    ...snapshot.siblingPoFiles.map((file) => ({
      name: getName(file.poFile, file.file),
      stats: file.stats,
      isSource: file.language === sourceLanguage,
      isPOT: false,
    })),
  ];

  return result.sort((a, b) => {
    if (a === result[0]) return -1;
    if (b === result[0]) return 1;
    if (a.isSource && !b.isSource) return -1;
    if (!a.isSource && b.isSource) return 1;
    return a.name.localeCompare(b.name);
  });
}

export function buildFilterOptions(
  snapshot: POViewSnapshot,
  _sourceLanguage: string,
  mainStats?: POStatistics | null,
): FilterOptions {
  const stats = mainStats ?? getStatistics(snapshot.mainPoFile);
  const entries = snapshot.mainPoFile.entries;
  const untranslatedCount = stats.untranslated;
  const flagCounts = stats.flags;

  const flagOptions = snapshot.quickActions
    .filter((action): action is typeof action & { flag: string } => action.flag !== undefined)
    .map((action) => ({
      flag: action.flag,
      label: action.label,
      count: flagCounts[action.flag] ?? 0,
    }));

  const commentOptions = buildCommentOptions(snapshot);
  const contextOptions = [...countContexts(entries).entries()]
    .map(([context, count]) => ({ context, count }))
    .sort((a, b) => a.context.localeCompare(b.context));

  const pluralCount = entries.filter((e) => isPluralEntry(e)).length;
  const singularCount = stats.total - pluralCount;

  return {
    totalEntries: stats.total,
    untranslatedCount,
    translatedCount: stats.translated,
    fuzzyCount: stats.fuzzy,
    obsoleteCount: entries.filter((e) => e.obsolete).length,
    flagOptions,
    commentOptions,
    contextOptions,
    languageOptions: undefined,
    typeOptions: [
      { type: "singular", label: "Singular", count: singularCount },
      { type: "plural", label: "Plural", count: pluralCount },
    ],
    current: {
      includedStatuses: snapshot.filters.includedStatuses,
      includedFlags: snapshot.filters.includedFlags,
      includedComments: snapshot.filters.includedComments,
      includedContexts: snapshot.filters.includedContexts,
      includedLanguages: snapshot.filters.includedLanguages,
      includedTypes: snapshot.filters.includedTypes,
    },
  };
}

function buildSourceMap(siblings: ProjectFile[], sourceLanguage: string): Map<string, string> {
  const sourceFile = siblings.find((file) => file.language === sourceLanguage);
  const sourceMap = new Map<string, string>();
  if (!sourceFile) return sourceMap;

  for (const entry of sourceFile.poFile.entries) {
    if (!isPluralEntry(entry) && entry.msgstr) {
      sourceMap.set(helpersEntryKey(entry), entry.msgstr);
    }
  }
  return sourceMap;
}

function buildCommentOptions(snapshot: POViewSnapshot): FilterOptions["commentOptions"] {
  const allComments = [snapshot.mainPoFile]
    .flatMap((file) => file.entries.map((entry) => entry.comments?.translator))
    .filter((comment): comment is string => !!comment)
    .sort();

  const quickCommentActions = snapshot.quickActions.filter(
    (action): action is typeof action & { comment: string } =>
      action.comment !== undefined && !action.flag,
  );
  const existingComments = new Set(allComments);
  const commentOptions: FilterOptions["commentOptions"] = [];

  for (const action of quickCommentActions) {
    const count = allComments.filter((comment) => comment === action.comment).length;
    if (count > 0 || snapshot.filters.includedComments.includes(action.comment)) {
      commentOptions.push({ comment: action.comment, label: action.label, count });
      existingComments.delete(action.comment);
    }
  }

  for (const comment of existingComments) {
    commentOptions.push({
      comment,
      label: comment,
      count: allComments.filter((value) => value === comment).length,
    });
  }
  return commentOptions;
}

function countContexts(entries: POEntry[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.msgctxt) counts.set(entry.msgctxt, (counts.get(entry.msgctxt) ?? 0) + 1);
  }
  return counts;
}
