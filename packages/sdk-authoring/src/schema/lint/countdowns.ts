import { COUNTDOWN_TYPE, COUNTDOWN_UNITS, instantOf, TIME_WINDOW_TYPE } from '@plitzi/sdk-shared/timeWindows';

import type { LintContext } from './context';
import type { Element, Schema } from '@plitzi/sdk-shared';

const rankOf = (unit: unknown): number => COUNTDOWN_UNITS.findIndex(each => each === unit);

/** The time window a countdown is in, looked for up its own tree — a page's, or a component's. */
const windowAround = (flat: Schema['flat'], id: string): Element | undefined => {
  const parentOf = new Map<string, string>();
  for (const each of Object.values(flat)) {
    for (const child of each.definition.items ?? []) {
      parentOf.set(child, each.id);
    }
  }

  for (let at = parentOf.get(id); at !== undefined; at = parentOf.get(at)) {
    const ancestor = Object.hasOwn(flat, at) ? flat[at] : undefined;
    if (ancestor?.definition.type === TIME_WINDOW_TYPE) {
      return ancestor;
    }
  }

  return undefined;
};

const lintCountdown = (ctx: LintContext, flat: Schema['flat'], element: Element): void => {
  const { to, largest, smallest } = element.attributes;
  const unset = to === undefined || to === '';
  if (!unset && instantOf(to) === undefined) {
    ctx.error(
      'countdown-to',
      `Countdown "${element.id}" has \`to: ${JSON.stringify(to)}\`, which is not an instant with its offset, so it counts to nothing. Write it as ISO 8601 with the offset — \`to: '2026-12-01T09:00:00Z'\` — or leave it empty inside a \`timeWindow\` to count to its end.`,
      element.id
    );
  }

  if (unset && instantOf(windowAround(flat, element.id)?.attributes.endsAt) === undefined) {
    ctx.warn(
      'countdown-without-end',
      `Countdown "${element.id}" has no \`to\` and no time window around it with an \`endsAt\`, so it shows zeros. Give it \`to: '2026-12-01T09:00:00Z'\`, or put it inside the \`timeWindow\` whose end it counts to.`,
      element.id
    );
  }

  const from = rankOf(largest ?? 'days');
  const down = rankOf(smallest ?? 'seconds');
  if (from >= 0 && down >= 0 && down < from) {
    ctx.warn(
      'countdown-units',
      `Countdown "${element.id}" goes from \`${String(largest)}\` down to \`${String(smallest)}\`, a larger unit: it says \`${String(largest)}\` alone. Make \`largest\` the larger of the two.`,
      element.id
    );
  }
};

/**
 * The space's countdowns: what they count to an instant with its offset — their own `to`, or the end of the time window
 * around them — and their units the right way round.
 */
export const lintCountdowns = (ctx: LintContext): void => {
  const trees: Schema['flat'][] = [ctx.schema.flat, ...Object.values(ctx.schema.components).map(c => c.flat)];
  for (const flat of trees) {
    for (const element of Object.values(flat)) {
      if (element.definition.type === COUNTDOWN_TYPE) {
        lintCountdown(ctx, flat, element);
      }
    }
  }
};
