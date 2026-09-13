import type { ColorScheme } from '@plitzi/sdk-shared';

export type Viewport = { label: string; width: number; height: number };

export type ScreenshotImage = { label: string; mimeType: string; data: string };

export type ScreenshotResult = { ok: true; images: ScreenshotImage[] } | { ok: false; error: string; message: string };

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
};

/** How plitzi_screenshot reaches the headless-browser service. The consumer injects an implementation (an HTTP
 *  client to the dedicated browser pod); absent → the tool is not registered. A capture that fails (pod down)
 *  returns `ok:false` rather than throwing, so the tool can degrade to the HTML preview. */
export type ScreenshotClient = { capture: (input: ScreenshotInput) => Promise<ScreenshotResult> };
