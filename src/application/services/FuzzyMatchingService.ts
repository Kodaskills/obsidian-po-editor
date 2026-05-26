import { type POEntry } from "@domain/entities/POEntry";
import * as guessRater from "guess-rater";

export interface FuzzyMatch {
  msgid: string;
  msgstr: string;
  score: number;
}

export class FuzzyMatchingService {
  /**
   * Finds fuzzy matches for a given source string (msgid) from a list of TM entries.
   * Filters out exact matches.
   */
  findMatches(targetMsgid: string, tmEntries: POEntry[], threshold: number = 0.5): FuzzyMatch[] {
    const tmEntriesWithMsgstr = tmEntries.filter(
      (entry) => typeof entry.msgstr === "string" && entry.msgstr.trim() !== "",
    );

    const matches = tmEntriesWithMsgstr
      .map((entry) => ({
        msgid: entry.msgid,
        msgstr: entry.msgstr as string,
        score: guessRater.getSimilarityScore(targetMsgid, entry.msgid) / 100,
      }))
      .filter((match) => match.score >= threshold && match.score < 1)
      .sort((a, b) => b.score - a.score);

    return matches;
  }
}
