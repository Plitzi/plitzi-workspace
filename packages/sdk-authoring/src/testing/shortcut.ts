import { parseKeys } from '@plitzi/sdk-shared/helpers/keys';

/**
 * A shortcut pressed the way the page will read it.
 *
 * `mod` is ⌘ on a Mac and Ctrl anywhere else — decided by the PAGE, from its user agent, when it listens. A driver's
 * own "Control or Meta" asks the machine running the suite instead, and a suite on a Mac driving an emulated desktop
 * Chrome presses ⌘ at a page listening for Ctrl: the flow never runs, and nothing says why.
 */

/** A page that can be asked a question and typed at — Playwright's `Page`, Puppeteer's, or anything alike. */
export interface KeyboardDriver {
  evaluate<R>(fn: () => R): Promise<R>;
  keyboard: { press(key: string): Promise<void> };
}

/** The drivers' names for the keys `parseKeys` writes in lower case; a single character is itself. */
const KEY_NAMES: Readonly<Record<string, string>> = {
  escape: 'Escape',
  enter: 'Enter',
  tab: 'Tab',
  space: 'Space',
  backspace: 'Backspace',
  delete: 'Delete',
  insert: 'Insert',
  arrowup: 'ArrowUp',
  arrowdown: 'ArrowDown',
  arrowleft: 'ArrowLeft',
  arrowright: 'ArrowRight',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  ...Object.fromEntries(Array.from({ length: 12 }, (_, index) => [`f${index + 1}`, `F${index + 1}`]))
};

const MODIFIER_NAMES: Readonly<Record<string, string>> = { ctrl: 'Control', alt: 'Alt', shift: 'Shift', meta: 'Meta' };

/** Evaluated in the page: whether it reads `mod` as ⌘ — the same question the element listening asks. */
const isMacIn = (): boolean => /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

/** A shortcut as `onKey` writes it, as the key a driver presses. Refuses anything `onKey` would. */
export const shortcutKey = (shortcut: string, isMac: boolean): string => {
  const { combos, problems } = parseKeys(shortcut, isMac);
  if (problems.length > 0 || combos.length !== 1) {
    throw new Error(
      problems.length > 0
        ? `Not a shortcut: ${problems.join('; ')}`
        : `"${shortcut}" is ${combos.length} shortcuts: press one at a time`
    );
  }

  const [combo] = combos;
  // The `+` KEY is the last character of its combo, joined on with another `+`: `ctrl++`, or `+` alone.
  const plus = combo.endsWith('+');
  const parts = (plus ? combo.slice(0, -1) : combo).split('+').filter(part => part !== '');
  const key = plus ? '+' : (parts.at(-1) ?? '');
  const modifiers = (plus ? parts : parts.slice(0, -1)).map(part => MODIFIER_NAMES[part] ?? part);

  return [...modifiers, Object.hasOwn(KEY_NAMES, key) ? KEY_NAMES[key] : key].join('+');
};

/**
 * Presses `shortcut` — written as `onKey` writes it: `'mod+a'`, `'shift+f'`, `'escape'` — with the keys this page
 * listens for.
 *
 * ```ts
 * await pressShortcut(page, 'mod+z');
 * ```
 */
export const pressShortcut = async (page: KeyboardDriver, shortcut: string): Promise<void> => {
  await page.keyboard.press(shortcutKey(shortcut, await page.evaluate(isMacIn)));
};
