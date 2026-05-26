#!/usr/bin/env node
/* eslint-disable no-console */

import fs from "fs";
import path from "path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const COUNT = parseInt(process?.argv?.[2] ?? "250", 10);

const LANGS = [
  { code: "fr", name: "French", country: "France" },
  { code: "es", name: "Spanish", country: "Spain" },
  { code: "en", name: "English", country: "United States" },
  { code: "de", name: "German", country: "Germany" },
  { code: "it", name: "Italian", country: "Italy" },
  { code: "pt", name: "Portuguese", country: "Portugal" },
  { code: "ru", name: "Russian", country: "Russia" },
  { code: "zh_CN", name: "Chinese (Simplified)", country: "China" },
  { code: "ja", name: "Japanese", country: "Japan" },
  { code: "ko", name: "Korean", country: "South Korea" },
  { code: "ar", name: "Arabic", country: "Saudi Arabia" },
  { code: "nl", name: "Dutch", country: "Netherlands" },
  { code: "pl", name: "Polish", country: "Poland" },
  { code: "tr", name: "Turkish", country: "Turkey" },
  { code: "sv", name: "Swedish", country: "Sweden" },
  { code: "da", name: "Danish", country: "Denmark" },
  { code: "fi", name: "Finnish", country: "Finland" },
  { code: "hu", name: "Hungarian", country: "Hungary" },
  { code: "cs", name: "Czech", country: "Czech Republic" },
  { code: "ro", name: "Romanian", country: "Romania" },
  { code: "el", name: "Greek", country: "Greece" },
  { code: "he", name: "Hebrew", country: "Israel" },
  { code: "hi", name: "Hindi", country: "India" },
  { code: "th", name: "Thai", country: "Thailand" },
  { code: "uk", name: "Ukrainian", country: "Ukraine" },
];

const PLURAL_SPECS = {
  fr: { nplurals: 2, plural: "(n > 1)" },
  pt: { nplurals: 2, plural: "(n != 1)" },
  ro: { nplurals: 3, plural: "(n==1?0:(n==0||(n%100>0&&n%100<20))?1:2)" },
  ru: { nplurals: 3, plural: "(n%10==1&&n%100!=11?0:n%10>=2&&n%10<=4&&(n%100<10||n%100>=20)?1:2)" },
  uk: { nplurals: 3, plural: "(n%10==1&&n%100!=11?0:n%10>=2&&n%10<=4&&(n%100<10||n%100>=20)?1:2)" },
  cs: { nplurals: 3, plural: "(n==1?0:n>=2&&n<=4?1:2)" },
  pl: { nplurals: 3, plural: "(n==1?0:n%10>=2&&n%10<=4&&(n%100<10||n%100>=20)?1:2)" },
  ar: { nplurals: 6, plural: "(n==0?0:n==1?1:n==2?2:n%100>=3&&n%100<=10?3:n%100>=11?4:5)" },
  ja: { nplurals: 1, plural: "0" },
  ko: { nplurals: 1, plural: "0" },
  zh_CN: { nplurals: 1, plural: "0" },
  th: { nplurals: 1, plural: "0" },
  tr: { nplurals: 1, plural: "0" },
};

function getPluralSpec(code) {
  return PLURAL_SPECS[code] ?? { nplurals: 2, plural: "(n != 1)" };
}

// ─── Real translations (common UI terms) ──────────────────────────────────────

const REAL_TRANSLATIONS = {
  fr: {
    Save: "Enregistrer",
    "Save as...": "Enregistrer sous...",
    Cancel: "Annuler",
    Delete: "Supprimer",
    Edit: "Modifier",
    Close: "Fermer",
    Open: "Ouvrir",
    Search: "Rechercher",
    Settings: "Paramètres",
    Preferences: "Préférences",
    Help: "Aide",
    About: "À propos",
    Import: "Importer",
    Export: "Exporter",
    Refresh: "Actualiser",
    Reload: "Recharger",
    Copy: "Copier",
    Paste: "Coller",
    Cut: "Couper",
    Undo: "Annuler",
    Redo: "Rétablir",
    "Select All": "Tout sélectionner",
    Clear: "Effacer",
    Filter: "Filtrer",
    Sort: "Trier",
    Submit: "Valider",
    Reset: "Réinitialiser",
    Apply: "Appliquer",
    OK: "OK",
    Yes: "Oui",
    No: "Non",
    Continue: "Continuer",
    Confirm: "Confirmer",
    Accept: "Accepter",
    Decline: "Refuser",
    Skip: "Passer",
    Done: "Terminé",
    Finish: "Finir",
    Back: "Retour",
    Next: "Suivant",
    Previous: "Précédent",
    First: "Premier",
    Last: "Dernier",
    Print: "Imprimer",
    Share: "Partager",
    Download: "Télécharger",
    Upload: "Téléverser",
    Sync: "Synchroniser",
    Archive: "Archiver",
    Restore: "Restaurer",
    Duplicate: "Dupliquer",
    Move: "Déplacer",
    Rename: "Renommer",
    Properties: "Propriétés",
    Preview: "Aperçu",
    Find: "Trouver",
    Replace: "Remplacer",
    "Find and replace": "Rechercher et remplacer",
    "New file": "Nouveau fichier",
    "New folder": "Nouveau dossier",
    "Select file": "Sélectionner un fichier",
    "Select folder": "Sélectionner un dossier",
    "Close all": "Tout fermer",
    "Expand all": "Tout développer",
    "Collapse all": "Tout réduire",
    "Select none": "Désélectionner tout",
    "Invert selection": "Inverser la sélection",
    "Zoom in": "Zoom avant",
    "Zoom out": "Zoom arrière",
    "Full screen": "Plein écran",
    "Show toolbar": "Afficher la barre d'outils",
    "Hide sidebar": "Masquer la barre latérale",
    "Toggle dark mode": "Basculer en mode sombre",
    "Loading...": "Chargement...",
    "Saving...": "Enregistrement...",
    "Processing...": "Traitement en cours...",
    "Please wait...": "Veuillez patienter...",
    "No results found": "Aucun résultat trouvé",
    "Error occurred": "Une erreur s'est produite",
    "Operation successful": "Opération réussie",
    "Changes saved": "Modifications enregistrées",
    "Access denied": "Accès refusé",
    "Not found": "Introuvable",
    "Connection failed": "Connexion échouée",
    "Network error": "Erreur réseau",
    Timeout: "Délai dépassé",
    "Unsaved changes": "Modifications non enregistrées",
    "Are you sure?": "Êtes-vous sûr ?",
    "This action cannot be undone.": "Cette action est irréversible.",
    "Your changes will be lost.": "Vos modifications seront perdues.",
    "Feature not available": "Fonctionnalité non disponible",
    "Coming soon": "Bientôt disponible",
    "Experimental feature": "Fonctionnalité expérimentale",
    Welcome: "Bienvenue",
    "Sign in": "Se connecter",
    "Sign out": "Se déconnecter",
    Translate: "Traduire",
    Translation: "Traduction",
    Source: "Source",
    Target: "Cible",
    Fuzzy: "Approximatif",
    Obsolete: "Obsolète",
    Retry: "Réessayer",
    Dismiss: "Ignorer",
    "View details": "Voir les détails",
    "Reset to defaults": "Rétablir les paramètres par défaut",
  },
  es: {
    Save: "Guardar",
    "Save as...": "Guardar como...",
    Cancel: "Cancelar",
    Delete: "Eliminar",
    Edit: "Editar",
    Close: "Cerrar",
    Open: "Abrir",
    Search: "Buscar",
    Settings: "Configuración",
    Help: "Ayuda",
    About: "Acerca de",
    Import: "Importar",
    Export: "Exportar",
    Refresh: "Actualizar",
    Copy: "Copiar",
    Paste: "Pegar",
    Cut: "Cortar",
    Undo: "Deshacer",
    Redo: "Rehacer",
    Submit: "Enviar",
    Reset: "Restablecer",
    Apply: "Aplicar",
    Yes: "Sí",
    No: "No",
    Continue: "Continuar",
    Confirm: "Confirmar",
    Done: "Hecho",
    Back: "Atrás",
    Next: "Siguiente",
    Previous: "Anterior",
    Print: "Imprimir",
    Share: "Compartir",
    Download: "Descargar",
    Upload: "Subir",
    Move: "Mover",
    Rename: "Renombrar",
    Preview: "Vista previa",
    Find: "Buscar",
    Filter: "Filtrar",
    Sort: "Ordenar",
    Clear: "Borrar",
    "Loading...": "Cargando...",
    "Saving...": "Guardando...",
    "No results found": "Sin resultados",
    "Error occurred": "Error ocurrido",
    "Changes saved": "Cambios guardados",
    Welcome: "Bienvenido",
    "Sign in": "Iniciar sesión",
    "Sign out": "Cerrar sesión",
    Translate: "Traducir",
    Translation: "Traducción",
    Source: "Fuente",
    Target: "Destino",
  },
  de: {
    Save: "Speichern",
    "Save as...": "Speichern unter...",
    Cancel: "Abbrechen",
    Delete: "Löschen",
    Edit: "Bearbeiten",
    Close: "Schließen",
    Open: "Öffnen",
    Search: "Suchen",
    Settings: "Einstellungen",
    Help: "Hilfe",
    About: "Über",
    Import: "Importieren",
    Export: "Exportieren",
    Refresh: "Aktualisieren",
    Copy: "Kopieren",
    Paste: "Einfügen",
    Cut: "Ausschneiden",
    Undo: "Rückgängig",
    Redo: "Wiederholen",
    Submit: "Senden",
    Reset: "Zurücksetzen",
    Apply: "Anwenden",
    Yes: "Ja",
    No: "Nein",
    Continue: "Weiter",
    Confirm: "Bestätigen",
    Done: "Fertig",
    Back: "Zurück",
    Next: "Weiter",
    Previous: "Zurück",
    Print: "Drucken",
    Share: "Teilen",
    Download: "Herunterladen",
    Upload: "Hochladen",
    Move: "Verschieben",
    Rename: "Umbenennen",
    Preview: "Vorschau",
    Filter: "Filtern",
    Sort: "Sortieren",
    Clear: "Löschen",
    "Loading...": "Wird geladen...",
    "Saving...": "Wird gespeichert...",
    "No results found": "Keine Ergebnisse",
    "Error occurred": "Fehler aufgetreten",
    Welcome: "Willkommen",
    "Sign in": "Anmelden",
    "Sign out": "Abmelden",
    Translate: "Übersetzen",
    Translation: "Übersetzung",
    Source: "Quelle",
    Target: "Ziel",
  },
  it: {
    Save: "Salva",
    Cancel: "Annulla",
    Delete: "Elimina",
    Edit: "Modifica",
    Close: "Chiudi",
    Open: "Apri",
    Search: "Cerca",
    Settings: "Impostazioni",
    Help: "Aiuto",
    About: "Informazioni",
    Copy: "Copia",
    Paste: "Incolla",
    Undo: "Annulla",
    Redo: "Ripeti",
    Yes: "Sì",
    No: "No",
    Back: "Indietro",
    Next: "Avanti",
    "Loading...": "Caricamento...",
    Welcome: "Benvenuto",
    "Sign in": "Accedi",
    "Sign out": "Esci",
    Translate: "Tradurre",
    Translation: "Traduzione",
  },
  pt: {
    Save: "Salvar",
    Cancel: "Cancelar",
    Delete: "Excluir",
    Edit: "Editar",
    Close: "Fechar",
    Open: "Abrir",
    Search: "Pesquisar",
    Settings: "Configurações",
    Help: "Ajuda",
    Copy: "Copiar",
    Paste: "Colar",
    Undo: "Desfazer",
    Yes: "Sim",
    No: "Não",
    Continue: "Continuar",
    Back: "Voltar",
    Next: "Próximo",
    "Loading...": "Carregando...",
    Welcome: "Bem-vindo",
    "Sign in": "Entrar",
    "Sign out": "Sair",
  },
};

// ─── Placeholder pattern (matches plugin default settings) ────────────────────

const PH_PAT = String.raw`%(?:\d+\$)?[sdfi]|%\([a-zA-Z_][a-zA-Z0-9_]*\)[sdfi]`;
// Non-capturing: for match/replace
const PH_RE = () => new RegExp(PH_PAT, "g");
// Capturing group: for split (odd indices = placeholder tokens)
const PH_SPLIT_RE = () => new RegExp(`(${PH_PAT})`, "g");

function extractPlaceholders(text) {
  return [...text.matchAll(PH_RE())].map((m) => m[0]);
}

// ─── Pseudo-localisation ──────────────────────────────────────────────────────
//
// Latin-script languages: vowel/consonant substitution applied to non-placeholder text
// Non-Latin languages: short native-script prefix prepended
// English: identity (msgstr = msgid)

const CHAR_SUB = {
  fr: { a: "à", e: "é", i: "î", o: "ô", u: "ù" },
  es: { a: "á", e: "é", i: "í", o: "ó", u: "ú" },
  de: { a: "ä", o: "ö", u: "ü" },
  it: { a: "à", e: "è", o: "ò", u: "ù" },
  pt: { a: "ã", e: "ê", o: "õ", u: "ú" },
  nl: { a: "â", e: "ë", o: "ö", u: "ü" },
  sv: { a: "å", o: "ö" },
  da: { a: "å", o: "ø" },
  fi: { a: "ä", o: "ö" },
  pl: { a: "ą", e: "ę", o: "ó", s: "ś", z: "ż" },
  cs: { e: "ě", s: "š", z: "ž", c: "č" },
  hu: { a: "á", e: "é", o: "ő", u: "ű" },
  ro: { a: "ă", s: "ș", t: "ț" },
  tr: { s: "ş", c: "ç", g: "ğ" },
};

function applyCharSub(text, sub) {
  return text
    .split("")
    .map((ch) => {
      const lower = ch.toLowerCase();
      const rep = sub[lower];
      if (!rep) return ch;
      return ch === lower ? rep : rep.charAt(0).toUpperCase() + rep.slice(1);
    })
    .join("");
}

function pseudoTranslate(text, langCode, dropFirstN = 0) {
  if (dropFirstN > 0) {
    let count = 0;
    text = text
      .replace(PH_RE(), (m) => (count++ < dropFirstN ? "" : m))
      .replace(/\s+/g, " ")
      .trim();
  }
  // Latin-script languages with char map: apply vowel/consonant substitution
  const sub = CHAR_SUB[langCode];
  if (sub) {
    const parts = text.split(PH_SPLIT_RE());
    return parts.map((part, idx) => (idx % 2 === 1 ? part : applyCharSub(part, sub))).join("");
  }
  // All other languages (non-Latin + no map): identity — realistic for partially-translated files
  return text;
}

function getTranslation(msgid, langCode, scenario) {
  if (scenario === "missing") return "";
  // English: identity translation
  if (langCode === "en")
    return pseudoTranslate(msgid, langCode, scenario === "placeholder_drop" ? 1 : 0);
  const dict = REAL_TRANSLATIONS[langCode] ?? {};
  if (scenario === "placeholder_drop" && extractPlaceholders(msgid).length > 0) {
    return pseudoTranslate(msgid, langCode, 1);
  }
  // Dict hit: still pseudo-apply if fuzzy (so it uses real translation + fuzzy flag)
  return dict[msgid] ?? pseudoTranslate(msgid, langCode, 0);
}

function getPluralTranslations(msgid, msgidPlural, langCode, nplurals, scenario) {
  if (scenario === "missing") return Array(nplurals).fill("");
  const dropN = scenario === "placeholder_drop" ? 1 : 0;
  // English: identity
  if (langCode === "en") {
    const forms = [
      pseudoTranslate(msgid, langCode, dropN),
      pseudoTranslate(msgidPlural, langCode, dropN),
    ];
    while (forms.length < nplurals) forms.push(pseudoTranslate(msgidPlural, langCode, dropN));
    return forms.slice(0, nplurals);
  }
  const singular = pseudoTranslate(msgid, langCode, dropN);
  const plural = pseudoTranslate(msgidPlural, langCode, dropN);
  const forms = [singular, plural];
  // For languages with >2 forms, add numbered variants that look slightly different
  while (forms.length < nplurals) {
    forms.push(pseudoTranslate(msgidPlural, langCode, dropN));
  }
  return forms.slice(0, nplurals);
}

// ─── Entry pool ───────────────────────────────────────────────────────────────
//
// scenario field controls translation for ALL languages:
//   "good"             — proper translation (default, may be omitted)
//   "fuzzy"            — translated but flagged fuzzy (needs review)
//   "missing"          — no translation yet (empty msgstr)
//   "placeholder_drop" — translation intentionally drops first placeholder → QA warning
//   "obsolete"         — entry marked obsolete in all files
//   undefined          — assigned per-entry + per-lang using deterministic hash

const ENTRY_POOL = [
  // ── Actions (no placeholders) ──────────────────────────────────────────────
  { msgid: "Save" },
  { msgid: "Save as..." },
  { msgid: "Cancel" },
  { msgid: "Delete" },
  { msgid: "Edit" },
  { msgid: "Close" },
  { msgid: "Open" },
  { msgid: "Search" },
  { msgid: "Settings" },
  { msgid: "Preferences" },
  { msgid: "Help" },
  { msgid: "About" },
  { msgid: "Import" },
  { msgid: "Export" },
  { msgid: "Refresh" },
  { msgid: "Reload" },
  { msgid: "Copy" },
  { msgid: "Paste" },
  { msgid: "Cut" },
  { msgid: "Undo" },
  { msgid: "Redo" },
  { msgid: "Select All" },
  { msgid: "Clear" },
  { msgid: "Filter" },
  { msgid: "Sort" },
  { msgid: "Submit" },
  { msgid: "Reset" },
  { msgid: "Apply" },
  { msgid: "OK" },
  { msgid: "Yes" },
  { msgid: "No" },
  { msgid: "Continue" },
  { msgid: "Confirm" },
  { msgid: "Accept" },
  { msgid: "Decline" },
  { msgid: "Skip" },
  { msgid: "Done" },
  { msgid: "Finish" },
  { msgid: "Back" },
  { msgid: "Next" },
  { msgid: "Previous" },
  { msgid: "First" },
  { msgid: "Last" },
  { msgid: "Print" },
  { msgid: "Share" },
  { msgid: "Download" },
  { msgid: "Upload" },
  { msgid: "Sync" },
  { msgid: "Archive" },
  { msgid: "Restore" },
  { msgid: "Duplicate" },
  { msgid: "Move" },
  { msgid: "Rename" },
  { msgid: "Properties" },
  { msgid: "Preview" },
  { msgid: "Find" },
  { msgid: "Replace" },
  { msgid: "Find and replace" },
  { msgid: "New file" },
  { msgid: "New folder" },
  { msgid: "Select file" },
  { msgid: "Select folder" },
  { msgid: "Close all" },
  { msgid: "Expand all" },
  { msgid: "Collapse all" },
  { msgid: "Select none" },
  { msgid: "Invert selection" },
  { msgid: "Zoom in" },
  { msgid: "Zoom out" },
  { msgid: "Full screen" },
  { msgid: "Show toolbar" },
  { msgid: "Hide sidebar" },
  { msgid: "Toggle dark mode" },
  { msgid: "Translate" },
  { msgid: "Translation" },
  { msgid: "Source", comment: "Refers to the original text, not source code" },
  { msgid: "Target", comment: "Refers to the translated text" },
  {
    msgid: "Fuzzy",
    comment: "Technical term for uncertain/unreviewed translation — may be left untranslated",
  },
  { msgid: "Obsolete", comment: "Technical status label — may be left untranslated" },

  // ── Status and feedback messages ───────────────────────────────────────────
  { msgid: "Loading..." },
  { msgid: "Saving..." },
  { msgid: "Processing..." },
  { msgid: "Please wait..." },
  { msgid: "No results found" },
  { msgid: "Error occurred" },
  { msgid: "Operation successful" },
  { msgid: "Changes saved" },
  { msgid: "Access denied" },
  { msgid: "Not found" },
  { msgid: "Connection failed" },
  { msgid: "Network error" },
  { msgid: "Timeout" },
  { msgid: "Unsaved changes" },
  { msgid: "Are you sure?" },
  { msgid: "This action cannot be undone." },
  { msgid: "Your changes will be lost." },
  { msgid: "Feature not available" },
  { msgid: "Coming soon" },
  { msgid: "Experimental feature" },

  // ── Context-disambiguated labels (msgctxt) ─────────────────────────────────
  { msgid: "Save", msgctxt: "button" },
  { msgid: "Save", msgctxt: "menu" },
  { msgid: "Delete", msgctxt: "button" },
  { msgid: "Delete", msgctxt: "confirm_dialog" },
  { msgid: "OK", msgctxt: "dialog" },
  { msgid: "Cancel", msgctxt: "dialog" },
  { msgid: "Retry", msgctxt: "error_dialog" },
  { msgid: "Dismiss", msgctxt: "notification" },
  { msgid: "View details", msgctxt: "notification" },
  { msgid: "Apply", msgctxt: "settings" },
  { msgid: "Reset to defaults", msgctxt: "settings" },

  // ── %s placeholder messages ────────────────────────────────────────────────
  { msgid: "Delete %s?", comment: "Confirmation dialog — %s is the item name" },
  { msgid: "Edit %s", msgctxt: "menu" },
  { msgid: "Open %s" },
  { msgid: "Rename %s" },
  { msgid: "Duplicate %s" },
  { msgid: "Archive %s" },
  { msgid: "Loading %s..." },
  { msgid: "Saving %s..." },
  { msgid: "Exporting %s..." },
  { msgid: "Importing %s..." },
  { msgid: "Error reading %s" },
  { msgid: "Cannot delete %s" },
  { msgid: "Cannot open %s: file not found" },
  { msgid: "%s was saved successfully" },
  { msgid: "%s has been deleted" },
  { msgid: "%s is not available" },
  { msgid: "%s requires administrator privileges" },
  { msgid: "%s is read-only", comment: "Shown when a file cannot be modified" },
  { msgid: "Welcome to %s!" },
  { msgid: "Search in %s" },
  { msgid: "Filter by %s" },
  { msgid: "Sort by %s" },
  { msgid: "Permission denied: %s", msgctxt: "error" },
  { msgid: "Invalid value: %s", msgctxt: "validation" },

  // ── %s placeholder — translation intentionally drops placeholder (QA alert) ─
  {
    msgid: "Hello, %s! Welcome back.",
    scenario: "placeholder_drop",
    comment: "Greeting — QA TEST: translation omits %s",
  },
  {
    msgid: "Error in %s: check the logs for details",
    scenario: "placeholder_drop",
    msgctxt: "error",
    comment: "QA TEST: translation omits %s",
  },
  { msgid: "Opening %s...", scenario: "placeholder_drop" },
  { msgid: "Cannot move %s: destination is read-only", scenario: "placeholder_drop" },
  { msgid: "Syncing %s with remote...", scenario: "placeholder_drop" },

  // ── %d placeholder messages ────────────────────────────────────────────────
  { msgid: "%d item selected" },
  { msgid: "%d results found" },
  { msgid: "%d errors detected" },
  { msgid: "%d warnings" },
  { msgid: "%d unread messages" },
  { msgid: "%d pending tasks" },
  { msgid: "Page %d" },
  { msgid: "Step %d of %d", comment: "Progress indicator, e.g. Step 2 of 5" },
  { msgid: "Line %d, column %d", msgctxt: "editor" },

  // ── Named %(key)s placeholder messages ────────────────────────────────────
  { msgid: "Welcome back, %(username)s!", comment: "Greeting with the user's name" },
  { msgid: "%(filename)s was saved to %(folder)s" },
  { msgid: "%(user)s changed %(field)s" },
  { msgid: "%(app)s version %(version)s" },
  { msgid: "%(count)d of %(total)d completed" },
  { msgid: "Last modified by %(user)s on %(date)s" },
  { msgid: "%(name)s is already in use", msgctxt: "validation" },
  { msgid: "%(field)s is required", msgctxt: "validation" },
  { msgid: "%(type)s format not supported" },

  // ── Named placeholder — drops one (QA alert) ───────────────────────────────
  {
    msgid: "%(filename)s could not be opened: %(reason)s",
    scenario: "placeholder_drop",
    comment: "QA TEST: drops %(reason)s",
  },
  { msgid: "Logged in as %(username)s since %(time)s", scenario: "placeholder_drop" },

  // ── Positional %1$s/%2$s placeholders ─────────────────────────────────────
  { msgid: "%1$s moved to %2$s", comment: "File move: %1$s = source, %2$s = destination" },
  {
    msgid: "%1$s requires %2$s to be installed first",
    scenario: "placeholder_drop",
    comment: "Dependency error — QA TEST: drops %2$s",
  },
  { msgid: "Copied %1$s to %2$s" },

  // ── Plural forms ──────────────────────────────────────────────────────────
  { msgid: "%d item", msgidPlural: "%d items" },
  { msgid: "%d file", msgidPlural: "%d files" },
  { msgid: "%d result", msgidPlural: "%d results" },
  { msgid: "%d error", msgidPlural: "%d errors" },
  { msgid: "%d warning", msgidPlural: "%d warnings" },
  { msgid: "%d message", msgidPlural: "%d messages" },
  { msgid: "%d task", msgidPlural: "%d tasks" },
  { msgid: "%d entry", msgidPlural: "%d entries" },
  { msgid: "%(count)d item selected", msgidPlural: "%(count)d items selected" },
  { msgid: "%(count)d file found", msgidPlural: "%(count)d files found" },
  { msgid: "%(count)d change pending", msgidPlural: "%(count)d changes pending" },
  { msgid: "%d day remaining", msgidPlural: "%d days remaining" },
  { msgid: "%d second", msgidPlural: "%d seconds" },
  { msgid: "%d minute", msgidPlural: "%d minutes" },
  { msgid: "%d hour", msgidPlural: "%d hours" },
  { msgid: "One item was deleted", msgidPlural: "%d items were deleted" },
  { msgid: "One file was uploaded", msgidPlural: "%d files were uploaded" },
  { msgid: "One error occurred", msgidPlural: "%d errors occurred" },
  { msgid: "An update is available", msgidPlural: "%d updates are available" },

  // ── Plural — placeholder drop in translation (QA alert on plural forms) ────
  {
    msgid: "%d item",
    msgidPlural: "%d items",
    scenario: "placeholder_drop",
    comment: "QA TEST: plural translation drops %d",
  },
  {
    msgid: "%(count)d notification",
    msgidPlural: "%(count)d notifications",
    scenario: "placeholder_drop",
  },

  // ── Forced fuzzy entries ───────────────────────────────────────────────────
  {
    msgid: "Are you sure you want to delete this item?",
    scenario: "fuzzy",
    comment: "Needs review after copy update",
  },
  { msgid: "Your changes will be lost. Continue?", scenario: "fuzzy" },
  { msgid: "File already exists. Overwrite?", scenario: "fuzzy" },
  { msgid: "Plugin loaded successfully", scenario: "fuzzy" },
  { msgid: "Connection established", scenario: "fuzzy" },
  { msgid: "Update available. Restart to apply.", scenario: "fuzzy" },
  {
    msgid: "%s was modified externally. Reload?",
    scenario: "fuzzy",
    comment: "Fuzzy + placeholder",
  },
  { msgid: "Save", msgctxt: "toolbar", scenario: "fuzzy" },
  { msgid: "Delete", msgctxt: "toolbar", scenario: "fuzzy" },
  { msgid: "%d items in clipboard", msgidPlural: "%d items in clipboard", scenario: "fuzzy" },
  {
    msgid: "Session expires in %d minutes",
    scenario: "fuzzy",
    comment: "Fuzzy after wording change",
  },
  { msgid: "%(filename)s has unsaved changes", scenario: "fuzzy" },

  // ── Forced missing translations ────────────────────────────────────────────
  {
    msgid: "Enable advanced debugging mode",
    scenario: "missing",
    comment: "New feature, not yet translated",
  },
  { msgid: "Configure proxy settings", msgctxt: "settings", scenario: "missing" },
  { msgid: "Experimental: AI-assisted translation", scenario: "missing", comment: "Beta feature" },
  { msgid: "Beta", scenario: "missing" },
  { msgid: "Accessibility options", scenario: "missing" },
  { msgid: "High contrast mode", scenario: "missing" },
  { msgid: "Keyboard shortcuts", scenario: "missing" },
  { msgid: "Export as %s", scenario: "missing", comment: "Not yet localised" },
  { msgid: "Sign in with %(provider)s", scenario: "missing" },

  // ── Obsolete entries (shown with #~ prefix) ────────────────────────────────
  { msgid: "Legacy sync mode (deprecated)", scenario: "obsolete" },
  { msgid: "Old toolbar style", scenario: "obsolete" },
  { msgid: "Classic view", scenario: "obsolete" },
  { msgid: "Enable spell checker (removed)", scenario: "obsolete" },
  { msgid: "Use compact layout", scenario: "obsolete" },
  { msgid: "Show beta features", scenario: "obsolete" },
  { msgid: "Legacy import wizard", scenario: "obsolete" },
  { msgid: "Reset onboarding", scenario: "obsolete" },
];

// Fill remaining slots with parametric variants of common patterns
const EXTRA_ACTIONS = [
  "Save",
  "Open",
  "Close",
  "Edit",
  "Delete",
  "Copy",
  "Move",
  "Archive",
  "Restore",
];
const EXTRA_SUBJECTS = [
  "file",
  "folder",
  "document",
  "note",
  "project",
  "template",
  "entry",
  "record",
  "workspace",
  "attachment",
  "tag",
  "label",
  "group",
  "category",
  "bookmark",
  "snapshot",
  "revision",
  "comment",
  "annotation",
];

function buildEntryList(targetCount) {
  // Forced-scenario entries are always included regardless of targetCount
  const forced = ENTRY_POOL.filter((e) => e.scenario);
  const optional = ENTRY_POOL.filter((e) => !e.scenario);

  const entries = [...forced];
  const seen = new Set(entries.map((e) => `${e.msgid}\x00${e.msgctxt ?? ""}`));

  for (const e of optional) {
    if (entries.length >= targetCount) break;
    const key = `${e.msgid}\x00${e.msgctxt ?? ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      entries.push(e);
    }
  }

  let ai = 0;
  let si = 0;
  while (entries.length < targetCount) {
    const action = EXTRA_ACTIONS[ai % EXTRA_ACTIONS.length];
    const subject = EXTRA_SUBJECTS[si % EXTRA_SUBJECTS.length];
    const msgid = `${action} ${subject}`;
    const key = `${msgid}\x00`;
    if (!seen.has(key)) {
      seen.add(key);
      entries.push({ msgid });
    }
    si++;
    if (si % EXTRA_SUBJECTS.length === 0) ai++;
  }
  return entries;
}

// Deterministic per-entry-per-lang scenario for entries with no forced scenario
// Distribution: ~44% good · 22% fuzzy · 16% missing · 10% placeholder_drop · 8% obsolete
function autoScenario(entry, entryIndex, langIndex) {
  if (entry.scenario) return entry.scenario;
  const hasPlaceholders =
    extractPlaceholders(entry.msgid).length > 0 ||
    (entry.msgidPlural ? extractPlaceholders(entry.msgidPlural).length > 0 : false);
  const h = ((entryIndex * 7919 + langIndex * 1031) >>> 0) % 100;
  if (h < 44) return "good";
  if (h < 66) return "fuzzy";
  if (h < 82) return "missing";
  if (h < 92) return hasPlaceholders ? "placeholder_drop" : "fuzzy";
  return "obsolete";
}

// ─── PO formatting ────────────────────────────────────────────────────────────

function esc(str) {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t");
}

function generatePOContent(entries, lang) {
  const spec = getPluralSpec(lang.code);
  const nplurals = spec.nplurals;
  const now = new Date().toISOString();
  const langIndex = LANGS.findIndex((l) => l.code === lang.code);

  const header = `# ${lang.name} translations for obsidian-po-editor.
# Copyright (C) 2026
#
msgid ""
msgstr ""
"Project-Id-Version: obsidian-po-editor 1.0\\n"
"Report-Msgid-Bugs-To: \\n"
"POT-Creation-Date: ${now}\\n"
"PO-Revision-Date: ${now}\\n"
"Last-Translator: Test Translator <test@${lang.code.replace("_", "-")}.example.com>\\n"
"Language-Team: ${lang.name} <team@${lang.code.replace("_", "-")}.example.com>\\n"
"Language: ${lang.code}\\n"
"MIME-Version: 1.0\\n"
"Content-Type: text/plain; charset=UTF-8\\n"
"Content-Transfer-Encoding: 8bit\\n"
"Plural-Forms: nplurals=${nplurals}; plural=${spec.plural};\\n"
`;

  const body = entries
    .map((entry, entryIndex) => {
      const scenario = autoScenario(entry, entryIndex, langIndex);
      const parts = [];

      if (scenario === "obsolete") {
        const trans =
          entry.msgidPlural === undefined ? getTranslation(entry.msgid, lang.code, "good") : null;
        parts.push(`#~ msgid "${esc(entry.msgid)}"`);
        if (entry.msgidPlural !== undefined) {
          parts.push(`#~ msgid_plural "${esc(entry.msgidPlural)}"`);
          const forms = getPluralTranslations(
            entry.msgid,
            entry.msgidPlural,
            lang.code,
            nplurals,
            "good",
          );
          forms.forEach((f, i) => parts.push(`#~ msgstr[${i}] "${esc(f)}"`));
        } else {
          parts.push(`#~ msgstr "${esc(trans)}"`);
        }
        return parts.join("\n");
      }

      if (scenario === "fuzzy") parts.push("#, fuzzy");
      if (entry.comment) parts.push(`# ${entry.comment}`);
      if (entry.msgctxt) parts.push(`msgctxt "${esc(entry.msgctxt)}"`);

      parts.push(`msgid "${esc(entry.msgid)}"`);

      if (entry.msgidPlural !== undefined) {
        parts.push(`msgid_plural "${esc(entry.msgidPlural)}"`);
        const forms = getPluralTranslations(
          entry.msgid,
          entry.msgidPlural,
          lang.code,
          nplurals,
          scenario,
        );
        forms.forEach((f, i) => parts.push(`msgstr[${i}] "${esc(f)}"`));
      } else {
        const trans = getTranslation(entry.msgid, lang.code, scenario);
        parts.push(`msgstr "${esc(trans)}"`);
      }

      return parts.join("\n");
    })
    .join("\n\n");

  return header + "\n" + body + "\n";
}

function generatePOTContent(entries) {
  const now = new Date().toISOString();
  const header = `# Translation template for obsidian-po-editor.
# Copyright (C) 2026
#
msgid ""
msgstr ""
"Project-Id-Version: obsidian-po-editor 1.0\\n"
"POT-Creation-Date: ${now}\\n"
"MIME-Version: 1.0\\n"
"Content-Type: text/plain; charset=UTF-8\\n"
"Content-Transfer-Encoding: 8bit\\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\\n"
`;

  const body = entries
    .filter((e) => e.scenario !== "obsolete")
    .map((entry) => {
      const parts = [];
      if (entry.comment) parts.push(`# ${entry.comment}`);
      if (entry.msgctxt) parts.push(`msgctxt "${esc(entry.msgctxt)}"`);
      parts.push(`msgid "${esc(entry.msgid)}"`);
      if (entry.msgidPlural !== undefined) {
        parts.push(`msgid_plural "${esc(entry.msgidPlural)}"`);
        parts.push(`msgstr[0] ""`);
        parts.push(`msgstr[1] ""`);
      } else {
        parts.push(`msgstr ""`);
      }
      return parts.join("\n");
    })
    .join("\n\n");

  return header + "\n" + body + "\n";
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const baseDir = path.join(__dirname, "..", "test-locales");
  if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });

  const entries = buildEntryList(COUNT);

  const potPath = path.join(baseDir, "template.pot");
  fs.writeFileSync(potPath, generatePOTContent(entries), "utf8");
  process.stdout.write(`Generated: ${potPath}\n`);

  for (const lang of LANGS) {
    const poPath = path.join(baseDir, `${lang.code}.po`);
    fs.writeFileSync(poPath, generatePOContent(entries, lang), "utf8");
    process.stdout.write(`Generated: ${poPath}\n`);
  }

  const scenarios = {
    placeholder_drop: entries.filter((e) => e.scenario === "placeholder_drop").length,
    fuzzy: entries.filter((e) => e.scenario === "fuzzy").length,
    missing: entries.filter((e) => e.scenario === "missing").length,
    obsolete: entries.filter((e) => e.scenario === "obsolete").length,
    plural: entries.filter((e) => e.msgidPlural !== undefined).length,
    with_context: entries.filter((e) => e.msgctxt).length,
  };

  process.stdout.write(`\nDone! Generated 1 POT + ${LANGS.length} PO files in ${baseDir}\n`);
  process.stdout.write(`Entry pool: ${entries.length} entries\n`);
  process.stdout.write(`  Placeholder drop (QA alerts): ${scenarios.placeholder_drop}\n`);
  process.stdout.write(`  Fuzzy:    ${scenarios.fuzzy}\n`);
  process.stdout.write(`  Missing:  ${scenarios.missing}\n`);
  process.stdout.write(`  Obsolete: ${scenarios.obsolete}\n`);
  process.stdout.write(`  Plural forms: ${scenarios.plural}\n`);
  process.stdout.write(`  With msgctxt: ${scenarios.with_context}\n`);
  process.stdout.write(
    `  + auto-distributed scenarios for remaining ${entries.length - Object.values(scenarios).reduce((a, b) => a + b, 0)} entries\n`,
  );
}

main();
