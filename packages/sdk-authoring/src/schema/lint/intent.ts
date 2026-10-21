import { isRecord } from '@plitzi/sdk-shared/helpers';
import { hasTemplateSyntax } from '@plitzi/sdk-shared/helpers/twigWrapper';

import { didYouMean } from '../suggest';
import { stringsIn } from './context';
import { PROSE_TYPES, SETTLED_SOURCES, bindingsOf } from './elementBindings';
import { warnItemKey, warnRowsNotItems } from './lists';
import { checkPageTarget } from './pages';

import type { LintContext } from './context';
import type { Element } from '@plitzi/sdk-shared';

const ADDRESS_PARAM = /navigation\.(?:routeParams|queryParams)\.([\w-]+)/g;

/** A provider's written `input` — an object, or its JSON text as the builder's editor keeps it. */
const writtenInput = (input: unknown): Record<string, unknown> | undefined => {
  if (typeof input !== 'string') {
    return isRecord(input) ? input : undefined;
  }

  try {
    const parsed: unknown = JSON.parse(input || '{}');

    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

/**
 * A `{{ }}` in a provider's written `input` is sent as its own text (`template-in-value`), as its JSON text too: the page
 * server reads the attribute as saved. It also replaces the route param of the same name, which the action
 * was already given — so `{ room: '{{ navigation.routeParams.room }}' }` hands the action braces instead of the room.
 */
const checkWrittenInput = (ctx: LintContext, input: unknown, where: string, elementId: string): void => {
  const templated = Object.entries(writtenInput(input) ?? {}).filter(([, value]) =>
    stringsIn(value).some(hasTemplateSyntax)
  );
  if (templated.length === 0) {
    return;
  }

  const keys = templated.map(([key]) => key);
  const fromAddress = templated.filter(([key, value]) =>
    stringsIn(value).some(text => [...text.matchAll(ADDRESS_PARAM)].some(match => match[1] === key))
  );
  const how =
    fromAddress.length === templated.length
      ? `The action is already handed the page's route and query params as its input — \`input.${keys[0]}\` — so remove ${keys.length === 1 ? 'it' : 'them'} from \`input\`.`
      : `Bind the input instead, evaluated where it runs: \`bindTemplate('input', 'state.${keys[0]}', '{{ { ${keys[0]}: source } }}', { returns: 'value' })\`. The page's route and query params already reach the action as its input.`;
  ctx.error(
    'template-in-value',
    `${where} writes ${keys.map(key => `"${key}"`).join(', ')} into its \`input\` as a template, which is never evaluated: a written input is sent as it is, braces and all. ${how}`,
    elementId
  );
};

const PROVIDER_SOURCE = /^apiContainer_([\w-]+)(?:\.([\w-]+))?/;
/** What a query provider publishes at its root besides its state: its answer, and its paginated rows. */
const ANSWER_FIELDS = ['data', 'records'];

/**
 * A list's items bound to a query provider outside its answer: the provider publishes its answer beside its state
 * (`data`, `records`, `isLoading`…), so the provider itself — or a field of the answer read at its root — is no list,
 * and the rows draw nothing (NaN, the placeholder) without a word (la-velada: `source.fights`, `.data` left out). A
 * provider fed by a server action publishes the output at its root: read as it is there.
 */
const warnItemsOutsideAnswer = (
  ctx: LintContext,
  element: Element,
  where: string,
  bindings: readonly ReturnType<typeof bindingsOf>[number]['binding'][]
): void => {
  for (const binding of bindings) {
    const match = binding.to === 'items' && binding.enabled !== false ? PROVIDER_SOURCE.exec(binding.source) : null;
    const id = match?.[1];
    const provider = id === undefined ? undefined : ctx.element(id);
    if (!match || id === undefined || provider?.definition.type !== 'apiContainer') {
      continue;
    }

    if (typeof provider.attributes.action === 'string' && provider.attributes.action !== '') {
      continue;
    }

    const templates = (binding.transformers ?? [])
      .filter(transformer => transformer.action === 'twigTemplate')
      .flatMap(transformer => stringsIn(transformer.params));
    // What is read: the binding's own field, else the fields its template reads off `source`.
    // The optional group is typed `string` but is undefined when the source names only the provider.
    const field = match.at(2);
    const read =
      field !== undefined
        ? [field]
        : templates.flatMap(template => [...template.matchAll(/\bsource\s*\.\s*([\w-]+)/g)].map(each => each[1]));
    if (read.some(field => ANSWER_FIELDS.includes(field))) {
      continue;
    }

    const reads =
      read.length > 0
        ? ` and reads ${[...new Set(read)].map(field => `\`${field}\``).join(', ')} at its root`
        : ' itself';
    ctx.warn(
      'list-items-outside-answer',
      `${where} binds its items to the provider "${id}"${reads}, which publishes its answer beside its state (\`data\`, \`records\`, \`isLoading\`…): no list there, so its rows draw nothing. Bind the list inside the answer: \`${id}.data.${read[0] ?? '<rows>'}\`, or \`${id}.records\` (paginated).`,
      element.id,
      { source: binding.source }
    );
  }
};

/**
 * What renders, and renders something other than what it plainly means. Refused where there is no other reading — a
 * controlled list with nothing to render — and warned where there is a rare legitimate one.
 */
export const checkIntent = (ctx: LintContext, element: Element, where: string): void => {
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

  if (type === 'list') {
    warnItemsOutsideAnswer(ctx, element, where, bindings);
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

  if (type === 'apiContainer' && !bound('input')) {
    checkWrittenInput(ctx, attributes.input, where, element.id);
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
    // A bound href is where it starts, not where it leads: the binding writes the path it goes to.
    checkPageTarget(ctx, href, `${where}: its \`href\``, 'mode', element.id, {
      bound: bound('href')
    });
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
export const warnRouteParams = (ctx: LintContext, element: Element, where: string): void => {
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
