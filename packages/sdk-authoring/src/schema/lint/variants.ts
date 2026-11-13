import { CUSTOM_TYPE, pluginKeyOf } from './context';

import type { LintContext } from './context';
import type { Element } from '@plitzi/sdk-shared';

/**
 * A variant set on an element that no style declares, so nothing applies — the element looks the same with it or
 * without: its own (`initialState.styleVariant`, `variant` in a spec), or one an `activeWhen` binding sets. Read off
 * the documents, so the builder says it of an element as authoring does.
 */

/** Every variant a style declares at any width and on any of its parts: a class, or an element type's defaults. */
const declaredVariants = (ctx: LintContext, owner: string): string[] =>
  Object.values(ctx.style.platform).flatMap(items =>
    Object.hasOwn(items, owner)
      ? Object.values(items[owner].attributes).flatMap(block => Object.keys(block.variants ?? {}))
      : []
  );

/** The element's own variants, by the style that owns each: `{ card: { base: 'primary' } }`. */
const ownVariants = (element: Element): [string, string][] =>
  Object.entries(element.definition.initialState?.styleVariant ?? {}).flatMap(([owner, parts]) =>
    Object.values(parts ?? {}).flatMap(value =>
      (Array.isArray(value) ? value : [value]).flatMap((name): [string, string][] =>
        typeof name === 'string' ? [[owner, name]] : []
      )
    )
  );

/**
 * The variant an `activeWhen` sets — `{{ (…) ? 'active' : 'idle' }}` names its one — on the class its key names
 * (`card.base`). A template that builds the name (`'c' ~ source`) or compares words names none to hold the class to.
 */
const variantsSet = (element: Element): { cls: string; names: string[] }[] =>
  Object.values(element.definition.bindings ?? {})
    .flat()
    .flatMap(binding => {
      const key = binding.transformers?.find(each => each.action === 'styleVariant')?.params.key;
      const template = binding.transformers?.find(each => each.action === 'twigTemplate')?.params.template;
      if (typeof key !== 'string' || typeof template !== 'string') {
        return [];
      }

      const names = [...template.matchAll(/\?\s*'([\w-]+)'\s*:\s*'idle'\s*\}\}\s*$/g)].map(match => match[1]);

      return names.length > 0 ? [{ cls: key.slice(0, key.lastIndexOf('.')), names }] : [];
    });

/** Why the variant may have been meant for something else: a plugin's own `variant`, or a hosted component's prop. */
const hintOf = (ctx: LintContext, element: Element): string =>
  (ctx.catalogs.reservedPluginAttributes?.[pluginKeyOf(element)] ?? []).includes('variant')
    ? ' If it was meant for the plugin’s own `variant`, that attribute is never set: rename it in the plugin.'
    : element.definition.type === CUSTOM_TYPE
      ? ' On a `custom` element `variant` is its style variant, never a prop of the component it hosts: hand the component a prop of another name (`tone`).'
      : '';

export const lintVariants = (ctx: LintContext): void => {
  for (const element of Object.values(ctx.flat)) {
    const where = ctx.describe(element.id);
    for (const [owner, name] of ownVariants(element)) {
      if (name === '' || declaredVariants(ctx, owner).includes(name)) {
        continue;
      }

      ctx.warn(
        'unknown-variant',
        `${where} is written with \`variant: '${name}'\`, which no class of it and no style of its type declares, so nothing applies.${hintOf(ctx, element)} Declare it — \`styles(name, { variants: { ${name}: { … } } })\` — or name one that is.`,
        element.id
      );
    }

    for (const { cls, names } of variantsSet(element)) {
      const declared = declaredVariants(ctx, cls);
      // A class the space does not declare is another rule's to say; a variant it declares is applied.
      const known = Object.values(ctx.style.platform).some(items => Object.hasOwn(items, cls));
      if (!known || names.some(name => declared.includes(name))) {
        continue;
      }

      ctx.warn(
        'unknown-variant',
        `${where} sets class ${cls}'s variant ${names.map(name => `'${name}'`).join(' or ')} by \`activeWhen\`, which ${cls} does not declare — ${declared.length > 0 ? `its variants: ${[...new Set(declared)].join(', ')}` : 'it has none'} — so nothing applies. Name one it declares — \`activeWhen(${cls}, …, { variant: '${declared[0] ?? 'active'}' })\` — or declare it.`,
        element.id
      );
    }
  }
};
