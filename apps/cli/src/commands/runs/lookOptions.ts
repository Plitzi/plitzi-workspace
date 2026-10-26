import type { RunCommandOptions } from './shell';

/** What `task look` is asked: how it reads, pictures and compares a task's pages. */
export interface LookOptions extends RunCommandOptions {
  /** Looked at anew, though it was looked at already as asked and nothing changed since. */
  fresh?: boolean;
  /** Clicked once each page settles, as `page check --click`: an open state looked at, not only the page at rest. */
  click?: string;
  /** The visitor's time zone (IANA) every page is read in: the machine's when left out. */
  timezone?: string;
  /**
   * The pointer put over it once each page settles, as `page check --hover`: what that changes said, and the page
   * pictured with it there — at 1440 alone, as a phone has no pointer to hover with.
   */
  hover?: string;
  /** Signed in first as this account, as `page check --as`: the password from `PLITZI_CHECK_PASSWORD`. */
  as?: string;
  /**
   * Read as a guest, though a page sends one away or its acceptance reads it signed in, as `page check --guest`: a task
   * about what a guest sees (a run's lead looked at a guest's conversation through page check, by hand).
   */
  guest?: boolean;
  /**
   * Played on each page before it is pictured, as `page shot --steps`: a UI only a channel's message or a flow shows —
   * a notice set in `state` — looked at, where a look could not reach it (a run's lead, at a "room opened" notice).
   */
  steps?: string;
  /** Read in the page, as `page check --element`: each one's attributes, box and classes. */
  element?: string[];
  /** Each page set beside the run before the task — its approved work — and what changed, section by section. */
  before?: boolean;
  /** The status its pages are meant to be sent with, as `page check --status`: a 404 page looked at as one. */
  status?: number;
  /** The widths looked at and pictured, in place of 1440 and 390 — `page shot`'s, so the two are said the same. */
  width?: string;
  /** The schemes pictured at each width, in place of light at 1440 and dark at 390. */
  scheme?: string;
}
