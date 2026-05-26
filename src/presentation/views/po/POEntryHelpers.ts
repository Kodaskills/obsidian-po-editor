import { compositeEntryKey, isPluralEntry, type POEntry, type POStatistics } from "@domain/index";

export function isMissing(entry: POEntry): boolean {
  if (isPluralEntry(entry))
    return !(
      Array.isArray(entry.msgstr) &&
      entry.msgstr.length > 0 &&
      entry.msgstr.every((s) => s?.trim() !== "")
    );
  return entry.msgstr.trim() === "";
}

export function isFuzzy(entry: POEntry): boolean {
  return (entry.flags ?? []).includes("fuzzy");
}

export function entryKey(entry: POEntry): string {
  return compositeEntryKey(entry);
}

export function getProgress(stats: POStatistics): number {
  return stats.total > 0 ? Math.round((stats.translated / stats.total) * 100) : 0;
}

export function getNplurals(pluralForms: string): number {
  const match = pluralForms.match(/nplurals\s*=\s*(\d+)/);
  return match ? parseInt(match[1], 10) : 2;
}

export function hasMissingPlaceholders(
  entry: POEntry,
  detect: (text: string) => string[],
): boolean {
  const sourcePlaceholders = detect(entry.msgid);
  if (sourcePlaceholders.length === 0) return false;
  const forms = isPluralEntry(entry) ? entry.msgstr : [entry.msgstr];
  return forms.some((form) => {
    const targetPlaceholders = detect(form);
    return sourcePlaceholders.some((p) => !targetPlaceholders.includes(p));
  });
}

export function entryRenderId(entry: POEntry): string {
  const flags = entry.flags?.length ? entry.flags.join(",") : "";
  const context = entry.msgctxt ?? "";
  const comment = entry.comments?.translator ?? "";
  const val = isPluralEntry(entry) ? entry.msgstr[0] : entry.msgstr;
  return `${entry.msgid}\u0000${context}\u0000${val}\u0000${flags}\u0000${comment}\u0000${entry.obsolete ? "O" : ""}`;
}
