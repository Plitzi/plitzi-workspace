import { z } from 'zod';

import { fullPage, lookAt, pageRef, viewport } from './shared/look';
import { defineTool, imageResult } from './shared/tool';

export const screenshotShape = {
  pageRef,
  viewport,
  fullPage,
  view: z
    .enum(['image', 'accessibility', 'both'])
    .optional()
    .describe(
      'What to bring back. "image" (default) is the picture. "accessibility" is the page as a screen reader and a ' +
        'browser agent (Claude in Chrome) read it — its accessibility tree as an outline of roles and names — with ' +
        'every control and picture that has no name listed; text only, far cheaper than an image. "both" is both.'
    )
};

// Renders a page to a real IMAGE via the dedicated browser service, so a vision-capable agent can SEE the layout
// — overflow, misalignment, broken spacing that schema/CSS data never reveals. Only registered when a browser
// service is wired; if that service is unreachable at call time the tool degrades to the HTML preview.
export const screenshotTool = defineTool({
  name: 'plitzi_screenshot',
  title: 'Screenshot',
  description:
    'Render a saved page to a real PNG image so you can SEE it — overflow, misalignment and broken layout that data ' +
    'alone never reveals; viewport "both" compares desktop and mobile. `view: "accessibility"` reads the page as a ' +
    'screen reader and a browser agent do instead, and lists every control with no name. To look at a change before ' +
    'saving it, use plitzi_apply with `dryRun` and `look`.',
  inputShape: screenshotShape,
  access: 'read',
  requires: 'screenshot',
  run: async (input, ctx) => {
    const look = await lookAt(ctx, { ...input, view: input.view ?? 'image' });
    if ('refused' in look) {
      return look.refused;
    }

    return look.images.length > 0 ? imageResult(look.images, look.meta) : look.meta;
  }
});
