import { isPluralEntry, type POEntry, type POFlag } from "@domain/index";

export interface POEntryFilter {
  statuses?: string[];
  flags?: string[];
  comments?: string[];
  contexts?: string[];
  types?: string[];
  search?: string;
}

export interface POProjectContext {
  siblingEntries: { language: string; entries: POEntry[] }[];
}

function isTranslated(e: POEntry): boolean {
  if (isPluralEntry(e)) {
    return Array.isArray(e.msgstr) && e.msgstr.length > 0 && e.msgstr.every((s) => s.trim() !== "");
  }
  return e.msgstr.trim() !== "";
}

function matchesStatus(e: POEntry, status: string): boolean {
  if (status === "translated") return isTranslated(e);

  if (status === "untranslated") return !isTranslated(e);

  if (status === "fuzzy") return (e.flags ?? []).includes("fuzzy");

  if (status === "obsolete") return !!e.obsolete;

  return false;
}

export function filterEntries(
  entries: POEntry[],
  filter: POEntryFilter,
  _projectContext?: POProjectContext,
): POEntry[] {
  let result = entries;

  if (filter.statuses && filter.statuses.length > 0) {
    result = result.filter((e) => filter.statuses!.some((s) => matchesStatus(e, s)));
  }

  if (filter.flags && filter.flags.length > 0) {
    result = result.filter((e) =>
      filter.flags!.some((flag) => (e.flags ?? []).includes(flag as POFlag)),
    );
  }

  if (filter.comments && filter.comments.length > 0) {
    result = result.filter((e) => filter.comments!.some((c) => e.comments?.translator === c));
  }

  if (filter.contexts && filter.contexts.length > 0) {
    result = result.filter((e) => filter.contexts!.some((ctx) => e.msgctxt === ctx));
  }

  if (filter.types && filter.types.length > 0) {
    result = result.filter((e) => filter.types!.some((t) => (t === "plural") === isPluralEntry(e)));
  }

  if (filter.search) {
    const term = filter.search.toLowerCase();
    result = result.filter((e) => {
      const msgstrText = isPluralEntry(e) ? e.msgstr.join(" ") : e.msgstr;
      return e.msgid.toLowerCase().includes(term) || msgstrText.toLowerCase().includes(term);
    });
  }

  return result;
}
