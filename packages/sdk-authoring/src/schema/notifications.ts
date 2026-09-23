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
}

/** Each field, and the library variables it sets on the toast container. */
const VARIABLES: Record<keyof NotificationsSpec, readonly string[]> = {
  background: ['--toastify-color-light', '--toastify-color-dark'],
  text: ['--toastify-text-color-light', '--toastify-text-color-dark'],
  success: ['--toastify-color-success'],
  danger: ['--toastify-color-error'],
  warning: ['--toastify-color-warning'],
  info: ['--toastify-color-info'],
  radius: ['--toastify-toast-bd-radius']
};

const FIELDS = Object.keys(VARIABLES);

const isField = (key: string): key is keyof NotificationsSpec => Object.hasOwn(VARIABLES, key);

/**
 * The rule that styles the toast container, or `''` when there is nothing to say.
 *
 * Refuses what would not style anything: an unknown field, and a value that is not one CSS value — a `;` or a brace
 * would end the declaration early and let the rest of the text become rules of its own.
 */
export const notificationsCss = (spec: NotificationsSpec | undefined): string => {
  const declarations: string[] = [];
  for (const [key, value] of Object.entries(spec ?? {})) {
    if (!isField(key)) {
      throw new Error(`\`notifications\` has no "${key}". It takes ${FIELDS.join(', ')}.`);
    }

    if (value === undefined) {
      continue;
    }

    if (typeof value !== 'string' || value.trim() === '' || /[;{}]/.test(value)) {
      throw new Error(
        `\`notifications.${key}\` is ${JSON.stringify(value)}, which is not one CSS value. Write a colour or a length, like 'var(--card)' or '12px'.`
      );
    }

    declarations.push(...VARIABLES[key].map(variable => `  ${variable}: ${value.trim()};`));
  }

  return declarations.length > 0 ? `.Toastify__toast-container.plitzi-sdk-toasts {\n${declarations.join('\n')}\n}` : '';
};
