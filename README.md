<div align="center">

<img src="docs/logo.svg" alt="PO Editor logo" width="128" height="128" />

# PO Editor — Obsidian Plugin

### Edit, validate, and convert **PO/Gettext translation files** directly inside Obsidian — grid view, raw editor, multi-format export, and full plural form support.

[![Version](https://img.shields.io/badge/version-0.1.0-blue?style=for-the-badge)](https://github.com/Kodaskills/obsidian-po-editor/releases/latest)
[![Obsidian](https://img.shields.io/badge/Obsidian-0.15.0+-7c3aed?style=for-the-badge&logo=obsidian&logoColor=white)](https://obsidian.md)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)
[![Last Commit](https://img.shields.io/github/last-commit/Kodaskills/obsidian-po-editor/main?style=for-the-badge)](https://github.com/Kodaskills/obsidian-po-editor/commits/main)

### Built with:

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)
[![Obsidian API](https://img.shields.io/badge/Obsidian%20API-1.12.3+-7c3aed?style=for-the-badge&logo=obsidian&logoColor=white)](https://docs.obsidian.md)

</div>

---

## ✨ Features

| Area                  | What PO Editor provides                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| **Editor**            | Dual-mode editing — interactive grid table and raw PO text editor with CodeMirror syntax highlighting |
| **Format Conversion** | Convert PO ↔ XLIFF, ARB, ARB Enhanced, JSON, YAML, ICU MessageFormat                                  |
| **Entry Management**  | Singular and plural forms, translator comments, flags, `msgctxt` context, source references           |
| **Filtering**         | Filter by status (translated / untranslated / fuzzy), format flag, comment, or context                |
| **Validation**        | Flag conflicts, plural integrity, empty `msgstr`, fuzzy/obsolete detection, strict mode               |
| **Commands**          | Create, view, validate, mark/unmark fuzzy — all accessible from the command palette                   |
| **Project Mode**      | Manage multiple related PO files from a single folder                                                 |
| **Settings**          | Default language, output directory, custom keybindings, quick-action buttons, placeholder patterns    |

---

## 🚀 Installation

### Community Plugins _(when listed)_

1. Open Obsidian → **Settings → Community plugins → Browse**
2. Search **"PO Editor"**
3. Click **Install**, then **Enable**

### BRAT _(beta testing)_

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) from Community plugins
2. Open BRAT settings → **Add Beta Plugin**
3. Enter `Kodaskills/obsidian-po-editor`

### Manual

Download the latest release from [GitHub Releases](https://github.com/Kodaskills/obsidian-po-editor/releases/latest), copy `main.js`, `manifest.json`, and `styles.css` to:

```
<vault>/.obsidian/plugins/po-editor/
```

Then reload Obsidian and enable the plugin.

> **Note:** Desktop only — `isDesktopOnly: true`.

---

## ⚡ Quick Start

```
1. Click the 🌐 ribbon icon (or run "Create PO File" from the command palette)
2. Choose a language and output directory → file is created and opens in grid view
3. Click any row to edit an entry — add/update msgstr, set flags, add comments
4. Toggle to raw text mode (top-right) for direct PO source editing
5. Run "Validate PO File" to check for errors and incomplete translations
6. Use "Convert" to export the file to XLIFF, JSON, YAML, ARB, or ICU format
```

---

## 📂 Supported Formats

| Format            | Extension | Direction                |
| ----------------- | --------- | ------------------------ |
| Gettext PO        | `.po`     | Read & Write             |
| Gettext Template  | `.pot`    | Read & Write             |
| XLIFF             | `.xliff`  | PO ↔ XLIFF               |
| Flutter ARB       | `.arb`    | PO ↔ ARB                 |
| ARB Enhanced      | `.arb`    | PO ↔ ARB (with metadata) |
| JSON              | `.json`   | PO ↔ JSON                |
| YAML              | `.yaml`   | PO ↔ YAML                |
| ICU MessageFormat | `.json`   | PO ↔ ICU                 |

---

## 🛠 Commands

| Command             | ID                | Description                                             |
| ------------------- | ----------------- | ------------------------------------------------------- |
| Create PO File      | `po-create`       | Open dialog to create a new `.po` file                  |
| View Active PO File | `po-view-active`  | Open the currently active `.po` file in the editor      |
| Validate PO File    | `po-validate`     | Run validation and show a detailed error/warning report |
| Mark as Fuzzy       | `po-mark-fuzzy`   | Add the `fuzzy` flag to the selected entry              |
| Unmark Fuzzy        | `po-unmark-fuzzy` | Remove the `fuzzy` flag from the selected entry         |

All commands are available via `Ctrl/Cmd + P`.

---

## ⚙️ Settings

| Setting               | Default         | Description                                          |
| --------------------- | --------------- | ---------------------------------------------------- |
| `defaultLanguage`     | `en`            | Language code pre-filled when creating a new PO file |
| `outputDirectory`     | _(vault root)_  | Where new PO files are saved                         |
| `showComments`        | `true`          | Show translator comments in the grid                 |
| `preserveComments`    | `true`          | Keep comments during format conversion               |
| `preserveFlags`       | `true`          | Keep flags during format conversion                  |
| `preserveReferences`  | `true`          | Keep source references during format conversion      |
| `autoValidate`        | `false`         | Run validation automatically on save                 |
| `strictMode`          | `false`         | Treat untranslated and fuzzy entries as errors       |
| `showLineNumbers`     | `true`          | Show line numbers in the raw text editor             |
| `projectModeFolders`  | `[]`            | Folders that activate project mode                   |
| `placeholderPatterns` | _(printf, ICU)_ | Regex patterns for placeholder detection             |

### Custom Keybindings

Map editor actions to keyboard shortcuts via `keyMapping` in settings. Bind any action to a key combination — no restart required.

### Quick Actions

Configure `quickActions` buttons in settings to insert frequently used flags or comment snippets with a single click inside the entry editor.

---

## 📊 Validation

Run **"Validate PO File"** to get a full report:

| Check                                                      | Severity |
| ---------------------------------------------------------- | -------- |
| Empty `msgstr` on non-header entry                         | Error    |
| Conflicting format flags (e.g. `c-format` + `no-c-format`) | Error    |
| Multiple conflicting format flags on one entry             | Error    |
| Incorrect plural form count                                | Error    |
| Untranslated entries                                       | Warning  |
| Fuzzy entries                                              | Warning  |
| Obsolete entries                                           | Info     |

In **strict mode**, untranslated and fuzzy entries are promoted to errors.

---

## 📄 License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">

**Maintained with ⚡ by the [Kodaskills](https://github.com/Kodaskills) team**

[![TypeScript](https://img.shields.io/badge/Made%20with-TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)

</div>
