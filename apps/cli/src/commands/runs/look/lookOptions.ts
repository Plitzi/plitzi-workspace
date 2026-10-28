import type { VisitorOptions } from '../../register/options';
import type { RunCommandOptions } from '../shell';

/**
 * What `task look` is asked: how it reads, pictures and compares a task's pages — as the visitor the page commands
 * take (`withVisitorOptions`): `--as` a page for signed-in visitors as one of them, `--guest` a guest's though its
 * acceptance reads it signed in (a run's lead looked at a guest's conversation through page check, by hand).
 */
export interface LookOptions extends RunCommandOptions, Omit<VisitorOptions, 'url'> {
  /** Clicked once each page settles, as `page check --click`: an open state looked at, not only the page at rest. */
  click?: string;
  /**
   * The pointer put over it once each page settles, as `page check --hover`: what that changes said, and the page
   * pictured with it there — at 1440 alone, as a phone has no pointer to hover with.
   */
  hover?: string;
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
  /** One part alone — an element's name, a tag or a selector, as `page outline --within`: pictured and set beside it. */
  within?: string;
}
