import { textOf } from './context';
import { bindingsOf, shorten } from './elementBindings';

import type { LintContext } from './context';
import type { Element } from '@plitzi/sdk-shared';

/** The form controls a form owns: its descendants, down to a form nested in it, which owns its own. */
const controlsOf = (ctx: LintContext, formId: string): Element[] =>
  (ctx.element(formId)?.definition.items ?? []).flatMap(id => {
    const child = ctx.element(id);
    if (!child || child.definition.type === 'form') {
      return [];
    }

    return [...(child.definition.type === 'formControl' ? [child] : []), ...controlsOf(ctx, id)];
  });

/**
 * A form's values are its controls' values under their names. A control with no name lands under the empty key — it
 * never reaches `values.<name>` — and two with one name write over each other. Both submit, and one field is missing.
 */
export const warnFormControls = (ctx: LintContext): void => {
  for (const form of Object.values(ctx.flat).filter(element => element.definition.type === 'form')) {
    const named = new Map<string, string>();
    for (const control of controlsOf(ctx, form.id)) {
      if (bindingsOf(control).some(({ binding }) => binding.to === 'name')) {
        continue;
      }

      const name = textOf(control.attributes.name).trim();
      const where = ctx.describe(control.id);
      if (name === '') {
        ctx.warn(
          'form-control-unnamed',
          `${where} is in the form "${form.id}" with no \`name\`, so what it holds never reaches the form's values. Give it one — \`formControl({ name: 'email', … })\` — and read it as \`values.email\`.`,
          control.id
        );
        continue;
      }

      const first = named.get(name);
      if (first === undefined) {
        named.set(name, control.id);
        continue;
      }

      ctx.warn(
        'form-control-name-taken',
        `${where} has the name "${name}", which "${first}" in the same form already has: one writes over the other in \`values.${name}\`, and one of the two answers is lost. Give each control its own name.`,
        control.id,
        { name, first }
      );
    }
  }
};

/**
 * A field is optional unless `required: true`, as an HTML field is. One with a `requiredMessage` and nothing requiring
 * it was written for a field that must be answered: the message is never shown, and an empty answer is sent — what a
 * space written while fields were required by default does after an upgrade, without a word.
 */
export const checkRequiredMessage = (ctx: LintContext, element: Element, where: string): void => {
  const { required, requiredMessage } = element.attributes;
  const message = textOf(requiredMessage).trim();
  const requires =
    required === true || required === 'true' || (typeof required === 'string' && required.includes('{{'));
  const bound = bindingsOf(element).some(({ binding }) => binding.to === 'required');
  if (element.definition.type !== 'formControl' || message === '' || requires || bound) {
    return;
  }

  ctx.warn(
    'required-message-unused',
    `${where} has a \`requiredMessage\` ("${shorten(message)}") but nothing requires it — a field is optional unless \`required: true\` — so the message is never shown and an empty answer is sent. Add \`required: true\`, or drop the message.`,
    element.id
  );
};
