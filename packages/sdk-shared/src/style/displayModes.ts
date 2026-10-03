import type { DisplayMode } from '../types';

/** The breakpoints a style is written for, widest first — the keys of `Style['platform']`. */
export const DISPLAY_MODES = ['desktop', 'tablet', 'mobile'] as const satisfies readonly DisplayMode[];

/** Whether a key read off a document — `Object.keys(platform)` — is one of them. */
export const isDisplayMode = (value: string): value is DisplayMode => DISPLAY_MODES.some(mode => mode === value);
