import { type POHeader } from "@domain/index";

const PO_HEADER_KEY_MAP: Record<keyof POHeader, string> = {
  language: "Language",
  contentType: "Content-Type",
  contentTransferEncoding: "Content-Transfer-Encoding",
  pluralForms: "Plural-Forms",
  projectIdVersion: "Project-Id-Version",
  poRevisionDate: "PO-Revision-Date",
  mimeVersion: "MIME-Version",
  xGenerator: "X-Generator",
  lastTranslator: "Last-Translator",
  languageTeam: "Language-Team",
  reportMsgidBugsTo: "Report-Msgid-Bugs-To",
  potCreationDate: "POT-Creation-Date",
};

export function toStandardHeader(header: POHeader): Record<string, string> {
  const result: Record<string, string> = {};

  const rawHeader = header as unknown as Record<string, unknown>;
  if (rawHeader._raw) {
    Object.assign(result, rawHeader._raw as Record<string, string>);
  }

  for (const [camelKey, standardKey] of Object.entries(PO_HEADER_KEY_MAP)) {
    const value = header[camelKey as keyof POHeader];
    if (value !== undefined && value !== "") {
      result[standardKey] = value;
    }
  }

  return result;
}

export function fromStandardHeader(standard: Record<string, string>): POHeader {
  const result: Record<string, unknown> = { _raw: { ...standard } };

  const normalizedStandard: Record<string, string> = {};
  for (const [key, value] of Object.entries(standard)) {
    normalizedStandard[key.toLowerCase()] = value;
  }

  for (const [camelKey, standardKey] of Object.entries(PO_HEADER_KEY_MAP)) {
    const value = normalizedStandard[standardKey.toLowerCase()];
    if (value !== undefined) {
      result[camelKey] = value;
    }
  }

  if (!result.language && normalizedStandard["language"]) {
    result.language = normalizedStandard["language"];
  }

  return result as unknown as POHeader;
}

export function getCharset(contentType: string): string {
  const match = contentType.match(/charset\s*=\s*["'"]?([^"';]+)["'"]?/i);
  if (!match) {
    return "UTF-8";
  }
  return match[1].trim();
}
