import { StreamLanguage } from "@codemirror/language";

export const poLanguage = StreamLanguage.define({
  token(stream) {
    if (stream.sol()) {
      if (stream.match(/^#[.,:~|!]?/)) {
        stream.skipToEnd();
        return "comment";
      }
      if (stream.match(/^(msgid_plural|msgid|msgstr(?:\[\d+\])?|msgctxt|domain)\b/)) {
        return "keyword";
      }
    }
    if (stream.match(/^"(?:[^"\\]|\\.)*"/)) {
      return "string";
    }
    stream.next();
    return null;
  },
});
