import { NOT_FOUND_SLUG } from './routes';

import type { Element } from '../types';

/**
 * The pages for the addresses nothing answers, as an editor keeps them: one per place — the space, or one folder —, or
 * the router would pick one of two and an address land on whichever it picked (authoring refuses it, `not-found-twice`).
 * Whatever makes a page the 404 of a place — its slug typed `*`, a move into a folder, "use as 404 page" — asks here
 * first which page already is.
 */

type Pages = { flat: Record<string, Element | undefined>; pages: readonly string[] };

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/** Whether a page is the one for the addresses nothing answers in its place: its slug is `*`. */
export const isNotFoundPage = (attributes: Record<string, unknown> | undefined): boolean =>
  attributes?.slug === NOT_FOUND_SLUG;

/** The folder a page sits in — `''`, the space's top level. */
export const pageFolderOf = (attributes: Record<string, unknown> | undefined): string => text(attributes?.folder);

/** The page that already answers what nothing else does in `folder` (`''`, the space) — other than `except` — if one does. */
export const notFoundPageIn = ({ flat, pages }: Pages, folder: string, except?: string): string | undefined =>
  pages.find(id => {
    const attributes = flat[id]?.attributes;

    return id !== except && isNotFoundPage(attributes) && pageFolderOf(attributes) === folder;
  });

/** A page's name as a slug: `Not found` → `not-found`. */
export const slugOfName = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replaceAll(/\s+/g, '-')
    .replaceAll(/[^a-z0-9-]/g, '')
    .replaceAll(/-+/g, '-')
    .replaceAll(/^-|-$/g, '');

/**
 * A slug for a page that stops being its place's 404, from its name, that no other page in its folder has —
 * `not-found`, `not-found-2` —, so it keeps an address of its own rather than none.
 */
export const freeSlugFor = ({ flat, pages }: Pages, pageId: string): string => {
  const attributes = flat[pageId]?.attributes;
  const folder = pageFolderOf(attributes);
  const base = slugOfName(text(attributes?.name)) || 'page';
  const taken = new Set(
    pages
      .filter(id => id !== pageId && pageFolderOf(flat[id]?.attributes) === folder)
      .map(id => text(flat[id]?.attributes.slug))
  );
  let slug = base;
  for (let index = 2; taken.has(slug); index += 1) {
    slug = `${base}-${String(index)}`;
  }

  return slug;
};
