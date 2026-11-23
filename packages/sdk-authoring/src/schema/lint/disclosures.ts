import type { LintContext } from './context';
import type { Schema } from '@plitzi/sdk-shared';

/** What a press is meant for on its own: inside a summary, which is itself the control, one never is. */
const CONTROL_TYPES = new Set(['button', 'link', 'formControl', 'dropdown', 'themeToggle']);

/**
 * The space's disclosures: their summary first — a `<details>` is opened by its first `<summary>` alone — with words in
 * it and no control inside it. A disclosure with no summary at all is `part-missing`, said of every compound element.
 */
export const lintDisclosures = (ctx: LintContext): void => {
  const trees: Schema['flat'][] = [ctx.schema.flat, ...Object.values(ctx.schema.components).map(c => c.flat)];
  for (const flat of trees) {
    // An id a broken document names and does not hold reads as nothing, never as an element.
    const at = (id: string) => (Object.hasOwn(flat, id) ? flat[id] : undefined);
    for (const element of Object.values(flat)) {
      const type = element.definition.type;
      if (type === 'disclosure') {
        const items = element.definition.items ?? [];
        const summaries = items.filter(id => at(id)?.definition.type === 'disclosureSummary');
        const first = items.at(0);
        if (summaries.length > 0 && (first === undefined || at(first)?.definition.type !== 'disclosureSummary')) {
          ctx.error(
            'disclosure-summary-first',
            `Disclosure "${element.id}" has its summary "${summaries[0]}" after other children: the browser opens it by its first child alone, and draws "Details" of its own. Put the summary first.`,
            element.id
          );
        } else if (summaries.length > 1) {
          ctx.error(
            'disclosure-summary-first',
            `Disclosure "${element.id}" has ${summaries.length} summaries: only the first opens it, and the others are drawn as nothing. Keep one, first.`,
            element.id
          );
        }

        continue;
      }

      if (type !== 'disclosureSummary') {
        continue;
      }

      const items = element.definition.items ?? [];
      if (items.length === 0) {
        ctx.warn(
          'disclosure-summary-unnamed',
          `Disclosure summary "${element.id}" has nothing in it: a screen reader announces a control with no name. Put a text or a heading inside it — what opening it shows.`,
          element.id
        );

        continue;
      }

      const pending = [...items];
      for (let id = pending.pop(); id !== undefined; id = pending.pop()) {
        const child = at(id);
        if (!child) {
          continue;
        }

        if (CONTROL_TYPES.has(child.definition.type)) {
          ctx.error(
            'disclosure-summary-control',
            `Disclosure summary "${element.id}" holds a ${child.definition.type} ("${id}"): the summary is the control, so this is a control within a control — a keyboard and a screen reader cannot tell them apart, and pressing it opens the disclosure too. Put words in the summary, and the ${child.definition.type} in what it shows.`,
            id
          );
        }

        pending.push(...(child.definition.items ?? []));
      }
    }
  }
};
