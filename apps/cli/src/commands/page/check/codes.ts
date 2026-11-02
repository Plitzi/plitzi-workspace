import type { CheckIssue } from './types';

/**
 * What each code `plitzi page check` raises means — the page's own, authoring's measures of it and the data's — which
 * `plitzi explain <code>` answers. Keyed by every code an issue can carry, so a new one is not left unexplained: a run
 * asked `explain flush-edge` and was told it was no name Plitzi had.
 */
export const PAGE_CHECK_CODES: Readonly<Record<CheckIssue['code'], string>> = {
  'no-answer': 'nothing answers at the address the page was asked at: the server is not running there, or refused it',
  'no-page': 'no page of the space answers at the path asked: its slug is another, or it is not in the space',
  'flow-failed': 'a flow of the page failed as it ran: the step, and why, are in the message',
  'server-render-failed':
    'a provider failed on the page server and was answered in the browser after: the first paint and a crawler lack what it holds',
  'not-server-rendered':
    'a provider resolved on the server held parts that were not in the HTML it sent: they arrived after the page',
  'not-signed-in': 'the page was asked as an account (--as) that could not be signed in',
  'steps-failed': 'a step given with --steps could not be played: the message names it and why',
  'not-hydrated': 'the page never became interactive: what was waited for, and for how long, is in the message',
  redirected: 'the page sent the visit elsewhere: where it landed is in the message',
  'page-status': 'the page was sent with another HTTP status than the one asked for (--status)',
  'expected-text': 'a text asked for with --expect is not on the page, or not where it was asked to be',
  'label-wraps': 'a link or button of three words or fewer breaks onto more than one line: its row squeezes it',
  'fixed-ground':
    'a ground stays the same in light and dark while the text on it follows the theme, and in one of them it barely reads',
  'faint-text': 'text that barely reads on its ground, in the scheme the page was read in',
  'flush-edge':
    'a link or button sits on its section’s bottom edge, the section keeping no space below it while the page goes on: it touches what follows',
  'form-held-back': 'the browser held a form back before any flow of its submit ran: a field’s own validation bubble',
  'server-logged':
    'the server logged errors as the pages were opened: the lines, and where its log is, are in the message',
  'state-unheld': 'a key asked with --state is no state key or source the page holds',
  'space-not-authored': 'the space did not author, so the server answered an error page: npm run author says why',
  'not-rendered':
    'nothing on the page carries data-plitzi-el: the space did not render there, or renders with testAttributes: false',
  'element-missing': 'an element of the page is not in what the browser drew',
  'element-hidden': 'an element is on the page but not visible: what hides it is in the message',
  'image-not-loaded': 'an image did not load, or its address is still a binding with no value here',
  'element-empty':
    'an element shows no words or no picture — what it reads has nothing — or is a text with no words drawing a box, a mark to say decorative',
  'sideways-scroll': 'the page scrolls sideways: the widest parts are named',
  'cut-off':
    'an element is cut off at the edge of the screen: an ancestor hides what spills past it, so nothing scrolls to it',
  'out-of-reach':
    'part of the page is drawn where no visitor reaches it: below the screen of a page that does not scroll, or below the fold of a pane with its scrollbar hidden',
  'illegible-text': 'text that cannot be told from what is behind it, under the contrast body text asks',
  'heading-skipped': 'the page’s headings skip a level, or its first is not its h1',
  'control-unnamed': 'a control has no name a screen reader can read',
  'page-empty': 'the page draws nothing of its own — no words, no picture, no control: only its layout',
  'binding-reads-nothing': 'a binding reads a path its provider’s answer does not have, so what it binds is empty',
  'provider-failed': 'a provider failed, so everything bound to it is empty'
};
