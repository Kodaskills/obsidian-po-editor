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
  for (const [camelKey, standardKey] of Object.entries(PO_HEADER_KEY_MAP)) {
    const value = header[camelKey as keyof POHeader];
    if (value !== undefined) result[standardKey] = value;
  }
  return result;
}

export function fromStandardHeader(standard: Record<string, string>): POHeader {
  const result: Partial<POHeader> = {};
  for (const [camelKey, standardKey] of Object.entries(PO_HEADER_KEY_MAP)) {
    if (standard[standardKey] !== undefined) {
      result[camelKey as keyof POHeader] = standard[standardKey];
    }
  }
  return result as POHeader;
}

export function getCharset(contentType: string): string {
  const match = contentType.match(/charset\s*=\s*["']?([^"';]+)["']?/i);
  if (!match) {
    throw new Error(`Invalid Content-Type: "${contentType}" – missing charset parameter`);
  }
  return match[1].trim();
}
