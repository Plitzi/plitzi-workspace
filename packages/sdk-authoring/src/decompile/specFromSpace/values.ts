import { isRecord } from '@plitzi/sdk-shared/helpers';

import { elementAttributeNames } from '../../elements';

import type { SpecReader } from './reader';
import type { SpecCorrectionCode } from './types';
import type { CssProps } from '../../style';
import type { BindingCategory, ElementBinding, ElementInteraction, Schema } from '@plitzi/sdk-shared';

/**
 * Element types the builder no longer ships, and what each one is today.
 *
 * A `navbar` was a horizontal list of links; the element that renders a list is `list`, so a navbar becomes one —
 * laid out in a row, because that is what the old element did without being asked.
 */
export const LEGACY_ELEMENT_TYPES: Record<
  string,
  { type: string; attributes: (legacy: Record<string, unknown>) => Record<string, unknown>; css?: CssProps }
> = {
  navbar: {
    type: 'list',
    attributes: legacy => ({ subType: legacy.subtype === 'ol' ? 'ol' : 'ul' }),
    css: {
      display: 'flex',
      'list-style-type': 'none',
      'padding-left': '0px',
      'margin-top': '0px',
      'margin-bottom': '0px'
    }
  },
  navbarItem: { type: 'listItem', attributes: () => ({}) }
};

export const DEFINITION_FIELDS = new Set([
  'label',
  'type',
  'rootId',
  'parentId',
  'items',
  'styleSelectors',
  'bindings',
  'interactions',
  'initialState',
  'runtime',
  'loadStrategy',
  'flag',
  'anchor',
  'motion',
  'quiet'
]);

export const PAGE_ATTRIBUTES = new Set([
  'slug',
  'default',
  'name',
  'folder',
  'layout',
  'layoutContainer',
  'accessLevel',
  'access',
  'unauthorizedBehaviour',
  'unauthorizedPageRedirect',
  'seoEnabled',
  'seoPageTitle',
  'seoPageDescription',
  'notFound',
  'documentScroll',
  'enabled'
]);

export const LAYOUT_ATTRIBUTES = new Set(['folder', 'layout', 'layoutContainer']);

/**
 * Every setting a space can carry, which `schemaSettings.test.ts` holds to the `Schema['settings']` type.
 *
 * A key outside it is one nothing reads any more — `head`, from before a space declared its fonts.
 */
export const SCHEMA_SETTINGS = [
  'keepState',
  'stateStorage',
  'transientState',
  'paintedState',
  'customCss',
  'visitorRoles',
  'userProvider',
  'tokenStorage',
  'loginUrl',
  'userUrl',
  'refreshUrl',
  'logoutUrl',
  'detailsPath',
  'tokenPath',
  'refreshTokenPath',
  'expirationTimePath',
  'refreshExpirationTimePath',
  'sessionHintCookie',
  'sessionExchangeUrl',
  'mfaUrl',
  'sessionGate',
  'sessionRevalidateSeconds',
  'debugMode',
  'computed',
  'channels'
] as const satisfies readonly (keyof Schema['settings'])[];

export const SETTING_NAMES = new Set<string>(SCHEMA_SETTINGS);

/**
 * Values an older builder wrote for an attribute that the element's type spells differently today.
 *
 * A link's `target` is the window's name WITHOUT the underscore — the component adds it — so `_blank` rendered as
 * `__blank`: a named window, not a new one, which is the bug this repairs rather than preserves.
 */
export const ATTRIBUTE_VALUE_FIXES: Record<string, Record<string, Record<string, string>>> = {
  link: { target: { _blank: 'blank', _self: 'self', _parent: 'parent', _top: 'top' } }
};

/** The same table, read by any type name — a document's types are strings, not the literal keys it is built from. */
export const ATTRIBUTE_NAMES: Readonly<Record<string, readonly string[] | null>> = elementAttributeNames;

export const BINDING_CATEGORIES: readonly BindingCategory[] = ['attributes', 'initialState', 'style'];

export const isEmpty = (value: object | null | undefined): boolean => !value || Object.keys(value).length === 0;

const isBinding = (value: unknown): value is ElementBinding =>
  isRecord(value) && typeof value.source === 'string' && typeof value.to === 'string';

/** A condition worth keeping: the builder stores "no condition" as an empty group, or as an empty array. */
export const conditionOf = <T>(when: T | undefined): T | undefined =>
  isRecord(when) && Array.isArray(when.rules) && when.rules.length > 0 ? when : undefined;

/**
 * Every name a document mentions outside its own structure — in attributes, bindings, steps and settings.
 *
 * What decides whether an id can be dropped (and derived again) or has to be written down: a name something else
 * refers to has to survive, and a name nothing refers to is bookkeeping. Tokenised once rather than searched per
 * id, and a token that joins a source prefix to an id (`apiContainer_posts`) also yields the id.
 */
export const tokensOf = (corpus: string): Set<string> => {
  const tokens = new Set<string>();
  for (const token of corpus.split(/[^A-Za-z0-9_-]+/)) {
    if (!token) {
      continue;
    }

    tokens.add(token);
    for (let index = token.indexOf('_'); index !== -1; index = token.indexOf('_', index + 1)) {
      tokens.add(token.slice(index + 1));
    }
  }

  return tokens;
};

export const stepCorpus = (host: string, interactions: Record<string, ElementInteraction>): unknown[] =>
  Object.values(interactions).map(node => ({
    params: node.params,
    when: node.when,
    // A trigger names the element it sits on, which is not a reference to anything.
    ...(node.elementId && node.elementId !== host ? { elementId: node.elementId } : {})
  }));

export const bindingsOf = (bindings: unknown, category: BindingCategory): ElementBinding[] => {
  const list: unknown = isRecord(bindings) ? bindings[category] : undefined;

  return Array.isArray(list) ? list.filter(isBinding) : [];
};

// A binding's own id says only where it sits in its list; it is not a reference to anything.
export const bindingCorpus = (bindings: unknown): unknown[] =>
  BINDING_CATEGORIES.flatMap(category =>
    bindingsOf(bindings, category).map(({ source, to, transformers, when }) => ({ source, to, transformers, when }))
  );

export const correct = (reader: SpecReader, code: SpecCorrectionCode, message: string, at?: string): void => {
  reader.corrections.push({ code, message, ...(at === undefined ? {} : { at }) });
};
