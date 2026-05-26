import { filterEntries } from "@application/services/POFilterService";
import { createPluralEntry, createSingularEntry, isPluralEntry, type POEntry } from "@domain/index";
import { describe, expect, it } from "vite-plus/test";

describe("POFilterService", () => {
  const entries: POEntry[] = [
    createSingularEntry("Hello", "Bonjour"),
    createSingularEntry("World", ""), // Untranslated
    createSingularEntry("Fuzzy", "Flou", { flags: ["fuzzy"] }),
    createSingularEntry("Context", "Contexte", { msgctxt: "Menu" }),
    createSingularEntry("Obsolete", "Obsolète", { obsolete: true }),
  ];

  it("filters by search term in msgid", () => {
    const result = filterEntries(entries, { search: "hello" });
    expect(result).toHaveLength(1);
    expect(result[0].msgid).toBe("Hello");
  });

  it("filters by search term in msgstr", () => {
    const result = filterEntries(entries, { search: "bonjour" });
    expect(result).toHaveLength(1);
    expect(result[0].msgid).toBe("Hello");
  });

  it("filters by context", () => {
    const result = filterEntries(entries, { contexts: ["Menu"] });
    expect(result).toHaveLength(1);
    expect(result[0].msgid).toBe("Context");
  });

  it("filters by status: translated", () => {
    const result = filterEntries(entries, { statuses: ["translated"] });
    // Hello, Fuzzy, Context, Obsolete are translated (non-empty msgstr)
    // World is not.
    expect(result).toHaveLength(4);
    expect(result.find((e) => e.msgid === "World")).toBeUndefined();
  });

  it("filters by status: untranslated (no project context)", () => {
    const result = filterEntries(entries, { statuses: ["untranslated"] });
    expect(result).toHaveLength(1);
    expect(result[0].msgid).toBe("World");
  });

  it("filters by status: fuzzy", () => {
    const result = filterEntries(entries, { statuses: ["fuzzy"] });
    expect(result).toHaveLength(1);
    expect(result[0].msgid).toBe("Fuzzy");
  });

  it("filters by status: obsolete", () => {
    const result = filterEntries(entries, { statuses: ["obsolete"] });
    expect(result).toHaveLength(1);
    expect(result[0].msgid).toBe("Obsolete");
  });

  it("filters by type: singular", () => {
    const mixedEntries: POEntry[] = [
      createSingularEntry("Singular", "translated"),
      createPluralEntry("Plural", "Plurals", ["translated"]),
    ];
    const result = filterEntries(mixedEntries, { types: ["singular"] });
    expect(result).toHaveLength(1);
    expect(result.every((e) => !isPluralEntry(e))).toBe(true);
    expect(result[0].msgid).toBe("Singular");
  });

  it("filters by type: plural", () => {
    const mixedEntries: POEntry[] = [
      createSingularEntry("Singular", "translated"),
      createPluralEntry("Plural", "Plurals", ["translated"]),
    ];
    const result = filterEntries(mixedEntries, { types: ["plural"] });
    expect(result).toHaveLength(1);
    expect(result.every((e) => isPluralEntry(e))).toBe(true);
    expect(result[0].msgid).toBe("Plural");
  });

  it("filters by type: singular and plural shows all", () => {
    const mixedEntries: POEntry[] = [
      createSingularEntry("Singular", "translated"),
      createPluralEntry("Plural", "Plurals", ["translated"]),
    ];
    const result = filterEntries(mixedEntries, { types: ["singular", "plural"] });
    expect(result).toHaveLength(2);
  });

  describe("Plural Entry with Empty msgstr", () => {
    const pluralEntries: POEntry[] = [
      createSingularEntry("Hello", "Bonjour"),
      createSingularEntry("World", ""),
      createPluralEntry("PluralUntranslated", "PluralUntranslated", []),
      createPluralEntry("PluralEmpty", "PluralEmpty", [""]),
      createPluralEntry("PluralTranslated", "PluralTranslated", ["Traduit"]),
      createPluralEntry("PartialFirst", "PartialFirst s", ["filled", ""]),
      createPluralEntry("PartialSecond", "PartialSecond s", ["", "filled"]),
      createPluralEntry("FullTwoForms", "FullTwoForms s", ["first", "second"]),
    ];

    it("empty plural msgstr array is not translated", () => {
      const result = filterEntries(pluralEntries, { statuses: ["translated"] });
      expect(result.map((e) => e.msgid)).not.toContain("PluralUntranslated");
      expect(result.map((e) => e.msgid)).not.toContain("PluralEmpty");
      expect(result.map((e) => e.msgid)).not.toContain("PartialFirst");
      expect(result.map((e) => e.msgid)).not.toContain("PartialSecond");
      expect(result.map((e) => e.msgid)).toContain("Hello");
      expect(result.map((e) => e.msgid)).toContain("PluralTranslated");
      expect(result.map((e) => e.msgid)).toContain("FullTwoForms");
      expect(result).toHaveLength(3);
    });

    it("partial plurals show in untranslated", () => {
      const result = filterEntries(pluralEntries, { statuses: ["untranslated"] });
      expect(result.map((e) => e.msgid)).toContain("PluralUntranslated");
      expect(result.map((e) => e.msgid)).toContain("PluralEmpty");
      expect(result.map((e) => e.msgid)).toContain("PartialFirst");
      expect(result.map((e) => e.msgid)).toContain("PartialSecond");
      expect(result.map((e) => e.msgid)).toContain("World");
      expect(result.map((e) => e.msgid)).not.toContain("PluralTranslated");
      expect(result.map((e) => e.msgid)).not.toContain("Hello");
      expect(result.map((e) => e.msgid)).not.toContain("FullTwoForms");
    });
  });

  it("translated singular entry is NOT in untranslated filter (regression: Focus from nl.po)", () => {
    const focusEntry = createSingularEntry("Focus", "1ZAqXWAVFr6AoiU");
    const resultUntranslated = filterEntries([focusEntry], { statuses: ["untranslated"] });
    expect(resultUntranslated).toHaveLength(0);

    const resultTranslated = filterEntries([focusEntry], { statuses: ["translated"] });
    expect(resultTranslated).toHaveLength(1);
  });

  it("translated plural entry with all forms is NOT in untranslated filter (regression: Available Row Forward)", () => {
    const entry = createPluralEntry("Available Row Forward", "Available Row Forward s", [
      "rHNwdgtDb8Ws4WHtjRR6T9euDaudQka trnsltd ",
      "7fPaYSX8D99MrezchKFPkAg1Gub06",
    ]);
    const resultUntranslated = filterEntries([entry], { statuses: ["untranslated"] });
    expect(resultUntranslated).toHaveLength(0);

    const resultTranslated = filterEntries([entry], { statuses: ["translated"] });
    expect(resultTranslated).toHaveLength(1);
  });

  it("partial plural (some forms empty) is in untranslated, not translated", () => {
    const partialFirst = createPluralEntry("Error Table", "Error Table s", [
      "SyjmokO kQQWZATcTwtypP06jnhsGfiltrg",
      "",
    ]);
    const partialSecond = createPluralEntry("Link Ready Loading", "Link Ready Loading s", [
      "LwWqLpHlxZB xd6cTrj6UExGLY8GgIZ3X",
      "",
    ]);
    const allEntries = [partialFirst, partialSecond];

    const untranslatedResult = filterEntries(allEntries, { statuses: ["untranslated"] });
    expect(untranslatedResult).toHaveLength(2);

    const translatedResult = filterEntries(allEntries, { statuses: ["translated"] });
    expect(translatedResult).toHaveLength(0);
  });

  describe("Filters are current-file only (sibling context not used)", () => {
    const mainEntries = [
      createSingularEntry("Common", "Translated in main"),
      createSingularEntry("MissingInSibling", "Translated in main"),
      createSingularEntry("UntranslatedInSibling", "Translated in main"),
      createSingularEntry("FuzzyInSibling", "Translated in main"),
    ];

    const projectContext = {
      siblingEntries: [
        {
          language: "es",
          entries: [
            createSingularEntry("Common", "Traducido"),
            // MissingInSibling is missing entirely from sibling
            createSingularEntry("UntranslatedInSibling", ""), // Untranslated in sibling
            createSingularEntry("FuzzyInSibling", "Fuzzy", { flags: ["fuzzy"] }),
          ],
        },
      ],
    };

    it("current-file translated entry does NOT show in untranslated even if missing in sibling", () => {
      const result = filterEntries(mainEntries, { statuses: ["untranslated"] }, projectContext);
      expect(result).toHaveLength(0);
    });

    it("current-file non-fuzzy entry does NOT show as fuzzy even if fuzzy in sibling", () => {
      const result = filterEntries(mainEntries, { statuses: ["fuzzy"] }, projectContext);
      expect(result).toHaveLength(0);
    });

    it("flags filter only checks current file, not siblings", () => {
      const result = filterEntries(mainEntries, { flags: ["fuzzy"] }, projectContext);
      expect(result).toHaveLength(0);
    });
  });
});
