export interface PluralFormSpec {
  nplurals: number;
  plural: string;
  examples?: string;
}

export const PLURAL_FORMS: Record<string, PluralFormSpec> = {
  // 1 form
  ja: { nplurals: 1, plural: "0", examples: "Japanese" },
  ko: { nplurals: 1, plural: "0", examples: "Korean" },
  zh: { nplurals: 1, plural: "0", examples: "Chinese" },
  vi: { nplurals: 1, plural: "0", examples: "Vietnamese" },
  th: { nplurals: 1, plural: "0", examples: "Thai" },
  tr: { nplurals: 1, plural: "0", examples: "Turkish" },
  id: { nplurals: 1, plural: "0", examples: "Indonesian" },
  ms: { nplurals: 1, plural: "0", examples: "Malay" },
  fa: { nplurals: 1, plural: "0", examples: "Persian" },
  ka: { nplurals: 1, plural: "0", examples: "Georgian" },
  az: { nplurals: 1, plural: "0", examples: "Azerbaijani" },
  km: { nplurals: 1, plural: "0", examples: "Khmer" },
  // 2 forms — (n != 1)
  en: { nplurals: 2, plural: "(n != 1)", examples: "English" },
  de: { nplurals: 2, plural: "(n != 1)", examples: "German" },
  nl: { nplurals: 2, plural: "(n != 1)", examples: "Dutch" },
  es: { nplurals: 2, plural: "(n != 1)", examples: "Spanish" },
  it: { nplurals: 2, plural: "(n != 1)", examples: "Italian" },
  sv: { nplurals: 2, plural: "(n != 1)", examples: "Swedish" },
  da: { nplurals: 2, plural: "(n != 1)", examples: "Danish" },
  nb: { nplurals: 2, plural: "(n != 1)", examples: "Norwegian Bokmål" },
  nn: { nplurals: 2, plural: "(n != 1)", examples: "Norwegian Nynorsk" },
  no: { nplurals: 2, plural: "(n != 1)", examples: "Norwegian" },
  fi: { nplurals: 2, plural: "(n != 1)", examples: "Finnish" },
  et: { nplurals: 2, plural: "(n != 1)", examples: "Estonian" },
  hu: { nplurals: 2, plural: "(n != 1)", examples: "Hungarian" },
  el: { nplurals: 2, plural: "(n != 1)", examples: "Greek" },
  he: { nplurals: 2, plural: "(n != 1)", examples: "Hebrew" },
  bg: { nplurals: 2, plural: "(n != 1)", examples: "Bulgarian" },
  mk: { nplurals: 2, plural: "(n == 1 || n % 10 == 1) ? 0 : 1", examples: "Macedonian" },
  sq: { nplurals: 2, plural: "(n != 1)", examples: "Albanian" },
  eu: { nplurals: 2, plural: "(n != 1)", examples: "Basque" },
  af: { nplurals: 2, plural: "(n != 1)", examples: "Afrikaans" },
  bn: { nplurals: 2, plural: "(n != 1)", examples: "Bengali" },
  gu: { nplurals: 2, plural: "(n != 1)", examples: "Gujarati" },
  hi: { nplurals: 2, plural: "(n != 1)", examples: "Hindi" },
  ky: { nplurals: 2, plural: "(n != 1)", examples: "Kyrgyz" },
  mn: { nplurals: 2, plural: "(n != 1)", examples: "Mongolian" },
  // 2 forms — French (n > 1)
  fr: { nplurals: 2, plural: "(n > 1)", examples: "French" },
  "pt-br": { nplurals: 2, plural: "(n > 1)", examples: "Brazilian Portuguese" },
  // 2 forms — Portuguese
  pt: { nplurals: 2, plural: "(n != 1)", examples: "Portuguese" },
  // 2 forms — Romanian
  ro: {
    nplurals: 3,
    plural: "(n == 1 ? 0 : (n == 0 || (n % 100 > 0 && n % 100 < 20)) ? 1 : 2)",
    examples: "Romanian",
  },
  // 3 forms — Slavic
  ru: {
    nplurals: 3,
    plural: "(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2)",
    examples: "Russian",
  },
  uk: {
    nplurals: 3,
    plural: "(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2)",
    examples: "Ukrainian",
  },
  be: {
    nplurals: 3,
    plural: "(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2)",
    examples: "Belarusian",
  },
  sr: {
    nplurals: 3,
    plural: "(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2)",
    examples: "Serbian",
  },
  hr: {
    nplurals: 3,
    plural: "(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2)",
    examples: "Croatian",
  },
  bs: {
    nplurals: 3,
    plural: "(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2)",
    examples: "Bosnian",
  },
  pl: {
    nplurals: 3,
    plural: "(n==1 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2)",
    examples: "Polish",
  },
  cs: { nplurals: 3, plural: "(n==1) ? 0 : (n>=2 && n<=4) ? 1 : 2", examples: "Czech" },
  sk: { nplurals: 3, plural: "(n==1) ? 0 : (n>=2 && n<=4) ? 1 : 2", examples: "Slovak" },
  lt: {
    nplurals: 3,
    plural: "(n%10==1 && n%100!=11 ? 0 : n%10>=2 && (n%100<10 || n%100>=20) ? 1 : 2)",
    examples: "Lithuanian",
  },
  lv: { nplurals: 3, plural: "(n%10==1 && n%100!=11 ? 0 : n != 0 ? 1 : 2)", examples: "Latvian" },
  // 4 forms
  sl: {
    nplurals: 4,
    plural: "(n%100==1 ? 0 : n%100==2 ? 1 : n%100==3 || n%100==4 ? 2 : 3)",
    examples: "Slovenian",
  },
  // 6 forms
  ar: {
    nplurals: 6,
    plural:
      "(n==0 ? 0 : n==1 ? 1 : n==2 ? 2 : n%100>=3 && n%100<=10 ? 3 : n%100>=11 && n%100<=99 ? 4 : 5)",
    examples: "Arabic",
  },
};

export function getPluralFormSpec(language: string): PluralFormSpec {
  const normalized = language.toLowerCase().replace("_", "-");
  if (PLURAL_FORMS[normalized]) return PLURAL_FORMS[normalized];
  const base = normalized.split("-")[0];
  return PLURAL_FORMS[base] ?? { nplurals: 2, plural: "(n != 1)" };
}

export function pluralFormsHeader(spec: PluralFormSpec): string {
  return `nplurals=${spec.nplurals}; plural=${spec.plural};`;
}

export function parseNplurals(pluralFormsValue: string): number {
  const match = pluralFormsValue.match(/nplurals\s*=\s*(\d+)/);
  return match ? parseInt(match[1], 10) : 2;
}

export function getPluralFormLabels(nplurals: number): string[] {
  switch (nplurals) {
    case 1:
      return ["Other"];
    case 2:
      return ["One", "Other"];
    case 3:
      return ["One", "Few", "Other"];
    case 4:
      return ["One", "Two", "Few", "Other"];
    case 6:
      return ["Zero", "One", "Two", "Few", "Many", "Other"];
    default:
      return Array.from({ length: nplurals }, (_, i) => `Form ${i}`);
  }
}
