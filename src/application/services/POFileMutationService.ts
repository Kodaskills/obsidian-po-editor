import {
  addEntryToFile,
  compositeEntryKey,
  createPluralEntry,
  createPOHeader,
  createSingularEntry,
  getPluralFormSpec,
  isPluralEntry,
  pluralFormsHeader,
  removeEntry,
  updateEntry,
  updateHeader,
  type POEntry,
  type POFile,
  type POFlag,
  type POHeader,
  type POPluralEntry,
} from "@domain/index";

export interface MutationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Application service that encapsulates all POFile mutation operations.
 * Presentation layer depends on this instead of calling domain functions directly.
 */
export class POFileMutationService {
  addEntry(poFile: POFile, entry: POEntry): POFile {
    return addEntryToFile(poFile, entry);
  }

  removeEntry(poFile: POFile, msgid: string): POFile {
    return removeEntry(poFile, msgid);
  }

  updateEntry(poFile: POFile, msgid: string, updater: (entry: POEntry) => POEntry): POFile {
    return updateEntry(poFile, msgid, updater);
  }

  updateHeader(poFile: POFile, header: POHeader): POFile {
    return updateHeader(poFile, header);
  }

  createSingularEntry(
    msgid: string,
    msgstr: string,
    options?: {
      msgctxt?: string;
      flags?: POFlag[];
      comments?: import("@domain/index").POComment;
      obsolete?: boolean;
    },
  ): import("@domain/index").POSingularEntry {
    return createSingularEntry(msgid, msgstr, options);
  }

  createPluralEntry(
    msgid: string,
    msgidPlural: string,
    msgstrPlural: string[],
    options?: import("@domain/index").POOptions,
  ): POPluralEntry {
    return createPluralEntry(msgid, msgidPlural, msgstrPlural, options);
  }

  createPOHeader(language: string, options?: Partial<POHeader>): POHeader {
    return createPOHeader(language, options);
  }

  toggleFuzzy(poFile: POFile, msgid: string): POFile {
    return updateEntry(poFile, msgid, (candidate) => {
      const hasFuzzy = (candidate.flags ?? []).includes("fuzzy");
      const flags = hasFuzzy
        ? (candidate.flags ?? []).filter((flag) => flag !== "fuzzy")
        : [...(candidate.flags ?? []), "fuzzy" as const];
      if (isPluralEntry(candidate)) {
        return createPluralEntry(candidate.msgid, candidate.msgidPlural, candidate.msgstr, {
          ...candidate,
          flags,
        });
      }
      return createSingularEntry(candidate.msgid, candidate.msgstr, { ...candidate, flags });
    });
  }

  markObsolete(poFile: POFile, msgid: string): POFile {
    return updateEntry(poFile, msgid, (candidate) => {
      const isNowObsolete = !candidate.obsolete;
      if (isPluralEntry(candidate)) {
        return createPluralEntry(candidate.msgid, candidate.msgidPlural, candidate.msgstr, {
          ...candidate,
          obsolete: isNowObsolete,
        });
      }
      return createSingularEntry(candidate.msgid, candidate.msgstr, {
        ...candidate,
        obsolete: isNowObsolete,
      });
    });
  }

  updateMsgid(poFile: POFile, oldKey: string, entry: POEntry, newMsgid: string): POFile {
    return {
      ...poFile,
      entries: poFile.entries.map((e) => {
        if (compositeEntryKey(e) !== oldKey) return e;
        if (isPluralEntry(e)) {
          return createPluralEntry(newMsgid, e.msgidPlural, e.msgstr, e);
        }
        return createSingularEntry(newMsgid, e.msgstr, e);
      }),
    };
  }

  updateMsgidPlural(poFile: POFile, msgid: string, newMsgidPlural: string): POFile {
    return updateEntry(poFile, msgid, (candidate) => {
      if (!isPluralEntry(candidate)) return candidate;
      return createPluralEntry(candidate.msgid, newMsgidPlural, candidate.msgstr, candidate);
    });
  }

  updateMsgctxt(
    poFile: POFile,
    oldKey: string,
    entry: POEntry,
    newMsgctxt: string | undefined,
  ): POFile {
    return {
      ...poFile,
      entries: poFile.entries.map((e) => {
        if (compositeEntryKey(e) !== oldKey) return e;
        if (isPluralEntry(e)) {
          return createPluralEntry(e.msgid, e.msgidPlural, e.msgstr, { ...e, msgctxt: newMsgctxt });
        }
        return createSingularEntry(e.msgid, e.msgstr, { ...e, msgctxt: newMsgctxt });
      }),
    };
  }

  saveTranslation(poFile: POFile, msgid: string, value: string, pluralIndex?: number): POFile {
    return updateEntry(poFile, msgid, (candidate) => {
      if (isPluralEntry(candidate)) {
        const updated = [...candidate.msgstr];
        updated[pluralIndex ?? 0] = value;
        return createPluralEntry(candidate.msgid, candidate.msgidPlural, updated, candidate);
      }
      return createSingularEntry(candidate.msgid, value, candidate);
    });
  }

  convertToPlural(poFile: POFile, msgid: string, nplurals: number): POFile {
    return updateEntry(poFile, msgid, (entry) => {
      if (isPluralEntry(entry)) return entry;
      const msgstr = Array.from({ length: nplurals }, (_, i) => (i === 0 ? entry.msgstr : ""));
      return createPluralEntry(entry.msgid, entry.msgid, msgstr, {
        msgctxt: entry.msgctxt,
        comments: entry.comments,
        flags: entry.flags ?? [],
        obsolete: entry.obsolete,
      });
    });
  }

  convertToSingular(poFile: POFile, msgid: string): POFile {
    return updateEntry(poFile, msgid, (entry) => {
      if (!isPluralEntry(entry)) return entry;
      return createSingularEntry(entry.msgid, entry.msgstr[0] ?? "", {
        msgctxt: entry.msgctxt,
        comments: entry.comments,
        flags: entry.flags ?? [],
        obsolete: entry.obsolete,
      });
    });
  }

  resizePluralForms(poFile: POFile, msgid: string, count: number): POFile {
    return updateEntry(poFile, msgid, (candidate) => {
      if (!isPluralEntry(candidate)) return candidate;
      const msgstr = [...candidate.msgstr];
      if (count > msgstr.length) {
        while (msgstr.length < count) msgstr.push("");
      } else {
        msgstr.length = count;
      }
      return createPluralEntry(candidate.msgid, candidate.msgidPlural, msgstr, {
        msgctxt: candidate.msgctxt,
        comments: candidate.comments,
        flags: candidate.flags ?? [],
        obsolete: candidate.obsolete,
      });
    });
  }

  setLanguagePluralForms(poFile: POFile, language: string, selectedMsgid?: string): POFile {
    const spec = getPluralFormSpec(language);
    const header = createPOHeader(language, {
      ...poFile.header,
      pluralForms: pluralFormsHeader(spec),
    });
    let updated = updateHeader(poFile, header);
    if (selectedMsgid) {
      updated = updateEntry(updated, selectedMsgid, (candidate) => {
        if (!isPluralEntry(candidate)) return candidate;
        const msgstr = [...candidate.msgstr];
        if (spec.nplurals > msgstr.length) {
          while (msgstr.length < spec.nplurals) msgstr.push("");
        } else {
          msgstr.length = spec.nplurals;
        }
        return createPluralEntry(candidate.msgid, candidate.msgidPlural, msgstr, {
          msgctxt: candidate.msgctxt,
          comments: candidate.comments,
          flags: candidate.flags ?? [],
          obsolete: candidate.obsolete,
        });
      });
    }
    return updated;
  }

  applyQuickAction(
    poFile: POFile,
    msgid: string,
    action: { flag?: POFlag; comment?: string },
  ): POFile {
    return updateEntry(poFile, msgid, (candidate) => {
      const isFlagActive = action.flag ? (candidate.flags ?? []).includes(action.flag) : true;
      const isCommentActive = action.comment
        ? candidate.comments?.translator === action.comment
        : true;
      const isActive = isFlagActive && isCommentActive;

      let flags = candidate.flags ?? [];
      if (action.flag) {
        flags = isActive ? flags.filter((f) => f !== action.flag) : [...flags, action.flag];
      }

      const comments = { ...candidate.comments };
      if (action.comment) {
        if (isActive) delete comments.translator;
        else comments.translator = action.comment;
      }

      if (isPluralEntry(candidate)) {
        return createPluralEntry(candidate.msgid, candidate.msgidPlural, candidate.msgstr, {
          ...candidate,
          flags,
          comments,
        });
      }
      return createSingularEntry(candidate.msgid, candidate.msgstr, {
        ...candidate,
        flags,
        comments,
      });
    });
  }

  updateCommentField(
    poFile: POFile,
    msgid: string,
    field: "translator" | "reference" | "previous",
    value: string | undefined,
  ): POFile {
    return updateEntry(poFile, msgid, (candidate) => {
      const comments = { ...candidate.comments, [field]: value };
      if (!value) delete comments[field];
      if (isPluralEntry(candidate)) {
        return createPluralEntry(candidate.msgid, candidate.msgidPlural, candidate.msgstr, {
          ...candidate,
          comments,
        });
      }
      return createSingularEntry(candidate.msgid, candidate.msgstr, { ...candidate, comments });
    });
  }

  getPluralFormsHeader(language: string): string {
    return pluralFormsHeader(getPluralFormSpec(language));
  }
}
