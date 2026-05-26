import { getPluralFormSpec } from "@domain/index";

export interface POHeader {
  language: string;
  contentType?: string;
  contentTransferEncoding?: string;
  pluralForms?: string;
  projectIdVersion?: string;
  poRevisionDate?: string;
  mimeVersion?: string;
  xGenerator?: string;
  lastTranslator?: string;
  languageTeam?: string;
  reportMsgidBugsTo?: string;
  potCreationDate?: string;
}

export function createPOHeader(language: string, options?: Omit<POHeader, "language">): POHeader {
  const spec = getPluralFormSpec(language);
  const {
    contentType = "text/plain; charset=UTF-8",
    contentTransferEncoding = "8bit",
    pluralForms = `nplurals=${spec.nplurals}; plural=${spec.plural};`,
    projectIdVersion = import.meta.env.VITE_APP_VERSION,
    poRevisionDate = new Date().toISOString().replace(/:\d{3}/, "+0000"),
    mimeVersion = "1.0",
    xGenerator = "Obsidian PO Editor",
    lastTranslator = "",
    languageTeam = "",
    reportMsgidBugsTo = "",
    potCreationDate = "",
  } = options ?? {};
  return {
    language: language,
    contentType,
    contentTransferEncoding,
    pluralForms,
    projectIdVersion,
    poRevisionDate,
    mimeVersion,
    xGenerator,
    lastTranslator,
    languageTeam,
    reportMsgidBugsTo,
    potCreationDate,
  };
}
