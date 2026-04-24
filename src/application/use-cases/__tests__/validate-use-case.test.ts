import { describe, expect, it } from "vite-plus/test";

import { formatValidationResult, ValidatePOUseCase } from "../ValidatePOUseCase";

// ===== DONNÉES LOCALES POUR CE FICHIER =====

const validateTestCases = [
  {
    name: "valid PO file with translated entries",
    input: {
      poFile: {
        entries: [
          { msgid: "Hello", msgstr: "Bonjour", flags: [], comments: {}, obsolete: false },
          { msgid: "World", msgstr: "Monde", flags: [], comments: {}, obsolete: false },
        ],
        obsolete: [],
      },
    },
    check: (result: any) => {
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.statistics.translated).toBe(2);
      expect(result.statistics.untranslated).toBe(0);
    },
  },
  {
    name: "untranslated entry generates warning",
    input: {
      poFile: {
        entries: [{ msgid: "Hello", msgstr: "", flags: [], comments: {}, obsolete: false }],
        obsolete: [],
      },
    },
    check: (result: any) => {
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w: any) => w.message.includes("Untranslated"))).toBe(true);
    },
  },
  {
    name: "fuzzy entry counted correctly",
    input: {
      poFile: {
        entries: [
          { msgid: "Hello", msgstr: "Bonjour", flags: ["fuzzy"], comments: {}, obsolete: false },
        ],
        obsolete: [],
      },
    },
    check: (result: any) => {
      expect(result.statistics.fuzzy).toBe(1);
      expect(result.warnings.some((w: any) => w.message.includes("fuzzy"))).toBe(true);
    },
  },
  {
    name: "empty msgid with non-empty msgstr is error",
    input: {
      poFile: {
        entries: [{ msgid: "", msgstr: "Something", flags: [], comments: {}, obsolete: false }],
        obsolete: [],
      },
    },
    check: (result: any) => {
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: any) => e.message.includes("Empty msgid"))).toBe(true);
    },
  },
  {
    name: "strict mode with untranslated entries",
    input: {
      poFile: {
        entries: [{ msgid: "Hello", msgstr: "", flags: [], comments: {}, obsolete: false }],
        obsolete: [],
      },
      strictMode: true,
    },
    check: (result: any) => {
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: any) => e.message.includes("untranslated"))).toBe(true);
    },
  },
  {
    name: "plural entry without msgstrPlural is error",
    input: {
      poFile: {
        entries: [
          {
            msgid: "one file",
            msgstr: "",
            msgidPlural: "many files",
            msgstrPlural: [],
            flags: [],
            comments: {},
            obsolete: false,
          },
        ],
        obsolete: [],
      },
    },
    check: (result: any) => {
      expect(result.errors.some((e: any) => e.message.includes("Plural entry"))).toBe(true);
    },
  },
  {
    name: "obsolete entries generate warning",
    input: {
      poFile: {
        entries: [{ msgid: "Hello", msgstr: "Bonjour", flags: [], comments: {}, obsolete: false }],
        obsolete: [{ msgid: "Old", msgstr: "Vieux", flags: [], comments: {}, obsolete: true }],
      },
    },
    check: (result: any) => {
      expect(result.warnings.some((w: any) => w.message.includes("Obsolete"))).toBe(true);
    },
  },
  {
    name: "conflicting format flags generate warning",
    input: {
      poFile: {
        entries: [
          {
            msgid: "printf",
            msgstr: "%s",
            flags: ["c-format", "no-c-format"],
            comments: {},
            obsolete: false,
          },
        ],
        obsolete: [],
      },
    },
    check: (result: any) => {
      expect(result.warnings.some((w: any) => w.message.includes("Conflicting format flags"))).toBe(
        true,
      );
    },
  },
  {
    name: "multiple format flags generate warning",
    input: {
      poFile: {
        entries: [
          {
            msgid: "test",
            msgstr: "test",
            flags: ["python-format", "csharp-format"],
            comments: {},
            obsolete: false,
          },
        ],
        obsolete: [],
      },
    },
    check: (result: any) => {
      expect(result.warnings.some((w: any) => w.message.includes("Multiple format flags"))).toBe(
        true,
      );
    },
  },
  {
    name: "empty PO file is valid",
    input: {
      poFile: {
        entries: [],
        obsolete: [],
      },
    },
    check: (result: any) => {
      expect(result.valid).toBe(true);
      expect(result.statistics.total).toBe(0);
    },
  },
  {
    name: "missing PO file returns invalid",
    input: {
      poFile: null as any,
    },
    check: (result: any) => {
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toBe("PO file is required");
    },
  },
];

// ===== TESTS =====

describe("ValidatePOUseCase.execute", () => {
  validateTestCases.forEach(({ name, input, check }) => {
    it(name, () => {
      const useCase = new ValidatePOUseCase();
      const result = useCase.execute(input as any);
      check(result);
    });
  });
});

describe("formatValidationResult", () => {
  it("formats valid result correctly", () => {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      statistics: { total: 5, translated: 3, untranslated: 2, fuzzy: 0 },
    };

    const formatted = formatValidationResult(result);

    expect(formatted).toContain("✓ PO file is valid");
    expect(formatted).toContain("Total entries: 5");
    expect(formatted).toContain("Translated: 3");
  });

  it("formats errors correctly", () => {
    const result = {
      valid: false,
      errors: [{ type: "error" as const, message: "Test error", entry: "test" }],
      warnings: [],
      statistics: { total: 1, translated: 0, untranslated: 1, fuzzy: 0 },
    };

    const formatted = formatValidationResult(result);

    expect(formatted).toContain("✗ PO file has errors");
    expect(formatted).toContain("Test error");
  });

  it("formats warnings correctly", () => {
    const result = {
      valid: true,
      errors: [],
      warnings: [{ type: "warning" as const, message: "Test warning", entry: "test" }],
      statistics: { total: 1, translated: 0, untranslated: 1, fuzzy: 0 },
    };

    const formatted = formatValidationResult(result);

    expect(formatted).toContain("Warnings:");
    expect(formatted).toContain("Test warning");
  });
});
