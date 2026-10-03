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

/** Every field `notifications` takes — what an editor of the setting (the MCP server's `patchSettings`) offers. */
export const NOTIFICATIONS_FIELDS: readonly (keyof NotificationsSpec)[] = FIELDS.filter(isField);

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

/** The space's custom CSS with its notifications' rule after it — how a space's `customCss` carries both. */
export const withNotificationsCss = (customCss: string, spec: NotificationsSpec | undefined): string =>
  [customCss, notificationsCss(spec)].filter(Boolean).join('\n\n');

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const CONTAINER_RULE = new RegExp(`${escape(CONTAINER)}\\s*\\{([^}]*)\\}`);
const TOAST_RULE = new RegExp(`:where\\(${escape(CONTAINER)} \\.Toastify__toast\\)\\s*\\{([^}]*)\\}`);

/** One rule's declarations, each mapped to the field it says — or nothing at all when one is not a field's. */
const readRule = (body: string, fieldOf: (property: string) => keyof NotificationsSpec | undefined) => {
  const read: [keyof NotificationsSpec, string][] = [];
  for (const declaration of body
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)) {
    const colon = declaration.indexOf(':');
    const field = colon > 0 ? fieldOf(declaration.slice(0, colon).trim()) : undefined;
    if (!field) {
      return undefined;
    }

    read.push([field, declaration.slice(colon + 1).trim()]);
  }

  return read;
};

const VARIABLE_FIELDS = new Map(
  Object.entries(VARIABLES).flatMap(([field, variables]) =>
    isField(field) ? variables.map(variable => [variable, field] as const) : []
  )
);
const PROPERTY_FIELDS = new Map(
  Object.entries(PROPERTIES).flatMap(([field, property]) => (isField(field) ? [[property, field] as const] : []))
);

/**
 * A space's custom CSS read apart: the notifications' rule {@link notificationsCss} wrote, back as the spec, and the
 * space's own CSS without it — so an editor shows and changes each on its own, and writes them together again with
 * {@link withNotificationsCss}. A rule someone edited into something else (a declaration that is no field's) is left
 * where it is, as the space's own CSS: read back, it would lose what was added to it.
 */
export const splitNotificationsCss = (customCss: string): { notifications: NotificationsSpec; customCss: string } => {
  const notifications: NotificationsSpec = {};
  for (const [rule, fieldOf] of [
    [CONTAINER_RULE, (property: string) => VARIABLE_FIELDS.get(property)],
    [TOAST_RULE, (property: string) => PROPERTY_FIELDS.get(property)]
  ] as const) {
    const match = rule.exec(customCss);
    for (const [field, value] of (match ? readRule(match[1], fieldOf) : undefined) ?? []) {
      notifications[field] = value;
    }
  }

  // Taken out only when it ends the CSS exactly as `withNotificationsCss` puts it there, so what is left is the space's
  // own CSS byte for byte; anything else — a rule moved, reformatted, its light and dark told apart — stays as written.
  const written = Object.keys(notifications).length > 0 ? notificationsCss(notifications) : '';
  if (!written || !customCss.endsWith(written)) {
    return { notifications: {}, customCss };
  }

  const own = customCss.slice(0, customCss.length - written.length);

  return { notifications, customCss: own.endsWith('\n\n') ? own.slice(0, -2) : own };
};
