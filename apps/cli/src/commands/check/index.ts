/**
 * `plitzi page check`: whether a page of the running project is whole, said in text — every element it owes on screen, no
 * image broken, nothing scrolling sideways, no text in the colour behind it, no error in the console, no request
 * refused — at each width asked. What an agent needs to know about a page in a few hundred tokens, where a screenshot
 * costs thousands and still has to be looked at; a picture is for when this says something is wrong.
 *
 * With the page's dev tools on (any development server) it also says every flow that failed while the page loaded,
 * every binding that reads a path its provider's answer does not have — none inside an element the page is not
 * showing, which is not mounted — and each list's rows, drawn and in its source, and, asked, what the page holds:
 * `--state` (the state, and every source by name) and `--element <id>`. `--ssr` holds the HTML the server sent against
 * the page once hydrated: what a server provider holds and the server's HTML lacked arrived late.
 *
 *   plitzi page check / --width 1440,390 --json
 *   plitzi page check /products --state --element catalog-count
 *   plitzi page check /pricing --ssr
 */

export { serverErrors } from './types';
export type {
  CheckIssue,
  CheckOptions,
  CheckReport,
  ClickAsk,
  ClickReport,
  ContestedStyle,
  ElementStyles,
  Expectation,
  ListRows,
  PageMoment
} from './types';
export {
  CHECK_PASSWORD_ENV,
  CHECK_USER_ENV,
  checkAccount,
  landingProblem,
  projectAccount,
  saySignedIn,
  sentElsewhere,
  signedInNote,
  signInAs,
  signInWhereSent
} from './account';
export type { Account, SignedInWhereSent } from './account';
export { isNotFoundPage, notShownInPage, pageFor, staticPaths } from './space';
export { contestedStylesInPage, contestedText, inertText } from './styles';
export {
  listenForRefusedFieldsInPage,
  LOOK_PROPERTIES,
  lookChanges,
  looksInPage,
  momentChanges,
  pageMomentInPage,
  refusedFieldsInPage
} from './moments';
export { copiesOf, expectationMissed, meantOnPage, textsInPage, wrappedLabelsInPage } from './expect';
export { listText, renderedRowsInPage } from './lists';
export { clickedText, reportText } from './text';
export { check, checkRoutes } from './command';
