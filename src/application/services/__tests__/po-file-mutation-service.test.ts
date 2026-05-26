import { POFileMutationService } from "@application/services/POFileMutationService";
import {
  createPluralEntry,
  createSingularEntry,
  createPOHeader,
  isPluralEntry,
  type POEntry,
  type POFile,
} from "@domain/index";
import { describe, expect, it } from "vite-plus/test";

function makeFile(entries: POEntry[] = []): POFile {
  return {
    charset: "UTF-8",
    header: createPOHeader("en"),
    entries,
  };
}

const svc = new POFileMutationService();

describe("POFileMutationService", () => {
  describe("addEntry", () => {
    it("adds an entry to an empty file", () => {
      const file = makeFile();
      const entry = createSingularEntry("Hello", "Bonjour");
      const result = svc.addEntry(file, entry);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].msgid).toBe("Hello");
    });

    it("does not mutate the original file", () => {
      const file = makeFile();
      const entry = createSingularEntry("Hello", "Bonjour");
      svc.addEntry(file, entry);
      expect(file.entries).toHaveLength(0);
    });
  });

  describe("removeEntry", () => {
    it("removes an entry by msgid", () => {
      const entry = createSingularEntry("Hello", "Bonjour");
      const file = makeFile([entry]);
      const result = svc.removeEntry(file, "Hello");
      expect(result.entries).toHaveLength(0);
    });

    it("does not remove non-matching entries", () => {
      const file = makeFile([
        createSingularEntry("Hello", "Bonjour"),
        createSingularEntry("World", "Monde"),
      ]);
      const result = svc.removeEntry(file, "Hello");
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].msgid).toBe("World");
    });
  });

  describe("updateEntry", () => {
    it("updates an entry using an updater function", () => {
      const entry = createSingularEntry("Hello", "Bonjour");
      const file = makeFile([entry]);
      const result = svc.updateEntry(file, "Hello", (e) => ({
        ...e,
        msgstr: "Salut",
      }));
      expect(result.entries[0].msgstr).toBe("Salut");
    });
  });

  describe("updateHeader", () => {
    it("replaces the header", () => {
      const file = makeFile();
      const newHeader = createPOHeader("fr", { lastTranslator: "Test" });
      const result = svc.updateHeader(file, newHeader);
      expect(result.header.language).toBe("fr");
      expect(result.header.lastTranslator).toBe("Test");
    });
  });

  describe("createSingularEntry", () => {
    it("creates a singular entry with defaults", () => {
      const entry = svc.createSingularEntry("Hello", "Bonjour");
      expect(entry.msgid).toBe("Hello");
      expect(entry.msgstr).toBe("Bonjour");
      expect(entry.flags).toEqual([]);
      expect(entry.obsolete).toBe(false);
    });

    it("creates a singular entry with options", () => {
      const entry = svc.createSingularEntry("Hello", "Bonjour", {
        msgctxt: "Menu",
        flags: ["fuzzy"],
        obsolete: true,
      });
      expect(entry.msgctxt).toBe("Menu");
      expect(entry.flags).toEqual(["fuzzy"]);
      expect(entry.obsolete).toBe(true);
    });
  });

  describe("createPluralEntry", () => {
    it("creates a plural entry", () => {
      const entry = svc.createPluralEntry("File", "Files", ["File", "Files"]);
      expect(entry.msgid).toBe("File");
      expect(entry.msgidPlural).toBe("Files");
      expect(entry.msgstr).toEqual(["File", "Files"]);
    });

    it("is recognized as plural", () => {
      const entry = svc.createPluralEntry("File", "Files", ["File", "Files"]);
      expect(isPluralEntry(entry)).toBe(true);
    });
  });

  describe("createPOHeader", () => {
    it("creates a header with defaults", () => {
      const header = svc.createPOHeader("fr");
      expect(header.language).toBe("fr");
      expect(header.contentType).toBe("text/plain; charset=UTF-8");
    });
  });

  describe("toggleFuzzy", () => {
    it("adds fuzzy flag to a non-fuzzy entry", () => {
      const entry = createSingularEntry("Hello", "Bonjour");
      const file = makeFile([entry]);
      const result = svc.toggleFuzzy(file, "Hello");
      expect(result.entries[0].flags).toContain("fuzzy");
    });

    it("removes fuzzy flag from a fuzzy entry", () => {
      const entry = createSingularEntry("Hello", "Bonjour", { flags: ["fuzzy"] });
      const file = makeFile([entry]);
      const result = svc.toggleFuzzy(file, "Hello");
      expect(result.entries[0].flags).not.toContain("fuzzy");
    });

    it("toggles fuzzy on plural entries", () => {
      const entry = createPluralEntry("File", "Files", ["", ""]);
      const file = makeFile([entry]);
      const result = svc.toggleFuzzy(file, "File");
      expect(result.entries[0].flags).toContain("fuzzy");
    });

    it("preserves other flags when toggling fuzzy", () => {
      const entry = createSingularEntry("Hello", "Bonjour", { flags: ["c-format"] });
      const file = makeFile([entry]);
      const result = svc.toggleFuzzy(file, "Hello");
      expect(result.entries[0].flags).toContain("c-format");
      expect(result.entries[0].flags).toContain("fuzzy");
    });
  });

  describe("markObsolete", () => {
    it("toggles a singular entry as obsolete", () => {
      const entry = createSingularEntry("Hello", "Bonjour");
      const file = makeFile([entry]);
      const result = svc.markObsolete(file, "Hello");
      expect(result.entries[0].obsolete).toBe(true);
      const result2 = svc.markObsolete(result, "Hello");
      expect(result2.entries[0].obsolete).toBe(false);
    });

    it("toggles a plural entry as obsolete", () => {
      const entry = createPluralEntry("File", "Files", ["", ""]);
      const file = makeFile([entry]);
      const result = svc.markObsolete(file, "File");
      expect(result.entries[0].obsolete).toBe(true);
      const result2 = svc.markObsolete(result, "File");
      expect(result2.entries[0].obsolete).toBe(false);
    });
  });

  describe("updateMsgid", () => {
    it("renames msgid of a singular entry", () => {
      const entry = createSingularEntry("Hello", "Bonjour");
      const file = makeFile([entry]);
      const result = svc.updateMsgid(file, "Hello@@", entry, "Hi");
      expect(result.entries[0].msgid).toBe("Hi");
      expect(result.entries[0].msgstr).toBe("Bonjour");
    });

    it("renames msgid of a plural entry", () => {
      const entry = createPluralEntry("File", "Files", ["", ""]);
      const file = makeFile([entry]);
      const result = svc.updateMsgid(file, "File@@", entry, "Fichier");
      const updated = result.entries[0];
      expect(updated.msgid).toBe("Fichier");
      if (isPluralEntry(updated)) {
        expect(updated.msgidPlural).toBe("Files");
      }
    });
  });

  describe("updateMsgidPlural", () => {
    it("updates msgidPlural on a plural entry", () => {
      const entry = createPluralEntry("File", "Files", ["", ""]);
      const file = makeFile([entry]);
      const result = svc.updateMsgidPlural(file, "File", "Fichiers");
      const updated = result.entries[0];
      if (isPluralEntry(updated)) {
        expect(updated.msgidPlural).toBe("Fichiers");
      }
    });

    it("does nothing on a singular entry", () => {
      const entry = createSingularEntry("Hello", "Bonjour");
      const file = makeFile([entry]);
      const result = svc.updateMsgidPlural(file, "Hello", "HiPlural");
      expect(result.entries[0].msgid).toBe("Hello");
    });
  });

  describe("updateMsgctxt", () => {
    it("updates msgctxt on an entry", () => {
      const entry = createSingularEntry("Hello", "Bonjour", { msgctxt: "Old" });
      const file = makeFile([entry]);
      const result = svc.updateMsgctxt(file, "Hello@@Old", entry, "New");
      expect(result.entries[0].msgctxt).toBe("New");
    });

    it("removes msgctxt when undefined", () => {
      const entry = createSingularEntry("Hello", "Bonjour", { msgctxt: "Old" });
      const file = makeFile([entry]);
      const result = svc.updateMsgctxt(file, "Hello@@Old", entry, undefined);
      expect(result.entries[0].msgctxt).toBeUndefined();
    });

    it("updates msgctxt on a plural entry", () => {
      const entry = createPluralEntry("File", "Files", ["", ""], { msgctxt: "Old" });
      const file = makeFile([entry]);
      const result = svc.updateMsgctxt(file, "File@@Old", entry, "New");
      expect(result.entries[0].msgctxt).toBe("New");
    });
  });

  describe("saveTranslation", () => {
    it("updates msgstr on a singular entry", () => {
      const entry = createSingularEntry("Hello", "Bonjour");
      const file = makeFile([entry]);
      const result = svc.saveTranslation(file, "Hello", "Salut");
      expect(result.entries[0].msgstr).toBe("Salut");
    });

    it("updates first plural form by default", () => {
      const entry = createPluralEntry("File", "Files", ["Fichier", "Fichiers"]);
      const file = makeFile([entry]);
      const result = svc.saveTranslation(file, "File", "Fichier modifié");
      expect(result.entries[0].msgstr[0]).toBe("Fichier modifié");
      expect(result.entries[0].msgstr[1]).toBe("Fichiers");
    });

    it("updates specific plural index", () => {
      const entry = createPluralEntry("File", "Files", ["Fichier", "Fichiers"]);
      const file = makeFile([entry]);
      const result = svc.saveTranslation(file, "File", "Fichiers modifiés", 1);
      expect(result.entries[0].msgstr[0]).toBe("Fichier");
      expect(result.entries[0].msgstr[1]).toBe("Fichiers modifiés");
    });
  });

  describe("convertToPlural", () => {
    it("converts a singular entry to plural", () => {
      const entry = createSingularEntry("File", "Fichier");
      const file = makeFile([entry]);
      const result = svc.convertToPlural(file, "File", 2);
      const converted = result.entries[0];
      expect(isPluralEntry(converted)).toBe(true);
      if (isPluralEntry(converted)) {
        expect(converted.msgstr).toHaveLength(2);
        expect(converted.msgstr[0]).toBe("Fichier");
        expect(converted.msgstr[1]).toBe("");
      }
    });

    it("does not modify a plural entry", () => {
      const entry = createPluralEntry("File", "Files", ["Fichier", "Fichiers"]);
      const file = makeFile([entry]);
      const result = svc.convertToPlural(file, "File", 2);
      expect(result.entries[0].msgstr).toEqual(["Fichier", "Fichiers"]);
    });
  });

  describe("convertToSingular", () => {
    it("converts a plural entry to a singular entry", () => {
      const entry = createPluralEntry("File", "Files", ["Fichier", "Fichiers"]);
      const file = makeFile([entry]);
      const result = svc.convertToSingular(file, "File");
      const converted = result.entries[0];
      expect(isPluralEntry(converted)).toBe(false);
    });

    it("uses first plural form as msgstr", () => {
      const entry = createPluralEntry("File", "Files", ["Fichier", "Fichiers"]);
      const file = makeFile([entry]);
      const result = svc.convertToSingular(file, "File");
      expect(result.entries[0].msgstr).toBe("Fichier");
    });
  });

  describe("resizePluralForms", () => {
    it("expands msgstr array", () => {
      const entry = createPluralEntry("File", "Files", ["Fichier", "Fichiers"]);
      const file = makeFile([entry]);
      const result = svc.resizePluralForms(file, "File", 4);
      expect(result.entries[0].msgstr).toHaveLength(4);
      expect(result.entries[0].msgstr[2]).toBe("");
      expect(result.entries[0].msgstr[3]).toBe("");
    });

    it("shrinks msgstr array", () => {
      const entry = createPluralEntry("File", "Files", ["Fichier", "Fichiers", "extra"]);
      const file = makeFile([entry]);
      const result = svc.resizePluralForms(file, "File", 1);
      expect(result.entries[0].msgstr).toHaveLength(1);
    });
  });

  describe("setLanguagePluralForms", () => {
    it("updates header and resizes plural entries", () => {
      const entry = createPluralEntry("File", "Files", ["Fichier"]);
      const file = makeFile([entry]);
      const result = svc.setLanguagePluralForms(file, "fr", entry.msgid);
      expect(result.header.language).toBe("fr");
      expect(result.header.pluralForms).toMatch(/^nplurals=/);
      expect(result.entries[0].msgstr).toHaveLength(2);
    });

    it("does not resize singular entries", () => {
      const entry = createSingularEntry("Hello", "Bonjour");
      const file = makeFile([entry]);
      const result = svc.setLanguagePluralForms(file, "fr");
      expect(result.entries[0].msgstr).toBe("Bonjour");
    });
  });

  describe("applyQuickAction", () => {
    it("adds a flag to an entry", () => {
      const entry = createSingularEntry("Hello", "Bonjour");
      const file = makeFile([entry]);
      const result = svc.applyQuickAction(file, "Hello", {
        flag: "c-format",
      });
      expect(result.entries[0].flags).toContain("c-format");
    });

    it("toggles a flag off", () => {
      const entry = createSingularEntry("Hello", "Bonjour", { flags: ["c-format"] });
      const file = makeFile([entry]);
      const result = svc.applyQuickAction(file, "Hello", {
        flag: "c-format",
      });
      expect(result.entries[0].flags).not.toContain("c-format");
    });

    it("adds a translator comment", () => {
      const entry = createSingularEntry("Hello", "Bonjour");
      const file = makeFile([entry]);
      const result = svc.applyQuickAction(file, "Hello", {
        comment: "Review needed",
      });
      expect(result.entries[0].comments?.translator).toBe("Review needed");
    });

    it("toggles a translator comment off", () => {
      const entry = createSingularEntry("Hello", "Bonjour", {
        comments: { translator: "Review needed" },
      });
      const file = makeFile([entry]);
      const result = svc.applyQuickAction(file, "Hello", {
        comment: "Review needed",
      });
      expect(result.entries[0].comments?.translator).toBeUndefined();
    });
  });

  describe("updateCommentField", () => {
    it("sets a translator comment", () => {
      const entry = createSingularEntry("Hello", "Bonjour");
      const file = makeFile([entry]);
      const result = svc.updateCommentField(file, "Hello", "translator", "Reviewed");
      expect(result.entries[0].comments?.translator).toBe("Reviewed");
    });

    it("removes a comment when value is undefined", () => {
      const entry = createSingularEntry("Hello", "Bonjour", {
        comments: { translator: "Reviewed" },
      });
      const file = makeFile([entry]);
      const result = svc.updateCommentField(file, "Hello", "translator", undefined);
      expect(result.entries[0].comments?.translator).toBeUndefined();
    });

    it("updates reference comments", () => {
      const entry = createSingularEntry("Hello", "Bonjour");
      const file = makeFile([entry]);
      const result = svc.updateCommentField(file, "Hello", "reference", "file.js:10");
      expect(result.entries[0].comments?.reference).toBe("file.js:10");
    });
  });

  describe("getPluralFormsHeader", () => {
    it("returns a plural forms header string", () => {
      const header = svc.getPluralFormsHeader("fr");
      expect(header).toMatch(/^nplurals=2; plural=/);
    });
  });
});
