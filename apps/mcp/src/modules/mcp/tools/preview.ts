import { z } from 'zod';

import { operation } from './operations';
import { defineTool } from './shared/tool';

export const previewShape = {
  pageRef: z.string().optional().describe('Page ref or id to preview; defaults to the space default page'),
  operations: z
    .array(operation)
    .max(100)
    .optional()
    .describe(
      'Unsaved edits to apply to a throwaway clone before rendering, so you can preview a change WITHOUT ' +
        'persisting it (same op vocabulary as plitzi_apply). Omit to preview the current saved state.'
    )
};

// A read-only tool that renders a page to a full HTML document via the SSR pipeline. HTML is enough to inspect
// structure, but NOT layout (the space's CSS is applied on client hydration) — for a real image that reveals
// overflow and other visual problems, use plitzi_screenshot.
export const previewTool = defineTool({
  name: 'plitzi_preview',
  title: 'Preview (HTML)',
  description:
    'Render a page to a full HTML document to inspect the structure of your edits. Pass unsaved `operations` to ' +
    'preview a change before committing (nothing is persisted). Returns the HTML plus the page path and ' +
    'stateVersion. For a real rendered IMAGE that reveals visual issues like overflow, use plitzi_screenshot.',
  inputShape: previewShape,
  access: 'read',
  run: async (input, ctx) => {
    if (!ctx.preview || ctx.spaceId === undefined) {
      return {
        error: 'PREVIEW_UNAVAILABLE',
        message: 'Visual preview is not enabled on this server.',
        hint: 'Preview needs the SSR render service; it is unavailable in MCP-only mode.'
      };
    }

    const result = await ctx.preview.render({
      spaceId: ctx.spaceId,
      env: ctx.env,
      pageRef: input.pageRef,
      operations: input.operations
    });
    if (!result.ok) {
      return result;
    }

    return {
      pageRef: input.pageRef ?? 'default',
      pagePath: result.pagePath,
      stateVersion: result.stateVersion,
      html: result.html
    };
  }
});
