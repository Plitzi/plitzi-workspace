import { describe, expect, it, vi } from 'vitest';

import { pressShortcut, shortcutKey } from './shortcut';

import type { KeyboardDriver } from './shortcut';

describe('shortcutKey', () => {
  it('resolves `mod` the way the page does: ⌘ on a Mac, Ctrl anywhere else', () => {
    expect(shortcutKey('mod+a', true)).toBe('Meta+a');
    expect(shortcutKey('mod+a', false)).toBe('Control+a');
    expect(shortcutKey('mod+shift+l', false)).toBe('Control+Shift+l');
  });

  it('names keys the way a driver does', () => {
    expect(shortcutKey('escape', false)).toBe('Escape');
    expect(shortcutKey('shift+up', false)).toBe('Shift+ArrowUp');
    expect(shortcutKey('f5', false)).toBe('F5');
    expect(shortcutKey('ctrl+plus', false)).toBe('Control++');
    expect(shortcutKey('+', false)).toBe('+');
  });

  it('refuses what `onKey` would refuse, and more than one at once', () => {
    expect(() => shortcutKey('ctrl+shift', false)).toThrow(/Not a shortcut/);
    expect(() => shortcutKey('a, b', false)).toThrow(/2 shortcuts/);
  });
});

describe('pressShortcut', () => {
  it('asks the page which platform it believes it is on, and presses its keys', async () => {
    const press = vi.fn(() => Promise.resolve());
    const page: KeyboardDriver = { evaluate: <R>() => Promise.resolve(false as R), keyboard: { press } };

    await pressShortcut(page, 'mod+z');

    expect(press).toHaveBeenCalledWith('Control+z');
  });
});
