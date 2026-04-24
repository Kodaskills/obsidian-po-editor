import { describe, expect, it } from "vite-plus/test";

import { createPOHeader } from "../../../domain/entities/POHeader";
import { XLIFFConverter } from "../XLIFFConverter";

const xliffConverter = new XLIFFConverter();

// ===== DONNÉES LOCALES POUR CE FICHIER =====

const parseTestCases = [
  {
    name: "basic XLIFF with single unit",
    input: `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file original="messages" source-language="en" target-language="fr" datatype="plaintext">
    <body>
      <trans-unit id="Hello">
        <source>Hello</source>
        <target>Bonjour</target>
      </trans-unit>
    </body>
  </file>
</xliff>`,
    check: (result: any) => {
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].msgid).toBe("Hello");
      expect(result.entries[0].msgstr).toBe("Bonjour");
      expect(result.header.language).toBe("fr");
    },
  },
  {
    name: "XLIFF with fuzzy state",
    input: `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2">
  <file original="messages" source-language="en" target-language="de">
    <body>
      <trans-unit id="Test">
        <source>Test</source>
        <target state="needs-adaptation">Test</target>
      </trans-unit>
    </body>
  </file>
</xliff>`,
    check: (result: any) => {
      expect(result.entries[0].flags).toContain("fuzzy");
    },
  },
  {
    name: "XLIFF with note",
    input: `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2">
  <file original="messages" source-language="en">
    <body>
      <trans-unit id="Hello">
        <source>Hello</source>
        <target>Bonjour</target>
        <note>This is a note</note>
      </trans-unit>
    </body>
  </file>
</xliff>`,
    check: (result: any) => {
      expect(result.entries[0].comments.translator).toBe("This is a note");
    },
  },
  {
    name: "XLIFF with special characters needing escape",
    input: `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2">
  <file original="messages" source-language="en">
    <body>
      <trans-unit id="quote">
        <source>He said &quot;hello&quot;</source>
        <target>Il a dit &quot;bonjour&quot;</target>
      </trans-unit>
    </body>
  </file>
</xliff>`,
    check: (result: any) => {
      expect(result.entries[0].msgid).toBe('He said "hello"');
      expect(result.entries[0].msgstr).toBe('Il a dit "bonjour"');
    },
  },
  {
    name: "XLIFF with multiple units",
    input: `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2">
  <file original="messages" source-language="en" target-language="fr">
    <body>
      <trans-unit id="hello">
        <source>Hello</source>
        <target>Bonjour</target>
      </trans-unit>
      <trans-unit id="goodbye">
        <source>Goodbye</source>
        <target>Au revoir</target>
      </trans-unit>
    </body>
  </file>
</xliff>`,
    check: (result: any) => {
      expect(result.entries).toHaveLength(2);
    },
  },
  {
    name: "XLIFF empty body",
    input: `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2">
  <file original="messages" source-language="en">
    <body>
    </body>
  </file>
</xliff>`,
    check: (result: any) => {
      expect(result.entries).toHaveLength(0);
    },
  },
];

const compileTestCases = [
  {
    name: "compile simple POFile to XLIFF",
    input: {
      entries: [{ msgid: "Hello", msgstr: "Bonjour", flags: [], comments: {}, obsolete: false }],
      header: createPOHeader("fr"),
    },
    check: (result: string) => {
      expect(result).toContain("<source>Hello</source>");
      expect(result).toContain("<target");
      expect(result).toContain("Bonjour");
      expect(result).toContain('source-language="en"');
      expect(result).toContain('target-language="fr"');
    },
  },
  {
    name: "compile entry with fuzzy flag",
    input: {
      entries: [{ msgid: "Test", msgstr: "", flags: ["fuzzy"], comments: {}, obsolete: false }],
      header: { content: "", metadata: {} },
    },
    check: (result: string) => {
      expect(result).toContain('state="needs-adaptation"');
    },
  },
  {
    name: "compile entry with note",
    input: {
      entries: [
        {
          msgid: "Hello",
          msgstr: "Bonjour",
          flags: [],
          comments: { translator: "A greeting" },
          obsolete: false,
        },
      ],
      header: { content: "", metadata: {} },
    },
    check: (result: string) => {
      expect(result).toContain("<note>A greeting</note>");
    },
  },
  {
    name: "compile entry with special characters",
    input: {
      entries: [
        { msgid: "Test", msgstr: "Hello <World>", flags: [], comments: {}, obsolete: false },
      ],
      header: { content: "", metadata: {} },
    },
    check: (result: string) => {
      expect(result).toContain("&lt;");
      expect(result).toContain("&gt;");
    },
  },
];

// ===== TESTS =====

describe("XLIFFConverter.parse", () => {
  parseTestCases.forEach(({ name, input, check }) => {
    it(name, () => {
      const result = xliffConverter.parse(input);
      check(result);
    });
  });
});

describe("XLIFFConverter.compile", () => {
  compileTestCases.forEach(({ name, input, check }) => {
    it(name, () => {
      const result = xliffConverter.compile(input as any);
      check(result);
    });
  });
});

describe("XLIFFConverter escapeXml", () => {
  it("escapes & correctly", () => {
    // Access via compile result check
    const result = xliffConverter.compile({
      entries: [{ msgid: "a&b", msgstr: "c&d", flags: [], comments: {}, obsolete: false }],
      header: { content: "", metadata: {} },
    } as any);
    expect(result).toContain("&amp;");
  });

  it("escapes < correctly", () => {
    const result = xliffConverter.compile({
      entries: [{ msgid: "a<b", msgstr: "c>d", flags: [], comments: {}, obsolete: false }],
      header: { content: "", metadata: {} },
    } as any);
    expect(result).toContain("&lt;");
  });

  it("escapes > correctly", () => {
    const result = xliffConverter.compile({
      entries: [{ msgid: "a>b", msgstr: "c<d", flags: [], comments: {}, obsolete: false }],
      header: { content: "", metadata: {} },
    } as any);
    expect(result).toContain("&gt;");
  });

  it('escapes " correctly', () => {
    const result = xliffConverter.compile({
      entries: [{ msgid: 'a"b', msgstr: 'c"d', flags: [], comments: {}, obsolete: false }],
      header: { content: "", metadata: {} },
    } as any);
    expect(result).toContain("&quot;");
  });
});

describe("XLIFFConverter roundtrip", () => {
  it("parse then compile preserves msgid and msgstr", () => {
    const original = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2">
  <file original="messages" source-language="en">
    <body>
      <trans-unit id="hello">
        <source>Hello</source>
        <target>Bonjour</target>
      </trans-unit>
    </body>
  </file>
</xliff>`;

    const parsed = xliffConverter.parse(original);
    const compiled = xliffConverter.compile(parsed);

    expect(compiled).toContain("<source>Hello</source>");
    expect(compiled).toContain("Bonjour");
  });
});
