import { hasTemplateSyntax, hasValidToken } from '@plitzi/sdk-shared/helpers/twigWrapper';

import { BINDING_CATEGORIES, LOAD_STRATEGIES, RUNTIMES, paramIssue } from '../guard';
import { didYouMean } from '../suggest';
import { checkPageTarget } from './pages';
import { checkTemplate } from './templates';

import type { LintContext } from './context';
import type { Element, ElementBinding } from '@plitzi/sdk-shared';

/** Types whose content is prose, where a `{{ }}` is far more often a sample of code than a template. */
const PROSE_TYPES = new Set(['markdown', 'richText', 'blockHtml', 'blockJsx', 'nodeHtml']);

/**
 * Sources already known on the first render — what a flow wrote, the route, the space's variables, the theme, what the
 * space computes. A condition on them resolves in the render that paints the element, so it has no frame to flash in.
 */
const SETTLED_SOURCES = new Set(['state', 'navigation', 'variables', 'theme', 'computed']);

const shorten = (value: string): string => (value.length > 80 ? `${value.slice(0, 77)}…` : value);

const stringsIn = (value: unknown): string[] => {
  if (typeof value === 'string') {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(stringsIn);
  }

  return typeof value === 'object' && value !== null ? Object.values(value).flatMap(stringsIn) : [];
};

const bindingsOf = (element: Element): { category: string; binding: ElementBinding }[] =>
  Object.entries(element.definition.bindings ?? {}).flatMap(([category, list]) =>
    list.map(binding => ({ category, binding }))
  );

/** A sub-element that reads its parent's context throws on its first render anywhere else, taking the page with it. */
const checkAncestor = (ctx: LintContext, element: Element, where: string): void => {
  const ancestorTypes = ctx.catalogs.ancestorTypes;
  const type = element.definition.type;
  const ancestor = ancestorTypes && Object.hasOwn(ancestorTypes, type) ? ancestorTypes[type] : undefined;
  if (!ancestor || [...ctx.ancestors(element.id)].some(id => ctx.element(id)?.definition.type === ancestor)) {
    return;
  }

  ctx.error(
    'outside-ancestor',
    `${where} only works inside a "${ancestor}": it reads that element's state. Nest it in one.`,
    element.id
  );
};

/** The attributes a type reads, or null where that is open: a plugin, or a `custom` whose component decides. */
const attributeNamesOf = (ctx: LintContext, type: string): readonly string[] | null =>
  ctx.catalogs.attributeNames && Object.hasOwn(ctx.catalogs.attributeNames, type)
    ? ctx.catalogs.attributeNames[type]
    : null;

/**
 * An attribute's value against what its element takes: known at all (a built-in type's attributes are exactly its
 * component's props), one of the values of an enumerated attribute, and the same kind of value its default is where
 * that decides how the component reads it — a list for a list, a flag for a flag. A template is resolved at run time,
 * so it is left to the template checks.
 */
const checkAttributes = (ctx: LintContext, element: Element, where: string): void => {
  const type = element.definition.type;
  const names = attributeNamesOf(ctx, type);
  const enums = ctx.catalogs.attributeValues?.[type] ?? {};
  const defaults = ctx.catalogs.defaultAttributes?.[type] ?? {};
  for (const [name, value] of Object.entries(element.attributes)) {
    if (names && !names.includes(name)) {
      const trigger = /^on[A-Z]/.test(name)
        ? ` What happens on an event is a flow: \`flows: [[${name}(), setState({ … })]]\`.`
        : '';
      ctx.error(
        'unknown-attribute',
        `${where} sets "${name}", which a "${type}" never reads${didYouMean(name, names) || '.'}${trigger || ` It reads ${names.join(', ')}.`}`,
        element.id
      );
      continue;
    }

    if (value === undefined || value === null || (typeof value === 'string' && hasValidToken(value))) {
      continue;
    }

    if (Object.hasOwn(enums, name) && !(typeof value === 'string' && enums[name].includes(value))) {
      ctx.error(
        'attribute-value',
        `${where}: \`${name}\` is ${JSON.stringify(value)}${(typeof value === 'string' && didYouMean(value, enums[name])) || '.'} It is one of ${enums[name].map(item => `'${item}'`).join(', ')}.`,
        element.id
      );
      continue;
    }

    const fallback = defaults[name];
    const wrongList = Array.isArray(fallback) && !Array.isArray(value);
    const wrongFlag = typeof fallback === 'boolean' && typeof value !== 'boolean';
    if (wrongList || wrongFlag) {
      ctx.error(
        'attribute-kind',
        `${where}: \`${name}\` is ${JSON.stringify(value)}, and a "${type}" reads it as ${wrongList ? 'a list — write an array, or bind it' : 'true or false — write the boolean, not text'}.`,
        element.id
      );
    }
  }

  const { runtime, loadStrategy } = element.definition;
  if (runtime !== undefined && !RUNTIMES.includes(runtime)) {
    ctx.error(
      'element-runtime',
      `${where}: \`runtime\` is ${JSON.stringify(runtime)}. It is one of ${RUNTIMES.map(item => `'${item}'`).join(', ')}.`,
      element.id
    );
  }

  if (loadStrategy !== undefined && !LOAD_STRATEGIES.includes(loadStrategy)) {
    ctx.error(
      'element-load-strategy',
      `${where}: \`loadStrategy\` is ${JSON.stringify(loadStrategy)}. It is one of ${LOAD_STRATEGIES.map(item => `'${item}'`).join(', ')}.`,
      element.id
    );
  }
};

/**
 * Children in a type that holds none: its component renders its own attributes and never reads `children`, so they
 * are dropped — a heading with two texts in it renders the word "Heading".
 */
const checkChildren = (ctx: LintContext, element: Element, where: string): void => {
  const count = element.definition.items?.length ?? 0;
  const type = element.definition.type;
  if (count === 0 || !ctx.catalogs.leafTypes?.includes(type)) {
    return;
  }

  const subType = element.attributes.subType;
  const hint =
    type === 'heading'
      ? ` For a heading made of parts — a word in another colour, an icon — use \`container({ subType: '${typeof subType === 'string' ? subType : 'h1'}', children })\`.`
      : ' Put the children in a `container` beside it, or wrap both in one.';
  ctx.error(
    'children-in-leaf',
    `${where} has ${count} ${count === 1 ? 'child' : 'children'}, but a "${type}" holds none: it renders its own attributes and drops anything nested in it.${hint}`,
    element.id
  );
};

/**
 * Every binding's shape and transformers: a category that exists, visibility where visibility is read, transformers
 * that exist with params they take, templates read the way the runtime reads them, and a template's TEXT never
 * handed to an attribute that holds a list.
 */
const checkBindings = (ctx: LintContext, element: Element, where: string): void => {
  const catalog = ctx.catalogs.transformers;
  const defaults = ctx.catalogs.defaultAttributes?.[element.definition.type] ?? {};
  const names = attributeNamesOf(ctx, element.definition.type);
  const ancestors = ctx.ancestors(element.id);
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
    const providerId = head.slice(head.indexOf('_') + 1);
    const prefix = ctx.sources.get(providerId);
    if (prefix && head === `${prefix}_${providerId}` && !ancestors.has(providerId) && !ctx.inLayout(providerId)) {
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
    const unread = binding.to !== 'visibility' && binding.to !== 'className' && !names?.includes(binding.to);
    if (category === 'attributes' && names && unread) {
      ctx.error(
        'binding-target-unknown',
        `${at} lands on "${binding.to}", which a "${element.definition.type}" never reads — the value arrives and nothing shows it${didYouMean(binding.to, names) || '.'} It reads ${names.join(', ')}.`,
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
        checkTemplate(
          ctx,
          template,
          `${where}: a binding of "${binding.to}"`,
          { kind: 'binding' },
          ancestors,
          element.id
        );
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

/**
 * An attribute's `{{ token }}` against what the attribute will see when it renders — and a condition in an attribute,
 * which is used as written: an attribute only resolves a name with filters.
 */
const checkAttributeTemplates = (ctx: LintContext, element: Element, where: string): void => {
  if (PROSE_TYPES.has(element.definition.type)) {
    return;
  }

  for (const value of stringsIn(element.attributes)) {
    if (hasTemplateSyntax(value) && !hasValidToken(value)) {
      ctx.warn(
        'template-never-resolved',
        `${where} carries "${shorten(value)}", which is never resolved: an attribute only reads a name with filters (\`{{ post.slug|upper }}\`). Move the expression into a binding's \`twigTemplate\`, where it is evaluated in full.`,
        element.id,
        { value }
      );
    }
  }

  const routeParams = ctx.routeParams(element.id);
  const ancestors = ctx.ancestors(element.id);
  for (const [name, value] of Object.entries(element.attributes)) {
    if (typeof value === 'string' && hasValidToken(value)) {
      checkTemplate(ctx, value, `${where}: its "${name}"`, { kind: 'attribute', routeParams }, ancestors, element.id);
    }
  }
};

/**
 * What renders, and renders something other than what it plainly means. Refused where there is no other reading — a
 * controlled list with nothing to render — and warned where there is a rare legitimate one.
 */
const checkIntent = (ctx: LintContext, element: Element, where: string): void => {
  const type = element.definition.type;
  const { attributes } = element;
  const bindings = bindingsOf(element).map(({ category, binding }) => ({ category, ...binding }));
  const bound = (to: string) => bindings.some(binding => binding.to === to);

  if (type === 'list' && attributes.source === 'controlled' && !bound('items')) {
    if (!Array.isArray(attributes.items) || attributes.items.length === 0) {
      ctx.error(
        'list-without-items',
        `${where} is a controlled list with no items: it renders one row per item and would render none. Write \`items: [ … ]\`, or bind them: \`bind: { items: 'catalog.data.games' }\`.`,
        element.id
      );
    }
  }

  const hidden = element.definition.initialState?.visibility === false;
  const visibilityBound = bindings.some(binding => binding.to === 'visibility' && binding.category === 'initialState');
  if ((type === 'modalContainer' || type === 'dialogContainer') && !hidden && !visibilityBound) {
    ctx.warn(
      'overlay-starts-open',
      `${where} is shown when the page loads, over everything else. Declare it \`visible: false\` and open it from a flow: \`openModal('${element.id}')\`.`,
      element.id,
      { type }
    );
  }

  const asks = ['query', 'action', 'resource'].some(
    key => typeof attributes[key] === 'string' && attributes[key] !== ''
  );
  const mockData = attributes.mockData;
  const mocked = typeof mockData === 'string' ? mockData !== '' && mockData !== '{}' : mockData !== undefined;
  if (type === 'apiContainer' && !asks && !['query', 'action', 'resource'].some(bound) && !mocked) {
    ctx.warn(
      'provider-without-source',
      `${where} asks nothing: it has no \`query\`, \`action\` or \`resource\`, so everything bound to it stays empty. Give it one — \`query: '/data/games.json'\`.`,
      element.id
    );
  }

  const fallback = ctx.catalogs.defaultAttributes?.[type]?.content;
  if (
    (element.definition.items?.length ?? 0) > 0 &&
    typeof fallback === 'string' &&
    fallback !== '' &&
    attributes.content === fallback &&
    !bound('content')
  ) {
    ctx.warn(
      'default-content-beside-children',
      `${where} has children and still its default content "${fallback}", which renders beside them. Set \`content: ''\` to show only the children, or put the words in \`content\`.`,
      element.id,
      { type, content: fallback }
    );
  }

  // A condition computed from data on an element that starts on screen: drawn until the data answers, then hidden.
  const computedVisibility = bindings.some(
    binding =>
      binding.to === 'visibility' &&
      binding.category === 'initialState' &&
      !SETTLED_SOURCES.has(binding.source.split('.')[0]) &&
      (binding.transformers ?? []).some(transformer => transformer.action === 'twigTemplate')
  );
  if (computedVisibility && !hidden) {
    ctx.warn(
      'condition-starts-visible',
      `${where} computes its visibility from data but starts on screen, so it is drawn until the data answers and then hidden. Add \`visible: false\` so it waits hidden, and let the template answer 'false' until its source arrives.`,
      element.id
    );
  }

  const { href, mode } = attributes;
  if (type === 'link' && (mode ?? 'page') === 'page' && typeof href === 'string') {
    checkPageTarget(ctx, href, `${where}: its \`href\``, 'mode', element.id);
  }
};

/**
 * Every element's rules. The roots — pages and layout shells — carry the document's own fields rather than an
 * element's, so only their bindings are read.
 */
export const lintElements = (ctx: LintContext): void => {
  const catalog = ctx.catalogs.attributeNames;
  const unknownTypes = new Set<string>();
  for (const element of Object.values(ctx.flat)) {
    const where = ctx.describe(element.id);
    checkBindings(ctx, element, where);
    if (ctx.pageIds.has(element.id) || ctx.layoutIds.has(element.id)) {
      continue;
    }

    // Once per type: a card repeated on twelve pages is one thing to fix, not twelve.
    const type = element.definition.type;
    if (
      catalog &&
      !Object.hasOwn(catalog, type) &&
      !ctx.catalogs.pluginTypes?.includes(type) &&
      !unknownTypes.has(type)
    ) {
      unknownTypes.add(type);
      ctx.warn(
        'unknown-element-type',
        `${where} is a "${type}", which is not a built-in type${didYouMean(type, Object.keys(catalog)) || '.'} It renders only if a plugin registers it: name it in \`authorSpace(space, { pluginTypes: ['${type}'] })\`, or host your component with \`custom({ renderType: '${type}' })\`.`,
        element.id,
        { type }
      );
    }

    checkAncestor(ctx, element, where);
    checkAttributes(ctx, element, where);
    checkChildren(ctx, element, where);
    checkAttributeTemplates(ctx, element, where);
    checkIntent(ctx, element, where);
  }
};
