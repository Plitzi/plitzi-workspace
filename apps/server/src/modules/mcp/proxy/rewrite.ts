import { grantUrl, isGranted, isRemote } from './grant';

import type { ResourceProxy } from './types';
import type { Element, Schema, Style, StyleBlock, StyleObject, StyleValue } from '@plitzi/sdk-shared';

// Where a remote URL can sit in an authored widget. `src`/`poster` are the props the media elements read;
// `content`/`html` are the raw-markup elements (blockHtml, markdown), where a URL is embedded in text.
const URL_ATTRIBUTES = ['src', 'poster'];
const MARKUP_ATTRIBUTES = ['content', 'html'];

// The element that fetches at runtime: its `query` prop is the URL, and the response feeds every binding hanging
// off it. It is the whole point of a data-driven widget, and the one request a sandbox's connect-src blocks.
const FETCHING_TYPE = 'apiContainer';

const CSS_URL = /url\(\s*(["']?)(https?:\/\/[^"')\s]+)\1\s*\)/gi;
const HTML_SRC = /(<[^>]+?\ssrc\s*=\s*)(["'])(https?:\/\/[^"']+)\2/gi;
const MARKDOWN_IMAGE = /(!\[[^\]]*\]\(\s*)(https?:\/\/[^\s)]+)/gi;

// A URL inside HTML markup may carry escaped ampersands; what gets fetched is the unescaped one, so that is what
// is signed and granted.
const unescapeHtml = (url: string): string => url.replace(/&amp;/g, '&');

const toProxy = (url: string, proxy: ResourceProxy): string =>
  isGranted(url, proxy) ? url : grantUrl(unescapeHtml(url), proxy);

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

/** Why a fetching element's URL was left as authored, or undefined when it can be granted. Each case is one this
 *  hop cannot reproduce faithfully, and getting it wrong silently would be worse than the request being blocked:
 *  a write sent through a GET, or an API answering 401 because its credential was dropped on the way. */
const unproxyableFetch = (element: Element): string | undefined => {
  const { method, headers, accessToken } = element.attributes as {
    method?: unknown;
    headers?: unknown;
    accessToken?: unknown;
  };

  if (typeof method === 'string' && method.toLowerCase() !== 'get') {
    return `it is a ${method.toUpperCase()} request`;
  }

  if (typeof accessToken === 'string' && accessToken !== '') {
    return 'it sends its own credentials';
  }

  return headers && Object.keys(headers).length > 0 ? 'it sends its own headers' : undefined;
};

const rewriteSchema = (schema: Schema, proxy: ResourceProxy, warnings: string[]): void => {
  for (const element of Object.values(schema.flat)) {
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

    const blocked = unproxyableFetch(element);
    if (blocked) {
      warnings.push(
        `The ${FETCHING_TYPE} "${element.idRef ?? element.id}" calls its endpoint directly because ${blocked}, so ` +
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

/** Point everything an authored widget loads from outside — images, media, fonts, and the data an apiContainer
 *  fetches — at this server's endpoint, in place. The AGENT never sees this: it authors the real URL and this runs
 *  afterwards, on the throwaway space a render builds (so nothing shared is mutated) and before the global style
 *  cache is compiled (so the concatenated CSS comes out already rewritten). Returns what could not be rewritten,
 *  which is the only part the model hears about. */
export const proxifyResources = (space: { schema: Schema; style: Style }, proxy: ResourceProxy): string[] => {
  const warnings: string[] = [];
  rewriteSchema(space.schema, proxy, warnings);
  rewriteStyle(space.style, proxy);

  return warnings;
};
