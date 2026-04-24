export type POFlag =
  | "fuzzy"
  | "c-format"
  | "no-c-format"
  | "icu-format"
  | "python-format"
  | "python-brace-format"
  | "csharp-format";

export interface POComment {
  translator?: string; // #
  extracted?: string; // #.
  reference?: string; // #:
  previous?: string; // #|
}

export interface POOptions {
  msgctxt?: string;
  flags?: POFlag[];
  comments?: POComment;
  obsolete?: boolean;
}

export interface BasePOEntry extends POOptions {
  msgid: string;
}

export interface POSingularEntry extends BasePOEntry {
  msgstr: string;
}

export interface POPluralEntry extends BasePOEntry {
  msgidPlural: string;
  msgstr: string[];
}

export type POEntry = POSingularEntry | POPluralEntry;

export function createSingularEntry(
  msgid: string,
  msgstr: string,
  options?: {
    msgctxt?: string;
    flags?: POFlag[];
    comments?: POComment;
    obsolete?: boolean;
  },
): POSingularEntry {
  return {
    msgid,
    msgstr,
    msgctxt: options?.msgctxt,
    flags: options?.flags ?? [],
    comments: options?.comments ?? {},
    obsolete: options?.obsolete ?? false,
  };
}

export function createPluralEntry(
  msgid: string,
  msgidPlural: string,
  msgstrPlural: string[],
  options?: POOptions,
): POPluralEntry {
  return {
    msgid,
    msgidPlural,
    msgstr: msgstrPlural,
    msgctxt: options?.msgctxt,
    flags: options?.flags ?? [],
    comments: options?.comments ?? {},
    obsolete: options?.obsolete ?? false,
  };
}

export function isPluralEntry(entry: POEntry): entry is POPluralEntry {
  return "msgidPlural" in entry;
}
