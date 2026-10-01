import { invalidParams } from '@plitzi/sdk-shared/authoring/paramSpec';

import { didYouMean } from '../suggest';

import type { LintContext } from './context';
import type { Element } from '@plitzi/sdk-shared';

/** The props an instance binds rather than writes: each one is an attribute a binding lands on. */
const boundProps = (instance: Element): Set<string> =>
  new Set(
    Object.values(instance.definition.bindings ?? {})
      .flat()
      .map(binding => binding.to)
  );

/**
 * Every instance in this tree against the component it places: the props it must hand in, each of the kind declared.
 *
 * Whether the component exists, and whether a child names a slot it declares, is the structural validator's — those
 * are references an edit can leave dangling. What is left is what renders wrong in silence: a required prop nobody
 * gave reads as nothing inside, and a flag written as the text "true" is a string to every `if` that reads it.
 */
export const lintInstances = (ctx: LintContext): void => {
  for (const element of Object.values(ctx.flat)) {
    const component = ctx.instanceOf(element);
    if (!component) {
      continue;
    }

    const declared = component.props ?? {};
    const where = ctx.describe(element.id);
    const bound = boundProps(element);
    for (const [name, prop] of Object.entries(declared)) {
      if (prop.required && element.attributes[name] === undefined && !bound.has(name)) {
        ctx.error(
          'prop-missing',
          `${where} places component "${component.id}" without "${name}", which it requires${prop.description ? ` — ${prop.description}` : ''}. Hand it in: \`component('${component.id}', { props: { ${name}: … } })\`.`,
          element.id
        );
      }
    }

    // What the instance WROTE: a bound prop is a value only the running page has.
    const written = Object.fromEntries(Object.keys(declared).map(name => [name, element.attributes[name]]));
    for (const { key, expected, got, options } of invalidParams(written, written, declared)) {
      const value = written[key];
      const suggestion = options && typeof value === 'string' ? didYouMean(value, options) : '';
      ctx.error(
        'prop-value',
        `${where} hands component "${component.id}" "${key}" as ${got}, and it is declared ${expected}${options ? ` (one of ${options.map(option => `'${option}'`).join(', ')})` : ''}${suggestion || '.'}`,
        element.id
      );
    }
  }
};
