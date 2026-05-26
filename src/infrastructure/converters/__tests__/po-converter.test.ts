import { createPOHeader, isPluralEntry, type POFile } from "@domain/index";
import { describe, expect, it } from "vite-plus/test";

import { POConverter } from "../POConverter";

const poConverter = new POConverter();
const defaultHeader = createPOHeader("en");

// ===== DONNÉES LOCALES POUR CE FICHIER =====

// Test data for POConverter.parse()
const parseTestCases = [
  {
    name: "basic PO file with single entry",
    input: `# PO file created with Obsidian PO Editor
msgid ""
msgstr ""
    "Content-Type: text/plain; charset=UTF-8\\n"

msgid "Hello"
msgstr "Bonjour"
`,
    check: (result: POFile) => {
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].msgid).toBe("Hello");
      expect(result.entries[0].msgstr).toBe("Bonjour");
      expect(result.charset).toBe("utf-8");
    },
  },
  {
    name: "PO file with multiple entries",
    input: `msgid ""
msgstr ""
    "Content-Type: text/plain; charset=UTF-8\\n"

msgid "Hello"
msgstr "Bonjour"

msgid "Goodbye"
msgstr "Au revoir"
`,
    check: (result: POFile) => {
      expect(result.entries).toHaveLength(2);
      expect(result.entries[0].msgid).toBe("Hello");
      expect(result.entries[1].msgid).toBe("Goodbye");
    },
  },
  {
    name: "PO file with fuzzy entry",
    input: `msgid ""
msgstr ""
    "Content-Type: text/plain; charset=UTF-8\\n"

#, fuzzy
msgid "Fuzzy"
msgstr ""
`,
    check: (result: POFile) => {
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].flags).toContain("fuzzy");
    },
  },
  {
    name: "PO file with header metadata",
    input: `msgid ""
msgstr ""
    "Content-Type: text/plain; charset=UTF-8\\n"
    "Language: fr\\n"
    "Project-Id-Version: Test\\n"

msgid "Hello"
msgstr "Bonjour"
`,
    check: (result: POFile) => {
      expect(result.header.language).toBe("fr");
      expect(result.header.projectIdVersion).toBe("Test");
    },
  },
  {
    name: "empty PO file returns empty entries",
    input: `msgid ""
msgstr ""
    "Content-Type: text/plain; charset=UTF-8\\n"
`,
    check: (result: POFile) => {
      expect(result.entries).toHaveLength(0);
    },
  },
  {
    name: "PO file with msgctxt",
    input: `msgid ""
msgstr ""
    "Content-Type: text/plain; charset=UTF-8\\n"

msgctxt "Button"
msgid "OK"
msgstr "Valider"
`,
    check: (result: POFile) => {
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].msgctxt).toBe("Button");
    },
  },
  {
    name: "PO file with plural forms",
    input: `msgid ""
msgstr ""
    "Content-Type: text/plain; charset=UTF-8\\n"
    "Plural-Forms: nplurals=2; plural=(n != 1);\\n"

msgid "one file"
msgid_plural "many files"
msgstr[0] "un fichier"
msgstr[1] "plusieurs fichiers"
`,
    check: (result: POFile) => {
      expect(result.entries).toHaveLength(1);
      const entry = result.entries[0];
      if (isPluralEntry(entry)) {
        expect(entry.msgidPlural).toBe("many files");
        expect(entry.msgstr).toEqual(["un fichier", "plusieurs fichiers"]);
      }
    },
  },
];

// Test data for POConverter.validate()
const validateTestCases = [
  {
    name: "valid PO content returns valid",
    input: `msgid ""
msgstr ""
    "Content-Type: text/plain; charset=UTF-8\\n"

msgid "Hello"
msgstr "Bonjour"
`,
    expectedValid: true,
  },
  {
    name: "invalid PO content returns invalid",
    input: `msgid "unclosed
msgstr "incomplete"
`,
    expectedValid: false,
    expectedError: true,
  },
  {
    name: "empty string is valid",
    input: ``,
    expectedValid: true,
  },
];

// ===== TESTS =====

describe("POConverter.parse", () => {
  parseTestCases.forEach(({ name, input, check }) => {
    it(name, () => {
      const result = poConverter.parse(input);
      check(result);
    });
  });
});

describe("POConverter.validate", () => {
  validateTestCases.forEach(({ name, input, expectedValid }) => {
    it(name, () => {
      const result = poConverter.validate(input);
      expect(result.valid).toBe(expectedValid);
    });
  });
});

describe("POConverter.compile", () => {
  it("compiles simple POFile to string", () => {
    const poFile = {
      charset: "utf-8",
      header: defaultHeader,
      entries: [
        {
          msgid: "Hello",
          msgstr: "Bonjour",
          flags: [],
          comments: {},
          obsolete: false,
        },
      ],
      obsolete: [],
    };

    const result = poConverter.compile(poFile);
    expect(result).toContain('msgid "Hello"');
    expect(result).toContain('msgstr "Bonjour"');
  });

  it("compiles entry with fuzzy flag", () => {
    const poFile = {
      charset: "utf-8",
      header: defaultHeader,
      entries: [
        {
          msgid: "Test",
          msgstr: "",
          flags: ["fuzzy"],
          comments: {},
          obsolete: false,
        },
      ],
      obsolete: [],
    };

    const result = poConverter.compile(poFile as unknown as POFile);
    expect(result).toContain("#, fuzzy");
  });

  it("compiles entry with msgctxt", () => {
    const poFile = {
      charset: "utf-8",
      header: defaultHeader,
      entries: [
        {
          msgid: "OK",
          msgstr: "Valider",
          msgctxt: "Button",
          flags: [],
          comments: {},
          obsolete: false,
        },
      ],
      obsolete: [],
    };

    const result = poConverter.compile(poFile);
    expect(result).toContain('msgctxt "Button"');
  });
});

describe("POConverter roundtrip", () => {
  it("parse then compile preserves msgid and msgstr", () => {
    const original = `msgid ""
msgstr ""
    "Content-Type: text/plain; charset=UTF-8\\n"

msgid "Hello"
msgstr "Bonjour"

msgid "World"
msgstr "Monde"
`;

    const parsed = poConverter.parse(original);
    const compiled = poConverter.compile(parsed);

    expect(compiled).toContain('msgid "Hello"');
    expect(compiled).toContain('msgstr "Bonjour"');
    expect(compiled).toContain('msgid "World"');
    expect(compiled).toContain('msgstr "Monde"');
  });
});
