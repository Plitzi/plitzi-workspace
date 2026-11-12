import { createContext } from 'react';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import type { DocumentPart } from '@plitzi/sdk-shared/schema';

/**
 * The space sent in parts, as the browser gets the rest of it (`splitSchema`): a part is fetched by its name from the
 * page's own host — a file named by its content, kept by the browser for as long as it likes — and put into the space
 * before a page that needs it is drawn. Only a page server sends a space this way; the SDK alone never has a part to
 * fetch.
 */
export const PART_PATH = '/_plitzi/space/part/';

/** What a page needs before it is drawn: nothing, its parts fetched, or a load of its address from the server. */
export type PartsNeed = 'held' | 'fetch' | 'server';

export type SpaceParts = {
  /** What drawing `pageId` here would need. */
  need: (pageId: string) => PartsNeed;
  /** Fetches what `pageId` needs and puts it in the space: true once the page can be drawn, false if only the server can. */
  ensure: (pageId: string) => Promise<boolean>;
};

/** A document with no parts: every page is held. */
export const WHOLE: SpaceParts = { need: () => 'held', ensure: () => Promise.resolve(true) };

export const SpacePartsContext = createContext<SpaceParts>(WHOLE);

const isPart = (value: unknown): value is DocumentPart =>
  isRecord(value) && typeof value.root === 'string' && isRecord(value.flat);

/** Each part asked for once: a prefetch and the navigation that follows it share the same request. */
const asked = new Map<string, Promise<DocumentPart>>();

export const fetchPart = (name: string): Promise<DocumentPart> => {
  const known = asked.get(name);
  if (known) {
    return known;
  }

  const request = fetch(`${PART_PATH}${encodeURIComponent(name)}.json`, { credentials: 'same-origin' })
    .then(async response => {
      if (!response.ok) {
        throw new Error(`the part "${name}" answered ${String(response.status)}`);
      }

      const part: unknown = await response.json();
      if (!isPart(part)) {
        throw new Error(`the part "${name}" is not a part of a space`);
      }

      return part;
    })
    .catch((error: unknown) => {
      asked.delete(name);
      throw error;
    });
  asked.set(name, request);

  return request;
};
