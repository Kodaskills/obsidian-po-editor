export interface POEntry {
    readonly msgid: string;
    readonly msgstr: string;
    readonly msgctxt?: string;
    readonly msgidPlural?: string;
    readonly msgstrPlural?: string[];
    readonly comments: {
        translator?: string;     // #
        extracted?: string;      // #.
        reference?: string;      // #:
        previous?: string;       // #|
    };
    readonly flags: POFlag[];    // #,
    readonly obsolete: boolean;
}

export type POFlag = 'fuzzy' | 'c-format' | 'no-c-format' | 'icu-format' | 'python-format' | 'python-brace-format' | 'csharp-format';

export function createPOEntry(
    msgid: string,
    msgstr: string,
    options?: Partial<Omit<POEntry, 'msgid' | 'msgstr'>>
): POEntry {
    return {
        msgid: msgid || '',
        msgstr: msgstr || '',
        msgctxt: options?.msgctxt,
        msgidPlural: options?.msgidPlural,
        msgstrPlural: options?.msgstrPlural || [],
        comments: options?.comments || {},
        flags: options?.flags || [],
        obsolete: options?.obsolete || false,
    };
}

export function parsePOEntry(raw: any): POEntry {
    const flags: POFlag[] = [];
    if (raw.comments?.flag) {
        raw.comments.flag.split(',').map((f: string) => f.trim()).filter(Boolean).forEach((f: string) => flags.push(f as POFlag));
    }

    const comments: POEntry['comments'] = {};
    if (raw.comments) {
        comments.translator = raw.comments.translator;
        comments.extracted = raw.comments.extracted;
        comments.reference = raw.comments.reference;
        comments.previous = raw.comments.previous;
    }

    const msgstr = Array.isArray(raw.msgstr) ? (raw.msgstr[0] || '') : (raw.msgstr || '');
    const msgstrPlural = Array.isArray(raw.msgstr) ? raw.msgstr : [];

    return {
        msgid: raw.msgid || '',
        msgstr,
        msgctxt: raw.msgctxt,
        msgidPlural: raw.msgid_plural,
        msgstrPlural,
        comments,
        flags,
        obsolete: !!raw.obsolete,
    };
}

export function serializePOEntry(entry: POEntry): any {
    let msgstr: string[];
    if (entry.msgidPlural) {
        // plural entry: msgstrPlural must have at least one element
        msgstr = (entry.msgstrPlural && entry.msgstrPlural.length > 0)
            ? entry.msgstrPlural
            : [''];
    } else {
        msgstr = [entry.msgstr || ''];
    }
    const raw: any = {
        msgid: entry.msgid,
        msgstr,
    };

    if (entry.msgctxt) raw.msgctxt = entry.msgctxt;
    if (entry.msgidPlural) raw.msgid_plural = entry.msgidPlural;

    const hasComments = entry.comments.translator || entry.comments.extracted || entry.comments.reference || entry.comments.previous;
    if (hasComments || entry.flags.length > 0) {
        raw.comments = {};
        if (entry.comments.translator) raw.comments.translator = entry.comments.translator;
        if (entry.comments.extracted) raw.comments.extracted = entry.comments.extracted;
        if (entry.comments.reference) raw.comments.reference = entry.comments.reference;
        if (entry.comments.previous) raw.comments.previous = entry.comments.previous;
        if (entry.flags.length > 0) raw.comments.flag = entry.flags.join(', ');
    }

    return raw;
}
