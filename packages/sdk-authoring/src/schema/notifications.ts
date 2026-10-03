import { AuthoringError } from './codes';

/**
 * How a space's notifications look — the toasts an `addNotification` step shows.
 *
 * Every value is any CSS colour or length, and a token is the right answer for all of them (`'var(--card)'`): a token
 * follows the light/dark toggle, which the notifications already do. Left out, a value keeps the library's own.
 */
export interface NotificationsSpec {
  /** The toast's surface. */
  background?: string;
  /** Its text. */
  text?: string;
  /** The accent of each `appearance`: its icon and its progress bar. */
  success?: string;
  danger?: string;
  warning?: string;
  info?: string;
  /** Corner radius, e.g. `'12px'`. */
  radius?: string;
  /** Its typeface — the space's own, as a token: `'var(--font-sans)'`. */
  font?: string;
  /** Its text size, e.g. `'13px'`. */
  fontSize?: string;
  /** Its edge, as `border` writes it: `'1px solid var(--border)'`. */
  border?: string;
  /** Its depth, as `box-shadow` writes it: `'var(--shadow-lg)'`. */
  shadow?: string;
  /** The room inside it, e.g. `'12px 14px'`. */
  padding?: string;
}

/** The fields the library has a variable for, and the variables each sets on the toast container. */
const VARIABLES: Partial<Record<keyof NotificationsSpec, readonly string[]>> = {
  background: ['--toastify-color-light', '--toastify-color-dark'],
  text: ['--toastify-text-color-light', '--toastify-text-color-dark'],
  success: ['--toastify-color-success'],
  danger: ['--toastify-color-error'],
  warning: ['--toastify-color-warning'],
  info: ['--toastify-color-info'],
  radius: ['--toastify-toast-bd-radius'],
  font: ['--toastify-font-family'],
  shadow: ['--toastify-toast-shadow'],
  padding: ['--toastify-toast-padding']
};

/** The fields it has none for, written on the toast itself — which carries no class of the space's to say them. */
const PROPERTIES: Partial<Record<keyof NotificationsSpec, string>> = { fontSize: 'font-size', border: 'border' };

const FIELDS = [...Object.keys(VARIABLES), ...Object.keys(PROPERTIES)];

const isField = (key: string): key is keyof NotificationsSpec => FIELDS.includes(key);

const CONTAINER = '.Toastify__toast-container.plitzi-sdk-toasts';

/**
 * The rule that styles the toast container, or `''` when there is nothing to say.
 *
 * Refuses what would not style anything: an unknown field, and a value that is not one CSS value — a `;` or a brace
 * would end the declaration early and let the rest of the text become rules of its own.
 */
export const notificationsCss = (spec: NotificationsSpec | undefined): string => {
  const declarations: string[] = [];
  const toast: string[] = [];
  for (const [key, value] of Object.entries(spec ?? {})) {
    if (!isField(key)) {
      throw new AuthoringError(
        'notifications-shape',
        `\`notifications\` has no "${key}". It takes ${FIELDS.join(', ')}.`
      );
    }

    if (value === undefined) {
      continue;
    }

    if (typeof value !== 'string' || value.trim() === '' || /[;{}]/.test(value)) {
      throw new AuthoringError(
        'notifications-shape',
        `\`notifications.${key}\` is ${JSON.stringify(value)}, which is not one CSS value. Write a colour or a length, like 'var(--card)' or '12px'.`
      );
    }

    const property = PROPERTIES[key];
    if (property) {
      toast.push(`  ${property}: ${value.trim()};`);
    } else {
      declarations.push(...(VARIABLES[key] ?? []).map(variable => `  ${variable}: ${value.trim()};`));
    }
  }

  return [
    declarations.length > 0 ? `${CONTAINER} {\n${declarations.join('\n')}\n}` : '',
    // No weight at all, so a rule of the space's own — the error toast's border colour — still wins over it.
    toast.length > 0 ? `:where(${CONTAINER} .Toastify__toast) {\n${toast.join('\n')}\n}` : ''
  ]
    .filter(Boolean)
    .join('\n');
};
