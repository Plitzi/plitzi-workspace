import { describe, expect, it } from 'vitest';

import { agentHues, colorCodes, THEMES, themeOfBackground } from './monitorTheme';

describe("the monitor's theme", () => {
  it('reads the terminal’s background as light or dark', () => {
    expect(themeOfBackground('\x1b]11;rgb:ffff/ffff/ffff\x1b\\')).toBe('light');
    expect(themeOfBackground('\x1b]11;rgb:1e1e/1e1e/1e1e\x07')).toBe('dark');
    expect(themeOfBackground('nothing')).toBeUndefined();
  });

  it('gives each agent a hue of its own, the lead’s first, the same on every draw', () => {
    const hues = agentHues(THEMES.dark, ['lead', 'dev-1', 'dev-2']);
    expect(hues.get('lead')).toBe(THEMES.dark.agents[0]);
    expect(new Set(hues.values()).size).toBe(3);
  });

  it('writes a colour at every depth, none with no colour at all', () => {
    expect(colorCodes('#ffffff', 3, false)).toBe('38;2;255;255;255');
    expect(colorCodes('#ffffff', 2, true)).toBe('48;5;255');
    expect(colorCodes('#cd3131', 1, false)).toBe('31');
    expect(colorCodes('#ffffff', 0, false)).toBeUndefined();
  });

  it('keeps both themes’ tokens whole', () => {
    expect(Object.keys(THEMES.light).sort()).toEqual(Object.keys(THEMES.dark).sort());
  });
});
