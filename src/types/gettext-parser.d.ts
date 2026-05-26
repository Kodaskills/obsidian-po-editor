declare module "gettext-parser" {
  export interface GettextComment {
    translator?: string;
    extracted?: string;
    reference?: string;
    previous?: string;
    flag?: string;
  }

  export interface GettextEntry {
    msgid: string;
    msgstr: string | string[];
    msgctxt?: string;
    msgid_plural?: string;
    comments?: GettextComment;
    obsolete?: boolean;
  }

  export interface GettextTranslations {
    [context: string]: {
      [msgid: string]: GettextEntry;
    };
  }

  export interface GettextData {
    charset: string;
    headers: Record<string, string>;
    translations: GettextTranslations;
    obsolete?: GettextTranslations;
  }

  export interface ParseOptions {
    defaultCharset?: string;
    validation?: boolean;
  }

  export interface CompileOptions {
    foldLength?: number;
    sort?: boolean | ((a: GettextEntry, b: GettextEntry) => number);
    escapeCharacters?: boolean;
  }

  export interface ParseStream extends NodeJS.WritableStream {
    on(event: "data", listener: (data: GettextData) => void): this;
    on(event: string, listener: (...args: unknown[]) => void): this;
  }

  const po: {
    parse(content: string, options?: ParseOptions): GettextData;
    compile(table: GettextData, options?: CompileOptions): Buffer;
    createParseStream(options?: ParseOptions): ParseStream;
  };

  export { po };
}
