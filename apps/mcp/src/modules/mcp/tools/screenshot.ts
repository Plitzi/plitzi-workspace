import { z } from 'zod';

import { operation } from './operations';
import { defineTool, imageResult } from './shared/tool';

import type { Viewport } from '../types';

const VIEWPORTS: Record<'desktop' | 'mobile', Viewport> = {
  desktop: { label: 'desktop', width: 1440, height: 900 },
  mobile: { label: 'mobile', width: 390, height: 844 }
};

const resolveViewports = (choice: 'desktop' | 'mobile' | 'both' | undefined): Viewport[] => {
  if (choice === 'both') {
    return [VIEWPORTS.desktop, VIEWPORTS.mobile];
  }

  if (choice === 'mobile') {
    return [VIEWPORTS.mobile];
  }

  return [VIEWPORTS.desktop];
};

export const screenshotShape = {
  pageRef: z.string().optional().describe('The page to capture, by name; defaults to the space default page'),
  operations: z
    .array(operation)
    .max(100)
    .optional()
    .describe(
      'Unsaved edits to apply before rendering, so you can screenshot a proposed change WITHOUT persisting it ' +
        '(same op vocabulary as plitzi_apply). Omit to capture the current saved state.'
    ),
  viewport: z
    .enum(['desktop', 'mobile', 'both'])
    .optional()
    .describe(
      'Which viewport(s) to capture. "both" catches responsive issues (e.g. overflow at one width). Default desktop.'
    ),
  fullPage: z
    .boolean()
    .optional()
    .describe('Capture the full scrollable page instead of only the visible viewport. Default false.')
};

// Renders a page to a real IMAGE via the dedicated browser service, so a vision-capable agent can SEE the layout
// — overflow, misalignment, broken spacing that schema/CSS data never reveals. Only registered when a browser
// service is wired; if that service is unreachable at call time the tool degrades to the HTML preview.
export const screenshotTool = defineTool({
  name: 'plitzi_screenshot',
  title: 'Screenshot',
  description:
    'Render a page to a real PNG image so you can SEE the visual result of your edits — overflow, misalignment ' +
    'and broken layout that data alone never reveals. Pass unsaved `operations` to screenshot a proposed change ' +
    'before committing, and viewport "both" to compare desktop and mobile. Returns the image(s).',
  inputShape: screenshotShape,
  access: 'read',
  requires: 'screenshot',
  run: async (input, ctx) => {
    if (!ctx.preview || ctx.spaceId === undefined) {
      return {
        error: 'PREVIEW_UNAVAILABLE',
        message: 'Visual preview is not enabled on this server.',
        hint: 'Preview needs the SSR render service; it is unavailable in MCP-only mode.'
      };
    }

    const draft = { spaceId: ctx.spaceId, env: ctx.env, pageRef: input.pageRef, operations: input.operations };

    // On the way to an image the HTML is dead weight: the browser renders the same draft again from the token, so
    // asking for it would have the server render the page twice. It is only rendered on the paths that read it.
    const pv = await ctx.preview.render({ ...draft, includeHtml: !ctx.screenshot });
    if (!pv.ok) {
      return pv;
    }

    const viewports = resolveViewports(input.viewport);

    // Degrade gracefully rather than fail: if the browser service is not wired or is unreachable, return the HTML
    // preview with a warning so the agent still gets something actionable.
    if (!ctx.screenshot) {
      return {
        warning: 'SCREENSHOT_DISABLED',
        message: 'The screenshot service is not configured; returning the HTML preview instead.',
        pageRef: input.pageRef ?? 'default',
        pagePath: pv.pagePath,
        stateVersion: pv.stateVersion,
        html: pv.html
      };
    }

    const shot = await ctx.screenshot.capture({
      pagePath: pv.pagePath,
      token: pv.token,
      viewports,
      fullPage: input.fullPage
    });
    if (!shot.ok) {
      // The HTML was skipped above, so the fallback renders it now — the cost lands on the failing call rather
      // than on every successful one. Same draft, same operations, so it is the same page.
      const fallback = await ctx.preview.render(draft);

      return {
        warning: 'SCREENSHOT_UNAVAILABLE',
        message: `The screenshot service failed (${shot.message}); returning the HTML preview instead.`,
        hint: 'The dedicated browser service is down or unreachable. Inspect the HTML, or retry later.',
        pageRef: input.pageRef ?? 'default',
        pagePath: pv.pagePath,
        stateVersion: pv.stateVersion,
        html: fallback.ok ? fallback.html : ''
      };
    }

    return imageResult(shot.images, {
      pageRef: input.pageRef ?? 'default',
      pagePath: pv.pagePath,
      stateVersion: pv.stateVersion,
      viewports: viewports.map(v => v.label)
    });
  }
});
