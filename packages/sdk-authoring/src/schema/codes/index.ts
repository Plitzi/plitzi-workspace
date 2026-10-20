/**
 * Every problem `authorSpace` and `lintSpace` report, by its code: whether it is refused or warned, what was wrong, and
 * what to write instead — and every suggestion `suggestSpace` makes, a shorter way to the same page.
 *
 * The one table, written a subject to a module and joined here: a refusal or a warning raised with a code that is not
 * here is a compile error, and the skill's `authoring-errors.md` is generated from it (`yarn generate:authoring-errors`),
 * so the page cannot miss one. The UPPER_CASE codes beside these come from the documents' own structure
 * (`validateSchema`) and only a hand-written or hand-edited JSON has them — the three an authored space can meet are
 * listed here too.
 */
import { ACCESSIBILITY_CODES } from './accessibility';
import { ANCHOR_CODES } from './anchors';
import { BINDING_CODES } from './bindings';
import { COMPONENT_CODES } from './components';
import { CSS_CODES } from './css';
import { ELEMENT_CODES } from './elements';
import { FLAG_CODES } from './flags';
import { FLOW_CODES } from './flows';
import { PAGE_CODES } from './pages';
import { SELECTOR_CODES } from './selectors';
import { SERVER_CODES } from './server';
import { SPACE_CODES } from './space';
import { SUGGESTION_CODES } from './suggestions';

import type { AuthoringCodeEntry } from './entry';

export type { AuthoringCodeEntry } from './entry';

export const AUTHORING_CODES = {
  ...SPACE_CODES,
  ...PAGE_CODES,
  ...ANCHOR_CODES,
  ...SELECTOR_CODES,
  ...CSS_CODES,
  ...ELEMENT_CODES,
  ...BINDING_CODES,
  ...COMPONENT_CODES,
  ...FLAG_CODES,
  ...FLOW_CODES,
  ...SERVER_CODES,
  ...ACCESSIBILITY_CODES,
  ...SUGGESTION_CODES
} as const satisfies Record<string, AuthoringCodeEntry>;

type Codes = typeof AUTHORING_CODES;

export type AuthoringCode = keyof Codes;

export type RefusalCode = {
  [Code in AuthoringCode]: Codes[Code]['kind'] extends 'refused' ? Code : never;
}[AuthoringCode];

export type WarningCode = {
  [Code in AuthoringCode]: Codes[Code]['kind'] extends 'warned' ? Code : never;
}[AuthoringCode];

export type SuggestionCode = {
  [Code in AuthoringCode]: Codes[Code]['kind'] extends 'suggested' ? Code : never;
}[AuthoringCode];

const isAuthoringCode = (code: string): code is AuthoringCode => Object.hasOwn(AUTHORING_CODES, code);

/** Whether a code is a suggestion's: what an element's `quiet` may name. */
export const isSuggestionCode = (code: unknown): code is SuggestionCode =>
  typeof code === 'string' && isAuthoringCode(code) && AUTHORING_CODES[code].kind === 'suggested';

/**
 * The row of a code a problem was reported with — what any tool that relays a problem adds to it (the MCP, the CLI),
 * so the fix travels with the code and nobody needs the skill's page to read it. `undefined` for a structural
 * UPPER_CASE code of `validateSchema` the table does not hold.
 */
export const authoringCodeEntry = (code: string): AuthoringCodeEntry | undefined =>
  isAuthoringCode(code) ? AUTHORING_CODES[code] : undefined;

/**
 * A declaration `authorSpace` will not write, with the code its row in `authoring-errors.md` is filed under.
 *
 * `reason` is the sentence alone; `message` leads with the code, so an error that escapes on its own still says where
 * to look it up.
 */
export class AuthoringError extends Error {
  readonly code: RefusalCode;
  readonly reason: string;

  constructor(code: RefusalCode, reason: string, options?: ErrorOptions) {
    super(`[${code}] ${reason}`, options);
    this.name = 'AuthoringError';
    this.code = code;
    this.reason = reason;
  }
}
