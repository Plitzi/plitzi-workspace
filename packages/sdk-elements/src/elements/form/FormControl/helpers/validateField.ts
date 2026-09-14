import { get } from '@plitzi/plitzi-ui/helpers';

/**
 * What a control asks of its value before the form around it may submit.
 *
 * Zero and the empty string mean "no rule", so a control authored before these existed validates exactly as it did.
 * Every rule carries the sentence it says when broken, and an empty one falls back to English: the site's language is
 * the author's to write, never the browser's to guess.
 */
export type FieldRules = {
  required: boolean;
  requiredMessage: string;
  minLength: number;
  minLengthMessage: string;
  maxLength: number;
  maxLengthMessage: string;
  /**
   * The control's `subType`. A type whose value has a shape of its own (see `FORMATS`) is checked against it here,
   * because a form with `noValidate` leaves nobody else to ask for it.
   */
  type: string;
  /** Said when the value does not have the shape its type asks for, whichever type that is. */
  formatMessage: string;
  /** A regular expression the WHOLE value must match — anchored here, so an author never has to remember `^…$`. */
  pattern: string;
  patternMessage: string;
  /** The `name` of another control in the same form whose value this one has to repeat. */
  matches: string;
  matchesMessage: string;
};

export const REQUIRED_MESSAGE = 'This field is required';

const DEFAULT_PATTERN_MESSAGE = 'This is not in the expected format';

const DEFAULT_MATCHES_MESSAGE = 'This does not match';

/** The HTML standard's "valid email address", which is what a browser checks `type="email"` against. */
const EMAIL =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

type Format = { matches: (text: string) => boolean; message: string };

/**
 * The types whose value has a shape of its own, by the definition a browser checks each against. Another one is an
 * entry here and nothing else: `formatMessage` already speaks for all of them.
 */
const FORMATS = new Map<string, Format>([
  ['email', { matches: text => EMAIL.test(text), message: 'Enter an email address' }]
]);

/** Whether a control of this type asks its value for a shape, and so whether a `formatMessage` can ever be said. */
export const hasFormat = (type: string): boolean => FORMATS.has(type);

const isBlank = (value: unknown): boolean => value === undefined || value === null || value === '' || value === false;

const asText = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }

  return typeof value === 'number' ? String(value) : '';
};

/**
 * Anchored, and failing CLOSED on an expression that does not compile.
 *
 * A pattern is typed by an author, and one that silently stopped validating would be a form accepting everything while
 * looking guarded. Refusing every value instead is loud in the first preview, which is where an author finds it.
 */
const matchesPattern = (text: string, pattern: string): boolean => {
  try {
    return new RegExp(`^(?:${pattern})$`, 'u').test(text);
  } catch {
    return false;
  }
};

/**
 * The first rule a value breaks, as the sentence to show under the control — or `''` when it breaks none.
 *
 * An empty optional control is valid whatever else it asks for: "at least ten characters" is about a value somebody
 * chose to give, and a blank company name has not given one.
 *
 * Lengths are counted in code points rather than UTF-16 units, because that is what a person typing counts: an emoji
 * is one character to them and two to `String.length`.
 */
export const validateField = (value: unknown, rules: FieldRules, values: Record<string, unknown>): string => {
  if (isBlank(value)) {
    return rules.required ? rules.requiredMessage || REQUIRED_MESSAGE : '';
  }

  if (typeof value === 'boolean') {
    return '';
  }

  const text = asText(value);
  const length = Array.from(text).length;
  if (rules.minLength > 0 && length < rules.minLength) {
    return rules.minLengthMessage || `Use at least ${rules.minLength} characters`;
  }

  if (rules.maxLength > 0 && length > rules.maxLength) {
    return rules.maxLengthMessage || `Use at most ${rules.maxLength} characters`;
  }

  const format = FORMATS.get(rules.type);
  if (format && !format.matches(text)) {
    return rules.formatMessage || format.message;
  }

  if (rules.pattern && !matchesPattern(text, rules.pattern)) {
    return rules.patternMessage || DEFAULT_PATTERN_MESSAGE;
  }

  if (rules.matches && text !== asText(get(values, rules.matches, ''))) {
    return rules.matchesMessage || DEFAULT_MATCHES_MESSAGE;
  }

  return '';
};
