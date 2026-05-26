import {
  getPluralFormLabels,
  getPluralFormSpec,
  parseNplurals,
  pluralFormsHeader,
} from "@domain/index";
import { describe, expect, it } from "vite-plus/test";

// ===== DONNÉES LOCALES POUR CE FICHIER =====

const getPluralFormSpecCases = [
  { name: "English", input: "en", expectedPlural: "(n != 1)", expectedNplurals: 2 },
  { name: "French", input: "fr", expectedPlural: "(n > 1)", expectedNplurals: 2 },
  { name: "Japanese", input: "ja", expectedPlural: "0", expectedNplurals: 1 },
  {
    name: "Russian",
    input: "ru",
    expectedPlural:
      "(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2)",
    expectedNplurals: 3,
  },
  {
    name: "Arabic",
    input: "ar",
    expectedPlural:
      "(n==0 ? 0 : n==1 ? 1 : n==2 ? 2 : n%100>=3 && n%100<=10 ? 3 : n%100>=11 && n%100<=99 ? 4 : 5)",
    expectedNplurals: 6,
  },
  {
    name: "Slovenian",
    input: "sl",
    expectedPlural: "(n%100==1 ? 0 : n%100==2 ? 1 : n%100==3 || n%100==4 ? 2 : 3)",
    expectedNplurals: 4,
  },
  {
    name: "Polish",
    input: "pl",
    expectedPlural: "(n==1 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2)",
    expectedNplurals: 3,
  },
  { name: "German (lowercase)", input: "de", expectedPlural: "(n != 1)", expectedNplurals: 2 },
  { name: "German (uppercase)", input: "DE", expectedPlural: "(n != 1)", expectedNplurals: 2 },
  {
    name: "Portuguese (underscore)",
    input: "pt_br",
    expectedPlural: "(n > 1)",
    expectedNplurals: 2,
  },
  {
    name: "Unknown language falls back to English",
    input: "xyz",
    expectedPlural: "(n != 1)",
    expectedNplurals: 2,
  },
];

const pluralFormsHeaderCases = [
  {
    name: "English plural forms",
    input: { nplurals: 2, plural: "(n != 1)" },
    expected: "nplurals=2; plural=(n != 1);",
  },
  {
    name: "French plural forms",
    input: { nplurals: 2, plural: "(n > 1)" },
    expected: "nplurals=2; plural=(n > 1);",
  },
  {
    name: "Japanese singular",
    input: { nplurals: 1, plural: "0" },
    expected: "nplurals=1; plural=0;",
  },
  {
    name: "Russian plural",
    input: {
      nplurals: 3,
      plural: "(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2)",
    },
    expected:
      "nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);",
  },
];

const parseNpluralsCases = [
  { name: "standard 2", input: "nplurals=2; plural=(n != 1);", expected: 2 },
  {
    name: "standard 3",
    input: "nplurals=3; plural=(n==1 ? 0 : n>=2 && n<=4 ? 1 : 2);",
    expected: 3,
  },
  { name: "single form", input: "nplurals=1; plural=0;", expected: 1 },
  { name: "invalid returns default", input: "invalid", expected: 2 },
  { name: "empty returns default", input: "", expected: 2 },
];

const getPluralFormLabelsCases = [
  { name: "1 form", input: 1, expected: ["Other"] },
  { name: "2 forms", input: 2, expected: ["One", "Other"] },
  { name: "3 forms", input: 3, expected: ["One", "Few", "Other"] },
  { name: "4 forms", input: 4, expected: ["One", "Two", "Few", "Other"] },
  { name: "6 forms", input: 6, expected: ["Zero", "One", "Two", "Few", "Many", "Other"] },
  { name: "0 returns empty array", input: 0, expected: [] },
];

// ===== TESTS =====

describe("getPluralFormSpec", () => {
  getPluralFormSpecCases.forEach(({ name, input, expectedPlural, expectedNplurals }) => {
    it(name, () => {
      const result = getPluralFormSpec(input);
      expect(result.plural).toBe(expectedPlural);
      expect(result.nplurals).toBe(expectedNplurals);
    });
  });
});

describe("pluralFormsHeader", () => {
  pluralFormsHeaderCases.forEach(({ name, input, expected }) => {
    it(name, () => {
      const result = pluralFormsHeader(input);
      expect(result).toBe(expected);
    });
  });
});

describe("parseNplurals", () => {
  parseNpluralsCases.forEach(({ name, input, expected }) => {
    it(name, () => {
      const result = parseNplurals(input);
      expect(result).toBe(expected);
    });
  });
});

describe("getPluralFormLabels", () => {
  getPluralFormLabelsCases.forEach(({ name, input, expected }) => {
    it(name, () => {
      const result = getPluralFormLabels(input);
      expect(result).toEqual(expected);
    });
  });
});
