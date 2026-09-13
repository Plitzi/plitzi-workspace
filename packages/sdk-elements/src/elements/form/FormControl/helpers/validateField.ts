import { get } from '@plitzi/plitzi-ui/helpers';

/**
 * What a control asks of its value before the form around it may submit.
 *
 * Zero and the empty string mean "no rule", so a control authored before these existed validates exactly as it did.
 */
export type FieldRules = {
  required: boolean;
  minLength: number;
  maxLength: number;
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
    return rules.required ? REQUIRED_MESSAGE : '';
  }

  if (typeof value === 'boolean') {
    return '';
  }

  const text = asText(value);
  const length = Array.from(text).length;
  if (rules.minLength > 0 && length < rules.minLength) {
    return `Use at least ${rules.minLength} characters`;
  }

  if (rules.maxLength > 0 && length > rules.maxLength) {
    return `Use at most ${rules.maxLength} characters`;
  }

  if (rules.pattern && !matchesPattern(text, rules.pattern)) {
    return rules.patternMessage || DEFAULT_PATTERN_MESSAGE;
  }

  if (rules.matches && text !== asText(get(values, rules.matches, ''))) {
    return rules.matchesMessage || DEFAULT_MATCHES_MESSAGE;
  }

  return '';
};
