import { grantUrl, isGranted, isRemote } from './grant';

import type { ResourceProxy } from './types';
import type {
  ElementDefinition,
  ElementInteraction,
  Schema,
  Style,
  StyleBlock,
  StyleObject,
  StyleValue
} from '@plitzi/sdk-shared';

// Where a remote URL can sit in an authored widget. `src`/`poster` are the props the media elements read;
// `content`/`html` are the raw-markup elements (blockHtml, markdown), where a URL is embedded in text.
const URL_ATTRIBUTES = ['src', 'poster'];
const MARKUP_ATTRIBUTES = ['content', 'html'];

// The element that fetches at runtime: its `query` prop is the URL, and the response feeds every binding hanging
// off it. It is the whole point of a data-driven widget, and the one request a sandbox's connect-src blocks.
const FETCHING_TYPE = 'apiContainer';

// The interaction step that swaps a resource AFTER the widget is on screen: a `callback` setState writing `src` on
// an image, a `globalCallback` setState parking a URL in state for a binding to read. Its params are the second
// place a URL lives, and the one the initial rewrite used to miss — the first paint went through the endpoint and
// the first click put the authored URL back, which the sandbox then blocked.
const SET_STATE_ACTION = 'setState';
// A destination the user is sent to, not a resource the widget loads: proxying it would hand the browser bytes
// where it expected a page.
const NAVIGATION_ACTION = 'navigate';
// The `utility` twin of an apiContainer: it calls an endpoint from the widget, under the same sandbox rules.
const FETCHING_UTILITY = 'webHook';

// Extensions that name something a widget LOADS. Interaction params and API payloads are untyped — the same string
// could be a picture or a link — so the target itself is what decides, and anything that does not look like a file
// is left as authored rather than guessed at.
const ASSET_EXTENSION =
  /\.(?:apng|avif|bmp|gif|ico|jpe?g|png|svg|webp|aac|flac|m4a|mp3|oga|ogg|opus|wav|mp4|m4v|mov|ogv|webm|otf|ttf|woff2?)$/i;

const CSS_URL = /url\(\s*(["']?)(https?:\/\/[^"')\s]+)\1\s*\)/gi;
const HTML_SRC = /(<[^>]+?\ssrc\s*=\s*)(["'])(https?:\/\/[^"']+)\2/gi;
const MARKDOWN_IMAGE = /(!\[[^\]]*\]\(\s*)(https?:\/\/[^\s)]+)/gi;

// A URL inside HTML markup may carry escaped ampersands; what gets fetched is the unescaped one, so that is what
// is signed and granted.
const unescapeHtml = (url: string): string => url.replace(/&amp;/g, '&');

const toProxy = (url: string, proxy: ResourceProxy): string =>
  isGranted(url, proxy) ? url : grantUrl(unescapeHtml(url), proxy);

/** Does this URL name a file the widget loads, judged by its path alone? Used where nothing else says what a URL is
 *  for — an interaction param, a field of an API answer — so the extension is the evidence and its absence is a
 *  reason to leave the URL alone. */
export const looksLikeAsset = (url: string): boolean => {
  try {
    return ASSET_EXTENSION.test(new URL(url).pathname);
  } catch {
    return false;
  }
};

/** Rewrite every remote URL embedded in a string: `url(…)` in CSS, `src="…"` in markup, `![](…)` in markdown. */
export const rewriteText = (text: string, proxy: ResourceProxy): string =>
  text
    .replace(CSS_URL, (_match, quote: string, url: string) => `url(${quote}${toProxy(url, proxy)}${quote})`)
    .replace(
      HTML_SRC,
      (_match, prefix: string, quote: string, url: string) => `${prefix}${quote}${toProxy(url, proxy)}${quote}`
    )
    .replace(MARKDOWN_IMAGE, (_match, prefix: string, url: string) => `${prefix}${toProxy(url, proxy)}`);

const rewriteStyleObject = (styleObject: StyleObject, proxy: ResourceProxy): void => {
  for (const [property, value] of Object.entries(styleObject)) {
    if (typeof value === 'string' && value.includes('url(')) {
      // StyleObject keys are a closed union that Object.entries widens to string; the value written back is the
      // same CSS declaration with its URLs swapped.
      (styleObject as Record<string, StyleValue>)[property] = rewriteText(value, proxy);
    }
  }
};

const rewriteStyleBlock = (block: Omit<StyleBlock, 'variants'>, proxy: ResourceProxy): void => {
  if (block.default) {
    rewriteStyleObject(block.default, proxy);
  }

  for (const state of Object.values(block.states ?? {})) {
    rewriteStyleObject(state, proxy);
  }
};

/** Why a request was left as authored, or undefined when it can be granted. Each case is one this hop cannot
 *  reproduce faithfully, and getting it wrong silently would be worse than the request being blocked: a write sent
 *  through a GET, or an API answering 401 because its credential was dropped on the way. Reads both vocabularies —
 *  an apiContainer's attributes and a webHook's params name the same things differently. */
const unproxyableFetch = (source: Record<string, unknown>): string | undefined => {
  const { method, headers, accessToken, authorizationToken } = source;

  if (typeof method === 'string' && method.toLowerCase() !== 'get') {
    return `it is a ${method.toUpperCase()} request`;
  }

  if (typeof accessToken === 'string' && accessToken !== '') {
    return 'it sends its own credentials';
  }

  if (typeof authorizationToken === 'string' && authorizationToken !== '') {
    return 'it sends its own credentials';
  }

  return headers && Object.keys(headers).length > 0 ? 'it sends its own headers' : undefined;
};

// What `value` means in a setState step is whatever its sibling `key` points at, so the pair is read together: an
// element callback names an attribute of the target element (`src` on an image), a global one a state key a
// binding later reads. Everything else falls through to the generic pass below.
const rewriteSetState = (params: Record<string, unknown>, proxy: ResourceProxy): boolean => {
  const { key, value } = params;
  if (typeof key !== 'string' || typeof value !== 'string') {
    return false;
  }

  if (URL_ATTRIBUTES.includes(key) && isRemote(value)) {
    params.value = toProxy(value, proxy);

    return true;
  }

  if (MARKUP_ATTRIBUTES.includes(key) && value.includes('http')) {
    params.value = rewriteText(value, proxy);

    return true;
  }

  return false;
};

const rewriteParams = (params: Record<string, unknown>, proxy: ResourceProxy): void => {
  for (const [name, value] of Object.entries(params)) {
    if (typeof value !== 'string') {
      continue;
    }

    if (URL_ATTRIBUTES.includes(name) && isRemote(value)) {
      params[name] = toProxy(value, proxy);
    } else if (MARKUP_ATTRIBUTES.includes(name) && value.includes('http')) {
      params[name] = rewriteText(value, proxy);
    } else if (isRemote(value) && looksLikeAsset(value)) {
      // A param this catalog does not know by name, carrying what is plainly a file: the step is setting a picture
      // on something, and the widget will load it under the same sandbox as the first paint.
      params[name] = toProxy(value, proxy);
    }
  }
};

const rewriteWebHook = (node: ElementInteraction, proxy: ResourceProxy, warnings: string[]): void => {
  const params = node.params;
  const url = params.url;
  if (typeof url !== 'string' || !isRemote(url) || isGranted(url, proxy)) {
    return;
  }

  const blocked = unproxyableFetch(params);
  if (blocked) {
    warnings.push(
      `The ${FETCHING_UTILITY} step "${node.title}" calls its endpoint directly because ${blocked}, so that ` +
        'request is subject to the network policy of the surface it renders in, and to the CORS headers of the ' +
        'API, and may not run. A plain GET with no credentials is fetched by the widget server instead, which ' +
        'always works.'
    );

    return;
  }

  params.url = grantUrl(url, proxy, 'data');
};

// A widget is not finished when it is painted: a flow can swap an image, rewrite markup or call an API on a click,
// and every URL it carries reaches the browser under the same sandbox as the first paint. Rewritten here so the
// second state of a widget loads exactly like its first — which is the bug this pass exists for.
const rewriteInteractions = (
  interactions: Record<string, ElementInteraction> | undefined,
  proxy: ResourceProxy,
  warnings: string[]
): void => {
  for (const node of Object.values(interactions ?? {})) {
    if (node.type === 'globalCallback' && node.action === NAVIGATION_ACTION) {
      continue;
    }

    if (node.type === 'utility' && node.action === FETCHING_UTILITY) {
      rewriteWebHook(node, proxy, warnings);
      continue;
    }

    const params = node.params;
    if (node.action === SET_STATE_ACTION && rewriteSetState(params, proxy)) {
      continue;
    }

    rewriteParams(params, proxy);
  }
};

// A transformer runs in the browser over data the widget bound, and its params are authored literals — a fallback
// picture for an empty field is one of them, and it reaches the DOM the same way the attribute it replaces does.
const rewriteBindings = (bindings: ElementDefinition['bindings'], proxy: ResourceProxy): void => {
  for (const category of Object.values(bindings ?? {})) {
    for (const binding of category) {
      for (const transformer of binding.transformers ?? []) {
        rewriteParams(transformer.params, proxy);
      }
    }
  }
};

const rewriteSchema = (schema: Schema, proxy: ResourceProxy, warnings: string[]): void => {
  for (const element of Object.values(schema.flat)) {
    rewriteInteractions(element.definition.interactions, proxy, warnings);
    rewriteBindings(element.definition.bindings, proxy);

    const attributes = element.attributes as Record<string, unknown>;
    for (const name of URL_ATTRIBUTES) {
      const value = attributes[name];
      if (typeof value === 'string' && isRemote(value) && !isGranted(value, proxy)) {
        attributes[name] = grantUrl(value, proxy);
      }
    }

    for (const name of MARKUP_ATTRIBUTES) {
      const value = attributes[name];
      if (typeof value === 'string' && value.includes('http')) {
        attributes[name] = rewriteText(value, proxy);
      }
    }

    const query = attributes.query;
    if (element.definition.type !== FETCHING_TYPE || typeof query !== 'string' || !isRemote(query)) {
      continue;
    }

    const blocked = unproxyableFetch(attributes);
    if (blocked) {
      warnings.push(
        `The ${FETCHING_TYPE} "${element.id}" calls its endpoint directly because ${blocked}, so ` +
          'that request is subject to the network policy of the surface it renders in, and to the CORS headers ' +
          'of the API, and may not run. A plain GET with no headers is fetched by the widget server instead, ' +
          'which always works.'
      );
      continue;
    }

    if (!isGranted(query, proxy)) {
      // Signed over its origin when it carries {{tokens}} the SDK substitutes in the browser (see grant.ts), so
      // the grant survives the substitution without becoming a grant for any host.
      attributes.query = grantUrl(query, proxy, 'data');
    }
  }
};

const rewriteStyle = (style: Style, proxy: ResourceProxy): void => {
  for (const items of Object.values(style.platform)) {
    for (const item of Object.values(items)) {
      for (const selector of Object.values(item.attributes)) {
        rewriteStyleBlock(selector, proxy);
        for (const variant of Object.values(selector.variants ?? {})) {
          rewriteStyleBlock(variant, proxy);
        }
      }

      // The compiled CSS of the item, written by the style ops before the global cache concatenates them.
      if (item.cache.includes('url(')) {
        item.cache = rewriteText(item.cache, proxy);
      }
    }
  }

  if (style.cache.includes('url(')) {
    style.cache = rewriteText(style.cache, proxy);
  }
};

/** Point everything an authored widget loads from outside — images, media, fonts, the data an apiContainer fetches
 *  and the URLs its interactions swap in later — at this server's endpoint, in place. The AGENT never sees this: it
 *  authors the real URL and this runs
 *  afterwards, on the throwaway space a render builds (so nothing shared is mutated) and before the global style
 *  cache is compiled (so the concatenated CSS comes out already rewritten). Returns what could not be rewritten,
 *  which is the only part the model hears about. */
export const proxifyResources = (space: { schema: Schema; style: Style }, proxy: ResourceProxy): string[] => {
  const warnings: string[] = [];
  rewriteSchema(space.schema, proxy, warnings);
  rewriteStyle(space.style, proxy);

  return warnings;
};
