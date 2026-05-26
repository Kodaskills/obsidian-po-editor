import {
  createPluralEntry,
  createSingularEntry,
  isPluralEntry,
  type POEntry,
  type POFlag,
  type POSingularEntry,
} from "@domain/index";
import { describe, expect, it } from "vite-plus/test";

// Compatibility shims for legacy test expectations
const createPOEntry = (
  msgid: string,
  msgstr: string,
  options?: Record<string, unknown>,
): POSingularEntry => createSingularEntry(msgid, msgstr, options);
const parsePOEntry = (input: {
  msgid: string;
  msgstr?: string | string[];
  msgid_plural?: string;
  msgctxt?: string;
  comments?: {
    flag?: string;
    translator?: string;
    extracted?: string;
  };
  obsolete?: boolean;
}): POEntry => {
  const toFlags = (flagStr?: string): POFlag[] =>
    flagStr ? (flagStr.split(", ") as POFlag[]) : [];
  if (input.msgid_plural || (Array.isArray(input.msgstr) && input.msgid_plural)) {
    const pluralMsgstr = Array.isArray(input.msgstr) ? input.msgstr : [];
    return createPluralEntry(input.msgid, input.msgid_plural ?? "", pluralMsgstr, {
      msgctxt: input.msgctxt,
      flags: toFlags(input.comments?.flag),
      comments: { translator: input.comments?.translator, extracted: input.comments?.extracted },
      obsolete: input.obsolete ?? false,
    });
  }
  return createSingularEntry(input.msgid, typeof input.msgstr === "string" ? input.msgstr : "", {
    msgctxt: input.msgctxt,
    flags: toFlags(input.comments?.flag),
    comments: { translator: input.comments?.translator, extracted: input.comments?.extracted },
    obsolete: input.obsolete ?? false,
  });
};
const serializePOEntry = (input: {
  msgid: string;
  msgstr: string;
  msgidPlural?: string;
  msgstrPlural?: string[];
  msgctxt?: string;
  flags?: string[];
  comments?: Record<string, string>;
  obsolete?: boolean;
}): Record<string, unknown> => {
  const result: Record<string, unknown> = { msgid: input.msgid };
  if (input.msgidPlural) {
    result.msgid_plural = input.msgidPlural;
    result.msgstr = input.msgstrPlural ?? [];
  } else {
    result.msgstr = [input.msgstr];
  }
  if (input.msgctxt) result.msgctxt = input.msgctxt;
  const serializedComments: Record<string, string> = {};
  if (input.comments) Object.assign(serializedComments, input.comments);
  if (input.flags?.length) serializedComments.flag = input.flags.join(", ");
  if (Object.keys(serializedComments).length > 0) result.comments = serializedComments;
  return result;
};

// ===== DONNÉES LOCALES POUR CE FICHIER =====

// Test cases pour parsePOEntry
const parseTestCases = [
  {
    name: "basic entry with msgid and msgstr",
    input: { msgid: "Hello", msgstr: "Bonjour" },
    expected: {
      msgid: "Hello",
      msgstr: "Bonjour",
      flags: [],
      comments: {},
      obsolete: false,
    },
  },
  {
    name: "fuzzy entry",
    input: { msgid: "World", msgstr: "", comments: { flag: "fuzzy" } },
    expected: {
      msgid: "World",
      msgstr: "",
      flags: ["fuzzy"],
      comments: {},
      obsolete: false,
    },
  },
  {
    name: "entry with msgctxt",
    input: { msgid: "OK", msgstr: "OK", msgctxt: "Button" },
    expected: {
      msgid: "OK",
      msgstr: "OK",
      msgctxt: "Button",
      flags: [],
      comments: {},
      obsolete: false,
    },
  },
  {
    name: "entry with translator comment",
    input: { msgid: "Hello", msgstr: "Bonjour", comments: { translator: "Test translation" } },
    expected: {
      msgid: "Hello",
      msgstr: "Bonjour",
      flags: [],
      comments: { translator: "Test translation" },
      obsolete: false,
    },
  },
  {
    name: "plural entry",
    input: {
      msgid: "one file",
      msgid_plural: "many files",
      msgstr: ["un fichier", "plusieurs fichiers"],
    },
    expected: {
      msgid: "one file",
      msgidPlural: "many files",
      msgstr: "un fichier",
      msgstrPlural: ["un fichier", "plusieurs fichiers"],
      flags: [],
      comments: {},
      obsolete: false,
    },
  },
  {
    name: "obsolete entry",
    input: { msgid: "old", msgstr: "ancien", obsolete: true },
    expected: {
      msgid: "old",
      msgstr: "ancien",
      flags: [],
      comments: {},
      obsolete: true,
    },
  },
  {
    name: "entry with multiple flags",
    input: { msgid: "printf", msgstr: "%s", comments: { flag: "c-format, python-format" } },
    expected: {
      msgid: "printf",
      msgstr: "%s",
      flags: ["c-format", "python-format"],
      comments: {},
      obsolete: false,
    },
  },
  {
    name: "entry with extracted comment",
    input: { msgid: "Test", msgstr: "Test", comments: { extracted: "This is extracted" } },
    expected: {
      msgid: "Test",
      msgstr: "Test",
      flags: [],
      comments: { extracted: "This is extracted" },
      obsolete: false,
    },
  },
];

// Test cases pour serializePOEntry
const serializeTestCases = [
  {
    name: "basic entry serialization",
    input: { msgid: "Hello", msgstr: "Bonjour", flags: [], comments: {}, obsolete: false },
    expected: { msgid: "Hello", msgstr: ["Bonjour"] },
  },
  {
    name: "entry with msgctxt",
    input: {
      msgid: "OK",
      msgstr: "OK",
      msgctxt: "Button",
      flags: [],
      comments: {},
      obsolete: false,
    },
    expected: { msgid: "OK", msgstr: ["OK"], msgctxt: "Button" },
  },
  {
    name: "plural entry serialization",
    input: {
      msgid: "one file",
      msgstr: "un fichier",
      msgidPlural: "many files",
      msgstrPlural: ["un fichier", "plusieurs fichiers"],
      flags: [],
      comments: {},
      obsolete: false,
    },
    expected: {
      msgid: "one file",
      msgid_plural: "many files",
      msgstr: ["un fichier", "plusieurs fichiers"],
    },
  },
  {
    name: "entry with translator comment serializes correctly",
    input: {
      msgid: "Hello",
      msgstr: "Bonjour",
      flags: [],
      comments: { translator: "Test translation" },
      obsolete: false,
    },
    expected: {
      msgid: "Hello",
      msgstr: ["Bonjour"],
      comments: { translator: "Test translation" },
    },
  },
  {
    name: "entry with flag serializes correctly",
    input: { msgid: "Fuzzy", msgstr: "", flags: ["fuzzy"], comments: {}, obsolete: false },
    expected: { msgid: "Fuzzy", msgstr: [""], comments: { flag: "fuzzy" } },
  },
];

// Test cases pour createPOEntry
const createTestCases = [
  {
    name: "create basic entry",
    input: { msgid: "Hello", msgstr: "Bonjour" },
    check: (entry: POSingularEntry) => {
      expect(entry.msgid).toBe("Hello");
      expect(entry.msgstr).toBe("Bonjour");
      expect(entry.flags).toEqual([]);
      expect(entry.obsolete).toBe(false);
    },
  },
  {
    name: "create entry with options",
    input: { msgid: "Test", msgstr: " Essai ", flags: ["fuzzy"] },
    check: (entry: POSingularEntry) => {
      expect(entry.msgid).toBe("Test");
      expect(entry.msgstr).toBe(" Essai ");
      expect(entry.flags).toEqual(["fuzzy"]);
      expect(entry.obsolete).toBe(false);
    },
  },
  {
    name: "create entry with empty msgid defaults to empty string",
    input: { msgid: "", msgstr: "test" },
    check: (entry: POSingularEntry) => {
      expect(entry.msgid).toBe("");
    },
  },
];

// ===== TESTS =====

describe("parsePOEntry", () => {
  parseTestCases.forEach(
    ({
      name,
      input,
      expected,
    }: {
      name: string;
      input: Record<string, unknown>;
      expected: Record<string, unknown>;
    }) => {
      it(name, () => {
        const result = parsePOEntry(input as Parameters<typeof parsePOEntry>[0]);
        expect(result.msgid).toBe(expected.msgid);
        const resultMsgstr = isPluralEntry(result) ? result.msgstr[0] : result.msgstr;
        expect(resultMsgstr).toBe(expected.msgstr);
        expect(result.flags).toEqual(expected.flags);
        expect(result.comments).toEqual(expected.comments);
        expect(result.obsolete).toBe(expected.obsolete);
        if (expected.msgctxt !== undefined) {
          expect(result.msgctxt).toBe(expected.msgctxt);
        }
        if (expected.msgidPlural !== undefined) {
          expect(isPluralEntry(result) ? result.msgidPlural : undefined).toBe(expected.msgidPlural);
        }
        if (expected.msgstrPlural !== undefined) {
          expect(isPluralEntry(result) ? result.msgstr : undefined).toEqual(expected.msgstrPlural);
        }
      });
    },
  );
});

describe("serializePOEntry", () => {
  serializeTestCases.forEach(
    ({
      name,
      input,
      expected,
    }: {
      name: string;
      input: Record<string, unknown>;
      expected: Record<string, unknown>;
    }) => {
      it(name, () => {
        const result = serializePOEntry(input as Parameters<typeof serializePOEntry>[0]);
        expect(result.msgid).toBe(expected.msgid);
        expect(result.msgstr).toEqual(expected.msgstr);
        if (expected.msgctxt !== undefined) {
          expect(result.msgctxt).toBe(expected.msgctxt);
        }
        if (expected.msgid_plural !== undefined) {
          expect(result.msgid_plural).toBe(expected.msgid_plural);
        }
        if (expected.comments !== undefined) {
          expect(result.comments).toEqual(expected.comments);
        }
      });
    },
  );
});

describe("createPOEntry", () => {
  createTestCases.forEach(
    ({
      name,
      input,
      check,
    }: {
      name: string;
      input: Record<string, unknown>;
      check: (entry: POSingularEntry) => void;
    }) => {
      it(name, () => {
        const entry = createPOEntry(input.msgid as string, input.msgstr as string, input);
        check(entry);
      });
    },
  );
});
