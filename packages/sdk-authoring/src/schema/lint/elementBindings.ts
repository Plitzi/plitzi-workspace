import { serverTemplatesByType } from '@plitzi/sdk-elements/elements/declarations';
import { hasTemplateSyntax, hasValidToken } from '@plitzi/sdk-shared/helpers/twigWrapper';

import { isCssProperty, isCustomProperty } from '../../style';
import { boundAttribute } from '../bindings';
import { BINDING_CATEGORIES, paramIssue } from '../guard';
import { didYouMean } from '../suggest';
import { stringsIn } from './context';
import { checkGlobalRead } from './globalReads';
import { checkPropsRead, checkTemplate } from './templates';

import type { LintContext } from './context';
import type { Element, ElementBinding } from '@plitzi/sdk-shared';

/** Types whose content is prose, where a `{{ }}` is far more often a sample of code than a template. */
export const PROSE_TYPES = new Set(['markdown', 'richText', 'blockHtml', 'blockJsx', 'nodeHtml']);

/**
 * Sources already known on the first render — what a flow wrote, the route, the space's variables, the theme, what the
 * space computes. A condition on them resolves in the render that paints the element, so it has no frame to flash in.
 */
export const SETTLED_SOURCES = new Set(['state', 'navigation', 'variables', 'theme', 'computed']);

export const shorten = (value: string): string => (value.length > 80 ? `${value.slice(0, 77)}…` : value);

export const bindingsOf = (element: Element): { category: string; binding: ElementBinding }[] =>
  Object.entries(element.definition.bindings ?? {}).flatMap(([category, list]) =>
    list.map(binding => ({ category, binding }))
  );

/**
 * Every binding's shape and transformers: a category that exists, visibility where visibility is read, transformers
 * that exist with params they take, templates read the way the runtime reads them, and a template's TEXT never
 * handed to an attribute that holds a list.
 */
export const checkBindings = (ctx: LintContext, element: Element, where: string): void => {
  const catalog = ctx.catalogs.transformers;
  const defaults = ctx.catalogs.defaultAttributes?.[element.definition.type] ?? {};
  const names = ctx.attributeNamesFor(element);
  const scope = ctx.scope(element.id);
  for (const { category, binding } of bindingsOf(element)) {
    const at = `${where}: the binding of "${binding.to}"`;
    if (!(BINDING_CATEGORIES as readonly string[]).includes(category)) {
      ctx.error(
        'binding-category',
        `${at}: \`category\` is "${category}"${didYouMean(category, BINDING_CATEGORIES) || '.'} It is one of ${BINDING_CATEGORIES.map(item => `'${item}'`).join(', ')}.`,
        element.id
      );
      continue;
    }

    // An element's source reaches only the elements inside it; bound from anywhere else it resolves to nothing. The
    // name itself — that some element publishes it — is the structural validator's.
    const head = binding.source.split('.')[0];
    checkPropsRead(ctx, binding.source, at, element.id);
    checkGlobalRead(ctx, binding.source, at, element.id);
    const providerId = head.slice(head.indexOf('_') + 1);
    const prefix = ctx.sources.get(providerId);
    if (prefix && head === `${prefix}_${providerId}` && !scope.has(providerId)) {
      ctx.error(
        'binding-source-out-of-scope',
        `${at} reads "${binding.source}", but "${providerId}" is not around it. An element's source reaches only the elements inside it — move this one into "${providerId}", or read the value through something both can see, like \`state\`.`,
        element.id
      );
    }

    if (binding.to === 'visibility' && category === 'attributes') {
      ctx.error(
        'visibility-as-attribute',
        `${where} binds "visibility" as an attribute, which no element reads — it would stay on screen. Write \`visible: '${binding.source}'\` on the element (or \`visible: { source: '${binding.source}', template }\`).`,
        element.id
      );
    }

    // `className` is never written as an attribute, but every element hands it to its root: bound, it is how a class
    // follows the data.
    const unread =
      binding.to !== 'visibility' && binding.to !== 'className' && !names?.includes(boundAttribute(binding.to));
    if (category === 'attributes' && names && unread) {
      // A style is bound by the property it sets, in its own category — a custom one when the class keeps the palette.
      const styled = binding.to === 'style' || isCssProperty(binding.to) || isCustomProperty(binding.to);
      const how = styled
        ? ` A style is bound in the \`style\` category, one property at a time — \`bindTemplate('${binding.to === 'style' ? 'background-color' : binding.to}', '${binding.source}', '{{ source }}', { category: 'style' })\` — or a custom property its class reads: \`'--who'\` beside \`background-color: var(--who)\`.`
        : ` It reads ${names.join(', ')}.`;
      ctx.error(
        'binding-target-unknown',
        `${at} lands on "${binding.to}", which a "${element.definition.type}" never reads — the value arrives and nothing shows it${(!styled && didYouMean(binding.to, names)) || '.'}${how}`,
        element.id
      );
    }

    for (const transformer of binding.transformers ?? []) {
      if (catalog && !Object.hasOwn(catalog, transformer.action)) {
        const names = Object.keys(catalog);
        ctx.error(
          'unknown-transformer',
          `${at} runs the transformer "${transformer.action}", which does not exist${didYouMean(transformer.action, names) || '.'} The transformers are ${names.join(', ')}.`,
          element.id
        );
        continue;
      }

      if (catalog) {
        // A flag param is offered as the words 'true'/'false', and the runtime reads a real boolean the same way.
        const params = Object.fromEntries(
          Object.entries(transformer.params).map(([key, value]) => [
            key,
            typeof value === 'boolean' ? String(value) : value
          ])
        );
        const issue = paramIssue(params, catalog[transformer.action], `${at}, transformer "${transformer.action}"`);
        if (issue) {
          ctx.error('transformer-params', issue, element.id);
        }
      }

      const template: unknown = transformer.params.template;
      if (transformer.action === 'twigTemplate' && typeof template === 'string') {
        checkTemplate(ctx, template, `${where}: a binding of "${binding.to}"`, { kind: 'binding' }, scope, element.id);
      }
    }

    // A template renders TEXT unless it hands over its value, and a list keeps only arrays: it rendered nothing.
    const declared = defaults[binding.to];
    const last = binding.transformers?.at(-1);
    if (
      category === 'attributes' &&
      typeof declared === 'object' &&
      declared !== null &&
      last?.action === 'twigTemplate' &&
      last.params.returnMode !== 'value'
    ) {
      ctx.error(
        'template-text-into-value',
        `${where} binds "${binding.to}" through a template, which renders text — and "${binding.to}" holds ${Array.isArray(declared) ? 'a list' : 'an object'}. Give the transformer \`returnMode: 'value'\` (\`bindTemplate('${binding.to}', source, template, { returns: 'value' })\`) so a single \`{{ expression }}\` hands over the value itself.`,
        element.id
      );
    }
  }
};

/** A sample of an answer, shown by the builder: what it holds is content, never a template. */
const DATA_ATTRIBUTES = new Set(['mockData']);

/**
 * A `{{ }}` inside an attribute that is an object or a list: only an attribute that is TEXT is interpolated — by the
 * browser as it renders, and an object is handed over as it is, by the page server too — so the braces arrive as
 * written wherever the value goes: a provider's `input`, a list's `items`, a plugin's settings. A provider's `input`
 * has its own advice (`checkWrittenInput`).
 */
const checkTemplateInValue = (
  ctx: LintContext,
  element: Element,
  where: string,
  name: string,
  value: unknown
): void => {
  const isProviderInput = element.definition.type === 'apiContainer' && name === 'input';
  const template = stringsIn(value).find(hasTemplateSyntax);
  if (template === undefined || DATA_ATTRIBUTES.has(name) || isProviderInput) {
    return;
  }

  ctx.error(
    'template-in-value',
    `${where}: its "${name}" holds "${shorten(template)}" inside ${Array.isArray(value) ? 'a list' : 'an object'}, which is never evaluated — only an attribute that is text is, and this one is handed over as written. Bind "${name}" instead, evaluated where it renders: \`bindTemplate('${name}', source, '{{ … }}', { returns: 'value' })\`.`,
    element.id
  );
};

/**
 * An attribute's `{{ token }}` against what the attribute will see when it renders — and a condition in an attribute,
 * which is used as written: an attribute only resolves a name with filters.
 */
export const checkAttributeTemplates = (ctx: LintContext, element: Element, where: string): void => {
  if (PROSE_TYPES.has(element.definition.type)) {
    return;
  }

  // What the page server evaluates against a context of its own: a provider's `notFound`, read against its answer.
  const evaluated = serverTemplatesByType[element.definition.type] ?? [];
  const rendered = Object.fromEntries(Object.entries(element.attributes).filter(([name]) => !evaluated.includes(name)));
  for (const name of evaluated) {
    const value = element.attributes[name];
    if (typeof value === 'string' && value !== '') {
      checkTemplate(ctx, value, `${where}: its "${name}"`, { kind: 'binding' }, ctx.scope(element.id), element.id);
    }
  }

  for (const [name, value] of Object.entries(rendered)) {
    if (typeof value !== 'string') {
      checkTemplateInValue(ctx, element, where, name, value);
    } else if (hasTemplateSyntax(value) && !hasValidToken(value)) {
      ctx.warn(
        'template-never-resolved',
        `${where} carries "${shorten(value)}", which is never resolved: an attribute only reads a name with filters (\`{{ post.slug|upper }}\`). Move the expression into a binding's \`twigTemplate\`, where it is evaluated in full.`,
        element.id,
        { value }
      );
    }
  }

  const routeParams = ctx.routeParams(element.id);
  const scope = ctx.scope(element.id);
  for (const [name, value] of Object.entries(rendered)) {
    if (typeof value === 'string' && hasValidToken(value)) {
      checkTemplate(ctx, value, `${where}: its "${name}"`, { kind: 'attribute', routeParams }, scope, element.id);
    }
  }
};
