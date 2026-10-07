import { lookAt, pageRef } from './shared/look';
import { defineTool } from './shared/tool';

export const previewShape = { pageRef };

// A read-only tool that renders a page to a full HTML document via the SSR pipeline. HTML is enough to inspect
// structure, but NOT layout (the space's CSS is applied on client hydration) — for a real image that reveals
// overflow and other visual problems, use plitzi_screenshot.
export const previewTool = defineTool({
  name: 'plitzi_preview',
  title: 'Preview (HTML)',
  description:
    'Render a saved page to a full HTML document to inspect its structure. Returns the HTML plus the page path and ' +
    'stateVersion. To look at a change before saving it, use plitzi_apply with `dryRun` and `look`; for a real ' +
    'rendered IMAGE that reveals visual issues like overflow, plitzi_screenshot.',
  inputShape: previewShape,
  access: 'read',
  run: async (input, ctx) => {
    const look = await lookAt(ctx, { pageRef: input.pageRef, view: 'html' });

    return 'refused' in look ? look.refused : look.meta;
  }
});
