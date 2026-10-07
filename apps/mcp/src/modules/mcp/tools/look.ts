import { z } from 'zod';

import { fullPage, lookAt, pageRef, viewport } from './shared/look';
import { defineTool, imageResult } from './shared/tool';

export const lookShape = {
  pageRef,
  view: z
    .enum(['accessibility', 'html', 'image', 'both'])
    .optional()
    .describe(
      'How to see it. "accessibility" (default): the page as a screen reader and a browser agent read it — an ' +
        'outline of roles and names, every control with no name listed; text, and cheap. "html": the markup. ' +
        '"image": a PNG, for what only a picture shows — overflow, misalignment. "both": image and outline.'
    ),
  viewport,
  fullPage
};

// The one way to see a page as it is saved. A change not saved yet is seen through plitzi_apply's `look`, on the same
// batch — so seeing is never a choice between tools, only of how.
export const lookTool = defineTool({
  name: 'plitzi_look',
  title: 'Look at a page',
  description:
    'See a saved page: its accessibility outline (default, text), its HTML, or a PNG. To see a change before saving ' +
    'it, plitzi_apply with `dryRun` and `look` instead.',
  inputShape: lookShape,
  access: 'read',
  run: async (input, ctx) => {
    const look = await lookAt(ctx, { ...input, view: input.view ?? 'accessibility' });
    if ('refused' in look) {
      return look.refused;
    }

    return look.images.length > 0 ? imageResult(look.images, look.meta) : look.meta;
  }
});
