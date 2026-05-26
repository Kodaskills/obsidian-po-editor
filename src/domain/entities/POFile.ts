import { isPluralEntry, type POEntry, type POHeader } from "@domain/index";

export interface POFile {
  readonly charset: string;
  readonly header: POHeader;
  readonly entries: POEntry[];
}

export interface POStatistics {
  total: number;
  translated: number;
  untranslated: number;
  fuzzy: number;
  obsolete: number;
  wordCount: number;
  charCount: number;
  charCountNoSpaces: number;
  translatedWordCount: number;
  flags: Record<string, number>;
  errors: number;
  pluralEntries: number;
  singularEntries: number;
}

function getMsgStrString(entry: POEntry): string {
  if (isPluralEntry(entry)) {
    if (
      Array.isArray(entry.msgstr) &&
      entry.msgstr.length > 0 &&
      entry.msgstr.every((s) => s?.trim().length > 0)
    ) {
      return entry.msgstr[0];
    }
    return "";
  } else {
    return entry.msgstr;
  }
}

function getSourceText(entry: POEntry): string {
  let text = entry.msgid;
  if (isPluralEntry(entry)) {
    text += ` ${entry.msgidPlural || ""}`;
  }
  return text;
}

function countText(t: string) {
  return {
    words: t
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length,
    chars: t.length,
    charsNoSpaces: t.replace(/\s/g, "").length,
  };
}

export function getStatistics(file: POFile): POStatistics {
  const stats: POStatistics = {
    total: file.entries.length,
    translated: 0,
    untranslated: 0,
    fuzzy: 0,
    obsolete: 0,
    wordCount: 0,
    charCount: 0,
    charCountNoSpaces: 0,
    translatedWordCount: 0,
    flags: {},
    errors: 0,
    pluralEntries: 0,
    singularEntries: 0,
  };

  for (const entry of file.entries) {
    if (entry.obsolete) {
      stats.obsolete++;
      continue;
    }

    if (isPluralEntry(entry)) {
      stats.pluralEntries++;
    } else {
      stats.singularEntries++;
    }
    const srcText = getSourceText(entry);
    const srcCount = countText(srcText);
    stats.wordCount += srcCount.words;
    stats.charCount += srcCount.chars;
    stats.charCountNoSpaces += srcCount.charsNoSpaces;

    const targetText = getMsgStrString(entry);
    const isTranslated = targetText.trim().length > 0;
    if (isTranslated) {
      stats.translated++;
      stats.translatedWordCount += srcCount.words;
    } else {
      stats.untranslated++;
    }

    for (const flag of entry.flags || []) {
      stats.flags[flag] = (stats.flags[flag] || 0) + 1;
      if (flag === "fuzzy") stats.fuzzy++;
    }

    if (!entry.msgid.trim() && (targetText.trim() || entry.msgctxt)) {
      stats.errors++;
    }
  }
  return stats;
}

export function createPOFile(header: POHeader, charset = "UTF-8"): POFile {
  return {
    charset,
    header,
    entries: [],
  };
}

export function findEntryByMsgid(file: POFile, msgid: string): POEntry | undefined {
  return file.entries.find((e) => e.msgid === msgid);
}

export function addEntryToFile(poFile: POFile, entry: POEntry): POFile {
  return {
    ...poFile,
    entries: [...poFile.entries, entry],
  };
}

export function removeEntry(file: POFile, msgid: string): POFile {
  return {
    ...file,
    entries: file.entries.filter((e) => e.msgid !== msgid),
  };
}

export function updateHeader(file: POFile, header: POHeader): POFile {
  return { ...file, header };
}

export function updateEntry(
  file: POFile,
  msgid: string,
  updater: (entry: POEntry) => POEntry,
): POFile {
  return {
    ...file,
    entries: file.entries.map((e) => (e.msgid === msgid ? updater(e) : e)),
  };
}

export function markObsoleteAndMoveToEnd(file: POFile, msgid: string, msgctxt?: string): POFile {
  const matchKey = (e: POEntry) =>
    e.msgid === msgid && (msgctxt === undefined ? true : e.msgctxt === msgctxt);
  const entry = file.entries.find(matchKey);
  if (!entry) return file;
  const rest = file.entries.filter((e) => !matchKey(e));
  return {
    ...file,
    entries: [...rest, { ...entry, obsolete: true }],
  };
}
