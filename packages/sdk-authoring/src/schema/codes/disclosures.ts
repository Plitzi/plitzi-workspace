import type { AuthoringCodeEntry } from './entry';

/** Disclosures (`disclosure`, `disclosureSummary`). */
export const DISCLOSURE_CODES = {
  'disclosure-summary-first': {
    kind: 'refused',
    means:
      'a `disclosure` whose first child is not its `disclosureSummary` — the browser opens it by its first `<summary>` alone, and draws "Details" of its own otherwise',
    fix: '`disclosure({ children: [disclosureSummary([…]), …what it shows] })`: one summary, first'
  },
  'disclosure-summary-control': {
    kind: 'refused',
    means:
      'a button, a link or a field inside a `disclosureSummary` — the summary is the control: one inside it is a control within a control, which a keyboard and a screen reader cannot tell apart, and pressing it opens the disclosure too',
    fix: 'words in the summary (a text, a heading); the button or the link in what the disclosure shows, or beside it'
  },
  'disclosure-summary-unnamed': {
    kind: 'warned',
    means: 'a `disclosureSummary` with nothing in it — a screen reader announces a control with no name',
    fix: 'a text or a heading inside it: what opening it shows'
  }
} as const satisfies Record<string, AuthoringCodeEntry>;
