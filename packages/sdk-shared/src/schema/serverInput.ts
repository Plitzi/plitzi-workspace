import { serverProviderSource } from './providerWhen';
import getBindingsDetails from '../dataSource/getBindingsDetails';
import getSourceName from '../dataSource/helpers/getSourceName';
import { isRecord } from '../helpers/isRecord';
import { templatePaths } from '../helpers/twigWrapper';

import type { Element, ElementBinding } from '../types';

/** The address a server provider is rendered at: what both the page server and the browser know of the page. */
export interface ProviderAddress {
  routeParams: Record<string, string | string[] | undefined>;
  queryParams: Record<string, string | string[] | undefined>;
}

/** What the page server reads as the browser does: the address, nothing of the visitor's state. */
const ADDRESS = /^navigation\.(routeParams|queryParams)(\.|$)/;

const PROVIDER = 'apiContainer';

/** The root of a path: `apiContainer_crate` of `apiContainer_crate.data.username`. */
const rootOf = (path: string): string => path.split(/[.[]/)[0] ?? path;

/** Every path a binding reads: its source, and what its templates name besides the value it is handed. */
const pathsOf = (binding: ElementBinding): string[] => [
  binding.source,
  ...(binding.transformers ?? []).flatMap(({ action, params }) =>
    action === 'twigTemplate' && typeof params.template === 'string'
      ? templatePaths(params.template).filter(path => path !== 'source' && !path.startsWith('source.'))
      : []
  )
];

const isInput = (binding: ElementBinding): boolean => binding.to === 'input' || binding.to.startsWith('input.');

/**
 * The bindings of a provider's `input` the page server reads as the browser does: each path the address, or a server
 * provider's answer it knows (`known`, by source name) — never the visitor's state — and no condition of its own.
 */
const readableInputs = (element: Pick<Element, 'definition'>, known: (source: string) => boolean): ElementBinding[] =>
  (element.definition.bindings?.attributes ?? []).filter(
    binding =>
      binding.enabled !== false &&
      isInput(binding) &&
      binding.when === undefined &&
      pathsOf(binding).every(path => ADDRESS.test(path) || known(rootOf(path)))
  );

/**
 * The server providers a provider's bound `input` reads the answer of, by id — what the page server resolves before
 * it, as it does a `when`'s: a room's crate bound its person to another provider's answer, and was asked with none.
 */
export const inputProviders = (element: Pick<Element, 'definition'>, serverIds: ReadonlySet<string>): string[] => {
  const idOf = (source: string): string | undefined => {
    const id = source.startsWith(`${PROVIDER}_`) ? source.slice(PROVIDER.length + 1) : undefined;

    return id !== undefined && serverIds.has(id) && getSourceName(PROVIDER, id) === source ? id : undefined;
  };

  return [
    ...new Set(
      readableInputs(element, source => idOf(source) !== undefined).flatMap(binding =>
        pathsOf(binding).flatMap(path => idOf(rootOf(path)) ?? [])
      )
    )
  ];
};

/**
 * The input a server provider is resolved with on the page server: the one it was saved with, and each binding of its
 * `input` the server reads applied — the address (`navigation.routeParams.slug`), and the answers of the server
 * providers before it (`providers`, by source name, as the browser publishes them: `serverProviderSource`). A binding
 * on the visitor's state stays the browser's to ask again with. A conversation's provider bound `{ with:
 * routeParams.username }` was resolved with no `with` on every load, refused, and logged with a stack.
 *
 * The browser compares what it asks with this same input, so the first paint is never asked for twice.
 */
export const serverInputOf = (
  // None in a render with no schema in its store — a widget, a test — whatever the store's type says.
  element: Pick<Element, 'attributes' | 'definition'> | undefined,
  address: ProviderAddress,
  providers: Readonly<Record<string, unknown>> = {}
): unknown => {
  if (element === undefined) {
    return undefined;
  }

  const bound = readableInputs(element, source => Object.hasOwn(providers, source));
  if (bound.length === 0) {
    return element.attributes.input;
  }

  const resolved = getBindingsDetails(
    { ...providers, navigation: address },
    { attributes: element.attributes, definition: { ...element.definition, bindings: { attributes: bound } } }
  );

  return resolved.attributes.input;
};

/**
 * The input the page server resolved a provider with, as the browser works it out from what it was sent: the element
 * as saved, the page's elements (`flat`) and the server's payload (`rsc.data`) — each read as it is, since a render
 * with no schema or no payload in its store (a widget, a test) has none. What `useInputRefresh` compares against.
 */
export const browserServerInput = (
  element: Pick<Element, 'attributes' | 'definition'> | undefined,
  flat: unknown,
  payload: unknown,
  address: ProviderAddress
): unknown => {
  if (element === undefined) {
    return undefined;
  }

  const answers = isRecord(payload) ? payload : {};
  const singleRecord = (id: string): boolean => {
    const other = isRecord(flat) ? flat[id] : undefined;

    return isRecord(other) && isRecord(other.attributes) && other.attributes.singleRecord === true;
  };
  const providers = Object.fromEntries(
    inputProviders(element, new Set(Object.keys(answers))).map(id => [
      getSourceName(PROVIDER, id),
      serverProviderSource(answers[id], singleRecord(id))
    ])
  );

  return serverInputOf(element, address, providers);
};
