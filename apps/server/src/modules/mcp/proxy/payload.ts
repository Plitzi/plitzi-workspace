import { grantUrl, isGranted, isRemote } from './grant';
import { looksLikeAsset } from './rewrite';

import type { ResourceProxy } from './types';

// The answer of an apiContainer: what it carries is not authored, so the rewrite that runs over a render never saw
// these URLs. A widget that lists recipes binds `{{item.thumb}}` into an image `src`, and the browser then loads
// whatever the API said — from an origin the host CSP does not declare, which is the picture that never paints.
// Rewritten on the way out, so a data-driven widget loads exactly like a static one.

const JSON_TYPES = ['application/json', 'application/ld+json'];

// Field names that name a picture even where the URL has no extension (an image CDN serving by id, with the format
// negotiated). Matched loosely because an API names them all differently: `strMealThumb`, `image_url`, `avatar`.
const ASSET_FIELD = /(image|img|thumb|photo|picture|avatar|icon|logo|cover|banner|poster|artwork|media|src)/i;

/** Is this what the endpoint fetched a body it can rewrite? Only JSON: it is what an apiContainer binds against,
 *  and re-serializing anything else would risk changing a document to fix a URL that may not even be loaded. */
export const rewritablePayload = (contentType: string): boolean =>
  JSON_TYPES.some(type => contentType.startsWith(type));

// The field a URL sits under is inherited through the arrays between them, so `images: ["https://…", …]` is judged
// by `images` like a plain `image` would be.
const rewriteNode = (node: unknown, field: string, proxy: ResourceProxy): unknown => {
  if (typeof node === 'string') {
    return isRemote(node) && !isGranted(node, proxy) && (looksLikeAsset(node) || ASSET_FIELD.test(field))
      ? grantUrl(node, proxy)
      : node;
  }

  if (Array.isArray(node)) {
    return node.map(item => rewriteNode(item, field, proxy));
  }

  if (node !== null && typeof node === 'object') {
    const entries = Object.entries(node as Record<string, unknown>);

    return Object.fromEntries(entries.map(([key, value]) => [key, rewriteNode(value, key, proxy)]));
  }

  return node;
};

/** Rewrite the asset URLs an API answer carries so the widget loads them through this endpoint too. Returns the
 *  body untouched when it is not the JSON it claimed to be — the widget asked for that response, and serving it
 *  as it came is better than failing the fetch over a rewrite. */
export const rewritePayload = (body: string, proxy: ResourceProxy): string => {
  try {
    return JSON.stringify(rewriteNode(JSON.parse(body), '', proxy));
  } catch {
    return body;
  }
};
