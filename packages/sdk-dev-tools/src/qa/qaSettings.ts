import type { XrayFilter } from './xray';

/**
 * What the QA tab can turn on over a running page — for whoever checks a build before it ships: a designer lining
 * things up, a tester looking for what breaks. Kept in this browser, and only ever offered where the dev tools are,
 * which is only where debugging is authorized.
 */

export type VisionMode = 'none' | 'grayscale' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'blurred';

/** What the checks look for, in the order the tab lists them. */
export const QA_CHECKS = ['overflow', 'names', 'targets', 'contrast', 'images', 'headings'] as const;

export type QaCheck = (typeof QA_CHECKS)[number];

export interface QaSettings {
  /** Point at an element for its box, type and style; click to keep it in the tab; Alt to measure to another. */
  inspect: boolean;
  /** The columns the page is laid out on (`@plitzi/sdk-shared/style`'s layout grid), over it. */
  grid: boolean;
  /**
   * Every element's box, its type and id when pointed at — and what the document wires to each, a condition, a flow,
   * motion, a flag, marked and named on it.
   */
  xray: boolean;
  /** The wiring the x-ray marks: every kind, one, or none — the boxes alone. */
  xrayFilter: XrayFilter;
  /** The order the Tab key walks the page's controls in, numbered on them. */
  tabOrder: boolean;
  /** The viewport's size and the breakpoint whose rules show. */
  viewport: boolean;
  /** Every animation held where it is, to look at a moment of it. */
  paused: boolean;
  /** Every animation at a quarter of its speed, to see how it moves rather than that it did. */
  slowMotion: boolean;
  /** The page as a visitor who asked for less motion gets it — the SDK's own rule, by class. */
  reducedMotion: boolean;
  vision: VisionMode;
  checks: Record<QaCheck, boolean>;
}

export const QA_DEFAULTS: QaSettings = {
  inspect: false,
  grid: false,
  xray: false,
  xrayFilter: 'all',
  tabOrder: false,
  viewport: false,
  paused: false,
  slowMotion: false,
  reducedMotion: false,
  vision: 'none',
  checks: { overflow: false, names: false, targets: false, contrast: false, images: false, headings: false }
};

/** The tools that are simply on or off. */
export type QaSwitch =
  'inspect' | 'grid' | 'xray' | 'tabOrder' | 'viewport' | 'paused' | 'slowMotion' | 'reducedMotion';

/** Whether any of it is on: the page is marked only while something is. */
export const isQaActive = (settings: QaSettings): boolean =>
  settings.inspect ||
  settings.grid ||
  settings.xray ||
  settings.tabOrder ||
  settings.viewport ||
  settings.paused ||
  settings.slowMotion ||
  settings.reducedMotion ||
  settings.vision !== 'none' ||
  Object.values(settings.checks).some(Boolean);

/** The class the SDK's stylesheet stills every animation under, as its `prefers-reduced-motion` rule does. */
export const REDUCED_MOTION_CLASS = 'plitzi-reduced-motion';

/** The attribute the page's box is marked with while QA is on: what every rule here is scoped to. */
export const QA_PAGE_ATTRIBUTE = 'data-plitzi-qa-page';

/** The attribute a check marks what it found with, its value the checks that found it. */
export const QA_FINDING_ATTRIBUTE = 'data-plitzi-qa-finding';
