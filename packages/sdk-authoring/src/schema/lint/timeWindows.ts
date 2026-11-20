import { instantOf, isWindowBound, TIME_WINDOW_TYPE } from '@plitzi/sdk-shared/timeWindows';

import type { LintContext } from './context';
import type { Schema } from '@plitzi/sdk-shared';

/**
 * The space's time windows: each bound an instant with its offset — one without is a different instant for every
 * visitor, so it is never read and the window has no such bound — and the end after the start.
 */
export const lintTimeWindows = (ctx: LintContext): void => {
  const trees: Schema['flat'][] = [ctx.schema.flat, ...Object.values(ctx.schema.components).map(c => c.flat)];
  for (const element of trees.flatMap(flat => Object.values(flat))) {
    if (element.definition.type !== TIME_WINDOW_TYPE) {
      continue;
    }

    const { startsAt, endsAt } = element.attributes;
    for (const [name, value] of [
      ['startsAt', startsAt],
      ['endsAt', endsAt]
    ] as const) {
      if (!isWindowBound(value)) {
        ctx.error(
          'time-window-bound',
          `Time window "${element.id}" has \`${name}: ${JSON.stringify(value)}\`, which is not an instant with its offset, so it is not read: the window has no ${name === 'startsAt' ? 'start' : 'end'}. Write it as ISO 8601 with the offset — \`${name}: '2026-12-01T09:00:00Z'\` — or leave it empty for no bound.`,
          element.id
        );
      }
    }

    const start = instantOf(startsAt);
    const end = instantOf(endsAt);
    if (start !== undefined && end !== undefined && end <= start) {
      ctx.warn(
        'time-window-empty',
        `Time window "${element.id}" ends (${String(endsAt)}) before it starts (${String(startsAt)}), so it never shows what it holds. Put \`endsAt\` after \`startsAt\`.`,
        element.id
      );
    }
  }
};
