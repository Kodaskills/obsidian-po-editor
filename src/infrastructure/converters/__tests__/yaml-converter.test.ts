import { type POFile } from "@domain/index";

import { YamlConverter } from "../JsonYamlConverter";
const yamlConverter = new YamlConverter();
import { describe, expect, it } from "vite-plus/test";

// ===== DONNÉES LOCALES POUR CE FICHIER =====

const parseTestCases = [
  {
    name: "simple YAML key-value",
    input: `hello: Bonjour
goodbye: Au revoir`,
    check: (result: POFile) => {
      expect(result.entries).toHaveLength(2);
      expect(
        result.entries.find((e: POFile["entries"][number]) => e.msgid === "hello")?.msgstr,
      ).toBe("Bonjour");
    },
  },
  {
    name: "nested YAML",
    input: `greeting:
  hello: Bonjour
  goodbye: Au revoir`,
    check: (result: POFile) => {
      expect(result.entries).toHaveLength(2);
      expect(
        result.entries.find((e: POFile["entries"][number]) => e.msgid === "greeting.hello")?.msgstr,
      ).toBe("Bonjour");
    },
  },
  {
    name: "YAML with quoted strings",
    input: `message: "Hello World"
`,
    check: (result: POFile) => {
      expect(result.entries[0].msgstr).toBe("Hello World");
    },
  },
];

const compileTestCases = [
  {
    name: "simple entries to YAML",
    input: {
      entries: [
        { msgid: "hello", msgstr: "Bonjour", flags: [], comments: {}, obsolete: false },
        { msgid: "goodbye", msgstr: "Au revoir", flags: [], comments: {}, obsolete: false },
      ],
    },
    check: (result: string) => {
      expect(result).toContain("hello: Bonjour");
      expect(result).toContain("goodbye: Au revoir");
    },
  },
  {
    name: "nested entries to YAML",
    input: {
      entries: [
        { msgid: "greeting.hello", msgstr: "Bonjour", flags: [], comments: {}, obsolete: false },
      ],
    },
    check: (result: string) => {
      expect(result).toContain("greeting:");
      expect(result).toContain("hello: Bonjour");
    },
  },
  {
    name: "empty entries returns empty object",
    input: { entries: [] },
    check: (result: string) => {
      expect(result.trim()).toBe("{}");
    },
  },
];

// ===== TESTS =====

describe("YamlConverter.parse", () => {
  parseTestCases.forEach(({ name, input, check }) => {
    it(name, () => {
      const result = yamlConverter.parse(input);
      check(result);
    });
  });
});

describe("YamlConverter.compile", () => {
  compileTestCases.forEach(({ name, input, check }) => {
    it(name, () => {
      const result = yamlConverter.compile(input as unknown as POFile);
      check(result);
    });
  });
});
