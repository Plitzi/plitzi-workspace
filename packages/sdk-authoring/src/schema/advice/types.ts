import type { SuggestionCode } from '../codes';

/**
 * A shorter way to the same page — not a problem: what is written renders as written.
 *
 * `saves` is how many elements the space would no longer carry, the measure suggestions are ranked by; a suggestion
 * about the stylesheet saves none and is listed after those that do.
 */
export interface Suggestion {
  code: SuggestionCode;
  message: string;
  /** The elements it is about, the first being the one to look at. Empty for one about the stylesheet. */
  elementIds: string[];
  saves: number;
  /** Where the first of them was written: `src/site/home.ts:42`. Absent when no factory wrote it. */
  at?: string;
}
