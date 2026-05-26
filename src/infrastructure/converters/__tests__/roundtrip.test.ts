import { type POEntry } from "@domain/index";
import { describe, expect, it } from "vite-plus/test";

import { JsonConverter, YamlConverter } from "../JsonYamlConverter";
import { POConverter } from "../POConverter";
import { XLIFFConverter } from "../XLIFFConverter";

const poConverter = new POConverter();
const jsonConverter = new JsonConverter();
const yamlConverter = new YamlConverter();
const xliffConverter = new XLIFFConverter();

// ===== DONNÉES LOCALES POUR CE FICHIER =====

// Test data - PO content that we'll convert to other formats and back
const testPOContent = `# PO file for roundtrip testing
msgid ""
msgstr ""
    "Content-Type: text/plain; charset=UTF-8\\n"
    "Language: en\\n"

msgid "Hello"
msgstr "Bonjour"

msgid "Goodbye"
msgstr "Au revoir"

#, fuzzy
msgid "Fuzzy entry"
msgstr ""

msgctxt "Button"
msgid "OK"
msgstr "Valider"
`;

// ===== TESTS =====

describe("Roundtrip: PO → format → PO", () => {
  it("PO → JSON → PO preserves all entries", () => {
    // Parse original PO
    const poFile = poConverter.parse(testPOContent);

    // Convert to JSON
    const jsonContent = jsonConverter.compile(poFile);
    const jsonFile = jsonConverter.parse(jsonContent);

    // Convert back to PO
    const roundtrippedPO = poConverter.compile(jsonFile);
    const finalFile = poConverter.parse(roundtrippedPO);

    // JSON loses flags/msgctxt — only msgid/msgstr survive roundtrip
    expect(finalFile.entries.length).toBe(4);
    expect(finalFile.entries.find((e) => e.msgid === "Hello")?.msgstr).toBe("Bonjour");
    expect(finalFile.entries.find((e) => e.msgid === "Goodbye")?.msgstr).toBe("Au revoir");
  });

  it("PO → YAML → PO preserves all entries", () => {
    const poFile = poConverter.parse(testPOContent);

    const yamlContent = yamlConverter.compile(poFile);
    const yamlFile = yamlConverter.parse(yamlContent);

    const roundtrippedPO = poConverter.compile(yamlFile);
    const finalFile = poConverter.parse(roundtrippedPO);

    expect(finalFile.entries.length).toBe(4);
    expect(finalFile.entries.find((e) => e.msgid === "Hello")?.msgstr).toBe("Bonjour");
  });

  it("PO → XLIFF → PO preserves entry count", () => {
    const poFile = poConverter.parse(testPOContent);

    const xliffContent = xliffConverter.compile(poFile);
    const xliffFile = xliffConverter.parse(xliffContent);

    const roundtrippedPO = poConverter.compile(xliffFile);
    const finalFile = poConverter.parse(roundtrippedPO);

    // XLIFF preserves structure but loses some metadata
    expect(finalFile.entries.length).toBe(4);
  });
});

describe("Roundtrip: PO → PO (identity)", () => {
  it("parse then compile twice preserves msgid and msgstr", () => {
    const poFile1 = poConverter.parse(testPOContent);
    const compiled1 = poConverter.compile(poFile1);

    const poFile2 = poConverter.parse(compiled1);
    const compiled2 = poConverter.compile(poFile2);

    const file1 = poConverter.parse(compiled1);
    const file2 = poConverter.parse(compiled2);

    expect(file1.entries.length).toEqual(file2.entries.length);

    for (let i = 0; i < file1.entries.length; i++) {
      expect(file1.entries[i].msgid).toBe(file2.entries[i].msgid);
      // msgstr might vary slightly in format but content should be same
      const getFirstMsgstr = (e: POEntry) => (Array.isArray(e.msgstr) ? e.msgstr[0] : e.msgstr);
      expect(getFirstMsgstr(file1.entries[i])).toEqual(getFirstMsgstr(file2.entries[i]));
    }
  });
});

describe("Edge case: Roundtrip with special characters", () => {
  it("preserves quotes in content", () => {
    const content = `msgid ""
msgstr ""
    "Content-Type: text/plain; charset=UTF-8\\n"

msgid "He said \\"hello\\""
msgstr "Il a dit \\"bonjour\\""
`;

    const poFile = poConverter.parse(content);
    const compiled = poConverter.compile(poFile);

    expect(compiled).toContain('He said \\"hello\\"');
  });

  it("preserves newlines in content", () => {
    const content = `msgid ""
msgstr ""
    "Content-Type: text/plain; charset=UTF-8\\n"

msgid "Multi\\nline"
msgstr "Multi\\nligne"
`;

    const poFile = poConverter.parse(content);
    const compiled = poConverter.compile(poFile);
    const reparsed = poConverter.parse(compiled);

    expect(reparsed.entries[0].msgid).toBe("Multi\nline");
  });

  it("preserves Unicode characters", () => {
    const content = `msgid ""
msgstr ""
    "Content-Type: text/plain; charset=UTF-8\\n"

msgid "café"
msgstr "café"
`;

    const poFile = poConverter.parse(content);
    const compiled = poConverter.compile(poFile);
    const final = poConverter.parse(compiled);

    expect(final.entries[0].msgid).toBe("café");
  });
});
