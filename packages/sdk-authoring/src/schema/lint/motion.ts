import { rendersNoTag } from '@plitzi/sdk-schema/helpers/styleWithoutTag';
import { motionProblems } from '@plitzi/sdk-shared/schema/motion';

import type { LintContext } from './context';

/**
 * An element's `motion`: one the SDK's stylesheet can play, on an element with a box to move. What is wrong with it is
 * refused rather than warned — a preset nobody declared, or a motion on a provider with no tag, renders as nothing
 * moving at all, which is the one thing an author who wrote a motion did not mean.
 */
export const lintMotion = (ctx: LintContext): void => {
  Object.values(ctx.flat).forEach(element => {
    const { motion } = element.definition;
    if (motion === undefined) {
      return;
    }

    const where = ctx.describe(element.id);
    const problems = motionProblems(motion);
    if (problems.length > 0) {
      ctx.error(
        'motion-invalid',
        `${where} has a motion the page cannot play: ${problems.join('; ')}. For example \`motion: { enter: 'fade-up', on: 'view' }\`.`,
        element.id
      );
    }

    if (rendersNoTag(element)) {
      ctx.error(
        'motion-no-tag',
        `${where} has a motion but renders no element of its own (no \`subType\`), so there is nothing to move. Put the motion on what it wraps, or give it a tag.`,
        element.id
      );
    }
  });
};
