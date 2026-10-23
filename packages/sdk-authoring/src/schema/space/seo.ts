import { isRecord } from '@plitzi/sdk-shared/helpers';
import { isHeadAddress, isOgType, OG_TYPES } from '@plitzi/sdk-shared/schema';

import { AuthoringError } from '../codes';
import { didYouMean } from '../suggest';

import type { PageSpec, StructuredData } from '../types';

/**
 * What a page tells search engines beside its title and description: whether to index and follow it (`robots`), and
 * what it is about in schema.org's words (`structuredData`, JSON-LD) — written into the head the server sends, which a
 * crawler reads without running the page.
 */

/** The robots directives search engines read, as Google documents them: one name each, or `name:value`. */
const ROBOTS = [
  'all',
  'index',
  'noindex',
  'follow',
  'nofollow',
  'none',
  'noarchive',
  'nosnippet',
  'noimageindex',
  'notranslate',
  'indexifembedded',
  'max-snippet',
  'max-image-preview',
  'max-video-preview',
  'unavailable_after'
];

/** A page's `robots`, as the head writes it: its directives, comma-separated, each one search engines know. */
export const robotsOf = (where: string, robots: string): string => {
  const directives = robots
    .split(',')
    .map(each => each.trim().toLowerCase())
    .filter(Boolean);
  if (directives.length === 0) {
    throw new AuthoringError(
      'robots-unknown',
      `${where}'s robots is empty: leave it out, or say what it is — 'noindex'.`
    );
  }

  for (const directive of directives) {
    const name = directive.split(':')[0] ?? '';
    if (!ROBOTS.includes(name)) {
      throw new AuthoringError(
        'robots-unknown',
        `${where}'s robots says "${directive}", which no search engine reads${didYouMean(name, ROBOTS) || '.'} The directives: ${ROBOTS.join(', ')}.`
      );
    }
  }

  return directives.join(', ');
};

/** Plain JSON, all the way down — text, finite numbers, booleans, null, lists and plain objects: a Date, a function,
 * undefined or a Map would be written as something else, or not at all. */
const jsonWhole = (value: unknown): boolean => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return true;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.every(jsonWhole);
  }

  if (typeof value === 'object') {
    const prototype: unknown = Object.getPrototypeOf(value);

    return (prototype === Object.prototype || prototype === null) && Object.values(value).every(jsonWhole);
  }

  return false;
};

/** A page's JSON-LD, one object or several: each says its vocabulary (`@context`) and what it is (`@type`). */
export const structuredDataOf = (where: string, data: StructuredData | StructuredData[]): StructuredData[] => {
  const items = Array.isArray(data) ? data : [data];
  items.forEach((item, index) => {
    const at = items.length === 1 ? where : `${where}'s structuredData[${String(index)}]`;
    if (!isRecord(item) || typeof item['@type'] !== 'string' || typeof item['@context'] !== 'string') {
      throw new AuthoringError(
        'structured-data-shape',
        `${at} is no JSON-LD a search engine reads: each item says its vocabulary and what it is — { '@context': 'https://schema.org', '@type': 'SportsEvent', … }.`
      );
    }

    if (!jsonWhole(item)) {
      throw new AuthoringError(
        'structured-data-shape',
        `${at} holds what JSON cannot carry (a function, a date object, undefined): its values are text, numbers, lists and objects.`
      );
    }
  });

  return items;
};

/** A template the page server reads as it answers: what it names is checked by the lint, its address only then. */
const TEMPLATE = /\{\{[\s\S]*\}\}/;

/**
 * The picture a link to the page shows: a file of the site, an address, or a template over the page's providers — a
 * link preview never runs the page, so an image it cannot reach is no picture at all.
 */
export const shareImageOf = (where: string, image: string): string => {
  const written = image.trim();
  if (written === '' || (!TEMPLATE.test(written) && !isHeadAddress(written))) {
    throw new AuthoringError(
      'share-image-invalid',
      `${where}'s seoImage ${JSON.stringify(image)} is neither a file of the site nor an address: \`'/og/home.png'\` (in public/), \`'https://…'\`, or a template over its providers — \`'{{ apiContainer_room.cover }}'\`.`
    );
  }

  return written;
};

/** What the page is, in Open Graph's words. */
export const ogTypeOf = (where: string, type: string) => {
  if (!isOgType(type)) {
    throw new AuthoringError(
      'og-type-unknown',
      `${where}'s seoType "${type}" is no kind Open Graph names${didYouMean(type, OG_TYPES) || '.'} The kinds: ${OG_TYPES.join(', ')}.`
    );
  }

  return type;
};

/** The page's head attributes, as the document holds them: nothing for a page that says none. */
export const seoAttributes = (
  where: string,
  page: Pick<PageSpec, 'robots' | 'structuredData' | 'seoImage' | 'seoImageAlt' | 'seoType'>
) => {
  if (page.seoImageAlt !== undefined && page.seoImage === undefined) {
    throw new AuthoringError(
      'share-image-invalid',
      `${where} says what its seoImage shows (seoImageAlt) and names no seoImage: give it the picture, or leave both out.`
    );
  }

  return {
    ...(page.robots === undefined ? {} : { seoRobots: robotsOf(where, page.robots) }),
    ...(page.structuredData === undefined ? {} : { seoStructuredData: structuredDataOf(where, page.structuredData) }),
    ...(page.seoImage === undefined ? {} : { seoImage: shareImageOf(where, page.seoImage) }),
    ...(page.seoImageAlt === undefined ? {} : { seoImageAlt: page.seoImageAlt }),
    ...(page.seoType === undefined ? {} : { seoType: ogTypeOf(where, page.seoType) })
  };
};
