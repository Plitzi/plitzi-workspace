import { beforeEach, describe, expect, it } from 'vitest';

import themeStore, { createThemeState, setAreaTheme, setMachineScheme, setThemeMode, themeFor } from './themeStore';
import { SPACE_THEME_AREA } from './useTheme';

/**
 * The two questions this store exists to answer, and the one rule that ties them together.
 *
 * A surface paints one theme; an AREA of it — the builder's canvas, its preview pane — may paint another while the
 * editor around it stays put. What makes that usable rather than a second setting to keep in step is that an
 * area's choice is an OVERRIDE of what is on screen now, not a divorce from it.
 */
describe('themeStore', () => {
  beforeEach(() => {
    themeStore.setState(undefined, createThemeState());
  });

  it('resolves `system` against the machine, and a choice against itself', () => {
    setMachineScheme('dark');
    setThemeMode('system');

    const { mode, scheme } = themeStore.getState();
    expect(themeFor(themeStore.getState())).toBe('system');
    expect(mode === 'system' ? scheme : mode).toBe('dark');
  });

  it('lets an area differ without moving the surface', () => {
    setThemeMode('light');
    setAreaTheme(SPACE_THEME_AREA, 'dark');

    // The editor stays light while the space it is editing is looked at in dark. That is the whole split.
    expect(themeFor(themeStore.getState())).toBe('light');
    expect(themeFor(themeStore.getState(), SPACE_THEME_AREA)).toBe('dark');
  });

  /**
   * Areas do not inherit from each other, only from the surface. It is what makes a typo in an area name harmless
   * — and it is why everything that paints the space shares ONE name rather than one each.
   */
  it('leaves an area that made no choice following the surface', () => {
    setThemeMode('dark');
    setAreaTheme(SPACE_THEME_AREA, 'light');

    expect(themeFor(themeStore.getState(), 'something-else')).toBe('dark');
  });

  /**
   * The rule. Without it an author who darkened the canvas once would find it stuck there for good, deaf to the
   * editor's own toggle — which is the complaint every per-area setting eventually produces.
   */
  it('makes every area follow again when the surface changes its mind', () => {
    setThemeMode('light');
    setAreaTheme(SPACE_THEME_AREA, 'dark');

    setThemeMode('dark');

    expect(themeStore.getState().areas).toEqual({});
    expect(themeFor(themeStore.getState(), SPACE_THEME_AREA)).toBe('dark');
  });

  /** The machine changing its mind is not the surface changing its mind: an area's override survives it. */
  it('keeps area overrides when only the machine moves', () => {
    setThemeMode('system');
    setAreaTheme(SPACE_THEME_AREA, 'light');
    setMachineScheme('dark');

    expect(themeFor(themeStore.getState(), SPACE_THEME_AREA)).toBe('light');
  });
});
