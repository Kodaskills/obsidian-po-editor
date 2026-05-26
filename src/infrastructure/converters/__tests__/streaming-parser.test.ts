import { isPluralEntry } from "@domain/index";
import { POStreamingParser } from "@infrastructure/converters/POStreamingParser";
import { describe, expect, it } from "vite-plus/test";

describe("POStreamingParser (State Machine)", () => {
  const parser = new POStreamingParser();

  it("parses a basic PO file correctly", async () => {
    const content = `
msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"
"Language: fr\\n"

msgid "Hello"
msgstr "Bonjour"

msgid "World"
msgstr "Monde"
    `;

    const result = await parser.parseInChunks(content);
    expect(result.poFile.header.language).toBe("fr");
    expect(result.poFile.entries).toHaveLength(2);
    expect(result.poFile.entries[0].msgid).toBe("Hello");
    expect(result.poFile.entries[0].msgstr).toBe("Bonjour");
  });

  it("handles multi-line strings", async () => {
    const content = `
msgid "Multi"
"line"
msgstr "Multi"
"ligne"
    `;
    const result = await parser.parseInChunks(content);
    expect(result.poFile.entries[0].msgid).toBe("Multiline");
    expect(result.poFile.entries[0].msgstr).toBe("Multiligne");
  });

  it("handles plural forms", async () => {
    const content = `
msgid "one file"
msgid_plural "many files"
msgstr[0] "un fichier"
msgstr[1] "plusieurs fichiers"
    `;
    const result = await parser.parseInChunks(content);
    const entry = result.poFile.entries[0];
    if (isPluralEntry(entry)) {
      expect(entry.msgidPlural).toBe("many files");
      expect(entry.msgstr).toEqual(["un fichier", "plusieurs fichiers"]);
    }
  });

  it("handles comments and flags", async () => {
    const content = `
#. Extracted comment
#: src/main.ts:10
#, fuzzy, c-format
msgid "Fuzzy %s"
msgstr "Flou %s"
    `;
    const result = await parser.parseInChunks(content);
    const entry = result.poFile.entries[0];
    expect(entry.flags).toContain("fuzzy");
    expect(entry.flags).toContain("c-format");
    expect(entry.comments?.extracted).toBe("Extracted comment");
    expect(entry.comments?.reference).toBe("src/main.ts:10");
  });

  it("handles obsolete entries", async () => {
    const content = `
#~ msgid "Old"
#~ msgstr "Ancien"
    `;
    const result = await parser.parseInChunks(content);
    expect(result.poFile.entries[0].obsolete).toBe(true);
    expect(result.poFile.entries[0].msgid).toBe("Old");
    expect(result.poFile.entries[0].msgstr).toBe("Ancien");
  });

  it("yields to the main thread during large parsing", async () => {
    let callCount = 0;
    const content = Array(1000).fill('msgid "test"\nmsgstr "test"\n').join("\n");

    const result = await parser.parseInChunks(content, {
      yieldInterval: 100,
      onProgress: () => {
        callCount++;
      },
    });

    expect(result.poFile.entries.length).toBe(1000);
    expect(callCount).toBeGreaterThan(0);
  });
});
