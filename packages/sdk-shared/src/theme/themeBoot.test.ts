import { describe, expect, it, vi } from 'vitest';

import { applyThemeClass, THEME_CLASSES, THEME_STORAGE_KEY, themeBootScript } from './themeBoot';

/**
 * The script runs before any bundle, in a document with nothing else in it, so what is worth testing is that it
 * BEHAVES — evaluated for real against a fake storage — rather than that it contains particular characters.
 */
type BootFn = (win: unknown, doc: unknown) => void;

/** Compiles the generated source the way a browser would, so what is asserted is behaviour and not characters. */
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const compile = (script: string): BootFn => new Function('window', 'document', script) as BootFn;

const run = (script: string, stored: string | null, storage: 'localStorage' | 'sessionStorage' = 'localStorage') => {
  const root = { classList: { add: vi.fn() } };
  const store = { getItem: vi.fn(() => stored) };
  compile(script)({ [storage]: store }, { documentElement: root });

  return { added: root.classList.add.mock.calls.flat() as string[], store };
};

describe('themeBootScript', () => {
  it('applies a remembered choice to the document', () => {
    expect(run(themeBootScript(), 'light').added).toEqual(['light']);
    expect(run(themeBootScript(), 'dark').added).toEqual(['dark']);
  });

  /**
   * `system` writes nothing, and the silence is the mechanism: the stylesheet's `prefers-color-scheme` queries are
   * guarded on the absence of these classes, so stamping one would freeze the page against the machine it runs on.
   */
  it('writes nothing when there is no choice to apply', () => {
    for (const stored of ['system', null, '', 'sepia']) {
      expect(run(themeBootScript(), stored).added).toEqual([]);
    }
  });

  it('reads the key and the storage it was given', () => {
    const { store } = run(themeBootScript({ storageKey: 'plitzi.theme' }), 'dark');

    expect(store.getItem).toHaveBeenCalledWith('plitzi.theme');

    const session = run(themeBootScript({ storageType: 'sessionStorage' }), 'light', 'sessionStorage');

    expect(session.added).toEqual(['light']);
  });

  /** A privacy mode that throws on access rather than answering. The page still renders — on the machine's theme. */
  it('survives a storage that throws', () => {
    const root = { classList: { add: vi.fn() } };
    const win = {
      get localStorage(): never {
        throw new Error('blocked');
      }
    };

    expect(() => compile(themeBootScript())(win, { documentElement: root })).not.toThrow();
    expect(root.classList.add).not.toHaveBeenCalled();
  });

  /** The key would otherwise end the string literal it is embedded in, and the page would ship a syntax error. */
  it('survives a storage key with a quote in it', () => {
    const { store } = run(themeBootScript({ storageKey: 'a"b' }), 'dark');

    expect(store.getItem).toHaveBeenCalledWith('a"b');
  });

  it('agrees with the provider about what a theme class is', () => {
    expect(THEME_CLASSES).toEqual(['dark', 'light']);
    expect(THEME_STORAGE_KEY).toBe('theme');
  });
});

describe('applyThemeClass', () => {
  it('turns the chosen one on and the other off, so a change is never additive', () => {
    const root = document.createElement('html');

    applyThemeClass('dark', root);
    expect(root.className).toBe('dark');

    applyThemeClass('light', root);
    expect(root.className).toBe('light');

    // Back to the machine's answer, which needs both gone rather than one added.
    applyThemeClass('system', root);
    expect(root.className).toBe('');
  });
});
