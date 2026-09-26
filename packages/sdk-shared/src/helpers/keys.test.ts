import { describe, expect, it } from 'vitest';

import { isFieldEditing, keyPressCombo, parseKeys } from './keys';

import type { KeyPress } from './keys';

const press = (key: string, extra: Partial<KeyPress> = {}): KeyPress => ({
  key,
  code: '',
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  ...extra
});

describe('parseKeys', () => {
  it('writes every shortcut in one form: modifiers in order, then the key', () => {
    expect(parseKeys('Shift+Ctrl+F, escape').combos).toEqual(['ctrl+shift+f', 'escape']);
  });

  it('reads the names a person types for a key', () => {
    expect(parseKeys('esc, space, up, plus, minus').combos).toEqual(['escape', 'space', 'arrowup', '+', '-']);
  });

  it('reads the + key written as itself', () => {
    expect(parseKeys('+').combos).toEqual(['+']);
    expect(parseKeys('ctrl++').combos).toEqual(['ctrl++']);
  });

  it('makes mod the platform’s shortcut key', () => {
    expect(parseKeys('mod+k', true).combos).toEqual(['meta+k']);
    expect(parseKeys('mod+k', false).combos).toEqual(['ctrl+k']);
  });

  it('says what in it is not a shortcut, and keeps the rest', () => {
    const { combos, problems } = parseKeys('f, ctrl+shift, a+b, arrowupp, ');

    expect(combos).toEqual(['f']);
    expect(problems).toHaveLength(4);
    expect(problems[0]).toContain('only modifiers');
    expect(problems[1]).toContain('2 keys');
    expect(problems[2]).toContain('"arrowupp" in "arrowupp" is not a key');
    expect(problems[3]).toContain('empty shortcut');
  });

  it('does not take a name from the prototype for a key', () => {
    expect(parseKeys('constructor').problems[0]).toContain('is not a key');
  });
});

describe('keyPressCombo', () => {
  it('counts Shift for a letter', () => {
    expect(keyPressCombo(press('F', { shiftKey: true }))).toBe('shift+f');
  });

  it('does not count Shift for a symbol, whatever it took to type it', () => {
    expect(keyPressCombo(press('+', { shiftKey: true }))).toBe('+');
    expect(keyPressCombo(press('?', { shiftKey: true }))).toBe('?');
  });

  it('reads the physical letter when a modifier changed the character', () => {
    expect(keyPressCombo(press('ƒ', { altKey: true, code: 'KeyF' }))).toBe('alt+f');
    expect(keyPressCombo(press('k', { metaKey: true, code: 'KeyK' }))).toBe('meta+k');
  });

  it('names the keys that are not characters as parseKeys does', () => {
    expect(keyPressCombo(press(' '))).toBe('space');
    expect(keyPressCombo(press('ArrowUp'))).toBe('arrowup');
    expect(keyPressCombo(press('Escape'))).toBe('escape');
  });

  it('meets parseKeys in the middle', () => {
    const shortcuts = parseKeys('shift+f, plus, mod+k', true).combos;

    expect(shortcuts).toContain(keyPressCombo(press('F', { shiftKey: true })));
    expect(shortcuts).toContain(keyPressCombo(press('+', { shiftKey: true })));
    expect(shortcuts).toContain(keyPressCombo(press('k', { metaKey: true, code: 'KeyK' })));
  });
});

describe('isFieldEditing', () => {
  it('leaves a field its own select all, undo, redo, copy, cut and paste', () => {
    for (const combo of ['meta+a', 'ctrl+z', 'meta+shift+z', 'ctrl+y', 'meta+c', 'meta+x', 'ctrl+v']) {
      expect(isFieldEditing(combo), combo).toBe(true);
    }
  });

  it('leaves it moving and deleting by word and line', () => {
    for (const combo of ['alt+arrowleft', 'meta+arrowright', 'shift+home', 'alt+backspace', 'meta+delete']) {
      expect(isFieldEditing(combo), combo).toBe(true);
    }
  });

  it('lets every other shortcut through', () => {
    for (const combo of ['meta+k', 'ctrl+shift+e', 'alt+a', 'escape', 'meta+0']) {
      expect(isFieldEditing(combo), combo).toBe(false);
    }
  });
});
