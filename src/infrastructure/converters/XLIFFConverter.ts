import { type TranslationConverter } from "@application/index";
import { createPOHeader, createSingularEntry, type POEntry, type POFile } from "@domain/index";

export class XLIFFConverter implements TranslationConverter {
  readonly format = "xliff" as const;
  readonly displayName: string = "XLIFF";
  readonly supportedExtensions: string[] = [".xliff", ".xlf"];
  readonly supportsPlurals = false;
  readonly supportsFuzzyFlags = true;

  parse(content: string): POFile {
    const entries: POEntry[] = [];
    const targetLang = this.extractAttr(content, "target-language") || "und";

    const unitRegex = /<trans-unit[^>]*id="([^"]*)"[^>]*>([\s\S]*?)<\/trans-unit>/g;

    let match: RegExpExecArray | null = unitRegex.exec(content);

    while (match !== null) {
      const unitContent = match[2];
      const source = this.extractTag(unitContent, "source");
      const target = this.extractTag(unitContent, "target");
      const note = this.extractTag(unitContent, "note");
      const state = this.extractAttr(unitContent, "state") || "new";
      const isFuzzy = state === "needs-adaptation" || state === "needs-review-translation";

      if (source) {
        entries.push(
          createSingularEntry(this.unescapeXml(source), target ? this.unescapeXml(target) : "", {
            comments: note ? { translator: this.unescapeXml(note) } : {},
            flags: isFuzzy ? ["fuzzy"] : [],
          }),
        );
      }

      match = unitRegex.exec(content);
    }

    const header = createPOHeader(targetLang, {
      contentType: "text/plain; charset=UTF-8",
      xGenerator: "Obsidian PO Editor",
    });

    return {
      charset: "utf-8",
      header,
      entries,
    };
  }

  compile(poFile: POFile): string {
    const targetLang = poFile.header.language || "und";
    const sourceLang = "en";

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += `<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n`;
    xml += `  <file original="messages" source-language="${sourceLang}" target-language="${targetLang}" datatype="plaintext">\n`;
    xml += `    <body>\n`;

    for (const entry of poFile.entries) {
      const id = this.escapeXml(entry.msgid);
      const source = this.escapeXml(entry.msgid);
      const msgstr = Array.isArray(entry.msgstr) ? entry.msgstr[0] || "" : entry.msgstr;
      const target = this.escapeXml(msgstr);
      const state = (entry.flags ?? []).includes("fuzzy") ? "needs-adaptation" : "final";

      xml += `      <trans-unit id="${id}">\n`;
      xml += `        <source>${source}</source>\n`;
      xml += `        <target state="${state}">${target}</target>\n`;
      if (entry.comments?.translator) {
        xml += `        <note>${this.escapeXml(entry.comments.translator)}</note>\n`;
      }
      xml += `      </trans-unit>\n`;
    }

    xml += `    </body>\n`;
    xml += `  </file>\n`;
    xml += `</xliff>\n`;

    return xml;
  }

  private extractTag(content: string, tag: string): string | undefined {
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
    const match = regex.exec(content);
    return match ? match[1] : undefined;
  }

  private extractAttr(content: string, attr: string): string | undefined {
    const regex = new RegExp(`${attr}="([^"]*)"`, "i");
    const match = regex.exec(content);
    return match ? match[1] : undefined;
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  private unescapeXml(str: string): string {
    return str
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&gt;/g, ">")
      .replace(/&lt;/g, "<")
      .replace(/&amp;/g, "&");
  }
}

export function createXLIFFConverter(): XLIFFConverter {
  return new XLIFFConverter();
}

export const xliffConverter = createXLIFFConverter();
