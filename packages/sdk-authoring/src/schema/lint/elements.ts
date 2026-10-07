import { isSvgMarkup } from '@plitzi/sdk-elements/elements/media/Svg/sanitizeSvg';
import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';
import { hasTemplateSyntax, hasValidToken } from '@plitzi/sdk-shared/helpers/twigWrapper';

import { BINDING_CATEGORIES, LOAD_STRATEGIES, RUNTIMES, paramIssue } from '../guard';
import { didYouMean } from '../suggest';
import { textOf } from './context';
import { checkGlobalRead } from './globalReads';
import { checkPageTarget } from './pages';
import { checkFocusOnFieldBox, checkHeadingLevels, checkSlots } from './slots';
import { checkPropsRead, checkTemplate } from './templates';

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

/** A compound element shows what it holds through its parts — anywhere inside it: without one, nothing in it shows. */
const checkParts = (ctx: LintContext, element: Element, where: string): void => {
  const type = element.definition.type;
  const parts =
    ctx.catalogs.partTypes && Object.hasOwn(ctx.catalogs.partTypes, type) ? ctx.catalogs.partTypes[type] : [];
  if (parts.length === 0) {
    return;
  }

  const inside = new Set<string>();
  const pending = [...(element.definition.items ?? [])];
  for (let id = pending.pop(); id !== undefined; id = pending.pop()) {
    const child = ctx.element(id);
    if (child) {
      inside.add(child.definition.type);
      pending.push(...(child.definition.items ?? []));
    }
  }

  const missing = parts.filter(part => !inside.has(part));
  if (missing.length === 0) {
    return;
  }

  const named = missing.map(part => `"${part}"`).join(' and ');
  ctx.error(
    'part-missing',
    `${where} has no ${named} inside it — a "${type}" shows what it holds through ${missing.length === 1 ? 'that part' : 'those parts'}, so nothing in it shows. Add ${missing.length === 1 ? 'one' : 'them'} inside it.`,
    element.id
  );
};

/**
 * An attribute's value against what its element takes: known at all (a built-in type's attributes are exactly its
 * component's props), one of the values of an enumerated attribute, and the same kind of value its default is where
 * that decides how the component reads it — a list for a list, a flag for a flag. A template is resolved at run time,
 * so it is left to the template checks.
 */
const checkAttributes = (ctx: LintContext, element: Element, where: string): void => {
  // A `custom` host is held to the component it hosts, when that component was declared.
  const type = ctx.catalogType(element) ?? element.definition.type;
  const names = ctx.attributeNamesFor(element);
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
 * What is a block by what it means, not by its styles: a heading, a paragraph, a list, a form, or prose that renders
 * paragraphs of its own. A `text` or a `container` renders a `div` too, but one styled inline is what a span holds.
 */
const BLOCK_TYPES = new Set(['heading', 'paragraph', 'list', 'form', 'markdown', 'richText']);

/**
 * A `span` container is for a run of text — a dot before a title, a word dressed apart — and a `p` one for a sentence
 * made of parts, a link in the middle of it. A heading or a paragraph inside either breaks it: a span's line in two, and
 * a `<p>` the browser closes before the block, so the page it parses is not the one written.
 */
const warnSpanHoldsBlock = (ctx: LintContext, element: Element, where: string): void => {
  const tag = element.attributes.subType;
  if (element.definition.type !== 'container' || (tag !== 'span' && tag !== 'p')) {
    return;
  }

  const blocks = (element.definition.items ?? []).flatMap(id => {
    const child = ctx.element(id);

    return child && BLOCK_TYPES.has(child.definition.type) ? [child] : [];
  });
  if (!blocks.length) {
    return;
  }

  ctx.warn(
    'span-holds-block',
    `${where} is a \`${tag}\` but holds ${blocks.map(child => ctx.describe(child.id)).join(', ')}, which ${blocks.length === 1 ? 'is a block' : 'are blocks'}: ${tag === 'p' ? 'a browser closes a `<p>` before a block, so the page it builds is not the one written' : 'a span sits in a line of text, and a block breaks it in two'}. Make it a \`div\` (leave \`subType\` out), or put words there instead — a \`text\`, a \`link\`, inline.`,
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

/**
 * The attributes the page server evaluates in full, by element type — never rendered, so never held to what an
 * attribute resolves: a provider's `notFound`, read against its answer (`source`) once it is in.
 */
const SERVER_EXPRESSIONS: Record<string, readonly string[]> = { apiContainer: ['notFound'] };

/**
 * An attribute's `{{ token }}` against what the attribute will see when it renders — and a condition in an attribute,
 * which is used as written: an attribute only resolves a name with filters.
 */
const checkAttributeTemplates = (ctx: LintContext, element: Element, where: string): void => {
  if (PROSE_TYPES.has(element.definition.type)) {
    return;
  }

  const evaluated = SERVER_EXPRESSIONS[element.definition.type] ?? [];
  const rendered = Object.fromEntries(Object.entries(element.attributes).filter(([name]) => !evaluated.includes(name)));
  for (const name of evaluated) {
    const value = element.attributes[name];
    if (typeof value === 'string' && value !== '') {
      checkTemplate(ctx, value, `${where}: its "${name}"`, { kind: 'binding' }, ctx.scope(element.id), element.id);
    }
  }

  for (const value of stringsIn(rendered)) {
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
  const scope = ctx.scope(element.id);
  for (const [name, value] of Object.entries(rendered)) {
    if (typeof value === 'string' && hasValidToken(value)) {
      checkTemplate(ctx, value, `${where}: its "${name}"`, { kind: 'attribute', routeParams }, scope, element.id);
    }
  }
};

/** A value at a dotted path of a record, as the list reads its `itemKey`. */
const fieldOf = (item: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((value, key) => (isRecord(value) ? value[key] : undefined), item);

/**
 * A list's `itemKey` that does not name each of its fixed items once. The list falls back to the items' `id`, then to
 * their position, so the rows do not stay with their items as the author meant. Bound items arrive at run time and
 * are not read here.
 */
const warnItemKey = (ctx: LintContext, element: Element, where: string): void => {
  const { itemKey, items } = element.attributes;
  if (typeof itemKey !== 'string' || itemKey === '' || !Array.isArray(items) || items.length === 0) {
    return;
  }

  const keys = items.map(item => fieldOf(item, itemKey));
  const missing = keys.filter(key => typeof key !== 'string' && typeof key !== 'number').length;
  const shared = new Set(keys).size !== keys.length;
  if (missing === 0 && !shared) {
    return;
  }

  ctx.warn(
    'list-item-key-missing',
    `${where} names its rows by "${itemKey}", but ${missing > 0 ? `${String(missing)} of its ${String(items.length)} items have no "${itemKey}"` : `two of its items share one "${itemKey}"`}: the rows fall back to the items' \`id\`, then to their position. Give every item its own "${itemKey}", or name a field that has one.`,
    element.id
  );
};

/** An `<li>`: a `listItem`, or a container that says it is one. */
const isListItem = (element: Element): boolean =>
  element.definition.type === 'listItem' ||
  (element.definition.type === 'container' && element.attributes.subType === 'li');

/** A container with no tag of its own named: the row `list-row-not-li` makes an `<li>` without asking. */
export const isPlainContainer = (element: Element): boolean =>
  element.definition.type === 'container' &&
  (element.attributes.subType === undefined || element.attributes.subType === 'div');

/**
 * The rows of a list with `items`: it is a `<ul>` (an `<ol>` with `subType: 'ol'`) and renders each row straight into
 * it, so a row that is not an `<li>` is a box inside a list — read by a screen reader as no item at all. A plain
 * container becomes one with nothing else to decide; anything else — a link, a button, a component whose root is not an
 * `<li>` — is wrapped, which is the author's to choose, since the wrapper then becomes what the list lays out.
 */
const warnRowsNotItems = (ctx: LintContext, list: Element): void => {
  const tag = list.attributes.subType === 'ol' ? '<ol>' : '<ul>';
  for (const rowId of list.definition.items ?? []) {
    const row = ctx.element(rowId);
    if (!row || isListItem(row)) {
      continue;
    }

    const component = ctx.instanceOf(row);
    const root = component?.flat[component.rootId];
    if (root && isListItem(root)) {
      continue;
    }

    const how = isPlainContainer(row)
      ? `Write it \`container({ subType: 'li' })\` — its class still lays "${row.id}" out as before.`
      : component
        ? `Make the root of component "${component.id}" an \`<li>\` (\`container({ subType: 'li' })\`), or wrap the instance in one.`
        : `Wrap it in \`container({ subType: 'li', children: [ … ] })\` — the wrapper is then what the list lays out, so move the layout of "${row.id}" onto it.`;
    ctx.warn(
      'list-row-not-li',
      `${ctx.describe(row.id)} is a row of list "${list.id}", which renders as a \`${tag}\`: a row that is not an \`<li>\` is a box inside a list, which a screen reader reads as no item at all. ${how}`,
      row.id
    );
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

  if (type === 'list' && !bound('items')) {
    warnItemKey(ctx, element, where);
  }

  if (type === 'list' && attributes.source === 'controlled') {
    warnRowsNotItems(ctx, element);
  }

  const { loadingSlot } = attributes;
  if (type === 'apiContainer' && typeof loadingSlot === 'string' && loadingSlot !== '') {
    const children = element.definition.items ?? [];
    if (!children.includes(loadingSlot)) {
      ctx.error(
        'loading-slot-unknown',
        `${where} shows "${loadingSlot}" while it loads, which is not one of its children${didYouMean(loadingSlot, children) || '.'} The loading slot is a child of the provider — a skeleton beside what it stands for: give that child the id.`,
        element.id
      );
    }
  }

  // Only a controlled list reads `items`: any other source renders its children once, so bound rows never appear.
  const hasItems = bound('items') || (Array.isArray(attributes.items) && attributes.items.length > 0);
  if (type === 'list' && attributes.source !== 'controlled' && hasItems) {
    ctx.error(
      'list-items-ignored',
      `${where} has items, but its \`source\` is "${typeof attributes.source === 'string' ? attributes.source : 'none'}": it renders its children once and never reads them. Write \`source: 'controlled'\`.`,
      element.id
    );
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

  // `connector` is a way to ask on its own: the server resolves a provider that names one, whatever its `resource`.
  const sources = ['query', 'action', 'connector', 'resource'];
  const asks = sources.some(key => typeof attributes[key] === 'string' && attributes[key] !== '');
  const mockData = attributes.mockData;
  const mocked = typeof mockData === 'string' ? mockData !== '' && mockData !== '{}' : mockData !== undefined;
  if (type === 'apiContainer' && !asks && !sources.some(bound) && !mocked) {
    ctx.warn(
      'provider-without-source',
      `${where} asks nothing: it has no \`query\`, \`action\`, \`connector\` or \`resource\`, so everything bound to it stays empty. Give it one — \`query: '/data/games.json'\`.`,
      element.id
    );
  }

  // A server provider is answered by the page server's resolver, and that resolver asks only for a space that turned
  // server data on — without it the provider renders its mock data, and nothing anywhere said why. Whatever it asks
  // with: a `query` reading one of the project's own files is answered the same way.
  const serverSource = ['connector', 'action', 'query'].find(
    key => typeof attributes[key] === 'string' && attributes[key] !== ''
  );
  // A component's tree is placed by instances, any number of them on one page, and the page server resolves what the
  // page and its layouts hold — never inside a component. Left there, the provider stays loading for ever, wherever it
  // is placed.
  if (element.definition.runtime === 'server' && ctx.component) {
    ctx.error(
      'server-provider-in-component',
      `${where} is resolved on the server (\`runtime: 'server'\`) inside component "${ctx.component.id}", and the page server only resolves what a page and its layouts hold — it would stay loading wherever the component is placed. Put the provider on the page, around the instance, and hand the component what it reads as a prop: \`component('${ctx.component.id}', { props: { rows: … } })\`, its list reading \`props.rows\`.`,
      element.id
    );
  }

  // `notFound` decides the status the page is sent with: read by the page server once the provider's answer is in. A
  // browser provider's answer arrives after the page went out, and a value that is not one expression is never true.
  const notFound = attributes.notFound;
  if (typeof notFound === 'string' && notFound !== '') {
    if (element.definition.runtime !== 'server') {
      ctx.error(
        'not-found-in-browser',
        `${where} says when its answer means the address shows nothing (\`notFound\`), but it is asked from the browser, after the page was sent with its status. Give it \`runtime: 'server'\` — or remove \`notFound\` and show the page's "not found" part with \`visible\`.`,
        element.id
      );
    } else if (!/^\s*\{\{[\s\S]*\}\}\s*$/.test(notFound)) {
      ctx.error(
        'not-found-not-a-template',
        `${where} has \`notFound: ${JSON.stringify(notFound)}\`, which is never \`true\`: it is one expression against the answer, \`'{{ source.found == false }}'\`.`,
        element.id
      );
    }
  }

  // Server data is on unless the space turns it off: the builder and the MCP never write `rsc`, and a space they made
  // with a server provider is served like one that says `enabled: true`.
  if (element.definition.runtime === 'server' && serverSource && ctx.schema.rsc?.enabled === false) {
    ctx.warn(
      'server-data-without-rsc',
      `${where} is resolved on the server (\`runtime: 'server'\`) through its \`${serverSource}\`, but the space turns server data off (\`rsc: { enabled: false }\`), so it renders its mock data and never asks. Remove that: server data is on unless a space turns it off.`,
      element.id,
      { source: serverSource }
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
const ROUTE_PARAM = /navigation\.routeParams\.([A-Za-z_][\w-]*)/g;

/**
 * A route param the page's address never fills. `navigation.routeParams.<name>` holds what the matched route caught,
 * and a slug without `:<name>` catches nothing under that name — so what reads it is always empty, and nothing says so.
 * A layout renders on every page and may read any of theirs.
 */
const warnRouteParams = (ctx: LintContext, element: Element, where: string): void => {
  const read = new Set(
    [
      // A prose element's text is content: a `navigation.routeParams.x` in it is a sample of code, not a read.
      ...(PROSE_TYPES.has(element.definition.type) ? [] : stringsIn(element.attributes)),
      ...bindingsOf(element).flatMap(({ binding }) => [binding.source, ...stringsIn(binding.transformers)]),
      ...stringsIn(Object.values(element.definition.interactions ?? {}).map(node => node.params))
    ].flatMap(text => [...text.matchAll(ROUTE_PARAM)].map(([, name]) => name))
  );
  const declared = ctx.routeParams(element.id);
  for (const name of read) {
    if (!declared.includes(name)) {
      ctx.warn(
        'route-param-undeclared',
        `${where} reads "navigation.routeParams.${name}", but its page's address has no ":${name}"${declared.length > 0 ? ` (it has ${declared.map(param => `:${param}`).join(', ')})` : ''}, so it is always empty. Add \`:${name}\` to the page's slug — \`slug: 'posts/:${name}'\` — or, for a query parameter, read \`navigation.queryParams.${name}\`.`,
        element.id,
        { param: name }
      );
    }
  }
};

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
const warnFormControls = (ctx: LintContext): void => {
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
const checkRequiredMessage = (ctx: LintContext, element: Element, where: string): void => {
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

/** An `svg` draws one `<svg>…</svg>`; anything else renders nothing at all. */
const checkSvgMarkup = (ctx: LintContext, element: Element, where: string): void => {
  const { content } = element.attributes;
  if (element.definition.type !== 'svg' || typeof content !== 'string' || content === '' || isSvgMarkup(content)) {
    return;
  }

  ctx.error(
    'svg-not-svg',
    `${where} is an \`svg\` whose \`content\` is not one \`<svg>…</svg>\` (${JSON.stringify(shorten(content))}), so it draws nothing. Give it the SVG markup alone; HTML around it belongs in a \`blockHtml\`.`,
    element.id
  );
};

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
        `${where} is a "${type}", which is not a built-in type${didYouMean(type, Object.keys(catalog)) || '.'} It renders only if a plugin registers it: hand its declaration to \`authorSpace(space, { plugins: [declaration] })\` — which also checks its triggers, callbacks and attributes — or name it in \`pluginTypes: ['${type}']\`, or host your component with \`custom({ renderType: '${type}' })\`.`,
        element.id,
        { type }
      );
    }

    checkAncestor(ctx, element, where);
    checkParts(ctx, element, where);
    checkAttributes(ctx, element, where);
    checkChildren(ctx, element, where);
    warnSpanHoldsBlock(ctx, element, where);
    checkAttributeTemplates(ctx, element, where);
    checkIntent(ctx, element, where);
    checkSvgMarkup(ctx, element, where);
    checkRequiredMessage(ctx, element, where);
    checkSlots(ctx, element, where);
    checkHeadingLevels(ctx, element, where);
    checkFocusOnFieldBox(ctx, element, where);
    warnRouteParams(ctx, element, where);
  }

  warnFormControls(ctx);
};
