import type { POFlag } from "@domain/index";

const KNOWN_FLAGS = new Set<string>([
  "fuzzy",
  "c-format",
  "no-c-format",
  "icu-format",
  "python-format",
  "python-brace-format",
  "csharp-format",
]);

export function isValidFlag(f: string): f is POFlag {
  return KNOWN_FLAGS.has(f);
}

export function extractString(line: string): string {
  const start = line.indexOf('"');
  const end = line.lastIndexOf('"');
  if (start === -1 || end === -1 || start === end) return "";
  return unescapePoString(line.substring(start + 1, end));
}

export function unescapePoString(str: string): string {
  return str
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

export function parseHeaderString(headerStr: string): Record<string, string> {
  const metadata: Record<string, string> = {};
  for (const line of headerStr.split("\n")) {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      metadata[line.substring(0, colonIndex).trim()] = line.substring(colonIndex + 1).trim();
    }
  }
  return metadata;
}

export function appendComment(existing: string | undefined, fragment: string): string {
  return existing ? `${existing} ${fragment}` : fragment;
}
