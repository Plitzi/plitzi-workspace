import getBindingsDetails from '../dataSource/getBindingsDetails';
import { templatePaths } from '../helpers/twigWrapper';

import type { Element, ElementBinding } from '../types';

/** The address a server provider is rendered at: what both the page server and the browser know of the page. */
export interface ProviderAddress {
  routeParams: Record<string, string | string[] | undefined>;
  queryParams: Record<string, string | string[] | undefined>;
}

/** What the page server reads as the browser does: the address, nothing of the visitor's state. */
const ADDRESS = /^navigation\.(routeParams|queryParams)(\.|$)/;

const readsAddressOnly = (binding: ElementBinding): boolean =>
  ADDRESS.test(binding.source) &&
  binding.when === undefined &&
  (binding.transformers ?? []).every(
    ({ action, params }) =>
      action !== 'twigTemplate' ||
      typeof params.template !== 'string' ||
      templatePaths(params.template).every(
        path => path === 'source' || path.startsWith('source.') || ADDRESS.test(path)
      )
  );

const isInput = (binding: ElementBinding): boolean => binding.to === 'input' || binding.to.startsWith('input.');

/**
 * The input a server provider is resolved with on the page server: the one it was saved with, and each binding of its
 * `input` that reads the address alone (`navigation.routeParams.slug`) applied. A binding on the visitor's state stays
 * the browser's to ask again with. A conversation's provider bound `{ with: routeParams.username }` was resolved with
 * no `with` on every load, refused, and logged with a stack; the browser asked again and drew it.
 *
 * The browser compares what it asks with this same input, so the first paint is never asked for twice.
 */
export const serverInputOf = (
  // None in a render with no schema in its store — a widget, a test — whatever the store's type says.
  element: Pick<Element, 'attributes' | 'definition'> | undefined,
  address: ProviderAddress
): unknown => {
  if (element === undefined) {
    return undefined;
  }

  const bound = (element.definition.bindings?.attributes ?? []).filter(
    binding => binding.enabled !== false && isInput(binding) && readsAddressOnly(binding)
  );
  if (bound.length === 0) {
    return element.attributes.input;
  }

  const resolved = getBindingsDetails(
    { navigation: address },
    { attributes: element.attributes, definition: { ...element.definition, bindings: { attributes: bound } } }
  );

  return resolved.attributes.input;
};
