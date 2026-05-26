import {
  addEntryToFile,
  compositeEntryKey,
  createPluralEntry,
  createSingularEntry,
  entriesMatch,
  isPluralEntry,
  markObsoleteAndMoveToEnd,
  type POEntry,
  type POFile,
} from "@domain/index";

export type SyncOrphanStrategy = "add-only" | "delete" | "mark-obsolete-end";

export interface SyncTarget {
  language: string;
  poFile: POFile;
  nplurals: number;
}

export interface SyncResult {
  language: string;
  updatedFile: POFile;
  addedCount: number;
  orphanedCount: number;
}

export interface SyncPOFilesInput {
  sourceEntries: POEntry[];
  targets: SyncTarget[];
  orphanStrategy?: SyncOrphanStrategy;
}

export interface SyncPOFilesOutput {
  results: SyncResult[];
  totalAdded: number;
  totalOrphaned: number;
}

function createBlankEntry(src: POEntry, nplurals: number): POEntry {
  if (isPluralEntry(src)) {
    return createPluralEntry(
      src.msgid,
      src.msgidPlural,
      Array(Math.max(1, nplurals)).fill("") as string[],
      {
        msgctxt: src.msgctxt,
        comments: {},
        flags: [],
        obsolete: false,
      },
    );
  }
  return createSingularEntry(src.msgid, "", {
    msgctxt: src.msgctxt,
    comments: {},
    flags: [],
    obsolete: false,
  });
}

export class SyncPOFiles {
  execute(input: SyncPOFilesInput): SyncPOFilesOutput {
    const results: SyncResult[] = [];
    let totalAdded = 0;
    let totalOrphaned = 0;
    const orphanStrategy = input.orphanStrategy ?? "add-only";

    for (const target of input.targets) {
      let updatedFile = target.poFile;
      let addedCount = 0;

      for (const src of input.sourceEntries) {
        const alreadyExists = updatedFile.entries.some((e) => entriesMatch(e, src));
        if (alreadyExists) continue;

        updatedFile = addEntryToFile(updatedFile, createBlankEntry(src, target.nplurals));
        addedCount++;
      }

      let orphanedCount = 0;
      if (orphanStrategy !== "add-only") {
        const sourceKeys = new Set(input.sourceEntries.map((src) => compositeEntryKey(src)));
        const orphans = updatedFile.entries.filter(
          (e) => !e.obsolete && !sourceKeys.has(compositeEntryKey(e)),
        );
        orphanedCount = orphans.length;

        if (orphanStrategy === "delete") {
          const keySet = new Set(orphans.map((o) => compositeEntryKey(o)));
          updatedFile = {
            ...updatedFile,
            entries: updatedFile.entries.filter((e) => !keySet.has(compositeEntryKey(e))),
          };
        } else if (orphanStrategy === "mark-obsolete-end") {
          for (const orphan of orphans) {
            updatedFile = markObsoleteAndMoveToEnd(updatedFile, orphan.msgid, orphan.msgctxt);
          }
        }
      }

      results.push({ language: target.language, updatedFile, addedCount, orphanedCount });
      totalAdded += addedCount;
      totalOrphaned += orphanedCount;
    }

    return { results, totalAdded, totalOrphaned };
  }
}
