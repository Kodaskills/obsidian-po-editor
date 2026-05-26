import {
  ConverterRegistry,
  ConvertToFormat,
  suggestTargetFormat,
  type ConvertToFormatInput,
  type TranslationFormat,
} from "@application/index";
import { JsonConverter } from "@infrastructure/converters/JsonYamlConverter";
import { YamlConverter } from "@infrastructure/converters/JsonYamlConverter";
import { POConverter } from "@infrastructure/converters/POConverter";
import { XLIFFConverter } from "@infrastructure/converters/XLIFFConverter";
import { describe, expect, it } from "vite-plus/test";

const poConverter = new POConverter();
const jsonConverter = new JsonConverter();
const yamlConverter = new YamlConverter();
const xliffConverter = new XLIFFConverter();

function makeRegistry(
  ...converters: Parameters<ConverterRegistry["register"]>[0][]
): ConverterRegistry {
  const registry = new ConverterRegistry();
  for (const c of converters) registry.register(c);
  return registry;
}

// ===== DONNÉES LOCALES POUR CE FICHIER =====

const convertTestCases = [
  {
    name: "convert to JSON successfully",
    input: {
      poFile: {
        charset: "utf-8",
        header: { content: "", metadata: { "Content-Type": "text/plain; charset=UTF-8" } },
        entries: [{ msgid: "Hello", msgstr: "Bonjour", flags: [], comments: {}, obsolete: false }],
        obsolete: [],
      },
      targetFormat: "json" as const,
    },
    expectedSuccess: true,
  },
  {
    name: "convert to YAML successfully",
    input: {
      poFile: {
        charset: "utf-8",
        header: { content: "", metadata: { "Content-Type": "text/plain; charset=UTF-8" } },
        entries: [{ msgid: "Hello", msgstr: "Bonjour", flags: [], comments: {}, obsolete: false }],
        obsolete: [],
      },
      targetFormat: "yaml" as const,
    },
    expectedSuccess: true,
  },
  {
    name: "convert to XLIFF successfully",
    input: {
      poFile: {
        charset: "utf-8",
        header: { content: "", metadata: { "Content-Type": "text/plain; charset=UTF-8" } },
        entries: [{ msgid: "Hello", msgstr: "Bonjour", flags: [], comments: {}, obsolete: false }],
        obsolete: [],
      },
      targetFormat: "xliff" as const,
    },
    expectedSuccess: true,
  },
  {
    name: "missing PO file returns error",
    input: {
      poFile: null as unknown,
      targetFormat: "json" as const,
    },
    expectedSuccess: false,
    expectedError: "PO file is required",
  },
  {
    name: "missing target format returns error",
    input: {
      poFile: {
        charset: "utf-8",
        header: { content: "", metadata: {} },
        entries: [],
        obsolete: [],
      },
      targetFormat: undefined as unknown,
    },
    expectedSuccess: false,
    expectedError: "Target format is required",
  },
  {
    name: "unsupported format returns error",
    input: {
      poFile: {
        charset: "utf-8",
        header: { content: "", metadata: {} },
        entries: [],
        obsolete: [],
      },
      targetFormat: "invalid-format" as unknown,
    },
    expectedSuccess: false,
    expectedError: "Unsupported format",
  },
  {
    name: "plural forms generate warning",
    input: {
      poFile: {
        charset: "utf-8",
        header: { content: "", metadata: { "Content-Type": "text/plain; charset=UTF-8" } },
        entries: [
          {
            msgid: "one file",
            msgstr: "un fichier",
            msgidPlural: "many files",
            msgstrPlural: ["un fichier", "plusieurs fichiers"],
            flags: [],
            comments: {},
            obsolete: false,
          },
        ],
        obsolete: [],
      },
      targetFormat: "json" as const,
    },
    expectedSuccess: true,
    expectedWarning: "Plural forms",
  },
  {
    name: "fuzzy flags generate warning",
    input: {
      poFile: {
        charset: "utf-8",
        header: { content: "", metadata: { "Content-Type": "text/plain; charset=UTF-8" } },
        entries: [
          { msgid: "Hello", msgstr: "Bonjour", flags: ["fuzzy"], comments: {}, obsolete: false },
        ],
        obsolete: [],
      },
      targetFormat: "json" as const,
    },
    expectedSuccess: true,
    expectedWarning: "Fuzzy",
  },
];

const suggestTestCases = [
  { name: "from PO suggests all formats", input: "po", expected: ["xliff", "json", "yaml", "arb"] },
  { name: "from JSON suggests alternatives", input: "json", expected: ["po", "xliff", "arb"] },
  { name: "from YAML suggests alternatives", input: "yaml", expected: ["po", "xliff", "arb"] },
  {
    name: "from XLIFF suggests alternatives",
    input: "xliff-1.2",
    expected: ["po", "json", "yaml"],
  },
  { name: "from ARB suggests alternatives", input: "arb", expected: ["po", "json", "xliff"] },
];

// ===== TESTS =====

describe("ConvertToFormat.execute", () => {
  convertTestCases.forEach(({ name, input, expectedSuccess, expectedError, expectedWarning }) => {
    it(name, () => {
      const useCase = new ConvertToFormat(
        makeRegistry(poConverter, jsonConverter, yamlConverter, xliffConverter),
      );
      const result = useCase.execute(input as ConvertToFormatInput);

      expect(result.success).toBe(expectedSuccess);

      if (expectedError) {
        expect(result.error).toContain(expectedError);
      }

      if (expectedWarning) {
        expect(result.warnings?.some((w) => w.includes(expectedWarning))).toBe(true);
      }
    });
  });
});

describe("ConvertToFormat.getSupportedFormats", () => {
  it("returns registered formats", () => {
    const useCase = new ConvertToFormat(
      makeRegistry(poConverter, jsonConverter, yamlConverter, xliffConverter),
    );
    const formats = useCase.getSupportedFormats();

    expect(formats).toContain("po");
    expect(formats).toContain("json");
  });
});

describe("ConvertToFormat.canConvertTo", () => {
  it("returns true for supported formats", () => {
    const useCase = new ConvertToFormat(
      makeRegistry(poConverter, jsonConverter, yamlConverter, xliffConverter),
    );

    expect(useCase.canConvertTo("po")).toBe(true);
    expect(useCase.canConvertTo("json")).toBe(true);
  });

  it("returns false for unsupported formats", () => {
    const useCase = new ConvertToFormat(makeRegistry(poConverter));

    expect(useCase.canConvertTo("unknown" as TranslationFormat)).toBe(false);
  });
});

describe("suggestTargetFormat", () => {
  suggestTestCases.forEach(({ name, input, expected }) => {
    it(name, () => {
      const result = suggestTargetFormat(input as TranslationFormat);
      expect(result).toEqual(expected);
    });
  });
});
