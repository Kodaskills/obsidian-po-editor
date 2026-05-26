import { describe, expect, it } from "vite-plus/test";

import { POConverter } from "../POConverter";

const poConverter = new POConverter();

describe("POConverter obsolete entries", () => {
  it("parses obsolete entries correctly", () => {
    const input = `msgid ""
msgstr ""
    "Content-Type: text/plain; charset=UTF-8\\n"

#~ msgid "Old"
#~ msgstr "Vieux"
`;
    const result = poConverter.parse(input);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].msgid).toBe("Old");
    expect(result.entries[0].obsolete).toBe(true);
  });

  it("parses obsolete entries with msgctxt", () => {
    const input = `msgid ""
msgstr ""
    "Content-Type: text/plain; charset=UTF-8\\n"

#~ msgctxt "image"
#~ msgid "Refresh"
#~ msgstr "Rafraîchir"
`;
    const result = poConverter.parse(input);
    const entry = result.entries.find((e) => e.msgid === "Refresh");
    expect(entry).toBeDefined();
    expect(entry!.msgctxt).toBe("image");
    expect(entry!.obsolete).toBe(true);
  });

  it("parses obsolete plural entries with msgctxt", () => {
    const input = `msgid ""
msgstr ""
    "Content-Type: text/plain; charset=UTF-8\\n"

#~ msgctxt "image"
#~ msgid "Refresh"
#~ msgid_plural "Refreshes"
#~ msgstr[0] "Rafraîchir"
#~ msgstr[1] "Rafraîchirs"
`;
    const result = poConverter.parse(input);
    const entry = result.entries.find((e) => e.msgid === "Refresh");
    expect(entry).toBeDefined();
    expect(entry!.msgctxt).toBe("image");
    expect(entry!.obsolete).toBe(true);
  });
});
