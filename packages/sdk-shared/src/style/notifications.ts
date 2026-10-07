/**
 * How a space's notifications look — the toasts an `addNotification` step shows: the toast, and the parts inside it
 * (its icon, its close button, its progress bar).
 *
 * Every value is one CSS value — a colour, a length, a weight — and a token is the right answer wherever there is one
 * (`'var(--card)'`): a token follows the light/dark toggle, which the notifications already do. Left out, a value keeps
 * the library's own.
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
  /** The least it is tall — `'0px'` lets a one-line message be one line high. */
  minHeight?: string;
  /** Its text's weight, e.g. `'500'`. */
  fontWeight?: string;
  /** Its text's leading, e.g. `'1.45'`. */
  lineHeight?: string;
  /** The icon's width, e.g. `'18px'`. */
  iconSize?: string;
  /** The room between the icon and the message, e.g. `'10px'`. */
  iconGap?: string;
  /** The close button's colour, e.g. `'var(--muted)'`. */
  closeColor?: string;
  /** How opaque the close button is at rest, e.g. `'0.8'`; hovered or focused it is opaque. */
  closeOpacity?: string;
  /** How tall the progress bar is, e.g. `'2px'`. */
  progressHeight?: string;
}

const CONTAINER = '.Toastify__toast-container.plitzi-sdk-toasts';

/** One rule the spec writes: where, and the properties (or the library's variables) each field sets there. */
type NotificationsRule = {
  selector: string;
  fields: Partial<Record<keyof NotificationsSpec, readonly string[]>>;
};

/**
 * Every rule a spec writes, in the order they are written.
 *
 * What the library has a variable for is set on the container. The toast's own properties are written with no weight
 * at all, so a rule of the space's own — the error toast's border colour — still wins over them. The parts inside the
 * toast are dressed by the library's own rules, injected at run time and unlayered, so theirs carry the container
 * in front to outweigh them.
 */
const RULES: readonly NotificationsRule[] = [
  {
    selector: CONTAINER,
    fields: {
      background: ['--toastify-color-light', '--toastify-color-dark'],
      text: ['--toastify-text-color-light', '--toastify-text-color-dark'],
      success: ['--toastify-color-success'],
      danger: ['--toastify-color-error'],
      warning: ['--toastify-color-warning'],
      info: ['--toastify-color-info'],
      radius: ['--toastify-toast-bd-radius'],
      font: ['--toastify-font-family'],
      shadow: ['--toastify-toast-shadow'],
      padding: ['--toastify-toast-padding'],
      minHeight: ['--toastify-toast-min-height']
    }
  },
  {
    selector: `:where(${CONTAINER} .Toastify__toast)`,
    fields: { fontSize: ['font-size'], fontWeight: ['font-weight'], lineHeight: ['line-height'], border: ['border'] }
  },
  { selector: `${CONTAINER} .Toastify__toast-icon`, fields: { iconSize: ['width'], iconGap: ['margin-inline-end'] } },
  { selector: `${CONTAINER} .Toastify__close-button`, fields: { closeColor: ['color'] } },
  // At rest only: hovered or focused, the button comes forward as the library has it.
  { selector: `${CONTAINER} .Toastify__close-button:not(:hover, :focus)`, fields: { closeOpacity: ['opacity'] } },
  // The bar fills a track of the library's own; the track is what has a height.
  { selector: `${CONTAINER} .Toastify__progress-bar--wrp`, fields: { progressHeight: ['height'] } }
];

const FIELDS = RULES.flatMap(rule => Object.keys(rule.fields));

const isField = (key: string): key is keyof NotificationsSpec => FIELDS.includes(key);

/** Every field `notifications` takes — what an editor of the setting (the builder, the MCP server's `patchSettings`) offers. */
export const NOTIFICATIONS_FIELDS: readonly (keyof NotificationsSpec)[] = FIELDS.filter(isField);

/** The tail of a message naming a field that does not exist: what was meant, `''` when nothing is close. */
export type NotificationsDidYouMean = (name: string, fields: readonly string[]) => string;

/**
 * Why a notifications spec would not style anything — a field it does not take, a value that is not one CSS value —
 * or `undefined` when it is sound. A `;` or a brace in a value would end the declaration early and let the rest of the
 * text become rules of its own. `didYouMean` names the field a misspelt one meant, for a writer that types the names.
 */
export const notificationsProblem = (
  spec: Record<string, unknown> | undefined,
  didYouMean?: NotificationsDidYouMean
): string | undefined => {
  for (const [key, value] of Object.entries(spec ?? {})) {
    if (!isField(key)) {
      return `\`notifications\` has no "${key}"${didYouMean?.(key, FIELDS) || '.'} It takes ${FIELDS.join(', ')}.`;
    }

    if (value !== undefined && (typeof value !== 'string' || value.trim() === '' || /[;{}]/.test(value))) {
      return `\`notifications.${key}\` is ${JSON.stringify(value)}, which is not one CSS value. Write one value, like 'var(--card)', '12px' or '500'.`;
    }
  }

  return undefined;
};

/**
 * The rules that style the toasts, or `''` when there is nothing to say. Fields it does not take and empty values say
 * nothing; {@link notificationsProblem} is the check for a spec someone wrote.
 */
export const notificationsCss = (spec: NotificationsSpec | undefined): string => {
  const declarations = RULES.map((): string[] => []);
  for (const [key, value] of Object.entries(spec ?? {})) {
    if (!isField(key) || typeof value !== 'string' || value.trim() === '') {
      continue;
    }

    const index = RULES.findIndex(rule => Object.hasOwn(rule.fields, key));
    declarations[index].push(...(RULES[index].fields[key] ?? []).map(property => `  ${property}: ${value.trim()};`));
  }

  return RULES.flatMap((rule, index) =>
    declarations[index].length > 0 ? [`${rule.selector} {\n${declarations[index].join('\n')}\n}`] : []
  ).join('\n');
};

/** The space's custom CSS with its notifications' rules after it — how a space's `customCss` carries both. */
export const withNotificationsCss = (customCss: string, spec: NotificationsSpec | undefined): string =>
  [customCss, notificationsCss(spec)].filter(Boolean).join('\n\n');

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

/** Each rule as it is read back: its text, found at the start of a line, and the field each of its properties says. */
const READERS = RULES.map(rule => {
  const fieldOf = new Map(
    Object.entries(rule.fields).flatMap(([field, properties]) =>
      isField(field) ? properties.map(property => [property, field] as const) : []
    )
  );

  return {
    pattern: new RegExp(`(?:^|\\n)${escape(rule.selector)}\\s*\\{([^}]*)\\}`, 'g'),
    fieldOf: (property: string) => fieldOf.get(property)
  };
});

/**
 * A space's custom CSS read apart: the notifications' rules {@link notificationsCss} wrote, back as the spec, and the
 * space's own CSS without it — so an editor shows and changes each on its own, and writes them together again with
 * {@link withNotificationsCss}. A rule someone edited into something else (a declaration that is no field's) is left
 * where it is, as the space's own CSS: read back, it would lose what was added to it.
 */
export const splitNotificationsCss = (customCss: string): { notifications: NotificationsSpec; customCss: string } => {
  const notifications: NotificationsSpec = {};
  for (const { pattern, fieldOf } of READERS) {
    // The last of them: the ones it wrote end the CSS, after any rule of the space's own for the same selector.
    const match = [...customCss.matchAll(pattern)].at(-1);
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
