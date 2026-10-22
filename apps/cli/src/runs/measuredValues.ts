import { acceptanceText } from './model';

import type { PlannedTask } from './model';

/**
 * A copy's values measured, never typed from a guess: velada-polish's lead wrote the VS sizes of /combates as
 * 2.35/2.75/3.35rem, the original's was 3em, and a round went to finding it out. A task of a plan that copies a site
 * (`reference`) whose acceptance names values — a size, a colour — and none of whose checks measures against the site
 * is said at `run plan`: hold them with `page measure --same`, or the review finds the guess.
 */

/** What reads as a value a copy is held to: a length, a colour. */
const VALUE = /\b\d+(?:\.\d+)?(?:px|rem|em|vw|vh)\b|#[0-9a-f]{3,8}\b|\brgba?\([^)]*\)|\bhsla?\([^)]*\)/gi;

/** A check that measures against another page: a picture compared, or an element's styles held to it. */
const MEASURES = /\bpage\s+(?:measure\b[^;&|]*--same|shot\b[^;&|]*--compare)/;

export const unmeasuredNotices = (tasks: readonly PlannedTask[], reference: string | undefined): string[] => {
  if (reference === undefined) {
    return [];
  }

  return tasks.flatMap(task => {
    const measured = task.acceptance.some(each => typeof each !== 'string' && MEASURES.test(each.check));
    const values = [...new Set(task.acceptance.flatMap(each => acceptanceText(each).match(VALUE) ?? []))];
    if (measured || values.length === 0) {
      return [];
    }

    return [
      `Task "${task.id}" names values (${values.slice(0, 5).join(', ')}${values.length > 5 ? ', …' : ''}) no check of it measures against ${reference}: measure them first and hold them to it — plitzi page measure <path> "<element> => <selector>" … --compare ${reference} --width 390,1440 --same <properties> — or its review finds the guess`
    ];
  });
};
