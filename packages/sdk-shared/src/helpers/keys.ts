/**
 * Keyboard shortcuts, as a space writes them: `'f'`, `'shift+f'`, `'mod+k'`, `'escape'`, several at once with commas
 * (`'plus, ='`).
 *
 * Both halves of matching live here — reading what an author wrote and reading what a key press was — so they meet
 * in one canonical form: modifiers in a fixed order, then the key, lower case (`ctrl+shift+f`). Authoring reads the
 * first half to refuse a shortcut that could never fire; the element listening reads both.
 */

/** The trigger a shortcut starts: fired once per key press, with every shortcut it matched. */
export const KEY_TRIGGER = 'onKey';

export type KeyTriggerPayload = {
  /** The key pressed, canonical — `shift+f`. */
  key: string;
  /** Each `keys` param, exactly as written, that the press matched: the flows that run are the ones written so. */
  shortcuts: string[];
};

const MODIFIERS = ['ctrl', 'alt', 'shift', 'meta'] as const;

type Modifier = (typeof MODIFIERS)[number];

/** Every way of writing a modifier, and `mod`: ⌘ on a Mac, Ctrl anywhere else — the platform's own shortcut key. */
const MODIFIER_NAMES: Readonly<Record<string, Modifier | 'mod'>> = {
  ctrl: 'ctrl',
  control: 'ctrl',
  alt: 'alt',
  option: 'alt',
  shift: 'shift',
  meta: 'meta',
  cmd: 'meta',
  command: 'meta',
  mod: 'mod'
};

/** What a key is called besides its own `KeyboardEvent.key` — the names a person types without thinking. */
const KEY_ALIASES: Readonly<Record<string, string>> = {
  esc: 'escape',
  space: 'space',
  spacebar: 'space',
  plus: '+',
  minus: '-',
  up: 'arrowup',
  down: 'arrowdown',
  left: 'arrowleft',
  right: 'arrowright',
  del: 'delete',
  return: 'enter'
};

/** The named keys, as `KeyboardEvent.key` spells them in lower case. Anything else must be one character. */
const NAMED_KEYS = new Set([
  'escape',
  'enter',
  'tab',
  'space',
  'backspace',
  'delete',
  'insert',
  'arrowup',
  'arrowdown',
  'arrowleft',
  'arrowright',
  'home',
  'end',
  'pageup',
  'pagedown',
  ...Array.from({ length: 12 }, (_, index) => `f${index + 1}`)
]);

export type ParsedKeys = {
  /** Each shortcut, canonical: `ctrl+alt+shift+meta+key`, with only the modifiers it uses. */
  combos: string[];
  /** Each part that is not a shortcut, with why — empty when all of it is. */
  problems: string[];
};

const canonical = (modifiers: ReadonlySet<Modifier>, key: string): string =>
  [...MODIFIERS.filter(modifier => modifiers.has(modifier)), key].join('+');

/** One shortcut: modifiers and a key joined by `+` — the key itself may be `+` (`ctrl++`, or `ctrl+plus`). */
const parseCombo = (combo: string, isMac: boolean): { combo?: string; problem?: string } => {
  const text = combo.trim().toLowerCase();
  if (!text) {
    return { problem: 'an empty shortcut (two commas in a row, or one at the end)' };
  }

  // `+` joins the parts, so the `+` KEY is the whole text or what a second `+` at its end leaves.
  const joined = text.endsWith('++') ? [...text.slice(0, -2).split('+'), '+'] : text.split('+');
  const parts = text === '+' ? ['+'] : joined.filter(part => part !== '');
  const modifiers = new Set<Modifier>();
  const keys: string[] = [];
  for (const part of parts) {
    // Own keys only: a part such as `constructor` must be a key nobody can press, not the prototype's function.
    if (Object.hasOwn(MODIFIER_NAMES, part)) {
      const modifier = MODIFIER_NAMES[part];
      modifiers.add(modifier === 'mod' ? (isMac ? 'meta' : 'ctrl') : modifier);
      continue;
    }

    keys.push(Object.hasOwn(KEY_ALIASES, part) ? KEY_ALIASES[part] : part);
  }

  if (keys.length !== 1) {
    return {
      problem: `"${combo.trim()}" names ${keys.length ? `${keys.length} keys (${keys.join(', ')})` : 'no key, only modifiers'}: a shortcut is modifiers and ONE key, like "shift+f"`
    };
  }

  const [key] = keys;
  if (key.length !== 1 && !NAMED_KEYS.has(key)) {
    return {
      problem: `"${key}" in "${combo.trim()}" is not a key: use one character ("f", "?", "+") or a key's name (${[...NAMED_KEYS].slice(0, 15).join(', ')}, f1…f12)`
    };
  }

  return { combo: canonical(modifiers, key) };
};

/** Every shortcut in what an author wrote, canonical, and what in it is not one. */
export const parseKeys = (spec: string, isMac = false): ParsedKeys => {
  const parsed = spec.split(',').map(combo => parseCombo(combo, isMac));

  return {
    combos: parsed.flatMap(entry => (entry.combo ? [entry.combo] : [])),
    problems: parsed.flatMap(entry => (entry.problem ? [entry.problem] : []))
  };
};

export type KeyPress = Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>;

/**
 * A key press, in the form {@link parseKeys} writes.
 *
 * Two keyboard facts decide it. Shift is part of a LETTER's shortcut (`shift+f`), but a symbol is typed with whatever
 * it takes — `+` is Shift+= on one keyboard and a key of its own on another — so for a symbol Shift is not counted.
 * And with Alt, Ctrl or ⌘ held, `key` can be another character altogether (Option+F is `ƒ` on a Mac): the physical
 * letter or digit is read from `code` instead.
 */
export const keyPressCombo = (press: KeyPress): string => {
  const held = press.ctrlKey || press.altKey || press.metaKey;
  const physical = /^(?:Key|Digit)([A-Z0-9])$/.exec(press.code);
  const raw = held && physical ? physical[1] : press.key;
  const key = raw === ' ' ? 'space' : raw.toLowerCase();
  const symbol = key.length === 1 && !/[a-z0-9]/.test(key);
  const modifiers = new Set<Modifier>();
  if (press.ctrlKey) {
    modifiers.add('ctrl');
  }

  if (press.altKey) {
    modifiers.add('alt');
  }

  if (press.shiftKey && !symbol) {
    modifiers.add('shift');
  }

  if (press.metaKey) {
    modifiers.add('meta');
  }

  return canonical(modifiers, key);
};

/** What a text field does itself with ⌘ or Ctrl held: select all, undo, redo, copy, cut, paste. */
const FIELD_LETTERS = new Set(['a', 'z', 'y', 'c', 'x', 'v']);

/** What moves the caret or deletes by word and line — with any modifier, on every platform. */
const FIELD_KEYS = new Set(['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'home', 'end', 'backspace', 'delete']);

/**
 * Whether a press, made in a text field, is the field's own editing — so a shortcut must not take it.
 *
 * With ⌘, Ctrl or Alt held a press in a field is otherwise a shortcut's, which is what lets `mod+k` open a palette
 * from a search box. But `mod+a` in a title field is "select this text", not "select everything on the board", and
 * `alt+backspace` deletes a word: a shortcut that took those would break typing wherever the page has one.
 */
export const isFieldEditing = (combo: string): boolean => {
  const parts = combo.split('+');
  const key = combo.endsWith('++') ? '+' : parts[parts.length - 1];

  return FIELD_KEYS.has(key) || (FIELD_LETTERS.has(key) && (combo.includes('ctrl+') || combo.includes('meta+')));
};
