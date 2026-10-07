import type { ColorScheme } from '@plitzi/sdk-shared';

export type Viewport = { label: string; width: number; height: number };

export type ScreenshotImage = { label: string; mimeType: string; data: string };

/**
 * What a capture brings back of a page: how it looks, and how assistive technology reads it — the accessibility tree a
 * screen reader walks, and the one a browser agent such as Claude in Chrome finds the page's controls in.
 */
export type CaptureView = 'image' | 'accessibility';

/** One viewport's accessibility tree, as an indented outline: `- button "Close"`, `- heading "Plans" [level=1]`. */
export type AccessibilityOutline = { label: string; outline: string };

export type ScreenshotResult =
  | { ok: true; images: ScreenshotImage[]; accessibility?: AccessibilityOutline[] }
  | { ok: false; error: string; message: string };

export type ScreenshotInput = {
  pagePath: string;
  token?: string;
  viewports: Viewport[];
  fullPage?: boolean;
  /**
   * The scheme the browser reports through `prefers-color-scheme`. A space on the `system` theme follows it, one that
   * forces a theme keeps its own; left out, the browser's default applies, which is light.
   */
  colorScheme?: ColorScheme;
  /**
   * What to bring back; `['image']` when left out. A browser that cannot read the accessibility tree answers without
   * `accessibility`, and the caller says so rather than failing.
   */
  views?: CaptureView[];
};

/** How a look reaches the headless-browser service. The consumer injects an implementation (an HTTP
 *  client to the dedicated browser pod); absent, or a capture that fails (pod down) and answers `ok:false` rather than
 *  throwing, and the look answers the HTML instead. */
export type ScreenshotClient = { capture: (input: ScreenshotInput) => Promise<ScreenshotResult> };
