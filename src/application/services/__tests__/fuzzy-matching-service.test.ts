import { type POEntry } from "@domain/entities/POEntry";
import { describe, it, expect } from "vitest";

import { FuzzyMatchingService } from "../FuzzyMatchingService";

describe("FuzzyMatchingService", () => {
  const service = new FuzzyMatchingService();

  const tmEntries: POEntry[] = [
    { msgid: "Hello world", msgstr: "Hola mundo" },
    { msgid: "Hello there", msgstr: "Hola ahí" },
    { msgid: "Goodbye", msgstr: "Adiós" },
  ];

  it("finds fuzzy matches above threshold", () => {
    const matches = service.findMatches("Hello warld", tmEntries, 0.5);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].msgid).toBe("Hello world");
    expect(matches[0].score).toBeGreaterThan(0.5);
  });

  it("filters out exact matches", () => {
    const matches = service.findMatches("Hello world", tmEntries, 0.5);
    expect(matches.filter((m) => m.msgid === "Hello world").length).toBe(0);
  });

  it("returns empty for no matches", () => {
    const matches = service.findMatches("Banana", tmEntries, 0.8);
    expect(matches.length).toBe(0);
  });
});
